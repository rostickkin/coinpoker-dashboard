import {useEffect,useRef,useState} from 'react';
import type {RankedHand,HandRanking} from '../review/selection.ts';
import type {HandsReply,ReviewHand} from '../review/model.ts';
import {HandReview} from './HandReview.tsx';
import {Cards,ActionMark,reviewMoney,ReviewIcon} from './ReviewCards.tsx';
import './top-hands.css';

export function TopHands({rows:queryRows,ranking,onRankingChange,worker,unit}:{rows:RankedHand[];ranking:HandRanking;onRankingChange:(ranking:HandRanking)=>void;worker:Worker|null;unit:string}){
 const [rows,setRows]=useState(queryRows),[details,setDetails]=useState<Record<string,ReviewHand>>({}),[error,setError]=useState(''),[retry,setRetry]=useState(0),[opened,setOpened]=useState<{hand:ReviewHand;view:'replay'|'text';opener:HTMLButtonElement}|null>(null);
 const sequence=useRef(0),rankingSequence=useRef(0),ids=rows.map(h=>h.id).join(',');
 useEffect(()=>{
  setRows(queryRows);if(!worker)return;
  const request=++rankingSequence.current;
  const receive=(event:MessageEvent<{type:string;payload:{request:number;hands:RankedHand[]}}>)=>{
   if(event.data.type==='rankedHands'&&event.data.payload.request===request)setRows(event.data.payload.hands);
  };
  worker.addEventListener('message',receive);worker.postMessage({type:'rankHands',handRanking:ranking,request});
  return ()=>worker.removeEventListener('message',receive);
 },[worker,ranking,queryRows]);
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
 const change=(patch:Partial<HandRanking>)=>onRankingChange({...ranking,...patch});
 const sort=(metric:HandRanking['metric'])=>change({metric,direction:ranking.metric===metric?(ranking.direction==='desc'?'asc':'desc'):(metric==='net'?'asc':'desc')});
 return <section className="panel losing-hands top-hands" aria-label="Top 10 hands">
  <div className="section-head"><div><h2>Top 10 hands</h2><small>Current filters · {ranking.metric==='net'?'Hero Net Won':'Total pot before charges'} · {ranking.metric==='net'?(ranking.direction==='asc'?'Biggest losses first':'Biggest wins first'):(ranking.direction==='desc'?'Largest pots first':'Smallest pots first')}</small></div>
   <div className="review-sort">
    <label className="review-splash-filter"><input type="checkbox" aria-label="Splash hands only" checked={ranking.splashOnly} onChange={e=>change({splashOnly:e.target.checked})}/><span className="review-splash-badge" aria-hidden="true">S</span><span>Splash only</span></label>
    <label className="review-rank-select">Sort by<select aria-label="Rank hands by" value={ranking.metric} onChange={e=>{const metric=e.target.value as HandRanking['metric'];change({metric,direction:metric==='net'?'asc':'desc'});}}><option value="net">Net Won</option><option value="pot">Pot</option></select></label>
    <button className="review-sort-direction" aria-label="Reverse hand sort order" onClick={()=>change({direction:ranking.direction==='desc'?'asc':'desc'})}>{ranking.metric==='net'?(ranking.direction==='asc'?'Losses first ↑':'Wins first ↓'):(ranking.direction==='desc'?'High to low ↓':'Low to high ↑')}</button>
    <div className="unit" aria-label="Hand ranking unit">{(['currency','bb'] as const).map(mode=><button key={mode} aria-label={'Rank hands in '+(mode==='bb'?'BB':'₮')} aria-pressed={ranking.unit===mode} onClick={()=>change({unit:mode})}>{mode==='bb'?'BB':'₮'}</button>)}</div>
   </div>
  </div>
  {error&&<div className="review-error" role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry hand loading</button></div>}
  <div className="losing-hands-scroll"><table><thead><tr><th>Hand / time</th><th>Limit · Position</th><th>Hero</th><th>Preflop → Flop → Turn → River</th>{(['pot','net'] as const).map(metric=><th key={metric} className="review-number" aria-sort={ranking.metric===metric?(ranking.direction==='desc'?'descending':'ascending'):undefined}><button className="review-column-sort" aria-label={'Sort by '+(metric==='net'?'Net Won':'Pot')} onClick={()=>sort(metric)}>{metric==='net'?'Net Won':'Pot'}{ranking.metric===metric&&<span aria-hidden="true"> {ranking.direction==='desc'?'↓':'↑'}</span>}</button></th>)}<th><span className="review-sr">Hand review</span></th></tr></thead><tbody>{rows.map(row=>{
   const hand=details[row.id],hero=hand?.players.find(p=>p.name==='Hero');
   return <tr key={row.id} onClick={e=>{if((e.target as HTMLElement).closest('button'))return;const button=e.currentTarget.querySelector<HTMLButtonElement>('.hand-open');if(button)open(row.id,'text',button);}}>
    <td><div className="review-hand-identity">{row.splashType!=='none'&&<span className="review-splash-badge" aria-label="Splash hand" title={row.splashType==='mega'?'Mega Splash':'Splash'}>S</span>}<button className="hand-open" aria-label={'Hand history for hand '+row.id} disabled={!hand} onClick={e=>open(row.id,'text',e.currentTarget)}>#{row.id}<small>{row.date}</small></button></div></td>
    <td>NL{Number(row.bigBlind)} <span className="muted">· {row.position}</span></td><td>{hand?<Cards cards={hero?.cards??null}/>:<span className="muted">…</span>}</td>
    <td><div className="review-trail">{hand?hand.events.filter(event=>event.kind==='board'||event.kind==='action'&&!event.forced&&['R','B','C','X','F'].includes(event.code??'')).map((event,i)=>event.kind==='board'?<span key={i} className="trail-board" title={event.text}>{hand.events.some(e=>e.boardIndex===1)&&<small>B{(event.boardIndex??0)+1}</small>}<Cards cards={event.street==='turn'?(event.board??[]).slice(3):event.street==='river'?(event.board??[]).slice(4):event.board??[]}/></span>:<ActionMark key={i} event={event} bb={row.bigBlind}/>):<span className="muted" role="status">Loading hand…</span>}</div></td>
    <td className="review-number">{reviewMoney(row.pot,row.bigBlind,unit)}</td><td className={'review-number '+(row.net===null?'muted':row.net<0n?'negative':row.net>0n?'positive':'')}>{reviewMoney(row.net,row.bigBlind,unit)}</td><td><div className="hand-review-actions"><button className="hand-text-button" aria-label={'Replay hand '+row.id} title="Replay hand" disabled={!hand} onClick={e=>open(row.id,'replay',e.currentTarget)}><ReviewIcon name="play"/></button><button className="hand-text-button" aria-label={'Text history for hand '+row.id} title="Hand history" disabled={!hand} onClick={e=>open(row.id,'text',e.currentTarget)}><ReviewIcon name="text"/></button></div></td>
   </tr>;
  })}{!rows.length&&<tr><td colSpan={7} className="empty">{ranking.splashOnly?'No Splash hands match the current filters.':'No hands with an available '+(ranking.metric==='net'?'Net Won':'pot')+' in the current filters.'}</td></tr>}</tbody></table></div>
  {!!rows.length&&<div className="review-legend"><span><u>Underline</u> = Hero</span><span><span className="review-splash-badge" aria-hidden="true">S</span> = Splash</span><span>R raise · B bet · C call · X check · F fold · AI all-in</span><span>Action sizes in BB · Hover for player and sizing</span></div>}
  {opened&&<HandReview hand={opened.hand} initialView={opened.view} unit={unit} opener={opened.opener} onClose={()=>setOpened(null)}/>}
 </section>;
}
