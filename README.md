# HumanGPT

A simple AI writing humanizer. Paste a draft, choose a tone, and rewrite it into clearer, more natural language.

**No detector guarantees.** AI checkers are unreliable. HumanGPT does not promise “0% AI,” manufacture detector scores, or guarantee that a rewrite will pass a checker. Review every rewrite for accuracy and follow any applicable disclosure requirements.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sebastianmiletic/humangpt)

## Features

- Clean, responsive, side-by-side editor with a stacked mobile layout.
- Natural, casual, and professional tones.
- Copy to clipboard, download as `.txt`, and Ctrl/Command + Enter to rewrite.
- Live word counts, a sample draft, cancellation, and helpful error states.
- Up to 1,500 whitespace-delimited words or 12,000 characters per request.
- Server-side OpenAI integration. Your API key is never sent to the browser.
- No database, accounts, analytics, or saved drafts.
- Request limits, daily usage cap, security headers, and provider timeouts.
- Render Blueprint and GitHub Actions CI included.

## Deploy on Render

You need a Render account and an **OpenAI API key with API billing enabled**. A ChatGPT subscription does not include API credits. Render hosting and AI-provider usage are separate services.

### Recommended: Blueprint

1. Click **Deploy to Render** above, or choose **New → Blueprint** in Render.
2. Connect this GitHub repository, `sebastianmiletic/humangpt`, and select the `main` branch.
3. Render reads `render.yaml` and configures one Node web service.
4. Set `OPENAI_API_KEY` when prompted. Enter it only in Render's secret environment settings, not in GitHub or `render.yaml`.
5. Deploy, then open the service's `.onrender.com` URL and try a short draft.

The default model is `gpt-4.1-mini`. Change `OPENAI_MODEL` in Render if needed. The root directory is the repository root.

### Alternative: a Web Service

Choose **New → Web Service**, connect the repo, and configure:

| Setting | Value |
| --- | --- |
| Language/runtime | Node |
| Branch | `main` |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| `NODE_VERSION` | `22.22.0` |
| `NODE_ENV` | `production` |
| `OPENAI_API_KEY` | Your secret API key |
| `OPENAI_MODEL` | `gpt-4.1-mini` |

Render automatically provides `PORT`; do not hardcode it. **Use a Web Service, not a Static Site**: rewriting requires the backend. No separate frontend deployment or CORS configuration is needed.

The Blueprint selects Render's free plan. Free services can sleep when inactive and take time to wake up. If the first request is slow, wait and retry. Choose a paid plan if you need an always-on service. AI requests still incur provider charges on a free hosting plan.

### Troubleshooting

- **“One setup step left”**: add `OPENAI_API_KEY` under the service's **Environment** settings and redeploy.
- **Provider authentication error**: verify the key and the account's model access.
- **Provider usage limit**: check API billing, quota, and provider rate limits.
- **Daily or hourly limit**: wait for the limit to reset, or adjust the server environment settings below.
- **Health check says `configured: true`**: a key is present. This does not verify that the key, billing, or provider are working.

## Run locally

Use Node 22.12+ (the project pins Node 22.22.0) and npm.

```bash
git clone https://github.com/sebastianmiletic/humangpt.git
cd humangpt
npm ci
cp .env.example .env
```

Edit `.env` and set `OPENAI_API_KEY`, then:

```bash
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to the local server on port 3001. The interface still opens without a key, but rewriting remains disabled; it never substitutes a fake rewrite.

To run the production build locally:

```bash
npm run build
NODE_ENV=production npm start
```

Open **http://localhost:3001** (or your configured `PORT`). Both the frontend and API are served by Express.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Empty | Required for rewriting; server-only secret. |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Chat Completions model. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Provider base URL; no `/chat/completions` suffix. |
| `PORT` | `3001` | HTTP port; supplied by Render. |
| `NODE_ENV` | `development` | Set to `production` to serve built frontend files. |
| `RATE_LIMIT_PER_HOUR` | `15` | Requests per client IP, per one-hour window. |
| `DAILY_REQUEST_LIMIT` | `200` | Provider request attempts per instance, per UTC day. |

An alternative provider must support OpenAI-compatible Chat Completions, including `max_completion_tokens` and `choices[].message.content`. Use HTTPS except for a localhost provider. Some compatible providers may need adjustments to the request format.

## Privacy and operating costs

Drafts and rewrites live in browser memory and are not saved by this app. Refreshing the page clears them. Submitted drafts are sent to the configured AI provider. The app does not log draft text or provider payloads, but the hosting platform and provider may retain data under their own policies. Do not paste confidential information without reviewing those policies.

This is an anonymous public writing tool. The backend limits requests per IP, permits one active rewrite per IP and four total, and caps provider requests at 200 per UTC day by default. Input length and output tokens are also capped. **These are abuse-reduction measures, not a guaranteed spending limit.**

Limits are in memory, reset when the service restarts, and are not shared across multiple instances. Failed provider attempts consume the daily request allowance. Client cancellation does not guarantee that the provider stops processing or charging. Configure provider-side spending controls and alerts; add authentication and a shared rate-limit store before scaling or exposing a larger usage budget. Production proxy trust is configured for Render's reverse proxy; review it when hosting elsewhere.

## Tests

```bash
npm run check               # TypeScript, unit/API tests, production build
npx playwright install chromium
npm run test:e2e             # Desktop + mobile browser and automated accessibility tests
npm audit
```

Tests use fake provider responses and never require or spend an API key. They cover request validation, provider failures, limits, input/output handling, copy/download, cancellation, responsive behavior, and automated WCAG checks. Automated checks are not a substitute for a complete accessibility audit or live-provider testing after deployment.

GitHub Actions runs type checks, tests, the build, and browser checks on pushes and pull requests.

## Stack and structure

React + TypeScript + Vite on the frontend; Express + TypeScript on the backend. One web service, no database.

```text
src/          Editor UI and styles
server/       HTTP API, AI-provider integration, configuration, and usage limits
shared/       Text limits, tones, and word counts
tests/        Unit, API, and browser tests
render.yaml   Render deployment Blueprint
```

### API

`GET /api/health` returns `{ "status": "ok", "configured": true }` when a key is present.

`POST /api/humanize` accepts:

```json
{ "text": "Your draft here.", "tone": "natural" }
```

It returns the rewritten `text`, selected `tone`, `sourceWords`, and `resultWords`. Errors return `{ "error": { "code": "...", "message": "..." } }` with an appropriate HTTP status. The production API rejects cross-site browser submissions.

## License

MIT. See [LICENSE](LICENSE).
