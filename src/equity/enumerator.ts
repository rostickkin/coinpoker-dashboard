import {rational,type Rational} from '../core/value.ts';
import {cardId,evaluate} from './evaluator.ts';
export interface ExactEquity {shares:Rational[];scenarioCount:number}
export function exactEquity(holes:readonly (readonly string[])[],board:readonly string[],dead:readonly string[]=[],ranker:(cards:readonly number[])=>number=evaluate):ExactEquity {
 if(holes.length<2||holes.length>6||holes.some(h=>h.length!==2)||![0,3,4,5].includes(board.length))throw Error('Invalid equity inputs');
 const known=[...holes.flat(),...board,...dead].map(cardId);if(new Set(known).size!==known.length)throw Error('Duplicate physical cards');
 const excluded=new Set(known),deck=Array.from({length:52},(_,i)=>i).filter(c=>!excluded.has(c));
 const b=board.map(cardId),hands=holes.map(h=>[...h.map(cardId),...b]),need=5-b.length;
 const units=60,counts=Array<number>(holes.length).fill(0),ranks=Array<number>(holes.length).fill(0);let scenarios=0;
 const visit=()=>{let best=-1,ties=0;for(let i=0;i<hands.length;i++){const rank=ranker(hands[i]!);ranks[i]=rank;if(rank>best){best=rank;ties=1;}else if(rank===best)ties++;}for(let i=0;i<ranks.length;i++)if(ranks[i]===best)counts[i]!+=units/ties;scenarios++;};
 const choose=(start:number,left:number):void=>{if(!left){visit();return;}const offset=7-left;for(let j=start;j<=deck.length-left;j++){for(const hand of hands)hand[offset]=deck[j]!;choose(j+1,left-1);}};
 choose(0,need);
 return {shares:counts.map(n=>rational(BigInt(n),BigInt(scenarios*units))),scenarioCount:scenarios};
}
/** Suit canonicalization reduces repeated exact computations, preserving player and dead-card order. */
export function equityKey(holes:readonly (readonly string[])[],board:readonly string[],dead:readonly string[]):string {
 const suits=new Map<string,string>();let next=0;const normalize=(card:string)=>{let s=suits.get(card[1]!);if(s===undefined){s=String(next++);suits.set(card[1]!,s);}return card[0]+s;};
 return [holes.map(h=>h.map(normalize).join(',')).join('|'),board.map(normalize).join(','),dead.map(normalize).join(',')].join(';');
}
