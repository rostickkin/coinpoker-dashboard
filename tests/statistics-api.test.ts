import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleRequest,pruneEvents,type StatisticsEnvironment,type SqlDatabase,type SqlStatement} from '../workers/statistics/src/index.ts';
import {parseUsageEvent,parseProjectTotals,type UsageEvent} from '../src/statistics/protocol.ts';

const origin='https://rostickkin.github.io',now=Date.now();
const visitorId='00000000-0000-4000-8000-000000000001';
const event=(patch:Record<string,unknown>={}):UsageEvent=>({schemaVersion:1,eventId:crypto.randomUUID(),visitorId,type:'visit',occurredAt:new Date(now).toISOString(),...patch} as UsageEvent);

function setup(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../workers/statistics/migrations/0001_statistics.sql',import.meta.url),'utf8'));
 class Statement implements SqlStatement {
  readonly sql:string;readonly args:(string|number|null)[];
  constructor(sql:string,args:(string|number|null)[]=[]){this.sql=sql;this.args=args;}
  bind(...args:(string|number|null)[]){return new Statement(this.sql,args);}
  async first<T>(){return sqlite.prepare(this.sql).get(...this.args) as T??null;}
 }
 const DB:SqlDatabase={prepare:sql=>new Statement(sql),async batch(statements){
  sqlite.exec('BEGIN');
  try {const results=statements.map(s=>{const q=s as Statement;return {results:sqlite.prepare(q.sql).all(...q.args)};});sqlite.exec('COMMIT');return results;}
  catch(error){sqlite.exec('ROLLBACK');throw error;}
 }};
 const env:StatisticsEnvironment={DB,ALLOWED_ORIGINS:origin,RATE_LIMITER:{limit:async()=>({success:true})}};
 const post=(body:unknown,extra:Record<string,string>={})=>handleRequest(new Request('https://stats.example/events',{method:'POST',headers:{origin,'content-type':'application/json',...extra},body:JSON.stringify(body)}),env,now);
 const totals=async()=>{const r=await handleRequest(new Request('https://stats.example/statistics',{headers:{origin}}),env,now);assert.equal(r.status,200);return await r.json() as Record<string,unknown>;};
 return {sqlite,env,post,totals};
}

test('usage events accept only bounded numeric summaries and reject private/unknown properties',()=>{
 const visit=event();assert.deepEqual(parseUsageEvent(visit,now),visit);
 const imported=event({type:'import',hands:1_000_000,files:4,bytes:2_000_000});
 assert.deepEqual(parseUsageEvent(imported,now),imported);
 for(const body of [{...visit,filename:'private.txt'},{...visit,hands:2},{...imported,hands:-1},{...imported,files:1.5},{...imported,bytes:Infinity},{...imported,hands:100_000_001},{...visit,visitorId:'not-an-id'},{...visit,schemaVersion:2},null])assert.equal(parseUsageEvent(body,now),null);
 assert.equal(parseUsageEvent(event({occurredAt:new Date(now-8*86400000).toISOString()}),now),null);
 assert.equal(parseUsageEvent(event({occurredAt:new Date(now+6*60000).toISOString()}),now),null);
});

test('SQLite atomically counts a visit and import once, with no hand or filename storage',async()=>{
 const s=setup();
 const visit=event(),imported=event({type:'import',hands:1_000_000,files:4,bytes:2_000_000});
 assert.equal((await s.post(visit)).status,204);assert.equal((await s.post(imported)).status,204);
 assert.equal((await s.post(visit)).status,204);assert.equal((await s.post(imported)).status,204);
 const totals=await s.totals();
 assert.deepEqual([totals.totalVisits,totals.uniqueVisitors,totals.databasesLoaded,totals.handsProcessed,totals.filesImported,totals.dataProcessed],[1,1,1,1_000_000,4,2_000_000]);
 assert.ok(parseProjectTotals(totals));
 assert.equal(s.sqlite.prepare('SELECT COUNT(*) AS n FROM usage_events').get()!.n,2);
 assert.equal((await s.post({...imported,hands:2})).status,409);
 assert.equal((await s.totals()).handsProcessed,1_000_000);
 s.sqlite.close();
});

test('different sessions increment visits while a browser is counted once',async()=>{
 const s=setup();
 await Promise.all([s.post(event()),s.post(event()),s.post(event({visitorId:crypto.randomUUID()}))]);
 const totals=await s.totals();assert.equal(totals.totalVisits,3);assert.equal(totals.uniqueVisitors,2);
 s.sqlite.close();
});

test('origin, body size, payload, method and rate-limit failures never change totals',async()=>{
 const s=setup();
 assert.equal((await s.post(event(),{origin:'https://untrusted.example'})).status,403);
 assert.equal((await s.post(event(),{origin:''})).status,403);
 assert.equal((await s.post({...event(),privateData:'x'.repeat(3000)})).status,413);
 assert.equal((await s.post({...event(),privateData:'private'})).status,400);
 assert.equal((await handleRequest(new Request('https://stats.example/events',{method:'PUT',headers:{origin}}),s.env,now)).status,405);
 s.env.RATE_LIMITER.limit=async()=>({success:false});
 const limited=await s.post(event());assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
 assert.equal((await s.totals()).totalVisits,0);s.sqlite.close();
});

test('API returns only public aggregates with browser CORS and bounded cache lifetime',async()=>{
 const s=setup();
 const preflight=await handleRequest(new Request('https://stats.example/events',{method:'OPTIONS',headers:{origin}}),s.env,now);
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
 const response=await handleRequest(new Request('https://stats.example/statistics',{headers:{origin}}),s.env,now);
 assert.equal(response.headers.get('cache-control'),'public, max-age=300');
 assert.equal(response.headers.get('vary'),'Origin');
 assert.equal(JSON.stringify(await response.json()).includes(visitorId),false);
 s.env.DB.batch=async()=>{throw Error('secret database detail');};
 const failed=await s.post(event());assert.equal(failed.status,503);assert.equal((await failed.text()).includes('secret'),false);
 s.sqlite.close();
});

test('event pruning keeps all-time totals and visitors, and old replays are rejected',async()=>{
 const s=setup(),old=event({occurredAt:new Date(now-6*86400000).toISOString()});
 await s.post(old);
 s.sqlite.prepare('UPDATE usage_events SET received_at = ?').run(now-9*86400000);
 await pruneEvents(s.env.DB,now);
 assert.equal(s.sqlite.prepare('SELECT COUNT(*) AS n FROM usage_events').get()!.n,0);
 assert.equal((await s.totals()).totalVisits,1);assert.equal((await s.totals()).uniqueVisitors,1);
 assert.equal(parseUsageEvent(old,now+2*86400000),null);s.sqlite.close();
});

test('untrusted aggregate responses must contain finite integer totals and valid dates',()=>{
 const totals={schemaVersion:1,totalVisits:2,uniqueVisitors:1,databasesLoaded:1,handsProcessed:10,filesImported:1,dataProcessed:100,startedAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};
 assert.deepEqual(parseProjectTotals(totals),totals);
 for(const value of [{...totals,totalVisits:-1},{...totals,handsProcessed:'10'},{...totals,startedAt:'garbage'},{...totals,dataProcessed:Number.MAX_VALUE},null])assert.equal(parseProjectTotals(value),null);
});
