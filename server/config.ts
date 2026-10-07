import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  OPENAI_API_KEY: z.string().trim().default(''),
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-4.1-mini'),
  OPENAI_BASE_URL: z.url().default('https://api.openai.com/v1'),
  RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(10_000).default(15),
  DAILY_REQUEST_LIMIT: z.coerce.number().int().min(1).max(100_000).default(200),
});

export interface AppConfig {
  port: number;
  isProduction: boolean;
  apiKey: string;
  model: string;
  baseUrl: string;
  rateLimitPerHour: number;
  dailyRequestLimit: number;
  maxConcurrentRequests: number;
  providerTimeoutMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const url = new URL(parsed.OPENAI_BASE_URL);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username || url.password || url.search || url.hash
  ) {
    throw new Error('OPENAI_BASE_URL must use HTTPS (HTTP is allowed only for localhost), with no credentials, query, or fragment.');
  }

  return {
    port: parsed.PORT,
    isProduction: parsed.NODE_ENV === 'production',
    apiKey: parsed.OPENAI_API_KEY,
    model: parsed.OPENAI_MODEL,
    baseUrl: parsed.OPENAI_BASE_URL.replace(/\/+$/, ''),
    rateLimitPerHour: parsed.RATE_LIMIT_PER_HOUR,
    dailyRequestLimit: parsed.DAILY_REQUEST_LIMIT,
    maxConcurrentRequests: 4,
    providerTimeoutMs: 45_000,
  };
}
