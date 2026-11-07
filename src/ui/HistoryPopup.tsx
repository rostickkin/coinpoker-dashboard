import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import type {ReviewHand} from '../review/model.ts';
import {HandReview} from './HandReview.tsx';

export interface HistoryPopupSession {id:number;browser:Window;container:HTMLElement;hand:ReviewHand;unit:string;opener:HTMLButtonElement}

/** Called directly by the click handler so browsers can allow this local popup. */
export function openHistoryPopup(hand:ReviewHand,unit:string,opener:HTMLButtonElement):HistoryPopupSession|null{
 const browser=window.open('','_blank','popup,width=920,height=900');
 if(!browser)return null;
 const doc=browser.document;
 doc.title='Hand #'+hand.id+' · CoinPoker Dashboard';
 doc.documentElement.lang=document.documentElement.lang||'en';
 for(const style of Array.from(document.querySelectorAll('style,link[rel="stylesheet"]')))doc.head.appendChild(style.cloneNode(true));
 doc.body.className='history-popup-page';
 const container=doc.createElement('div');doc.body.appendChild(container);
 return {id:Date.now()+Math.random(),browser,container,hand,unit,opener};
}

export function HistoryPopup({session,onClose}:{session:HistoryPopupSession;onClose:()=>void}){
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const closed=()=>close.current();
  session.browser.addEventListener('beforeunload',closed);
  return ()=>{session.browser.removeEventListener('beforeunload',closed);if(!session.browser.closed)session.browser.close();};
 },[session]);
 return createPortal(<HandReview hand={session.hand} initialView="text" unit={session.unit} opener={session.opener} onClose={onClose} standalone/>,session.container);
}
