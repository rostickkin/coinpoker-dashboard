import {useRef,type CSSProperties} from 'react';
import type {ReviewEvent,ReviewHand} from '../review/model.ts';
import {Cards,reviewMoney} from './ReviewCards.tsx';
import {useReplayPlacement} from './useReplayPlacement.ts';

export function replayPlayerLabel(hand:ReviewHand,name:string){
 return (name==='Hero'?'Hero ':'Player ')+(hand.players.find(player=>player.name===name)?.position??'—');
}

export function replayEventText(hand:ReviewHand,event:ReviewEvent,unit:string){
 const amount=event.amount===undefined?'':' '+reviewMoney(event.amount,hand.bigBlind,unit);
 const verbs:Record<string,string>={R:'raises to',B:'bets',C:'calls',X:'checks',F:'folds',Return:'receives uncalled bet',Ante:'posts ante',SB:'posts small blind',BB:'posts big blind','Auto BB':'posts auto blind',Straddle:'straddles',Show:'shows cards',Muck:'mucks',Win:'wins','Cash out':'cashes out'};
 if(event.player)return replayPlayerLabel(hand,event.player)+' '+(verbs[event.code??'']??'acts')+amount+(event.allIn?' · all-in':'');
 if(event.kind==='splash')return (event.text.startsWith('MEGA')?'Mega Splash':'Splash')+' adds'+amount;
 if(event.kind==='warning')return 'Hand history warning';
 if(event.kind==='board')return event.street[0]!.toUpperCase()+event.street.slice(1)+(Object.keys(event.frame.boards).length>1?' · Board '+((event.boardIndex??0)+1):'');
 return event.text==='Start of hand'?'Start of hand':event.street[0]!.toUpperCase()+event.street.slice(1);
}

const actionBadges:Record<string,string>={R:'RAISE',B:'BET',C:'CALL',X:'CHECK',F:'FOLD',Show:'SHOW',Muck:'MUCK',Win:'WIN',Return:'RETURN',SB:'SB',BB:'BB',Ante:'ANTE',Straddle:'STRADDLE'};

function WagerChips({amount,bb}:{amount:bigint;bb:bigint}){
 const count=Math.max(1,Math.min(5,Math.ceil(Math.log2(Number(amount)/Math.max(1,Number(bb))+1))));
 return <span className="replay-chip-stack" aria-hidden="true">{Array.from({length:count},(_,i)=><span className="replay-chip" key={i} style={{bottom:i*3+'px'}}/>)}</span>;
}

export function ReplayTable({hand,index,unit}:{hand:ReviewHand;index:number;unit:string}){
 const stage=useRef<HTMLDivElement>(null);
 useReplayPlacement(stage,hand.id+':'+index+':'+unit);
 const event=hand.events[index]!,frame=event.frame,heroIndex=Math.max(0,hand.players.findIndex(player=>player.name==='Hero'));
 const boards=Object.entries(frame.boards),many=hand.players.length>6;
 const drops=hand.events.slice(0,index+1).filter(entry=>entry.kind==='splash'),dropped=drops.reduce((sum,entry)=>sum+(entry.amount??0n),0n);
 // Drop labels describe recorded funding; never count that funding again in the ordinary pot.
 const ordinaryPot=dropped>0n?(frame.pot>dropped?frame.pot-dropped:0n):frame.pot;
 return <div ref={stage} className={'replay-table-stage'+(many?' replay-many':'')}>
  <div className="replay-felt" aria-hidden="true"/>
  <div className={'replay-center'+(boards.length>1?' replay-multiple-boards':'')}>
   <div className="replay-pot-summary"><strong className="replay-pot"><span>Pot</span> {reviewMoney(ordinaryPot,hand.bigBlind,unit)}</strong>{dropped>0n&&<><span className="replay-pot-plus" aria-hidden="true">+</span><span className="replay-splash"><b>{drops.some(entry=>entry.text.startsWith('MEGA'))?'MEGA SPLASH':'SPLASH'} dropped</b><strong>{reviewMoney(dropped,hand.bigBlind,unit)}</strong></span></>}</div>
   <div className="replay-boards">{boards.length?boards.map(([board,cards])=><div className="replay-board" key={board}>
    {boards.length>1&&<small>Board {Number(board)+1}</small>}<Cards cards={cards}/><span className="replay-board-spaces" aria-hidden="true">{Array.from({length:Math.max(0,5-cards.length)},(_,i)=><i key={i}/>)}</span>
   </div>):null}</div>
   <span className="replay-brand">CoinPoker Dashboard</span>
  </div>
  {hand.players.map((player,i)=>{
   const state=frame.players.find(state=>state.name===player.name)!;
   const angle=Math.PI/2+(i-heroIndex)*2*Math.PI/hand.players.length,cos=Math.cos(angle),sin=Math.sin(angle);
   const latest=hand.events.slice(0,index+1).reverse().find(entry=>entry.player===player.name&&entry.street===frame.street&&entry.code!=='Return');
   const badge=state.folded?'FOLD':state.allIn?'ALL-IN':actionBadges[latest?.code??''];
   const style:CSSProperties={left:(50+39*cos)+'%',top:(52+35*sin)+'%'};
   // Lower-side wagers sit below the wordmark; the bottom seat's wager stays above its cards.
   const compactX=!many&&sin>0?17:21,compactY=!many&&sin>0?49+42*sin-26*sin*sin:49+(sin<0?28:16)*sin;
   const dealerAngle=angle-.5;
   const bottomSeat=sin>.99;
   return <div key={player.name} className="replay-player">
    <div style={style} className={'replay-seat'+(state.folded?' seat-folded':'')+(event.player===player.name?' seat-active':'')+(player.name==='Hero'?' seat-hero':'')}>
     {!state.folded&&<Cards cards={state.cards} backStyle="classic"/>}
     {badge&&<span className={'replay-action-badge badge-'+(state.folded?'fold':latest?.code??'neutral')}>{badge}</span>}
     <strong className="replay-seat-name">{replayPlayerLabel(hand,player.name)}</strong>
     <span className="seat-stack">{reviewMoney(state.remaining,hand.bigBlind,unit)}</span>
    </div>
    {state.live>0n&&<div className={'replay-wager'+(bottomSeat?' replay-wager-bottom':'')} style={{'--wager-left':(50+26*cos)+'%','--wager-top':(49+23*sin)+'%','--wager-left-small':(50+compactX*cos)+'%','--wager-top-small':compactY+'%','--bottom-seat-top':(52+35*sin)+'%'} as CSSProperties} aria-label={replayPlayerLabel(hand,player.name)+' bet '+reviewMoney(state.live,hand.bigBlind,unit)}>
     <WagerChips amount={state.live} bb={hand.bigBlind}/><strong>{reviewMoney(state.live,hand.bigBlind,unit)}</strong>
    </div>}
    {player.dealer&&<span className="dealer-marker" aria-label="Dealer" style={{left:(many?50+28*cos-13*sin:50+33*Math.cos(dealerAngle))+'%',top:(many?50+24*sin+9*cos:49+29*Math.sin(dealerAngle))+'%'}}>D</span>}
   </div>;
  })}
 </div>;
}
