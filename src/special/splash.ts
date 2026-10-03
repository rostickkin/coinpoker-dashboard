import {available,missing,rational,mul,add,type Rational,type Value} from '../core/value.ts';
import type {Hand} from '../parser/model.ts';
export interface SplashRatio {tableId:string;fromDate:string;toDate:string;sharedRatio:Rational;winnerRatio:Rational;source:string;status:'confirmed'|'estimated'}
export interface Splash {splashType:Hand['splashType'];splashDroppedTotal:bigint;splashRatio:Value<SplashRatio>;sharedSplashPool:Value<Rational>;winnerSplashPool:Value<Rational>;heroSharedSplashReceived:Value<Rational>;heroWinnerSplashReceived:Value<Rational>;heroSplashReceived:Value<Rational>;splashCalculationStatus:string}
export function calculateSplash(h:Hand,ratios:readonly SplashRatio[]=[]):Splash {
 const zero=available(rational(0n));const entries=ratios.filter(r=>r.tableId===h.tableId&&h.startedAt&&r.fromDate<=h.startedAt.dateKey&&r.toDate>=h.startedAt.dateKey);
 const dealt=h.players.filter(p=>p.dealtIn);
 let why=h.splashType==='none'?'notApplicable':entries.length>1?'ratio_conflict':dealt.length===0?'player_count_unknown':'available';
 const ratio:SplashRatio=entries[0]??{tableId:h.tableId,fromDate:'0000-01-01',toDate:'9999-12-31',sharedRatio:rational(1n,2n),winnerRatio:rational(1n,2n),source:'User-specified average: 50% to pot, 50% shared among dealt-in players',status:'estimated'};
 if(ratio.sharedRatio.n<0n||ratio.winnerRatio.n<0n||add(ratio.sharedRatio,ratio.winnerRatio).n!==add(ratio.sharedRatio,ratio.winnerRatio).d)throw Error('Invalid Splash ratio');
 const winners=[...new Set(h.actions.filter(a=>a.kind==='collected'&&a.amount>0n).map(a=>a.player))];if(why==='available'&&!winners.length)why='winner_unknown';
 const unavailable=missing<Rational>(why);
 const shared=why==='available'?available(mul(rational(h.splashDroppedTotal),ratio.sharedRatio)):h.splashType==='none'?zero:unavailable;
 const winner=why==='available'?available(mul(rational(h.splashDroppedTotal),ratio.winnerRatio)):h.splashType==='none'?zero:unavailable;
 const heroShared=shared.value?available(mul(shared.value,rational(dealt.some(p=>p.name==='Hero')?1n:0n,BigInt(dealt.length||1)))):unavailable;
 const heroWinner=winner.value?available(mul(winner.value,rational(winners.includes('Hero')?1n:0n,BigInt(winners.length||1)))):unavailable;
 return {splashType:h.splashType,splashDroppedTotal:h.splashDroppedTotal,splashRatio:entries.length<=1?available(ratio):missing('SPLASH_RATIO_CONFLICT'),sharedSplashPool:shared,winnerSplashPool:winner,heroSharedSplashReceived:heroShared,heroWinnerSplashReceived:heroWinner,heroSplashReceived:heroShared.value&&heroWinner.value?available(add(heroShared.value,heroWinner.value)):unavailable,splashCalculationStatus:why};
}
