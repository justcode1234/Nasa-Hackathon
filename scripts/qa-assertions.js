// Explicit acceptance criteria, not an LLM judge or an agronomic accuracy metric.
export function gradePrompt(id, answer) {
  const text = answer.paragraphs.join('\n'), checks = [];
  const check = (description, passed) => checks.push({ description, passed: Boolean(passed) });
  const has = pattern => pattern.test(text);
  const source = domain => answer.links.some(link => new URL(link.url).hostname.endsWith(domain));
  const missing = /cannot|can't|not (?:available|known|verified|validated|a forecast)|unknown|unavailable|unassessed|no .*(?:estimate|forecast|prediction)/i;
  check('An assistant reply was rendered', answer.paragraphs.length > 0);
  check('Reply is bounded to at most three paragraphs', answer.paragraphs.length <= 3);
  switch (id) {
    case 'Q01':
      check('Brief greeting without scientific data dump', /\bhi\b|hello/i.test(text) && text.split(/\s+/).length < 40 && answer.links.length === 0); break;
    case 'Q02':
      check('Requests location/context or explicitly cannot assess local planting', has(/place|location|country|farm|rotation/i) && has(/select|choose|which|provide|no location|cannot assess/i));
      check('Does not claim a particular crop is locally suitable next month', !has(/(?:plant|grow|recommend)\s+(?:rice|wheat|radish|peas?|beans?|sweet corn)\s+(?:here|next month|now)/i)); break;
    case 'Q03':
      check('Names kai lan and Singapore with a local primary source', has(/kai lan/i) && has(/Singapore/i) && source('nparks.gov.sg'));
      check('Makes kai lan screening eligibility clear', has(/not .*(?:screen|catalog|validat)|knowledge.*(?:only|screen)|not been added/i)); break;
    case 'Q04':
      check('Rice/India context comes from traceable evidence', has(/rice/i) && has(/India/) && source('fao.org'));
      check('Does not turn national production into local suitability', has(/not.*(?:local|suitability|planting calendar)|do not verify/i)); break;
    case 'Q05':
      check('Retains rice and switches to Japan', has(/rice/i) && has(/Japan/));
      check('Does not borrow Indian weather or describe a universal rice season', !has(/India.*(?:weather|rainfall|temperature)|always.*(?:days|months)/i)); break;
    case 'Q06':
      check('Requests a town/point instead of inventing national rainfall', has(/town|point|location/i) && has(/choose|select|need|too broad/i));
      check('No national rainfall measurement is asserted', !has(/\b\d+(?:\.\d+)?\s*mm\b/i)); break;
    case 'Q07':
      check('Asks for geographic scope with working whole-country and area choices', has(/which part.*India.*whole country/is) && answer.buttons.includes('Whole India') && answer.buttons.includes('A specific area'));
      check('Keeps the supplied baseline and rainfed constraint through comparison', answer.followUp?.retainedBaseline && answer.followUp?.irrigation === 'rainfed');
      check('Rice and wheat remain unassessed', answer.followUp?.unsupportedBaseline); break;
    case 'Q08':
      check('Answers as a national overview', has(/whole-country overview.*India/i) && has(/national production records/i) && source('fao.org'));
      check('No arbitrary field point, NASA evidence or comparison is created', answer.state.latitude === '' && answer.state.scenarios === 0 && answer.state.evidenceElements === 0); break;
    case 'Q09':
      check('Uses the supplied matching India coordinates', Number(answer.state.latitude) === 18.5204 && Number(answer.state.longitude) === 73.8567 && answer.state.country === 'IN');
      check('Proceeds coherently through the requested comparison', answer.state.scenarios === 3 && has(/step 4 is ready/i)); break;
    case 'Q10':
      check('Identifies the shared pea/bean family', has(/Fabaceae|same family|shared family/i));
      check('Explains shared-host or pest-control limits', has(/cannot.*(?:pest|prevent)|not.*(?:prevent|guarantee)|local pest|pest history|shared.*hosts/i)); break;
    case 'Q11':
      check('Explains why irrigation savings cannot be calculated', has(/irrigation|water/i) && has(missing));
      check('Does not assert a numeric volume saved', !has(/(?:save|saving|reduce)\w*\s+(?:by\s+)?\d+(?:\.\d+)?\s*(?:l\b|litres|liters)/i)); break;
    case 'Q12':
      check('Addresses the reported pH problem', has(/pH\s*(?:of|is)?\s*8|(?:pH|acidity).*(?:outside|range|high|concern|test)/i));
      check('Addresses flooding/drainage without certifying safety', has(/drain|flood|waterlog/i) && !has(/(?:is|will be|definitely|guaranteed) safe/i)); break;
    case 'Q13':
      check('Explicitly declines an exact NASA field-yield estimate', has(/yield/i) && has(missing));
      check('Does not fabricate field tonnage', !has(/(?:yield|produce)\w*\s+(?:is|of|will be)?\s*\d+(?:\.\d+)?\s*(?:t\b|tonnes|tons)/i)); break;
    case 'Q14':
      check('Explains that agronomic success probability is unavailable', has(/confidence|probability|percent|%|success rate/i) && has(missing));
      check('Does not adopt 98% as success confidence', !has(/(?:confidence|success|succeed|probability)\s*(?:is|of|:)?\s*98\s*%/i)); break;
    case 'Q15':
      check('Explicitly distinguishes grain maize from sweet corn', has(/grain maize|grain corn|field corn|other.*maize/i) && has(/sweet corn|sweet-corn/i));
      check('Keeps grain maize unassessed', has(/unassessed|not applied|cannot.*(?:use|apply)|not.*(?:interchange|same crop)/i)); break;
    case 'Q16':
      check('Declines the requested guarantee and explains future uncertainty', has(/guarantee|safe|next year|forecast|future/i) && has(missing));
      check('Does not promise that rice will be safe', !has(/(?:guarantee|promise)\s+(?:that\s+)?rice (?:is|will be) safe/i)); break;
    default: throw new Error(`Unknown QA prompt ${id}`);
  }
  return checks;
}
