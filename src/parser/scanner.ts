export interface SourceLine {line:number;raw:string}
export interface RawHand {lines:SourceLine[];startLine:number;endLine:number}
export async function* scanLines(chunks:AsyncIterable<Uint8Array>,signal?:AbortSignal,maxLine=1_000_000):AsyncGenerator<SourceLine> {
 const decoder=new TextDecoder('utf-8',{fatal:true}),lineEncoder=new TextEncoder(),lineDecoder=new TextDecoder(); let pending='',line=0;
 // V8 sliced strings can retain an entire large input chunk behind one tiny saved HH line.
 // Explicit UTF-8 copying detaches each retained line, keeping candidate traces bounded by their text.
 const detach=(raw:string)=>raw?lineDecoder.decode(lineEncoder.encode(raw)):raw;
 for await(const bytes of chunks){ if(signal?.aborted)throw signal.reason??Error('Import cancelled'); pending+=decoder.decode(bytes,{stream:true});
  let from=0,pos:number; while((pos=pending.indexOf('\n',from))>=0){let raw=pending.slice(from,pos).replace(/\r$/,''); if(raw.length>maxLine)throw Error('Line size limit'); if(line===0)raw=raw.replace(/^\uFEFF/,'');yield {line:++line,raw:detach(raw)};from=pos+1;}
  pending=pending.slice(from);if(pending.length>maxLine)throw Error('Line size limit');
 } pending+=decoder.decode();if(pending.length)yield {line:++line,raw:detach(pending.replace(/\r$/,'').replace(line===0?/^\uFEFF/:/$^/,''))};
}
export async function* scanHands(lines:AsyncIterable<SourceLine>,maxLines=20_000):AsyncGenerator<RawHand> {
 let block:SourceLine[]=[];
 for await(const line of lines){if(line.raw.startsWith('CoinPoker Hand #')&&block.length){yield {lines:block,startLine:block[0]!.line,endLine:block.at(-1)!.line};block=[];} block.push(line);if(block.length>maxLines)throw Error('Hand block size limit');}
 if(block.some(x=>x.raw.trim()))yield {lines:block,startLine:block[0]!.line,endLine:block.at(-1)!.line};
}
export const fileChunks=(file:File):AsyncIterable<Uint8Array>=>file.stream() as unknown as AsyncIterable<Uint8Array>;
