// Read-only public check. No authentication, script execution, portal edit or submission.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const url='https://www.spaceappschallenge.org/2026/find-a-team/explorer36/?tab=details';
const response=await fetch(url,{signal:AbortSignal.timeout(30_000)});
if(!response.ok)throw new Error(`Public NASA page returned HTTP ${response.status}`);
const html=await response.text(),fragments=[];
for(const match of html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)){
  try{fragments.push(...JSON.parse(match[1]).filter(value=>typeof value==='string'));}catch{}
}
const stream=fragments.join('');
const read=key=>{
  const match=stream.match(new RegExp('"'+key+'":("(?:[^"\\\\]|\\\\.)*"|true|false|null|\\[[^\\]]*\\])'));
  if(!match)return {unverified:'Field not present in public response'};
  const value=JSON.parse(match[1]);
  if(typeof value!=='string'||!/^\$[a-f0-9]+$/.test(value))return value;
  const id=value.slice(1),header=stream.match(new RegExp(id+':T([a-f0-9]+),'));
  if(!header)return {unverified:`Unresolved public text reference ${value}`};
  const bytes=Buffer.from(stream.slice(header.index+header[0].length));
  const size=parseInt(header[1],16);
  if(bytes.length<size)throw new Error(`Incomplete public text record ${id}`);
  return bytes.subarray(0,size).toString('utf8');
};
const fields=Object.fromEntries(['isSubmitted','projectSubmitted','submittedAt','savedAt',
  'summary','details','demoLink','projectLink','aiReferences','aiToolsUsage',
  'dataReferences','projectReferences'].map(key=>[key,read(key)]));
const report={checkedAt:new Date().toISOString(),url,http:response.status,
  method:'Unauthenticated GET; parse JSON fragments and length-prefixed UTF-8 text only; never execute page scripts.',
  htmlSha256:createHash('sha256').update(html).digest('hex'),fields};
await writeFile('docs/evidence/merged-release-submitted-fields.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checkedAt:report.checkedAt,isSubmitted:fields.isSubmitted,
  projectSubmitted:fields.projectSubmitted,submittedAt:fields.submittedAt,
  aiReferencesEmpty:fields.aiReferences==='',textLengths:{summary:fields.summary.length,details:fields.details.length}},null,2));
