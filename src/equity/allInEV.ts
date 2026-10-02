import {available,missing,unsupported,Reasons,rational,add,sub,mul,METHOD_VERSION,type Rational,type Value} from '../core/value.ts';
import type {Hand} from '../parser/model.ts';
import type {Ledger,Snapshot} from '../normalize/ledger.ts';
import type {HeroMetrics} from '../metrics/hero.ts';
import type {PotLayer} from '../pots/potBuilder.ts';
import {exactEquity,equityKey,type ExactEquity} from './enumerator.ts';
import {cardId,evaluate} from './evaluator.ts';
export interface PotEV {potId:string;status:'available'|'unavailable'|'notApplicable';reasonCodes:string[];snapshot:Snapshot|null;equities:ExactEquity|null;expectedPayout:Rational|null;actualPayout:bigint|null;adjustment:Rational|null}
export interface AllInEV {methodVersion:string;eligible:boolean;evAdjustmentAvailable:boolean;evCoverage:'fullyAdjusted'|'partiallyAdjusted'|'actualFallbackOnly'|'unsupported'|'notApplicable';availableAdjustment:Rational;adjustedResult:Value<Rational>;strictResult:Value<Rational>;pots:PotEV[]}
export type EquityCache=Map<string,ExactEquity>;
function zeroFeeActualPayouts(h:Hand,l:Ledger,pots:PotLayer[]):Map<string,bigint>|null {
 const totals=new Map<string,bigint>(),heroPots=new Map<string,bigint>();
 for(const pot of pots){let hero=0n;for(let run=0;run<h.runCount;run++){const board=h.boards[run];if(!board||board.length!==5)return null;
  const ranks=pot.eligible.map(name=>{const cards=h.players.find(p=>p.name===name)?.cards;return cards?.length===2?evaluate([...cards,...board].map(cardId)):null;});if(ranks.some(v=>v===null))return null;
  const high=Math.max(...ranks as number[]),winners=pot.eligible.filter((_,i)=>ranks[i]===high),denom=BigInt(winners.length*h.runCount);if(!denom||pot.gross%denom!==0n)return null;
  for(const name of winners){const amount=pot.gross/denom;totals.set(name,(totals.get(name)??0n)+amount);if(name==='Hero')hero+=amount;}
 }heroPots.set(pot.id,hero);}
 return l.players.every(p=>p.collected===(totals.get(p.name)??0n))?heroPots:null;
}
export function calculateEV(h:Hand,l:Ledger,pots:Value<PotLayer[]>,hero:HeroMetrics,cache:EquityCache=new Map()):AllInEV {
 const results:PotEV[]=[];let adjustment=rational(0n);
 const heroLedger=l.players.find(p=>p.name==='Hero');
 const contestedHero=pots.value?.filter(p=>p.eligible.includes('Hero')&&p.eligible.length>1)??[];
 const candidate=hero.logicalShowdown.value===true&&l.actions.some(a=>a.allIn&&!['RETURN','folds','checks'].includes(a.raw.kind));
 let eligible=candidate;
 const fail=(potId:string,reason:string,snapshot:Snapshot|null=null)=>results.push({potId,status:'unavailable',reasonCodes:[reason],snapshot,equities:null,expectedPayout:null,actualPayout:null,adjustment:null});
 if(h.gameType==='BombPot'){eligible=true;fail('hand',Reasons.bomb);}
 else if(candidate){
  if(hero.netWon.value===null)fail('hand',hero.netWon.reasonCodes[0]??Reasons.pot);
  else if(!pots.value||l.contributionResidual!==0n)fail('hand',Reasons.pot);
  else if(h.splashType!=='none')fail('hand','SPLASH_POT_OWNERSHIP_UNKNOWN');
  else if(h.diagnostics.some(d=>['UNKNOWN_MONETARY_LINE','UNKNOWN_ACTION','UNKNOWN_STRUCTURAL_LINE'].includes(d.code)))fail('hand',Reasons.unknownMoney);
  else {const zeroFees=h.handRake===0n&&(h.handSplashFee??0n)===0n;const zeroActual=zeroFees?zeroFeeActualPayouts(h,l,pots.value):null;
   for(const pot of contestedHero){
   // Preserve the FIRST all-in moment affecting this layer. Never shift it to a later board.
   const initiator=l.actions.find(a=>a.allIn&&pot.eligible.includes(a.raw.player)&&a.state.players.find(p=>p.name===a.raw.player)!.contributed<=pot.upperCap&&a.raw.kind!=='RETURN');
   if(!initiator)continue;
   const snap=initiator.state;
   if(snap.board.length===5){results.push({potId:pot.id,status:'available',reasonCodes:[],snapshot:snap,equities:null,expectedPayout:null,actualPayout:null,adjustment:rational(0n)});continue;}
   const settled=l.actions.find(a=>a.raw.sequence>=initiator.raw.sequence&&a.state.players.filter(p=>!p.folded&&pot.eligible.includes(p.name)).every(p=>p.contributed>=pot.upperCap||p.allIn));
   const futureDecisions=!settled||settled.raw.street!==initiator.raw.street||l.actions.some(a=>a.raw.sequence>settled.raw.sequence&&pot.eligible.includes(a.raw.player)&&['folds','calls','bets','raises','ALLIN'].includes(a.raw.kind));
   const liveAtSnapshot=snap.players.filter(p=>!p.folded&&p.contributed>0n&&p.name!==initiator.raw.player);
   const outsiders=liveAtSnapshot.some(p=>!pot.eligible.includes(p.name)&&l.actions.some(a=>a.raw.sequence>initiator.raw.sequence&&a.raw.player===p.name&&a.raw.street!==initiator.raw.street&&['folds','calls','bets','raises','ALLIN'].includes(a.raw.kind)));
   if(futureDecisions||outsiders){fail(pot.id,Reasons.future,snap);continue;}
   const holes=pot.eligible.map(name=>h.players.find(p=>p.name===name)?.cards??[]);
   if(holes.some(c=>c.length!==2)){fail(pot.id,Reasons.cards,snap);continue;}
   // A single contestable pot plus uncontested layers has ambiguous net fee allocation.
   if((pots.value.length!==1&&!zeroActual)||l.payoutResidual!==0n||h.handRake===null){fail(pot.id,Reasons.fee,snap);continue;}
   const dead=h.players.filter(p=>!pot.eligible.includes(p.name)&&p.cards&&(!l.players.find(q=>q.name===p.name)?.folded||h.actions.some(a=>a.player===p.name&&a.kind==='shows'&&a.sequence<=snap.sequence))).flatMap(p=>p.cards!);
   const key=equityKey(holes,snap.board,dead);let eq=cache.get(key);
   try{if(!eq){eq=exactEquity(holes,snap.board,dead);cache.set(key,eq);}}catch{fail(pot.id,'INVALID_EQUITY_CARDS',snap);continue;}
   // RIT expectation uses linear marginal shares, without treating runouts as independent.
   // Actual odd-chip portions are retained; fixed total net pot is the tracker monetary convention.
   const netPot=pot.gross-(pots.value.length===1?h.handRake+(h.handSplashFee??0n):0n),actual=pots.value.length===1?heroLedger!.collected:zeroActual!.get(pot.id)!;
   const expected=mul(eq.shares[pot.eligible.indexOf('Hero')]!,rational(netPot)),delta=sub(expected,rational(actual));adjustment=add(adjustment,delta);
   results.push({potId:pot.id,status:'available',reasonCodes:[],snapshot:snap,equities:eq,expectedPayout:expected,actualPayout:actual,adjustment:delta});
  }}
 }
 const complete=results.every(p=>p.status!=='unavailable'),has=results.some(p=>p.status==='available');
 const adjusted=hero.netWon.value===null?missing<Rational>(...hero.netWon.reasonCodes):available(add(rational(hero.netWon.value),adjustment));
 return {methodVersion:METHOD_VERSION,eligible,evAdjustmentAvailable:eligible&&complete,evCoverage:h.gameType==='BombPot'?'unsupported':!eligible?'notApplicable':complete&&has?'fullyAdjusted':has?'partiallyAdjusted':'actualFallbackOnly',availableAdjustment:adjustment,adjustedResult:adjusted,strictResult:complete?adjusted:h.gameType==='BombPot'?unsupported(Reasons.bomb):missing(...results.flatMap(p=>p.reasonCodes)),pots:results};
}
