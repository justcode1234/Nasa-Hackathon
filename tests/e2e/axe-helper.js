import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {expect} from '@playwright/test';
const require=createRequire(import.meta.url),source=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
export async function scanAccessibility(page,info,state){
  await page.evaluate(source);const report=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}));
  await info.attach(`axe ${state}`,{body:Buffer.from(JSON.stringify({state,violations:report.violations,incomplete:report.incomplete.map(r=>({id:r.id,nodes:r.nodes.length})),passes:report.passes.length},null,2)),contentType:'application/json'});
  expect(report.violations,state).toEqual([]);
}
