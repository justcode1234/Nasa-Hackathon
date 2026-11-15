import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApiHandler} from '../server/api.js';
import {getCountryCrops,countryCropName} from '../server/context/crops.js';
const cases=JSON.parse(readFileSync(new URL('./qa/unexpected-prompts.json',import.meta.url),'utf8')).cases;
export const promptText=item=>item.repeatToLength?item.question.repeat(Math.ceil(item.repeatToLength/item.question.length)).slice(0,item.repeatToLength):item.question;

test('new unexpected questions return grounded limits, source-backed context or clarification',async()=>{
  assert.equal(cases.length,28);
  const api=createApiHandler({getObservations:async()=>{throw new Error('These read-only questions must not load weather');}});
  const failures=[];
  for(const item of cases){
    const answer=await api({method:'POST',url:new URL('https://test.invalid/api/ask'),readJson:async()=>({question:promptText(item),selectedCountry:item.country})});
    const text=answer.blocks.map(block=>block.text).join(' ');
    for(const pattern of item.checks)if(!new RegExp(pattern,'i').test(text))failures.push({id:item.id,pattern,text});
    for(const pattern of item.forbidden??[])if(new RegExp(pattern,'i').test(text))failures.push({id:item.id,forbidden:pattern,text});
    assert.ok(answer.blocks.length<=3,item.id);
    for(const id of answer.blocks.flatMap(block=>block.sourceIds))assert.ok(answer.sources.some(source=>source.id===id),item.id+': '+id);
  }
  assert.deepEqual(failures,[]);
});

test('verified regional crop records never become FAOSTAT records or ranked alternatives',()=>{
  const area=getCountryCrops({country:'AX'});
  assert.equal(area.countryName,'Åland Islands');assert.deepEqual(area.records,[]);assert.deepEqual(area.screeningCropIds,[]);
  assert.equal(area.choices.length,5);assert.ok(area.choices.every(choice=>choice.id.startsWith('unassessed:regional:AX:')&&choice.screeningId===null));
  assert.equal(countryCropName(area.choices.find(choice=>choice.name==='Wheat').id),'Wheat');
  assert.equal(area.regionalContext.year,2024);assert.equal(area.regionalContext.records.find(record=>record.id==='barley-oats').tonnes,810);
  assert.match(area.regionalContext.missingness,/not a complete.*must not be split/i);
});
