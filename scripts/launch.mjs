// One-click launcher: installs dependencies if they are missing, starts the dev server (unless one is already running on the
// port) and opens the app in your browser once it answers. Run it with `pnpm go`, or double-click start.bat on Windows.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
// 127.0.0.1, not localhost: the Spotify redirect URL is registered against it
let URL_ = `http://127.0.0.1:${PORT}`;
const win = process.platform === 'win32';

const probe = async (u) => {
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(1500) });
    return r.status < 500;
  } catch {
    return false;
  }
};
/** is the app answering? (an already-running server may be bound to localhost only) */
const up = async () => {
  if (await probe(URL_)) return true;
  const alt = `http://localhost:${PORT}`;
  if (await probe(alt)) {
    URL_ = alt;
    return true;
  }
  return false;
};

const open = () => {
  if (win) spawn('cmd', ['/c', 'start', '', URL_], { stdio: 'ignore', detached: true }).unref();
  else if (process.platform === 'darwin') spawn('open', [URL_], { stdio: 'ignore', detached: true }).unref();
  else spawn('xdg-open', [URL_], { stdio: 'ignore', detached: true }).unref();
};

if (await up()) {
  console.log(`Lyricscape is already running at ${URL_}. Opening it.`);
  open();
  process.exit(0);
}

if (!existsSync(path.join(root, 'node_modules'))) {
  console.log('First run: installing dependencies (a few minutes)...');
  const r = spawnSync('pnpm', ['install'], { cwd: root, stdio: 'inherit', shell: win });
  if (r.status !== 0) {
    console.error('\nInstall failed. Make sure Node 20+ and pnpm are installed (npm i -g pnpm), then try again.');
    process.exit(r.status ?? 1);
  }
}

console.log(`Starting Lyricscape on ${URL_} ...`);
const dev = spawn('pnpm', ['dev', '--hostname', '127.0.0.1', '--port', String(PORT)], { cwd: root, stdio: 'inherit', shell: win });
dev.on('exit', async (code) => {
  // `next dev` refuses to start twice: if the app is answering anyway, that is fine
  if (code && (await up())) {
    console.log(`
Lyricscape is already running at ${URL_}.`);
    process.exit(0);
  }
  process.exit(code ?? 0);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => dev.kill());

const t0 = Date.now();
while (Date.now() - t0 < 180_000) {
  await new Promise((r) => setTimeout(r, 1000));
  if (await up()) {
    console.log(`\nReady: ${URL_}  (press Ctrl+C here to stop)\n`);
    open();
    break;
  }
}
