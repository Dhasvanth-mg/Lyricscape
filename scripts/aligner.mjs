// Starts the optional lyric aligner service on 127.0.0.1:8765:  pnpm aligner
// One-time setup:  py -3.11 -m venv tools/aligner/.venv  &&  tools/aligner/.venv/Scripts/python -m pip install -r tools/aligner/requirements.txt
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'tools', 'aligner');
const py = [path.join(dir, '.venv', 'Scripts', 'python.exe'), path.join(dir, '.venv', 'bin', 'python')].find(existsSync);
if (!py) {
  console.error('No Python environment at tools/aligner/.venv. See tools/aligner/README.md for the one-time setup.');
  process.exit(1);
}
const port = process.env.ALIGNER_PORT ?? '8765';
const p = spawn(py, ['-m', 'uvicorn', 'server:app', '--host', '127.0.0.1', '--port', port], { cwd: dir, stdio: 'inherit', env: { ...process.env, HF_HUB_DISABLE_SYMLINKS_WARNING: '1' } });
p.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => p.kill());
