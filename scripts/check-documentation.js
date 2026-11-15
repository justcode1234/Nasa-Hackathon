// Read-only link validation for the visitor documentation and this review.
// --external makes ordinary public GETs; it never logs in or changes a service.
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const files = ['README.md', 'docs/README.md', 'docs/development.md',
  'docs/references.md', 'docs/submission-accuracy-review.md',
  'docs/submission-review-proposed.md', 'docs/submission.md',
  'docs/merged-release-review.md', 'docs/plans/2026-11-15-merged-release.md'];
const local = [], external = new Set();
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]\n]*\]\(([^\s]+)\)/g)) {
    const target = match[1];
    if (/^https?:\/\//.test(target)) { external.add(target); continue; }
    const [relative, fragment] = target.split('#');
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(relative || path.basename(file)));
    try {
      const info = await stat(resolved);
      if (fragment && info.isFile() && resolved.endsWith('.md')) {
        const content = await readFile(resolved, 'utf8');
        const headings = [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => m[1]
          .toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-'));
        if (!headings.includes(fragment)) throw new Error(`Heading #${fragment} not found`);
      }
      local.push({ file, target, status: 'ok' });
    } catch (error) { local.push({ file, target, status: 'broken', error: error.message }); }
  }
}

const remote = [];
if (process.argv.includes('--external')) {
  const urls = [...external];
  for (let i = 0; i < urls.length; i += 4) {
    await Promise.all(urls.slice(i, i + 4).map(async requested => {
      const checkedAt = new Date().toISOString();
      try {
        const response = await fetch(requested, { signal: AbortSignal.timeout(30_000) });
        // Consume small documentation responses so connections can be reused.
        await response.arrayBuffer();
        const status = response.ok ? 'reachable' : [401, 403, 429].includes(response.status)
          ? 'access-restricted' : [404, 410].includes(response.status) ? 'broken' : 'service-failure';
        remote.push({ requested, checkedAt, url: response.url, http: response.status, status });
      } catch (error) { remote.push({ requested, checkedAt, status: 'unverified', error: error.message }); }
    }));
  }
}
const failures = [...local, ...remote].filter(r => !['ok', 'reachable'].includes(r.status));
const result = { checkedAt: new Date().toISOString(), files, local, external: remote,
  externalRequested: process.argv.includes('--external'),
  summary: { localLinks: local.length, localBroken: local.filter(r => r.status === 'broken').length,
    externalLinks: remote.length, externalFlagged: remote.filter(r => r.status !== 'reachable').length },
  limitations: 'Markdown inline links only; HTTP status is not a guarantee of correct content or API availability. Access restrictions and timeouts remain unverified, not passed.' };
await mkdir('artifacts/repository-review', { recursive: true });
await writeFile('artifacts/repository-review/documentation-links.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result.summary, failures }, null, 2));
if (failures.length) process.exitCode = 1;
