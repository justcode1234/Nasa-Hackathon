import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../server/context/country-crops.json' with {type:'json'};
import {catalog,mentionedCrops,findCrop} from '../server/agronomy/catalog.js';
import {getCountryCrops,screeningItemIds} from '../server/context/crops.js';
import {validateInputs,compareRotations} from '../server/agronomy/rotation.js';
import {answerConversation} from '../server/agronomy/conversation.js';
import {syntheticObservations} from './fixtures.js';

test('sourced expansion covers 166 countries without a radish or variant mapping',()=>{
  assert.equal(catalog.crops.length,7);
  assert.equal(Object.keys(snapshot.countries).filter(country=>getCountryCrops({country}).screeningCropIds.length>=2).length,166);
  for(const [id,item] of [['tomato','388'],['cabbage','358'],['onion','403']]){
    assert.deepEqual(screeningItemIds(id),[item]);const crop=findCrop(id);
    assert.ok(crop.sourceIds.length>=3);assert.ok(crop.sourceIds.every(id=>catalog.sources.some(source=>source.id===id)));
    assert.equal(crop.requiresWellDrainedSoil,true);assert.ok(crop.soilPhRange.length===2);
  }
  assert.deepEqual(screeningItemIds('radish'),[]);
  assert.deepEqual(getCountryCrops({country:'SG'}).screeningCropIds,['cabbage','tomato']);
  for(const name of ['Chinese cabbage','Napa cabbage','bok choy','pak choi','green onion','spring onion','Welsh onion','bunching onions','scallion']){
    assert.deepEqual(mentionedCrops(name),[],name);assert.equal(findCrop(name),undefined,name);
  }
  assert.equal(mentionedCrops('head cabbage and Napa cabbage')[0].id,'cabbage');
});
test('cabbage heat checks name the crop and onion calendar limits remain visible',()=>{
  const inputs=validateInputs({latitude:18.52,longitude:73.85,country:'IN',referenceYear:2025,planningYear:2027,startMonth:1,baseline:['cabbage','tomato','onion'],allowedCrops:['cabbage','tomato','onion'],priority:'climate',soil:'unknown',irrigation:'unknown',soilPh:8,drainage:'poor'});
  const observations=syntheticObservations();observations.parameters.T2M.values.fill(25); // TEST ONLY warmer daily means.
  observations.parameters.T2M_MAX.values.fill(30);observations.parameters.T2M_MIN.values.fill(18);
  const result=compareRotations(inputs,observations),base=result.scenarios[0];
  assert.ok(base.criteria.daysAboveIdealAir>0);assert.equal(base.criteria.peaDaysAboveIdeal,undefined);
  assert.ok(base.risks.some(text=>text.includes('Cabbage')&&text.includes('ideal-air')));
  assert.ok(!base.risks.some(text=>text.includes('pea ideal')));assert.ok(base.criteria.calendarOverruns>0);
  assert.ok(!base.sourceIds.includes('umn-peas'));assert.ok(base.sourceIds.includes('clemson-cabbage'));
  assert.match(result.gaps.join(' '),/Cabbage/);assert.match(result.gaps.join(' '),/Radish/);
  assert.equal(base.timeline[0].indicators.daysAboveIdealAir,base.criteria.daysAboveIdealAir);
});
test('tomato knowledge uses the sourced harvest range and no obsolete screening exclusion',()=>{
  const answer=answerConversation('How long does tomato take to harvest in Singapore?');
  assert.match(answer.blocks.map(b=>b.text).join(' '),/52-90/);
  assert.ok(answer.sources.some(source=>source.id==='clemson-tomato'));
  assert.ok(!answer.blocks.some(block=>block.kind==='screening limit'));
});
