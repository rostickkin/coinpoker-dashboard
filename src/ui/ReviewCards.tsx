import type {ReviewEvent} from '../review/model.ts';

export function Cards({cards}:{cards:readonly string[]|null}){
 if(!cards)return <span className="review-cards" aria-label="Cards not revealed"><span className="playing-card-back">?</span><span className="playing-card-back">?</span></span>;
 return <span className="review-cards">{cards.map((card,i)=><span key={i} className={'playing-card suit-'+card.slice(-1)} aria-label={card}>{card.slice(0,-1)}</span>)}</span>;
}
export function reviewMoney(amount:bigint|null,bb:bigint,unit:string):string {
 if(amount===null)return '—';
 const negative=amount<0n,value=Number(negative?-amount:amount)/(unit==='BB'?Number(bb):100);
 return (negative?'−':'')+(unit==='BB'?'':'₮')+value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+(unit==='BB'?' BB':'');
}
export function ActionMark({event,bb}:{event:ReviewEvent;bb:bigint}){
 const sizing=event.amount===undefined?'':(Number(event.amount)/Number(bb)).toLocaleString('en-US',{maximumFractionDigits:2});
 return <span className={'review-action '+(event.player==='Hero'?'review-hero':'')} title={event.text}>{event.code}{sizing}{event.allIn&&<sup>AI</sup>}</span>;
}
export function ReviewIcon({name}:{name:'text'|'close'|'prev'|'next'|'first'|'last'|'play'|'pause'|'copy'|'camera'|'expand'|'restore'|'resize'}){
 const paths={text:'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',close:'M6 6l12 12 M6 18L18 6',prev:'M15 5l-7 7 7 7',next:'M9 5l7 7-7 7',first:'M6 5v14 M18 5l-9 7 9 7',last:'M18 5v14 M6 5l9 7-9 7',play:'M7 4l13 8-13 8z',pause:'M8 5v14 M16 5v14',copy:'M9 8h11v13H9z M15 8V3H4v13h5',camera:'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',expand:'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5',restore:'M8 8h13v13H8z M16 8V3H3v13h5',resize:'M7 19 19 7 M13 19 19 13'};
 return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
