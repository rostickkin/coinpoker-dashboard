import {importHands} from './core.ts';
/** No DOM access or main-thread scheduling: invoke this adapter from a Web Worker. */
export async function* readableChunks(stream:ReadableStream<Uint8Array>,signal?:AbortSignal):AsyncGenerator<Uint8Array> {
 const reader=stream.getReader();
 try {while(true){if(signal?.aborted)throw signal.reason??Error('Import cancelled');const chunk=await reader.read();if(chunk.done)return;yield chunk.value;}}
 finally {await reader.cancel();reader.releaseLock();}
}
export const importLocalFile=(file:File,options:Parameters<typeof importHands>[1]={equity:false})=>importHands(readableChunks(file.stream(),options.signal),options);
