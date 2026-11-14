import { mkdir, readFile, writeFile } from 'node:fs/promises';

// DEVELOPMENT / synthetic question wording. Completions describe verified source/app
// boundaries, not synthetic NASA observations. No agronomic reliability is inferred.
const topics = [
  { id: 'crops', terms: ['peas', 'beans', 'sweet corn', 'radish', 'crop family', 'crop maturity', 'planting crops', 'legumes'],
    questions: ['what crops can i use', 'what family are peas in', 'how long do beans grow', 'tell me about sweet corn', 'which plants are legumes'],
    reply: 'crop families and growing times come from sourced crop records .', sources: ['umn-families', 'umn-duration'] },
  { id: 'soil', terms: ['soil', 'soil ph', 'sand', 'clay', 'drainage', 'soil test', 'soilgrids', 'soil type'],
    questions: ['what is my soil like', 'is this soil good', 'what does soil ph mean', 'can i use the mapped clay estimate', 'how do i know my soil type'],
    reply: 'regional soil estimates are not farm measurements . a local soil test is needed .', sources: ['soilgrids'] },
  { id: 'water', terms: ['irrigation', 'water use', 'watering', 'rainfed farming', 'irrigation history', 'water demand', 'australian water use', 'water savings'],
    questions: ['how much should i water', 'how much water do farmers use', 'show australian irrigation history', 'do i have enough water', 'can i save water'],
    reply: 'historical irrigation records are context not a watering schedule .', sources: ['abs-irrigation'] },
  { id: 'pests', terms: ['pests', 'fall armyworm', 'diamondback moth', 'insects', 'crop disease', 'pest records', 'country pests', 'infestation'],
    questions: ['what pests are in this country', 'does my farm have armyworm', 'are there moths here', 'what insects eat crops', 'can rotation prevent disease'],
    reply: 'country pest records do not confirm an infestation on this farm .', sources: ['gbif', 'ippc', 'uf-ifas'] },
  { id: 'weather', terms: ['nasa data', 'temperature', 'rainfall', 'precipitation', 'solar radiation', 'frost', 'weather observations', 'nasa power'],
    questions: ['where does the weather data come from', 'is this real time weather', 'what did nasa measure', 'show historical rainfall', 'what is the temperature source'],
    reply: 'nasa power supplies historical gridded temperature precipitation and solar data .', sources: ['nasa-power'] },
  { id: 'rotation', terms: ['rotation', 'baseline rotation', 'alternatives', 'crop sequence', 'family repeats', 'comparison', 'rotation strategy', 'timeline'],
    questions: ['compare my rotation', 'which alternative ranks first', 'why is the existing sequence included', 'what is a rotation timeline', 'how do you rank alternatives'],
    reply: 'compare the existing rotation with two alternatives over the same time horizon .', sources: ['project-rules'] },
  { id: 'location', terms: ['farmland', 'map', 'field outlines', 'place search', 'farm location', 'coordinates', 'mapped fields', 'openstreetmap'],
    questions: ['where are the farms', 'how can i find farmland', 'search for a place', 'is this land available', 'how do i choose a field'],
    reply: 'search for a place and choose mapped farmland . ownership and access are unknown .', sources: ['osm'] },
  { id: 'limits', terms: ['uncertainty', 'limitations', 'confidence', 'accuracy', 'yield guarantee', 'missing data', 'unknown observations', 'evidence gaps'],
    questions: ['how reliable is this answer', 'can you guarantee yield', 'why are some values missing', 'what can the app not conclude', 'what are the risks'],
    reply: 'unknown evidence cannot justify yield confidence or savings claims .', sources: ['project-rules'] },
  { id: 'other', terms: ['movie', 'holiday', 'football', 'music', 'celebrity', 'fashion', 'recipe', 'shopping'],
    questions: ['hello', 'who are you', 'tell me a joke', 'write a poem', 'what is the latest movie'],
    reply: 'this assistant supports fieldshift crop soil water weather and rotation evidence .', sources: ['project-scope'] }
];
const templates = ['tell me about {x}', 'please explain {x}', 'i need information on {x}', 'what do we know about {x}', 'how can i understand {x}', 'help me with {x}', 'what is the evidence for {x}', 'can you describe {x}'];
const rows = [];
for (const topic of topics) {
  topic.terms.forEach(term => templates.forEach((template, i) => rows.push({ question: template.replace('{x}', term), reply: topic.reply, topic: topic.id, group: `${topic.id}:${term}`, split: i === 6 ? 'validation' : i === 7 ? 'test' : 'train', sourceIds: topic.sources })));
  topic.questions.forEach((question, i) => rows.push({ question, reply: topic.reply, topic: topic.id, group: `${topic.id}:freeform:${i}`, split: i < 3 ? 'train' : 'test', sourceIds: topic.sources }));
}
const corpus = { kind: 'DEVELOPMENT synthetic wording; source-linked explanatory continuations', reviewedByAgronomist: false,
  limitation: 'Template test wording shares vocabulary with training and is optimistic. Free-form cases are reported separately. This is not agronomic accuracy or a reliable general LLM.',
  topics, rows };
const extra=JSON.parse(await readFile('models/mini-development-questions.json','utf8'));
const acceptance=JSON.parse(await readFile('tests/qa/prompts.json','utf8')).cases.map(item=>item.prompt.toLowerCase().replace(/[^a-z]+/g,' ').trim());
for(const topic of topics)for(const split of ['train','validation','test'])for(const [i,question] of extra.topics[topic.id][split].entries()) {
  if(acceptance.includes(question.toLowerCase().replace(/[^a-z]+/g,' ').trim()))throw new Error('Acceptance prompt leaked into the model experiment');
  rows.push({question,reply:topic.reply,topic:topic.id,split,group:`${topic.id}:v2-freeform:${split}:${i}`,sourceIds:topic.sources});
}
// The earlier template corpus had exact wording duplicated across splits. Keep
// held-out rows and remove matching training rows instead of leaking their text.
const unique=new Map(),priority={train:0,validation:1,test:2},originalCount=rows.length;
for(const row of rows){const key=row.question.toLowerCase().replace(/[^a-z]+/g,' ').trim(),previous=unique.get(key);if(previous&&previous.topic!==row.topic)throw new Error(`Conflicting topic labels: ${row.question}`);if(!previous||priority[row.split]>priority[previous.split])unique.set(key,row);}
rows.splice(0,rows.length,...unique.values());
corpus.exactDuplicateRowsRemoved=originalCount-rows.length;
const keys=split=>new Set(rows.filter(row=>row.split===split).map(row=>row.question.toLowerCase().replace(/[^a-z]+/g,' ').trim()));
const train=keys('train'),validation=keys('validation');
if(acceptance.some(question=>train.has(question)))throw new Error('Acceptance prompt leaked into training');
if(rows.some(row=>row.split==='test'&&(train.has(row.question.toLowerCase().replace(/[^a-z]+/g,' ').trim())||validation.has(row.question.toLowerCase().replace(/[^a-z]+/g,' ').trim()))))throw new Error('Exact wording crosses the held-out split');
corpus.version=2;
corpus.vocabularySource='Training questions and replies only; validation/test wording is not used to construct vocabulary.';
corpus.holdout='36 fixed additional free-form questions, frozen before retraining, plus the 90 legacy development cases. No supplied QA acceptance prompt is in the added model data.';
await mkdir('public/models/fieldshift-mini', { recursive: true });
await writeFile('public/models/fieldshift-mini/corpus.json', JSON.stringify(corpus, null, 2));
console.log(`Prepared ${rows.length} next-word training examples with labelled development provenance.`);
