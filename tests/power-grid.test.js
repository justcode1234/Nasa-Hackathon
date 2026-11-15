import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeCell,cellGeometry,normalizeGrid,createPowerGridClient} from '../server/nasa/power-grid.js';
import {columnData} from '../public/js/lib/power-columns.js';

// TEST ONLY: tiny synthetic provider records exercise contracts, not observations.
const fixture=()=>({type:'FeatureCollection',header:{title:'TEST ONLY',sources:['MERRA2'],time_standard:'LST',fill_value:-999},parameters:{PRECTOTCORR:{units:'mm/day',longname:'TEST rain'}},features:[-32.5,-32,-31.5].flatMap(lat=>[116.25,116.875,117.5].map(lon=>({type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:{parameter:{PRECTOTCORR:{20250101:2,20250102:0,20250103:-999}}}})))});
test('MERRA output centre bounds wrap at the date line and clip at poles',()=>{
  const cell=nativeCell(-31.89,116.77);assert.equal(cell.latitude,-32);assert.equal(cell.longitude,116.875);
  assert.equal(cell.north-cell.south,.5);assert.equal(cell.east-cell.west,.625);
  assert.equal(nativeCell(90,180).longitude,-180);assert.equal(nativeCell(90,180).north,90);assert.equal(nativeCell(-90,-180).south,-90);
  const geometry=cellGeometry(nativeCell(0,180));assert.equal(geometry.type,'MultiPolygon');
  for(const polygon of geometry.coordinates){const ring=polygon[0];assert.deepEqual(ring[0],ring.at(-1));assert.ok(ring.every(([lon,lat])=>Math.abs(lon)<=180&&Math.abs(lat)<=90));assert.ok(Math.max(...ring.map(p=>p[0]))-Math.min(...ring.map(p=>p[0]))<1);}
  assert.throws(()=>nativeCell(NaN,0));assert.throws(()=>nativeCell(0,181));
});
test('regional rain keeps zero, missing days, partial sums and exact returned geometry',()=>{
  const result=normalizeGrid(fixture(),{latitude:-31.89,longitude:116.77,year:2025},'TEST URL','TEST date');
  assert.equal(result.cells.length,9);assert.equal(result.units,'mm');
  const selected=result.cells.find(c=>c.id===result.selectedCellId);assert.deepEqual(selected.values.slice(0,3),[2,0,null]);
  assert.equal(selected.monthly[0].sum,2);assert.equal(selected.monthly[0].validDays,2);assert.equal(selected.monthly[0].partial,true);
  assert.equal(selected.monthly[1].sum,null);assert.equal(selected.monthly[1].validDays,0);assert.equal(result.retrievedAt,'TEST date');
  const invalid=fixture();invalid.features[0].geometry.coordinates[0]+=.1;assert.throws(()=>normalizeGrid(invalid,{latitude:-31.89,longitude:116.77,year:2025},'', ''),/alignment changed/);
  const units=fixture();units.parameters.PRECTOTCORR.units='inches';assert.throws(()=>normalizeGrid(units,{latitude:-31.89,longitude:116.77,year:2025},'', ''),/units/);
  const missing=fixture();missing.features=[];assert.throws(()=>normalizeGrid(missing,{latitude:-31.89,longitude:116.77,year:2025},'', ''),/did not return/);
});
test('regional adapter validates inputs and uses one bounded fixed-host parameter request',async()=>{
  let seen,calls=0;
  const client=createPowerGridClient({fetchImpl:async url=>{seen=new URL(url);calls++;return{ok:true,json:async()=>fixture()};}});
  const input={latitude:-31.89,longitude:116.77,year:2025,url:'https://untrusted.invalid'};
  await client(input);await client(input);assert.equal(calls,1);assert.equal(seen.hostname,'power.larc.nasa.gov');
  assert.equal(seen.searchParams.get('parameters'),'PRECTOTCORR');assert.ok(Math.abs(Number(seen.searchParams.get('latitude-max'))-Number(seen.searchParams.get('latitude-min'))-2.02)<1e-9);
  await assert.rejects(client({...input,latitude:''}));await assert.rejects(client({...input,year:9999}));
});
test('column display preserves missing versus true zero and keeps a fixed annual scale',()=>{
  const data=normalizeGrid(fixture(),{latitude:-31.89,longitude:116.77,year:2025},'TEST','TEST');
  const first=columnData(data,1),second=columnData(data,2);
  assert.equal(first.metresPerMm,second.metresPerMm);assert.equal(first.features[0].properties.value,2);
  assert.equal(second.features[0].properties.value,null);assert.equal(second.features[0].properties.missing,true);assert.equal(second.features[0].properties.height,0);
  data.cells[0].monthly[0].sum=0;data.cells[0].monthly[0].partial=false;
  const zero=columnData(data,1).features[0].properties;assert.equal(zero.value,0);assert.equal(zero.missing,false);assert.equal(zero.height,0);
  assert.throws(()=>columnData(data,13));
});
test('date-line fallback requests one actual native centre and never copies neighbours',async()=>{
  let requested;
  const client=createPowerGridClient({fetchImpl:async url=>{requested=new URL(url);return{ok:true,json:async()=>({header:{title:'TEST ONLY point',sources:['MERRA2'],time_standard:'LST',fill_value:-999},parameters:{PRECTOTCORR:{units:'mm/day',longname:'TEST rain'}},properties:{parameter:{PRECTOTCORR:{20250101:4}}}})};}});
  const result=await client({latitude:0,longitude:179.99,year:2025});
  assert.equal(requested.pathname,'/api/temporal/daily/point');assert.equal(requested.searchParams.get('longitude'),'-180');
  assert.equal(result.cells.length,1);assert.equal(result.cells[0].geometry.type,'MultiPolygon');assert.equal(result.cells[0].monthly[0].sum,4);
  assert.ok(result.notices.some(notice=>notice.includes('Only the selected cell')));
});
