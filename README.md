# HumanGPT

A clean writing humanizer with adaptive edit intensity and vocabulary controls. **Works locally without an API key. Works offline after a successful first visit.** Cloud AI rewriting is optional.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sebastianmiletic/humangpt)

## What’s included

- **Smartness:** Adaptive, Low, Medium, High. These control edit intensity, not model intelligence.
- **Vocabulary:** Simple, Balanced, Precise. Precise retains useful technical words instead of making the writing needlessly complicated.
- **Tone:** Natural, Casual, Professional.
- **Fine-tuning:** concision, contractions, sentence variety, and up to 20 protected words or phrases.
- **Local editor:** conservative English editing rules plus a bundled, trained candidate-ranking model. No provider, key, GPU, or runtime model download needed.
- **Optional cloud editor:** server-side OpenAI integration that honors the same settings.
- **Offline app:** versioned app-shell, styles, icons, and worker cache; installable on supported browsers.
- **Review:** local edit explanations, word counts, long-sentence counts, and estimated reading ease.
- Copy, `.txt` download, keyboard shortcut, example draft, cancellation, and mobile layout.
- No database, accounts, analytics, or saved drafts. Only non-sensitive style preferences are stored.
- Render Blueprint, reproducible model training, unit/API tests, browser/offline tests, and CI.

**No detector guarantees.** HumanGPT does not promise “0% AI,” generate detector scores, or guarantee passing a checker. Review every result for accuracy and follow applicable disclosure requirements.

## Local vs. cloud

| | Local, default | Cloud AI, optional |
| --- | --- | --- |
| API key | Not needed | Required |
| Internet | Not needed once cached | Required |
| Draft sent to a provider | No | Yes |
| Approach | Editing rules + small learned ranker | Generative language model |
| Language | English-focused | Depends on the model; original language is requested |
| Scope | Conservative phrasing, vocabulary, spacing, and suitable sentence splits | Deeper phrasing and structural rewrites |

Local mode is **not an offline ChatGPT equivalent**. It cannot deeply understand every claim, fix arbitrary grammar, or freely paraphrase every sentence. It may leave a clear, unfamiliar, heavily protected, or non-English draft unchanged, and tells you when that happens. It does not swap in random synonyms or invent filler to make a result look different.

The learned ranker is real, but deliberately small: pairwise logistic regression trained on 56 authored English editing-preference pairs, with 16 separate authored validation pairs. It ranks bounded rewrite candidates; it is not a generative language model. See [the model card](data/MODEL_CARD.md) for provenance, features, and limitations.

### Writing controls

- **Adaptive:** selects Low, Medium, or High from bulky phrases, sentence length, and approximate English readability. The selected level and reason appear in the local review.
- **Low:** light cleanup and a few direct phrase replacements.
- **Medium:** more phrasing and vocabulary edits while retaining structure.
- **High:** more thorough edits and safe splits of suitable long coordinated sentences when sentence variety is enabled.
- **Simple vocabulary:** prefers familiar English alternatives where a safe rule exists.
- **Balanced vocabulary:** simplifies needlessly formal words, but retains more specific language.
- **Precise vocabulary:** retains technical/formal vocabulary. Does not manufacture bigger words.
- **More concise:** shortens redundant signposts, not facts or qualifications. It does not promise a fixed word reduction.
- **Protected phrases:** comma-separated exact words or phrases; case is preserved locally. Cloud mode is instructed to preserve them, but still needs review.

## Offline use and installation

1. Open the deployed app while connected, over **HTTPS** (or localhost for local testing).
2. Wait until the footer says **Offline ready**. This means the app files and local worker have been cached successfully.
3. Disconnect and reopen/reload the same URL. Choose **Local · no API**, then edit normally.
4. If offered, select **Install app**. You can also use your browser’s install menu, or Safari’s **Add to Home Screen**.

You cannot open an app you have never loaded without first obtaining its files. Browser storage must be available; clearing site data removes the offline cache. Cloud mode never works without a connection. A new release offers a reload when ready; copy unsaved text before updating.

Offline caching is enabled in the **production build**, not the Vite development server. No drafts, rewrites, API requests, or provider responses enter the service-worker cache.

## Deploy on Render

**No AI API key is needed to deploy or use local mode.** You need only a Render account and this GitHub repository.

### Recommended: Blueprint

1. Click **Deploy to Render** above, or choose **New → Blueprint** in Render.
2. Connect `sebastianmiletic/humangpt` and select `main`.
3. Render reads `render.yaml` and creates one Node web service.
4. Deploy, open the `.onrender.com` URL, and try **Local · no API**.

The Blueprint intentionally does **not** require an API secret. To enable cloud mode later, add `OPENAI_API_KEY` in the service’s **Environment** settings and redeploy. Use an OpenAI key with API billing enabled; a ChatGPT subscription does not include API credits. Never put real keys in the repo or frontend environment variables.

### Alternative: Web Service

Choose **New → Web Service**, connect the repo, and configure:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Branch | `main` |
| Root directory | Repository root |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm start` |
| Health check | `/api/health` |
| `NODE_VERSION` | `22.22.0` |
| `NODE_ENV` | `production` |
| `OPENAI_API_KEY` | Optional, cloud mode only |
| `OPENAI_MODEL` | `gpt-4.1-mini` |

Render supplies `PORT`. Use a **Web Service** for both modes and the optional API, not a Static Site. No separate frontend deployment, database, or CORS setup is required.

The Blueprint selects the free plan. Free services may sleep; the first online load can take time to wake up. Once cached, the local editor can operate without the host. Cloud provider usage is billed separately from hosting.

### Troubleshooting

- **Cloud mode needs an API key:** use local mode, or add `OPENAI_API_KEY` on Render and redeploy.
- **Provider authentication/limit error:** check the key, model access, billing, and quota. Local mode is unaffected.
- **Offline cache unavailable:** load online over HTTPS, allow site storage, and wait for “Offline ready.”
- **No local changes:** the engine found no safe rule-based improvement. Use different settings or optional cloud rewriting for deeper edits.
- **Health returns `configured: false`:** local mode is available; only cloud mode lacks a key. `configured: true` means a key is present, not that billing or the provider has been verified.

## Run locally

Use Node 22.12+ (pinned to 22.22.0) and npm:

```bash
git clone https://github.com/sebastianmiletic/humangpt.git
cd humangpt
npm ci
npm run dev
```

Open **http://localhost:5173**. No key is required. Vite proxies optional cloud API requests to port 3001.

For cloud mode, copy `.env.example` to `.env` and add your key. Keep `.env` uncommitted.

To test the real offline app locally:

```bash
npm run build
NODE_ENV=production npm start
```

Open **http://localhost:3001**, wait for **Offline ready**, then disconnect and reload. Do not use a `file://` URL. Clear this origin’s site data or unregister its service worker when switching to unrelated apps on the same port.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Empty | Optional server-only secret for cloud mode. |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Cloud Chat Completions model. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Provider base URL, without `/chat/completions`. |
| `PORT` | `3001` | Supplied automatically by Render. |
| `NODE_ENV` | `development` | `production` serves the built frontend and offline app files. |
| `RATE_LIMIT_PER_HOUR` | `15` | Cloud requests per IP per hour. |
| `DAILY_REQUEST_LIMIT` | `200` | Cloud provider attempts per instance per UTC day. |

An alternative cloud provider must support OpenAI-compatible Chat Completions, `max_completion_tokens`, and `choices[].message.content`. HTTPS is required except for localhost. Some providers need request-format adjustments.

## Privacy, preservation, and costs

**Local:** the app processes the draft in a browser Web Worker and does not transmit it. Style preferences are saved to `localStorage`; drafts, rewrites, and user-entered protected phrases are not. Reloading clears the text. The local editor protects quotations, code, URLs, numbers, citations, likely names, acronyms, and custom phrases before applying edits, then checks that protected spans and original qualification markers survived. These checks reduce risk; they do not prove semantic equivalence for every possible text.

**Cloud:** submitted text is sent to the configured AI provider. The app does not save drafts or log provider payloads, but the host/provider may retain data according to their policies. Review those policies before submitting confidential material. Browser extensions and operating-system input services are outside the app’s control.

Both modes accept up to **1,500 whitespace-delimited words or 12,000 characters**. Cloud mode permits one active rewrite per IP, four total, and 200 provider attempts per UTC day by default. These are abuse-reduction measures, **not guaranteed spending controls**. Limits are in memory and reset on restart; multiple replicas do not share them. Failed attempts consume the daily allowance, and cancellation does not guarantee stopping provider processing or charges. Configure provider-side budgets and alerts, and add authentication/shared limits before scaling. Review proxy trust when hosting outside Render.

## Tests and model training

```bash
npm run check                 # Types, unit/API/editor tests, model reproducibility, production build
npx playwright install chromium
npm run test:e2e               # Desktop/mobile, real offline reload, privacy, and accessibility checks
npm audit
npm run train:local            # Rebuild the bundled candidate ranker, no network or API needed
npm run test:model             # Check committed weights match the dataset and training code
```

Tests never use or spend a real provider key. Cloud tests use fake responses. Offline browser tests actually disconnect the network and reload the production app, then run the real local worker. Tests also check that local mode makes no API/health request and that caches/storage contain no submitted text. Automated accessibility checks are not a full independent audit; live cloud-provider testing is still needed after configuration.

GitHub Actions runs these checks on pushes and pull requests. The authored dataset and training procedure are public and reproducible; the app never trains on user drafts.

## Structure

```text
src/             React editor, controls, offline registration, and local worker
shared/local/    Editing rules, protection, analysis, learned weights, and ranking
shared/          Types, text limits, and settings
server/          Optional cloud API and usage guards
build/pwa.ts     Versioned offline asset-list generation
scripts/         Dev runner, model training, and icon generation
data/            Authored preference examples and model card
tests/           Unit, API, editor, browser, privacy, and offline tests
render.yaml      Render Blueprint, no required AI secret
```

React + TypeScript + Vite and an Express backend. No new ML runtime dependencies or external model hosting are needed.

### Cloud API

`GET /api/health` returns `{ "status": "ok", "configured": false }` when the optional key is absent.

`POST /api/humanize` accepts:

```json
{
  "text": "Your draft here.",
  "tone": "natural",
  "smartness": "adaptive",
  "vocabulary": "balanced",
  "length": "preserve",
  "contractions": false,
  "sentenceVariety": true,
  "protectedTerms": ["Exact Product Name"]
}
```

All settings are optional and validated. The response includes `text`, `tone`, resolved `smartness`, `sourceWords`, and `resultWords`. Errors use `{ "error": { "code": "...", "message": "..." } }` with appropriate HTTP status. Cross-site browser submissions are rejected in production. The local editor does not call this API.

## License

MIT. See [LICENSE](LICENSE).
