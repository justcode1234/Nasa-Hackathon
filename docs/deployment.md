# Vercel deployment

The user explicitly chose a **browser-only static app on Vercel**, superseding
the first Node-backend plan. No serverless functions, backend URLs, database,
secrets or API keys are required. NASA/OSM/Nominatim/GBIF/SoilGrids retrieval,
normalisation, caching, agronomy and model inference run in browser workers.

## Commands and settings

```sh
npm ci
npm run build
```

- Framework preset: **Other** (`framework: null` in vercel.json).
- Build command: **npm run build**.
- Output directory: **dist/client**.
- No environment variables required.
- Security/CSP headers and source allowlist: vercel.json.
- Local preview: **npm run start** builds, reuses this project's existing preview
  if present, selects another free port when needed, and opens the browser.

The build bundles the shared pure JavaScript application core into a local browser
worker, copies Leaflet assets, and writes static files. The retained Node HTTP/API
adapter is a test harness; Vercel does not execute it. The local preview is also
static-only; `/api/health` returns 404. The worker's `/api/...` strings are internal
message route names, not network endpoints.

## Publish

Import `https://github.com/justcode1234/Nasa-Hackathon` into the user's Vercel account
and deploy with the checked-in settings. Vercel can then deploy future Git commits.
If using an authenticated CLI, run `vercel --prod` from the repository. Do not add
tokens or credentials to this repository.

The Vercel plugin was found but was not connected at the latest confirmed check;
no existing CLI credentials were found. A live Vercel deployment cannot be claimed
until authenticated account access and a successful deployment result exist. No
production URL is invented. The build and browser tests are independently verifiable.

An earlier private Sites project was provisioned while exploring hosting. It was
never published; its hosting adapter was removed when the user chose Vercel.
It is not the submission/demo host.

## URLs after deployment

For the actual Vercel deployment origin:

- App: `/`
- Seven-slide deck: `/submission/index.html`
- Seven-page PDF: `/submission/fieldshift-deck.pdf`
- Submission text and sources: `/submission/submission-text.txt`
- Source package: `/submission/fieldshift-source.zip`

Set `DEMO_URL` to the verified public origin when preparing the final PDF with
`node scripts/prepare-submission.js`; without it the HTML uses relative local links
and does not claim to be publicly deployed. The GitHub-hosted PDF/source links can
also be public demonstration material once the release source is pushed.

## Runtime caveats

Third-party source availability, CORS, network connectivity and public API fair-use
limits still apply to a static site. Every adapter uses fixed hosts, bounded
queries, missing/error states and device-local caching. The browser sends its
normal origin/referrer; Node-only identifying User-Agent headers are not attempted
in browser requests. A production application with large traffic would need an
approved higher-capacity data service; this prototype does not silently add one.
