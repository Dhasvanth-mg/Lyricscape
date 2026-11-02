const fs = require('fs');
const dir = process.argv[2];
(async () => {
  for (const [t, a, d] of [['Flashing Lights', 'Kanye West', 237], ['Let It Happen', 'Tame Impala', 467], ['Superman', 'Eminem', 350]]) {
    const u = new URL('http://127.0.0.1:3000/api/lyrics/lookup');
    u.searchParams.set('title', t); u.searchParams.set('artist', a); u.searchParams.set('duration', String(d));
    const r = await fetch(u);
    const j = await r.json();
    console.log(t, r.status, 'hasWordSync', j.hasWordSync, 'source', j.source, 'keys', Object.keys(j).join(','));
    if (j.hasWordSync && j.synced) fs.writeFileSync(`${dir}/${t.replace(/\W/g, '')}.word.lrc`, j.synced);
  }
})();
