import {useEffect,useRef,type RefObject} from 'react';
import {ReviewIcon} from './ReviewCards.tsx';

export function HistoryResizeHandle({dialog,disabled}:{dialog:RefObject<HTMLDialogElement|null>;disabled:boolean}){
 const start=useRef<{x:number;y:number;width:number;height:number}|null>(null);
 const resize=(width:number,height:number)=>{
  const node=dialog.current!;const rect=node.getBoundingClientRect();
  const left=Math.max(10,rect.left),top=Math.max(10,rect.top),maxWidth=innerWidth-left-10,maxHeight=innerHeight-top-10;
  Object.assign(node.style,{position:'fixed',margin:'0',left:left+'px',top:top+'px',right:'auto',bottom:'auto',width:Math.max(Math.min(420,maxWidth),Math.min(width,maxWidth))+'px',height:Math.max(Math.min(320,maxHeight),Math.min(height,maxHeight))+'px'});
 };
 useEffect(()=>{
  const fit=()=>{
   const node=dialog.current;if(!node?.style.left)return;
   const rect=node.getBoundingClientRect();
   node.style.left=Math.max(10,Math.min(rect.left,innerWidth-rect.width-10))+'px';
   node.style.top=Math.max(10,Math.min(rect.top,innerHeight-rect.height-10))+'px';
  };
  window.addEventListener('resize',fit);return ()=>window.removeEventListener('resize',fit);
 },[dialog]);
 return <button className="history-resize-handle" aria-label="Resize hand history" title="Drag to resize · Use arrow keys when focused" disabled={disabled} data-screenshot-exclude onPointerDown={event=>{
  if(event.button!==0)return;
  const rect=dialog.current!.getBoundingClientRect();start.current={x:event.clientX,y:event.clientY,width:rect.width,height:rect.height};
  resize(rect.width,rect.height);event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();event.currentTarget.focus();
 }} onPointerMove={event=>{const origin=start.current;if(origin)resize(origin.width+event.clientX-origin.x,origin.height+event.clientY-origin.y);}} onPointerUp={event=>{start.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={()=>{start.current=null;}} onLostPointerCapture={()=>{start.current=null;}} onKeyDown={event=>{
  const changes:Record<string,[number,number]>={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16],Enter:[32,32],' ':[32,32]};
  const delta=changes[event.key];if(!delta)return;
  event.preventDefault();const rect=dialog.current!.getBoundingClientRect();resize(rect.width+delta[0],rect.height+delta[1]);
 }}><ReviewIcon name="resize"/></button>;
}
