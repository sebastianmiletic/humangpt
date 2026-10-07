import { DEFAULT_SETTINGS, LENGTHS, SMARTNESS_LEVELS, VOCABULARIES, type Engine, type RewriteSettings } from '../shared/settings';
import { TONES } from '../shared/text';

const KEY = 'humangpt.preferences.v2';
export interface Preferences { engine: Engine; settings: RewriteSettings }

export function readPreferences(): Preferences {
  const fallback: Preferences = { engine: 'local', settings: { ...DEFAULT_SETTINGS, protectedTerms: [] } };
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') return fallback;
    const choose = <T extends string>(choices: readonly T[], value: unknown, otherwise: T): T => choices.includes(value as T) ? value as T : otherwise;
    return {
      engine: data.engine === 'cloud' ? 'cloud' : 'local',
      settings: {
        tone: choose(TONES, data.tone, DEFAULT_SETTINGS.tone),
        smartness: choose(SMARTNESS_LEVELS, data.smartness, DEFAULT_SETTINGS.smartness),
        vocabulary: choose(VOCABULARIES, data.vocabulary, DEFAULT_SETTINGS.vocabulary),
        length: choose(LENGTHS, data.length, DEFAULT_SETTINGS.length),
        contractions: data.tone === 'professional' ? false : typeof data.contractions === 'boolean' ? data.contractions : DEFAULT_SETTINGS.contractions,
        sentenceVariety: typeof data.sentenceVariety === 'boolean' ? data.sentenceVariety : DEFAULT_SETTINGS.sentenceVariety,
        protectedTerms: [],
      },
    };
  } catch { return fallback; }
}

export function savePreferences(preferences: Preferences): void {
  try {
    // Never persist the draft, rewrite, or user-entered protected phrases.
    const { protectedTerms: _privateTerms, ...safeSettings } = preferences.settings;
    localStorage.setItem(KEY, JSON.stringify({ engine: preferences.engine, ...safeSettings }));
  } catch { /* Private browsing or blocked storage must not disable editing. */ }
}
