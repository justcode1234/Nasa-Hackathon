import {test,expect} from '@playwright/test';
async function prepare(page){
  await page.context().route(/overpass-api\.de|overpass\.private\.coffee|\/api\/farms\?/,route=>route.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption('-31.89,116.77');
  await page.getByRole('button',{name:'Open 3D evidence map',exact:true}).click();
  await expect(page.locator('#map3d-status')).toContainText('native cells loaded',{timeout:60_000});
  await page.getByText('NASA imagery for visual context',{exact:true}).click();
}
test('four imagery products use NASA dates, legends and native resolution without changing POWER values',async({page},info)=>{
  test.setTimeout(180_000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await prepare(page);const before=await page.evaluate(()=>window.fieldshift3D.snapshot().features.map(f=>f.properties.value));
  const captured=[];
  for(const[id,units,resolution]of [['MODIS_Terra_NDVI_8Day','unitless NDVI','250 m'],['SMAP_L4_Analyzed_Surface_Soil_Moisture','m³/m³','9 km'],['IMERG_Precipitation_Rate','mm/hour','0.1°'],['MODIS_Terra_Land_Surface_Temp_Day','K','1 km']]){
    await page.getByRole('combobox',{name:'Imagery product',exact:true}).selectOption(id);
    await expect(page.getByLabel('Imagery date',{exact:true})).toBeEnabled({timeout:45_000});
    const date=await page.getByLabel('Imagery date',{exact:true}).inputValue();
    await page.getByRole('button',{name:'Show dated imagery',exact:true}).click();
    await expect(page.locator('#gibs-legend')).toContainText(date);await expect(page.locator('#gibs-legend')).toContainText(units);await expect(page.locator('#gibs-legend')).toContainText(resolution);
    await expect.poll(()=>page.getByRole('img',{name:/NASA colour legend/}).evaluate(img=>img.complete&&img.naturalWidth>0),{timeout:30_000}).toBe(true);
    const source=await page.evaluate(()=>window.fieldshift3D.map.getStyle().sources['gibs-imagery']);
    expect(source.tiles[0]).toContain(id);expect(source.tiles[0]).toContain(date);expect(new URL(source.tiles[0]).hostname).toBe('gibs.earthdata.nasa.gov');
    expect(await page.evaluate(()=>window.fieldshift3D.snapshot().features.map(f=>f.properties.value))).toEqual(before);
    captured.push({id,date,units,resolution,source});
  }
  await info.attach('Actual NASA imagery selections',{body:Buffer.from(JSON.stringify(captured,null,2)),contentType:'application/json'});expect(errors).toEqual([]);
});
test('imagery metadata transport failure retries the real capabilities',async({page,context})=>{
  const pattern=/\/api\/gibs-layers(?:\?|$)|gibs\.earthdata\.nasa\.gov.*WMTSCapabilities\.xml/;
  await context.route(pattern,route=>route.abort('failed'));await prepare(page);
  await page.getByRole('combobox',{name:'Imagery product',exact:true}).selectOption('SMAP_L4_Analyzed_Surface_Soil_Moisture');
  await expect(page.getByRole('button',{name:'Retry imagery metadata',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Show dated imagery',exact:true})).toBeDisabled();await expect(page.locator('#gibs-legend')).toBeEmpty();
  await context.unroute(pattern);await page.getByRole('button',{name:'Retry imagery metadata',exact:true}).click();
  await expect(page.getByRole('button',{name:'Show dated imagery',exact:true})).toBeEnabled({timeout:45_000});
});
test('missing imagery tiles produce a visible notice and preserve the rain table',async({page,context})=>{
  await context.route(/gibs\.earthdata\.nasa\.gov\/wmts\/.*\/SMAP_L4_Analyzed_Surface_Soil_Moisture\//,route=>route.abort('failed'));
  await prepare(page);await page.getByRole('combobox',{name:'Imagery product',exact:true}).selectOption('SMAP_L4_Analyzed_Surface_Soil_Moisture');
  await expect(page.getByRole('button',{name:'Show dated imagery',exact:true})).toBeEnabled({timeout:45_000});
  await page.getByRole('button',{name:'Show dated imagery',exact:true}).click();
  await expect(page.getByText('Some 3D map tiles could not load. The text table and 2D map remain available.',{exact:true})).toBeVisible({timeout:30_000});
  await expect(page.locator('#map3d-values tbody tr')).toHaveCount(9);await expect(page.locator('#gibs-info')).toContainText('values are not extracted');
});
