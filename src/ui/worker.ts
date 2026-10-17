import {sha256} from '@noble/hashes/sha2.js';
import {scanLines,scanHands} from '../parser/scanner.ts';
import {readableChunks} from '../import/browser.ts';
import {processHand,canonicalContent,Deduplicator,type ProcessedHand} from '../import/core.ts';
import {calculateEV,type EquityCache} from '../equity/allInEV.ts';
import {buildSessions,type Session} from '../metrics/sessions.ts';
import {anteKey,anteLabel,positionOrder,fact,query,type Fact,type Filters,type Database,defaults} from './data.ts';

let facts:Fact[]=[],sessions:Session[]=[],db:Database,ready=false,filters=defaults,request=0;
const send=(type:string,payload:unknown)=>postMessage({type,payload});
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
function compatible(q:Filters):Filters {
 return db?{...q,limits:q.limits.filter(v=>db.limits.includes(v)),positions:q.positions.filter(v=>db.positions.includes(v)),ante:db.antes.includes(q.ante)?q.ante:'',players:db.players.includes(q.players)?q.players:''}:q;
}
function reply(){if(db){filters=compatible(filters);send('result',{request,filters,result:query(facts,sessions,filters,db,ready)});}}

onmessage=async(event:MessageEvent<{type:string;files?:File[];filters?:Filters;request?:number}>)=>{
 const m=event.data;
 if(m.type==='query'){filters=m.filters!;request=m.request!;reply();return;}
 if(m.type!=='import')return;
 try {
  const files=m.files??[];
  if(!files.length||files.some(file=>!file.name.toLowerCase().endsWith('.txt')))throw Error('Choose CoinPoker .txt files.');
  const start=performance.now(),hash=sha256.create(),dedup=new Deduplicator(),queue:{p:ProcessedHand;f:Fact}[]=[],cache:EquityCache=new Map();
  const sources:Database['files']=[],totalBytes=files.reduce((sum,file)=>sum+file.size,0);
  let bytes=0,parsed=0,duplicates=0,conflicts=0,errors=0,last=0;
  facts=[];ready=false;
  for(const [index,file] of files.entries()){
   const fileHash=sha256.create();let foundHand=false;
   const stage=`Parsing & normalizing · file ${index+1}/${files.length} · ${file.name}`;
   send('progress',{stage,parsed,percent:totalBytes?100*bytes/totalBytes:0});
   async function* chunks(){for await(const chunk of readableChunks(file.stream())){bytes+=chunk.length;hash.update(chunk);fileHash.update(chunk);yield chunk;}}
   // Scan every file separately: files may omit their final newline or start with a BOM.
   for await(const raw of scanHands(scanLines(chunks()))){
    parsed++;
    const p=processHand(raw,{equity:false});
    if(/^\d+$/.test(p.hand.handId))foundHand=true;
    const accepted=dedup.accept(p.hand.handId,hex(sha256(new TextEncoder().encode(canonicalContent(raw)))),raw);
    if(accepted!=='insert'){if(accepted==='duplicate')duplicates++;else conflicts++;}
    else {
     errors+=p.hand.diagnostics.filter(d=>d.severity==='error').length;
     const f=fact(p);facts.push(f);
     if(p.hand.gameType==='BombPot'||p.hero.logicalShowdown.value===true&&p.ledger.actions.some(a=>a.allIn))queue.push({p,f});
     else f.ev=calculateEV(p.hand,p.ledger,p.pots,p.hero,cache);
    }
    if(performance.now()-last>160){send('progress',{stage,parsed,percent:totalBytes?100*bytes/totalBytes:0});last=performance.now();await new Promise(r=>setTimeout(r,0));}
   }
   if(!foundHand)throw Error(`No CoinPoker hands were found in ${file.name}.`);
   sources.push({name:file.name,size:file.size,hash:hex(fileHash.digest())});
  }
  facts.sort((a,b)=>(a.hand.startedAt?.ordinalSeconds??0)-(b.hand.startedAt?.ordinalSeconds??0)||a.hand.handId.localeCompare(b.hand.handId,undefined,{numeric:true}));
  sessions=buildSessions(facts.flatMap(f=>f.interval?[f.interval]:[]));
  const parseMs=performance.now()-start;
  db={filename:files.length===1?files[0]!.name:`${files.length} files`,files:sources,importedAt:new Date().toISOString(),parsed,unique:facts.length,duplicates,conflicts,errors,hash:hex(hash.digest()),start:facts[0]?.hand.startedAt?.dateKey??'',end:facts.at(-1)?.hand.startedAt?.dateKey??'',sessions:sessions.length,
   limits:[...new Set(facts.map(f=>f.hand.bigBlind.toString()))].sort((a,b)=>Number(a)-Number(b)),
   antes:[...new Set(facts.map(f=>anteKey(f.hand)))].sort((a,b)=>parseFloat(anteLabel(a))-parseFloat(anteLabel(b))),
   positions:positionOrder.filter(position=>facts.some(f=>(f.hero.position.value??'Unavailable')===position)),
   players:[...new Set(facts.map(f=>String(f.players)))].sort(),timing:{parseMs,firstDashboardMs:performance.now()-start}};
  reply();send('basicReady',null);
  const evStart=performance.now();
  for(let i=0;i<queue.length;i++){
   const {p,f}=queue[i]!;f.ev=calculateEV(p.hand,p.ledger,p.pots,p.hero,cache);queue[i]=undefined as unknown as typeof queue[number];
   send('progress',{stage:'Calculating All-in EV',parsed:facts.length,percent:100*(i+1)/queue.length});await new Promise(r=>setTimeout(r,0));
  }
  db.timing.evMs=performance.now()-evStart;db.timing.totalMs=performance.now()-start;ready=true;reply();send('complete',null);
 }catch(e){send('error',e instanceof Error?e.message:'Worker import failed.');}
};
