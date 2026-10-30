import type {ReviewHand,ReviewEvent,ReplayFrame,ReviewPlayer} from './model.ts';
import {cardId,evaluate} from '../equity/evaluator.ts';

export interface HistoryStreet {street:string;pot:bigint;players:number;boards:Record<number,string[]>;events:ReviewEvent[]}
export interface ShowdownResult {player:ReviewPlayer;cards:string[]|null;folded:boolean;combinations:string[]}

export function historyStreets(hand:ReviewHand):HistoryStreet[]{
 const sections:HistoryStreet[]=[];
 let previous=hand.events[0]!.frame;
 const start=(street:string,frame:ReplayFrame):HistoryStreet=>{
  const section={street,pot:frame.pot,players:frame.players.filter(player=>!player.folded).length,boards:{},events:[]};
  sections.push(section);return section;
 };
 let current=start('preflop',previous);
 for(const entry of hand.events.slice(1)){
  if(entry.street==='showdown'||entry.street==='summary')break;
  if(entry.kind==='board'){
   if(entry.street!==current.street)current=start(entry.street,entry.frame);
   current.boards[entry.boardIndex??0]=entry.board??[];
  }else if(entry.kind==='action'&&['R','B','C','X','F','Return','Straddle'].includes(entry.code??'')&&!entry.forced){
   if(entry.street!==current.street)current=start(entry.street,previous);
   if(!current.events.length){current.pot=previous.pot;current.players=previous.players.filter(player=>!player.folded).length;}
   current.events.push(entry);
  }else if(!current.events.length&&(entry.forced||entry.kind==='splash')){
   current.pot=entry.frame.pot;current.players=entry.frame.players.filter(player=>!player.folded).length;
  }
  previous=entry.frame;
 }
 return sections;
}

const combinations=['High card','One pair','Two pair','Three of a kind','Straight','Flush','Full house','Four of a kind','Straight flush'];
export function showdownResults(hand:ReviewHand):ShowdownResult[]{
 const final=hand.events.at(-1)!.frame;
 return hand.players.flatMap(player=>{
  const state=final.players.find(entry=>entry.name===player.name)!;
  if(state.folded&&player.name!=='Hero'&&!state.cards)return [];
  const cards=state.cards;
  const ranks=cards?.length===2?Object.values(final.boards).flatMap(board=>{
   const all=[...cards,...board];
   if(board.length<3||board.length>5||new Set(all).size!==all.length||all.some(card=>!/^[2-9TJQKA][cdhs]$/.test(card)))return [];
   return [combinations[Math.floor(evaluate(all.map(cardId))/0x1000000)]!];
  }):[];
  return [{player,cards,folded:state.folded,combinations:ranks}];
 });
}
