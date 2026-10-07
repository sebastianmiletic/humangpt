import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { countWords, MAX_CHARACTERS, MAX_WORDS, TONES } from '../shared/text';
import { LENGTHS, SMARTNESS_LEVELS, VOCABULARIES } from '../shared/settings';
import { resolveSmartness } from '../shared/local/analysis';
import type { AppConfig } from './config';
import { AppError } from './errors';
import { humanize } from './humanize';
import { UsageGuard } from './usage';

const inputSchema = z.object({
  text: z.string().trim().min(1, 'Paste a draft before rewriting.').max(MAX_CHARACTERS, `Keep your draft under ${MAX_CHARACTERS.toLocaleString('en-US')} characters.`),
  tone: z.enum(TONES).default('natural'),
  smartness: z.enum(SMARTNESS_LEVELS).default('adaptive'),
  vocabulary: z.enum(VOCABULARIES).default('balanced'),
  length: z.enum(LENGTHS).default('preserve'),
  contractions: z.boolean().default(false),
  sentenceVariety: z.boolean().default(true),
  protectedTerms: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
}).strict().refine((input) => countWords(input.text) <= MAX_WORDS, {
  message: `Keep your draft under ${MAX_WORDS.toLocaleString('en-US')} words. Try rewriting one section at a time.`,
  path: ['text'],
});

interface AppOptions {
  fetcher?: typeof fetch;
  staticDirectory?: string;
}

export function createApp(config: AppConfig, options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Render sits behind a single trusted reverse-proxy hop.
  if (config.isProduction) app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.isProduction ? [] : null,
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  }));
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', configured: Boolean(config.apiKey) });
  });

  const limiter = rateLimit({
    windowMs: 60 * 60 * 1_000,
    limit: config.rateLimitPerHour,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({
      error: { code: 'rate_limit', message: 'You have reached the hourly rewriting limit. Please try again in an hour.' },
    }),
  });
  const usage = new UsageGuard(config.dailyRequestLimit, config.maxConcurrentRequests);

  app.post('/api/humanize', (req, _res, next) => {
    if (config.isProduction) {
      const origin = req.get('origin');
      const expected = `${req.protocol}://${req.get('host')}`;
      if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== expected)) {
        return next(new AppError(403, 'origin_rejected', 'Please rewrite text from this site, not another website.'));
      }
    }
    if (!req.is('application/json')) {
      return next(new AppError(415, 'unsupported_media', 'Send the draft as JSON.'));
    }
    next();
  }, limiter, express.json({ limit: '64kb' }), async (req, res) => {
    const parsed = inputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'invalid_input', parsed.error.issues[0].message);
    }
    if (!config.apiKey) {
      throw new AppError(503, 'not_configured', 'Rewriting is not configured yet. The site owner needs to add OPENAI_API_KEY on the server.');
    }

    const release = usage.begin(req.ip ?? 'unknown');
    const controller = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on('close', onClose);
    try {
      const { text, ...settings } = parsed.data;
      const rewritten = await humanize(text, settings.tone, config, controller.signal, options.fetcher, settings);
      if (!controller.signal.aborted) {
        res.json({ text: rewritten, tone: settings.tone, smartness: resolveSmartness(text, settings).level, sourceWords: countWords(text), resultWords: countWords(rewritten) });
      }
    } finally {
      res.off('close', onClose);
      release();
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'This API endpoint does not exist.' } });
  });

  if (options.staticDirectory) {
    const directory = path.resolve(options.staticDirectory);
    app.use(express.static(directory, {
      index: false,
      maxAge: 0,
      setHeaders: (res, file) => {
        if (file.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(directory, 'index.html'));
    });
  }

  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (res.headersSent || res.destroyed) return;
    if (error instanceof AppError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error && typeof error === 'object' && 'type' in error) {
      if (error.type === 'entity.too.large') {
        res.status(413).json({ error: { code: 'body_too_large', message: 'That draft is too large. Try a shorter section.' } });
        return;
      }
      if (error.type === 'entity.parse.failed') {
        res.status(400).json({ error: { code: 'invalid_json', message: 'The request is not valid JSON.' } });
        return;
      }
    }
    // Never log pasted text, provider payloads, or credentials.
    console.error('An unexpected server error occurred.');
    res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } });
  };
  app.use(errorHandler);
  return app;
}
