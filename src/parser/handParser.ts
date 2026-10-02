import {money,localTime,SCHEMA_VERSION} from '../core/value.ts';
import type {RawHand} from './scanner.ts';
import type {Hand,Street,Kind} from './model.ts';
const M='₮((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?)';
const rx=(s:string)=>new RegExp(s);
const cards=(s:string):string[]=>{const parts=s.replaceAll('[',' ').replaceAll(']',' ').trim().split(/\s+/).filter(Boolean);if(parts.some(c=>!/^[2-9TJQKA][cdhs]$/.test(c)))throw Error('Invalid card token');return parts;};
const indices:Record<string,number>={FIRST:0,SECOND:1,THIRD:2};
export function parseHand(raw:RawHand):Hand {
 const h:Hand={room:'CoinPoker',schemaVersion:SCHEMA_VERSION,handId:'unknown@'+raw.startLine,gameType:'unsupported',gameRaw:'',stakesRaw:'',smallBlind:0n,bigBlind:0n,ante:null,startedAt:null,endedAt:null,tableId:'',buttonSeat:0,maxPlayers:0,players:[],actions:[],tokens:[],raw,boards:{},runMode:'unknown',runCount:1,summaryPresent:false,handRake:null,handSplashFee:null,totalPot:null,splashType:'none',splashDroppedTotal:0n,summaryOutcomes:[],diagnostics:[]};
 let street:Street='preflop',boardIndex=0,summary=false,sequence=0;
 const diag=(code:string,line:number,text:string,message:string)=>h.diagnostics.push({code,severity:'error',handId:h.handId,line,raw:text,message});
 for(const {line,raw:text} of raw.lines){let category='blank';sequence++;try {
  let m:RegExpExecArray|null;
  if(!text.trim()){}
  else if((m=/^CoinPoker Hand #(\d+): (.+?) \(([^)]+)\) (.+)$/.exec(text))){category='header';h.handId=m[1]!;h.gameRaw=m[2]!;h.gameType=m[2]==='NLH'?'NLH':m[2]==='NLH BombPot'?'BombPot':'unsupported';h.stakesRaw=m[3]!;const stake=m[3]!.split('/').map(money);h.smallBlind=stake[0]!;h.bigBlind=stake[1]!;h.ante=stake[2]??null;h.startedAt=localTime(m[4]!);}
  else if((m=/^Table '([^']+)' (\d+)-max Seat #(\d+) is the button$/.exec(text))){category='table';h.tableId=m[1]!;h.maxPlayers=Number(m[2]);h.buttonSeat=Number(m[3]);}
  else if(!summary&&(m=rx('^Seat (\\d+): (.+) \\('+M+' in chips\\)$').exec(text))){category='seat';h.players.push({seat:Number(m[1]),name:m[2]!,startingStack:money(m[3]!),dealtIn:false,cards:null});}
  else if((m=/^Dealt to (.+?)(?: \[([^\]]+)\])?$/.exec(text))){category='dealt';const p=h.players.find(p=>p.name===m![1]);if(!p)throw Error('Unknown dealt player');p.dealtIn=true;if(m[2])p.cards=cards(m[2]);}
  else if((m=/^\*\*\* (?:(FIRST|SECOND|THIRD) )?(HOLE CARDS|FLOP|TURN|RIVER|SHOWDOWN|SUMMARY) \*\*\*(.*)$/.exec(text))){category='section';boardIndex=indices[m[1]??'FIRST']!;if(m[2]==='SUMMARY'){summary=true;h.summaryPresent=true;}if(['FLOP','TURN','RIVER'].includes(m[2]!)){street=m[2]!.toLowerCase() as Street;h.boards[boardIndex]=cards(m[3]!);}}
  else if((m=rx('^(MEGA SPLASH|SPLASH) dropped '+M+'$').exec(text))){category='splash';h.splashType=m[1]==='SPLASH'?'regular':'mega';h.splashDroppedTotal+=money(m[2]!);}
  else if((m=rx('^Total pot '+M+' \\| Rake '+M+'(?: \\| Splash Fee '+M+')?$').exec(text))){category='totals';h.totalPot=money(m[1]!);h.handRake=money(m[2]!);h.handSplashFee=m[3]?money(m[3]):null;}
  else if((m=/^Hand was run (once|two times|three times|with two boards)$/.exec(text))){category='run';h.runMode=m[1]!;h.runCount=m[1]==='three times'?3:m[1]==='once'?1:2;}
  else if((m=/^(?:(FIRST|SECOND|THIRD) )?Board \[(.*)\]$/.exec(text))){category='board';h.boards[indices[m[1]??'FIRST']!]=cards(m[2]!);}
  else if((m=/^Game ended: (.+)$/.exec(text))){category='end';h.endedAt=localTime(m[1]!);}
  else if(summary&&/^Seat \d+: /.test(text)){category='outcome';h.summaryOutcomes.push(text);const seat=/^Seat (\d+): (.*)$/.exec(text)!;const p=h.players.find(p=>p.seat===Number(seat[1]));const rest=p&&seat[2]!.startsWith(p.name+' ')?seat[2]!.slice(p.name.length+1):'';if(!/^(?:folded before Flop \(didn't bet\)|folded on the (?:Flop|Turn|River)|didn't show|won \(₮[\d,.]+\)(?:, and won \(₮[\d,.]+\))*|showed \[[2-9TJQKAcdhs ]+\] and (?:won|lost|cashed out) .+)$/.test(rest))diag(/₮/.test(text)?'UNKNOWN_MONETARY_LINE':'UNKNOWN_STRUCTURAL_LINE',line,text,'Unknown summary outcome');const sm=/showed \[([^\]]+)\]/.exec(rest);if(sm&&p){const c=cards(sm[1]!);if(p.cards&&p.cards.join()!==c.join())diag('CONFLICTING_HOLE_CARDS',line,text,'Summary contradicts hole cards');if(!p.cards)p.cards=c;}}
  else {
   let player='',kind:Kind|undefined,amount=0n,to:bigint|null=null,fee:bigint|null=null,explicitAllIn=false;
   if((m=rx('^(.+) collected '+M+' from pot$').exec(text))){player=m[1]!;kind='collected';amount=money(m[2]!);}
   else if((m=rx('^(.+) cashed out the hand for '+M+' \\| Cash Out Fee '+M+'$').exec(text))){player=m[1]!;kind='cashout';amount=money(m[2]!);fee=money(m[3]!);}
   else if((m=/^(.+?): (.+)$/.exec(text))){player=m[1]!;const rest=m[2]!;let a:RegExpExecArray|null;
    if((a=rx('^posts (ante|small blind|big blind|auto big blind) '+M+'( ALLIN)?$').exec(rest))){kind=({ante:'ante','small blind':'sb','big blind':'bb','auto big blind':'autoBB'} as const)[a[1] as 'ante'];amount=money(a[2]!);explicitAllIn=!!a[3];}
    else if((a=rx('^(calls|bets|ALLIN|RETURN|STRADDLE) '+M+'$').exec(rest))){kind=a[1] as Kind;amount=money(a[2]!);explicitAllIn=kind==='ALLIN';}
    else if((a=rx('^raises '+M+' to '+M+'$').exec(rest))){kind='raises';amount=money(a[1]!);to=money(a[2]!);}
    else if(rest==='folds'||rest==='checks')kind=rest;
    else if(rest==='mucks hand')kind='mucks';
    else if((a=/^shows \[([^\]]+)\] \(.+\)$/.exec(rest))){kind='shows';const p=h.players.find(p=>p.name===player);if(p){const c=cards(a[1]!);if(p.cards&&p.cards.join()!==c.join())diag('CONFLICTING_HOLE_CARDS',line,text,'Contradictory hole cards');p.cards=c;}}
   }
   if(kind){category='action';if(!h.players.some(p=>p.name===player))diag('UNKNOWN_PLAYER',line,text,'Action player absent in seats');h.actions.push({sequence,line,raw:text,player,kind,street,boardIndex,boardAtAction:[...(h.boards[boardIndex]??[])],amount,to,fee,explicitAllIn});}
   else {category='unknown';diag(/₮/.test(text)?'UNKNOWN_MONETARY_LINE':/^\*|^Seat|^Table|^CoinPoker/.test(text)?'UNKNOWN_STRUCTURAL_LINE':'UNKNOWN_ACTION',line,text,'Unrecognized syntax preserved');}
  }
 }catch(error){category='invalid';diag(/₮/.test(text)?'UNKNOWN_MONETARY_LINE':'MALFORMED_LINE',line,text,String(error));}
 h.tokens.push({sequence,line,raw:text,category});}
 if(!h.summaryPresent||!h.endedAt||h.totalPot===null)diag('INCOMPLETE_HAND',raw.endLine,raw.lines.at(-1)?.raw??'','Missing required end/summary');
 if(h.players.filter(p=>p.name==='Hero').length!==1||new Set(h.players.map(p=>p.seat)).size!==h.players.length||new Set(h.players.map(p=>p.name)).size!==h.players.length||h.players.length>h.maxPlayers||h.players.some(p=>p.seat<1||p.seat>h.maxPlayers))diag('INVALID_SEATING',raw.startLine,'','Invalid seats or Hero');
 const known=h.players.flatMap(p=>p.cards??[]);if(h.players.some(p=>p.cards&&p.cards.length!==2)||new Set(known).size!==known.length)diag('INVALID_HOLE_CARDS',raw.startLine,'','Invalid or duplicate known hole cards');
 for(const board of Object.values(h.boards)){if(![0,3,4,5].includes(board.length)||new Set([...known,...board]).size!==known.length+board.length)diag('INVALID_BOARD_CARDS',raw.startLine,'','Invalid board or duplicate physical card in one run');}
 return h;
}
