# Vercel deployment

The user chose **both a Node.js testing mode and a browser-only static Vercel
showcase**. Vercel needs no serverless functions, backend URLs, database, secrets
or API keys. In the showcase, NASA/OSM/Nominatim/GBIF/SoilGrids retrieval,
normalisation, caching and agronomy run in the browser worker. Local Node testing
uses the same modules through real HTTP APIs. Optional model inference stays in
the browser in both modes.

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
worker, copies Leaflet assets, and writes static files. Vercel does not execute
the Node server. `npm run start:showcase` and `npm start` serve static-only files;
`/api/health` returns 404. The showcase worker's `/api/...` strings are internal
message route names. `npm run start:node` serves the Node frontend and real APIs
on preferred port 3001; its `/api/health` returns 200. Both can run together.

## Public host and release

The existing public origin was discovered in the user's browser and checked with
an unauthenticated HTTP request on 2026-11-14:
https://nasa-hackathon-three.vercel.app/ . It returned HTTP 200, but initially served
the older source revision without the new country/region/town picker. The browser
also showed Vercel's completed setup page for the same GitHub repository and main
branch. The latest local crop-country conversation and guided step-4 workflow have
passed local checks. Publication is pending; public file hashes and the deployed
workflow must pass before these changes are declared live.

## Publish

Import `https://github.com/justcode1234/Nasa-Hackathon` into the user's Vercel account
and deploy with the checked-in settings. Vercel can then deploy future Git commits.
If using an authenticated CLI, run `vercel --prod` from the repository. Do not add
tokens or credentials to this repository.

The requested https://vercel.com/get-started.md setup was followed. Vercel CLI
65.16.0 is installed. The user completed login and `vercel whoami` verified
**justcode1234**; the separate **4chatgptsim** account is retained. This checkout
is linked to **justcode1234s-projects/nasa-hackathon**, existing project ID
`prj_YGWfxpDRdDQOx9LKEQkrMduC9Rhp`. Read-only CLI team/project checks passed.
The user-scoped Codex Vercel plugin 0.54.1 is enabled. The global shared MCP server
is https://mcp.vercel.com with successful OAuth authorization. Active-session tools
still do not expose Vercel MCP methods; refresh Codex before checking MCP
`search_vercel_documentation` and `list_teams`. Those two MCP checks are not claimed
as executed. CLI publishing can proceed independently.

CLI-created .env.local and .vercel files are ignored and must never be committed
or uploaded. A dry run caught hundreds of MB of local browser profiles before any
upload; .vercelignore now excludes them, credentials, dependencies and build output.
Required source/build inputs and the public submission package remain included.
Recheck identity/project and inspect `vercel deploy --dry --json` before upload.

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
