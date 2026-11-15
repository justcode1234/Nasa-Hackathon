import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalWindow,rainIndicators} from '../public/js/lib/weather-window.js';
import {windowColumnData,gridMatchesEvidence} from '../public/js/lib/power-columns.js';
import {compareRotations,validateInputs} from '../server/agronomy/rotation.js';
import {syntheticObservations} from './fixtures.js';

test('shared historical window preserves leap substitution, year wrap and missing rain',()=>{
  const obs=syntheticObservations();
  const leap=historicalWindow(obs,Date.UTC(2028,1,28),3);
  assert.deepEqual(leap.days.map(d=>d.referenceDate),['2025-02-28','2025-02-28','2025-03-01']);
  assert.equal(leap.leapDaySubstitutions,1);
  const wrap=historicalWindow(obs,Date.UTC(2027,11,31),2);
  assert.deepEqual(wrap.days.map(d=>d.referenceDate),['2025-12-31','2025-01-01']);
  assert.deepEqual(rainIndicators([0,0,null,0,2].map(PRECTOTCORR=>({PRECTOTCORR}))),{precipitationMm:2,precipitationValidDays:4,precipitationPartial:true,longestZeroRainRunDays:2});
  assert.equal(rainIndicators([{PRECTOTCORR:null}]).precipitationMm,null);
  assert.equal(rainIndicators([{PRECTOTCORR:0}]).precipitationMm,0);
  assert.throws(()=>historicalWindow(obs,Date.now(),367));
});

test('3D crop-window columns equal strategy daily calculations and reject stale or unsupported slots',()=>{
  const obs=syntheticObservations();
  const values=obs.parameters.PRECTOTCORR.values;
  values[5]=null;values[0]=0;values[1]=0;
  const inputs=validateInputs({latitude:0,longitude:0,referenceYear:2025,planningYear:2028,startMonth:11,baseline:['tomato','cabbage','onion'],allowedCrops:['tomato','cabbage','onion'],irrigation:'unknown',soil:'unknown',priority:'family'});
  const result=compareRotations(inputs,obs);
  const data={period:obs.period,selectedCellId:'test-only',cells:[{id:'test-only',dates:obs.dates,values,geometry:{type:'Polygon',coordinates:[]}}]};
  assert.equal(gridMatchesEvidence(data,obs),true);
  for(const slot of result.scenarios.flatMap(s=>s.timeline)){
    const columns=windowColumnData(data,slot),p=columns.features[0].properties;
    assert.equal(p.value,slot.indicators.precipitationMm);
    assert.equal(p.validDays,slot.indicators.precipitationValidDays);
    assert.equal(p.expectedDays,slot.indicators.assessedDays);
    assert.equal(p.partial,slot.indicators.precipitationPartial);
  }
  assert.deepEqual(windowColumnData(data,result.scenarios[0].timeline[0]).periods,['2025-11','2025-12','2025-01']);
  assert.throws(()=>windowColumnData(data,{indicators:null}),/no matching/);
  const stale=structuredClone(result.scenarios[0].timeline[0]);stale.indicators.precipitationMm++;
  assert.throws(()=>windowColumnData(data,stale),/differ/);
  const changed=structuredClone(data);[changed.cells[0].values[2],changed.cells[0].values[3]]=[3,1];
  assert.equal(changed.cells[0].values.slice(0,31).reduce((a,b)=>a+(b??0),0),values.slice(0,31).reduce((a,b)=>a+(b??0),0));
  assert.equal(gridMatchesEvidence(changed,obs),false,'Daily differences must not hide behind a monthly sum');
});
