import {waitForLiveFields} from './live-fields.js';
import {test,expect} from '@playwright/test';

test('a live-discovered Ames field renders on terrain with derived slope context',async({page},info)=>{
  test.setTimeout(540_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption('42,-93.69');
  await waitForLiveFields(page,info);await expect(page.getByRole('combobox',{name:'Mapped field',exact:true})).toBeEnabled();
  // This must be returned by live discovery, never injected from a saved outline.
  await page.getByRole('combobox',{name:'Mapped field',exact:true}).selectOption('way/732026029');
  await expect(page.getByRole('link',{name:'View mapped field and history',exact:true})).toHaveAttribute('href','https://www.openstreetmap.org/way/732026029');
  await page.getByRole('button',{name:'Open 3D evidence map',exact:true}).click();
  await expect(page.locator('#map3d-status')).toContainText('native cells loaded',{timeout:60_000});
  await page.getByText('Terrain and selected-field context',{exact:true}).click();
  await page.getByRole('button',{name:'View selected field on terrain',exact:true}).click();
  await expect(page.locator('#terrain-context-output')).toContainText('Selected-field terrain context',{timeout:45_000});
  const context=await page.evaluate(()=>window.fieldshiftTerrainContext);
  expect(context.assessed).toBe(true);expect(context.validGradientPixels).toBeGreaterThanOrEqual(9);
  expect(Number.isFinite(context.slopeMedianDegrees)).toBe(true);
  await page.waitForFunction(()=>window.fieldshift3D.map.queryRenderedFeatures({layers:['selected-field-edge']}).length>0,null,{timeout:45_000});
  await info.attach('Live-discovered field terrain context',{body:Buffer.from(JSON.stringify(context,null,2)),contentType:'application/json'});
  await page.screenshot({path:info.outputPath('live-field-drape.png')});
  await page.getByRole('button',{name:'Return to 2D map',exact:true}).click();
  expect(errors).toEqual([]);
});
