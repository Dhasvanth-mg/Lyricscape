'use client';

import { useEffect } from 'react';
import { startIndexer } from '@/lib/analysis/indexer';

/** Mounts the song indexer once for the whole app (it renders nothing). See lib/analysis/indexer.ts. */
export function AudioIndexer() {
  useEffect(() => startIndexer(), []);
  return null;
}
