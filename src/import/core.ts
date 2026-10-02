import {scanLines,scanHands,type RawHand} from '../parser/scanner.ts';
import {parseHand} from '../parser/handParser.ts';
import {normalizeLedger} from '../normalize/ledger.ts';
import {buildPots} from '../pots/potBuilder.ts';
import {heroMetrics} from '../metrics/hero.ts';
import {calculateSplash,type SplashRatio} from '../special/splash.ts';
import {calculateEV,type EquityCache} from '../equity/allInEV.ts';
export function processHand(raw:RawHand,options:{equity?:boolean;cache?:EquityCache;ratios?:readonly SplashRatio[]}={}) {
 const hand=parseHand(raw),ledger=normalizeLedger(hand),pots=buildPots(ledger),hero=heroMetrics(hand,ledger,pots),splash=calculateSplash(hand,options.ratios);
 return {hand,ledger,pots,hero,splash,allInEV:options.equity===false?null:calculateEV(hand,ledger,pots,hero,options.cache)};
}
export type ProcessedHand=ReturnType<typeof processHand>;
export async function* importHands(chunks:AsyncIterable<Uint8Array>,options:{signal?:AbortSignal;equity?:boolean;cache?:EquityCache;ratios?:readonly SplashRatio[]}={}) {
 for await(const raw of scanHands(scanLines(chunks,options.signal)))yield processHand(raw,options);
}
export function canonicalContent(raw:RawHand):string{return raw.lines.map(x=>x.raw).join('\n').trim().replace(/^\uFEFF/,'');}
export class Deduplicator {
 readonly accepted=new Map<string,string>();readonly conflicts:{key:string;previousHash:string;incomingHash:string;incoming:RawHand}[]=[];
 accept(handId:string,canonicalHash:string,raw:RawHand):'insert'|'duplicate'|'conflict'{const key='CoinPoker:'+handId,old=this.accepted.get(key);if(old===undefined){this.accepted.set(key,canonicalHash);return 'insert';}if(old===canonicalHash)return 'duplicate';this.conflicts.push({key,previousHash:old,incomingHash:canonicalHash,incoming:raw});return 'conflict';}
}
