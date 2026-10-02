import {available,missing,Reasons,type Value} from '../core/value.ts';
import type {Ledger} from '../normalize/ledger.ts';
export interface PotLayer {id:string;lowerCap:bigint;upperCap:bigint;gross:bigint;contributors:string[];eligible:string[];deadMoney:bigint}
export function buildPots(ledger:Ledger):Value<PotLayer[]> {
 if(ledger.players.some(p=>p.effectiveContribution.value===null))return missing(Reasons.pot,...ledger.reasons);
 const caps=[...new Set(ledger.players.map(p=>p.literalContribution).filter(x=>x>0n))].sort((a,b)=>a<b?-1:1);
 const layers:PotLayer[]=[];let lower=0n;
 for(const cap of caps){const contributors=ledger.players.filter(p=>p.literalContribution>=cap),eligible=contributors.filter(p=>!p.folded).map(p=>p.name);
  const gross=(cap-lower)*BigInt(contributors.length),deadMoney=(cap-lower)*BigInt(contributors.filter(p=>p.folded).length);
  const previous=layers.at(-1);
  if(previous&&previous.eligible.join()===eligible.join()){previous.upperCap=cap;previous.gross+=gross;previous.deadMoney+=deadMoney;previous.contributors=[...new Set([...previous.contributors,...contributors.map(p=>p.name)])];}
  else layers.push({id:'pot'+layers.length,lowerCap:lower,upperCap:cap,gross,deadMoney,contributors:contributors.map(p=>p.name),eligible});
  lower=cap;
 }
 if(layers.some(p=>p.contributors.length===1))return missing('UNCALLED_EXCESS_WITHOUT_RETURN');
 return available(layers);
}
