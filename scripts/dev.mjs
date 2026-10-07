import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const children = [
  spawn(process.execPath, ['--import', 'tsx', '--watch', 'server/index.ts'], { cwd, stdio: 'inherit' }),
  spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))], { cwd, stdio: 'inherit' }),
];
let stopping = false;
let exitCode = 0;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    process.exit(exitCode);
  }, 5_000).unref();
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(`Could not start the development server: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
    if (children.every((item) => item.exitCode !== null || item.signalCode !== null)) {
      process.exit(exitCode);
    }
  });
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
