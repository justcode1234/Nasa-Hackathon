import {test,expect} from '@playwright/test';

// The chat panel is fixed above the workflow navigation and its width comes from `100vw`, so the
// smallest phones and a landscape phone are where it can overflow first. Measured 18 Nov at 320×568
// and 568×320: no horizontal page overflow, the panel stayed inside the viewport and clear of the
// navigation, and every choice was at least 44 px high. No test pinned any of that, so a later CSS
// change could reintroduce an off-screen button without failing the gate. This walks the same
// Singapore flow the chat-only spec uses and asserts the geometry at both sizes.
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const ready=page=>page.locator('#answer-status').filter({hasText:/Answer ready|Step 4 is ready/}).waitFor({timeout:120_000});
const last=page=>page.locator('#chat-history article').last();
test.use({viewport:{width:320,height:568},isMobile:true,hasTouch:true});

async function fits(page,label,width){
  // The ResizeObserver repositions the fixed panel after a viewport change; two frames is the same
  // wait a person's eye gives it, and the assertion is about the settled layout.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const data=await page.evaluate(()=>{
    const panel=document.querySelector('#chat-panel').getBoundingClientRect();
    const bar=document.querySelector('.workflow-navigation').getBoundingClientRect();
    const reply=document.querySelector('#chat-history article:last-child');
    return {innerWidth,innerHeight,docWidth:document.documentElement.scrollWidth,
      panel:{left:panel.left,right:panel.right,bottom:panel.bottom},
      bar:{top:bar.top},
      buttons:[...reply.querySelectorAll('button[data-chat-choice]')].map(button=>{
        const rect=button.getBoundingClientRect();return {text:button.textContent.trim(),left:rect.left,right:rect.right,height:rect.height};})};
  });
  expect(data.docWidth,`${label}: the page must not scroll sideways`).toBeLessThanOrEqual(width);
  expect(data.panel.left,`${label}: panel left edge`).toBeGreaterThanOrEqual(0);
  expect(data.panel.right,`${label}: panel right edge`).toBeLessThanOrEqual(width+0.5);
  // While the navigation bar is on screen the panel has to sit above it, or the step buttons it
  // frames would be covered by the chat.
  if(data.bar.top>0&&data.bar.top<data.innerHeight)expect(data.panel.bottom,`${label}: panel bottom vs navigation`).toBeLessThanOrEqual(data.bar.top+1);
  expect(data.buttons.length,`${label}: the reply offers its choices`).toBeGreaterThan(0);
  for(const button of data.buttons){
    expect(button.left,`${label}: “${button.text}” left edge`).toBeGreaterThanOrEqual(0);
    expect(button.right,`${label}: “${button.text}” right edge`).toBeLessThanOrEqual(width+0.5);
    expect(button.height,`${label}: “${button.text}” target height`).toBeGreaterThanOrEqual(24);
  }
}

test('the chat panel and its choices fit a 320 px phone and a landscape phone',async({page,context})=>{
  test.setTimeout(180_000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.route(fields,route=>route.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  await page.locator('#question').fill('Help me plan a rotation in Singapore');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await ready(page);
  await expect(last(page)).toContainText('Which part of Singapore');
  await fits(page,'scope prompt at 320×568',320);

  await last(page).locator('button[data-chat-choice]').filter({hasText:/^A specific area$/}).click();
  await ready(page);
  await expect(last(page)).toContainText(/no named regions/i);
  await fits(page,'town prompt at 320×568',320);

  await page.setViewportSize({width:568,height:320});
  await fits(page,'town prompt at 568×320',568);

  const label=(await last(page).locator('button[data-chat-choice]').first().textContent()).trim();
  await last(page).locator('button[data-chat-choice]').filter({hasText:new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)}).click();
  await ready(page);
  await expect(last(page)).toContainText(`${label} is selected as a town point`);
  await fits(page,'field prompt at 568×320',568);
  // "Use selected point" is the control that finishes the plan, so the portrait phone checks it too.
  await page.setViewportSize({width:320,height:568});
  await fits(page,'field prompt at 320×568',320);
  expect(errors).toEqual([]);
});

// The panel is height-capped and scrolls itself, so growing the history can push the controls that
// stay put on a desktop out of its visible edge. Measured before the fix at 320×568: after one reply
// the message box sat at y=329 while the panel ended at y=307, and the status line was at y=385;
// both invisible. On a failed request the status line is the only place the error appears.
test('a reply keeps the message box and the status line inside the visible panel',async({page,context})=>{
  test.setTimeout(180_000);
  await context.route(fields,route=>route.abort('failed'));
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const visible=async label=>{
    await settle();
    const data=await page.evaluate(()=>{
      const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
      const panel=document.querySelector('#chat-panel').getBoundingClientRect();
      return {innerWidth,innerHeight,panel:{top:panel.top,bottom:panel.bottom},question:rect('#question'),send:rect('#ask'),status:rect('#answer-status'),statusText:document.querySelector('#answer-status').textContent};
    });
    for(const [part,box] of [['message box',data.question],['Send button',data.send],['status line',data.status]]){
      expect(box.top,`${label}: ${part} top is below the panel's top edge`).toBeGreaterThanOrEqual(data.panel.top-0.5);
      expect(box.bottom,`${label}: ${part} bottom is below the panel's visible edge`).toBeLessThanOrEqual(data.panel.bottom+0.5);
      expect(box.left,`${label}: ${part} left edge`).toBeGreaterThanOrEqual(0);
      expect(box.right,`${label}: ${part} right edge`).toBeLessThanOrEqual(data.innerWidth+0.5);
    }
    return data;
  };
  const ask=async text=>{await page.locator('#question').fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();await ready(page);};
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  await ask('thanks');
  expect((await visible('one reply at 320×568')).statusText).toContain('Answer ready');
  await page.setViewportSize({width:568,height:320});
  await visible('one reply at 568×320');
  await ask('thanks');await ask('thanks');await ask('thanks');await ask('thanks');await ask('thanks');
  expect((await visible('six replies at 568×320')).statusText).toContain('Answer ready');
});
