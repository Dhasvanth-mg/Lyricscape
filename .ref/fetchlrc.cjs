const fs = require('fs');
const dir = process.argv[2];
fs.mkdirSync(dir, { recursive: true });
(async () => {
  const songs = [['Kanye West', 'Flashing Lights', 237], ['Tame Impala', 'Let It Happen', 467], ['Empire of the Sun', 'We Are the People', 245], ['Eminem', 'Superman', 350]];
  for (const [a, t, d] of songs) {
    const u = new URL('https://lrclib.net/api/get');
    u.searchParams.set('artist_name', a); u.searchParams.set('track_name', t); u.searchParams.set('duration', String(d));
    const r = await fetch(u, { headers: { 'User-Agent': 'Lyricscape-test' } });
    const j = await r.json();
    fs.writeFileSync(`${dir}/${t.replace(/\W/g, '')}.json`, JSON.stringify(j));
    console.log(t, r.status, 'dur', j.duration, 'synced', !!j.syncedLyrics, (j.syncedLyrics || '').split('\n').length, 'lines');
  }
})();
