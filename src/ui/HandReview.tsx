import {useEffect,useRef,useState} from 'react';
import type {ReviewHand} from '../review/model.ts';
import {Cards,ReviewIcon,reviewMoney} from './ReviewCards.tsx';
import {FormattedHistory} from './FormattedHistory.tsx';
import {downloadHistoryScreenshot} from './historyScreenshot.ts';
import {HistoryResizeHandle} from './HistoryResizeHandle.tsx';
import './hand-review.css';
import './formatted-history.css';

export function HandReview({hand,initialView,unit,opener,onClose}:{hand:ReviewHand;initialView:'replay'|'text';unit:string;opener:HTMLButtonElement;onClose:()=>void}){
 const [view,setView]=useState(initialView),[index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[raw,setRaw]=useState(false),[historyUnit,setHistoryUnit]=useState(unit==='BB'?'BB':'₮'),[copyStatus,setCopyStatus]=useState(''),[saving,setSaving]=useState(false),[expandedWindow,setExpandedWindow]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),capture=useRef<HTMLDivElement>(null),last=hand.events.length-1,event=hand.events[index]!,frame=event.frame;
 useEffect(()=>{const node=dialog.current!,overflow=document.body.style.overflow;node.showModal();document.body.style.overflow='hidden';return ()=>{node.close();document.body.style.overflow=overflow;opener.focus();};},[opener]);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setIndex(i=>Math.min(i+1,last)),850);return ()=>clearInterval(timer);},[playing,last]);
 useEffect(()=>{if(index===last)setPlaying(false);},[index,last]);
 useEffect(()=>{const node=dialog.current!;for(const property of ['width','height','position','margin','left','top','right','bottom'])node.style.removeProperty(property);},[view,expandedWindow]);
 const jump=(i:number)=>{setPlaying(false);setIndex(Math.max(0,Math.min(last,i)));};
 const switchView=()=>{setPlaying(false);setView(v=>v==='replay'?'text':'replay');};
 const copy=async()=>{try{await navigator.clipboard.writeText(hand.raw);setCopyStatus('Copied');}catch{setRaw(true);setCopyStatus('Select the original text to copy.');}};
 const screenshot=async()=>{
  if(!capture.current||saving)return;
  setSaving(true);setCopyStatus('Saving screenshot…');
  try{await downloadHistoryScreenshot(capture.current,hand.id,raw?'original':historyUnit);setCopyStatus('Screenshot saved');}
  catch{setCopyStatus('Could not save screenshot. Please try again.');}
  finally{setSaving(false);}
 };
 const heroIndex=Math.max(0,hand.players.findIndex(p=>p.name==='Hero'));
 const streetIndices=['preflop','flop','turn','river','showdown'].map(street=>({street,index:hand.events.findIndex(e=>e.street===street&&(street==='preflop'||e.kind==='board'||e.kind==='section'))}));
 return <dialog ref={dialog} className={'hand-review-dialog '+(view==='text'?'history-dialog '+(expandedWindow?'history-expanded ':'')+(saving?'history-saving':''):'')} aria-label={view==='replay'?'Hand replayer':'Hand history'} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="review-dialog-scroll"><div ref={capture} className="review-window">
  <div className="review-window-head"><div><h2>{view==='replay'?'Hand replayer':'Hand history'}</h2><small>CoinPoker · Hand #{hand.id}</small></div><div className="review-window-actions" data-screenshot-exclude>{view==='text'&&<button onClick={()=>setExpandedWindow(value=>!value)} aria-label={expandedWindow?'Restore window size':'Expand window'} title={expandedWindow?'Restore window size':'Expand window · Drag the bottom-right corner to resize'} disabled={saving}><ReviewIcon name={expandedWindow?'restore':'expand'}/></button>}<button onClick={onClose} aria-label="Close window"><ReviewIcon name="close"/></button></div></div>
  {view==='replay'&&<div className="review-window-meta"><span>NL{Number(hand.bigBlind)} · {hand.players.length}-handed · {hand.game} · Table {hand.table} · {hand.date}</span><span>Hero <Cards cards={hand.players.find(p=>p.name==='Hero')?.cards??null}/> <span className={hand.net!==null&&hand.net<0n?'negative':'positive'}>{reviewMoney(hand.net,hand.bigBlind,unit)}</span></span></div>}
  {view==='replay'?<>
   <div className="replay-layout"><div className={'replay-table-stage '+(hand.players.length>6?'replay-many':'')}>
    <div className="replay-felt"><small>{frame.street}</small><strong>Pot {reviewMoney(frame.pot,hand.bigBlind,unit)}</strong><div className="replay-boards">{Object.entries(frame.boards).length?Object.entries(frame.boards).map(([board,cards])=><div className="replay-board" key={board}>{Object.keys(frame.boards).length>1&&<small>Board {Number(board)+1}</small>}<Cards cards={cards}/></div>):<div className="replay-board"><small>No board dealt</small></div>}</div></div>
    {hand.players.map((player,i)=>{
     const state=frame.players.find(p=>p.name===player.name)!,angle=Math.PI/2+(i-heroIndex)*2*Math.PI/hand.players.length;
     return <div key={player.name} style={{left:(50+41*Math.cos(angle))+'%',top:(50+38*Math.sin(angle))+'%'}} className={'replay-seat '+(state.folded?'seat-folded ':'')+(event.player===player.name?'seat-active':'')}>
      <strong title={player.name} className={player.name==='Hero'?'positive':''}>{player.name}</strong><span>{player.position}{player.dealer&&<b className="dealer-marker" aria-label="Dealer">D</b>}</span><span className="seat-stack">{reviewMoney(state.remaining,hand.bigBlind,unit)}{state.allIn&&' · AI'}</span><Cards cards={state.cards}/>{state.live>0n&&<small className="seat-live">Bet {reviewMoney(state.live,hand.bigBlind,unit)}</small>}
     </div>;
    })}
   </div><aside className="replay-action-log" aria-label="Action log"><h3>Actions</h3>{hand.events.slice(0,index+1).map((entry,i)=>({entry,i})).filter(({entry})=>entry.kind!=='section'||entry.street!=='preflop').slice(-8).map(({entry,i})=><button key={i} aria-current={i===index?'step':undefined} onClick={()=>jump(i)}>{entry.text}</button>)}</aside></div>
   <div className="replay-controls"><div className="replay-transport"><button aria-label="Start of hand" onClick={()=>jump(0)} disabled={index===0}><ReviewIcon name="first"/></button><button aria-label="Previous action" onClick={()=>jump(index-1)} disabled={index===0}><ReviewIcon name="prev"/></button><button className="primary" aria-label={playing?'Pause':'Play'} onClick={()=>{if(index===last)setIndex(0);setPlaying(p=>!p);}}><ReviewIcon name={playing?'pause':'play'}/>{playing?'Pause':'Play'}</button><button aria-label="Next action" onClick={()=>jump(index+1)} disabled={index===last}><ReviewIcon name="next"/></button><button aria-label="End of hand" onClick={()=>jump(last)} disabled={index===last}><ReviewIcon name="last"/></button><small>{index+1} / {hand.events.length}</small></div><button onClick={switchView} aria-label="Text history"><ReviewIcon name="text"/>Text</button></div>
   <div className="replay-streets">{streetIndices.map(({street,index:target})=><button key={street} disabled={target<0} aria-pressed={frame.street===street} onClick={()=>jump(target)}>{street[0]!.toUpperCase()+street.slice(1)}</button>)}</div>
   <input className="replay-progress" aria-label="Replay action" type="range" min={0} max={last} value={index} onChange={e=>jump(Number(e.target.value))}/>
   <div className="replay-current" role="status" aria-live="polite">{event.text}</div>
  </>:<>
   <div className="history-toolbar" data-screenshot-toolbar data-screenshot-exclude><div className="history-view-controls"><div className="unit"><button aria-pressed={!raw} disabled={saving} onClick={()=>setRaw(false)}>Formatted</button><button aria-pressed={raw} disabled={saving} onClick={()=>setRaw(true)}>Original text</button></div><div className="unit history-unit" role="group" aria-label="Hand history units" title={raw?'Original text keeps its recorded amounts.':'Bet sizes and results in currency or big blinds'}>{(['₮','BB'] as const).map(mode=><button key={mode} aria-label={'Show hand history in '+mode} aria-pressed={historyUnit===mode} disabled={raw||saving} onClick={()=>setHistoryUnit(mode)}>{mode}</button>)}</div></div><span role="status">{copyStatus}</span><div className="history-toolbar-actions"><button onClick={()=>void copy()} disabled={saving}><ReviewIcon name="copy"/>Copy</button><button onClick={()=>void screenshot()} aria-label="Save hand history screenshot" disabled={saving}><ReviewIcon name="camera"/>{saving?'Saving…':'Screenshot'}</button><button onClick={switchView} disabled={saving}><ReviewIcon name="play"/>Replay</button></div></div>
   <div className={'history-body '+(raw?'':'history-formatted')} inert={saving}>{raw?<pre>{hand.raw}</pre>:<FormattedHistory hand={hand} unit={historyUnit}/>}</div>
  </>}
  {!!hand.issues.length&&<details className="review-issues"><summary>Hand diagnostics ({hand.issues.length})</summary><p>{hand.issues.join(' · ')}</p></details>}
 </div></div>{view==='text'&&<HistoryResizeHandle dialog={dialog} disabled={saving}/>}</dialog>;
}
