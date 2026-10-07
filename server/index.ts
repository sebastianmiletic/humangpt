import dotenv from 'dotenv';
import { createApp } from './app';
import { loadConfig } from './config';

dotenv.config({ quiet: true });
const config = loadConfig();
const app = createApp(config, {
  staticDirectory: config.isProduction ? 'dist/client' : undefined,
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.info(`HumanGPT is listening on port ${config.port}.`);
  if (!config.apiKey) console.warn('Rewriting is disabled until OPENAI_API_KEY is configured.');
});
server.requestTimeout = 75_000;
server.headersTimeout = 15_000;

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
