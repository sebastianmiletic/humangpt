import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

export function offlineApp(): Plugin {
  return {
    name: 'humangpt-offline-app',
    apply: 'build',
    async closeBundle() {
      const directory = path.resolve('dist/client');
      async function list(folder: string): Promise<string[]> {
        const entries = await readdir(folder, { withFileTypes: true });
        const groups = await Promise.all(entries.map((entry) => entry.isDirectory()
          ? list(path.join(folder, entry.name)) : Promise.resolve([path.join(folder, entry.name)])));
        return groups.flat();
      }
      const files = (await list(directory)).filter((file) => !file.endsWith(`${path.sep}sw.js`)).sort();
      const digest = createHash('sha256');
      for (const file of files) {
        digest.update(path.relative(directory, file));
        digest.update(await readFile(file));
      }
      const precache = files.map((file) => `/${path.relative(directory, file).split(path.sep).join('/')}`);
      const source = await readFile('src/service-worker.js', 'utf8');
      await writeFile(path.join(directory, 'sw.js'), source
        .replace('__CACHE_VERSION__', digest.digest('hex').slice(0, 16))
        .replace('__PRECACHE_FILES__', JSON.stringify(precache)));
    },
  };
}
