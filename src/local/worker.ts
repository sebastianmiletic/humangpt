import { rewriteLocal } from '../../shared/local/engine';
import type { RewriteSettings } from '../../shared/settings';

export interface LocalRequest { text: string; settings: RewriteSettings }

self.addEventListener('message', (event: MessageEvent<LocalRequest>) => {
  try {
    self.postMessage({ result: rewriteLocal(event.data.text, event.data.settings) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'The local editor could not finish this draft.' });
  }
});
