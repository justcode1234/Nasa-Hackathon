# Archived model experiments

These rejected Hugging Face workers and their old benchmark harness are retained
only as experiment history. They are not referenced by the application, served
from `public/`, copied to the build, or permitted by the production CSP. The old
harness assumes an experimental worker URL and is not a current validation command.
Use the mini-LM benchmarks in `scripts/` for the accepted optional model.

`benchmark-candidate.js` does not load at all: measured 18 Nov with
`node --input-type=module -e "import('./notebooks/legacy-workers/benchmark-candidate.js')"` it fails
with `ERR_MODULE_NOT_FOUND` for `../server/index.js`, because the harness was written for a
different directory depth and never updated when it moved here. Do not "fix" the path to run
it — it targets workers the production CSP does not allow.
`tests/deployment.test.js` fails if either worker is restored into `public/js/modules` or
reaches `dist/client`.
