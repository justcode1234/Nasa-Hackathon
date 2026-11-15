import { el, list, sourceLinks } from '../lib/dom.js';

export function renderCatalog(catalog, country = null, taggedCrops = []) {
  const ids = new Set(country?.screeningCropIds ?? []);
  document.querySelector('#catalog-status').textContent = country?.country ?
    `${country.countryName}: ${country.records.length} recorded crop categories; ${ids.size} have starter screening rules. Choose from this country's list. ${ids.size < 2 ? 'At least two crops with rules are needed to compare alternatives; this country currently has insufficient screening coverage.' : ''}` :
    'Choose a country or named place in step 01. Crop dropdowns stay empty until country evidence is available.';
  const choices = document.querySelector('#allowed-crops');
  const records = document.querySelector('#crop-records');
  choices.replaceChildren(); records.replaceChildren();
  document.querySelector('#allowed-crop-status').textContent = !country?.country ? 'Choose a country in step 01 to see available alternatives.' : ids.size === 0 ?
    `No alternatives are available for ${country.countryName}: none of its recorded crop categories currently have screening rules in this prototype. Filling more farm details will not enable comparison. You can still inspect NASA evidence, or choose another location.` : ids.size === 1 ?
    `Only one crop has screening rules for ${country.countryName}; comparison needs at least two. This is a coverage gap, not a missing selection.` :
    'Select at least two of these sourced screening crops. Unsupported baseline crops remain unassessed.';
  updateCropChoices(catalog, taggedCrops, country);
  catalog.crops.filter(crop => ids.has(crop.id)).forEach(crop => {
    const label = el('label');
    const input = el('input', null, { type: 'checkbox', name: 'allowedCrops', value: crop.id });
    input.checked = true;
    label.append(input, crop.name);
    choices.append(label);
    const article = el('article');
    article.append(el('h4', `${crop.name} · ${crop.family}`), el('p', `Sourced maturity range: ${crop.maturityDays.join('–')} days. Frost-tender: ${crop.frostTender ? 'yes' : 'no quantified cold-survival rule'}.`),
      list(crop.notes), sourceLinks(crop.sourceIds, catalog.sources));
    records.append(article);
  });
  const evidence = document.querySelector('#country-crop-output');
  evidence.replaceChildren();
  if (country?.country) {
    evidence.append(el('p', `${country.countryName} · FAOSTAT national production snapshot · retrieved ${country.source.retrievedAt}. Tonnes are national annual production, not a farm forecast.`),
      list(country.notices), sourceLinks(['faostat-qcl'], [country.source]), el('p', country.source.citation));
    const rows = el('ul');
    country.records.forEach(record => rows.append(el('li', `${record.name}: ${record.tonnes.toLocaleString('en-US')} t · ${record.year} · ${record.flagDescription}${record.note ? ` · ${record.note}` : ''}`)));
    evidence.append(rows, el('a', 'FAO data licence and terms', { href: country.source.termsUrl, target: '_blank', rel: 'noreferrer' }));
  }
}

export function updateCropChoices(catalog, taggedCrops = [], country = null) {
  for (const id of ['baseline-1', 'baseline-2', 'baseline-3', 'previous-crop']) {
    const select = document.getElementById(id), previous = select.value;
    select.replaceChildren(el('option', id === 'previous-crop' ? 'Unknown / not supplied' : country?.choices.length || taggedCrops.length ? 'Choose a recorded crop' : 'Choose a country in step 01', { value: '' }));
    if (taggedCrops.length) {
      const group = el('optgroup', null, { label: 'Recorded on selected field (unassessed map tags)' });
      taggedCrops.forEach(crop => group.append(el('option', `${crop.replaceAll('_', ' ')} — mapped tag`, { value: `recorded:${crop}` })));
      select.append(group);
    }
    for (const supported of [true, false]) {
      const group = el('optgroup', null, { label: supported ? 'Recorded crop category · starter screening rules' : 'Recorded country crops · no screening rules yet' });
      (country?.choices ?? []).filter(c => Boolean(c.screeningId) === supported).forEach(c => group.append(el('option', c.name, { value: c.id })));
      if (group.children.length) select.append(group);
    }
    select.disabled = !country?.choices.length && !taggedCrops.length;
    if ([...select.options].some(o => o.value === previous)) select.value = previous;
  }
}

export function renderAnswer(answer) {
  const root = document.querySelector('#answer-output');
  root.replaceChildren(el('h4', answer.question), el('p', `Mode: ${answer.mode}`));
  answer.blocks.forEach(block => {
    root.append(el('p', `${block.kind}: ${block.text}`));
    if (block.sourceIds.length) root.append(sourceLinks(block.sourceIds, answer.sources));
  });
}
