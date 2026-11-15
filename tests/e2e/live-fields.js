import {expect} from '@playwright/test';
// Live field discovery through shared public OpenStreetMap lookup services. Real
// fields are mandatory: nothing is injected, saved or skipped. When every service
// is busy the app shows "Retry mapped field search"; like a person, the test presses
// it (at most twice) and reports how many retries the real services needed.
export async function waitForLiveFields(page,info,minimum=1){
  const count=()=>page.locator('#farm-results option[value]:not([value=""])').count();
  const retry=page.getByRole('button',{name:'Retry mapped field search',exact:true});
  let retries=0;
  for(;;){
    await expect.poll(async()=>(await count())>=minimum||(await retry.isVisible()&&await retry.isEnabled()),{timeout:100_000}).toBe(true);
    if(await count()>=minimum)break;
    expect(retries,'real fields were still unavailable after two user retries').toBeLessThan(2);
    retries++;await retry.click();
  }
  if(retries)await info.attach('Live field lookup needed user retries',{body:Buffer.from(JSON.stringify({retries,status:await page.locator('#farms-status').innerText()})),contentType:'application/json'});
  return retries;
}
