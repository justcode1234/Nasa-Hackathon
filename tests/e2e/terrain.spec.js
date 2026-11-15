import {test,expect} from '@playwright/test';
async function prepare(page){
  await page.context().route(/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/,route=>route.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption('-31.89,116.77');
  await page.getByRole('button',{name:'Open 3D evidence map',exact:true}).click();
  await expect(page.locator('#map3d-status')).toContainText('native cells loaded',{timeout:60_000});
  await page.getByText('Terrain and selected-field context',{exact:true}).click();
}
test('real terrain keeps actual scale and leaves field slope unknown without a boundary',async({page},info)=>{
  test.setTimeout(120_000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await prepare(page);await expect(page.getByRole('button',{name:'View selected field on terrain',exact:true})).toBeDisabled();
  await expect(page.getByText(/No field boundary selected.*slope and aspect remain unassessed/)).toBeVisible();
  await page.getByRole('button',{name:'View terrain at selected point',exact:true}).click();
  await expect(page.locator('#terrain-context-output')).toContainText('Nearest DEM pixel',{timeout:45_000});
  await page.waitForFunction(()=>Number.isFinite(window.fieldshift3D.map.queryTerrainElevation([116.77,-31.89])),null,{timeout:45_000});
  const result=await page.evaluate(()=>window.fieldshiftTerrainContext);
  expect(Number.isFinite(result.elevationM)).toBe(true);expect(result.spatialResolution.zoom).toBe(12);expect(result.sampleSpacingM).toBeGreaterThan(32);expect(result.sampleSpacingM).toBeLessThan(33);
  expect(await page.evaluate(()=>window.fieldshift3D.map.getTerrain().exaggeration)).toBe(1);
  await page.getByRole('combobox',{name:'Terrain exaggeration',exact:true}).selectOption('2');
  expect(await page.evaluate(()=>window.fieldshift3D.map.getTerrain().exaggeration)).toBe(2);
  expect(await page.evaluate(()=>window.fieldshiftTerrainContext.elevationM)).toBe(result.elevationM);
  expect(await page.evaluate(()=>window.fieldshift3D.map.getLayoutProperty('power-columns','visibility'))).toBe('none');
  await page.screenshot({path:info.outputPath('terrain-real-point.png')});
  await page.getByRole('button',{name:'Regional view',exact:true}).click();
  expect(await page.evaluate(()=>window.fieldshift3D.map.getTerrain())).toBe(null);
  expect(await page.evaluate(()=>window.fieldshift3D.map.getLayoutProperty('power-columns','visibility'))).toBe('visible');
  await info.attach('Actual DEM point context',{body:Buffer.from(JSON.stringify(result,null,2)),contentType:'application/json'});expect(errors).toEqual([]);
});
test('failed terrain remains unknown and an explicit retry restores real pixels',async({page,context})=>{
  test.setTimeout(120_000);const pattern=/elevation-tiles-prod\.s3\.amazonaws\.com|\/api\/terrain-point\?/;
  await context.route(pattern,route=>route.abort('failed'));await prepare(page);
  await page.getByRole('button',{name:'View terrain at selected point',exact:true}).click();
  await expect(page.locator('#terrain-context-output')).toContainText('no values are inferred');
  expect(await page.evaluate(()=>window.fieldshiftTerrainContext===undefined)).toBe(true);
  await context.unroute(pattern);await page.getByRole('button',{name:'View terrain at selected point',exact:true}).click();
  await expect(page.locator('#terrain-context-output')).toContainText('Nearest DEM pixel',{timeout:45_000});
  await page.waitForFunction(()=>Number.isFinite(window.fieldshift3D.map.queryTerrainElevation([116.77,-31.89])),null,{timeout:45_000});
  await expect(page.locator('#map3d-values tbody tr')).toHaveCount(9);
});
