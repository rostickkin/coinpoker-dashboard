import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {scanLines,scanHands} from '../src/parser/scanner.ts';
import {parseHand} from '../src/parser/handParser.ts';
import {normalizeLedger} from '../src/normalize/ledger.ts';
import {buildPots} from '../src/pots/potBuilder.ts';
import {heroMetrics} from '../src/metrics/hero.ts';
import {calculateSplash} from '../src/special/splash.ts';
import {calculateEV,type EquityCache} from '../src/equity/allInEV.ts';
import {canonicalContent,Deduplicator,type ProcessedHand} from '../src/import/core.ts';
import {Aggregate} from '../src/metrics/aggregate.ts';
import {buildSessions,type Interval} from '../src/metrics/sessions.ts';
import {add,rational,money} from '../src/core/value.ts';
type Counts=Record<string,number>;
const baseline=JSON.parse(fs.readFileSync('analysis/inventory.json','utf8')) as {source:string;bytes:number;sha256:string;lines:number;hands:number;unique_ids:number;counts:Record<string,Counts>};
const source=process.argv.find(a=>a.startsWith('--source='))?.slice(9)??baseline.source;
const stringify=(x:unknown)=>JSON.stringify(x,(_,v:unknown)=>typeof v==='bigint'?v.toString():v);
const inc=(c:Counts,k:string,n=1)=>{c[k]=(c[k]??0)+n;};
const inventory={game:{} as Counts,stakes:{} as Counts,players:{} as Counts,actions:{} as Counts,run_variant:{} as Counts,forced:{} as Counts,forced_allin:{} as Counts,allin_street:{} as Counts,section:{} as Counts,splash:{} as Counts,fee:{} as Counts};
const diagnostics:Counts={},coverage:Counts={},evCoverage:Counts={},evReasons:Counts={},dedup=new Deduplicator(),aggregate=new Aggregate(),intervals:Interval[]=[],queue:ProcessedHand[]=[],cache:EquityCache=new Map();
const errors=fs.createWriteStream('analysis/phase2a-errors.jsonl'),traces=fs.createWriteStream('analysis/phase2a-regression-traces.jsonl');
const fixtures=new Set(fs.readdirSync('analysis/fixtures').map(f=>f.replace('.txt','')));
let hands=0,lastLine=0,duplicates=0,conflicts=0,bytes=0,parserMs=0,normalizationMs=0,factsMs=0,potMs=0,equityMs=0,peakRSS=0;
const hash=createHash('sha256'),start=performance.now();
async function* chunks(){for await(const chunk of fs.createReadStream(source,{highWaterMark:256*1024})){const b=chunk as Buffer;hash.update(b);bytes+=b.length;yield b;}}
async function write(stream:fs.WriteStream,value:unknown){if(!stream.write(stringify(value)+'\n'))await once(stream,'drain');}
const countEV=(p:ProcessedHand)=>{const e=p.allInEV!;inc(evCoverage,e.evCoverage);for(const reason of new Set(e.pots.flatMap(v=>v.reasonCodes)))inc(evReasons,reason);for(const pot of e.pots){if(pot.equities){let sum=rational(0n);for(const share of pot.equities.shares)sum=add(sum,share);if(sum.n!==sum.d)throw Error('Equity sum invariant');}}};
for await(const raw of scanHands(scanLines(chunks()))){lastLine=raw.endLine;let t=performance.now();const hand=parseHand(raw);parserMs+=performance.now()-t;
 const accepted=dedup.accept(hand.handId,createHash('sha256').update(canonicalContent(raw)).digest('hex'),raw);if(accepted!=='insert'){if(accepted==='duplicate')duplicates++;else conflicts++;continue;}
 hands++;t=performance.now();const ledger=normalizeLedger(hand);normalizationMs+=performance.now()-t;t=performance.now();const pots=buildPots(ledger);potMs+=performance.now()-t;t=performance.now();const hero=heroMetrics(hand,ledger,pots),splash=calculateSplash(hand);factsMs+=performance.now()-t;
 const p:ProcessedHand={hand,ledger,pots,hero,splash,allInEV:null};
 inc(inventory.game,hand.gameRaw);inc(inventory.stakes,hand.stakesRaw);inc(inventory.players,String(hand.players.length));inc(inventory.run_variant,'Hand was run '+hand.runMode);inc(inventory.fee,hand.handSplashFee===null?'ABSENT':hand.handSplashFee.toString());
 const forcedNames:Record<string,string>={ante:'ante',sb:'small blind',bb:'big blind',autoBB:'auto big blind'};
 for(const a of hand.actions){if(forcedNames[a.kind]){inc(inventory.forced,forcedNames[a.kind]!);if(a.explicitAllIn)inc(inventory.forced_allin,forcedNames[a.kind]!);}else if(a.kind!=='cashout')inc(inventory.actions,a.kind);if(a.kind==='ALLIN')inc(inventory.allin_street,a.street);if(a.kind==='cashout')inc(coverage,'cashOutRecords');}
 for(const token of hand.tokens.filter(t=>t.category==='section')){const name=/^\*\*\* (.+?) \*\*\*/.exec(token.raw)![1]!;inc(inventory.section,name);}
 if(hand.splashType!=='none'){inc(inventory.splash,hand.splashType);inc(coverage,'splashEvents');inc(coverage,'heroSplashRatioUnknown');}
 for(const [key,value] of Object.entries(hero))inc(coverage,key+'_'+value.status);
 if(hand.handSplashFee!==null)inc(coverage,'splashFeeParsed');if(pots.value)inc(coverage,'potsAvailable');else inc(coverage,'potsUnavailable');
 if(hand.actions.some(a=>a.kind==='ALLIN'))inc(coverage,'explicitAllInHands');if(hand.actions.some(a=>a.kind==='STRADDLE'))inc(coverage,'straddleHands');if(hand.actions.some(a=>a.kind==='autoBB'))inc(coverage,'autoBlindHands');
 if(hand.actions.some(a=>a.kind==='cashout'))inc(coverage,'cashOutHands');if(hand.actions.some(a=>a.kind==='cashout'&&a.player==='Hero'))inc(coverage,'heroCashOutHands');
 if(hero.netWon.reasonCodes.includes('AUTO_BLIND_SEMANTICS_UNKNOWN'))inc(coverage,'autoBlindHeroFinancialHands');
 if(ledger.contributionResidual!==0n)inc(coverage,'contributionResidualHands');if(ledger.payoutResidual!==0n)inc(coverage,'payoutResidualHands');
 if(hand.startedAt&&hand.endedAt){if(hand.endedAt.ordinalSeconds<hand.startedAt.ordinalSeconds)throw Error('Negative time interval');intervals.push({handId:hand.handId,start:hand.startedAt.ordinalSeconds,end:hand.endedAt.ordinalSeconds,timezoneRaw:hand.startedAt.timezoneRaw});}
 for(const d of hand.diagnostics){inc(diagnostics,d.code);await write(errors,d);}
 const candidate=hand.gameType==='BombPot'||hero.logicalShowdown.value===true&&ledger.actions.some(a=>a.allIn);
 if(candidate)queue.push(p);else {p.allInEV=calculateEV(hand,ledger,pots,hero,cache);countEV(p);aggregate.push(p);}
 if(fixtures.has(hand.handId))await write(traces,p);
 if(hands%10000===0){peakRSS=Math.max(peakRSS,process.memoryUsage().rss);console.log(`Parsed ${hands} hands; equity queue ${queue.length}`);}
}
const parseElapsedMs=performance.now()-start;console.log(`Stage 1–4 complete: ${hands} hands, ${queue.length} EV candidates, ${(parseElapsedMs/1000).toFixed(2)}s`);
for(let i=0;i<queue.length;i++){const p=queue[i]!,t=performance.now();p.allInEV=calculateEV(p.hand,p.ledger,p.pots,p.hero,cache);equityMs+=performance.now()-t;aggregate.push(p);countEV(p);for(const pot of p.allInEV.pots){for(const code of pot.reasonCodes){const action=p.hand.actions.find(a=>a.sequence===pot.snapshot?.sequence);await write(errors,{code,severity:'info',kind:'ev',handId:p.hand.handId,line:action?.line??p.hand.raw.startLine,raw:action?.raw??'',potId:pot.potId,snapshot:pot.snapshot,message:'Adjustment unavailable; actual result remains in fallback'});}}if(fixtures.has(p.hand.handId))await write(traces,{stage:'equity',...p});if(i%100===0){peakRSS=Math.max(peakRSS,process.memoryUsage().rss);console.log(`Equity ${i}/${queue.length}; cached exact scenarios ${cache.size}`);}}
errors.end();traces.end();await Promise.all([once(errors,'finish'),once(traces,'finish')]);
const sessions=buildSessions(intervals),reconciliation:{metric:string;phase1:number|string;phase2a:number|string;difference:number|null;status:string}[]=[];
function compare(metric:string,expected:number|string,actual:number|string){reconciliation.push({metric,phase1:expected,phase2a:actual,difference:typeof expected==='number'&&typeof actual==='number'?actual-expected:null,status:expected===actual?'PASS':'FAIL'});}
compare('hands',baseline.hands,hands);compare('unique_ids',baseline.unique_ids,dedup.accepted.size);compare('bytes',baseline.bytes,bytes);compare('lines',baseline.lines,lastLine);compare('sha256',baseline.sha256,hash.digest('hex'));
for(const group of ['game','stakes','players','actions','run_variant','forced','forced_allin','allin_street','section'] as const){for(const key of new Set([...Object.keys(baseline.counts[group]!),...Object.keys(inventory[group])]))compare(group+'.'+key,baseline.counts[group]![key]??0,inventory[group][key]??0);}
for(const [key,expected] of Object.entries(baseline.counts.splash_fee!))compare('splash_fee.'+key,expected,inventory.fee[key==='ABSENT'?key:money(key).toString()]??0);
for(const [key,expected] of Object.entries({explicitAllInHands:6750,straddleHands:973,autoBlindHands:754,cashOutRecords:116,cashOutHands:104,heroCashOutHands:0,splashEvents:423}))compare(key,expected,coverage[key]??0);
compare('SPLASH',366,inventory.splash.regular??0);compare('MEGA_SPLASH',57,inventory.splash.mega??0);
const eligible=Object.entries(evCoverage).filter(([k])=>k!=='notApplicable').reduce((n,[,v])=>n+v,0);
const ev={eligibleHands:eligible,coverage:evCoverage,percentages:Object.fromEntries(Object.entries(evCoverage).filter(([k])=>k!=='notApplicable').map(([k,v])=>[k,eligible?100*v/eligible:0])),unavailableReasons:evReasons,exactCacheEntries:cache.size};
const metrics=aggregate.result();
const report={schemaVersion:2,methodVersion:'tracker-snapshot-v1',source,readOnlySource:true,inventory,hands,duplicates,conflicts,reconciliation,coverage,ev,diagnostics,metrics,sessions:{count:sessions.length,estimatedSpanSeconds:sessions.reduce((n,s)=>n+s.estimatedSpanSeconds,0),observedUnionSeconds:sessions.reduce((n,s)=>n+s.observedUnionSeconds,0),hands:intervals.length},performance:{parseElapsedMs,parserMs,normalizationMs,factsMs,potMs,equityMs,totalMs:performance.now()-start,handsPerSecond:hands/(parseElapsedMs/1000),sampledPeakRSSBytes:peakRSS,processPeakRSSBytes:process.resourceUsage().maxRSS*1024},acceptance:{baseline:reconciliation.every(r=>r.status==='PASS'),unknownMonetary:(diagnostics.UNKNOWN_MONETARY_LINE??0)===0,unknownStructural:(diagnostics.UNKNOWN_STRUCTURAL_LINE??0)===0,unknownActions:(diagnostics.UNKNOWN_ACTION??0)===0,netInvariant:metrics.netInvariant,metricCounters:Object.values(aggregate.stats).every(c=>c.numerator<=c.denominator)}};
fs.writeFileSync('analysis/phase2a-validation.json',JSON.stringify(report,(_,v:unknown)=>typeof v==='bigint'?v.toString():v,2)+'\n');fs.writeFileSync('analysis/phase2a-coverage.json',JSON.stringify({coverage,ev,diagnostics,metrics},(_,v:unknown)=>typeof v==='bigint'?v.toString():v,2)+'\n');
console.log(JSON.stringify({hands,coverage,ev,diagnostics,performance:report.performance,acceptance:report.acceptance},null,2));
if(Object.values(report.acceptance).some(v=>!v))process.exitCode=1;
