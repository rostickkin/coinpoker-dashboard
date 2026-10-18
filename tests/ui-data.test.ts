import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scanHands,scanLines} from '../src/parser/scanner.ts';
import {processHand} from '../src/import/core.ts';
import {Aggregate} from '../src/metrics/aggregate.ts';
import {anteKey,limitKey,limitLabel,limitFilters,playerOptions,playerLabel,fact,query,defaults,type Database} from '../src/ui/data.ts';
import {buildSessions} from '../src/metrics/sessions.ts';
import {available,missing,rational,add} from '../src/core/value.ts';
async function dataset(){const raw=fs.readFileSync('tests/fixtures/900000004.txt');async function* chunks(){yield raw;}const facts=[];const aggregate=new Aggregate();for await(const h of scanHands(scanLines(chunks()))){const p=processHand(h);aggregate.push(p);facts.push(fact(p));}return {facts,aggregate};}
const db={filename:'test',limits:[],antes:[],positions:[],players:[],timing:{}} as unknown as Database;
test('Splash total retains complete and partial amounts with unknown-hand coverage',async()=>{
 const {facts}=await dataset();const source=facts[0]!;
 const input=[{...source,hand:{...source.hand,splashType:'regular' as const},splash:rational(720n),splashShared:rational(120n)},{...source,hand:{...source.hand,splashType:'regular' as const},splash:null,splashShared:rational(120n)},{...source,hand:{...source.hand,splashType:'regular' as const},splash:null,splashShared:null}];
 const r=query(input,[],defaults,db,true);assert.equal(r.summary.splash,8.4);assert.equal(r.summary.splashUnknown,2);assert.equal(r.summary.splashIncluded,2);assert.equal(r.summary.splashEvents,3);
 for(const tab of ['Days','Months','Limits','Positions'] as const)assert.equal(r.rows[tab][0]!.summary.splash,8.4);
 assert.equal(query([input[2]!],[],defaults,db,true).summary.splash,null);assert.equal(query([],[],defaults,db,true).summary.splash,0);
});
test('fee rates normalize each hand BB and exclude unknown fees and invalid BB',async()=>{
 const {facts}=await dataset();const source=facts[0]!;
 const input=[100n,200n,100n,0n].map((bb,i)=>({...source,hand:{...source.hand,bigBlind:bb},hero:{...source.hero,heroAttributedRake:i===2?missing<bigint>('RAKE_ALLOCATION_UNKNOWN'):available(100n),heroAttributedSplashFee:i===2?missing<bigint>('SUMMARY_FEE_ABSENT'):available(20n)}}));
 const r=query(input,[],defaults,db,true);assert.equal(r.summary.rakeBB100,75);assert.equal(r.summary.feeBB100,15);assert.equal(r.summary.rakeBBCount,2);assert.equal(r.summary.feeBBCount,2);
 for(const tab of ['Days','Months','Positions'] as const){assert.equal(r.rows[tab][0]!.summary.rakeBB100,75);assert.equal(r.rows[tab][0]!.summary.feeBB100,15);}
 assert.equal(r.rows.Limits.find(r=>r.key===limitKey(input[0]!.hand))!.summary.rakeBB100,100);assert.equal(r.rows.Limits.find(r=>r.key===limitKey(input[1]!.hand))!.summary.feeBB100,10);
 const empty=query([],[],defaults,db,true).summary;assert.equal(empty.rakeBB100,null);assert.equal(empty.feeBB100,null);
 const zero=query([{...source,hero:{...source.hero,heroAttributedRake:available(0n),heroAttributedSplashFee:available(0n)}}],[],defaults,db,true).summary;assert.equal(zero.rakeBB100,0);assert.equal(zero.feeBB100,0);
});
test('Splash Fee sums Hero attribution and excludes unavailable allocations in cards and groups',async()=>{const {facts}=await dataset();const source=facts[0]!;const cases=[available(20n),available(0n),missing<bigint>('RAKE_ALLOCATION_UNKNOWN'),missing<bigint>('SUMMARY_FEE_ABSENT')];const input=cases.map((fee,i)=>({...source,hand:{...source.hand,handId:'fee-'+i,handSplashFee:i===3?null:20n},hero:{...source.hero,heroAttributedSplashFee:fee}}));const r=query(input,[],defaults,db,true);assert.equal(r.summary.fee,0.20);assert.equal(r.summary.feeCount,2);for(const tab of ['Days','Months','Limits','Positions'] as const){assert.equal(r.rows[tab][0]!.summary.fee,0.20);assert.equal(r.rows[tab][0]!.summary.feeCount,2);}});
test('UI chart currency/BB final points reconcile with authoritative Aggregate',async()=>{const {facts,aggregate}=await dataset();const r=query(facts,buildSessions(facts.flatMap(f=>f.interval?[f.interval]:[])),defaults,db,true);assert.equal(r.summary.net,aggregate.net);const last=r.points.at(-1)!;assert.equal(last.currency[0],Number(aggregate.net)/100);assert.equal(last.currency[0],last.currency[1]!+last.currency[2]!);assert.equal(last.bb[0],r.summary.bb);assert.equal(r.rows.Days[0]?.summary.net,r.summary.net);});
test('empty filters return unavailable rates and aligned empty graph/table universe',async()=>{const {facts}=await dataset();const r=query(facts,[],{...defaults,limits:['999']},db,true);assert.equal(r.summary.hands,0);assert.equal(r.summary.bb100,null);assert.equal(r.summary.stats.vpip?.rate,null);assert.equal(r.points.length,0);assert.equal(r.rows.Limits.length,0);});

test('ante groups equivalent ratios across stakes and scopes chart, tables, hours and hourly rate',async()=>{
 const {facts}=await dataset(),source=facts[0]!,start=source.interval!.start;
 const input=[[100n,16n],[200n,32n],[200n,50n]].map(([bigBlind,ante],i)=>({...source,hand:{...source.hand,handId:String(i),bigBlind:bigBlind!,ante:ante!},interval:{...source.interval!,handId:String(i),start:start+i*600,end:start+i*600+60}}));
 const sessions=buildSessions(input.map(f=>f.interval));
 const selected=anteKey(input[0]!.hand),r=query(input,sessions,{...defaults,ante:selected},db,true);
 assert.equal(selected,anteKey(input[1]!.hand));assert.notEqual(selected,anteKey(input[2]!.hand));
 assert.equal(r.summary.hands,2);assert.equal(r.points.length,2);assert.equal(r.summary.hours,120/3600);
 assert.equal(r.summary.hourly,6.9/(120/3600));
 for(const rows of Object.values(r.rows))assert.equal(rows.reduce((sum,row)=>sum+row.summary.hands,0),2);
 assert.equal(anteKey({...input[0]!.hand,ante:null}),'0/1');
 assert.equal(query(input,sessions,{...defaults,ante:'1/4'},db,true).summary.hands,1);
});

test('EV totals reconcile with currency and BB graph endpoints; zero hours and empty results are unavailable',async()=>{
 const {facts}=await dataset(),source=facts[0]!;
 const input=[100n,200n].map((bigBlind,i)=>({...source,hand:{...source.hand,bigBlind},ev:{...source.ev!,availableAdjustment:rational(BigInt(i+1)*125n,3n)}}));
 const r=query(input,buildSessions(input.flatMap(f=>f.interval?[f.interval]:[])),defaults,db,true);
 assert.equal(r.summary.evNet,8.15);assert.equal(r.summary.evNet,r.points.at(-1)!.currency[3]);assert.ok(Math.abs(r.summary.evBB!-r.points.at(-1)!.bb[3]!)<1e-9);
 assert.equal(r.summary.hourly,6.9/r.summary.hours);
 assert.equal(query([{...source,interval:null}],[],defaults,db,true).summary.hourly,null);
 const empty=query([],[],defaults,db,true).summary;assert.equal(empty.evNet,null);assert.equal(empty.evBB,null);assert.equal(empty.hourly,null);
});
test('separate exact EV correction summation matches core Aggregate with mixed BB and unavailable facts',async()=>{const {facts}=await dataset();const source=facts[0]!;const expanded=Array.from({length:30},(_,i)=>{const f={...source,hand:{...source.hand,bigBlind:i%2?200n:100n}};const ev={...f.ev!,availableAdjustment:rational(BigInt(i),BigInt(i+7)),adjustedResult:available(add(rational(f.hero.netWon.value!),rational(BigInt(i),BigInt(i+7))))};return {...f,ev};});const core=new Aggregate();for(const f of expanded)core.push({hand:f.hand,hero:f.hero,allInEV:f.ev} as Parameters<Aggregate['push']>[0]);const r=query(expanded,[],defaults,db,true);assert.equal(r.summary.evBB100,core.result().evBB100);assert.ok(Math.abs(r.points.at(-1)!.bb[3]!*100/expanded.length-r.summary.evBB100!)<1e-9);});

test('hourly hand rates use filtered hours, include non-financial hands and stay unavailable without playing time',async()=>{
 const {facts}=await dataset(),source=facts[0]!,start=source.interval!.start;
 const input=Array.from({length:3},(_,i)=>({...source,players:i===2?2:6,hand:{...source.hand,handId:String(i)},interval:{...source.interval!,handId:String(i),start:start+i*600,end:start+i*600+60},hero:i===2?{...source.hero,netWon:missing<bigint>('UNKNOWN_MONETARY_LINE')}:source.hero}));
 const sessions=buildSessions(input.map(f=>f.interval)),r=query(input,sessions,defaults,db,true);
 assert.equal(r.summary.handsPerHour,3/(1260/3600));
 for(const rows of Object.values(r.rows))for(const row of rows){assert.equal(row.summary.handsPerHour,row.summary.hands/row.summary.hours);assert.equal(row.summary.hourly,Number(row.summary.net)/100/row.summary.hours);}
 const selected=query(input,sessions,{...defaults,players:'6'},db,true);assert.equal(selected.summary.handsPerHour,60);assert.equal(selected.summary.hourly,6.9/(120/3600));
 const nonFinancial=query(input,sessions,{...defaults,players:'2'},db,true).summary;assert.equal(nonFinancial.handsPerHour,60);assert.equal(nonFinancial.hourly,null);
 assert.equal(query([{...source,interval:null}],[],defaults,db,true).summary.handsPerHour,null);
 assert.equal(query([],sessions,defaults,db,true).summary.handsPerHour,null);
});

test('Limits separate monetary antes, sort numerically and select the exact stake and ante group',async()=>{
 const {facts}=await dataset(),source=facts[0]!,start=source.interval!.start;
 const input=[[200n,50n],[200n,32n],[100n,16n],[200n,32n],[1000n,0n]].map(([bigBlind,ante],i)=>({...source,hand:{...source.hand,handId:String(i),bigBlind:bigBlind!,ante:ante!},interval:{...source.interval!,handId:String(i),start:start+i*600,end:start+i*600+60}}));
 const sessions=buildSessions(input.map(f=>f.interval)),r=query(input,sessions,defaults,db,true);
 assert.deepEqual(r.rows.Limits.map(row=>limitLabel(row.key)),['NL100 (0.16)','NL200 (0.32)','NL200 (0.5)','NL1000 (0)']);
 assert.deepEqual(r.rows.Limits.map(row=>row.summary.hands),[1,2,1,1]);
 assert.equal(r.rows.Limits.reduce((n,row)=>n+row.summary.net,0n),r.summary.net);
 for(const row of r.rows.Limits){const selected=query(input,sessions,{...defaults,...limitFilters(row.key)},db,true);assert.equal(selected.summary.hands,row.summary.hands);assert.equal(selected.summary.hours,row.summary.hours);assert.equal(selected.summary.handsPerHour,row.summary.handsPerHour);assert.equal(selected.summary.hourly,row.summary.hourly);}
 assert.equal(limitKey({...source.hand,ante:null}),limitKey({...source.hand,ante:0n}));
});

test('Players always offers HU through 6-max and adds only observed larger counts in numeric order',()=>{
 assert.deepEqual(playerOptions([]).map(playerLabel),['HU','3-max','4-max','5-max','6-max']);
 assert.deepEqual(playerOptions(['10','2','8']).map(playerLabel),['HU','3-max','4-max','5-max','6-max','8-max','10-max']);
 assert.deepEqual(playerOptions(['10','9','8','7','6']),['2','3','4','5','6','7','8','9','10']);
});
