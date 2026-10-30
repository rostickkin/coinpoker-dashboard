import type {ProcessedHand} from '../import/core.ts';
import {position} from '../metrics/hero.ts';
import {money} from '../core/value.ts';
import type {Street} from '../parser/model.ts';

export interface ReviewPlayer {name:string;seat:number;position:string;startingStack:bigint;cards:string[]|null;dealer:boolean;net:bigint|null;collected:bigint}
export interface ReplayPlayer {name:string;remaining:bigint;live:bigint;folded:boolean;allIn:boolean;cards:string[]|null}
export interface ReplayFrame {street:string;boards:Record<number,string[]>;players:ReplayPlayer[];pot:bigint}
export interface ReviewEvent {kind:'action'|'board'|'section'|'award'|'splash'|'warning';street:string;text:string;player?:string;code?:string;amount?:bigint;allIn?:boolean;board?:string[];boardIndex?:number;forced?:boolean;frame:ReplayFrame}
export interface ReviewHand {id:string;date:string;table:string;game:string;bigBlind:bigint;smallBlind:bigint;ante:bigint|null;net:bigint|null;pot:bigint|null;rake:bigint|null;fee:bigint|null;players:ReviewPlayer[];events:ReviewEvent[];raw:string;issues:string[]}
export interface HandsReply {request:number;hands:ReviewHand[];error?:string}

export function buildReview(p:ProcessedHand):ReviewHand {
 const {hand:h,ledger}=p;
 const sourceCards=(text:string)=>text.match(/\b[2-9TJQKA][cdhs]\b/g)??[];
 const dealtCards=(name:string)=>{const token=h.tokens.find(t=>t.category==='dealt'&&t.raw.startsWith(`Dealt to ${name} [`));return token?sourceCards(token.raw.slice(token.raw.indexOf('['))):null;};
 const players:ReviewPlayer[]=h.players.slice().sort((a,b)=>a.seat-b.seat).map(player=>{
  const financial=ledger.players.find(entry=>entry.name===player.name);
  const net=player.name==='Hero'?p.hero.netWon.value:financial&&financial.effectiveContribution.value!==null&&financial.cashOut===0n?financial.collected-financial.literalContribution:null;
  return {...player,cards:dealtCards(player.name)??player.cards,position:position(h,player.name).value??`Seat ${player.seat}`,dealer:player.seat===h.buttonSeat,net,collected:financial?.collected??0n};
 });
 let state:ReplayFrame={street:'preflop',boards:{},players:players.map(player=>({name:player.name,remaining:player.startingStack,live:0n,folded:false,allIn:false,cards:player.name==='Hero'?dealtCards(player.name):null})),pot:0n};
 const events:ReviewEvent[]=[],normal=new Map(ledger.actions.map(a=>[a.raw.sequence,a])),actions=new Map(h.actions.map(a=>[a.sequence,a]));
 const awards=new Map<string,bigint>();let contributed=0n,splash=0n,paid=0n,summary=false;
 const snapshot=():ReplayFrame=>({...state,boards:Object.fromEntries(Object.entries(state.boards).map(([key,cards])=>[key,[...cards]])),players:state.players.map(player=>({...player,cards:player.cards?[...player.cards]:null}))});
 const push=(event:Omit<ReviewEvent,'frame'>)=>events.push({...event,frame:snapshot()});
 push({kind:'section',street:'preflop',text:'Start of hand'});
 for(const token of h.tokens){
  const a=actions.get(token.sequence),n=normal.get(token.sequence);
  if(a){
   let code='',amount:bigint|undefined,allIn=false,forced=false;
   if(n){
    state.street=a.street;
    state.players=n.state.players.map(player=>({name:player.name,remaining:player.remaining+(awards.get(player.name)??0n),live:player.live,folded:player.folded,allIn:player.allIn,cards:state.players.find(old=>old.name===player.name)?.cards??null}));
    contributed=n.state.players.reduce((sum,player)=>sum+player.contributed,0n);
    state.pot=contributed+splash-paid;
    forced=['ante','sb','bb','autoBB','STRADDLE'].includes(a.kind);allIn=n.allIn;
    const codes:Record<string,string>={raise:'R',shortRaise:'R',bet:'B',call:'C',folds:'F',checks:'X',RETURN:'Return',ante:'Ante',sb:'SB',bb:'BB',autoBB:'Auto BB',STRADDLE:'Straddle'};
    code=codes[n.semantic]??a.kind;
    if(['R','B','C','Return','Ante','SB','BB','Auto BB','Straddle'].includes(code))amount=code==='R'?n.liveTotalAfter:a.kind==='RETURN'?a.amount:n.amountAdded;
   }else if(a.kind==='shows'){
    code='Show';const player=state.players.find(player=>player.name===a.player);if(player)player.cards=sourceCards(a.raw.match(/shows \[([^\]]+)\]/)?.[1]??'');
   }else if(a.kind==='mucks')code='Muck';
   else if(a.kind==='collected'||a.kind==='cashout'){
    code=a.kind==='collected'?'Win':'Cash out';amount=a.amount;
    const player=state.players.find(player=>player.name===a.player);if(player)player.remaining+=a.amount;
    awards.set(a.player,(awards.get(a.player)??0n)+a.amount);
    // A cashout is paid by the provider, not taken from the table pot.
    if(a.kind==='collected'){paid+=a.amount;state.pot=contributed+splash-paid;}
   }
   push({kind:a.kind==='collected'||a.kind==='cashout'?'award':'action',street:state.street,text:a.raw,player:a.player,code,amount,allIn,forced});
  }else if(token.category==='section'){
   const match=/^\*\*\* (?:(FIRST|SECOND|THIRD) )?(FLOP|TURN|RIVER|SHOWDOWN|SUMMARY)/.exec(token.raw);
   if(!match)continue;
   const section=match[2]!,boardIndex=match[1]==='SECOND'?1:match[1]==='THIRD'?2:0;
   if(['FLOP','TURN','RIVER'].includes(section)){
    const street=section.toLowerCase() as Street;
    if(street!==state.street)state.players.forEach(player=>{player.live=0n;});
    state.street=street;const board=sourceCards(token.raw);
    state.boards[boardIndex]=board;push({kind:'board',street,text:token.raw,board,boardIndex});
   }else{
    summary=section==='SUMMARY';state.street=section.toLowerCase();
    if(summary)state.pot=contributed+splash-paid-(h.handRake??0n)-(h.handSplashFee??0n);
    state.players.forEach(player=>{player.live=0n;});push({kind:'section',street:state.street,text:section});
   }
  }else if(token.category==='splash'){
   const amount=money(token.raw.match(/₮[\d,.]+/)![0]);splash+=amount;state.pot=contributed+splash-paid;
   push({kind:'splash',street:state.street,text:token.raw,amount});
  }else if(summary&&token.category==='board'){
   const boardIndex=token.raw.startsWith('SECOND')?1:token.raw.startsWith('THIRD')?2:0,board=sourceCards(token.raw);
   if(board.join()!==(state.boards[boardIndex]??[]).join()){state.boards[boardIndex]=board;push({kind:'board',street:'summary',text:token.raw,board,boardIndex});}
  }else if(summary&&token.category==='outcome'&&token.raw.includes('showed [')){
   const seat=Number(/^Seat (\d+):/.exec(token.raw)?.[1]),source=players.find(player=>player.seat===seat),player=state.players.find(player=>player.name===source?.name);
   const cards=sourceCards(token.raw.match(/showed \[([^\]]+)\]/)?.[1]??'');
   if(player&&cards.length&&player.cards?.join()!==cards.join()){player.cards=cards;push({kind:'action',street:'summary',text:token.raw,player:player.name,code:'Show'});}
  }else if(['invalid','unknown'].includes(token.category))push({kind:'warning',street:state.street,text:token.raw});
 }
 return {id:h.handId,date:h.startedAt?.raw??'Unknown',table:h.tableId,game:h.gameType,bigBlind:h.bigBlind,smallBlind:h.smallBlind,ante:h.ante,net:p.hero.netWon.value,pot:h.totalPot,rake:h.handRake,fee:h.handSplashFee,players,events,raw:h.raw.lines.map(line=>line.raw).join('\n'),issues:[...new Set(h.diagnostics.map(d=>d.code))]};
}
