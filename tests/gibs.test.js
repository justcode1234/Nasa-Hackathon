import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGibsCapabilities,isAvailableDate,imageryUrl,createGibsClient,CAPABILITIES} from '../server/context/gibs.js';
// TEST ONLY metadata tests. These synthetic dates/tiles never enter browser tests.
const id='MODIS_Terra_NDVI_8Day';
const fixture=()=>`<Capabilities><Contents><Layer><ows:Title>TEST ONLY NDVI</ows:Title><ows:Identifier>${id}</ows:Identifier><Style isDefault="true"><ows:Identifier>default</ows:Identifier><LegendURL xlink:href="https://gibs.earthdata.nasa.gov/legends/TEST.svg" xlink:role="test/horizontal"/></Style><Dimension><ows:Identifier>Time</ows:Identifier><Default>2025-01-12</Default><Value>2025-01-01/2025-01-03/P1D</Value><Value>2025-01-10/2025-01-12/P1D</Value></Dimension><TileMatrixSetLink><TileMatrixSet>GoogleMapsCompatible_Level9</TileMatrixSet></TileMatrixSetLink><ResourceURL resourceType="tile" template="https://gibs.earthdata.nasa.gov/wmts/${id}/default/{Time}/GoogleMapsCompatible_Level9/{TileMatrix}/{TileRow}/{TileCol}.png"/></Layer></Contents></Capabilities>`;
test('GIBS retains exact date gaps, native resolution, source and palette units',()=>{
  const result=parseGibsCapabilities(fixture(),'TEST retrieval'),layer=result.layers[0];
  assert.equal(layer.kind,'imagery');assert.equal(layer.units,'unitless NDVI');assert.equal(layer.spatialResolution,'250 m sensor and imagery resolution');assert.equal(layer.maxZoom,9);assert.equal(layer.retrievedAt,'TEST retrieval');
  assert.equal(isAvailableDate(layer,'2025-01-03'),true);assert.equal(isAvailableDate(layer,'2025-01-05'),false);assert.equal(isAvailableDate(layer,'2025-02-30'),false);assert.equal(isAvailableDate(layer,'2025-01-13'),false);
  assert.equal(result.unavailable.length,3);assert.match(layer.missingness,/values are not extracted/);
  assert.match(imageryUrl(layer,'2025-01-12'),/2025-01-12\/GoogleMapsCompatible_Level9\/\{z\}\/\{y\}\/\{x\}\.png/);
  assert.throws(()=>imageryUrl(layer,'2025-01-05'),/advertised/);
});
test('GIBS rejects external resource URLs, entities and unsupported intervals',()=>{
  assert.throws(()=>parseGibsCapabilities('<!DOCTYPE test>'+fixture(),'TEST'),/changed or is unavailable/);
  assert.throws(()=>parseGibsCapabilities(fixture().replaceAll('https://gibs.earthdata.nasa.gov/','https://untrusted.invalid/'),'TEST'),/did not advertise/);
  assert.throws(()=>parseGibsCapabilities(fixture().replaceAll('P1D','P1M'),'TEST'),/did not advertise/);
  assert.throws(()=>parseGibsCapabilities('<html>unavailable</html>','TEST'),/changed or is unavailable/);
  const layer=parseGibsCapabilities(fixture(),'TEST').layers[0];layer.intervals=[{start:'2025-01-01',end:'2025-01-17',stepDays:8}];
  assert.equal(isAvailableDate(layer,'2025-01-09'),true);assert.equal(isAvailableDate(layer,'2025-01-10'),false);
});
test('GIBS client deduplicates real-host metadata requests and preserves retrieval dates',async()=>{
  let calls=0;
  const client=createGibsClient({fetchImpl:async url=>{calls++;assert.equal(url,CAPABILITIES);return{ok:true,text:async()=>fixture()};},now:()=>new Date('2026-11-15T00:00:00Z')});
  const [first,second]=await Promise.all([client(),client()]);assert.equal(calls,1);assert.equal(first.retrievedAt,second.retrievedAt);await client();assert.equal(calls,1);
  let attempts=0;
  const retry=createGibsClient({fetchImpl:async()=>{if(++attempts===1)throw Error('TEST failure');return{ok:true,text:async()=>fixture()};}});
  await assert.rejects(retry(),/no dates were guessed/);assert.equal((await retry()).layers.length,1);assert.equal(attempts,2);
});
