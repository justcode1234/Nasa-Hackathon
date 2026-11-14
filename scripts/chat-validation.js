// Shared browser assertions for the HTTP and worker delivery paths.
import assert from 'node:assert/strict';

export async function validateConversation({ evaluate, waitFor, fill, check }) {
  const last = 'document.querySelector("#chat-history article:last-child")';
  const ask = async question => {
    await fill('#question', question);
    await evaluate('document.querySelector("#ask").click()');
    await waitFor('document.querySelector("#answer-status").textContent.startsWith("Answer ready") && !document.querySelector("#ask").disabled');
  };
  const before = await evaluate('[document.querySelector("#pest-country").value,document.querySelector("#latitude").value,document.querySelector("#longitude").value]');
  await ask('hi');
  assert.match(await evaluate(`${last}.textContent`), /^AssistantHi!/);
  assert.equal(await evaluate(`${last}.querySelectorAll('p').length`), 1);
  assert.equal(await evaluate(`${last}.querySelectorAll('a').length`), 0);
  check('a greeting receives one brief friendly reply without scientific data or sources');

  await ask('tell me about kai lan from singapore');
  assert.match(await evaluate(`${last}.textContent`), /NParks.*Singapore/);
  assert.ok(await evaluate(`${last}.querySelectorAll('p').length <= 3`));
  assert.ok(await evaluate(`${last}.querySelectorAll('a[href*="nparks.gov.sg"]').length > 0`));
  assert.equal(await evaluate(`${last}.querySelector('details').open`), false);
  await evaluate(`${last}.querySelector('button').click()`);
  await waitFor(`${last}.textContent.includes('full sun') && !document.querySelector('#ask').disabled`);
  assert.doesNotMatch(await evaluate(`${last}.textContent`), /21–55|regional estimated gridded observation/i);
  check('kai lan in Singapore has traceable facts and a working focused growing-conditions follow-up');

  await ask('Tell me about rice in India');
  assert.match(await evaluate(`${last}.textContent`), /India.*FAOSTAT/);
  assert.doesNotMatch(await evaluate(`${last}.textContent`), /NASA|SoilGrids|Diamondback|nationally in/);
  const evidenceButton = await evaluate(`${last}.querySelector('[role=group]').children[2].textContent`);
  assert.equal(evidenceButton, 'Country evidence');
  await evaluate(`${last}.querySelector('[role=group]').children[2].click()`);
  await waitFor(`${last}.textContent.includes('nationally in') && !document.querySelector('#ask').disabled`);
  assert.match(await evaluate(`${last}.textContent`), /India: FAOSTAT records .* t of Rice nationally in 2024/);
  assert.match(await evaluate(`${last}.textContent`), /not field yield or a planting recommendation/);
  assert.deepEqual(await evaluate('[document.querySelector("#pest-country").value,document.querySelector("#latitude").value,document.querySelector("#longitude").value]'), before);
  check('a crop-country question and country-evidence follow-up work independently of the current map selection');

  await ask('Show me rainfall in India');
  assert.match(await evaluate(`${last}.textContent`), /choose a town or point there/);
  assert.doesNotMatch(await evaluate(`${last}.textContent`), /regional estimated gridded observation|latest non-missing/);
  check('asking about another country never appends the selected map location’s weather');
}

export async function validateGuidedWorkflow({ evaluate, waitFor, fill, check, capture }) {
  const last = 'document.querySelector("#chat-history article:last-child")';
  await evaluate('if(document.querySelector("#chat-panel").hidden)document.querySelector("#chat-toggle").click();document.querySelector("#unload-model").click();');
  const ask = async question => {
    await fill('#question', question); await evaluate('document.querySelector("#ask").click()');
    await waitFor('document.querySelector("#answer-status").textContent.startsWith("Answer ready") && !document.querySelector("#ask").disabled', 90_000);
  };
  await ask('Help me plan a rotation in India. Crops: rice, wheat, beans. Rainfed');
  assert.equal(await evaluate('document.querySelector("#pest-country").value'), 'IN');
  assert.equal(await evaluate('document.querySelector("#latitude").value'), '');
  assert.match(await evaluate(`${last}.textContent`), /Which part of India.*whole country/);
  assert.equal(await evaluate(`JSON.stringify([...${last}.querySelectorAll('button')].map(button=>button.textContent))`), JSON.stringify(['Whole India', 'A specific area']));
  assert.equal(await evaluate('document.querySelectorAll(".scenario").length'), 0);
  check('a country-only planning request asks which part or the whole country with both scope choices');

  await evaluate(`${last}.querySelector('button').click()`);
  await waitFor(`${last}.textContent.includes('Whole-country overview for India') && !document.querySelector('#ask').disabled`);
  assert.match(await evaluate(`${last}.textContent`), /Rice \(2024\).*Wheat \(2024\)/);
  assert.ok(await evaluate(`${last}.querySelector('a[href*="faostat"]') !== null`));
  assert.equal(await evaluate('document.querySelector("#latitude").value'), '');
  assert.equal(await evaluate('document.querySelector("#evidence-output").children.length'), 0);
  assert.equal(await evaluate('document.querySelectorAll(".scenario").length'), 0);
  check('Whole India shows dated national crop context without inventing country-wide NASA readings or a field comparison');

  await evaluate(`${last}.querySelector('button').click()`);
  await waitFor(`${last}.textContent.includes('Which state, region or town in India') && !document.querySelector('#ask').disabled`);
  await ask('Maharashtra');
  assert.match(await evaluate(`${last}.textContent`), /Which town or farmland in Maharashtra/);
  assert.equal(await evaluate('document.querySelector("#place-region").value'), '16');
  assert.equal(await evaluate('document.querySelector("#latitude").value'), '');
  check('choosing a specific area accepts a sourced Indian state and filters the town dropdown');

  await ask('at 18.5204, 73.8567');
  assert.match(await evaluate(`${last}.textContent`), /Step 4 is ready/);
  assert.equal(await evaluate('document.querySelector("#strategy").hidden'), false);
  assert.equal(await evaluate('document.querySelector("#pest-country").value'), 'IN');
  assert.equal(await evaluate('Number(document.querySelector("#latitude").value)'), 18.5204);
  assert.equal(await evaluate('document.querySelector("#irrigation").value'), 'rainfed');
  assert.equal(await evaluate('document.querySelectorAll(".scenario").length'), 3);
  assert.equal(await evaluate('document.querySelectorAll(".timeline>li").length'), 9);
  assert.match(await evaluate('document.querySelector(".scenario").textContent'), /Rice.*unknown.*Wheat.*unknown/s);
  assert.match(await evaluate('document.querySelector("#evidence-output").textContent'), /18\.5204°, 73\.8567°/);
  assert.match(await evaluate('document.querySelector("#model-status").textContent'), /No model loaded/);
  check('chat verifies explicit coordinates, enters supplied crops, retrieves real NASA data and executes comparison through step 4');
  if (capture) await capture();
  await evaluate('document.querySelector("#chat-close").click()');
}
