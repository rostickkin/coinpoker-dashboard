import {useEffect,useRef,useState} from 'react';
import type {LosingHands as Ranking,PotRanking} from '../review/selection.ts';
import type {HandsReply,ReviewHand} from '../review/model.ts';
import {HandReview} from './HandReview.tsx';
import {Cards,ActionMark,reviewMoney,ReviewIcon} from './ReviewCards.tsx';
import './hand-review.css';

function savedRanking():PotRanking {try{return localStorage.getItem('coinpoker.review.rank')==='bb'?'bb':'currency';}catch{return 'currency';}}
export function LosingHands({rankings,worker,unit}:{rankings:Ranking;worker:Worker|null;unit:string}){
 const [ranking,setRanking]=useState<PotRanking>(savedRanking),[details,setDetails]=useState<Record<string,ReviewHand>>({}),[error,setError]=useState(''),[retry,setRetry]=useState(0),[opened,setOpened]=useState<{hand:ReviewHand;view:'replay'|'text';opener:HTMLButtonElement}|null>(null);
 const sequence=useRef(0),rows=rankings[ranking],ids=rows.map(h=>h.id).join(',');
 useEffect(()=>{try{localStorage.setItem('coinpoker.review.rank',ranking);}catch{/* Preference remains in memory. */}},[ranking]);
 useEffect(()=>{
  setError('');if(!worker||!ids)return;
  const request=++sequence.current;
  const receive=(event:MessageEvent<{type:string;payload:HandsReply}>)=>{
   if(event.data.type!=='hands'||event.data.payload.request!==request)return;
   const reply=event.data.payload;if(reply.error)setError(reply.error);else setDetails(Object.fromEntries(reply.hands.map(h=>[h.id,h])));
  };
  worker.addEventListener('message',receive);worker.postMessage({type:'hands',ids:ids.split(','),request});
  return ()=>worker.removeEventListener('message',receive);
 },[worker,ids,retry]);
 const open=(id:string,view:'replay'|'text',opener:HTMLButtonElement)=>{const hand=details[id];if(hand)setOpened({hand,view,opener});};
 return <section className="panel losing-hands" aria-label="Top 10 losing hands">
  <div className="section-head"><div><h2>Top 10 losing hands</h2><small>Current filters · Net Won &lt; 0 · Total pot before charges</small></div><div className="review-sort"><span>Sort pots by</span><div className="unit">{(['currency','bb'] as const).map(mode=><button key={mode} aria-label={'Sort pots by '+(mode==='bb'?'BB':'₮')} aria-pressed={ranking===mode} onClick={()=>setRanking(mode)}>{mode==='bb'?'BB':'₮'} ↓</button>)}</div></div></div>
  {error&&<div className="review-error" role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry hand loading</button></div>}
  <div className="losing-hands-scroll"><table><thead><tr><th>Hand / time</th><th>Limit · Position</th><th>Hero</th><th>Preflop → Flop → Turn → River</th><th className="review-number">Pot <span title={'Ranked in '+(ranking==='bb'?'BB':'₮')}>↓</span></th><th className="review-number">Net Won</th><th><span className="review-sr">Text history</span></th></tr></thead><tbody>{rows.map(row=>{
   const hand=details[row.id],hero=hand?.players.find(p=>p.name==='Hero');
   return <tr key={row.id} onClick={e=>{if((e.target as HTMLElement).closest('button'))return;const button=e.currentTarget.querySelector<HTMLButtonElement>('button');if(button)open(row.id,'replay',button);}}>
    <td><button className="hand-open" aria-label={'Replay hand '+row.id} disabled={!hand} onClick={e=>open(row.id,'replay',e.currentTarget)}>#{row.id}<small>{row.date}</small></button></td>
    <td>NL{Number(row.bigBlind)} <span className="muted">· {row.position}</span></td><td>{hand?<Cards cards={hero?.cards??null}/>:<span className="muted">…</span>}</td>
    <td><div className="review-trail">{hand?hand.events.filter(event=>event.kind==='board'||event.kind==='action'&&!event.forced&&['R','B','C','X','F'].includes(event.code??'')).map((event,i)=>event.kind==='board'?<span key={i} className="trail-board" title={event.text}>{hand.events.some(e=>e.boardIndex===1)&&<small>B{(event.boardIndex??0)+1}</small>}<Cards cards={event.street==='turn'?(event.board??[]).slice(3):event.street==='river'?(event.board??[]).slice(4):event.board??[]}/></span>:<ActionMark key={i} event={event} bb={row.bigBlind}/>):<span className="muted" role="status">Loading hand…</span>}</div></td>
    <td className="review-number">{reviewMoney(row.pot,row.bigBlind,unit)}</td><td className="review-number negative">{reviewMoney(row.net,row.bigBlind,unit)}</td><td><button className="hand-text-button" aria-label={'Text history for hand '+row.id} title="Text hand history" disabled={!hand} onClick={e=>open(row.id,'text',e.currentTarget)}><ReviewIcon name="text"/></button></td>
   </tr>;
  })}{!rows.length&&<tr><td colSpan={7} className="empty">No losing hands with an available pot in the current filters.</td></tr>}</tbody></table></div>
  {!!rows.length&&<div className="review-legend"><span><u>Underline</u> = Hero</span><span>R raise · B bet · C call · X check · F fold · AI all-in</span><span>Action sizes in BB · Hover for player and sizing</span></div>}
  {opened&&<HandReview hand={opened.hand} initialView={opened.view} unit={unit} opener={opened.opener} onClose={()=>setOpened(null)}/>}
 </section>;
}
