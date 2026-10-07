import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app';
import { loadConfig } from '../server/config';
import { MAX_CHARACTERS, MAX_WORDS } from '../shared/text';

function setup(overrides: NodeJS.ProcessEnv = {}) {
  const config = loadConfig({ NODE_ENV: 'test', OPENAI_API_KEY: 'server-only-test-secret', RATE_LIMIT_PER_HOUR: '100', ...overrides });
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({
    choices: [{ message: { content: 'Your natural rewrite.' }, finish_reason: 'stop' }],
  }));
  return { app: createApp(config, { fetcher }), fetcher };
}

describe('HTTP API', () => {
  it('reports readiness without exposing credentials', async () => {
    const { app } = setup();
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', configured: true });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).not.toContain('secret');
  });
  it('returns a real provider result and word counts', async () => {
    const { app, fetcher } = setup();
    const response = await request(app).post('/api/humanize').send({ text: 'My original draft.', tone: 'professional' }).expect(200);
    expect(response.body).toMatchObject({ text: 'Your natural rewrite.', tone: 'professional', sourceWords: 3, resultWords: 3, smartness: 'low' });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(response.text).not.toContain('server-only-test-secret');
  });
  it('defaults to the natural tone', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/humanize').send({ text: 'My draft' }).expect(200);
    expect(response.body.tone).toBe('natural');
  });
  it.each([
    { text: '' }, { text: '  \n  ' }, {}, { text: 123 },
    { text: 'Hello', tone: 'undetectable' }, { text: 'Hello', extra: true },
    { text: 'Hello', smartness: 'infinite' }, { text: 'Hello', vocabulary: 'nonsense' },
    { text: 'Hello', length: 'invent' }, { text: 'Hello', contractions: 'yes' },
    { text: 'Hello', sentenceVariety: 1 }, { text: 'Hello', protectedTerms: ['a'.repeat(81)] },
    { text: 'Hello', protectedTerms: Array(21).fill('a') },
    { text: 'word '.repeat(MAX_WORDS + 1) }, { text: 'a'.repeat(MAX_CHARACTERS + 1) },
  ])('rejects invalid input %j without contacting the provider', async (input) => {
    const { app, fetcher } = setup();
    const response = await request(app).post('/api/humanize').send(input).expect(400);
    expect(response.body.error.code).toBe('invalid_input');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('passes all validated controls to the cloud provider', async () => {
    const { app, fetcher } = setup();
    const response = await request(app).post('/api/humanize').send({ text: 'We utilize the guide.', tone: 'natural', smartness: 'high', vocabulary: 'advanced', length: 'concise', contractions: true, sentenceVariety: false, protectedTerms: ['Exact Product'] }).expect(200);
    expect(response.body.smartness).toBe('high');
    const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
    expect(body.messages[0].content).toContain('Retain precise and technical vocabulary');
    expect(body.messages[0].content).toContain('Edit more thoroughly');
    expect(JSON.parse(body.messages[1].content).protected_terms).toEqual(['Exact Product']);
  });
  it('rejects non-JSON bodies', async () => {
    const { app } = setup();
    await request(app).post('/api/humanize').type('form').send({ text: 'Hello' }).expect(415);
  });
  it('handles malformed JSON', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/humanize').set('Content-Type', 'application/json').send('{oops').expect(400);
    expect(response.body.error.code).toBe('invalid_json');
  });
  it('rejects oversized request bodies', async () => {
    const { app, fetcher } = setup();
    await request(app).post('/api/humanize').send({ text: 'a'.repeat(70_000) }).expect(413);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('explains missing configuration without fake rewrites', async () => {
    const { app, fetcher } = setup({ OPENAI_API_KEY: '' });
    expect((await request(app).get('/api/health')).body.configured).toBe(false);
    const response = await request(app).post('/api/humanize').send({ text: 'Hello' }).expect(503);
    expect(response.body.error.code).toBe('not_configured');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('enforces per-IP hourly limits', async () => {
    const { app, fetcher } = setup({ RATE_LIMIT_PER_HOUR: '2' });
    await request(app).post('/api/humanize').send({ text: 'Hello' }).expect(200);
    await request(app).post('/api/humanize').send({ text: 'Hello again' }).expect(200);
    const response = await request(app).post('/api/humanize').send({ text: 'Hello again again' }).expect(429);
    expect(response.body.error.code).toBe('rate_limit');
    expect(response.headers['retry-after']).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('enforces a daily provider-request cap', async () => {
    const { app, fetcher } = setup({ DAILY_REQUEST_LIMIT: '1' });
    await request(app).post('/api/humanize').send({ text: 'Hello' }).expect(200);
    const response = await request(app).post('/api/humanize').send({ text: 'Hello again' }).expect(429);
    expect(response.body.error.code).toBe('daily_limit');
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('releases concurrency slots after provider errors', async () => {
    const { app, fetcher } = setup();
    fetcher.mockResolvedValueOnce(Response.json({}, { status: 500 }));
    await request(app).post('/api/humanize').send({ text: 'Hello' }).expect(502);
    await request(app).post('/api/humanize').send({ text: 'Try again' }).expect(200);
  });
  it('rejects cross-site browser requests in production', async () => {
    const { app, fetcher } = setup({ NODE_ENV: 'production' });
    await request(app).post('/api/humanize').set('Origin', 'https://other.example').send({ text: 'Hello' }).expect(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('accepts same-origin HTTPS requests behind the Render proxy', async () => {
    const { app } = setup({ NODE_ENV: 'production' });
    await request(app).post('/api/humanize').set('Host', 'humangpt.example').set('Origin', 'https://humangpt.example').set('X-Forwarded-Proto', 'https').send({ text: 'Hello' }).expect(200);
  });
  it('sets security headers and does not advertise the framework', async () => {
    const { app } = setup();
    const response = await request(app).get('/api/health');
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('returns JSON for unknown API routes', async () => {
    const { app } = setup();
    const response = await request(app).get('/api/missing').expect(404);
    expect(response.body.error.code).toBe('not_found');
  });
});
