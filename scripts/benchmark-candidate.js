import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createApp } from '../server/index.js';
import { openChrome } from './chrome.js';
const app = createApp(); app.listen(0, '127.0.0.1'); await once(app, 'listening');
const browser = await openChrome();
try {
  await browser.call('Page.navigate', { url: `http://127.0.0.1:${app.address().port}` });
  await browser.waitFor('document.readyState === "complete"');
  await browser.evaluate('window.candidateWorker=new Worker("/js/modules/candidate-worker.js",{type:"module"}); candidateWorker.onmessage=e=>window.candidateResult=e.data; candidateWorker.postMessage({});');
  await browser.waitFor('!!window.candidateResult', 180000);
  const result = await browser.evaluate('window.candidateResult');
  await writeFile('artifacts/small-candidate-benchmark.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); await new Promise(resolve => app.close(resolve)); }
