import type {Fact} from '../ui/data.ts';

export interface LosingHand {id:string;date:string;bigBlind:bigint;pot:bigint;net:bigint;position:string;splashType:Fact['hand']['splashType']}
export type LossRanking='currency'|'bb';
export type LosingHands=Record<LossRanking,LosingHand[]>;

export function rankLosingHands(facts:readonly Fact[]):LosingHands {
 const result:LosingHands={currency:[],bb:[]};
 for(const f of facts){
  const {hand:h,hero}=f,net=hero.netWon.value;
  if(net===null||net>=0n||h.totalPot===null||h.totalPot<0n||h.bigBlind<=0n)continue;
  const row:LosingHand={id:h.handId,date:h.startedAt?.raw??'Unknown',bigBlind:h.bigBlind,pot:h.totalPot,net,position:hero.position.value??'—',splashType:h.splashType};
  for(const unit of ['currency','bb'] as const){
   const rows=result[unit];rows.push(row);
   rows.sort((a,b)=>{
    const delta=unit==='currency'?a.net-b.net:a.net*b.bigBlind-b.net*a.bigBlind;
    return delta>0n?1:delta<0n?-1:b.date.localeCompare(a.date)||b.id.localeCompare(a.id,undefined,{numeric:true});
   });
   if(rows.length>10)rows.pop();
  }
 }
 return result;
}
