import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonReadiness } from '../public/js/lib/comparison-readiness.js';
const input={catalogReady:true,country:{country:'AU',countryName:'Australia',screeningCropIds:['pea','bush-bean','sweet-corn']},observations:{},allowedCount:3};
test('comparison blockers distinguish unavailable coverage from missing farmer selections',()=>{
  for(const count of [0,1]){
    const state=comparisonReadiness({...input,observations:null,country:{country:'ZZ',countryName:'TEST country',screeningCropIds:['pea'].slice(0,count)},allowedCount:0});
    assert.equal(state.code,'coverage');assert.equal(state.ready,false);assert.match(state.message,/coverage gap, not a missing form entry/);assert.equal(state.label,'Choose another location →');
  }
  const unchecked=comparisonReadiness({...input,allowedCount:1});
  assert.equal(unchecked.code,'allowed');assert.match(unchecked.message,/1 selected, 3 available/);assert.match(unchecked.message,/baseline crops can stay/);
});
test('comparison navigation prerequisites recover to country/evidence and permit ready inputs',()=>{
  assert.equal(comparisonReadiness({...input,catalogReady:false}).code,'catalog');
  assert.match(comparisonReadiness({...input,catalogReady:false,catalogFailed:true}).message,/unavailable.*Reload/);
  assert.equal(comparisonReadiness({...input,country:null}).code,'country');
  assert.equal(comparisonReadiness({...input,observations:null}).code,'evidence');
  assert.equal(comparisonReadiness(input).ready,true);
});
