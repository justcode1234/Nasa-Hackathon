import {test,expect} from '@playwright/test';
async function point(page){
  // Field availability has its own live release cases; do not hammer an unrelated
  // service while testing NASA/3D. This is a transport failure, never fake fields.
  await page.context().route(/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/,route=>route.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption('-31.89,116.77');
  await expect(page.locator('#catalog-status')).toContainText('Australia:');
  await page.getByRole('spinbutton',{name:'Historical reference year',exact:true}).fill('2025');
}
async function open(page){
  await page.getByRole('button',{name:'Open 3D evidence map',exact:true}).click();
  await expect(page.locator('#map3d-status')).toContainText('native cells loaded',{timeout:60_000});
  await page.waitForFunction(()=>window.fieldshift3D?.map.isSourceLoaded('power-cells'),null,{timeout:30_000});
}
test('lazy native rain cells match point evidence, slider and monthly table',async({page,context},info)=>{
  test.setTimeout(180_000);const requests=[],errors=[],policy=[];
  context.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.policyErrors=[];document.addEventListener('securitypolicyviolation',event=>window.policyErrors.push(event.violatedDirective));});
  await point(page);
  expect(requests.filter(url=>url.includes('/vendor/maplibre/'))).toEqual([]);
  await page.getByRole('button',{name:'Load historical NASA evidence',exact:true}).click();
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded',{timeout:45_000});
  await page.getByRole('tab',{name:/01.*Find farmland/}).click();await open(page);
  await expect(page.locator('#map3d-status')).toContainText('match the loaded point evidence');
  await expect(page.locator('#map')).toBeHidden();await expect(page.locator('#map3d-values tbody tr')).toHaveCount(9);
  const first=await page.evaluate(()=>{const view=window.fieldshift3D.snapshot();return view.features.find(f=>f.properties.selected).properties;});
  const january=Number(await page.locator('[data-evidence-month="2025-01"]').getAttribute('data-rain-sum'));expect(first.value).toBe(january);
  await page.getByRole('slider',{name:/Historical month/}).focus();await page.getByRole('slider',{name:/Historical month/}).press('ArrowRight');
  const february=Number(await page.locator('[data-evidence-month="2025-02"]').getAttribute('data-rain-sum'));
  await expect(page.locator('#map3d-legend')).toContainText('February 2025');
  const second=await page.evaluate(()=>window.fieldshift3D.snapshot().features.find(f=>f.properties.selected).properties);
  expect(second.value).toBe(february);expect(second.height).not.toBe(first.height);
  await expect(page.locator('[data-evidence-month="2025-02"]')).toHaveAttribute('aria-current','true');
  const screenshot=await page.locator('#map3d-canvas canvas').screenshot();
  const variance=await page.evaluate(async encoded=>{const image=new Image();image.src='data:image/png;base64,'+encoded;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(canvas.width/4,canvas.height/4,Math.floor(canvas.width/2),Math.floor(canvas.height/2)).data;let min=255,max=0;for(let i=0;i<pixels.length;i+=4){min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i]);}return max-min;},screenshot.toString('base64'));
  expect(variance).toBeGreaterThan(10);await page.screenshot({path:info.outputPath('native-rain.png')});
  expect(await page.evaluate(()=>window.policyErrors)).toEqual([]);expect(errors).toEqual([]);
  await page.getByRole('combobox',{name:'Country',exact:true}).selectOption('KH');
  await expect(page.locator('#map3d-panel')).toBeHidden();await expect(page.locator('#map')).toBeVisible();
  expect(await page.evaluate(()=>window.fieldshift3D===undefined)).toBe(true);
});
test('WebGL failure preserves the usable 2D map and coordinate flow',async({page})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/.test(kind)?null:original.call(this,kind,...args);};});
  await point(page);await page.getByRole('button',{name:'Open 3D evidence map',exact:true}).click();
  await expect(page.locator('#map3d-notice')).toContainText(/3D.*unavailable/);
  await expect(page.locator('#map')).toBeVisible();await expect(page.locator('#map3d-panel')).toBeHidden();
  await page.getByRole('button',{name:/Next: NASA evidence/}).click();
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded',{timeout:45_000});
});
test('3D NASA failures keep missing data explicit and retry the real request',async({page,context})=>{
  const pattern=/\/api\/power-grid\?|power\.larc\.nasa\.gov\/api\/temporal\/daily\/regional/;
  await context.route(pattern,route=>route.abort('failed'));await point(page);
  await page.getByRole('button',{name:'Open 3D evidence map',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry 3D NASA grid',exact:true})).toBeVisible({timeout:45_000});
  await expect(page.locator('#map3d-values')).toBeEmpty();await expect(page.locator('#map3d-status')).toContainText('No replacement readings');
  await context.unroute(pattern);await page.getByRole('button',{name:'Retry 3D NASA grid',exact:true}).click();
  await expect(page.locator('#map3d-status')).toContainText('native cells loaded',{timeout:60_000});
  await expect(page.locator('#map3d-values tbody tr')).toHaveCount(9);
});
test('changing location during lazy loading cannot clear a newer map',async({page,context})=>{
  test.setTimeout(120_000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let release,held;
  const waiting=new Promise(resolve=>{release=resolve;}),seen=new Promise(resolve=>{held=resolve;});
  await context.route('**/vendor/maplibre/maplibre-gl.mjs',async route=>{held();await waiting;await route.continue();});
  await point(page);await page.getByRole('button',{name:'Open 3D evidence map',exact:true}).click();await seen;
  await page.getByRole('combobox',{name:'Country',exact:true}).selectOption('KH');
  await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption('-31.89,116.77');
  await expect(page.getByRole('button',{name:'Open 3D evidence map',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Open 3D evidence map',exact:true}).click();release();
  await expect(page.locator('#map3d-status')).toContainText('native cells loaded',{timeout:60_000});
  await expect(page.locator('#map3d-canvas canvas')).toHaveCount(1);
  expect(await page.evaluate(()=>window.fieldshift3D.map.getCanvas().isConnected)).toBe(true);
  expect(errors).toEqual([]);
});
