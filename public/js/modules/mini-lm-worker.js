// A real small autoregressive word LM; it is not a general-purpose LLM or an
// agronomic authority. Production uses only verified topic selection + retrieval.
let tf, model, tokenizer, index, metrics;
const encode=text=>(text.toLowerCase().match(/[a-z]+|[.?]/g)??[]).map(word=>index.get(word)??1);
const topicWords={crops:['pea','peas','bean','beans','corn','radish','crop','crops','family','maturity','legume','plant'],soil:['soil','ph','sand','clay','drainage','drain'],water:['water','irrigation','irrigate','watering','rainfed','drought'],pests:['pest','pests','insect','insects','moth','worm','armyworm','disease','infestation'],weather:['weather','nasa','rainfall','precipitation','temperature','solar','frost','heat'],rotation:['rotation','baseline','alternative','alternatives','compare','comparison','sequence','timeline','repeat'],location:['farm','farms','farmland','map','mapped','field','fields','place','coordinates','location','land'],limits:['accuracy','confidence','reliable','uncertainty','limitation','limitations','unknown','missing','guarantee','yield','risk','risks','savings'],other:[]};
const kindFor={crops:['sourced crop facts'],soil:['regional soil model'],water:['historical national irrigation context','observation scope'],pests:['country occurrence context'],weather:['historical weather evidence','observation scope'],rotation:['rule output'],location:['mapped field record'],limits:['limitation'],other:[]};
async function score(question){
  const words=question.toLowerCase().match(/[a-z]+/g)??[];
  const q=encode(`question ${question} answer`);
  if(q.length>22||!q.length||q.filter(id=>id===1).length/q.length>.5)return{topic:null,accepted:false};
  const rows=tokenizer.topics.map(topic=>[...q,...encode(topic.reply),2]);
  const input=tf.tensor2d(rows.map(ids=>Array.from({length:tokenizer.length},(_,i)=>ids[i]??0)),[rows.length,tokenizer.length],'int32');
  const output=model.predict(input), probabilities=await output.array();
  const scores=rows.map((ids,row)=>{
    let total=0,count=0;
    for(let t=q.length-1;t<Math.min(tokenizer.length,ids.length-1);t++){total-=Math.log(Math.max(probabilities[row][t][ids[t+1]],1e-8));count++;}
    return total/Math.max(1,count);
  });
  input.dispose();output.dispose();
  const order=scores.map((value,i)=>({value,i})).sort((a,b)=>a.value-b.value);
  const topic=tokenizer.topics[order[0].i].id;
  // Explicit relevance guard; the NLL difference is not a confidence percentage.
  const lexicalMatch=(topicWords[topic]??[]).some(word=>words.includes(word));
  return{topic,accepted:lexicalMatch&&order[1].value-order[0].value>=.06};
}
self.onmessage=async event=>{
  const{type,id,question,blocks}=event.data;
  try{
    if(type==='load'){
      const started=performance.now();
      self.regeneratorRuntime={};
      importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js','https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tf-backend-wasm.min.js');
      tf=self.tf;
      tf.wasm.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');tf.wasm.setThreadsCount(1);
      await tf.setBackend('wasm');await tf.ready();
      tokenizer=await(await fetch('/models/fieldshift-mini/tokenizer.json')).json();
      index=new Map(tokenizer.vocabulary.map((word,i)=>[word,i]));
      model=await tf.loadLayersModel('/models/fieldshift-mini/model.json');
      const warm=tf.zeros([1,tokenizer.length],'int32'),output=model.predict(warm);await output.data();warm.dispose();output.dispose();
      metrics={model:'FieldShift Mini word LM (experimental)',parameters:model.countParams(),weightBytes:model.countParams()*4,loadMs:performance.now()-started,
        backend:tf.getBackend(),tensorBytes:tf.memory().numBytes,wasmHeapCapacityBytes:tf.backend().wasm?.HEAPU8?.byteLength??null,peakTotalBrowserMemoryBytes:null};
      self.postMessage({type:'ready',metrics});
    }else if(type==='select'&&model){
      const started=performance.now(),result=await score(question);
      const selected=result.accepted?blocks.findIndex(block=>(kindFor[result.topic]??[]).includes(block.kind)):-1;
      self.postMessage({type:'selection',id,index:selected<0?null:selected,topic:result.topic,accepted:result.accepted,
        metrics:{...metrics,inferenceMs:performance.now()-started,topic:result.topic,accepted:result.accepted}});
    }else if(type==='generate'&&model){
      // Developer evaluation only. The application never displays these raw words.
      const ids=encode(`question ${question} answer`),words=[];
      for(let step=0;step<Math.min(event.data.maxWords??12,16)&&ids.length<tokenizer.length;step++){
        const input=tf.tensor2d([Array.from({length:tokenizer.length},(_,i)=>ids[i]??0)],[1,tokenizer.length],'int32');
        const output=model.predict(input),data=await output.array(),next=data[0][ids.length-1];
        let best=2;for(let i=1;i<next.length;i++)if(next[i]>next[best])best=i;
        input.dispose();output.dispose();if(best===2)break;ids.push(best);words.push(tokenizer.vocabulary[best]);
      }
      self.postMessage({type:'generation',id,text:words.join(' ')});
    }
  }catch(error){self.postMessage({type:'error',id,message:error.message});}
};
