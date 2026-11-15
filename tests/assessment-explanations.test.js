import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRotations,validateInputs} from '../server/agronomy/rotation.js';
import {comparisonRows} from '../public/js/modules/strategy.js';
import {temperatureValue} from '../public/js/lib/temperature.js';
import {syntheticObservations} from './fixtures.js';

const inputs=()=>validateInputs({latitude:-31.89,longitude:116.77,referenceYear:2025,planningYear:2027,startMonth:1,country:'AU',baseline:['bush-bean','unassessed:fao-526','unassessed:fao-515'],allowedCrops:['bush-bean','pea'],previousCrop:'',irrigation:'unknown',soil:'unknown',priority:'family'});
test('mixed orchard baseline explains its calendar gap without inventing rules or adding unapproved corn',()=>{
  const result=compareRotations(inputs(),syntheticObservations()),baseline=result.scenarios[0];
  assert.equal(baseline.assessment.cropRules,1);assert.equal(baseline.assessment.ph,0);
  assert.ok(baseline.timeline.slice(1).every(slot=>slot.perennial&&slot.referenceFamily==='Rosaceae'&&slot.indicators===null&&slot.maturityDays===null));
  assert.ok(baseline.timeline.slice(1).every(slot=>slot.notes.join(' ').includes('orchard')&&slot.recordedContext.year));
  assert.ok(!baseline.reasons.some(reason=>/No known family repeats/.test(reason)));
  assert.ok(result.scenarios.slice(1).flatMap(s=>s.timeline).every(slot=>inputs().allowedCrops.includes(slot.cropId)));
  assert.ok(!result.scenarios.flatMap(s=>s.timeline).some(slot=>slot.cropId==='sweet-corn'));
  const rows=comparisonRows(result);
  assert.match(rows.find(row=>row[0].startsWith('Sum of upper'))[2],/Not comparable/);
  assert.match(rows.find(row=>row[0].startsWith('Known soil'))[2],/Not assessed/);
  assert.match(rows.find(row=>row[0]==='Family repeats')[2],/Not comparable/);
});
test('missing temperatures/rain never become an assessed zero in the explanatory table',()=>{
  const obs=syntheticObservations();for(const p of Object.values(obs.parameters))p.values.fill(null);
  const result=compareRotations(inputs(),obs),rows=comparisonRows(result);
  assert.match(rows.find(row=>row[0].startsWith('Historical frost'))[2],/Not assessed/);
  assert.match(rows.find(row=>row[0].startsWith('Longest historical'))[2],/Not assessed/);
});
test('Fahrenheit display converts physical temperatures and preserves missingness and source values',()=>{
  const original=[-40,0,20,100,null];assert.deepEqual(original.map(v=>temperatureValue(v,'F')),[-40,32,68,212,null]);
  assert.deepEqual(original,[-40,0,20,100,null]);assert.equal(temperatureValue(20,'C'),20);
});
