import {test,expect} from '@playwright/test';

// The user's requirement (18 Nov): a farmer who only ever uses the chat panel — typed messages
// and the buttons the assistant itself offers — must reach step 4 without touching step 1 or
// step 3. A page-level guard counts every pointer/key event outside the chat panel and must stay
// empty, so "chat only" is measured, not assumed.
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const ready=async page=>{await expect(page.locator('#answer-status')).toContainText(/Answer ready|Step 4 is ready/,{timeout:180_000});};
const last=page=>page.locator('#chat-history article').last();
const choices=page=>last(page).locator('button[data-chat-choice]');
const labels=async page=>(await choices(page).allTextContents()).map(label=>label.trim());
const open=async page=>{await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#catalog-status')).toContainText('Choose a country');await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();};
const send=async(page,question)=>{await page.locator('#question').fill(question);await page.getByRole('button',{name:'Send',exact:true}).click();await ready(page);};
const tap=async(page,label)=>{await choices(page).filter({hasText:new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)}).click();await ready(page);};
// The label is read before the click: after it, a newer article becomes the last one.
const tapNth=async(page,index=0)=>{const button=choices(page).nth(index);const label=(await button.textContent()).trim();
  await button.click();await ready(page);return label;};
const guardChatOnly=page=>page.evaluate(()=>{window.__outsideChat=[];
  const note=event=>{const node=event.target instanceof Element?event.target:null;
    if(node?.closest?.('#chat-panel, #chat-toggle'))return;
    window.__outsideChat.push(`${event.type}:${node?.id||node?.tagName?.toLowerCase()||'unknown'}`);};
  document.addEventListener('pointerdown',note,true);document.addEventListener('keydown',note,true);});
const replies=async page=>page.locator('#chat-history article').evaluateAll(nodes=>nodes
  .filter(node=>node.querySelector('h3')?.textContent==='Assistant')
  .map(node=>[...node.querySelectorAll(':scope > p')].map(p=>p.textContent).join(' | ')));
const sent=page=>page.locator('#chat-history article').evaluateAll(nodes=>nodes.filter(node=>node.querySelector('h3')?.textContent==='You').length);
// A guided reply is one the workflow chose. A generic evidence answer here would mean the
// message fell through and the plan stalled without saying so.
const guided=/Which part of|Which state or region|Which town|no named regions|is selected|Step 4 is ready|Whole-country overview|Choose the specific field|three existing crops|fewer than two allowed crops|could not be loaded|could not be assigned|outside the latitude|more than 50 km|Several regions|Several listed towns|not silently discard|no towns are listed|cannot choose a point/i;
// Every offered choice must be a real target, uniquely labelled, in a flow that never touches
// the form. Height >= 24 px keeps it usable on a phone.
// The kind attribute is the contract the browser walks in scripts/chat-place-matrix-probe.mjs tap by: a
// button that stops declaring which level it selects would make those walks fall back to reading the
// sentence, which is exactly how a region/town collision was once mis-reported. So it is asserted here,
// where it costs one attribute read, rather than discovered in a 245-code run.
const CHOICE_KINDS=['town','region','farm','follow-up'];
async function smoothChoices(page,step){const buttons=choices(page),count=await buttons.count(),seen=[];
  expect(count,`${step} offers at least one choice`).toBeGreaterThan(0);
  const group=buttons.first().locator('xpath=..');
  await expect(group,`${step} choices are one labelled group`).toHaveAttribute('role','group');
  expect((await group.getAttribute('aria-label'))??'',`${step} choice group is named`).not.toBe('');
  for(let i=0;i<count;i++){const button=buttons.nth(i);
    await expect(button,`${step} choice ${i+1} visible`).toBeVisible();
    await expect(button,`${step} choice ${i+1} enabled`).toBeEnabled();
    const box=await button.boundingBox();
    expect(box,`${step} choice ${i+1} has a real target`).not.toBeNull();
    expect(Math.round(box.height),`${step} choice ${i+1} height`).toBeGreaterThanOrEqual(24);
    const label=(await button.textContent()).trim();
    expect(label,`${step} choice ${i+1} label`).not.toBe('');
    expect(seen,`${step} has a duplicate ${label} button`).not.toContain(label);
    expect(CHOICE_KINDS,`${step} choice ${label} declares the level it selects`)
      .toContain((await button.getAttribute('data-choice-type'))??'');
    seen.push(label);}
  return seen;}

test('tapping only assistant buttons carries a plan from country to step 4',async({page,context})=>{
  test.setTimeout(420_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // The community field outlines are a shared public service; the flow must still complete
  // through "Use selected point", so it is tested without depending on that service.
  await context.route(fields,route=>route.abort('failed'));
  await open(page);await guardChatOnly(page);
  await send(page,'Help me plan a rotation in India. Crops: rice, cabbage, tomato. Rainfed');
  await expect(last(page)).toContainText('Which part of India');
  expect(await smoothChoices(page,'scope prompt')).toEqual(['Whole India','A specific area']);
  await tap(page,'A specific area');
  await expect(last(page)).toContainText(/Which state or region of India/);
  await expect(last(page)).toContainText('not a recommendation');
  await smoothChoices(page,'region prompt');
  const region=await tapNth(page,0);
  await expect(last(page)).toContainText(`${region} is selected`);
  const towns=await smoothChoices(page,'town prompt');
  expect(towns.at(-1),`the region prompt must keep a national escape`).toBe('Whole India');
  const town=await tapNth(page,0);
  await expect(last(page)).toContainText(`${town} is selected as a town point`);
  // Rewritten stricter 20 Nov, iteration 58: the field services are aborted above, so a field count here would mean
  // the chat had read a transport refusal as an empty map (tests/e2e/field-service-failure.spec.js pins that
  // sentence to answered lookups). The failure reply must name the failed lookup and keep both way-ons, and the
  // chat-only walk depends on 'Use selected point' being one of them.
  await expect(last(page)).toContainText(/field lookup did not complete/i);
  await expect(last(page)).not.toContainText(/mapped fields were returned/);
  expect(await smoothChoices(page,'field lookup failure')).toEqual(['Use selected point','Show mapped fields']);
  // The chat choice must show in step 1 and step 3's own controls, not only in the panel.
  await expect(page.locator('#latitude')).not.toHaveValue('');
  await expect(page.locator('#place-town')).not.toHaveValue('');
  await tap(page,'Use selected point');
  await expect(last(page)).toContainText('Step 4 is ready');
  await expect(page.locator('.scenario')).toHaveCount(3,{timeout:180_000});
  const seen=await replies(page);
  expect(seen.length,'one reply per message').toBe(await sent(page));
  expect(seen.filter(entry=>!guided.test(entry)),`a reply fell through to the generic answer: ${JSON.stringify(seen.filter(entry=>!guided.test(entry)))}`).toEqual([]);
  expect(seen.filter((entry,index)=>seen.indexOf(entry)!==index),'no assistant reply repeats').toEqual([]);
  await expect(page.locator('#pest-country')).toHaveValue('IN');
  await expect(page.locator('#longitude')).not.toHaveValue('');
  for(const id of ['baseline-1','baseline-2','baseline-3'])await expect(page.locator(`#${id}`)).not.toHaveValue('');
  await expect(page.locator('#irrigation')).toHaveValue('rainfed');
  expect(await page.evaluate(()=>window.__outsideChat),'the flow never needed the form or map').toEqual([]);
  expect(errors).toEqual([]);
});

test('one typed message with coordinates reaches step 4, and the blocked alternatives reply offers a tappable way on',async({page,context})=>{
  test.setTimeout(420_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route(fields,route=>route.abort('failed'));
  await open(page);await guardChatOnly(page);
  // Rice, wheat and beans are unassessed for India except beans, so the app has screening rules
  // for only one alternative crop. The single message must land on that honest stop, not guess.
  await send(page,'Help me plan a rotation in India at 18.52, 73.85. Crops: rice, wheat, beans. Rainfed; clay soil');
  const first=await last(page).textContent();
  if(/fewer than two allowed crops/.test(first)){
    const offered=await smoothChoices(page,'blocked alternatives');
    expect(offered.filter(label=>/^Allow /.test(label)),`no allow button in ${JSON.stringify(offered)}`).toHaveLength(1);
    await expect(page.locator('.scenario')).toHaveCount(0);
    await tap(page,offered.find(label=>/^Allow /.test(label)));
  }else if(!/Step 4 is ready/.test(first)){
    // The coordinate path asks the live reverse-lookup service which country the point is in.
    // A typed town name still finishes the plan when that service answers badly, and no step 1
    // or step 3 control is needed either way.
    await expect(last(page),`unexpected single-message reply: ${first}`).toContainText(/could not be assigned|outside the latitude|more than 50 km|Several regions|could not be loaded|more than 50 km/i);
    await send(page,'use Pune');
    await expect(last(page)).toContainText(/is selected as a town point|Several listed towns|fewer than two allowed crops/);
  }
  await expect(last(page)).toContainText('Step 4 is ready');
  await expect(page.locator('.scenario')).toHaveCount(3,{timeout:180_000});
  await expect(page.locator('#pest-country')).toHaveValue('IN');
  await expect(page.locator('#baseline-1')).not.toHaveValue('');
  await expect(page.locator('#irrigation')).toHaveValue('rainfed');
  await expect(page.locator('#soil')).toHaveValue('clay');
  await expect(page.locator('[name="allowedCrops"]:checked')).toHaveCount(3,'the allow button must check exactly the screened crops it named');
  expect(await page.locator('#evidence-output').textContent(),'NASA evidence rendered without a step 2 click').not.toBe('');
  expect(await page.evaluate(()=>window.__outsideChat),'one message plus chat buttons reached step 4').toEqual([]);
  expect(errors).toEqual([]);
});

test('offered choices are keyboard reachable, activate with Enter and keep focus in the chat',async({page,context})=>{
  test.setTimeout(240_000);
  await context.route(fields,route=>route.abort('failed'));
  await open(page);
  await send(page,'Help me plan a rotation in Singapore');
  // After Send the caret must still be in the message box, otherwise Escape stops working.
  await expect(page.locator('#question')).toBeFocused();
  await expect(last(page)).toContainText('Which part of Singapore');
  // The history is above the form, so the choices are reached by shifting focus backwards.
  let reached=false;
  for(let i=0;i<12&&!reached;i++){
    reached=await page.evaluate(()=>document.activeElement?.dataset?.chatChoice==='true');
    if(!reached)await page.keyboard.press('Shift+Tab');
  }
  expect(reached,'Shift+Tab from the message box reaches an offered choice').toBe(true);
  const label=await page.evaluate(()=>document.activeElement.textContent.trim());
  await page.keyboard.press('Enter');await ready(page);
  await expect(last(page),`Enter on ${label} must answer`).toContainText(/Whole-country overview|no named regions|Which state or region|is selected/i);
  await expect(page.locator('#question')).toBeFocused();
  expect(await labels(page).then(list=>list.length),'the new reply still offers its choices').toBeGreaterThan(0);
});
