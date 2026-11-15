# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: help-and-explanations.spec.js >> 28 unexpected questions remain bounded and read-only with model off
- Location: tests\e2e\help-and-explanations.spec.js:10:33

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('#tab-location')
    - locator resolved to <button role="tab" tabindex="0" type="button" id="tab-location" aria-selected="true" aria-controls="location">01 · Find farmland</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <p>Try a question or guided plan:</p> from <aside id="chat-panel" class="chat-panel" aria-labelledby="chat-heading">…</aside> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <p>Try a question or guided plan:</p> from <aside id="chat-panel" class="chat-panel" aria-labelledby="chat-heading">…</aside> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    28 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <p>Try a question or guided plan:</p> from <aside id="chat-panel" class="chat-panel" aria-labelledby="chat-heading">…</aside> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Skip to planning" [ref=e2] [cursor=pointer]:
    - /url: "#main"
  - banner [ref=e3]:
    - heading "FieldShift" [level=1] [ref=e4]
    - paragraph [ref=e5]: Crop rotation evidence · Prototype · Local agronomic review required
    - tablist "Product modules" [ref=e6]:
      - tab "01 · Find farmland" [selected] [ref=e7] [cursor=pointer]
      - tab "02 · NASA evidence" [ref=e8] [cursor=pointer]
      - tab "03 · Plan crops" [ref=e9] [cursor=pointer]
      - tab "04 · Compare" [ref=e10] [cursor=pointer]
  - main [ref=e11]:
    - tabpanel "01 · Find farmland" [ref=e12]:
      - heading "01 · Find a place and explore mapped fields" [level=2] [ref=e13]
      - generic [ref=e14]:
        - text: How would you like to choose a location?
        - combobox "How would you like to choose a location?" [ref=e15]:
          - option "Choose from places or the map" [selected]
          - option "Enter coordinates"
      - generic [ref=e16]:
        - generic [ref=e17]:
          - text: Country
          - combobox "Country" [ref=e18]:
            - option "Choose a country" [selected]
            - option "Afghanistan"
            - option "Åland Islands"
            - option "Albania"
            - option "Algeria"
            - option "American Samoa"
            - option "Andorra"
            - option "Angola"
            - option "Anguilla"
            - option "Antarctica"
            - option "Antigua & Barbuda"
            - option "Argentina"
            - option "Armenia"
            - option "Aruba"
            - option "Australia"
            - option "Austria"
            - option "Azerbaijan"
            - option "Bahamas"
            - option "Bahrain"
            - option "Bangladesh"
            - option "Barbados"
            - option "Belarus"
            - option "Belgium"
            - option "Belize"
            - option "Benin"
            - option "Bermuda"
            - option "Bhutan"
            - option "Bolivia"
            - option "Bosnia & Herzegovina"
            - option "Botswana"
            - option "Bouvet Island"
            - option "Brazil"
            - option "British Indian Ocean Territory"
            - option "British Virgin Islands"
            - option "Brunei"
            - option "Bulgaria"
            - option "Burkina Faso"
            - option "Burundi"
            - option "Cambodia"
            - option "Cameroon"
            - option "Canada"
            - option "Cape Verde"
            - option "Caribbean Netherlands"
            - option "Cayman Islands"
            - option "Central African Republic"
            - option "Chad"
            - option "Chile"
            - option "China"
            - option "Christmas Island"
            - option "Cocos (Keeling) Islands"
            - option "Colombia"
            - option "Comoros"
            - option "Congo - Brazzaville"
            - option "Congo - Kinshasa"
            - option "Cook Islands"
            - option "Costa Rica"
            - option "Côte d’Ivoire"
            - option "Croatia"
            - option "Cuba"
            - option "Curaçao"
            - option "Cyprus"
            - option "Czechia"
            - option "Denmark"
            - option "Djibouti"
            - option "Dominica"
            - option "Dominican Republic"
            - option "Ecuador"
            - option "Egypt"
            - option "El Salvador"
            - option "Equatorial Guinea"
            - option "Eritrea"
            - option "Estonia"
            - option "Eswatini"
            - option "Ethiopia"
            - option "Falkland Islands (Islas Malvinas)"
            - option "Faroe Islands"
            - option "Fiji"
            - option "Finland"
            - option "France"
            - option "French Guiana"
            - option "French Polynesia"
            - option "French Southern Territories"
            - option "Gabon"
            - option "Gambia"
            - option "Georgia"
            - option "Germany"
            - option "Ghana"
            - option "Gibraltar"
            - option "Greece"
            - option "Greenland"
            - option "Grenada"
            - option "Guadeloupe"
            - option "Guam"
            - option "Guatemala"
            - option "Guernsey"
            - option "Guinea"
            - option "Guinea-Bissau"
            - option "Guyana"
            - option "Haiti"
            - option "Heard & McDonald Islands"
            - option "Honduras"
            - option "Hong Kong"
            - option "Hungary"
            - option "Iceland"
            - option "India"
            - option "Indonesia"
            - option "Iran"
            - option "Iraq"
            - option "Ireland"
            - option "Isle of Man"
            - option "Israel"
            - option "Italy"
            - option "Jamaica"
            - option "Japan"
            - option "Jersey"
            - option "Jordan"
            - option "Kazakhstan"
            - option "Kenya"
            - option "Kiribati"
            - option "Kuwait"
            - option "Kyrgyzstan"
            - option "Laos"
            - option "Latvia"
            - option "Lebanon"
            - option "Lesotho"
            - option "Liberia"
            - option "Libya"
            - option "Liechtenstein"
            - option "Lithuania"
            - option "Luxembourg"
            - option "Macao"
            - option "Madagascar"
            - option "Malawi"
            - option "Malaysia"
            - option "Maldives"
            - option "Mali"
            - option "Malta"
            - option "Marshall Islands"
            - option "Martinique"
            - option "Mauritania"
            - option "Mauritius"
            - option "Mayotte"
            - option "Mexico"
            - option "Micronesia"
            - option "Moldova"
            - option "Monaco"
            - option "Mongolia"
            - option "Montenegro"
            - option "Montserrat"
            - option "Morocco"
            - option "Mozambique"
            - option "Myanmar (Burma)"
            - option "Namibia"
            - option "Nauru"
            - option "Nepal"
            - option "Netherlands"
            - option "New Caledonia"
            - option "New Zealand"
            - option "Nicaragua"
            - option "Niger"
            - option "Nigeria"
            - option "Niue"
            - option "Norfolk Island"
            - option "North Korea"
            - option "North Macedonia"
            - option "Northern Mariana Islands"
            - option "Norway"
            - option "Oman"
            - option "Pakistan"
            - option "Palau"
            - option "Palestine"
            - option "Panama"
            - option "Papua New Guinea"
            - option "Paraguay"
            - option "Peru"
            - option "Philippines"
            - option "Pitcairn Islands"
            - option "Poland"
            - option "Portugal"
            - option "Puerto Rico"
            - option "Qatar"
            - option "Réunion"
            - option "Romania"
            - option "Russia"
            - option "Rwanda"
            - option "Samoa"
            - option "San Marino"
            - option "São Tomé & Príncipe"
            - option "Saudi Arabia"
            - option "Senegal"
            - option "Serbia"
            - option "Seychelles"
            - option "Sierra Leone"
            - option "Singapore"
            - option "Sint Maarten"
            - option "Slovakia"
            - option "Slovenia"
            - option "Solomon Islands"
            - option "Somalia"
            - option "South Africa"
            - option "South Georgia & South Sandwich Islands"
            - option "South Korea"
            - option "South Sudan"
            - option "Spain"
            - option "Sri Lanka"
            - option "St. Barthélemy"
            - option "St. Helena"
            - option "St. Kitts & Nevis"
            - option "St. Lucia"
            - option "St. Martin"
            - option "St. Pierre & Miquelon"
            - option "St. Vincent & Grenadines"
            - option "Sudan"
            - option "Suriname"
            - option "Svalbard & Jan Mayen"
            - option "Sweden"
            - option "Switzerland"
            - option "Syria"
            - option "Taiwan"
            - option "Tajikistan"
            - option "Tanzania"
            - option "Thailand"
            - option "Timor-Leste"
            - option "Togo"
            - option "Tokelau"
            - option "Tonga"
            - option "Trinidad & Tobago"
            - option "Tunisia"
            - option "Türkiye"
            - option "Turkmenistan"
            - option "Turks & Caicos Islands"
            - option "Tuvalu"
            - option "U.S. Outlying Islands"
            - option "U.S. Virgin Islands"
            - option "Uganda"
            - option "Ukraine"
            - option "United Arab Emirates"
            - option "United Kingdom"
            - option "United States"
            - option "Uruguay"
            - option "Uzbekistan"
            - option "Vanuatu"
            - option "Vatican City"
            - option "Venezuela"
            - option "Vietnam"
            - option "Wallis & Futuna"
            - option "Western Sahara"
            - option "Yemen"
            - option "Zambia"
            - option "Zimbabwe"
        - generic [ref=e19]:
          - generic [ref=e20]:
            - text: Region (optional filter)
            - combobox "Region (optional filter)" [disabled] [ref=e21]:
              - option "Choose a country first" [selected]
          - generic [ref=e22]:
            - text: Town / city
            - combobox "Town / city" [disabled] [ref=e23]:
              - option "Choose a country first" [selected]
        - status [ref=e24]: Choose a country to browse regions and towns. No place name is needed.
        - group [ref=e25]:
          - generic "Place-list coverage and source" [ref=e26] [cursor=pointer]
        - status [ref=e27]: Choose a country to see its recorded crops. A town or field gives a more precise planning location.
        - generic [ref=e28]:
          - generic [ref=e29]:
            - text: Town, region or country
            - textbox "Town, region or country" [ref=e30]:
              - /placeholder: "For example: Cambridge, UK"
          - button "Search places" [ref=e31] [cursor=pointer]
          - generic [ref=e32]:
            - text: Search results
            - combobox "Search results" [disabled] [ref=e33]:
              - option "Search for a place first" [selected]
        - status [ref=e34]: Search by name, use an example region, or pick a point on the map.
      - generic [ref=e35]:
        - generic [ref=e36]:
          - region "Location and mapped farmland. Fields can also be chosen using the dropdown." [ref=e37]:
            - generic:
              - generic [ref=e38]:
                - button "Zoom in" [ref=e39] [cursor=pointer]: +
                - button "Zoom out" [ref=e40] [cursor=pointer]: −
              - generic [ref=e41]:
                - link "Leaflet" [ref=e42] [cursor=pointer]:
                  - /url: https://leafletjs.com
                - text: "| ©"
                - link "OpenStreetMap" [ref=e47] [cursor=pointer]:
                  - /url: https://www.openstreetmap.org/copyright
                - text: contributors
          - button "Open 3D evidence map" [ref=e48] [cursor=pointer]
          - status [ref=e49]: Optional 3D downloads only when opened. The 2D map remains the default.
          - status [ref=e50]: No location selected. Click the map or enter coordinates below. Keyboard users can use the coordinate fields.
        - generic [ref=e51]:
          - generic [ref=e52]:
            - generic [ref=e53]:
              - generic [ref=e54]:
                - text: Historical reference year
                - spinbutton "Historical reference year" [ref=e55]: "2025"
              - generic [ref=e56]:
                - text: Explore an example farming region
                - combobox "Explore an example farming region" [ref=e57]:
                  - option "Choose a location" [selected]
                  - option "Cambridgeshire, United Kingdom"
                  - option "York, Western Australia"
                  - option "Farmland west of Ames, Iowa, USA"
                  - option "Farmland south of Naivasha, Kenya"
            - paragraph [ref=e58]:
              - text: When your location and reference year are ready, use
              - strong [ref=e59]: "Next: NASA evidence"
              - text: below.
          - button "Find mapped fields around selection" [ref=e60] [cursor=pointer]
          - generic [ref=e61]:
            - text: Mapped field
            - combobox "Mapped field" [disabled] [ref=e62]:
              - option "Load nearby fields first" [selected]
          - status [ref=e63]: Mapped fields are not a list of land available to rent or use.
          - group [ref=e64]:
            - generic "Map sources and scale" [ref=e65] [cursor=pointer]
  - navigation "Workflow steps" [ref=e66]:
    - button "Back" [disabled] [ref=e67]
    - 'button "Next: NASA evidence" [ref=e68] [cursor=pointer]': "Next: NASA evidence →"
  - contentinfo [ref=e69]:
    - paragraph [ref=e70]: Runs in your browser · no account needed
    - paragraph [ref=e71]:
      - text: Not affiliated with or endorsed by NASA.
      - link "Licences & credits" [ref=e72] [cursor=pointer]:
        - /url: /credits.html
    - paragraph [ref=e73]:
      - link "NASA POWER" [ref=e74] [cursor=pointer]:
        - /url: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
      - text: ·
      - link "© OpenStreetMap contributors" [ref=e75] [cursor=pointer]:
        - /url: https://www.openstreetmap.org/copyright
      - text: ·
      - link "Project & submission deck" [ref=e76] [cursor=pointer]:
        - /url: /submission/index.html
  - button "Open FieldShift assistant" [expanded] [ref=e77] [cursor=pointer]: Chat
  - complementary "FieldShift assistant" [ref=e78]:
    - generic [ref=e79]:
      - heading "FieldShift assistant" [level=2] [ref=e80]
      - button "Close assistant" [ref=e81] [cursor=pointer]: Close
    - group "Try an example" [ref=e82]:
      - paragraph [ref=e83]: "Try a question or guided plan:"
      - 'button "Crop facts: kai lan in Singapore" [ref=e84] [cursor=pointer]'
      - button "Plan tomatoes, cabbage and onions in India" [ref=e85] [cursor=pointer]
      - button "Why can't I choose a crop?" [ref=e86] [cursor=pointer]
    - group [ref=e87]:
      - generic "Assistant settings" [active] [ref=e88] [cursor=pointer]
    - log "Conversation" [ref=e89]:
      - paragraph [ref=e90]: Ask about a crop and country, such as “rice in India”. Or ask “help me plan a rotation in India” to select a field, enter your three crops, load NASA evidence and compare in step 4.
    - generic [ref=e91]:
      - generic [ref=e92]:
        - text: Message
        - textbox "Message" [ref=e93]:
          - /placeholder: Tell me about a crop in a country
      - button "Dictate a message in English" [ref=e94] [cursor=pointer]
      - button "Send" [ref=e97] [cursor=pointer]
    - status [ref=e98]: Answers include sources and limitations.
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import {readFileSync} from 'node:fs';
  3  | const prompts=JSON.parse(readFileSync(new URL('../qa/unexpected-prompts.json',import.meta.url),'utf8')).cases;
  4  | const fieldTransport=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
  5  | async function open(page){await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#catalog-status')).toContainText('Choose a country');}
> 6  | async function country(page,code){await page.locator('#tab-location').click();await page.locator('#location-method').selectOption('places');await page.locator('#pest-country').selectOption(code);if(code)await expect(page.locator('#country-status')).toContainText('crop production categories');else await expect(page.locator('#catalog-status')).toContainText('Choose a country');}
     |                                                                       ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  7  | async function ask(page,text){await page.locator('#question').fill(text);await page.locator('#ask').click();await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:60_000});const last=page.locator('#chat-history article').last();return {paragraphs:await last.locator(':scope>p').allTextContents(),links:await last.locator('a').evaluateAll(nodes=>nodes.map(n=>n.href))};}
  8  | const state=page=>page.evaluate(()=>({country:document.querySelector('#pest-country').value,latitude:document.querySelector('#latitude').value,longitude:document.querySelector('#longitude').value,baseline:[1,2,3].map(i=>document.querySelector('#baseline-'+i).value),scenarios:document.querySelectorAll('.scenario').length}));
  9  | 
  10 | for(const model of ['off','on'])test(`28 unexpected questions remain bounded and read-only with model ${model}`,async({page,context},info)=>{
  11 |   test.setTimeout(240_000);await context.route(fieldTransport,r=>r.abort('failed'));await open(page);await page.locator('#chat-toggle').click();
  12 |   if(model==='off'){await page.locator('#assistant-settings>summary').click();await page.locator('#unload-model').click();await page.locator('#assistant-settings>summary').click();}
  13 |   else await expect(page.locator('#model-status')).toContainText('Compact model ready',{timeout:60_000});
  14 |   const replies=[];
  15 |   try{for(const item of prompts){
  16 |     if(item.previousCountry){await country(page,item.previousCountry);await ask(page,item.previousQuestion);}
  17 |     if(item.country)await country(page,item.country);else if((await state(page)).country){await country(page,'');await expect(page.locator('#catalog-status')).toContainText('Choose a country');}
  18 |     const before=await state(page),text=item.repeatToLength?item.question.repeat(Math.ceil(item.repeatToLength/item.question.length)).slice(0,item.repeatToLength):item.question;
  19 |     const reply=await ask(page,text),body=reply.paragraphs.join(' ');replies.push({id:item.id,question:text,reply,before,after:await state(page)});
  20 |     expect(reply.paragraphs.length,item.id).toBeLessThanOrEqual(3);for(const pattern of item.checks)expect(body,item.id).toMatch(new RegExp(pattern,'i'));for(const pattern of item.forbidden??[])expect(body,item.id).not.toMatch(new RegExp(pattern,'i'));
  21 |     expect(await state(page),item.id+' must not execute planning actions').toEqual(before);
  22 |   }if(model==='on')expect(await page.evaluate(()=>window.fieldshiftModelSelections??0)).toBeGreaterThan(0);
  23 |   }finally{await info.attach(`Unexpected questions, model ${model}`,{body:Buffer.from(JSON.stringify(replies,null,2)),contentType:'application/json'});}
  24 | });
  25 | 
  26 | test('three visible starter buttons teach facts, guided India planning and crop-choice help',async({page,context})=>{
  27 |   await context.route(fieldTransport,r=>r.abort('failed'));await open(page);await page.locator('#chat-toggle').click();
  28 |   const examples=page.getByRole('group',{name:'Try an example'}).getByRole('button');await expect(examples).toHaveCount(3);await expect(page.locator('#assistant-settings')).not.toHaveAttribute('open');
  29 |   expect((await state(page)).country).toBe('');await expect(page.locator('#chat-history article')).toHaveCount(0);
  30 |   await examples.nth(0).click();await expect(page.locator('#answer-status')).toContainText('Answer ready');const fact=page.locator('#chat-history article').last();await expect(fact).toContainText('Kai lan');await expect(fact.locator('a').first()).toHaveAttribute('href',/nparks\.gov\.sg/);expect((await state(page)).country).toBe('');
  31 |   await examples.nth(1).click();await expect(page.locator('#answer-status')).toContainText('Answer ready');await expect(page.locator('#chat-history article').last()).toContainText('Which part of India');await expect(page.getByRole('button',{name:'Whole India',exact:true}).last()).toBeVisible();
  32 |   expect((await state(page)).latitude).toBe('');await examples.nth(2).click();await expect(page.locator('#answer-status')).toContainText('Answer ready');await expect(page.locator('#chat-history article').last()).toContainText('India');expect((await state(page)).scenarios).toBe(0);
  33 | });
  34 | 
  35 | test('Singapore skips unnamed regions and national scope never invents farm coordinates',async({page,context})=>{
  36 |   await context.route(fieldTransport,r=>r.abort('failed'));await open(page);await country(page,'SG');await expect(page.locator('#place-region').locator('..')).toBeHidden();await expect(page.locator('#place-town')).toBeEnabled();
  37 |   await page.locator('#chat-toggle').click();await ask(page,'Help me plan a rotation in Singapore. Crops: tomato, cabbage, onion');await page.getByRole('button',{name:'Whole Singapore',exact:true}).last().click();await expect(page.locator('#answer-status')).toContainText('Answer ready');
  38 |   await page.getByRole('button',{name:'Choose a town or field',exact:true}).click();await expect(page.locator('#answer-status')).toContainText('Answer ready');await expect(page.locator('#chat-history article').last()).toContainText('No named regions');expect((await state(page)).latitude).toBe('');expect((await state(page)).scenarios).toBe(0);
  39 | });
  40 | 
  41 | test('Åland official crop records enable baseline choices without inventing alternative screening rules',async({page},info)=>{
  42 |   await open(page);await country(page,'AX');await page.locator('#tab-si').click();await expect(page.locator('#baseline-1')).toBeEnabled();await expect(page.locator('[name=allowedCrops]')).toHaveCount(0);
  43 |   const values=await page.locator('#baseline-1 optgroup').last().locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));expect(values).toHaveLength(5);
  44 |   for(let i=1;i<=3;i++)await page.locator('#baseline-'+i).selectOption(values[i-1]);await page.locator('#soil-ph').fill('7.3');await expect(page.locator('#compare')).toBeDisabled();await page.locator('#chat-toggle').click();await page.locator('#chat-examples button').nth(2).click();await expect(page.locator('#answer-status')).toContainText('Answer ready');
  45 |   const reply=page.locator('#chat-history article').last();await expect(reply).toContainText('ÅSUB');await expect(reply).toContainText('2024');await expect(reply).toContainText('not evidence that no crops grow');await expect(reply.locator('a[href*="asub.ax"]')).toHaveCount(1);
  46 |   await page.locator('#chat-close').click();await page.locator('#flow-next').click();await expect(page.locator('#location')).toBeVisible();await page.locator('#tab-si').click();expect((await state(page)).baseline).toEqual(values.slice(0,3));await expect(page.locator('#soil-ph')).toHaveValue('7.3');
  47 |   await info.attach('Åland real source-backed baseline choices',{body:Buffer.from(JSON.stringify({choices:values,reply:await reply.textContent()},null,2)),contentType:'application/json'});
  48 | });
  49 | 
  50 | test('location methods, Next, temperature graphs and explicit alternative choices form one honest flow',async({page,context},info)=>{
  51 |   await context.route(fieldTransport,r=>r.abort('failed'));await open(page);await expect(page.locator('#pest-country')).toBeVisible();await expect(page.locator('#latitude')).toBeHidden();await expect(page.locator('#load-evidence')).toBeHidden();
  52 |   await page.locator('#location-method').selectOption('coordinates');await expect(page.locator('#pest-country')).toBeHidden();await expect(page.locator('#example-location')).toBeHidden();await expect(page.locator('#latitude')).toBeVisible();
  53 |   await page.locator('#latitude').fill('-31.89');await page.locator('#longitude').fill('116.77');await page.locator('#reference-year').fill('2025');await page.locator('#flow-next').click();await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded',{timeout:60_000});
  54 |   await expect(page.locator('#evidence-output figure')).toHaveCount(3);const c=Number(await page.locator('#evidence-output figure').first().locator('circle').first().getAttribute('data-value'));
  55 |   const rain=await page.locator('[data-evidence-month]').evaluateAll(nodes=>nodes.map(n=>n.dataset.rainSum));await page.locator('#temperature-unit').selectOption('F');
  56 |   const f=Number(await page.locator('#evidence-output figure').first().locator('circle').first().getAttribute('data-value'));expect(f).toBeCloseTo(c*9/5+32,8);await expect(page.locator('#evidence-output')).toContainText('°F');expect(await page.locator('[data-evidence-month]').evaluateAll(nodes=>nodes.map(n=>n.dataset.rainSum))).toEqual(rain);
  57 |   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download normalized evidence (JSON)',exact:true}).click();const evidence=JSON.parse(readFileSync(await (await download).path(),'utf8'));expect(evidence.parameters.T2M.units).toBe('C');expect(evidence.monthly[0].parameters.T2M.mean).toBeCloseTo(c,8);
  58 |   await page.locator('#flow-next').click();for(const [i,value] of ['bush-bean','unassessed:fao-526','unassessed:fao-515'].entries())await page.locator('#baseline-'+(i+1)).selectOption(value);
  59 |   await expect(page.locator('#compare')).toBeDisabled();await expect(page.locator('[name=allowedCrops][value="sweet-corn"]')).not.toBeChecked();await page.locator('#alternative-scope').selectOption('custom');
  60 |   await page.locator('[name=allowedCrops][value="bush-bean"]').check();await page.locator('[name=allowedCrops][value="pea"]').check();await page.locator('#compare').click();await expect(page.locator('.scenario')).toHaveCount(3);
  61 |   const baseline=page.locator('.scenario').first();await expect(baseline).toContainText('Apricots');await expect(baseline).toContainText('orchard');await expect(baseline).toContainText('Rosaceae');await page.getByText('Explain the comparison checks',{exact:true}).click();await expect(page.getByRole('region',{name:/Comparison explained/})).toContainText('Not comparable');await expect(page.getByRole('region',{name:/Comparison explained/})).toContainText('Not assessed: soil inputs');
  62 |   expect((await page.locator('.scenario').allTextContents()).join(' ')).not.toContain('Sweet corn');await expect(page.locator('meter')).toHaveCount(3);await expect(page.locator('meter').first()).toHaveAttribute('value','1');
  63 |   await info.attach('Converted chart and explained comparison',{body:Buffer.from(JSON.stringify({celsius:c,fahrenheit:f,rawUnits:evidence.parameters.T2M.units,baseline:await baseline.innerText()},null,2)),contentType:'application/json'});
  64 | });
  65 | 
  66 | test('chat and primary navigation never overlap and navigation aligns with main content',async({page},info)=>{
  67 |   const rows=[];for(const [width,height] of [[1366,768],[1280,1000],[390,844],[844,390],[683,384]]){await page.setViewportSize({width,height});await open(page);await country(page,'AX');await page.locator('#tab-si').click();await page.locator('.workflow-navigation').scrollIntoViewIfNeeded();
  68 |     await expect.poll(()=>page.evaluate(()=>{const bar=document.querySelector('.workflow-navigation').getBoundingClientRect(),launcher=document.querySelector('#chat-toggle').getBoundingClientRect();return Math.max(0,Math.min(launcher.bottom,bar.bottom)-Math.max(launcher.top,bar.top));})).toBe(0);
  69 |     await page.locator('#chat-toggle').click();
  70 |     const row=await page.evaluate(()=>{const bar=document.querySelector('.workflow-navigation').getBoundingClientRect(),chat=document.querySelector('#chat-panel').getBoundingClientRect(),main=document.querySelector('main'),m=main.getBoundingClientRect(),back=document.querySelector('#flow-back').getBoundingClientRect(),next=document.querySelector('#flow-next').getBoundingClientRect(),style=getComputedStyle(main);return{width:innerWidth,height:innerHeight,overlap:Math.max(0,Math.min(chat.bottom,bar.bottom)-Math.max(chat.top,bar.top)),left:back.left-(m.left+parseFloat(style.paddingLeft)),right:next.right-(m.left+main.clientWidth-parseFloat(style.paddingRight)),overflow:document.documentElement.scrollWidth>innerWidth};});rows.push(row);expect(row.overlap).toBe(0);expect(Math.abs(row.left)).toBeLessThan(3);expect(Math.abs(row.right)).toBeLessThan(3);expect(row.overflow).toBe(false);
  71 |   }await info.attach('Navigation and chat geometry',{body:Buffer.from(JSON.stringify(rows,null,2)),contentType:'application/json'});
  72 | });
  73 | 
  74 | test('voice download can be cancelled before permission or network access',async({page})=>{
  75 |   await open(page);await page.locator('#chat-toggle').click();await page.evaluate(()=>{window.micRequests=0;navigator.mediaDevices.getUserMedia=()=>{window.micRequests++;return Promise.reject(new DOMException('denied','NotAllowedError'));};});
  76 |   await page.locator('#mic').click();await expect(page.locator('#speech-consent')).toContainText('70 MB');expect(await page.evaluate(()=>window.micRequests)).toBe(0);await page.locator('#cancel-dictation').click();
  77 |   expect(await page.evaluate(()=>window.micRequests)).toBe(0);expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/huggingface|hf\.co|transformers/.test(e.name)).length)).toBe(0);await expect(page.locator('#mic')).toBeFocused();
  78 | });
  79 | 
  80 | test('closing chat while microphone permission is pending stops a late grant without starting speech downloads',async({page})=>{
  81 |   await open(page);await page.locator('#chat-toggle').click();await page.locator('#question').fill('keep this draft');
  82 |   await page.evaluate(()=>{window.stoppedTracks=0;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.resolveMicrophone=resolve);});
  83 |   await page.locator('#mic').click();await page.locator('#start-dictation').click();await expect(page.locator('#mic')).toBeDisabled();await page.locator('#chat-close').click();
  84 |   await page.evaluate(()=>window.resolveMicrophone({getTracks:()=>[{stop(){window.stoppedTracks++;}}]}));await page.waitForFunction(()=>window.stoppedTracks===1);
  85 |   expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/huggingface|hf\.co|transformers/.test(e.name)).length)).toBe(0);await expect(page.locator('#question')).toHaveValue('keep this draft');
  86 | });
  87 | 
```