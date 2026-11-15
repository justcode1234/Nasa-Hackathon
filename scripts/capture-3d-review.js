// Real application renders for the plan's visual review; build before running.
import {chromium} from '@playwright/test';
import {createStaticPreview} from './static-preview.js';
import {writeFile} from 'node:fs/promises';
const app=createStaticPreview();await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[];
try{
  for(const viewport of [{width:1280,height:1000},{width:390,height:844}]){
    const context=await browser.newContext({viewport,isMobile:viewport.width<500,hasTouch:viewport.width<500}),page=await context.newPage();
    try{
      await context.route(/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru/,r=>r.abort('failed'));
      await page.goto(`http://127.0.0.1:${app.address().port}`,{waitUntil:'domcontentloaded'});
      await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption('-31.89,116.77');
      await page.getByRole('button',{name:'Open 3D evidence map',exact:true}).click();
      await page.waitForFunction(()=>window.fieldshift3D?.snapshot().features.length===9,null,{timeout:60_000});
      await page.getByRole('slider',{name:/Historical month/}).focus();await page.keyboard.press('Home');
      for(let i=0;i<5;i++)await page.keyboard.press('ArrowRight');
      const images={};
      const capture=async name=>{
        await page.waitForFunction(()=>window.fieldshift3D.map.areTilesLoaded()&&!window.fieldshift3D.map.isMoving(),null,{timeout:60_000});
        // Two frames after source readiness, then the actual GPU canvas. This avoids
        // clipping tall phone canvases inside the scrollable application shell.
        const png=await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);return window.fieldshift3D.map.getCanvas().toDataURL('image/png');});
        const filename=`v5-review-${viewport.width}-${name}.png`;
        await writeFile(`docs/evidence/${filename}`,Buffer.from(png.split(',')[1],'base64'));images[name]=filename;
      };
      await capture('rain');const legend=await page.locator('#map3d-legend').innerText();
      await page.getByText('Terrain and selected-field context',{exact:true}).click();
      await page.getByRole('button',{name:'View terrain at selected point',exact:true}).click();
      await page.waitForFunction(()=>window.fieldshiftTerrainContext,null,{timeout:45_000});await capture('terrain');
      rows.push({viewport,images,legend,terrain:await page.locator('#terrain-context-output').innerText(),checkedAt:new Date().toISOString()});
    }finally{await context.close();}
  }
  await writeFile('docs/evidence/v5-visual-review.json',JSON.stringify(rows,null,2));console.log('Saved actual desktop and phone-sized rain/terrain renders with text provenance.');
}finally{await browser.close();await new Promise(resolve=>app.close(resolve));}
