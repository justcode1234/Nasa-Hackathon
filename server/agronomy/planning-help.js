import {getCountryCrops} from '../context/crops.js';
import {COUNTRY_CODES,findCountries} from '../../public/js/lib/countries.js';

// App-help judgments use actual sourced coverage, never a generated recommendation.
export function answerPlanningQuestion(question,{country='',selectedCountry=''}={}){
  const text=question.toLowerCase().replace(/[’']/g,'');
  const cropControl=/\b(?:crop|crops|dropdown|options)\b/.test(text)&&/\b(?:cant|cannot|unable|disabled|empty|grey|gray|choose|select|missing|no options)\b/.test(text);
  const compareControl=/\b(?:compare|comparison|next|baseline)\b/.test(text)&&/\b(?:why|cant|cannot|unable|disabled|blocked|need|three|two)\b/.test(text);
  const types=/\b(?:what|which|suggest|propose|recommend)\b.*\b(?:crops?|vegetables|crop types)\b/.test(text);
  const slots=/\bwhy\b.*\bthree\b.*\bcrops?\b/.test(text);
  const absence=/\b(?:no|zero|nothing)\b.*\b(?:recorded|grows|grow|crops)\b/.test(text)&&/\b(?:does|mean|why|nothing)\b/.test(text);
  if(!cropControl&&!compareControl&&!types&&!absence&&!slots)return null;
  const explicit=findCountries(question),code=explicit.length===1?explicit[0]:selectedCountry||country;
  const blocks=[],sources=[];
  const push=(kind,text,sourceIds=[])=>blocks.push({kind,text,sourceIds});
  if(slots)return {schemaVersion:1,mode:'deterministic planning assumption',question,topic:'planning-help',useSelectedLocation:false,
    blocks:[{kind:'planning assumption',text:'The current planner uses three four-month slots over one year. This is a prototype planning assumption, not a rule that every farm must grow three crops. Two-crop and other calendars need locally reviewed support before this prototype can compare them fairly.',sourceIds:[]}],sources:[],followUps:[]};
  if(!COUNTRY_CODES.includes(code)){
    push('clarification','Choose your actual country or area in step 01 first. The crop list needs its source records; map availability alone does not supply crop evidence.');
  }else{
    const scope=getCountryCrops({country:code}),local=scope.regionalContext,n=scope.screeningCropIds.length;
    sources.push(scope.source);
    if(/\bradish\b/.test(text))push('coverage gap','Radish has no mapped FAOSTAT category in this extract, so country crop choices do not offer it. That is a data-mapping limit, not proof that radish cannot grow in this country.',[scope.source.id]);
    if(!scope.records.length)push('coverage gap',`${scope.countryName} has no crop records in our saved FAOSTAT 2020–2024 extract. This is missing coverage in this app, not evidence that no crops grow there.`,[scope.source.id]);
    if(local){
      sources.push(local.source);
      push('documented local crop types',`Separate official ÅSUB ${local.year} records document ${local.records.map(record=>record.name).join(', ')} in ${scope.countryName}. These are evidence-backed crop types to consider with a local adviser, and are available as unassessed baseline choices.`,[local.source.id]);
      push('screening limit',`${local.limitation} Comparison still needs at least two crops with screening rules; this area currently has ${n}. Loading soil estimates or entering more constraints will not create those rules. You can still inspect historical NASA evidence for your point.`);
    }else if(scope.records.length){
      const examples=scope.choices.filter(choice=>choice.screeningId).slice(0,5);
      const names=(examples.length?examples:scope.choices.slice(0,5)).map(choice=>choice.name).join(', ');
      push('country crop context',`${scope.countryName} has ${scope.records.length} recorded FAOSTAT crop categories. Examples: ${names}. National production is evidence of cultivation somewhere in the country, not proof these crops fit your field.`,[scope.source.id]);
      push('planning help',n<2?`Your recorded baseline crops can be selected, but comparison needs at least two crops with screening rules; only ${n} are available here. Extra soil details do not remove this coverage gap.`:
        `This area has ${n} crops with screening rules. A comparison also needs your three baseline crops, at least two allowed alternatives and historical NASA evidence for an explicit point. If a particular crop is missing, tell me its name; I will explain the source gap rather than substitute a variety.`);
    }else push('evidence gap','I do not have a verified local crop source for this area yet, so I cannot responsibly propose local crop types from a map or regional weather alone. Crop lists remain empty; historical NASA evidence can still be inspected at an explicit point.');
    if(/\b(?:three|two)\b.*\bcrops?\b/.test(text)&&!local)push('planning assumption','The current planner uses three four-month slots over one year. That is a prototype planning assumption, not a rule that every farm must grow three crops.');
  }
  const visible=blocks.slice(0,3),ids=new Set(visible.flatMap(block=>block.sourceIds));
  return{schemaVersion:1,mode:'deterministic sourced planning help',question,topic:'planning-help',useSelectedLocation:false,blocks:visible,sources:sources.filter(source=>ids.has(source.id)),followUps:[]};
}
