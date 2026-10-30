import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scanLines,scanHands} from '../src/parser/scanner.ts';
import {processHand} from '../src/import/core.ts';
import {fact,query,defaults} from '../src/ui/data.ts';
import type {Database} from '../src/ui/data.ts';

async function fixture(id:string){const lines=fs.readFileSync(`tests/fixtures/${id}.txt`,'utf8').trimEnd().split(/\r?\n/).map((raw,i)=>({raw,line:i+1}));return processHand({lines,startLine:1,endLine:lines.length},{equity:false});}
const database={} as Database;

test('Top 10 defaults to biggest Hero losses and can rank wins or pots in currency and BB',async()=>{
 const p=await fixture('900000011'),a=fact(p),b=fact(await fixture('900000005'));
 a.hand.totalPot=20000n;a.hand.bigBlind=100n;a.hero.netWon.value=-10000n;
 b.hand.totalPot=30000n;b.hand.bigBlind=500n;b.hero.netWon.value=9000n;
 const result=query([a,b],[],defaults,database,true);
 assert.deepEqual(result.topHands.map(h=>h.id),['900000011','900000005']);
 assert.deepEqual(query([a,b],[],defaults,database,true,{metric:'net',direction:'desc',unit:'currency',splashOnly:false}).topHands.map(h=>h.id),['900000005','900000011']);
 assert.deepEqual(query([a,b],[],defaults,database,true,{metric:'net',direction:'asc',unit:'bb',splashOnly:false}).topHands.map(h=>h.id),['900000011','900000005']);
 assert.deepEqual(query([a,b],[],defaults,database,true,{metric:'pot',direction:'desc',unit:'currency',splashOnly:false}).topHands.map(h=>h.id),['900000005','900000011']);
 assert.deepEqual(query([a,b],[],defaults,database,true,{metric:'pot',direction:'asc',unit:'currency',splashOnly:false}).topHands.map(h=>h.id),['900000011','900000005']);
 assert.deepEqual(query([a,b],[],defaults,database,true,{metric:'pot',direction:'desc',unit:'bb',splashOnly:false}).topHands.map(h=>h.id),['900000011','900000005']);
 assert.equal(query([a,b],[],{...defaults,limits:['500']},database,true).topHands.length,1);
 b.hero.netWon.value=0n;assert.equal(query([a,b],[],defaults,database,true).topHands.length,2);
 a.hero.netWon.value=null;assert.equal(query([a,b],[],defaults,database,true).topHands.length,1);
});

test('top ten membership changes with BB ranking and uses exact large integer comparisons',async()=>{
 const base=fact(await fixture('900000011'));
 const facts=Array.from({length:12},(_,i)=>({...base,hand:{...base.hand,handId:String(i+1),totalPot:30000000000000000n-BigInt(i),bigBlind:i===0?1n:100n},hero:{...base.hero,netWon:{...base.hero.netWon,value:-10000000000000000n-BigInt(i)}}}));
 const result=query(facts,[],defaults,database,true,{metric:'net',direction:'asc',unit:'currency',splashOnly:false});
 assert.equal(result.topHands.length,10);assert.equal(result.topHands[0]!.id,'12');
 assert.equal(result.topHands.some(h=>h.id==='1'),false);
 assert.equal(query(facts,[],defaults,database,true,{metric:'net',direction:'asc',unit:'bb',splashOnly:false}).topHands[0]!.id,'1');
});

test('Splash-only ranking selects from all filtered hands before taking ten and preserves global results',async()=>{
 const base=fact(await fixture('900000011'));
 const facts=Array.from({length:13},(_,i)=>({...base,hand:{...base.hand,handId:String(i+1),splashType:i<11?'none' as const:i===11?'regular' as const:'mega' as const},hero:{...base.hero,netWon:{...base.hero.netWon,value:BigInt(100-i)}}}));
 const result=query(facts,[],defaults,database,true,{metric:'net',direction:'desc',unit:'currency',splashOnly:true});
 assert.deepEqual(result.topHands.map(h=>h.id),['12','13']);
 assert.equal(result.summary.hands,13);assert.equal(result.points.length,13);
});

test('Pot ranking includes hands with unavailable Hero results; Net Won ranking includes hands without pot totals',async()=>{
 const a=fact(await fixture('900000011')),b=fact(await fixture('900000005'));
 a.hand.totalPot=null;b.hero.netWon.value=null;
 assert.deepEqual(query([a,b],[],defaults,database,true).topHands.map(h=>h.id),['900000011']);
 assert.deepEqual(query([a,b],[],defaults,database,true,{metric:'pot',direction:'desc',unit:'currency',splashOnly:false}).topHands.map(h=>h.id),['900000005']);
});

test('source byte ranges preserve BOM, CRLF, Unicode and a split UTF-8 codepoint',async()=>{
 const original='\uFEFF'+fs.readFileSync('tests/fixtures/900000011.txt','utf8').trimEnd().replace(/\r?\n/g,'\r\n')+'\r\n'+fs.readFileSync('tests/fixtures/900000005.txt','utf8').trimEnd();
 const bytes=new TextEncoder().encode(original);
 async function* chunks(){for(let i=0;i<bytes.length;i+=7)yield bytes.slice(i,i+7);}
 const hands=[];for await(const h of scanHands(scanLines(chunks())))hands.push(h);
 for(const [i,h] of hands.entries()){
  const start=h.lines[0]!.startByte,end=h.lines.at(-1)!.endByte;
  assert.equal(typeof start,'number');assert.equal(typeof end,'number');
  const slice=new TextDecoder().decode(bytes.slice(start,end));
  assert.equal(slice.replace(/^\uFEFF/,'').split(/\r?\n/)[0],h.lines[0]!.raw);
  assert.ok(slice.includes(i===0?'#900000011':'#900000005'));
  assert.equal(slice.includes(i===0?'#900000005':'#900000011'),false);
 }
});

test('replay hides opponents until shown, deals streets before actions and applies awards',async()=>{
 const {buildReview}=await import('../src/review/model.ts');
 const review=buildReview(await fixture('900000011'));
 const flop=review.events.find(e=>e.kind==='board'&&e.street==='flop')!;
 assert.equal(flop.frame.boards[0]!.length,3);
 assert.equal(flop.frame.players.find(p=>p.name==='Player47')!.cards,null);
 assert.equal(review.events.find(e=>e.code==='Show'&&e.player==='Player47')!.frame.players.find(p=>p.name==='Player47')!.cards?.join(' '),'Qs Qd');
 const final=review.events.at(-1)!.frame;
 assert.equal(final.players.find(p=>p.name==='Hero')!.remaining,0n);
 assert.equal(final.players.find(p=>p.name==='Player47')!.remaining,20564n);
 assert.equal(final.pot,0n);assert.equal(review.net,-10000n);
 assert.ok(review.raw.startsWith('CoinPoker Hand #900000011'));
});

test('replay preserves returns and both boards without leaking future cards',async()=>{
 const {buildReview}=await import('../src/review/model.ts');
 const review=buildReview(await fixture('900000022'));
 const returned=review.events.findIndex(e=>e.code==='Return');
 assert.equal(review.events[returned-1]!.frame.pot-review.events[returned]!.frame.pot,6215n);
 const bomb=buildReview(await fixture('900000013'));
 const flops=bomb.events.filter(e=>e.kind==='board'&&e.street==='flop');
 assert.deepEqual(flops.at(-1)!.frame.boards,{0:['4s','Td','2h'],1:['Jh','Ts','6s']});
 assert.equal(flops[0]!.frame.boards[1],undefined);
 assert.equal(bomb.events.at(-1)!.frame.pot,0n);
 assert.equal(bomb.events.at(-1)!.frame.players.find(p=>p.name==='Hero')!.folded,true);
});

test('source store loads the selected hand from its original file and rejects unknown IDs',async()=>{
 const {HistoryStore}=await import('../src/review/store.ts');
 const text='\uFEFF'+fs.readFileSync('tests/fixtures/900000011.txt','utf8').trimEnd()+'\r\n'+fs.readFileSync('tests/fixtures/900000005.txt','utf8');
 const file=new File([text],'split.txt'),store=new HistoryStore();
 async function* chunks(){yield new Uint8Array(await file.arrayBuffer());}
 for await(const raw of scanHands(scanLines(chunks()))){const p=processHand(raw,{equity:false});store.add(p.hand.handId,file,raw);}
 const hands=await store.load(['900000005','900000011','900000005']);
 assert.deepEqual(hands.map(h=>h.id),['900000005','900000011']);
 assert.ok(hands[0]!.raw.includes('#900000005'));assert.equal(hands[0]!.raw.includes('#900000011'),false);
 await assert.rejects(store.load(['not-loaded']),/unavailable/);
});

test('boards and shown cards recorded only in the summary appear at the summary',async()=>{
 const {buildReview}=await import('../src/review/model.ts');
 const p=await fixture('900000011');
 const lines=p.hand.raw.lines.filter(line=>!/^\*\*\* (FLOP|TURN|RIVER)/.test(line.raw)&&!/: shows \[/.test(line.raw));
 const review=buildReview(processHand({lines,startLine:1,endLine:lines.at(-1)!.line},{equity:false}));
 assert.equal(review.events.find(e=>e.street==='preflop')!.frame.players.find(p=>p.name==='Player47')!.cards,null);
 const board=review.events.find(e=>e.kind==='board');assert.ok(board);assert.equal(board.street,'summary');
 assert.equal(review.events.at(-1)!.frame.boards[0]!.length,5);
 assert.deepEqual(review.events.at(-1)!.frame.players.find(p=>p.name==='Player47')!.cards,['Qs','Qd']);
});

test('conflicting later shows cannot rewrite an earlier card reveal',async()=>{
 const {buildReview}=await import('../src/review/model.ts');
 const text=fs.readFileSync('tests/fixtures/900000011.txt','utf8').replace('Player47: shows [Qs Qd] (One Pair)','Player47: shows [Qs Qd] (One Pair)\nPlayer47: shows [Jc Jd] (One Pair)');
 const lines=text.split(/\r?\n/).map((raw,i)=>({raw,line:i+1})),review=buildReview(processHand({lines,startLine:1,endLine:lines.length},{equity:false}));
 const reveals=review.events.filter(e=>e.code==='Show'&&e.player==='Player47');
 assert.deepEqual(reveals[0]!.frame.players.find(p=>p.name==='Player47')!.cards,['Qs','Qd']);
 assert.deepEqual(reveals[1]!.frame.players.find(p=>p.name==='Player47')!.cards,['Jc','Jd']);
 assert.ok(review.issues.includes('CONFLICTING_HOLE_CARDS'));
});

test('formatted history groups streets with the opening pot, active players and Hero actions',async()=>{
 const {buildReview}=await import('../src/review/model.ts');
 const {historyStreets,showdownResults}=await import('../src/review/history.ts');
 const review=buildReview(await fixture('900000011')),streets=historyStreets(review);
 assert.deepEqual(streets.map(street=>street.street),['preflop','flop','turn','river']);
 assert.equal(streets[0]!.pot,246n);assert.equal(streets[0]!.players,6);
 assert.ok(streets[0]!.events.some(event=>event.player==='Hero'&&event.code==='R'&&event.amount===1000n));
 assert.deepEqual(streets[1]!.boards,{0:['Th','2h','Jc']});
 const results=showdownResults(review),hero=results.find(result=>result.player.name==='Hero')!,winner=results.find(result=>result.player.name==='Player47')!;
 assert.equal(hero.player.net,-10000n);assert.equal(winner.player.net,9914n);
 assert.deepEqual(hero.cards,['Ah','Ks']);assert.deepEqual(winner.cards,['Qs','Qd']);
 assert.deepEqual(winner.combinations,['One pair']);
});

test('formatted history preserves multiple boards, returned bets and unrevealed opponents',async()=>{
 const {buildReview}=await import('../src/review/model.ts');
 const {historyStreets,showdownResults}=await import('../src/review/history.ts');
 const review=buildReview(await fixture('900000022'));
 assert.ok(historyStreets(review).flatMap(street=>street.events).some(event=>event.code==='Return'&&event.amount===6215n));
 assert.equal(showdownResults(review).some(result=>result.player.name==='Player105'),false);
 const bomb=historyStreets(buildReview(await fixture('900000013')));
 assert.deepEqual(bomb.find(street=>street.street==='flop')!.boards,{0:['4s','Td','2h'],1:['Jh','Ts','6s']});
});
