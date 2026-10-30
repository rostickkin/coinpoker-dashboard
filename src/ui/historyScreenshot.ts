/** Render the full hand locally, preserving units and revealed/collapsed content. */
export async function downloadHistoryScreenshot(node:HTMLElement,id:string,unit:string):Promise<void>{
 const {toBlob}=await import('html-to-image');
 await document.fonts.ready;
 await Promise.all(node.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{})));
 await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
 if(!node.isConnected)throw Error('Hand history is closed.');
 const toolbar=node.querySelector<HTMLElement>('[data-screenshot-toolbar]');
 const width=Math.ceil(node.getBoundingClientRect().width),height=Math.ceil(node.scrollHeight-(toolbar?.getBoundingClientRect().height??0));
 const blob=await toBlob(node,{
  width,height,backgroundColor:'#111b28',pixelRatio:Math.min(window.devicePixelRatio||1,2),fontEmbedCSS:'',
  style:{height:'auto',maxHeight:'none',overflow:'visible'},
  filter:element=>!(element instanceof Element&&element.hasAttribute('data-screenshot-exclude')),
 });
 if(!blob)throw Error('Screenshot rendering failed.');
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`coinpoker-hand-${id.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)}-${unit==='original'?'original':unit==='BB'?'bb':'currency'}.png`;
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
