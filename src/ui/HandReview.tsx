import {useEffect,useRef,useState} from 'react';
import type {ReviewHand} from '../review/model.ts';
import {ReviewIcon} from './ReviewCards.tsx';
import {FormattedHistory} from './FormattedHistory.tsx';
import {downloadHistoryScreenshot} from './historyScreenshot.ts';
import {HistoryResizeHandle} from './HistoryResizeHandle.tsx';
import {ReplayTable,replayEventText} from './ReplayTable.tsx';
import './hand-review.css';
import './formatted-history.css';
import './replayer.css';

interface HandReviewProps {hand:ReviewHand;initialView:'replay'|'text';unit:string;opener:HTMLButtonElement;onClose:()=>void;onPreviousHand?:(unit:string)=>void;onNextHand?:(unit:string)=>void;onOpenText?:(hand:ReviewHand,unit:string,opener:HTMLButtonElement)=>boolean;standalone?:boolean}

export function HandReview({hand,initialView,unit,opener,onClose,onPreviousHand,onNextHand,onOpenText,standalone=false}:HandReviewProps){
 const [view,setView]=useState(initialView),[index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[raw,setRaw]=useState(false),[historyUnit,setHistoryUnit]=useState(unit==='BB'?'BB':'₮'),[copyStatus,setCopyStatus]=useState(''),[saving,setSaving]=useState(false),[expandedWindow,setExpandedWindow]=useState(false);
 const [replayUnit,setReplayUnit]=useState(unit==='BB'?'BB':'₮'),[popupError,setPopupError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),capture=useRef<HTMLDivElement>(null),actionLog=useRef<HTMLElement>(null),last=hand.events.length-1,event=hand.events[index]!,frame=event.frame;
 useEffect(()=>{const node=dialog.current!,doc=node.ownerDocument,overflow=doc.body.style.overflow;node.showModal();doc.body.style.overflow='hidden';return ()=>{node.close();doc.body.style.overflow=overflow;if(opener.isConnected)opener.focus();};},[opener]);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setIndex(i=>Math.min(i+1,last)),850);return ()=>clearInterval(timer);},[playing,last]);
 useEffect(()=>{if(index===last)setPlaying(false);},[index,last]);
 useEffect(()=>{const node=actionLog.current;if(!node)return;const reveal=()=>{node.scrollTop=node.scrollHeight;};reveal();const observer=new ResizeObserver(reveal);observer.observe(node);return ()=>observer.disconnect();},[index,view]);
 useEffect(()=>{const node=dialog.current!;for(const property of ['width','height','position','margin','left','top','right','bottom'])node.style.removeProperty(property);},[view,expandedWindow]);
 const jump=(i:number)=>{setPlaying(false);setIndex(Math.max(0,Math.min(last,i)));};
 const switchView=()=>{setPlaying(false);setView(v=>v==='replay'?'text':'replay');};
 const openText=(button:HTMLButtonElement)=>{setPlaying(false);if(onOpenText?.(hand,replayUnit,button))setPopupError('');else setPopupError('Allow pop-ups for this site, then click Text again.');};
 const copy=async()=>{try{await dialog.current!.ownerDocument.defaultView!.navigator.clipboard.writeText(hand.raw);setCopyStatus('Copied');}catch{setRaw(true);setCopyStatus('Select the original text to copy.');}};
 const screenshot=async()=>{
  if(!capture.current||saving)return;
  setSaving(true);setCopyStatus('Saving screenshot…');
  try{await downloadHistoryScreenshot(capture.current,hand.id,raw?'original':historyUnit);setCopyStatus('Screenshot saved');}
  catch{setCopyStatus('Could not save screenshot. Please try again.');}
  finally{setSaving(false);}
 };
 const streetIndices=['preflop','flop','turn','river','showdown'].map(street=>({street,index:hand.events.findIndex(e=>e.street===street&&(street==='preflop'||e.kind==='board'||e.kind==='section'))}));
 return <dialog ref={dialog} className={'hand-review-dialog '+(view==='text'?'history-dialog '+(expandedWindow?'history-expanded ':'')+(saving?'history-saving':''):'replayer-dialog')} aria-label={view==='replay'?'Hand replayer':'Hand history'} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="review-dialog-scroll"><div ref={capture} className="review-window">
  <div className="review-window-head"><div><h2>{view==='replay'?'Hand replayer':'Hand history'}</h2><small>CoinPoker · Hand #{hand.id}</small></div><div className="review-window-actions" data-screenshot-exclude>{view==='text'&&<button onClick={()=>setExpandedWindow(value=>!value)} aria-label={expandedWindow?'Restore window size':'Expand window'} title={expandedWindow?'Restore window size':'Expand window · Drag the bottom-right corner to resize'} disabled={saving}><ReviewIcon name={expandedWindow?'restore':'expand'}/></button>}<button onClick={onClose} aria-label="Close window"><ReviewIcon name="close"/></button></div></div>
  {view==='replay'&&<div className="review-window-meta"><span>NL{Number(hand.bigBlind)} · {hand.players.length}-handed · {hand.game} · Table {hand.table}</span><span>{hand.date}</span></div>}
  {view==='replay'?<>
   <div className="replay-layout"><ReplayTable hand={hand} index={index} unit={replayUnit}/><aside ref={actionLog} className="replay-action-log" aria-label="Action log"><h3>Actions</h3>{hand.events.slice(0,index+1).map((entry,i)=>({entry,i})).filter(({entry})=>entry.kind!=='section'||entry.street!=='preflop').slice(-10).map(({entry,i})=><button key={i} className={entry.kind==='board'||entry.kind==='section'?'replay-log-section':undefined} aria-current={i===index?'step':undefined} onClick={()=>jump(i)}>{replayEventText(hand,entry,replayUnit)}</button>)}</aside></div>
   <div className="replay-controls"><div className="replay-transport"><button aria-label="Previous hand" title="Previous hand" onClick={()=>{setPlaying(false);onPreviousHand?.(replayUnit);}} disabled={!onPreviousHand}><ReviewIcon name="previousHand"/></button><button aria-label="Previous action" title="Previous action" onClick={()=>jump(index-1)} disabled={index===0}><ReviewIcon name="prev"/></button><button className="primary" aria-label={playing?'Pause':'Play'} onClick={()=>{if(index===last)setIndex(0);setPlaying(p=>!p);}}><ReviewIcon name={playing?'pause':'play'}/>{playing?'Pause':'Play'}</button><button aria-label="Next action" title="Next action" onClick={()=>jump(index+1)} disabled={index===last}><ReviewIcon name="next"/></button><button aria-label="Next hand" title="Next hand" onClick={()=>{setPlaying(false);onNextHand?.(replayUnit);}} disabled={!onNextHand}><ReviewIcon name="nextHand"/></button><small>{index+1} / {hand.events.length}</small></div><div className="replay-view-controls"><div className="unit" role="group" aria-label="Replay units">{(['₮','BB'] as const).map(mode=><button key={mode} aria-label={'Show replay in '+mode} aria-pressed={replayUnit===mode} onClick={()=>setReplayUnit(mode)}>{mode}</button>)}</div><button onClick={e=>openText(e.currentTarget)} aria-label="Text history" title="Open hand history in a separate window"><ReviewIcon name="text"/>Text</button></div></div>
   <div className="replay-streets">{streetIndices.map(({street,index:target})=><button key={street} disabled={target<0} aria-pressed={frame.street===street} onClick={()=>jump(target)}>{street[0]!.toUpperCase()+street.slice(1)}</button>)}</div>
   <input className="replay-progress" aria-label="Replay action" type="range" min={0} max={last} value={index} onChange={e=>jump(Number(e.target.value))}/>
   <div className="replay-current" role="status" aria-live="polite">{replayEventText(hand,event,replayUnit)}</div>
   {popupError&&<p className="replay-popup-error" role="alert">{popupError}</p>}
  </>:<>
   <div className="history-toolbar" data-screenshot-toolbar data-screenshot-exclude><div className="history-view-controls"><div className="unit"><button aria-pressed={!raw} disabled={saving} onClick={()=>setRaw(false)}>Formatted</button><button aria-pressed={raw} disabled={saving} onClick={()=>setRaw(true)}>Original text</button></div><div className="unit history-unit" role="group" aria-label="Hand history units" title={raw?'Original text keeps its recorded amounts.':'Bet sizes and results in currency or big blinds'}>{(['₮','BB'] as const).map(mode=><button key={mode} aria-label={'Show hand history in '+mode} aria-pressed={historyUnit===mode} disabled={raw||saving} onClick={()=>setHistoryUnit(mode)}>{mode}</button>)}</div></div><span role="status">{copyStatus}</span><div className="history-toolbar-actions"><button onClick={()=>void copy()} disabled={saving}><ReviewIcon name="copy"/>Copy</button><button onClick={()=>void screenshot()} aria-label="Save hand history screenshot" disabled={saving}><ReviewIcon name="camera"/>{saving?'Saving…':'Screenshot'}</button>{!standalone&&<button onClick={switchView} disabled={saving}><ReviewIcon name="play"/>Replay</button>}</div></div>
   <div className={'history-body '+(raw?'':'history-formatted')} inert={saving}>{raw?<pre>{hand.raw}</pre>:<FormattedHistory hand={hand} unit={historyUnit}/>}</div>
  </>}
  {!!hand.issues.length&&<details className="review-issues"><summary>Hand diagnostics ({hand.issues.length})</summary><p>{hand.issues.join(' · ')}</p></details>}
 </div></div>{view==='text'&&<HistoryResizeHandle dialog={dialog} disabled={saving}/>}</dialog>;
}
