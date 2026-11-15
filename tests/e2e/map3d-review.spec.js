import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),axe=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');

test('3D controls retain accessible equivalents, reduced motion and usable short-screen layout',async({page,context},info)=>{
  test.setTimeout(180_000);const errors=[],scans=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route(/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/,r=>r.abort('failed'));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{window.policyErrors=[];document.addEventListener('securitypolicyviolation',e=>window.policyErrors.push({directive:e.violatedDirective,url:e.blockedURI}));});
  const scan=async state=>{
    await page.evaluate(axe);
    const report=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}));
    scans.push({state,violations:report.violations,incomplete:report.incomplete.map(r=>({id:r.id,nodes:r.nodes.length})),passes:report.passes.length});
    expect(report.violations,`${state}: ${JSON.stringify(report.violations)}`).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  };
  try{
    await page.goto('/',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#map')).toBeVisible();await expect(page.locator('#map3d-panel')).toBeHidden();
    await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption('-31.89,116.77');
    await expect(page.locator('#catalog-status')).toContainText('Australia:');
    await page.getByRole('button',{name:'Open 3D evidence map',exact:true}).click();
    await expect(page.locator('#map3d-status')).toContainText('native cells loaded',{timeout:60_000});
    await expect(page.locator('#map3d-values tbody tr')).toHaveCount(9);await scan('native rain');
    await page.getByText('NASA imagery for visual context',{exact:true}).click();
    await page.getByRole('combobox',{name:'Imagery product',exact:true}).selectOption('MODIS_Terra_NDVI_8Day');
    await expect(page.getByRole('button',{name:'Show dated imagery',exact:true})).toBeEnabled({timeout:45_000});
    await page.getByRole('button',{name:'Show dated imagery',exact:true}).click();
    await expect(page.locator('#gibs-legend img')).toBeVisible();await scan('dated NDVI');
    await page.getByText('Terrain and selected-field context',{exact:true}).click();
    await page.getByRole('button',{name:'View terrain at selected point',exact:true}).click();
    await expect(page.locator('#terrain-context-output')).toContainText('Nearest DEM pixel',{timeout:45_000});await scan('terrain context');
    await page.getByRole('combobox',{name:'Imagery product',exact:true}).selectOption('');
    await page.locator('#map3d-canvas').scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath('terrain-review.png')});
    await page.getByRole('button',{name:'Globe view',exact:true}).click();
    expect(await page.evaluate(()=>window.fieldshift3D.map.isMoving())).toBe(false);
    const idle=await page.evaluate(async()=>{const map=window.fieldshift3D.map,before=map.getCenter().toArray(),bearing=map.getBearing();for(let i=0;i<90;i++)await new Promise(requestAnimationFrame);return{before,after:map.getCenter().toArray(),bearing,afterBearing:map.getBearing()};});
    expect(idle.before).toEqual(idle.after);expect(idle.bearing).toBe(idle.afterBearing);
    await page.getByRole('button',{name:'Regional view',exact:true}).click();
    await page.getByRole('slider',{name:/Historical month/}).focus();await page.keyboard.press('Home');
    for(let i=0;i<5;i++)await page.keyboard.press('ArrowRight');
    await expect(page.locator('#map3d-legend')).toContainText('June');
    await page.locator('#map3d-canvas').scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath('rain-review.png')});
    await page.screenshot({path:info.outputPath('3d-controls-review.png'),fullPage:true});
    for(const size of [{width:683,height:384},{width:844,height:390}]){
      await page.setViewportSize(size);await page.evaluate(()=>window.fieldshift3D.resize());
      await scan(`short ${size.width}x${size.height}`);
      const layout=await page.evaluate(()=>({scrolling:getComputedStyle(document.body).overflowY,mainHeight:document.querySelector('main').getBoundingClientRect().height,viewport:innerHeight}));
      expect(layout.mainHeight/layout.viewport).toBeGreaterThanOrEqual(.6);
      await expect(page.getByRole('button',{name:'Return to 2D map',exact:true})).toBeEnabled();
    }
    await page.getByRole('button',{name:'Return to 2D map',exact:true}).click();
    await expect(page.getByRole('button',{name:'Open 3D evidence map',exact:true})).toBeFocused();
    expect(await page.evaluate(()=>window.policyErrors)).toEqual([]);expect(errors).toEqual([]);
  }finally{await info.attach('3D axe states and manual-review items',{body:Buffer.from(JSON.stringify(scans,null,2)),contentType:'application/json'});}
});
