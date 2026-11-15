// Builds the DEVELOPMENT dataset for the typed chat-judgment experiment.
// Labels were authored for this prototype (AI-assisted, not independently reviewed).
// Train/validation rows come from wording templates split BY TEMPLATE, so no
// validation template is seen in training. The held-out test set is a separate,
// hand-written file (models/judgment/holdout.json) and is never used for fitting,
// early stopping, calibration or threshold selection.
// The 16 acceptance prompts in tests/qa/prompts.json are excluded from every split.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const SCHEMA = {
  action: ['read_only', 'app_action'],
  unsupported: ['answerable_or_other', 'unsupported_claim'],
  topic: ['greeting', 'crops', 'weather', 'soil', 'water', 'pests', 'comparison', 'location', 'other']
};
export const normalize = text => String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}%.,:?]+/gu, ' ').trim();

const crops = ['rice', 'wheat', 'tomato', 'cabbage', 'onions', 'peas', 'beans', 'sweet corn', 'radish', 'cassava', 'maize', 'potatoes', 'soybeans', 'carrots'];
const countries = ['India', 'Kenya', 'Japan', 'Brazil', 'Australia', 'France', 'Mexico', 'Thailand', 'Ghana', 'Peru', 'Egypt', 'Vietnam'];
const towns = ['Nakuru', 'Pune', 'Perth', 'Ames', 'Cambridge', 'Chiang Mai', 'Kumasi'];
const months = ['January', 'March', 'June', 'August', 'October', 'December'];

// [templates, labels]. {c}=crop {k}=country {t}=town {m}=month.
const groups = [
  [['hi', 'hello', 'hello there', 'hey', 'good morning', 'good evening', 'hi there', 'thanks', 'thank you', 'cheers', 'hey there', 'good afternoon', 'thanks a lot', 'hello again'],
    { action: 0, unsupported: 0, topic: 'greeting' }],
  [['tell me about {c} in {k}', 'what family is {c} in', 'how long does {c} take to mature', 'what do you know about {c}', '{c} in {k}', 'is {c} a legume',
    'which crops are related to {c}', 'describe {c} as a rotation crop', 'what growing conditions does {c} need in {k}', 'how many days until {c} can be harvested',
    'does {k} grow {c}', 'what production records exist for {c} in {k}', 'give me the basics on {c}', 'when is {c} usually harvested', 'what can follow {c} in a rotation'],
    { action: 0, unsupported: 0, topic: 'crops' }],
  [['show me rainfall in {k}', 'what was the temperature here last year', 'how much rain fell in {m}', 'is there frost risk at this location', 'how hot did it get in {m}',
    'what does the nasa data say about rain', 'show the solar radiation for this point', 'were there dry spells in {m}', 'how cold are the nights in {m}',
    'what is the weather evidence for {t}', 'which month was wettest', 'explain the temperature chart', 'how many days had no rain', 'what does nasa power measure'],
    { action: 0, unsupported: 0, topic: 'weather' }],
  [['what is the soil ph here', 'is my soil too sandy for {c}', 'my soil ph is 7.5 is {c} ok', 'what does the soil estimate show', 'does {c} need well drained soil',
    'my field has clay soil what does that mean for {c}', 'is acidic soil a problem for {c}', 'what is the sand and clay fraction here', 'the field drains poorly is {c} affected',
    'how reliable is the soil map', 'what ph range suits {c}', 'does soilgrids measure my farm'],
    { action: 0, unsupported: 0, topic: 'soil' }],
  [['does {c} need a lot of water', 'is irrigation common in {k}', 'what does rainfed mean for {c}', 'how is water availability considered', 'what irrigation records do you have',
    'is the rain enough context for {c}', 'what do the australian irrigation statistics show', 'how do you treat irrigation in the comparison', 'can drought be assessed here',
    'what does a zero rain run mean', 'is {c} more drought exposed than other crops'],
    { action: 0, unsupported: 0, topic: 'water' }],
  [['which pests attack {c} in {k}', 'is fall armyworm recorded in {k}', 'what pests are known in {k}', 'does rotating {c} help with pests', 'is diamondback moth a risk for {c}',
    'what do the pest records mean', 'are there disease concerns after {c}', 'which insects are recorded near {k}', 'how do crop families relate to pests', 'do the records show an outbreak'],
    { action: 0, unsupported: 0, topic: 'pests' }],
  [['why is alternative 1 ranked first', 'explain the difference between my baseline and alternative 2', 'what are the risks of the second scenario', 'how were the alternatives ordered',
    'why does my rotation have a family repeat', 'what does calendar overrun mean', 'which scenario has less heat exposure', 'summarise the comparison', 'what are the gaps in this comparison',
    'why was my baseline kept', 'what does the uncertainty note mean', 'how do the three rotations differ'],
    { action: 0, unsupported: 0, topic: 'comparison' }],
  [['help me plan a rotation in {k}', 'select {k}', 'use the field near {t}', 'pick the first mapped field', 'choose {t} as my location', 'find farmland around {t}',
    'use coordinates 18.52, 73.85', 'set the country to {k}', 'help me pick a field in {k}', 'go to {t} and find fields', 'use the whole country', 'choose a region in {k}',
    'take me to a farm in {k}', 'pick a town in {k} for me to plan'],
    { action: 1, unsupported: 0, topic: 'location' }],
  [['set crops: {c}, wheat, beans', 'my rotation is {c}, peas, tomato', 'use {c} then cabbage then onions as my baseline', 'set irrigation to rainfed', 'set soil ph to 6.5',
    'allowed crops are {c} and peas', 'plan with crops {c}, rice, maize', 'change the first crop to {c}', 'use loam soil for the plan', 'set the planning year to 2028'],
    { action: 1, unsupported: 0, topic: 'crops' }],
  [['load the nasa evidence', 'load weather for this point', 'fetch the historical data for {t}', 'use 2023 as the reference year and load evidence', 'retry loading nasa data',
    'get the nasa evidence for the selected field'],
    { action: 1, unsupported: 0, topic: 'weather' }],
  [['compare my rotation now', 'run the comparison', 'compare baseline and alternatives', 'go to step 4 and compare', 'continue to the comparison', 'proceed and compare the rotations',
    'compare again with water as the priority', 'next step please compare'],
    { action: 1, unsupported: 0, topic: 'comparison' }],
  [['how many tonnes of {c} will i harvest', 'predict my {c} yield exactly', 'give me the exact yield of {c} from satellite data', 'what yield will {c} give next season',
    'guarantee that {c} will succeed', 'promise me {c} is safe to plant', 'what is the probability that {c} succeeds', 'are you 95% confident {c} will work',
    'give me a success percentage for {c}', 'how much profit will {c} make', 'what income will i get from {c}', 'tell me for certain that {c} will not fail'],
    { action: 0, unsupported: 1, topic: 'crops' }],
  [['exactly how many litres will i save with {c}', 'calculate my irrigation savings', 'how much water will i save by switching to {c}', 'tell me the exact irrigation amount for {c}',
    'how many litres should i apply each day', 'guarantee that the rain will be enough'],
    { action: 0, unsupported: 1, topic: 'water' }],
  [['guarantee there will be no pests next year', 'promise the rotation will stop disease', 'what is the chance of an armyworm outbreak', 'certify my field is pest free',
    'predict exactly when pests will arrive'],
    { action: 0, unsupported: 1, topic: 'pests' }],
  [['forecast the rainfall for next {m}', 'tell me exactly how hot next year will be', 'guarantee no frost next season', 'predict the weather for my harvest'],
    { action: 0, unsupported: 1, topic: 'weather' }],
  [['which rotation is guaranteed to be best', 'give me a confidence score for alternative 1', 'what percent better is alternative 2', 'prove that the first alternative will improve my soil',
    'how much more money does alternative 1 make'],
    { action: 0, unsupported: 1, topic: 'comparison' }],
  [['i want to know more about {c}', 'any facts on {c} for {k}', 'is {c} grown much in {k}', 'explain where {c} sits among plant families', 'how quickly does {c} grow',
    'would {c} be a good break crop', 'what should i know before planting {c}', 'can you compare {c} with wheat as crops', 'is {c} a warm season or cool season crop', '{c}, what family'],
    { action: 0, unsupported: 0, topic: 'crops' }],
  [['did it rain much here in {m}', 'how warm was {m} on average', 'what is the driest period in the record', 'does the record show any freezing nights', 'how old is this weather data',
    'what area does the temperature value represent', 'is this a forecast or history', 'give me the rain picture for {t}'],
    { action: 0, unsupported: 0, topic: 'weather' }],
  [['my ph reading is 5.8 what does that mean for {c}', 'the plot floods sometimes, is {c} ok with that', 'is the soil estimate for my exact field', 'heavy clay here, any concern for {c}',
    'which crops here have a ph range', 'does poor drainage matter'],
    { action: 0, unsupported: 0, topic: 'soil' }],
  [['we have no irrigation, how is that treated', 'is {c} a heavy water user', 'what do the water figures mean', 'does rain alone tell you if {c} has enough water', 'how is a dry run counted'],
    { action: 0, unsupported: 0, topic: 'water' }],
  [['what insects trouble {c}', 'is there any record of armyworm near {k}', 'does changing crop family reduce pest carryover', 'are pest counts the same as an infestation', 'i saw caterpillars last season, do you use that'],
    { action: 0, unsupported: 0, topic: 'pests' }],
  [['why is the first option ahead of the second', 'walk me through the results table', 'what is different about option 2', 'does the ordering use profit or yield', 'which rotation has more warnings',
    'what do the counts in the table mean', 'why not recommend a single best rotation'],
    { action: 0, unsupported: 0, topic: 'comparison' }],
  [['lets work in {k}', 'i want to plan for a farm near {t}', 'move the location to {k}', 'put the marker at 12.97, 77.59', 'look for fields close to {t}', 'start with {t}, {k}',
    'pick any mapped field there for me', 'switch to the whole of {k}', 'please open {t} on the map and select it', 'set my place as {t}'],
    { action: 1, unsupported: 0, topic: 'location' }],
  [['i currently grow {c}, maize and beans, enter that', 'enter {c}, tomato, onions as the existing rotation', 'make the second crop {c}', 'record that the farm is rainfed', 'put in a soil ph of 7.1',
    'limit alternatives to {c} and cabbage', 'begin planting in {m}', 'note that drainage is poor'],
    { action: 1, unsupported: 0, topic: 'crops' }],
  [['bring in the nasa data now', 'download the weather record for my point', 'reload the evidence', 'get last years nasa numbers for {t}', 'please fetch the climate evidence'],
    { action: 1, unsupported: 0, topic: 'weather' }],
  [['do the comparison for me', 'show me the alternatives now', 'rerun with fewer family repeats as priority', 'finish the plan and compare', 'ok compare them', 'carry on to the results'],
    { action: 1, unsupported: 0, topic: 'comparison' }],
  [['how many kilograms of {c} per hectare will i get', 'what are the odds {c} does well', 'can you assure me {c} will not fail', 'put a number on my {c} harvest', 'how sure are you about {c}, in percent',
    'what will {c} earn me', 'is {c} certain to succeed', 'state the expected tonnage for {c}'],
    { action: 0, unsupported: 1, topic: 'crops' }],
  [['what volume of water will this rotation save', 'give me a daily watering schedule in litres', 'assure me there will be enough rain', 'compute the irrigation i can cut'],
    { action: 0, unsupported: 1, topic: 'water' }],
  [['what is the likelihood of an outbreak next season', 'assure me pests will be gone after rotating', 'tell me exactly which week the moths arrive'],
    { action: 0, unsupported: 1, topic: 'pests' }],
  [['what will the temperature be next {m}', 'will there be frost next year', 'give me a rain forecast for the season ahead', 'assure me next year is not a drought'],
    { action: 0, unsupported: 1, topic: 'weather' }],
  [['how accurate is this ranking in percent', 'which option is certain to earn more', 'by how many percent will soil health improve under option 1', 'give each rotation a success probability'],
    { action: 0, unsupported: 1, topic: 'comparison' }],
  [['hey how are you', 'good day', 'hello assistant', 'thanks that helps', 'ok thank you', 'bye for now'],
    { action: 0, unsupported: 0, topic: 'greeting' }],
  [['what is the population of {k}', 'help me write a cover letter', 'play some music', 'what is 15 percent of 80', 'who invented the telephone', 'what should i cook tonight', 'is it going to be a good football season',
    'explain how a car engine works', 'what language is spoken in {k}', 'are you an ai'],
    { action: 0, unsupported: 0, topic: 'other' }],
  [['what is the capital of {k}', 'write me a poem', 'who won the world cup', 'tell me a joke', 'what time is it', 'translate hello into french', 'how do i fix my tractor engine',
    'what is the price of bitcoin', 'recommend a movie', 'who are you', 'what can you do', 'book me a flight to {k}', 'solve 12 times 7', 'what is the news today'],
    { action: 0, unsupported: 0, topic: 'other' }]
];

function fill(template, i) {
  return template.replaceAll('{c}', crops[i % crops.length]).replaceAll('{k}', countries[(i * 5 + 1) % countries.length])
    .replaceAll('{t}', towns[(i * 3 + 2) % towns.length]).replaceAll('{m}', months[(i * 7 + 3) % months.length]);
}
export function build() {
  const acceptance = new Set(JSON.parse(readFileSync(new URL('../tests/qa/prompts.json', import.meta.url), 'utf8')).cases.map(c => normalize(c.prompt)));
  const train = [], validation = [];
  groups.forEach(([templates, labels], g) => templates.forEach((template, t) => {
    // Deterministic split by template: every fifth template (offset by group) is validation.
    const target = (t + g) % 5 === 0 ? validation : train;
    const variants = /\{[ckmt]\}/.test(template) ? 4 : 1;
    for (let v = 0; v < variants; v++) {
      const text = fill(template, g * 7 + t * 3 + v * 5);
      if (acceptance.has(normalize(text))) continue;
      if (!target.some(row => row.text === text)) target.push({ text, ...labels, template: `${g}.${t}` });
    }
  }));
  const holdout = JSON.parse(readFileSync(new URL('../models/judgment/holdout.json', import.meta.url), 'utf8')).rows;
  const seen = new Set([...train, ...validation].map(row => normalize(row.text)));
  for (const row of holdout) {
    if (acceptance.has(normalize(row.text))) throw new Error(`Held-out row repeats an acceptance prompt: ${row.text}`);
    if (seen.has(normalize(row.text))) throw new Error(`Held-out row repeats a development row: ${row.text}`);
    for (const [key, values] of Object.entries(SCHEMA)) if (key === 'topic' ? !values.includes(row.topic) : ![0, 1].includes(row[key])) throw new Error(`Bad label ${key}: ${row.text}`);
  }
  return { train, validation, holdout };
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  const data = build();
  mkdirSync('models/judgment', { recursive: true });
  const body = JSON.stringify({ kind: 'DEVELOPMENT synthetic wording with authored labels; not independently reviewed', schema: SCHEMA,
    split: 'train/validation split by wording template; held-out set is separate hand-written wording', train: data.train, validation: data.validation }, null, 1);
  writeFileSync('models/judgment/development.json', body);
  console.log(JSON.stringify({ train: data.train.length, validation: data.validation.length, holdout: data.holdout.length,
    developmentSha256: createHash('sha256').update(body).digest('hex') }));
}
