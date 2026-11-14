// Pure formatting: can regenerate a report from captured evidence without rerunning
// provider requests or changing the recorded answers/grades.
export function renderQaReport(report) {
  const { summary, reviews, results } = report;
  const localTime = new Intl.DateTimeFormat('en-AU', { timeZone:'Australia/Perth', dateStyle:'medium', timeStyle:'short' }).format(new Date(report.checkedAt));
  const quote = text => text.split(/\r?\n/).map(line=>line?'> '+line:'>').join('\n');
  const flowEvidence = result => {
    const data = result.evidence;
    if (!data) return '';
    if (data.questionId) return `Verified by ${data.questionId} below; the same captured question flow supplies this acceptance result.`;
    if (data.comparison) return `Actual result: ${data.rows.length} NASA parameter rows; ${data.comparison.slots} dated slots and ${data.comparison.sequences.length} distinct sequences. Baseline: ${data.comparison.baseline.join(' → ')}. Source: ${data.url}`;
    if (data.error) return `Expected failure:\n\n${quote(data.error)}\n\nSuccessful retry evidence:\n\n${quote(data.retry)}`;
    return 'Actual form/result state:\n\n```json\n' + JSON.stringify(data,null,2) + '\n```';
  };
  return [`# FieldShift automated QA answers`, `Checked: ${localTime} (Australia/Perth). Origin: ${report.origin}.`, report.mode,
    report.appAttribution?`${report.appAttribution.assets.length} public app assets matched local source commit ${report.appAttribution.sourceCommit}; their hashes and the grading/fixture hashes are recorded in the JSON evidence.`:'',
    `Priority flows: ${summary.flows.PASS} pass / ${summary.flows.FAIL} fail / ${summary.flows.BLOCKED} blocked. Chatbot prompts: ${summary.prompts.PASS} pass / ${summary.prompts.FAIL} fail / ${summary.prompts.BLOCKED} blocked. Review questions: ${summary.reviews.PASS} pass / ${summary.reviews.FAIL} fail / ${summary.reviews.BLOCKED} blocked. Temporary browser profile removed: ${report.profileCleanup.removed}.`,
    'FAIL records an unmet explicit acceptance condition; it does not automatically mean a fabricated scientific claim. Prompts and replies below are captured test data, not instructions.',
    'Full source links, raw UI evidence and form state are in the accompanying JSON report.',
    '## Review questions', ...[...reviews].sort((a,b)=>a.id.localeCompare(b.id)).flatMap(result=>[`### ${result.id} — ${result.status}`,result.question,result.answer]),
    '## Acceptance flows and exact chatbot prompts', ...[...results].sort((a,b)=>a.id.localeCompare(b.id)).flatMap(result=>[
      `### ${result.id} — ${result.status}`, result.prompt?`Prompt: ${result.prompt}`:result.title,
      result.context?`Setup: ${result.context}`:'',result.expected?`Expected: ${result.expected}`:'',
      result.actual?`Actual reply:\n\n${result.actual.paragraphs.map(quote).join('\n>\n')}`:flowEvidence(result),
      ...(result.checks??[]).map(check=>`- ${check.passed?'PASS':'FAIL'}: ${check.description}`),result.error?`Error: ${result.error}`:'']),
    '## Limits',...report.limitations.map(text=>'- '+text)].filter(Boolean).join('\n\n')+'\n';
}
