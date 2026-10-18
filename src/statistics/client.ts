import {EVENT_MAX_AGE,SESSION_IDLE,isIdentifier,parseProjectTotals,parseUsageEvent,type ProjectTotals,type UsageEvent} from './protocol.ts';

export interface StatisticsStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
interface ClientOptions {
 endpoint:string;
 storage?:StatisticsStorage;
 fetch?:(url:string,init?:RequestInit)=>Promise<Response>;
 now?:()=>number;
}
export interface StatisticsSnapshot {
 status:'unconfigured'|'loading'|'ready'|'unavailable';
 sharing:boolean;
 totals:ProjectTotals|null;
}
interface Session {eventId:string;lastActive:number}
interface StoredState {sharing:boolean;visitorId:string|null;session:Session|null;pending:UsageEvent[]}
const STORAGE_KEY='coinpoker.statistics.v1';
const MAX_PENDING=32;

function safeEndpoint(input:string):string {
 try {
  const url=new URL(input);
  if(url.username||url.password||url.search||url.hash)return '';
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))return '';
  return url.href.replace(/\/$/,'');
 }catch{return '';}
}

export function createStatisticsClient(options:ClientOptions){
 const endpoint=safeEndpoint(options.endpoint),now=options.now??Date.now,network=options.fetch??globalThis.fetch.bind(globalThis);
 const state:StoredState={sharing:true,visitorId:null,session:null,pending:[]};
 if(endpoint){
  try {
   const saved=JSON.parse(options.storage?.getItem(STORAGE_KEY)??'null') as Partial<StoredState>|null;
   if(saved&&typeof saved==='object'){
    state.sharing=saved.sharing!==false;state.visitorId=isIdentifier(saved.visitorId)?saved.visitorId:null;
    if(saved.session&&isIdentifier(saved.session.eventId)&&Number.isFinite(saved.session.lastActive)&&saved.session.lastActive<=now()+5*60000)state.session=saved.session;
    if(state.sharing&&state.visitorId&&Array.isArray(saved.pending))state.pending=saved.pending.slice(-MAX_PENDING).flatMap(value=>{const event=parseUsageEvent(value,now());return event&&event.visitorId===state.visitorId?[event]:[];});
   }
  }catch{/* Disabled or malformed storage falls back to this tab's memory. */}
 }
 let snapshot:StatisticsSnapshot={status:endpoint?'loading':'unconfigured',sharing:state.sharing,totals:null};
 const listeners=new Set<()=>void>(),attempts=new Map<string,number>();
 let flushing:Promise<void>|null=null,loading:Promise<void>|null=null,loadedAt=-Infinity,lastPersisted=-Infinity;
 let currentRequest:AbortController|null=null;
 const publish=(patch:Partial<StatisticsSnapshot>)=>{snapshot={...snapshot,...patch};for(const listener of listeners)listener();};
 function save(){if(!endpoint)return;try{options.storage?.setItem(STORAGE_KEY,JSON.stringify(state));lastPersisted=now();}catch{/* Collection never depends on storage availability. */}}
 function synchronizeSharing(){
  if(!endpoint)return;
  try {
   const saved=JSON.parse(options.storage?.getItem(STORAGE_KEY)??'null') as {sharing?:unknown}|null;
   if(typeof saved?.sharing!=='boolean'||saved.sharing===state.sharing)return;
   state.sharing=saved.sharing;
   if(!state.sharing){currentRequest?.abort();state.pending=[];state.session=null;attempts.clear();}
   publish({sharing:state.sharing});
  }catch{/* Other tabs and malformed storage cannot interrupt analysis. */}
 }
 function persist(){synchronizeSharing();save();}

 async function deliver(){
  while(endpoint&&state.sharing&&state.pending.length){
   // Retain exhausted events for a later page load without blocking fresh events.
   const event=state.pending.find(pending=>(attempts.get(pending.eventId)??0)<3);
   if(!event)break;
   if(!parseUsageEvent(event,now())){state.pending=state.pending.filter(pending=>pending.eventId!==event.eventId);save();continue;}
   const count=attempts.get(event.eventId)??0;
   attempts.set(event.eventId,count+1);
   const controller=new AbortController();currentRequest=controller;
   try {
    const response=await network(endpoint+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});
    if(!response.ok&&![400,403,404,409,413,415,422].includes(response.status))break;
    state.pending=state.pending.filter(pending=>pending.eventId!==event.eventId);attempts.delete(event.eventId);synchronizeSharing();save();
   }catch{break;}
   finally{if(currentRequest===controller)currentRequest=null;}
  }
 }
 function flush():Promise<void>{
  synchronizeSharing();
  if(!endpoint||!state.sharing)return Promise.resolve();
  if(!flushing)flushing=deliver().finally(()=>{flushing=null;});
  return flushing;
 }
 function enqueue(event:UsageEvent){
  state.pending=state.pending.filter(pending=>Date.parse(pending.occurredAt)>=now()-EVENT_MAX_AGE).slice(-(MAX_PENDING-1));
  state.pending.push(event);
  // Bound retry bookkeeping as well as the persistent queue.
  for(const key of attempts.keys())if(!state.pending.some(pending=>pending.eventId===key))attempts.delete(key);
  save();
 }
 function activity(){
  synchronizeSharing();
  if(!endpoint||!state.sharing)return;
  const timestamp=now();
  if(!state.visitorId)state.visitorId=crypto.randomUUID();
  if(!state.session||timestamp-state.session.lastActive>=SESSION_IDLE||state.session.lastActive>timestamp+5*60000){
   const eventId=crypto.randomUUID();state.session={eventId,lastActive:timestamp};
   enqueue({schemaVersion:1,eventId,visitorId:state.visitorId,type:'visit',occurredAt:new Date(timestamp).toISOString()});
   void flush();
  }else{state.session.lastActive=timestamp;if(timestamp-lastPersisted>=60000)save();}
 }
 async function loadTotals(){
  if(!endpoint||now()-loadedAt<5*60000)return;
  if(loading)return loading;
  loading=(async()=>{
   try {
    const response=await network(endpoint+'/statistics',{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw Error('Unavailable');
    const totals=parseProjectTotals(await response.json());
    if(!totals)throw Error('Invalid statistics');
    loadedAt=now();publish({totals,status:'ready'});
   }catch{publish({status:'unavailable'});}
  })().finally(()=>{loading=null;});
  return loading;
 }
 return {
  getSnapshot:()=>snapshot,
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  async start(){if(!endpoint)return;activity();await Promise.all([loadTotals(),flush()]);},
  activity,persist,flush,loadTotals,synchronizeSharing,
  async recordImport(summary:{hands:number;files:number;bytes:number}){
   if(!endpoint||!state.sharing)return;
   activity();
   if(!state.sharing)return;
   const event={schemaVersion:1,eventId:crypto.randomUUID(),visitorId:state.visitorId,type:'import',occurredAt:new Date(now()).toISOString(),hands:summary.hands,files:summary.files,bytes:summary.bytes};
   const parsed=parseUsageEvent(event,now());if(!parsed)return;
   enqueue(parsed);await flush();
  },
  setSharing(sharing:boolean){
   if(!endpoint)return;
   state.sharing=sharing;
   if(!sharing){currentRequest?.abort();state.pending=[];state.session=null;attempts.clear();}
   save();publish({sharing});if(sharing)activity();
  },
 };
}
export type StatisticsClient=ReturnType<typeof createStatisticsClient>;
