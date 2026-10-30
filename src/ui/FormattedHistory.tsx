import type {ReviewHand,ReviewEvent} from '../review/model.ts';
import {historyStreets,showdownResults} from '../review/history.ts';
import {Cards,reviewMoney} from './ReviewCards.tsx';

const title=(street:string)=>street[0]!.toUpperCase()+street.slice(1);
function ActionPhrase({event,hand,unit}:{event:ReviewEvent;hand:ReviewHand;unit:string}){
 const player=hand.players.find(player=>player.name===event.player);
 const verbs:Record<string,string>={R:'raises to',B:'bets',C:'calls',X:'checks',F:'folds',Return:'receives uncalled bet',Straddle:'straddles',Ante:'posts ante',SB:'posts small blind',BB:'posts big blind','Auto BB':'posts auto blind'};
 const actor=event.player==='Hero'?'Hero':player?.position??event.player;
 return <span className={'history-action '+(event.player==='Hero'?'is-hero':'')} title={event.text}><span className="history-actor">{actor}</span> {verbs[event.code??'']??event.code}{event.amount!==undefined&&<> {reviewMoney(event.amount,hand.bigBlind,unit)}</>}{event.allIn&&' all-in'}</span>;
}

export function FormattedHistory({hand,unit}:{hand:ReviewHand;unit:string}){
 const streets=historyStreets(hand),results=showdownResults(hand),forced=hand.events.filter(event=>event.forced||event.kind==='splash');
 const multipleBoards=Object.keys(hand.events.at(-1)!.frame.boards).length>1;
 const netClass=(amount:bigint|null)=>amount===null||amount===0n?'':amount<0n?'negative':'positive';
 return <>
  <div className="history-overview">
   <div className="history-game"><div><h3>{reviewMoney(hand.smallBlind,hand.bigBlind,'₮')} / {reviewMoney(hand.bigBlind,hand.bigBlind,'₮')} · {hand.game==='NLH'?'No-Limit Hold’em':hand.game}</h3><p>{hand.players.length} players · {hand.date} · Table {hand.table}</p></div><div className="history-hero-result"><span>Hero Net Won</span><strong className={netClass(hand.net)}>{reviewMoney(hand.net,hand.bigBlind,unit)}</strong></div></div>
   <table className="history-roster"><thead><tr><th>Position</th><th>Player</th><th>Starting stack</th><th>In BB</th></tr></thead><tbody>{hand.players.map(player=><tr key={player.name} className={player.name==='Hero'?'history-roster-hero':''}><td>{player.position}{player.dealer&&<span className="history-dealer" title="Dealer button">D</span>}</td><td>{player.name}{player.name==='Hero'&&<span className="history-you">Hero</span>}</td><td>{reviewMoney(player.startingStack,hand.bigBlind,'₮')}</td><td>{reviewMoney(player.startingStack,hand.bigBlind,'BB')}</td></tr>)}</tbody></table>
  </div>
  <div className="history-streets">{streets.map((street,index)=><section className="history-street" key={index} aria-label={title(street.street)+' history'}>
   <div className="history-street-head"><div><h3>{title(street.street)}</h3><p>{street.players} players <span>·</span> Pot {reviewMoney(street.pot,hand.bigBlind,unit)}</p></div><div className="history-street-boards">{street.street==='preflop'?<div className="history-hole-cards"><span>Hero</span><Cards cards={hand.players.find(player=>player.name==='Hero')?.cards??null}/></div>:Object.entries(street.boards).map(([board,cards])=><div key={board} className="history-street-board">{multipleBoards&&<small>Board {Number(board)+1}</small>}<Cards cards={cards}/></div>)}</div></div>
   {street.events.length?<p className="history-action-line">{street.events.map((event,i)=><span key={i}>{i>0&&<span className="history-action-separator">, </span>}<ActionPhrase event={event} hand={hand} unit={unit}/></span>)}</p>:<p className="history-no-actions">No betting actions.</p>}
   {street.street==='preflop'&&forced.length>0&&<details className="history-forced"><summary>Blinds, antes &amp; Splash</summary><div>{forced.map((event,i)=><p key={i}>{event.kind==='splash'?<>{event.text.startsWith('MEGA')?'Mega Splash':'Splash'} dropped {reviewMoney(event.amount??null,hand.bigBlind,unit)}</>:<ActionPhrase event={event} hand={hand} unit={unit}/>}</p>)}</div></details>}
  </section>)}</div>
  <section className="history-showdown" aria-label="Hand results"><div className="history-results-head"><h3>{hand.events.some(event=>event.street==='showdown')?'Showdown':'Results'}</h3><span>Net results after contributions</span></div><div className="history-result-players">{results.map(result=><article key={result.player.name} className={'history-player-result '+(result.player.name==='Hero'?'is-hero':'')}>
   <Cards cards={result.cards}/><div><div className="history-result-name"><strong>{result.player.name}</strong><span>{result.player.position}</span></div><div className="history-combination">{result.folded?'Folded':result.combinations.length?result.combinations.map((combination,i)=><span key={i}>{multipleBoards&&`B${i+1}: `}{combination}</span>):'Cards not revealed'}</div><strong className={'history-outcome '+netClass(result.player.net)}>{result.player.net===null?'Net Won unavailable':result.player.net>0n?'Won '+reviewMoney(result.player.net,hand.bigBlind,unit):result.player.net<0n?'Lost '+reviewMoney(-result.player.net,hand.bigBlind,unit):'Net Won '+reviewMoney(0n,hand.bigBlind,unit)}</strong></div>
  </article>)}</div></section>
  <div className="history-summary-bar"><span>Total pot <strong>{reviewMoney(hand.pot,hand.bigBlind,unit)}</strong></span><span>Rake <strong>{reviewMoney(hand.rake,hand.bigBlind,unit)}</strong></span><span>Splash Fee <strong>{reviewMoney(hand.fee,hand.bigBlind,unit)}</strong></span></div>
 </>;
}
