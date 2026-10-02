import {available,missing,Reasons,type Value} from '../core/value.ts';
import type {Hand,Action,Street} from '../parser/model.ts';
export interface PlayerLedger {name:string;startingStack:bigint;grossPaid:bigint;returned:bigint;effectiveContribution:Value<bigint>;literalContribution:bigint;collected:bigint;cashOut:bigint;liveStreetBet:bigint;folded:boolean;foldStreet:Street|null;allIn:boolean;financialReasons:string[]}
export interface NormalAction {raw:Action;normalizationStatus:Value<boolean>;semantic:string;amountAdded:bigint;liveTotalAfter:bigint;maxLiveBet:bigint;fullRaise:boolean;allIn:boolean;threeBetOpportunity:boolean;threeBetMade:boolean;state:Snapshot}
export interface Snapshot {sequence:number;street:Street;board:string[];players:{name:string;contributed:bigint;live:bigint;folded:boolean;allIn:boolean;remaining:bigint}[]}
export interface Ledger {players:PlayerLedger[];actions:NormalAction[];forced:{player:string;kind:string;amountWritten:bigint;effectivePaid:Value<bigint>;liveCredit:Value<bigint>}[];literalTotal:bigint;contributionResidual:bigint|null;payoutResidual:bigint|null;reasons:string[]}
export function normalizeLedger(h:Hand):Ledger {
 const players=h.players.map(p=>({name:p.name,startingStack:p.startingStack,grossPaid:0n,returned:0n,effectiveContribution:available(0n),literalContribution:0n,collected:0n,cashOut:0n,liveStreetBet:0n,folded:false,foldStreet:null,allIn:false,financialReasons:[]} satisfies PlayerLedger)) as PlayerLedger[];
 const actions:NormalAction[]=[],forced:Ledger['forced']=[],reasons:string[]=[];
 let street:Street='preflop',max=0n,lastFull=h.bigBlind,raiseCount=0,fullEpoch=0;
 const actedEpoch=new Map<string,number>();
 const warn=(code:string,a:Action,message:string,player?:PlayerLedger)=>{h.diagnostics.push({code,severity:'warning',handId:h.handId,line:a.line,raw:a.raw,message});if(player&&!player.financialReasons.includes(code))player.financialReasons.push(code);};
 for(const a of h.actions){const p=players.find(p=>p.name===a.player);if(!p)continue;
  if(a.kind==='collected'){p.collected+=a.amount;continue;}if(a.kind==='cashout'){p.cashOut+=a.amount;continue;}if(a.kind==='shows'||a.kind==='mucks')continue;
  if(a.street!==street){street=a.street;max=0n;lastFull=h.bigBlind;raiseCount=0;fullEpoch=0;actedEpoch.clear();for(const q of players)q.liveStreetBet=0n;}
  const forcedKind=['ante','sb','bb','autoBB'].includes(a.kind),prev=p.liveStreetBet,oldMax=max;
  const remaining=p.startingStack-p.grossPaid+p.returned;
  const contestable=players.some(q=>q!==p&&!q.folded&&!q.allIn&&q.startingStack-q.grossPaid+q.returned>oldMax-q.liveStreetBet);
  const legal=actedEpoch.get(p.name)!==fullEpoch;
  const opportunity=!forcedKind&&['folds','checks','calls','bets','raises','ALLIN'].includes(a.kind)&&street==='preflop'&&raiseCount===1&&remaining>oldMax-prev&&contestable&&legal;
  let semantic:string=a.kind,added=0n,full=false;
  if(a.kind==='folds'){p.folded=true;p.foldStreet=street;}
  else if(a.kind==='RETURN'){p.returned+=a.amount;p.liveStreetBet-=a.amount;if(p.returned>p.grossPaid)warn('RETURN_EXCEEDS_PAID',a,'Return exceeds paid',p);max=players.reduce((x,q)=>q.liveStreetBet>x?q.liveStreetBet:x,0n);}
  else if(a.kind==='checks'){if(prev!==max&&!p.financialReasons.length&&!players.some(q=>q.financialReasons.includes(Reasons.auto)))warn('ILLEGAL_CHECK',a,'Check below live maximum');}
  else {
   added=a.kind==='raises'?a.to!-prev:a.amount;
   if(added<0n)warn('NEGATIVE_ADDITION',a,'Raise total below previous bet',p);
   if(p.folded)warn('PAID_AFTER_FOLD',a,'Contribution after fold',p);
   p.grossPaid+=added;
   if(a.kind!=='ante')p.liveStreetBet+=added;
   if(a.kind==='autoBB'){
    const known=a.amount===h.bigBlind;
    forced.push({player:p.name,kind:a.kind,amountWritten:a.amount,effectivePaid:known?available(a.amount):missing(Reasons.auto),liveCredit:known?available(a.amount):missing(Reasons.auto)});
    if(!known){warn(Reasons.auto,a,'Written auto blind differs from header BB; literal ledger is diagnostic only',p);reasons.push(Reasons.auto);}
   }else if(forcedKind)forced.push({player:p.name,kind:a.kind,amountWritten:a.amount,effectivePaid:available(a.amount),liveCredit:available(a.kind==='ante'?0n:a.amount)});
   if(a.kind==='ALLIN')semantic=p.liveStreetBet<=oldMax?'call':oldMax===0n?'bet':'raise';
   if(a.kind==='raises')semantic='raise';if(a.kind==='calls')semantic='call';if(a.kind==='bets')semantic='bet';
   if(!forcedKind&&a.kind!=='STRADDLE'&&p.liveStreetBet>oldMax){const increment=p.liveStreetBet-oldMax;full=increment>=lastFull;if(full){lastFull=increment;fullEpoch++;}if(street==='preflop')raiseCount++;if(!full&&a.kind==='ALLIN')semantic='shortRaise';}
   if(a.kind==='raises'&&a.amount!==a.to!-oldMax&&!players.some(q=>q.financialReasons.includes(Reasons.auto)))warn('RAISE_BY_MISMATCH',a,'Written raise-by differs from new total minus maximum');
   if(p.liveStreetBet>max)max=p.liveStreetBet;
   p.allIn=a.explicitAllIn||p.grossPaid-p.returned===p.startingStack;
   if(p.grossPaid-p.returned>p.startingStack)warn('STACK_OVERSPENT',a,'Paid beyond starting stack',p);
  }
  if(!forcedKind&&a.kind!=='RETURN'&&a.kind!=='STRADDLE')actedEpoch.set(p.name,fullEpoch);
  const state:Snapshot={sequence:a.sequence,street,board:[...a.boardAtAction],players:players.map(q=>({name:q.name,contributed:q.grossPaid-q.returned,live:q.liveStreetBet,folded:q.folded,allIn:q.allIn,remaining:q.startingStack-q.grossPaid+q.returned}))};
  const stateReasons=[...new Set([...reasons,...p.financialReasons])];
  actions.push({raw:a,normalizationStatus:stateReasons.length?missing(...stateReasons):available(true),semantic,amountAdded:added,liveTotalAfter:p.liveStreetBet,maxLiveBet:max,fullRaise:full,allIn:p.allIn,threeBetOpportunity:opportunity,threeBetMade:opportunity&&p.liveStreetBet>oldMax,state});
 }
 for(const p of players){p.literalContribution=p.grossPaid-p.returned;p.effectiveContribution=p.financialReasons.length?missing(...p.financialReasons):available(p.literalContribution);}
 const literalTotal=players.reduce((s,p)=>s+p.literalContribution,0n),collected=players.reduce((s,p)=>s+p.collected,0n);
 const contributionResidual=h.totalPot===null?null:h.totalPot-literalTotal-h.splashDroppedTotal;
 const payoutResidual=h.totalPot===null||h.handRake===null?null:h.totalPot-collected-h.handRake-(h.handSplashFee??0n);
 if(contributionResidual!==0n||payoutResidual!==0n){h.diagnostics.push({code:Reasons.residual,severity:'warning',handId:h.handId,line:h.raw.endLine,raw:'',message:`Contribution residual=${contributionResidual}; payout residual=${payoutResidual}; no correction applied`});}
 return {players,actions,forced,literalTotal,contributionResidual,payoutResidual,reasons:[...new Set(reasons)]};
}
