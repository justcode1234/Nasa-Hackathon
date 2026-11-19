import {test,expect} from '@playwright/test';
import {NO_ANSWER} from '../../public/js/lib/api.js';
// One failing action, driven on both transports, with one expected string: the requirement the handoff queue set
// for this seam. Measured in this same browser before the rule existed, the identical call answered
// `Failed to construct 'URL': Invalid URL` on the worker transport and `Failed to execute 'fetch' on 'Window':
// Failed to parse URL from https://[` on the Node transport, while an aborted field request rendered
// `Failed to fetch You can continue with the selected map point or coordinates without field outlines.`
// Nothing here touches the network: both transports fail while turning the path into a request.
test('a request that ends with no status reads one authored sentence on either transport',async({page},testInfo)=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const expectedTransport=testInfo.project.name.startsWith('node')?'http':'worker';
  expect(await page.evaluate(()=>document.querySelector('meta[name="fieldshift-transport"]').content)).toBe(expectedTransport);
  const warnings=[];page.on('console',message=>{if(message.type()==='warning')warnings.push(message.text());});
  const outcome=await page.evaluate(async()=>{
    const m=await import('/js/lib/api.js');
    const grab=async run=>{try{await run();return 'resolved, no error';}catch(error){return error.message;}};
    return {statusless:await grab(()=>m.api('https://[')),authored:await grab(()=>m.api('/api/ask',{method:'POST',body:{}}))};
  });
  expect(outcome.statusless).toBe(NO_ANSWER);
  expect(outcome.authored).toBe('Enter a question of 1–500 characters.');
  expect(warnings.join('\n')).toMatch(/request ended with no status/);
});
