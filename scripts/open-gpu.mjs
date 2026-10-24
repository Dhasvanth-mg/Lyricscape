// Open Lyricscape in a browser that is running on the DEDICATED GPU.   pnpm open:gpu [url]
//
// A page cannot pick the GPU; the browser process is started on one. This starts Edge / Chrome with --force_high_performance_gpu.
// If that browser is already running, the flag is ignored (new windows join the running process), so we stop and say so instead of
// pretending. It does not change any system setting and uses your normal browser profile (your library and sign-ins).

import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:3000';
const pf = process.env['ProgramFiles'] ?? 'C:\\Program Files';
const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
const local = process.env['LOCALAPPDATA'] ?? '';
const candidates = [
  { name: 'Edge', exe: `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, proc: 'msedge.exe' },
  { name: 'Edge', exe: `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`, proc: 'msedge.exe' },
  { name: 'Chrome', exe: `${pf}\\Google\\Chrome\\Application\\chrome.exe`, proc: 'chrome.exe' },
  { name: 'Chrome', exe: `${pf86}\\Google\\Chrome\\Application\\chrome.exe`, proc: 'chrome.exe' },
  { name: 'Chrome', exe: `${local}\\Google\\Chrome\\Application\\chrome.exe`, proc: 'chrome.exe' },
];

if (process.platform !== 'win32') {
  console.log('On macOS the system switches GPUs automatically; on Linux use DRI_PRIME=1 or __NV_PRIME_RENDER_OFFLOAD=1 with your browser.');
  process.exit(0);
}
const found = candidates.find((c) => existsSync(c.exe));
if (!found) {
  console.error('Could not find Edge or Chrome. Start your browser with --force_high_performance_gpu yourself.');
  process.exit(1);
}
const running = (() => {
  try {
    return execFileSync('tasklist', ['/FI', `IMAGENAME eq ${found.proc}`, '/NH'], { encoding: 'utf8' }).toLowerCase().includes(found.proc);
  } catch {
    return false;
  }
})();
if (running) {
  console.error(`${found.name} is already running, so it would ignore the flag. Close every ${found.name} window (and background apps, see Task Manager) and run this again,`);
  console.error('or set it once in Windows: Settings > System > Display > Graphics > add the browser > Options > High performance.');
  process.exit(2);
}
spawn(found.exe, ['--force_high_performance_gpu', url], { detached: true, stdio: 'ignore' }).unref();
console.log(`Started ${found.name} on the dedicated GPU: ${url}`);
console.log('Check Settings > Graphics in the app: it should now name your NVIDIA / AMD card.');
