// Actual application, isolated Chrome, real providers. No field fixtures or model claims.
import {chromium} from '@playwright/test';
import {createStaticPreview} from './static-preview.js';
import {sampleBrowserMemory,summarizeMemory} from './browser-memory.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import path from 'node:path';
const directory=process.env.BENCH_OUTPUT_DIR??'artifacts/3d-app';await mkdir(directory,{recursive:true});
const app=createStaticPreview();await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
const results=[];
try{
  for(const viewport of [{width:1280,height:1000},{width:390,height:844}]){
    const service=await chromium.launchServer({channel:'chrome',headless:true,args:[
      '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${path.resolve('tests/fixtures/TEST-synthetic-speech-tomatoes-kenya.wav')}%noloop`
    ]}),browser=await chromium.connect(service.wsEndpoint());
    const samples=[],errors=[],responses=[];
    const sample=async phase=>{samples.push(await sampleBrowserMemory(service.process().pid,phase));await writeFile(`${directory}/${viewport.width}-samples.json`,JSON.stringify(samples,null,2));};
    try{
      const page=await browser.newPage({viewport,isMobile:viewport.width<500,hasTouch:viewport.width<500});
      const publicUrl=value=>{const url=new URL(value);return url.origin+url.pathname;};
      page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(!r.url().startsWith('http://127.0.0.1'))responses.push({url:publicUrl(r.url()),status:r.status()});});
      const initialResources=[],initialReads=[];let initialPhase=true;
      page.on('response',response=>{if(initialPhase)initialReads.push((async()=>{
        try{initialResources.push({url:publicUrl(response.url()),status:response.status(),decodedBytes:(await response.body()).length});}
        catch(error){initialResources.push({url:publicUrl(response.url()),status:response.status(),unverified:error.message});}
      })());});
      await page.route(/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru/,r=>r.abort('failed'));
      await page.addInitScript(()=>{window.policyErrors=[];document.addEventListener('securitypolicyviolation',e=>window.policyErrors.push({directive:e.violatedDirective,url:e.blockedURI}));});
      const initialStart=Date.now();await page.goto(`http://127.0.0.1:${app.address().port}`,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>document.querySelectorAll('#pest-country option').length>100&&!document.querySelector('#location-method').disabled);
      const initialReadyMs=Date.now()-initialStart;initialPhase=false;await Promise.allSettled(initialReads);
      const lazyRequests=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/vendor/maplibre/')).length);
      await sample('2D before opt-in');
      await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption('-31.89,116.77');
      await page.waitForFunction(()=>document.querySelector('#catalog-status').textContent.includes('Australia:'));
      const start=Date.now();await page.getByRole('button',{name:'Open 3D evidence map',exact:true}).click();
      await page.waitForFunction(()=>window.fieldshift3D?.snapshot().features.length===9,null,{timeout:60_000});
      const openToDataMs=Date.now()-start;
      await page.waitForFunction(()=>window.fieldshift3D.map.areTilesLoaded(),null,{timeout:60_000});
      await sample('native rainfall columns');
      await page.getByText('NASA imagery for visual context',{exact:true}).click();
      await page.getByRole('combobox',{name:'Imagery product',exact:true}).selectOption('MODIS_Terra_NDVI_8Day');
      await page.waitForFunction(()=>!document.querySelector('#gibs-date').disabled,null,{timeout:45_000});
      await page.getByRole('button',{name:'Show dated imagery',exact:true}).click();
      await page.waitForFunction(()=>window.fieldshift3D.map.areTilesLoaded(),null,{timeout:60_000});
      await sample('rainfall and dated NDVI imagery');
      await page.getByText('Terrain and selected-field context',{exact:true}).click();
      await page.getByRole('button',{name:'View terrain at selected point',exact:true}).click();
      await page.waitForFunction(()=>window.fieldshiftTerrainContext,null,{timeout:45_000});
      await page.waitForFunction(()=>window.fieldshift3D.map.areTilesLoaded(),null,{timeout:60_000});
      await sample('terrain, imagery, rain data retained');
      const frameRate=await page.evaluate(async()=>{
        const map=window.fieldshift3D.map,frames=[],start=performance.now();let previous=start;
        await new Promise(resolve=>{function frame(now){frames.push(now-previous);previous=now;map.panBy([1,0],{duration:0});if(now-start<2000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
        const valid=frames.slice(1).sort((a,b)=>a-b);return{durationMs:performance.now()-start,frames:valid.length,fps:1000/(valid.reduce((a,b)=>a+b,0)/valid.length),p95FrameMs:valid[Math.floor(valid.length*.95)]};
      });
      await page.getByRole('button',{name:'Open FieldShift assistant'}).click();
      await page.waitForFunction(()=>document.querySelector('#model-status').textContent.includes('Compact model ready'),null,{timeout:60_000});
      await page.getByRole('textbox',{name:'Message',exact:true}).fill('Tell me about tomato from Australia');await page.getByRole('button',{name:'Send',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#answer-status').textContent.includes('Answer ready'),null,{timeout:45_000});
      await page.waitForFunction(()=>window.fieldshiftModelSelections>0,null,{timeout:45_000});
      await sample('3D plus loaded compact model and actual inference');
      const model=await page.evaluate(()=>({metrics:window.fieldshiftModelMetrics,selections:window.fieldshiftModelSelections}));
      if(!(model.selections>0))throw new Error('No actual compact model inference was observed.');
      await page.locator('#mic').click();await page.locator('#start-dictation').click();
      await page.waitForFunction(()=>document.querySelector('#mic').getAttribute('aria-pressed')==='true');
      await page.waitForTimeout(4000);await sample('3D, compact model and English speech loading/recording');
      await page.locator('#mic').click();
      await page.waitForFunction(()=>/tomatoes in kenya/i.test(document.querySelector('#question').value),null,{timeout:240_000});
      const speech=await page.evaluate(()=>({metrics:window.fieldshiftSpeechMetrics,transcript:document.querySelector('#question').value}));
      await sample('3D, compact model and loaded English speech after actual transcription');
      await page.locator('#assistant-settings>summary').click();await page.locator('#unload-speech').click();
      await sample('3D and compact model after speech unload');
      await page.getByRole('button',{name:'Close assistant',exact:true}).click();await page.locator('#map3d-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/${viewport.width}-terrain.png`});
      await page.getByRole('button',{name:'Regional view',exact:true}).click();await page.locator('#map3d-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/${viewport.width}-columns.png`});
      const gpu=await(await browser.newBrowserCDPSession()).send('SystemInfo.getInfo');
      results.push({checkedAt:new Date().toISOString(),viewport,initialReadyMs,initialResources,
        initialDecodedBodyBytes:initialResources.reduce((sum,r)=>sum+(r.decodedBytes??0),0),lazyRequests,openToDataMs,frameRate,model,speech,memory:summarizeMemory(samples),samples,
        gpu:{devices:gpu.gpu.devices,renderer:gpu.gpu.auxAttributes?.glRenderer},policyErrors:await page.evaluate(()=>window.policyErrors),errors,responses,
        limitations:['Headless desktop Chrome at desktop and phone-sized viewports; no real phone hardware.',
          'Cold isolated profile; open-to-data includes actual NASA grid retrieval and renderer load, not a stable network-independent guarantee.',
          'Memory samples are process-tree working sets, not exact simultaneous full-session peaks.',
          'Point-only performance path deliberately excludes field lookup; mandatory live field tests are recorded separately.',
          'Initial readiness means network idle plus enabled location controls and loaded country options; it is not a standardized time-to-interactive metric.',
          'Initial page weight sums observed decoded response bodies, including tiles; it is not compressed wire transfer or a full-site download size.',
          'Speech uses the labelled synthetic English test fixture as microphone input, not a real farmer or an accent/noise evaluation.',
          'preserveDrawingBuffer is enabled in this application for screenshot verification.']});
      console.log(JSON.stringify({viewport,openToDataMs,frameRate,memory:results.at(-1).memory.maxSampledWorkingSetBytes,errors}));
    }finally{await browser.close();await service.close();}
  }
  const assets=[];
  for(const name of ['maplibre-gl.mjs','maplibre-gl-shared.mjs','maplibre-gl-worker.mjs','maplibre-gl.css']){
    const bytes=await readFile(`dist/client/vendor/maplibre/${name}`);assets.push({name,rawBytes:bytes.length,gzipBytes:gzipSync(bytes).length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  await writeFile(`${directory}/benchmark.json`,JSON.stringify({results,assets},null,2));
}catch(error){await writeFile(`${directory}/failure.json`,JSON.stringify({error:error.stack,results},null,2));console.error(error);process.exitCode=1;}
finally{await new Promise(resolve=>app.close(resolve));}
