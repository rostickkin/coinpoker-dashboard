import {useLayoutEffect,type RefObject} from 'react';

interface Box {left:number;right:number;top:number;bottom:number}
const offsets:[number,number][]=[[0,0]];
for(let distance=8;distance<=96;distance+=8)offsets.push([0,-distance],[distance,0],[-distance,0],[0,distance],[distance,-distance],[-distance,-distance],[distance,distance],[-distance,distance]);

/** Keep preferred table coordinates, nudging markers clear of their actual rendered neighbours. */
export function useReplayPlacement(ref:RefObject<HTMLDivElement|null>,frameKey:string){
 useLayoutEffect(()=>{
  const stage=ref.current;if(!stage)return;
  const arrange=()=>{
   const felt=stage.querySelector<HTMLElement>('.replay-felt');if(!felt)return;
   const markers=Array.from(stage.querySelectorAll<HTMLElement>('.replay-wager,.dealer-marker'));
   for(const marker of markers)marker.style.translate='0px 0px';
   const field=felt.getBoundingClientRect(),border=parseFloat(stage.ownerDocument.defaultView!.getComputedStyle(felt).borderLeftWidth)+4;
   const rx=field.width/2-border,ry=field.height/2-border,cx=field.left+field.width/2,cy=field.top+field.height/2;
   if(rx<=0||ry<=0)return;
   const occupied:Box[]=Array.from(stage.querySelectorAll<HTMLElement>('.replay-seat,.replay-seat .review-cards,.replay-pot-summary,.replay-board,.replay-brand')).map(node=>node.getBoundingClientRect());
   const inside=(box:Box)=>[box.left,box.right].every(x=>[box.top,box.bottom].every(y=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1));
   const clear=(box:Box)=>occupied.every(other=>box.right+4<=other.left||box.left-4>=other.right||box.bottom+4<=other.top||box.top-4>=other.bottom);
   // Wager values have priority; place the movable dealer puck after them.
   markers.sort((a,b)=>Number(a.classList.contains('dealer-marker'))-Number(b.classList.contains('dealer-marker')));
   for(const marker of markers){
    const base=marker.getBoundingClientRect();
    let placed:Box=base;
    for(const [x,y] of offsets){
     const box={left:base.left+x,right:base.right+x,top:base.top+y,bottom:base.bottom+y};
     if(!inside(box)||!clear(box))continue;
     marker.style.translate=x+'px '+y+'px';placed=box;break;
    }
    occupied.push(placed);
   }
  };
  arrange();const observer=new ResizeObserver(arrange);observer.observe(stage);
  return ()=>observer.disconnect();
 },[ref,frameKey]);
}
