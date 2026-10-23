// Runs the web app and the media worker together:  pnpm dev:all
import { spawn } from 'node:child_process';

const procs = [
  ['web', 'pnpm', ['dev']],
  ['worker', 'pnpm', ['worker']],
].map(([name, cmd, args]) => {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: true, env: { ...process.env, FORCE_COLOR: '1' } });
  p.on('exit', (code) => {
    console.log(`[dev:all] ${name} exited (${code})`);
    for (const q of procs) q.kill();
    process.exit(code ?? 0);
  });
  return p;
});
process.on('SIGINT', () => procs.forEach((p) => p.kill()));
