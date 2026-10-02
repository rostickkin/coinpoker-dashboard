import {rational} from '../src/core/value.ts';
import {cardId} from '../src/equity/evaluator.ts';
/** Independent 5-card frequency evaluator plus exhaustive 5-of-7 selection. */
export function referenceEvaluate(cards:readonly number[]):number {
 let best=-1;for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){
  const five=[cards[a]!,cards[b]!,cards[c]!,cards[d]!,cards[e]!],r=five.map(c=>(c>>2)+2).sort((a,b)=>b-a);
  const freq=new Map<number,number>();for(const x of r)freq.set(x,(freq.get(x)??0)+1);const groups=[...freq].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
  const flush=five.every(c=>(c&3)===(five[0]!&3));let st=0;if(freq.size===5){if((r[0]! - r[4]!) === 4)st=r[0]!;else if(r.join()==='14,5,4,3,2')st=5;}
  let category=0,kickers=r;
  if(flush&&st){category=8;kickers=[st];}else if(groups[0]![1]===4){category=7;kickers=groups.map(x=>x[0]);}
  else if(groups[0]![1]===3&&groups[1]![1]===2){category=6;kickers=groups.map(x=>x[0]);}
  else if(flush)category=5;else if(st){category=4;kickers=[st];}else if(groups[0]![1]===3){category=3;kickers=groups.map(x=>x[0]);}
  else if(groups[0]![1]===2){category=groups[1]![1]===2?2:1;kickers=groups.map(x=>x[0]);}
  let value=category*0x1000000;for(let i=0;i<kickers.length;i++)value+=kickers[i]!*16**(4-i);if(value>best)best=value;
 }return best;
}
/** Lexicographic combination iterator, independent of production's recursive enumerator. */
export function referenceEquity(holes:readonly (readonly string[])[],board:readonly string[]) {
 const known=[...holes.flat(),...board].map(cardId),deck=Array.from({length:52},(_,i)=>i).filter(i=>!known.includes(i));
 const need=5-board.length,indices=Array.from({length:need},(_,i)=>i),counts=holes.map(()=>0);let scenarios=0;
 while(true){const completion=[...board.map(cardId),...indices.map(i=>deck[i]!)],ranks=holes.map(h=>referenceEvaluate([...h.map(cardId),...completion])),high=Math.max(...ranks),ties=ranks.filter(r=>r===high).length;for(let i=0;i<ranks.length;i++)if(ranks[i]===high)counts[i]!+=60/ties;scenarios++;
  let j=need-1;while(j>=0&&indices[j]===deck.length-need+j)j--;if(j<0)break;indices[j]!++;for(let k=j+1;k<need;k++)indices[k]=indices[k-1]!+1;
 }return {shares:counts.map(n=>rational(BigInt(n),BigInt(scenarios*60))),scenarioCount:scenarios};
}
