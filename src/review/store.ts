import type {RawHand} from '../parser/scanner.ts';
import {processHand} from '../import/core.ts';
import {buildReview,type ReviewHand} from './model.ts';

/** Keep source ranges, not parser trees, for review across large imports. */
export class HistoryStore {
 private sources=new Map<string,{file:File;start:number;end:number}>();
 private cache=new Map<string,ReviewHand>();
 add(id:string,file:File,raw:RawHand){
  const start=raw.lines[0]?.startByte,end=raw.lines.at(-1)?.endByte;
  if(start!==undefined&&end!==undefined)this.sources.set(id,{file,start,end});
 }
 async load(ids:readonly string[]):Promise<ReviewHand[]>{
  const result:ReviewHand[]=[];
  for(const id of [...new Set(ids)].slice(0,10)){
   let hand=this.cache.get(id);
   if(!hand){
    const source=this.sources.get(id);if(!source)throw Error(`Hand #${id} is unavailable. Import the source files again.`);
    const text=(await source.file.slice(source.start,source.end).text()).replace(/^\uFEFF/,'');
    const lines=text.split(/\r?\n/).map((raw,i)=>({raw,line:i+1}));
    hand=buildReview(processHand({lines,startLine:1,endLine:lines.length},{equity:false}));hand.raw=text;
    if(hand.id!==id)throw Error('The source hand does not match the selected hand.');
    this.cache.set(id,hand);
    while(this.cache.size>20)this.cache.delete(this.cache.keys().next().value!);
   }
   result.push(hand);
  }
  return result;
 }
}
