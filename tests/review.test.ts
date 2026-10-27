import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scanLines,scanHands} from '../src/parser/scanner.ts';
import {processHand} from '../src/import/core.ts';
import {fact,query,defaults} from '../src/ui/data.ts';
import type {Database} from '../src/ui/data.ts';

async function fixture(id:string){const lines=fs.readFileSync(`tests/fixtures/${id}.txt`,'utf8').trimEnd().split(/\r?\n/).map((raw,i)=>({raw,line:i+1}));return processHand({lines,startLine:1,endLine:lines.length},{equity:false});}
const database={} as Database;

test('losing pots are filtered and ranked independently by currency and exact BB ratios',async()=>{
 const p=await fixture('900000011'),a=fact(p),b=fact(await fixture('900000005'));
 a.hand.totalPot=10000n;a.hand.bigBlind=100n;b.hand.totalPot=9000n;b.hand.bigBlind=50n;
 const result=query([a,b],[],defaults,database,true);
 assert.deepEqual(result.losingHands.currency.map(h=>h.id),['900000011','900000005']);
 assert.deepEqual(result.losingHands.bb.map(h=>h.id),['900000005','900000011']);
 assert.equal(query([a,b],[],{...defaults,limits:['50']},database,true).losingHands.currency.length,1);
 b.hero.netWon.value=0n;assert.equal(query([a,b],[],defaults,database,true).losingHands.currency.length,1);
 a.hero.netWon.value=null;assert.equal(query([a,b],[],defaults,database,true).losingHands.currency.length,0);
});

test('top ten membership changes with BB ranking and uses exact large integer comparisons',async()=>{
 const base=fact(await fixture('900000011'));
 const facts=Array.from({length:12},(_,i)=>({...base,hand:{...base.hand,handId:String(i+1),totalPot:10000000000000000n+BigInt(i),bigBlind:i===0?1n:100n}}));
 const result=query(facts,[],defaults,database,true);
 assert.equal(result.losingHands.currency.length,10);assert.equal(result.losingHands.currency[0]!.id,'12');
 assert.equal(result.losingHands.currency.some(h=>h.id==='1'),false);
 assert.equal(result.losingHands.bb[0]!.id,'1');
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
