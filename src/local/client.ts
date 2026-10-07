import type { LocalResult } from '../../shared/local/engine';
import type { RewriteSettings } from '../../shared/settings';

export function runLocal(text: string, settings: RewriteSettings, signal: AbortSignal): Promise<LocalResult> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => { cleanup(); reject(new DOMException('Rewrite canceled.', 'AbortError')); };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('The local editor took too long. Try a shorter section.'));
    }, 10_000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: LocalResult; error?: string }>) => {
      cleanup();
      if (signal.aborted) return reject(new DOMException('Rewrite canceled.', 'AbortError'));
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error || 'The local editor returned no result.'));
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('Could not load the local editor. Reload while online once, then try again.'));
    };
    worker.postMessage({ text, settings });
  });
}
