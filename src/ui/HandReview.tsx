import {useEffect,useRef,useState} from 'react';
import type {ReviewHand} from '../review/model.ts';
import {Cards,ReviewIcon,reviewMoney} from './ReviewCards.tsx';

export function HandReview({hand,initialView,unit,opener,onClose}:{hand:ReviewHand;initialView:'replay'|'text';unit:string;opener:HTMLButtonElement;onClose:()=>void}){
 const [view,setView]=useState(initialView),[index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[raw,setRaw]=useState(false),[copyStatus,setCopyStatus]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),last=hand.events.length-1,event=hand.events[index]!,frame=event.frame;
 useEffect(()=>{const node=dialog.current!,overflow=document.body.style.overflow;node.showModal();document.body.style.overflow='hidden';return ()=>{node.close();document.body.style.overflow=overflow;opener.focus();};},[opener]);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setIndex(i=>Math.min(i+1,last)),850);return ()=>clearInterval(timer);},[playing,last]);
 useEffect(()=>{if(index===last)setPlaying(false);},[index,last]);
 const jump=(i:number)=>{setPlaying(false);setIndex(Math.max(0,Math.min(last,i)));};
 const switchView=()=>{setPlaying(false);setView(v=>v==='replay'?'text':'replay');};
 const copy=async()=>{try{await navigator.clipboard.writeText(hand.raw);setCopyStatus('Copied');}catch{setRaw(true);setCopyStatus('Select the original text to copy.');}};
 const heroIndex=Math.max(0,hand.players.findIndex(p=>p.name==='Hero'));
 const streetIndices=['preflop','flop','turn','river','showdown'].map(street=>({street,index:hand.events.findIndex(e=>e.street===street&&(street==='preflop'||e.kind==='board'||e.kind==='section'))}));
 return <dialog ref={dialog} className="hand-review-dialog" aria-label={view==='replay'?'Hand replayer':'Hand history'} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="review-window">
  <div className="review-window-head"><div><h2>{view==='replay'?'Hand replayer':'Hand history'}</h2><small>CoinPoker · Hand #{hand.id}</small></div><button onClick={onClose} aria-label="Close window"><ReviewIcon name="close"/></button></div>
  <div className="review-window-meta"><span>NL{Number(hand.bigBlind)} · {hand.players.length}-handed · {hand.game} · Table {hand.table} · {hand.date}</span><span>Hero <Cards cards={hand.players.find(p=>p.name==='Hero')?.cards??null}/> <span className={hand.net!==null&&hand.net<0n?'negative':'positive'}>{reviewMoney(hand.net,hand.bigBlind,unit)}</span></span></div>
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
   <div className="history-toolbar"><div className="unit"><button aria-pressed={!raw} onClick={()=>setRaw(false)}>Formatted</button><button aria-pressed={raw} onClick={()=>setRaw(true)}>Original text</button></div><span role="status">{copyStatus}</span><button onClick={()=>void copy()}><ReviewIcon name="copy"/>Copy</button><button onClick={switchView}><ReviewIcon name="play"/>Replay</button></div>
   <div className="history-body">{raw?<pre>{hand.raw}</pre>:<><div className="history-players">{hand.players.map(player=><div key={player.name}><strong className={player.name==='Hero'?'positive':''}>{player.name}</strong> · {player.position} · {reviewMoney(player.startingStack,hand.bigBlind,unit)}{player.name==='Hero'&&<> <Cards cards={player.cards}/></>}</div>)}</div>{hand.events.filter((entry,i)=>i>0&&(entry.street!=='summary'||entry.code==='Show'||entry.kind==='board')).map((entry,i)=>entry.kind==='board'?<h3 key={i}>{entry.street[0]!.toUpperCase()+entry.street.slice(1)}{hand.events.some(e=>e.boardIndex===1)&&` · Board ${(entry.boardIndex??0)+1}`} <Cards cards={entry.board??[]}/></h3>:entry.kind==='section'?<h3 key={i}>{entry.text}</h3>:<div key={i} className={entry.player==='Hero'?'history-hero':''}>{entry.text}{entry.code==='Show'&&<> <Cards cards={entry.frame.players.find(p=>p.name===entry.player)?.cards??null}/></>}</div>)}<h3>Summary</h3><div>Total pot {reviewMoney(hand.pot,hand.bigBlind,unit)} · Rake {reviewMoney(hand.rake,hand.bigBlind,unit)} · Splash Fee {reviewMoney(hand.fee,hand.bigBlind,unit)}</div><div>Hero Net Won: <span className="negative">{reviewMoney(hand.net,hand.bigBlind,unit)}</span></div></>}</div>
  </>}
  {!!hand.issues.length&&<details className="review-issues"><summary>Hand diagnostics ({hand.issues.length})</summary><p>{hand.issues.join(' · ')}</p></details>}
 </div></dialog>;
}
