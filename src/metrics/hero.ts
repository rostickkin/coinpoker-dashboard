import {available,missing,unsupported,Reasons,type Value} from '../core/value.ts';
import type {Hand} from '../parser/model.ts';
import type {Ledger} from '../normalize/ledger.ts';
import type {PotLayer} from '../pots/potBuilder.ts';
export interface HeroMetrics {netWon:Value<bigint>;showdownWon:Value<bigint>;nonShowdownWon:Value<bigint>;logicalShowdown:Value<boolean>;sawFlop:Value<boolean>;receivedPotAward:Value<boolean>;vpip:Value<boolean>;pfr:Value<boolean>;threeBetOpportunity:Value<boolean>;threeBetMade:Value<boolean>;position:Value<string>;heroAttributedRake:Value<bigint>;heroAttributedSplashFee:Value<bigint>}
export function position(h:Hand):Value<string> {
 if(h.gameType!=='NLH')return unsupported('POSITION_GAME_UNSUPPORTED');
 const seats=h.players.filter(p=>p.dealtIn).sort((a,b)=>a.seat-b.seat),btn=seats.findIndex(p=>p.seat===h.buttonSeat);
 if(btn<0)return missing('BUTTON_NOT_DEALT');const ring=[...seats.slice(btn),...seats.slice(0,btn)];
 const labels:Record<number,string[]>={2:['BTN_SB','BB'],3:['BTN','SB','BB'],4:['BTN','SB','BB','CO'],5:['BTN','SB','BB','HJ','CO'],6:['BTN','SB','BB','UTG','HJ','CO']};
 const l=labels[ring.length];if(!l)return missing('UNSUPPORTED_PLAYER_COUNT');
 for(const a of h.actions.filter(a=>a.kind==='sb'||a.kind==='bb')){const expected=a.kind==='sb'?(ring.length===2?0:1):(ring.length===2?1:2);if(ring[expected]?.name!==a.player)return missing('BLIND_RING_CONFLICT');}
 const index=ring.findIndex(p=>p.name==='Hero');return index<0?missing('HERO_NOT_DEALT'):available(l[index]!);
}
export function heroMetrics(h:Hand,l:Ledger,pots:Value<PotLayer[]>):HeroMetrics {
 const hero=l.players.find(p=>p.name==='Hero'),invalid=h.diagnostics.some(d=>['INCOMPLETE_HAND','INVALID_SEATING'].includes(d.code));
 const ownUnknown=h.diagnostics.some(d=>d.code==='UNKNOWN_MONETARY_LINE'&&d.raw.startsWith('Hero'));
 let netWon:Value<bigint>=!hero||invalid?missing(Reasons.incomplete):hero.effectiveContribution.value===null?missing(...hero.financialReasons):ownUnknown?missing(Reasons.unknownMoney):hero.cashOut>0n?missing(Reasons.cash):available(hero.collected-hero.literalContribution);
 const actionUnknown=h.diagnostics.some(d=>['UNKNOWN_ACTION','UNKNOWN_STRUCTURAL_LINE','MALFORMED_LINE'].includes(d.code));
 const boardExists=Object.values(h.boards).some(b=>b.length>=3);
 const saw=!!hero&&boardExists&&hero.foldStreet!=='preflop';
 // Contested eligibility is topology, independent of global payout residuals.
 const live=l.players.filter(p=>!p.folded&&p.literalContribution>0n);
 const contested=!!hero&&!hero.folded&&live.some(p=>p!==hero&&p.literalContribution>0n)&&boardExists;
 const logicalShowdown=invalid||actionUnknown?missing<boolean>('SHOWDOWN_STATE_UNKNOWN'):available(contested);
 const sawFlop=invalid||actionUnknown?missing<boolean>('FLOP_STATE_UNKNOWN'):available(saw);
 if(logicalShowdown.value===null&&netWon.value!==null)netWon=missing('FINANCIAL_CLASSIFICATION_UNKNOWN');
 const heroPre=l.actions.filter(a=>a.raw.player==='Hero'&&a.raw.street==='preflop');
 const preReasons=[...(invalid?[Reasons.incomplete]:[]),...(actionUnknown?['ACTION_STATE_UNKNOWN']:[])];
 const pre=<T>(x:T):Value<T>=>h.gameType!=='NLH'?unsupported('BOMBPOT_PREFLOP_UNSUPPORTED'):preReasons.length?missing(...preReasons):available(x);
 const vpip=pre(heroPre.some(a=>['calls','raises','bets','ALLIN'].includes(a.raw.kind)&&a.amountAdded>0n));
 const pfr=l.reasons.length&&heroPre.some(a=>a.raw.kind==='ALLIN')?missing<boolean>(Reasons.auto):pre(heroPre.some(a=>a.semantic==='raise'||a.semantic==='shortRaise'));
 const shortRaises=l.actions.filter(a=>a.raw.street==='preflop'&&['raise','shortRaise'].includes(a.semantic)&&!a.fullRaise);
 const complexPre=h.actions.some(a=>a.kind==='STRADDLE')||shortRaises.length>1||l.reasons.length>0;
 const threeBetOpportunity=complexPre?missing<boolean>('THREEBET_REOPENING_AMBIGUOUS'):pre(heroPre.some(a=>a.threeBetOpportunity));
 const threeBetMade=complexPre?missing<boolean>('THREEBET_REOPENING_AMBIGUOUS'):pre(heroPre.some(a=>a.threeBetMade));
 const wins=l.players.filter(p=>p.collected>0n);
 const attribution=(raw:bigint|null):Value<bigint>=>raw===null?missing('SUMMARY_FEE_ABSENT'):!hero?missing('HERO_MISSING'):hero.collected===0n?available(0n):wins.length===1&&h.runCount===1&&pots.value?.length===1&&h.gameType==='NLH'?available(raw):missing(Reasons.rake);
 return {netWon,showdownWon:netWon.value===null?missing(...netWon.reasonCodes):available(contested?netWon.value:0n),nonShowdownWon:netWon.value===null?missing(...netWon.reasonCodes):available(contested?0n:netWon.value),logicalShowdown,sawFlop,receivedPotAward:available((hero?.collected??0n)>0n),vpip,pfr,threeBetOpportunity,threeBetMade,position:position(h),heroAttributedRake:attribution(h.handRake),heroAttributedSplashFee:attribution(h.handSplashFee)};
}
