import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiHandler } from '../server/api.js';
import { parseWorkflowMessage } from '../public/js/modules/workflow-assistant.js';

const bodyText=answer=>answer.blocks.map(block=>block.text).join(' ');
async function ask(question, inputs={}) {
  const api=createApiHandler({getObservations:async()=>{throw new Error('These evidence/limit questions must not retrieve unrelated weather');}});
  const answer=await api({method:'POST',url:new URL('https://test.invalid/api/ask'),readJson:async()=>({...inputs,question})});
  assert.ok(answer.blocks.length<=3);
  assert.equal(answer.useSelectedLocation,false);
  for(const id of answer.blocks.flatMap(block=>block.sourceIds)) assert.ok(answer.sources.some(source=>source.id===id));
  return answer;
}
test('QA gaps: confidence, exact yield and guarantees get explicit calibrated limits with or without a comparison',async()=>{
  for(const inputs of [{},{baseline:['rice','wheat','bush-bean'],selectedCountry:'IN'}]) {
    for(const question of ['What is the chance my crop succeeds, perhaps 98%?','Can you assign a probability of success?','Is a 95 percent success rate supported?']) {
      const answer=await ask(question,inputs);
      assert.match(bodyText(answer),/cannot.*(?:confidence|probability)/i);
      assert.doesNotMatch(bodyText(answer),/(?:probability|confidence) is \d+%/i);
    }
    for(const question of ['Predict the exact farm yield from POWER','Give me precise field yield in tonnes','Can you promise rice will be safe next season?']) {
      const answer=await ask(question,inputs);
      assert.match(bodyText(answer),/cannot.*(?:estimate|guarantee)/i);
      assert.match(bodyText(answer),/historical|forecast/i);
    }
  }
});
test('QA gaps: farmer-reported pH and drainage are checked against source facts without certifying safety',async()=>{
  const adverse=await ask('My sweet corn field is waterlogged, with pH 8.2. Is it safe?');
  assert.match(bodyText(adverse),/8\.2.*5\.8–7.*outside/);
  assert.match(bodyText(adverse),/flooding\/poor drainage is a concern/);
  assert.match(bodyText(adverse),/cannot certify/);
  const different=await ask('Does sweet corn fit my soil?',{soilPh:6.5,drainage:'well'});
  assert.match(bodyText(different),/6\.5.*within that reference range/);
  assert.doesNotMatch(bodyText(different),/flooding\/poor drainage is a concern/);
});
test('QA gaps: crop-family explanations remain read-only and preserve the shared-family caveat',async()=>{
  for(const question of ['Can I rotate peas and beans to reduce pests?','Are beans and garden peas a family break?','Help me understand whether peas and beans interrupt pest hosts']) {
    assert.equal(parseWorkflowMessage(question,true),null,question);
    const answer=await ask(question);
    assert.match(bodyText(answer),/Fabaceae.*not a crop-family break/);
    assert.match(bodyText(answer),/cannot guarantee pest elimination/);
    assert.ok(answer.sources.some(source=>source.id==='cornell-rotation'));
  }
});
test('QA gaps: contrasting grain maize with sweet corn does not transfer sweet-corn facts',async()=>{
  for(const question of ['I grow maize for grain. Can I use sweet-corn rules?','Are grain-maize and sweet corn interchangeable?','Could field corn use sweet corn maturity values?']) {
    assert.equal(parseWorkflowMessage(question,true),null,question);
    const answer=await ask(question);
    assert.match(bodyText(answer),/Grain maize remains unassessed/);
    assert.doesNotMatch(bodyText(answer),/60–100|maturity reference/);
  }
});
test('QA gaps: kai lan overview includes the actual eligibility boundary',async()=>{
  const answer=await ask('Tell me about gai lan in Singapore');
  assert.match(bodyText(answer),/not been added.*rotation-screening catalog/);
  assert.ok(answer.sources.some(source=>source.id==='nparks-leafy'));
});
