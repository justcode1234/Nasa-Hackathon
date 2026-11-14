import { catalog, mentionedCrops, ambiguousCornQuestion, cornScopeNotice } from './catalog.js';
import knowledge from './knowledge.json' with { type: 'json' };
import { getCountryCrops, cropItems } from '../context/crops.js';
import { COUNTRY_CODES, COUNTRY_NAMES, findCountries } from '../../public/js/lib/countries.js';

const normal = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const contains = (text, phrase) => (` ${text} `).includes(` ${normal(phrase)} `);
const itemAliases = { '27': ['rice', 'paddy'], '15': ['wheat'], '56': ['maize', 'corn', 'grain maize', 'field corn'],
  '236': ['soybean', 'soybeans', 'soya bean', 'soya beans'], '388': ['tomato', 'tomatoes'], '116': ['potato', 'potatoes'],
  '358': ['cabbage', 'cabbages'], '430': ['okra', 'ladies finger'], '122': ['sweet potato', 'sweet potatoes'],
  '656': ['coffee'], '661': ['cocoa', 'cacao'], '667': ['tea'], '125': ['cassava', 'tapioca'],
  '571': ['mango', 'mangoes', 'guava', 'guavas', 'mangosteen', 'mangosteens'], '328': ['cotton'],
  '486': ['banana', 'bananas'], '490': ['orange', 'oranges'], '515': ['apple', 'apples'], '600': ['papaya', 'papayas'] };
const commodityMatches = cropItems.flatMap(item => [...new Set([item.name, item.name.split(',')[0], ...(itemAliases[item.id] ?? [])])]
  .filter(alias => !/^(other|mixed|edible)\b/i.test(alias)).map(alias => ({ item, alias: normal(alias) })))
  .sort((a, b) => b.alias.length - a.alias.length);

export function questionTopic(question) {
  const text = normal(question);
  if (/\b(weather|nasa|temperature|rainfall|precipitation|solar|frost)\b/.test(text)) return 'weather';
  if (/\b(harvest|matur|duration|long|germinat)/.test(text)) return 'harvest';
  if (/\b(water|irrigat|watering|drought)/.test(text)) return 'water';
  if (/\b(rotation|rotate|family|families|pest|disease)/.test(text)) return 'rotation';
  if (/\b(grow|growing|conditions|soil|sun|planting|climate)/.test(text) && !/\btell me about\b/.test(text)) return 'conditions';
  if (/\b(production|tonnes|tons|statistics|how much|yield|data)/.test(text)) return 'production';
  return 'overview';
}

export function answerConversation(question, { country: selectedCountry = '', context = null } = {}) {
  const text = normal(question);
  if (/^(hi|hi there|hello|hello there|hey|good morning|good afternoon|good evening)$/.test(text)) {
    return { schemaVersion: 1, mode: 'deterministic conversational greeting', question, topic: 'greeting',
      blocks: [{ kind: 'greeting', text: 'Hi! What crop and country would you like to explore?', sourceIds: [] }], sources: [],
      followUps: [{ label: 'Rice in India', question: 'Tell me about rice in India' },
        { label: 'Kai lan in Singapore', question: 'Tell me about kai lan in Singapore' }] };
  }
  if (/^(thanks|thank you|thank you very much|cheers)$/.test(text)) return {
    schemaVersion: 1, mode: 'deterministic conversational reply', question, topic: 'greeting',
    blocks: [{ kind: 'conversation', text: 'You’re welcome! Ask about another crop, country or part of your rotation whenever you’re ready.', sourceIds: [] }], sources: [], followUps: [] };
  const countries = findCountries(text);
  if (countries.length > 1) {
    const crop = knowledge.profiles.find(profile => profile.aliases.some(alias => contains(text, alias)))?.name ??
      mentionedCrops(question)[0]?.name ?? commodityMatches.find(entry => contains(text, entry.alias))?.item.name;
    return {
    schemaVersion: 1, mode: 'deterministic conversational clarification', question, topic: 'clarification', useSelectedLocation: false,
    blocks: [{ kind: 'clarification', text: `Which country should I focus on first: ${countries.map(code => COUNTRY_NAMES.of(code)).join(' or ')}?`, sourceIds: [] }],
    sources: [], followUps: countries.slice(0, 3).map(code => ({ label: COUNTRY_NAMES.of(code), question: `Tell me about ${crop ?? 'a crop'} in ${COUNTRY_NAMES.of(code)}` })) };
  }
  const explicitCountry = countries[0];
  const knownContext = context && typeof context === 'object' && typeof context.cropKey === 'string' && context.cropKey.length < 80 ? context : null;
  const country = explicitCountry ?? (knownContext?.country && COUNTRY_CODES.includes(knownContext.country) ? knownContext.country :
    COUNTRY_CODES.includes(selectedCountry) ? selectedCountry : '');
  let profile = knowledge.profiles.find(profile => profile.aliases.some(alias => contains(text, alias)));
  let starter = mentionedCrops(question)[0];
  if (/\b(dry beans|kidney beans|dry peas|split peas|field peas|soy|soya|chick peas|chickpeas|cocoa|cacao|coffee|pigeon peas|cow peas)\b/.test(text)) starter = null;
  let item = commodityMatches.find(entry => contains(text, entry.alias))?.item;
  const topic = questionTopic(question);
  const followUp = /^(and |what about |how about |what (?:are|is|does|do|water)|how (?:long|much)|when |where |can (?:i|it)|does it|its |it |grow|harvest|rotation|water|soil|production|country|weather|rain|show me)/.test(text) ||
    countries.some(code => text === normal(COUNTRY_NAMES.of(code)));
  const countryOnly = countries.some(code => text.replace(/^(?:what about|how about|and|in|from)\s+/, '') === normal(COUNTRY_NAMES.of(code)));
  if (!profile && !starter && !item && knownContext && followUp && (topic !== 'overview' || countryOnly || /\b(it|its|that crop|this crop)\b/.test(text)) && !/\b(?:tell me about|about the crop)\b/.test(text)) {
    profile = knowledge.profiles.find(profile => profile.id === knownContext.cropKey);
    starter = catalog.crops.find(crop => crop.id === knownContext.cropKey);
    item = cropItems.find(item => `fao-${item.id}` === knownContext.cropKey);
  }
  if (/\b(compare|baseline|alternatives|scenarios)\b/.test(text)) return null;
  if (topic === 'weather' && country && country !== selectedCountry) return {
    schemaVersion: 1, mode: 'deterministic geographic clarification', question, topic, useSelectedLocation: false,
    context: { cropKey: profile?.id ?? starter?.id ?? (item ? `fao-${item.id}` : ''), country },
    blocks: [{ kind: 'location needed', text: `For NASA weather evidence in ${COUNTRY_NAMES.of(country)}, choose a town or point there and load NASA evidence. A country is too broad for a single weather reading.`, sourceIds: [] }], sources: [], followUps: [] };
  if (topic === 'weather') return null;
  if (!profile && !starter && !item) {
    if (!explicitCountry && !/\btell me about\b/.test(text)) return null;
    return { schemaVersion: 1, mode: 'deterministic conversational clarification', question, topic: 'clarification', useSelectedLocation: false,
      blocks: [{ kind: 'evidence gap', text: `I could not match that crop to a sourced entry${country ? ` for ${COUNTRY_NAMES.of(country)}` : ''}. Try its common English name and a country, for example “cassava in Ghana”.`, sourceIds: [] }], sources: [], followUps: [] };
  }
  const name = profile?.name ?? starter?.name ?? item.name;
  const cropKey = profile?.id ?? starter?.id ?? `fao-${item.id}`;
  const countryName = country ? COUNTRY_NAMES.of(country) : null;
  const scope = country ? getCountryCrops({ country }) : null;
  if (starter) {
    const ids = { 'bush-bean': ['414', '423'], pea: ['417'], 'sweet-corn': ['446'], radish: [] }[starter.id];
    item = cropItems.find(item => ids.includes(item.id));
  }
  // Only explicitly mapped profiles receive commodity totals. Kai lan must not
  // inherit the broader broccoli/cabbage category's national production.
  if (profile) item = cropItems.find(item => profile.itemIds?.includes(item.id));
  const record = scope?.records.find(record => String(record.itemCode) === item?.id);
  const blocks = [];
  const sources = [...catalog.sources, ...knowledge.sources, ...(scope ? [scope.source] : [])];
  const push = (kind, text, sourceIds = []) => blocks.push({ kind, text, sourceIds });
  if (profile) {
    const fact = profile[topic === 'production' ? 'overview' : topic];
    if (topic !== 'production') push(fact ? 'sourced crop facts' : 'evidence gap', fact ?? `I do not have a verified ${topic} rule for ${name}.`, fact ? profile.topicSourceIds?.[topic] ?? profile.sourceIds : []);
    if (country === 'SG' && profile.id === 'kai-lan') push('country context', 'NParks provides Singapore gardening guidance for kai lan. Local cultivar and farm conditions still need checking.', profile.sourceIds);
    else if (!record) push('reference scope', profile.referenceScope ?? `The growing reference is from ${COUNTRY_NAMES.of(profile.sourceCountry)}; ${countryName ?? 'your country'}-specific growing guidance is not verified here.`, []);
    if (topic === 'rotation') push('screening limit', profile.limitation ?? `${name} has knowledge coverage but is not in the four-crop rotation-screening catalog.`, []);
  } else if (starter) {
    if (topic === 'harvest') push('sourced crop facts', `${name}: the starter reference gives ${starter.maturityDays.join('–')} days to maturity. This reference range does not predict your harvest date.`, starter.sourceIds);
    else if (topic === 'rotation') push('sourced crop facts', `${name} belongs to ${starter.family}. Family repetition is one rotation check; it cannot establish pest prevention or the required local break period.`, [...starter.sourceIds, 'cornell-rotation']);
    else if (topic === 'conditions' || topic === 'water') push('sourced crop facts', `${name}: ${starter.notes[0]}${topic === 'water' ? ' I cannot infer an irrigation amount from rainfall alone.' : ''}`, starter.sourceIds);
    else push('sourced crop facts', `${name} belongs to ${starter.family}. The starter reference gives ${starter.maturityDays.join('–')} days to maturity, with cultivar and local conditions still to check.`, starter.sourceIds);
  }
  if (record) {
    if (topic === 'production' || (!profile && !starter)) push('national production evidence',
      `${countryName}: FAOSTAT records ${record.tonnes.toLocaleString('en-US')} t of ${record.name} nationally in ${record.year} (${record.flagDescription}). Source snapshot retrieved ${scope.source.retrievedAt.slice(0, 10)}. This is national production, not field yield or a planting recommendation.`, ['faostat-qcl']);
    else push('country context', `${countryName} has a ${record.year} FAOSTAT production record for ${record.name}. ${profile?.referenceScope ?? 'The growing reference is from Minnesota.'} National records do not verify local suitability.`, ['faostat-qcl']);
  } else if (item && country) push('evidence gap', `The saved FAOSTAT extract has no matching positive ${item.name} record for ${countryName} in 2020–2024. That is missing coverage, not proof the crop cannot grow there.`, ['faostat-qcl']);
  else if (!country) push('clarification', `Which country would you like to discuss ${name} in?`, []);
  if (profile?.id === 'kai-lan' && topic === 'production') push('evidence gap', `I have no kai-lan-specific national production series${countryName ? ` for ${countryName}` : ''}. A total for cabbage or broccoli would cover a different category.`, []);
  if (!profile && !starter && (topic === 'conditions' || topic === 'water' || topic === 'rotation' || topic === 'harvest')) push('evidence gap', `I have a dated production category for ${name}, but no verified growing or rotation rule for this crop-country pair.`, []);
  if (ambiguousCornQuestion(question)) push('screening limit', cornScopeNotice, []);
  const suffix = countryName ? ` in ${countryName}` : '';
  const followUps = [topic !== 'conditions' && { label: 'Growing conditions', question: `What growing conditions does ${name} need${suffix}?` },
    topic !== 'harvest' && (profile || starter) && { label: 'Harvest timing', question: `How long does ${name} take to harvest${suffix}?` },
    topic !== 'production' && { label: 'Country evidence', question: `What production evidence exists for ${name}${suffix}?` },
    topic !== 'rotation' && { label: 'Rotation role', question: `How does ${name} fit a rotation${suffix}?` }].filter(Boolean).slice(0, 3);
  const visible = blocks.slice(0, 3), ids = new Set(visible.flatMap(block => block.sourceIds));
  return { schemaVersion: 1, mode: 'deterministic crop-country evidence retrieval', question, topic,
    context: { cropKey, country }, blocks: visible, useSelectedLocation: false,
    sources: [...new Map(sources.filter(source => ids.has(source.id)).map(source => [source.id, source])).values()], followUps };
}
