'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MlMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';
import type { FeatureCollection, Geometry } from 'geojson';

export type MapPlace = { id: string; lat: number; lng: number; count: number; precisionM: number; label?: string };

function graticule(step = 30): FeatureCollection<Geometry> {
  const lines: FeatureCollection<Geometry>['features'] = [];
  for (let lng = -180; lng <= 180; lng += step) lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: Array.from({ length: 37 }, (_, i) => [lng, -90 + i * 5]) } });
  for (let lat = -60; lat <= 60; lat += step) lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]) } });
  return { type: 'FeatureCollection', features: lines };
}

const BLANK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0a0c11' } }],
};

/**
 * MapLibre map. With no NEXT_PUBLIC_MAP_STYLE_URL it draws a fully offline basemap (graticule + land from
 * Natural Earth via world-atlas) so nothing is fetched from a tile server. Set the env var for a real basemap.
 */
export function MapView({ places, selectedId, onSelect, className }: { places: MapPlace[]; selectedId: string | null; onSelect: (id: string | null) => void; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;

  useEffect(() => {
    let disposed = false;
    let map: MlMap | null = null;
    void (async () => {
      try {
        const maplibre = await import('maplibre-gl');
        maplibre.setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.mjs');
        if (disposed || !el.current) return;
        const m = new maplibre.Map({
          container: el.current,
          style: styleUrl || BLANK_STYLE,
          center: [10, 25],
          zoom: 1.4,
          minZoom: 0.6,
          attributionControl: styleUrl ? { compact: true } : false,
          cooperativeGestures: false,
        });
        map = m;
        m.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        mapRef.current = m;
        m.on('error', (e) => {
          if (styleUrl) setError(`Basemap failed to load: ${(e.error as Error)?.message ?? 'unknown error'}`);
        });
        m.on('load', () => {
          if (!map) return;
          if (!styleUrl) {
            const topo = land110 as unknown as Topology;
            const land = feature(topo, topo.objects.land as never) as unknown as FeatureCollection<Geometry>;
            map.addSource('land', { type: 'geojson', data: land });
            map.addSource('grat', { type: 'geojson', data: graticule() });
            map.addLayer({ id: 'grat', type: 'line', source: 'grat', paint: { 'line-color': '#1a1f2a', 'line-width': 1 } });
            map.addLayer({ id: 'land-fill', type: 'fill', source: 'land', paint: { 'fill-color': '#161a23' } });
            map.addLayer({ id: 'land-line', type: 'line', source: 'land', paint: { 'line-color': '#2b3342', 'line-width': 0.8 } });
          }
          map.addSource('places', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 38, clusterMaxZoom: 11 });
          // accuracy halos: the stored cell is approximate, so the map says so
          map.addLayer({
            id: 'halo',
            type: 'circle',
            source: 'places',
            filter: ['!', ['has', 'point_count']],
            paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 8, 8, 26, 12, 56], 'circle-color': '#ff3d71', 'circle-opacity': 0.12, 'circle-blur': 0.6 },
          });
          map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'places',
            filter: ['has', 'point_count'],
            paint: { 'circle-color': '#ff3d71', 'circle-opacity': 0.85, 'circle-radius': ['step', ['get', 'point_count'], 12, 5, 16, 20, 22, 100, 30], 'circle-stroke-width': 2, 'circle-stroke-color': '#08080a' },
          });
          map.addLayer({
            id: 'points',
            type: 'circle',
            source: 'places',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': ['case', ['boolean', ['get', 'selected'], false], '#ffd23f', '#ff3d71'],
              'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 6, 20, 13],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#08080a',
            },
          });
          map.on('click', 'clusters', (e) => {
            const f = e.features?.[0];
            if (!f || !map) return;
            const src = map.getSource('places') as GeoJSONSource;
            void src.getClusterExpansionZoom(f.properties?.cluster_id as number).then((zoom) => map?.easeTo({ center: (f.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom: zoom + 0.3 }));
          });
          map.on('click', 'points', (e) => onSelectRef.current((e.features?.[0]?.properties?.id as string) ?? null));
          map.on('click', (e) => {
            if (!map) return;
            const hit = map.queryRenderedFeatures(e.point, { layers: ['points', 'clusters'] });
            if (!hit.length) onSelectRef.current(null);
          });
          for (const l of ['points', 'clusters']) {
            map.on('mouseenter', l, () => map && (map.getCanvas().style.cursor = 'pointer'));
            map.on('mouseleave', l, () => map && (map.getCanvas().style.cursor = ''));
          }
          setReady(true);
        });
      } catch (e) {
        setError((e as Error).message || 'The map could not start (WebGL may be unavailable).');
      }
    })();
    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  // push data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource('places') as GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features: places.map((p) => ({
        type: 'Feature',
        properties: { id: p.id, count: p.count, selected: p.id === selectedId },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
    });
  }, [places, selectedId, ready]);

  // fit to data once per data identity
  const fitKey = places.map((p) => p.id).join(',');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || places.length === 0) return;
    const lngs = places.map((p) => p.lng);
    const lats = places.map((p) => p.lat);
    const w = Math.min(...lngs);
    const e = Math.max(...lngs);
    const s = Math.min(...lats);
    const n = Math.max(...lats);
    if (w === e && s === n) map.easeTo({ center: [w, s], zoom: 9, duration: 700 });
    else map.fitBounds([[w, s], [e, n]], { padding: 70, maxZoom: 10, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready]);

  // focus selection
  useEffect(() => {
    const map = mapRef.current;
    const p = places.find((x) => x.id === selectedId);
    if (map && ready && p) map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 7), duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  return (
    <div className={className} data-testid="music-map">
      <div ref={el} className="h-full w-full" />
      {error && <p role="alert" className="absolute inset-x-4 bottom-4 rounded-lg bg-red-950/80 p-3 text-sm text-red-200">{error}</p>}
      {!styleUrl && ready && <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-ink-500">Offline basemap · Natural Earth · set NEXT_PUBLIC_MAP_STYLE_URL for streets</p>}
    </div>
  );
}
