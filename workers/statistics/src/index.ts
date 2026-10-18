import {canonicalEvent,parseUsageEvent,type ProjectTotals} from '../../../src/statistics/protocol.ts';

// A narrow structural interface keeps the collector testable against real SQLite.
export interface SqlStatement {
 bind(...values:(string|number|null)[]):SqlStatement;
 first<T>():Promise<T|null>;
}
export interface SqlDatabase {
 prepare(query:string):SqlStatement;
 batch(statements:SqlStatement[]):Promise<{results:unknown[]}[]>;
}
export interface StatisticsEnvironment {
 DB:SqlDatabase;
 ALLOWED_ORIGINS:string;
 RATE_LIMITER:{limit(options:{key:string}):Promise<{success:boolean}>};
}
interface StoredTotals {
 total_visits:number;unique_visitors:number;databases_loaded:number;
 hands_processed:number;files_imported:number;data_processed:number;started_at:number;updated_at:number;
}

class BodyTooLarge extends Error {}
async function readEventBody(request:Request):Promise<unknown> {
 if(Number(request.headers.get('content-length'))>2048)throw new BodyTooLarge();
 const reader=request.body?.getReader();
 if(!reader)throw Error('Missing body');
 const decoder=new TextDecoder('utf-8',{fatal:true});let size=0,text='';
 try {
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
   if(size>2048){await reader.cancel();throw new BodyTooLarge();}
   text+=decoder.decode(part.value,{stream:true});
  }
  return JSON.parse(text+decoder.decode());
 }finally{reader.releaseLock();}
}

export async function handleRequest(request:Request,env:StatisticsEnvironment,now=Date.now()):Promise<Response> {
 const origin=request.headers.get('origin'),allowed=env.ALLOWED_ORIGINS.split(',').map(value=>value.trim()).filter(Boolean);
 const headers=new Headers({'Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 if(origin&&allowed.includes(origin))headers.set('Access-Control-Allow-Origin',origin);
 const respond=(status:number,data?:unknown)=>{const outgoing=new Headers(headers);if(data!==undefined)outgoing.set('Content-Type','application/json');return new Response(data===undefined?null:JSON.stringify(data),{status,headers:outgoing});};
 if(origin&&!allowed.includes(origin))return respond(403,{error:'Origin is not allowed.'});
 const path=new URL(request.url).pathname;
 if(path!=='/statistics'&&path!=='/events')return respond(404,{error:'Not found.'});
 if(request.method==='OPTIONS'){
  if(!origin)return respond(403);
  headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type');headers.set('Access-Control-Max-Age','86400');return respond(204);
 }
 if(request.method==='GET'&&path==='/statistics'){
  try {
   const row=await env.DB.prepare('SELECT * FROM project_totals WHERE id = 1').first<StoredTotals>();
   if(!row)return respond(503,{error:'Statistics are temporarily unavailable.'});
   const totals:ProjectTotals={schemaVersion:1,totalVisits:row.total_visits,uniqueVisitors:row.unique_visitors,databasesLoaded:row.databases_loaded,handsProcessed:row.hands_processed,filesImported:row.files_imported,dataProcessed:row.data_processed,startedAt:new Date(row.started_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()};
   headers.set('Cache-Control','public, max-age=300');return respond(200,totals);
  }catch{return respond(503,{error:'Statistics are temporarily unavailable.'});}
 }
 if(request.method!=='POST'||path!=='/events')return respond(405,{error:'Method is not allowed.'});
 if(!origin)return respond(403,{error:'Origin is required.'});
 if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')return respond(415,{error:'Expected application/json.'});
 try {
  // The edge uses the network address for abuse limiting; it is never stored in D1.
  const {success}=await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')??'local'});
  if(!success){headers.set('Retry-After','60');return respond(429,{error:'Too many events.'});}
  let body:unknown;
  try {body=await readEventBody(request);}catch(error){return respond(error instanceof BodyTooLarge?413:400,{error:'Invalid event body.'});}
  const event=parseUsageEvent(body,now);
  if(!event)return respond(400,{error:'Invalid event.'});
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalEvent(event)));
  const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  const imported=event.type==='import'?event:null;
  // D1 batch is a transaction. Insert and triggers either all commit or all roll back.
  const result=await env.DB.batch([
   env.DB.prepare('INSERT INTO usage_events (event_id,visitor_id,kind,hands,files,bytes,occurred_at,received_at,payload_hash) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT (event_id) DO NOTHING').bind(event.eventId,event.visitorId,event.type,imported?.hands??0,imported?.files??0,imported?.bytes??0,Date.parse(event.occurredAt),now,hash),
   env.DB.prepare('SELECT payload_hash FROM usage_events WHERE event_id = ?').bind(event.eventId),
  ]);
  const stored=result[1]?.results[0] as {payload_hash:string}|undefined;
  if(!stored)return respond(503,{error:'Statistics are temporarily unavailable.'});
  if(stored.payload_hash!==hash)return respond(409,{error:'Event identifier was already used.'});
  return respond(204);
 }catch{return respond(503,{error:'Statistics are temporarily unavailable.'});}
}

export async function pruneEvents(db:SqlDatabase,now=Date.now()):Promise<void> {
 await db.batch([db.prepare('DELETE FROM usage_events WHERE received_at < ?').bind(now-8*86400000)]);
}

export default {
 fetch(request:Request,env:StatisticsEnvironment){return handleRequest(request,env);},
 scheduled(_controller:unknown,env:StatisticsEnvironment,context:{waitUntil(promise:Promise<unknown>):void}){context.waitUntil(pruneEvents(env.DB));},
};
