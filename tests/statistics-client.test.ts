import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStatisticsClient,type StatisticsStorage} from '../src/statistics/client.ts';
import type {UsageEvent} from '../src/statistics/protocol.ts';

class MemoryStorage implements StatisticsStorage {
 data=new Map<string,string>();
 getItem(key:string){return this.data.get(key)??null;}
 setItem(key:string,value:string){this.data.set(key,value);}
}
const totals={schemaVersion:1,totalVisits:1234,uniqueVisitors:300,databasesLoaded:600,handsProcessed:1_000_000,filesImported:900,dataProcessed:123456789,startedAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-18T00:00:00.000Z'};
function setup(storage:StatisticsStorage=new MemoryStorage()){
 let now=Date.now(),failing=false;const sent:UsageEvent[]=[],gets:string[]=[];
 const client=createStatisticsClient({endpoint:'https://stats.example/',storage,now:()=>now,fetch:async(url,init)=>{
  if(init?.method==='POST'){sent.push(JSON.parse(init.body as string));return new Response(null,{status:failing?503:204});}
  gets.push(String(url));return Response.json(totals);
 }});
 return {client,storage,sent,gets,advance:(ms:number)=>{now+=ms;},fail:(value:boolean)=>{failing=value;}};
}

test('missing or unsafe configuration creates no identifiers and makes no requests',async()=>{
 for(const endpoint of ['', 'http://untrusted.example','javascript:alert(1)']){
  const storage=new MemoryStorage();let calls=0;
  const client=createStatisticsClient({endpoint,storage,fetch:async()=>{calls++;throw Error();}});
  await client.start();await client.recordImport({hands:1,files:1,bytes:1});
  assert.equal(calls,0);assert.equal(storage.data.size,0);assert.equal(client.getSnapshot().status,'unconfigured');
 }
});

test('reloads and activity retain a visit until 30 minutes of inactivity',async()=>{
 const s=setup();await s.client.start();assert.equal(s.sent.length,1);assert.equal(s.sent[0]!.type,'visit');
 const reloaded=setup(s.storage);await reloaded.client.start();assert.equal(reloaded.sent.length,0);
 s.advance(29*60000);s.client.activity();await s.client.flush();assert.equal(s.sent.length,1);
 s.advance(30*60000+1);s.client.activity();await s.client.flush();assert.equal(s.sent.length,2);
 assert.equal(s.sent[0]!.visitorId,s.sent[1]!.visitorId);assert.notEqual(s.sent[0]!.eventId,s.sent[1]!.eventId);
});

test('successful import sends only allowlisted counts and reimport is another event',async()=>{
 const s=setup();await s.client.start();
 const summary={hands:1_000_000,files:4,bytes:1000,filename:'secret.txt',hash:'private',netWon:100};
 await s.client.recordImport(summary);await s.client.recordImport(summary);
 const imported=s.sent.filter(e=>e.type==='import');assert.equal(imported.length,2);
 assert.deepEqual(Object.keys(imported[0]!).sort(),['bytes','eventId','files','hands','occurredAt','schemaVersion','type','visitorId']);
 assert.equal(imported[0]!.hands,1_000_000);assert.notEqual(imported[0]!.eventId,imported[1]!.eventId);
 await s.client.recordImport({hands:0,files:1,bytes:2});assert.equal(s.sent.length,3);
});

test('failed delivery persists the event ID and retry cannot create another import',async()=>{
 const s=setup();await s.client.start();s.fail(true);
 await s.client.recordImport({hands:25,files:1,bytes:100});
 const failed=s.sent.at(-1)!;assert.equal(failed.type,'import');
 s.fail(false);await s.client.flush();assert.equal(s.sent.at(-1)!.eventId,failed.eventId);
 await s.client.flush();assert.equal(s.sent.filter(e=>e.type==='import').length,2);
});

test('network errors cannot escape and retries and persisted queue remain bounded',async()=>{
 const s=setup();await s.client.start();s.fail(true);
 await s.client.recordImport({hands:25,files:1,bytes:100});
 for(let i=0;i<8;i++)await s.client.flush();
 assert.equal(s.sent.filter(e=>e.type==='import').length,3);
 for(let i=0;i<100;i++)await s.client.recordImport({hands:25,files:1,bytes:100});
 assert.ok(JSON.stringify([...((s.storage as MemoryStorage).data.values())]).length<20_000);
 const broken=createStatisticsClient({endpoint:'https://stats.example',fetch:async()=>{throw Error('offline');}});
 await assert.doesNotReject(()=>broken.start());await assert.doesNotReject(()=>broken.recordImport({hands:1,files:1,bytes:1}));
});

test('opt-out is persistent and clears pending events while public totals remain readable',async()=>{
 const s=setup();await s.client.start();s.fail(true);await s.client.recordImport({hands:25,files:1,bytes:100});
 s.client.setSharing(false);const sent=s.sent.length;s.fail(false);await s.client.flush();
 await s.client.recordImport({hands:25,files:1,bytes:100});assert.equal(s.sent.length,sent);
 const reloaded=setup(s.storage);await reloaded.client.start();assert.equal(reloaded.sent.length,0);assert.equal(reloaded.client.getSnapshot().sharing,false);assert.equal(reloaded.client.getSnapshot().totals?.totalVisits,1234);
});

test('blocked storage works in memory and malformed aggregates remain unavailable',async()=>{
 const s=setup({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
 await s.client.start();await s.client.recordImport({hands:2,files:1,bytes:100});assert.equal(s.sent.length,2);
 const broken=createStatisticsClient({endpoint:'https://stats.example',fetch:async(_url,init)=>init?.method==='POST'?new Response(null,{status:204}):Response.json({...totals,totalVisits:'fake'})});
 await broken.start();assert.equal(broken.getSnapshot().totals,null);assert.equal(broken.getSnapshot().status,'unavailable');
});

test('opting out in one tab stops collection from another already-open tab',async()=>{
 const first=setup();await first.client.start();
 const second=setup(first.storage);await second.client.start();
 first.client.setSharing(false);
 await second.client.recordImport({hands:10,files:1,bytes:100});
 assert.equal(second.sent.length,0);assert.equal(second.client.getSnapshot().sharing,false);
});

test('an exhausted event does not block later imports after the network recovers',async()=>{
 const s=setup();s.fail(true);await s.client.start();await s.client.flush();await s.client.flush();
 assert.equal(s.sent.length,3);
 s.fail(false);await s.client.recordImport({hands:10,files:1,bytes:100});
 assert.equal(s.sent.length,4);assert.equal(s.sent.at(-1)!.type,'import');
});
