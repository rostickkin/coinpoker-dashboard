import {add,mul,rational,ratioNumber,type Rational,type Value} from '../core/value.ts';
import type {ProcessedHand} from '../import/core.ts';
export interface Counter {numerator:number;denominator:number;excluded:number;exclusionReasons:Record<string,number>}
export function counter():Counter{return {numerator:0,denominator:0,excluded:0,exclusionReasons:{}};}
export function record(c:Counter,n:Value<boolean>,d:Value<boolean>):void {if(n.value===null||d.value===null){c.excluded++;for(const r of new Set([...n.reasonCodes,...d.reasonCodes]))c.exclusionReasons[r]=(c.exclusionReasons[r]??0)+1;}else if(d.value){c.denominator++;if(n.value)c.numerator++;}}
export interface Filter {dateFrom?:string;dateTo?:string;month?:string;tableId?:string;limit?:string;position?:string;players?:number;gameType?:string;splashType?:string}
export function matches(p:ProcessedHand,f:Filter):boolean {const h=p.hand;return (!f.dateFrom||!!h.startedAt&&h.startedAt.dateKey>=f.dateFrom)&&(!f.dateTo||!!h.startedAt&&h.startedAt.dateKey<=f.dateTo)&&(!f.month||h.startedAt?.monthKey===f.month)&&(!f.tableId||h.tableId===f.tableId)&&(!f.limit||'NL'+h.bigBlind.toString()===f.limit)&&(!f.position||p.hero.position.value===f.position)&&(!f.players||h.players.length===f.players)&&(!f.gameType||h.gameType===f.gameType)&&(!f.splashType||h.splashType===f.splashType);}
export class Aggregate {
 hands=0;financialHands=0;excludedFinancial=0;net=0n;sd=0n;nsd=0n;bb=rational(0n);evBB=rational(0n);strictEVBB=rational(0n);strictEVHands=0;
 stats={vpip:counter(),pfr:counter(),threeBet:counter(),wtsd:counter(),wsd:counter(),wwsf:counter()};
 financialReasons:Record<string,number>={};
 push(p:ProcessedHand):void {this.hands++;const m=p.hero;
  const denominator:Value<boolean>={status:m.vpip.status,value:m.vpip.value===null?null:true,reasonCodes:m.vpip.reasonCodes};
  record(this.stats.vpip,m.vpip,denominator);record(this.stats.pfr,m.pfr,{...denominator,status:m.pfr.status,value:m.pfr.value===null?null:true,reasonCodes:m.pfr.reasonCodes});record(this.stats.threeBet,m.threeBetMade,m.threeBetOpportunity);
  record(this.stats.wtsd,m.logicalShowdown,m.sawFlop);record(this.stats.wsd,m.receivedPotAward,m.logicalShowdown);record(this.stats.wwsf,m.receivedPotAward,m.sawFlop);
  if(m.netWon.value!==null&&p.hand.bigBlind>0n){this.financialHands++;this.net+=m.netWon.value;this.sd+=m.showdownWon.value!;this.nsd+=m.nonShowdownWon.value!;this.bb=add(this.bb,rational(m.netWon.value,p.hand.bigBlind));const ev=p.allInEV?.adjustedResult.value;this.evBB=add(this.evBB,ev?mul(ev,rational(1n,p.hand.bigBlind)):rational(m.netWon.value,p.hand.bigBlind));const strict=p.allInEV?.strictResult.value;if(strict){this.strictEVHands++;this.strictEVBB=add(this.strictEVBB,mul(strict,rational(1n,p.hand.bigBlind)));}}
  else {this.excludedFinancial++;for(const r of m.netWon.reasonCodes)this.financialReasons[r]=(this.financialReasons[r]??0)+1;}
 }
 result(){return {hands:this.hands,financialHands:this.financialHands,excludedFinancial:this.excludedFinancial,financialReasons:this.financialReasons,net:this.net,sd:this.sd,nsd:this.nsd,netInvariant:this.net===this.sd+this.nsd,bb100:this.financialHands?ratioNumber(mul(this.bb,rational(100n,BigInt(this.financialHands)))):null,evBB100:this.financialHands?ratioNumber(mul(this.evBB,rational(100n,BigInt(this.financialHands)))):null,strictEVBB100:this.strictEVHands?ratioNumber(mul(this.strictEVBB,rational(100n,BigInt(this.strictEVHands)))):null,strictEVHands:this.strictEVHands,stats:Object.fromEntries(Object.entries(this.stats).map(([k,c])=>[k,{...c,rate:c.denominator?100*c.numerator/c.denominator:null,coverage:this.hands?(this.hands-c.excluded)/this.hands:0}]))};}
}
export function groupBy<T>(items:Iterable<ProcessedHand>,key:(p:ProcessedHand)=>T):Map<T,Aggregate>{const groups=new Map<T,Aggregate>();for(const p of items){const k=key(p);let a=groups.get(k);if(!a){a=new Aggregate();groups.set(k,a);}a.push(p);}return groups;}
