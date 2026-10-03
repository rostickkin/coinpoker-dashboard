import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scanHands,scanLines} from '../src/parser/scanner.ts';
import {processHand} from '../src/import/core.ts';
import {Aggregate} from '../src/metrics/aggregate.ts';
import {fact,query,defaults,type Database} from '../src/ui/data.ts';
import {buildSessions} from '../src/metrics/sessions.ts';
import {available,missing,rational,add} from '../src/core/value.ts';
async function dataset(){const raw=fs.readFileSync('tests/fixtures/900000004.txt');async function* chunks(){yield raw;}const facts=[];const aggregate=new Aggregate();for await(const h of scanHands(scanLines(chunks()))){const p=processHand(h);aggregate.push(p);facts.push(fact(p));}return {facts,aggregate};}
const db={filename:'test',limits:[],tables:[],positions:[],players:[],timing:{}} as unknown as Database;
test('fee rates normalize each hand BB and exclude unknown fees and invalid BB',async()=>{
 const {facts}=await dataset();const source=facts[0]!;
 const input=[100n,200n,100n,0n].map((bb,i)=>({...source,hand:{...source.hand,bigBlind:bb},hero:{...source.hero,heroAttributedRake:i===2?missing<bigint>('RAKE_ALLOCATION_UNKNOWN'):available(100n),heroAttributedSplashFee:i===2?missing<bigint>('SUMMARY_FEE_ABSENT'):available(20n)}}));
 const r=query(input,[],defaults,db,true);assert.equal(r.summary.rakeBB100,75);assert.equal(r.summary.feeBB100,15);assert.equal(r.summary.rakeBBCount,2);assert.equal(r.summary.feeBBCount,2);
 for(const tab of ['Days','Months','Positions'] as const){assert.equal(r.rows[tab][0]!.summary.rakeBB100,75);assert.equal(r.rows[tab][0]!.summary.feeBB100,15);}
 assert.equal(r.rows.Limits.find(r=>r.key==='100')!.summary.rakeBB100,100);assert.equal(r.rows.Limits.find(r=>r.key==='200')!.summary.feeBB100,10);
 const empty=query([],[],defaults,db,true).summary;assert.equal(empty.rakeBB100,null);assert.equal(empty.feeBB100,null);
 const zero=query([{...source,hero:{...source.hero,heroAttributedRake:available(0n),heroAttributedSplashFee:available(0n)}}],[],defaults,db,true).summary;assert.equal(zero.rakeBB100,0);assert.equal(zero.feeBB100,0);
});
test('Splash Fee sums Hero attribution and excludes unavailable allocations in cards and groups',async()=>{const {facts}=await dataset();const source=facts[0]!;const cases=[available(20n),available(0n),missing<bigint>('RAKE_ALLOCATION_UNKNOWN'),missing<bigint>('SUMMARY_FEE_ABSENT')];const input=cases.map((fee,i)=>({...source,hand:{...source.hand,handId:'fee-'+i,handSplashFee:i===3?null:20n},hero:{...source.hero,heroAttributedSplashFee:fee}}));const r=query(input,[],defaults,db,true);assert.equal(r.summary.fee,0.20);assert.equal(r.summary.feeCount,2);for(const tab of ['Days','Months','Limits','Positions'] as const){assert.equal(r.rows[tab][0]!.summary.fee,0.20);assert.equal(r.rows[tab][0]!.summary.feeCount,2);}});
test('UI chart currency/BB final points reconcile with authoritative Aggregate',async()=>{const {facts,aggregate}=await dataset();const r=query(facts,buildSessions(facts.flatMap(f=>f.interval?[f.interval]:[])),defaults,db,true);assert.equal(r.summary.net,aggregate.net);const last=r.points.at(-1)!;assert.equal(last.currency[0],Number(aggregate.net)/100);assert.equal(last.currency[0],last.currency[1]!+last.currency[2]!);assert.equal(last.bb[0],r.summary.bb);assert.equal(r.rows.Days[0]?.summary.net,r.summary.net);});
test('empty filters return unavailable rates and aligned empty graph/table universe',async()=>{const {facts}=await dataset();const r=query(facts,[],{...defaults,limits:['999']},db,true);assert.equal(r.summary.hands,0);assert.equal(r.summary.bb100,null);assert.equal(r.summary.stats.vpip?.rate,null);assert.equal(r.points.length,0);assert.equal(r.rows.Limits.length,0);});
test('separate exact EV correction summation matches core Aggregate with mixed BB and unavailable facts',async()=>{const {facts}=await dataset();const source=facts[0]!;const expanded=Array.from({length:30},(_,i)=>{const f={...source,hand:{...source.hand,bigBlind:i%2?200n:100n}};const ev={...f.ev!,availableAdjustment:rational(BigInt(i),BigInt(i+7)),adjustedResult:available(add(rational(f.hero.netWon.value!),rational(BigInt(i),BigInt(i+7))))};return {...f,ev};});const core=new Aggregate();for(const f of expanded)core.push({hand:f.hand,hero:f.hero,allInEV:f.ev} as Parameters<Aggregate['push']>[0]);const r=query(expanded,[],defaults,db,true);assert.equal(r.summary.evBB100,core.result().evBB100);assert.ok(Math.abs(r.points.at(-1)!.bb[3]!*100/expanded.length-r.summary.evBB100!)<1e-9);});
