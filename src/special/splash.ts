import {available,missing,rational,mul,add,Reasons,type Rational,type Value} from '../core/value.ts';
import type {Hand} from '../parser/model.ts';
export interface SplashRatio {tableId:string;fromDate:string;toDate:string;sharedRatio:Rational;winnerRatio:Rational;source:string;status:'confirmed'}
export interface Splash {splashType:Hand['splashType'];splashDroppedTotal:bigint;splashRatio:Value<SplashRatio>;sharedSplashPool:Value<Rational>;winnerSplashPool:Value<Rational>;heroSharedSplashReceived:Value<Rational>;heroWinnerSplashReceived:Value<Rational>;heroSplashReceived:Value<Rational>;splashCalculationStatus:string}
export function calculateSplash(h:Hand,ratios:readonly SplashRatio[]=[]):Splash {
 const zero=available(rational(0n));const entries=ratios.filter(r=>r.tableId===h.tableId&&h.startedAt&&r.fromDate<=h.startedAt.dateKey&&r.toDate>=h.startedAt.dateKey);
 let why=h.splashType==='none'?'notApplicable':entries.length>1?'ratio_conflict':entries.length===0?'ratio_unknown':h.players.length===0?'player_count_unknown':'available';
 const ratio=entries[0];if(ratio&&(ratio.sharedRatio.n<0n||ratio.winnerRatio.n<0n||add(ratio.sharedRatio,ratio.winnerRatio).n!==add(ratio.sharedRatio,ratio.winnerRatio).d))throw Error('Invalid confirmed Splash ratio');
 const winners=[...new Set(h.actions.filter(a=>a.kind==='collected'&&a.amount>0n).map(a=>a.player))];if(why==='available'&&!winners.length)why='winner_unknown';
 const unavailable=missing<Rational>(why==='ratio_unknown'?Reasons.splash:why);
 const shared=why==='available'?available(mul(rational(h.splashDroppedTotal),ratio!.sharedRatio)):h.splashType==='none'?zero:unavailable;
 const winner=why==='available'?available(mul(rational(h.splashDroppedTotal),ratio!.winnerRatio)):h.splashType==='none'?zero:unavailable;
 const heroShared=shared.value?available(mul(shared.value,rational(1n,BigInt(h.players.length||1)))):unavailable;
 const heroWinner=winner.value?available(mul(winner.value,rational(winners.includes('Hero')?1n:0n,BigInt(winners.length||1)))):unavailable;
 return {splashType:h.splashType,splashDroppedTotal:h.splashDroppedTotal,splashRatio:entries.length===1?available(ratio!):missing(why==='ratio_conflict'?'SPLASH_RATIO_CONFLICT':Reasons.splash),sharedSplashPool:shared,winnerSplashPool:winner,heroSharedSplashReceived:heroShared,heroWinnerSplashReceived:heroWinner,heroSplashReceived:heroShared.value&&heroWinner.value?available(add(heroShared.value,heroWinner.value)):unavailable,splashCalculationStatus:why};
}
