import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { readPreferences, savePreferences } from '../src/preferences';

afterEach(() => vi.unstubAllGlobals());

describe('private preference storage', () => {
  it('defaults to local processing and safe controls', () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(readPreferences()).toEqual({ engine: 'local', settings: DEFAULT_SETTINGS });
  });
  it('does not persist protected phrases or submitted text', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    savePreferences({ engine: 'local', settings: { ...DEFAULT_SETTINGS, protectedTerms: ['My Confidential Brand'] } });
    const stored = JSON.parse(setItem.mock.calls[0][1]);
    expect(stored).toMatchObject({ engine: 'local', smartness: 'adaptive', vocabulary: 'balanced' });
    expect(stored.protectedTerms).toBeUndefined();
    expect(JSON.stringify(stored)).not.toContain('Confidential');
    expect(stored.text).toBeUndefined();
  });
  it('restores valid preferences without restoring private phrases', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ engine: 'cloud', tone: 'casual', smartness: 'high', vocabulary: 'simple', length: 'concise', protectedTerms: ['private'], contractions: true, sentenceVariety: false }) });
    expect(readPreferences()).toEqual({ engine: 'cloud', settings: { ...DEFAULT_SETTINGS, tone: 'casual', smartness: 'high', vocabulary: 'simple', length: 'concise', contractions: true, sentenceVariety: false } });
  });
  it('recovers from invalid settings and corrupt storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ engine: 'unknown', smartness: 'infinite', vocabulary: {}, contractions: 'yes' }) });
    expect(readPreferences()).toEqual({ engine: 'local', settings: DEFAULT_SETTINGS });
    vi.stubGlobal('localStorage', { getItem: () => '{invalid' });
    expect(readPreferences().engine).toBe('local');
  });
  it('does not break editing when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
      setItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
    });
    expect(readPreferences().engine).toBe('local');
    expect(() => savePreferences({ engine: 'local', settings: DEFAULT_SETTINGS })).not.toThrow();
  });
});
