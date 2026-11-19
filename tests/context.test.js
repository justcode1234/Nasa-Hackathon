import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarmClient, createPlaceClient, normalizeFarms } from '../server/context/farms.js';
import { createPestClient, PESTS } from '../server/context/pests.js';
import { createCachedJson } from '../server/context/client.js';
import { answerCatalogQuestion } from '../server/agronomy/answers.js';
import { normalizeSoil, createSoilClient } from '../server/context/soil.js';
import { AppError } from '../server/errors.js';
import { getWaterContext } from '../server/context/water.js';
import { syntheticSoil } from './fixtures.js';

// DEMO / synthetic OSM/GBIF responses for offline contract checks only.
const osm = () => ({ elements: [
  { type: 'node', id: 1, lat: 52.19, lon: .09 }, { type: 'node', id: 2, lat: 52.191, lon: .09 }, { type: 'node', id: 3, lat: 52.19, lon: .091 },
  { type: 'way', id: 4, nodes: [1, 2, 3, 1], tags: { landuse: 'farmland', crop: 'wheat;barley' }, timestamp: '2022-01-01T00:00:00Z', version: 1 },
  { type: 'way', id: 5, nodes: [1, 2, 99, 1], tags: { landuse: 'farmland' } },
  { type: 'way', id: 6, nodes: [1, 2, 3], tags: { landuse: 'farmland' } },
  { type: 'way', id: 7, nodes: [1, 2, 3, 1], tags: { landuse: 'orchard' } }
] });
test('OSM normalization draws only complete rings, preserves crop tags and edit dates, and leaves absent crops unknown', () => {
  const result = normalizeFarms(osm(), { latitude: 52.19, longitude: .09 }, 'TEST');
  assert.equal(result.farms.length, 2);
  assert.deepEqual(result.farms[0].crops, ['wheat', 'barley']);
  assert.equal(result.farms[0].updatedAt, '2022-01-01T00:00:00Z');
  assert.deepEqual(result.farms[1].crops, []);
  assert.match(result.notices.join(' '), /not verified ownership/);
});
test('bounded farm requests validate coordinates, use a fixed host, and cache original retrieval times', async () => {
  let calls = 0, requested;
  const client = createFarmClient({ fetchImpl: async url => { calls++; requested = String(url); return { ok: true, json: async () => osm() }; } });
  const input = { latitude: 52.19, longitude: .09 };
  const first = await client(input), second = await client(input);
  assert.equal(calls, 1); assert.equal(first.retrievedAt, second.retrievedAt);
  const url = new URL(requested);
  assert.equal(url.hostname,'overpass-api.de');
  assert.match(url.searchParams.get('data'), /\[timeout:25\].*\(52\.1700,0\.0700,52\.2100,0\.1100\);out meta geom;/);
  assert.deepEqual(first.bounds,{south:52.19-.02,west:.09-.02,north:52.19+.02,east:.09+.02});
  await assert.rejects(client({ latitude: 90, longitude: 0 }));
  await assert.rejects(client({ latitude: '', longitude: 0 }));
});
test('field lookup falls back once and rejects partial Overpass responses',async()=>{
  const calls=[];
  const client=createFarmClient({fetchImpl:async(url,options)=>{
    calls.push(new URL(url).hostname);assert.ok(options.signal);
    return{ok:true,json:async()=>calls.length===1?{elements:[],remark:'runtime error: timeout'}:osm()};
  }});
  const result=await client({latitude:42,longitude:-93.69});
  assert.deepEqual(calls,['overpass-api.de','overpass.private.coffee']);assert.equal(result.farms.length,2);
  assert.equal(new URL(result.sourceUrl).hostname,'overpass.private.coffee');
  let failures=0;const hostsAsked=[];
  const unavailableStarted=Date.now();
  const unavailable=createFarmClient({deadlineMs:1500,staggerMs:50,backoffMs:100,fetchImpl:async url=>{failures++;hostsAsked.push(new URL(url).hostname);throw Error('TEST transport failure');}});
  await assert.rejects(unavailable({latitude:1,longitude:2}),/field lookup services are busy or unavailable.*No fields were invented/);
  const unreachableMs=Date.now()-unavailableStarted;
  // Every service is tried, and the reported attempt count names them: a town tap in an offline or
  // blocked network must say so at once instead of after a retry ladder. Measured 18 Nov, the browser
  // stalled 9.05 s on “finding community-mapped fields” for three services that had all failed in 60 ms.
  assert.equal(failures,3,'each service is attempted once when none of them can be reached');
  assert.deepEqual(new Set(hostsAsked),new Set(['overpass-api.de','overpass.private.coffee','maps.mail.ru']),'every service is given a chance');
  assert.ok(unreachableMs<100,`an unreachable field service is reported without a backoff wait (${unreachableMs} ms)`);
  // A service that answers but is busy still gets its retries: that is the outage backoff was designed for,
  // and one unreachable host must not switch the ladder off for the others.
  let busy=0,unreachableTried=0;
  const mixed=createFarmClient({staggerMs:20,backoffMs:20,hosts:['overpass-api.de','overpass.private.coffee'],
    fetchImpl:async url=>{const host=new URL(url).hostname;
      if(host==='overpass.private.coffee'){unreachableTried++;throw Error('TEST transport failure');}
      busy++;return busy<3?{ok:false,status:502}:{ok:true,json:async()=>osm()};}});
  assert.equal(new URL((await mixed({latitude:7,longitude:8})).sourceUrl).hostname,'overpass-api.de');
  assert.equal(busy,3,'a busy service that answers is retried with backoff');
  assert.equal(unreachableTried,1,'the unreachable service is not retried inside the same lookup');
  // A slow preferred service must not block a later service that answers first.
  const order=[];
  const hedged=createFarmClient({staggerMs:30,fetchImpl:async url=>{const host=new URL(url).hostname;order.push(host);
    if(host==='overpass-api.de')await new Promise(resolve=>setTimeout(resolve,400));return{ok:true,json:async()=>osm()};}});
  const fast=await hedged({latitude:3,longitude:4});
  assert.equal(new URL(fast.sourceUrl).hostname,'overpass.private.coffee');assert.deepEqual(order,['overpass-api.de','overpass.private.coffee']);
  // A busy service that recovers on retry is used; no second service is needed.
  let busyOnly=0;
  const recovered=createFarmClient({staggerMs:5000,backoffMs:20,hosts:['overpass-api.de'],fetchImpl:async()=>{busyOnly++;return busyOnly<3?{ok:false,status:502}:{ok:true,json:async()=>osm()};}});
  assert.equal((await recovered({latitude:5,longitude:6})).farms.length,2);assert.equal(busyOnly,3);
  assert.throws(()=>normalizeFarms({elements:[],remark:'partial data'}, {}, 'TEST'),/incomplete query/);
});
test('context errors do not become empty success records', async () => {
  const request = createCachedJson({ fetchImpl: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(request('https://example.invalid'), /No records were invented/);
});
test('place searches are validated and contain the country returned by Nominatim', async () => {
  const getPlaces = createPlaceClient({ fetchImpl: async () => ({ ok: true, json: async () => [{ display_name: 'TEST place', lat: '1', lon: '2', address: { country_code: 'ke', country: 'Kenya' } }] }) });
  const result = await getPlaces({ q: 'TEST' });
  assert.equal(result.places[0].countryCode, 'KE');
  assert.equal(result.places[0].latitude, 1);
  await assert.rejects(getPlaces({ q: '*' }));
});
test('point verification requests regional detail from the fixed place service and retains its region',async()=>{
  let observed;
  const getPlaces=createPlaceClient({fetchImpl:async url=>{observed=new URL(url);return {ok:true,json:async()=>({display_name:'TEST reverse point',lat:'18.52',lon:'73.85',address:{country_code:'in',state:'Maharashtra'}})}}});
  const result=await getPlaces({latitude:18.52,longitude:73.85,detail:'region',url:'https://untrusted.invalid'});
  assert.equal(observed.hostname,'nominatim.openstreetmap.org');assert.equal(observed.pathname,'/reverse');
  assert.equal(observed.searchParams.get('zoom'),'10');assert.equal(observed.searchParams.get('accept-language'),'en');
  assert.equal(result.places[0].region,'Maharashtra');assert.equal(result.places[0].countryCode,'IN');
  await assert.rejects(getPlaces({latitude:18.52,longitude:73.85,detail:'arbitrary'}),/supported region detail/);
});
test('pest occurrence counts are country records, zero means no records, and query failures stay unknown', async () => {
  let calls = 0;
  const getPests = createPestClient({ fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ count: 0, results: [] }) }; } });
  const result = await getPests({ country: 'AU' });
  assert.equal(calls, PESTS.length);
  assert.ok(result.records.every(r => r.occurrenceCount === 0 && r.status.includes('No matching')));
  assert.match(result.notices.join(' '), /zero records do not establish absence/);
  await assert.rejects(getPests({ country: 'Australia' }));
  const unavailable = await createPestClient({ fetchImpl: async () => { throw new Error('offline'); } })({ country: 'KE' });
  assert.ok(unavailable.records.every(r => r.occurrenceCount === null && r.status === 'Unavailable'));
});
test('general crop questions return sourced facts without needing a field or synthetic NASA evidence', () => {
  const answer = answerCatalogQuestion('What do peas need?');
  assert.ok(answer.blocks.some(b => b.text.includes('Fabaceae')));
  assert.ok(answer.sources.some(s => s.id === 'umn-peas'));
  assert.ok(answer.blocks.some(b => b.text.includes('No location-specific comparison')));
});

test('catalog answers match explicit multiword sweet-corn names and explain unsupported generic corn', () => {
  for (const name of ['sweet corn', 'sweet-corn', 'sweetcorn']) {
    assert.ok(answerCatalogQuestion(`Tell me about ${name}`).blocks.some(block => block.kind === 'sourced crop facts' && block.sourceIds.includes('umn-corn')));
  }
  for (const name of ['maize', 'corn', 'grain maize', 'field corn']) {
    const answer = answerCatalogQuestion(`How long does ${name} take?`);
    assert.ok(answer.blocks.every(block => block.kind !== 'sourced crop facts'));
    assert.ok(answer.blocks.some(block => block.text.includes('remain unassessed')));
  }
});
test('soil model values use source unit factors, retain intervals and never become farm measurements', () => {
  const raw = { properties: { layers: [{ name: 'phh2o', unit_measure: { d_factor: 10 }, depths: [{ range: { top_depth: 0, bottom_depth: 5 }, values: { mean: 72, 'Q0.05': 56, 'Q0.95': 88 } }] }] } };
  const result = normalizeSoil(raw, { latitude: -31.89, longitude: 116.77 }, 'TEST', 'TEST');
  assert.equal(result.properties[0].mean, 7.2);
  assert.equal(result.properties[0].lower, 5.6);
  assert.equal(result.properties[1].mean, null);
  assert.equal(result.observationDate, null);
  assert.match(result.notices.join(' '), /advises against/);
  raw.properties.layers[0].unit_measure.d_factor = 1;
  assert.throws(() => normalizeSoil(raw, {}, '', ''), /unit conversion/);
});
test('the soil fair-use pause refuses as this app holding back, and quotes the wait actually left', async () => {
  // Measured 19 Nov in artifacts/iter53-soil-throttle-probe.mjs (archived as docs/evidence/iter53-soil-throttle-2026-11-19.log.gz):
  // a lookup refused inside the fair-use window made 0 upstream requests, yet the page read "The external context
  // service could not respond…", and the reason quoted "retry after 13 seconds" 6.2 s into a 12.1 s window. The clock
  // is injected so the window is walked, not slept through; no timeout or retry budget is involved.
  let clock = 1_000, calls = 0;
  const client = createSoilClient({ now: () => new Date(clock), fetchImpl: async () => {
    calls++; return { ok: true, status: 200, json: async () => syntheticSoil() };
  } });
  // Different coordinates each time: the same point would be answered from the client cache and never reach the limit.
  const allowed = await client({ latitude: 9.1, longitude: 7.5 }).then(() => 'answered', reason => reason);
  assert.equal(allowed, 'answered');
  assert.equal(calls, 1, 'a lookup inside the fair-use budget must reach SoilGrids exactly once');

  clock += 6_200;
  const refused = await client({ latitude: 9.2, longitude: 7.5 }).then(() => 'answered', reason => reason);
  assert.notEqual(refused, 'answered');
  assert.equal(calls, 1, 'a refused lookup contacted the very service it blamed');
  assert.equal(refused.status, 429, 'a local pause is not an upstream failure');
  assert.equal(refused.code, 'SOIL_FAIR_USE');
  assert.match(refused.message, /five regional soil lookups a minute/, 'the sentence must name the limit it is holding to');
  assert.match(refused.message, /nothing was sent/, 'the sentence must say the request never left this app');
  assert.match(refused.message, /again in 6 seconds\./, 'the wait quoted must be the wait left, not a constant');
  assert.ok(!/external context service|could not respond/i.test(refused.message), `a local limit read as an upstream failure: ${refused.message}`);

  clock += 12_099 - 6_200;
  const late = await client({ latitude: 9.3, longitude: 7.5 }).then(() => null, reason => reason);
  assert.ok(late instanceof Error, 'a lookup one millisecond before the window closes cannot be allowed');
  assert.match(late.message, /again in 1 second\./, 'one millisecond before the window closes it must still say 1 second');

  clock += 1;
  const recovered = await client({ latitude: 9.4, longitude: 7.5 }).then(() => 'answered', reason => reason);
  assert.equal(recovered, 'answered', 'the limit is a delay, not a permanent refusal');
  assert.equal(calls, 2);
});
test('a refusal this app authored is never relabelled as a service that failed to answer', async () => {
  // The same catch that reports a dead service also swallowed the soil limit before 20 Nov, because it wrapped every
  // throw. A sentence this app wrote already names its cause and carries a status server/index.js:71 forwards, so the
  // wrapper must not overwrite it — while a real transport failure keeps the one sentence and the flags farms.js:78 reads.
  const authored = new AppError('TEST limit: nothing was sent. Try again in 4 seconds.', 429, 'TEST_LOCAL_LIMIT');
  const kept = await createCachedJson({ fetchImpl: async () => { throw authored; }, ttlMs: 1 })('https://example.invalid').then(() => null, reason => reason);
  assert.equal(kept, authored, 'the authored refusal must reach the caller as itself');
  assert.equal(kept.status, 429);
  assert.match(kept.message, /nothing was sent/);
  const upstream = await createCachedJson({ fetchImpl: async () => { throw new TypeError('fetch failed'); }, ttlMs: 1 })('https://example.invalid').then(() => null, reason => reason);
  assert.equal(upstream.code, 'CONTEXT_UNAVAILABLE', 'a service that never answered is still reported as one');
  assert.equal(upstream.answered, false, 'the farm hedge keeps the flag it reads');
});
test('Australian irrigation benchmark is a reproducible annual aggregate, never applied to other countries', () => {
  const au = getWaterContext({ country: 'AU' });
  assert.equal(au.rows[0].appliedMlPerIrrigatedHa, 382626 / 98785);
  assert.equal(au.period, 'Australian financial year 2020–21');
  assert.equal(getWaterContext({ country: 'KE' }).available, false);
  assert.deepEqual(getWaterContext({ country: 'KE' }).rows, []);
  assert.match(au.notices.join(' '), /not a recommended dose/);
});

test('one upstream failure condition keeps one farmer-facing sentence', async () => {
  // server/index.js:71 forwards this message to the page for a 502, and the reason createCachedJson used to put in
  // parentheses is whatever a runtime calls its own transport failure: one unreachable service read "(fetch failed)"
  // in Node, "(signal timed out)" in a Chromium worker and "(Failed to fetch)" on 18 Nov. The reason now stays on
  // the error as `cause`, where server/index.js:70 logs it, and the sentence is pinned here.
  const shapes = {
    'host unreachable': async () => { throw new TypeError('fetch failed'); },
    'deadline missed': (url, { signal }) => new Promise((resolve, reject) => { const keep = setTimeout(() => reject(new Error('the fake transport never settles')), 30_000); signal.addEventListener('abort', () => { clearTimeout(keep); reject(signal.reason); }, { once: true }); }),
    'service answered 503': async () => ({ ok: false, status: 503 }),
    'service answered HTML': async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); } }),
  };
  const sentences = new Set();
  for (const [label, fetchImpl] of Object.entries(shapes)) {
    const error = await createCachedJson({ fetchImpl, ttlMs: 1 })('https://example.invalid', { timeoutMs: 250 }).then(() => null, reason => reason);
    assert.equal(error.message, 'The external context service could not respond. No records were invented. Try again later.', label);
    assert.ok(!/[()]|fetch failed|timed out|HTTP |Unexpected token/.test(error.message), `${label} leaked a transport detail into farmer-facing text`);
    assert.ok(error.cause instanceof Error, `${label} lost the reason the server log needs`);
    sentences.add(error.message);
  }
  assert.equal(sentences.size, 1, 'four failure shapes became four different sentences');
  const timeout = await createCachedJson({ fetchImpl: shapes['deadline missed'], ttlMs: 1 })('https://example.invalid', { timeoutMs: 250 }).then(() => null, reason => reason);
  const busy = await createCachedJson({ fetchImpl: shapes['service answered 503'], ttlMs: 1 })('https://example.invalid').then(() => null, reason => reason);
  assert.equal(timeout.slow, true, 'a missed deadline stays classifiable without naming itself in the text');
  assert.equal(timeout.answered, false, 'a service that never answered is not reported as having answered');
  assert.equal(busy.answered, true, 'a service that answered 503 stays classifiable as having answered');
});

// Iteration 54, P2. Measured 19 Nov in docs/evidence/iter54-failure-taxonomy-2026-11-19.log.gz against the shipped
// client: an unreadable body and an unreachable host arrived at server/context/farms.js as one verdict
// (answered=false, slow=false) although only the second ever sent nothing, and the hedge dropped the retry that
// follows for it in 0 ms while reporting "1 attempts across 1 services". No shape carried a status either, so a
// service that read the request and declined it read exactly like one that said it was busy: 3 requests and 9.0 s
// each (docs/evidence/iter54-refusal-cost-2026-11-19.log.gz) for a request already refused. And both flags came
// from vocabulary rather than observation - server/context/client.js:43 matched /abort|timed?\s?out/i over
// error.name plus error.message, so the words a runtime happens to use decided whether to ask again.
test('the retry facts a hedge reads come from what this client observed, not from the words around them', async () => {
  const ask = (fetchImpl, timeoutMs, path) => createCachedJson({ fetchImpl, ttlMs: 1 })(`https://iter54-${path}.invalid`, { timeoutMs });
  const failure = async (label, fetchImpl, timeoutMs) => ask(fetchImpl, timeoutMs, label).then(() => { throw new Error(`${label} unexpectedly succeeded`); }, reason => reason);

  // A body that arrived is a service that answered, whatever it did with the request afterwards.
  const unreadable = await failure('body', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); } }));
  assert.equal(unreadable.answered, true, 'bytes that arrived are an answer, and the hedge must keep its retries for them');
  assert.equal(unreadable.slow, false, 'an unreadable body is not a missed deadline');
  assert.ok(unreadable.cause instanceof SyntaxError, 'the parse failure stays on the error for the server log');

  // A deadline this client set is a fact it owns: AbortSignal.timeout aborts its own signal, and nothing else can.
  // The fake keeps a ref'd timer of its own because AbortSignal.timeout's timer does not hold the event loop open.
  const expired = await failure('deadline', (url, { signal }) => new Promise((resolve, reject) => {
    const keep = setTimeout(() => reject(new Error('the fake transport never settles')), 30_000);
    signal.addEventListener('abort', () => { clearTimeout(keep); reject(signal.reason); }, { once: true });
  }), 40);
  assert.equal(expired.slow, true, 'the request this client gave up on is still classifiable as slow');
  assert.equal(expired.answered, false, 'a request that ran out of time received no response');

  // The lookalike: prose that says timeout while this client's own signal never fired. Classifying on that text is
  // what made a runtime's vocabulary a product fact, so the structured signal wins and this is not called slow.
  const lookalike = await failure('prose', async () => {
    const error = new TypeError('signal timed out');
    error.name = 'TimeoutError';
    throw error;
  }, 30_000);
  assert.equal(lookalike.slow, false, 'the wording a failure arrives in is not evidence that this deadline expired');
  assert.equal(lookalike.answered, false, 'nothing arrived, so nothing answered');

  // A status line is the one part of a refusal the application can actually see, and the retry decision needs it.
  for (const status of [400, 408, 429, 503]) {
    const answered = await failure(`http${status}`, async () => ({ ok: false, status }), 30_000);
    assert.equal(answered.answered, true, `HTTP ${status} is an answer`);
    assert.equal(answered.responseStatus, status, `HTTP ${status} reaches the retry decision as a number`);
    assert.equal(answered.slow, false, `HTTP ${status} is not a missed deadline`);
  }

  // An unreachable host produces no response and no status; it must not inherit either fact.
  const unreachable = await failure('unreachable', async () => { throw new TypeError('fetch failed'); });
  assert.equal(unreachable.answered, false, 'a host that never received the request did not answer');
  assert.equal(unreachable.responseStatus, undefined, 'no status was observed, so none is claimed');
});

test('a request the service declined is not sent three times and is not called busy', async () => {
  const ladder = async status => {
    let calls = 0;
    const startedAt = Date.now();
    const client = createFarmClient({
      hosts: ['overpass-api.de'], staggerMs: 1, backoffMs: 100, maxAttempts: 3, deadlineMs: 5_000,
      fetchImpl: async () => { calls++; return { ok: false, status }; },
    });
    const error = await client({ latitude: 1, longitude: 2 }).then(() => { throw new Error('a refused lookup unexpectedly succeeded'); }, reason => reason);
    return { calls, elapsedMs: Date.now() - startedAt, error };
  };
  const refused = await ladder(400);
  assert.equal(refused.calls, 1, 'a request the service understood and declined is not retried behind a backoff ladder');
  assert.match(refused.error.message, /refused this request \(HTTP 400, 1 attempts across 1 services\)/, 'the farmer is told the service declined, not that it is busy');
  assert.match(refused.error.message, /No fields were invented/);
  assert.ok(refused.elapsedMs < 500, `the refusal is reported without a backoff wait (${refused.elapsedMs} ms)`);
  const busy = await ladder(503);
  assert.equal(busy.calls, 3, 'a service that says it is busy keeps the retries backoff was designed for');
  assert.match(busy.error.message, /busy or unavailable \(3 attempts across 1 services\)/, 'one service busy is still reported as busy');
  const limited = await ladder(429);
  assert.equal(limited.calls, 3, 'a rate limit asks for a retry, so it is not a permanent refusal');
  const gateway = await ladder(408);
  assert.equal(gateway.calls, 3, 'a timeout the service reported is retryable, not a refusal');
  // One service declining and another never receiving the request is still reported as unavailable rather than
  // refused: only one of them answered, and the farmer cannot be told the whole lookup was declined.
  let mixedCalls = 0;
  const mixed = createFarmClient({
    hosts: ['overpass-api.de', 'overpass.private.coffee'], staggerMs: 1, backoffMs: 40, maxAttempts: 3, deadlineMs: 5_000,
    fetchImpl: async url => {
      mixedCalls++;
      if (new URL(url).hostname === 'overpass-api.de') return { ok: false, status: 400 };
      throw new TypeError('fetch failed');
    },
  });
  const both = await mixed({ latitude: 3, longitude: 4 }).then(() => { throw new Error('a refused and unreachable lookup unexpectedly succeeded'); }, reason => reason);
  assert.equal(mixedCalls, 2, 'each service is asked once: one declined, the other was never reached');
  assert.match(both.message, /busy or unavailable \(2 attempts across 2 services\)/, 'a partial refusal is not called a refusal');
});
