import type {Fact} from '../ui/data.ts';

export interface RankedHand {id:string;date:string;bigBlind:bigint;pot:bigint|null;net:bigint|null;position:string;splashType:Fact['hand']['splashType']}
export interface HandRanking {metric:'net'|'pot';direction:'asc'|'desc';unit:'currency'|'bb';splashOnly:boolean}
export const defaultHandRanking:HandRanking={metric:'net',direction:'asc',unit:'currency',splashOnly:false};

export function rankHands(facts:readonly Fact[],options:HandRanking=defaultHandRanking):RankedHand[] {
 const result:{hand:RankedHand;value:bigint}[]=[];
 const compare=(a:typeof result[number],b:typeof result[number])=>{
  const delta=options.unit==='currency'?a.value-b.value:a.value*b.hand.bigBlind-b.value*a.hand.bigBlind;
  const order=delta>0n?1:delta<0n?-1:0;
  return (options.direction==='desc'?-order:order)||b.hand.date.localeCompare(a.hand.date)||b.hand.id.localeCompare(a.hand.id,undefined,{numeric:true});
 };
 for(const f of facts){
  const {hand:h,hero}=f,net=hero.netWon.value;
  const value=options.metric==='net'?net:h.totalPot;
  if(value===null||h.bigBlind<=0n||options.metric==='pot'&&value<0n||options.splashOnly&&h.splashType==='none')continue;
  const candidate={hand:{id:h.handId,date:h.startedAt?.raw??'Unknown',bigBlind:h.bigBlind,pot:h.totalPot,net,position:hero.position.value??'—',splashType:h.splashType},value};
  if(result.length===10&&compare(candidate,result[9]!)>=0)continue;
  const index=result.findIndex(row=>compare(candidate,row)<0);
  result.splice(index<0?result.length:index,0,candidate);
  if(result.length>10)result.pop();
 }
 return result.map(row=>row.hand);
}
