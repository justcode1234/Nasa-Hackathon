import { defineConfig } from '@playwright/test';
const remote=process.env.TEST_BASE_URL;
// The pair of isolated servers must agree with scripts/playwright-server.js; E2E_PORT exists because
// another project on this machine can already own 4173.
const staticPort=Number(process.env.E2E_PORT ?? 4173);
const nodePort=Number(process.env.E2E_PORT_NODE ?? staticPort+1);
const staticURL=`http://127.0.0.1:${staticPort}`, nodeURL=`http://127.0.0.1:${nodePort}`;
if(remote&&new URL(remote).protocol!=='https:')throw new Error('Public Playwright target must use HTTPS');
export default defineConfig({
  testDir:'./tests/e2e',fullyParallel:false,workers:1,retries:0,timeout:90_000,
  expect:{timeout:15_000},outputDir:'artifacts/playwright/test-results',
  reporter:[['list',{printSteps:true}],['json',{outputFile:'artifacts/playwright/results.json'}],['html',{outputFolder:'artifacts/playwright/report',open:'never'}]],
  use:{browserName:'chromium',channel:process.env.PLAYWRIGHT_CHANNEL??'chrome',headless:true,actionTimeout:15_000,navigationTimeout:30_000,
    trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:remote?[
    {name:'public-desktop',use:{baseURL:remote,viewport:{width:1280,height:1000}}},
    {name:'public-mobile',use:{baseURL:remote,viewport:{width:390,height:844},isMobile:true,hasTouch:true}}
  ]:[
    {name:'static-desktop',use:{baseURL:staticURL,viewport:{width:1280,height:1000}}},
    {name:'static-mobile',use:{baseURL:staticURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:'node-desktop',use:{baseURL:nodeURL,viewport:{width:1280,height:1000}}},
    {name:'node-mobile',use:{baseURL:nodeURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true}}
  ],
  webServer:remote?undefined:[
    {command:'node scripts/playwright-server.js',url:staticURL,reuseExistingServer:false},
    {command:'node scripts/playwright-server.js --node',url:nodeURL,reuseExistingServer:false}
  ]
});
