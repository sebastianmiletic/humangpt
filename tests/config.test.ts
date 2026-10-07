import { describe, expect, it } from 'vitest';
import { loadConfig } from '../server/config';

describe('configuration', () => {
  it('starts safely without an API key', () => {
    expect(loadConfig({})).toMatchObject({ apiKey: '', port: 3001, model: 'gpt-4.1-mini', dailyRequestLimit: 200 });
  });
  it('reads Render environment settings', () => {
    expect(loadConfig({ NODE_ENV: 'production', PORT: '10000', OPENAI_API_KEY: ' test-key ' })).toMatchObject({ isProduction: true, port: 10000, apiKey: 'test-key' });
  });
  it('normalizes a provider base URL', () => {
    expect(loadConfig({ OPENAI_BASE_URL: 'https://example.com/v1/' }).baseUrl).toBe('https://example.com/v1');
  });
  it('allows a local test provider', () => {
    expect(loadConfig({ OPENAI_BASE_URL: 'http://127.0.0.1:8080/v1' }).baseUrl).toContain(':8080');
  });
  it.each(['http://example.com/v1', 'https://user:password@example.com/v1', 'https://example.com/v1?secret=1', 'ftp://example.com/v1', 'https://example.com/v1#fragment'])('rejects unsafe URL %s', (url) => {
    expect(() => loadConfig({ OPENAI_BASE_URL: url })).toThrow();
  });
  it.each([{ PORT: '-1' }, { PORT: 'nope' }, { RATE_LIMIT_PER_HOUR: '0' }, { DAILY_REQUEST_LIMIT: '0' }])('rejects invalid numeric settings %j', (env) => {
    expect(() => loadConfig(env)).toThrow();
  });
});
