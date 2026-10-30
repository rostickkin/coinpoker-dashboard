import {useId,useLayoutEffect,useRef,useState} from 'react';
import type {ReviewHand} from '../review/model.ts';
import {showdownResults} from '../review/history.ts';
import {Cards,ReviewIcon,reviewMoney} from './ReviewCards.tsx';

export function HistoryShowdown({hand,unit}:{hand:ReviewHand;unit:string}){
 const [expanded,setExpanded]=useState(false),[height,setHeight]=useState(0),content=useRef<HTMLDivElement>(null),id=useId();
 useLayoutEffect(()=>{
  const node=content.current!;
  const measure=()=>setHeight(node.scrollHeight);
  measure();const observer=new ResizeObserver(measure);observer.observe(node);
  return ()=>observer.disconnect();
 },[]);
 const results=showdownResults(hand),multipleBoards=Object.keys(hand.events.at(-1)!.frame.boards).length>1;
 const showdown=hand.events.some(event=>event.street==='showdown');
 return <section className="history-showdown" aria-label="Hand results">
  <h3 className="history-results-heading"><button className="history-showdown-toggle" aria-label={showdown?'Showdown':'Hand results'} aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(value=>!value)}><span>{showdown?'Showdown':'Results'}</span><span className="history-showdown-hint">{expanded?'Hide cards & results':'Reveal cards & results'}</span><ReviewIcon name="next"/></button></h3>
  <div id={id} className="history-showdown-content" aria-hidden={!expanded} inert={!expanded} style={{height:expanded?height:0}}>
   <div ref={content} className="history-result-players">{results.map(result=><article key={result.player.name} className={'history-player-result '+(result.player.name==='Hero'?'is-hero':'')}>
    <Cards cards={result.cards}/><div><div className="history-result-name"><strong>{result.player.name}</strong><span>{result.player.position}</span></div><div className="history-combination">{result.folded?'Folded':result.combinations.length?result.combinations.map((combination,i)=><span key={i}>{multipleBoards&&`B${i+1}: `}{combination}</span>):'Cards not revealed'}</div><strong className={'history-outcome '+(result.player.net===null||result.player.net===0n?'':result.player.net<0n?'negative':'positive')}>{result.player.net===null?'Net Won unavailable':result.player.net>0n?'Won '+reviewMoney(result.player.net,hand.bigBlind,unit):result.player.net<0n?'Lost '+reviewMoney(-result.player.net,hand.bigBlind,unit):'Net Won '+reviewMoney(0n,hand.bigBlind,unit)}</strong></div>
   </article>)}</div>
  </div>
 </section>;
}
