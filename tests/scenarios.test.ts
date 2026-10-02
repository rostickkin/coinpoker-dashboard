import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {importHands} from '../src/import/core.ts';
import {exactEquity} from '../src/equity/enumerator.ts';
import {rational,add} from '../src/core/value.ts';
async function parsed(s:string,equity=false){async function* bytes(){yield new TextEncoder().encode(s);}for await(const p of importHands(bytes(),{equity}))return p;throw Error('Empty');}
function preflop(actions:string,heroStack='100',opponentStack='100'):string {
 return `CoinPoker Hand #999: NLH (₮0.50/₮1) 2026/10/02 09:00:00 MSK
Table 'x' 6-max Seat #1 is the button
Seat 1: Hero (₮${heroStack} in chips)
Seat 2: A (₮${opponentStack} in chips)
Seat 3: B (₮100 in chips)
Seat 4: C (₮100 in chips)
Seat 5: D (₮100 in chips)
Seat 6: E (₮100 in chips)
A: posts small blind ₮0.50
B: posts big blind ₮1
*** HOLE CARDS ***
Dealt to Hero [Ah Ad]
Dealt to A
Dealt to B
Dealt to C
Dealt to D
Dealt to E
${actions}
*** SUMMARY ***
Total pot ₮0 | Rake ₮0
Hand was run once
Board [  ]
Game ended: 2026/10/02 09:01:00 MSK`;
}
for(const [name,actions,made,opportunity] of [
 ['open','C: folds\nD: folds\nE: folds\nHero: raises ₮2 to ₮3',false,false],
 ['isolation','C: calls ₮1\nD: folds\nE: folds\nHero: raises ₮3 to ₮4',false,false],
 ['squeeze','C: raises ₮2 to ₮3\nD: calls ₮3\nE: folds\nHero: raises ₮7 to ₮10',true,true],
 ['limp reraise','Hero: calls ₮1\nA: raises ₮3 to ₮4\nB: calls ₮3\nHero: raises ₮8 to ₮12',true,true],
 ['cold fourbet','C: raises ₮2 to ₮3\nD: raises ₮6 to ₮9\nHero: raises ₮12 to ₮21',false,false],
 ['fold opportunity','C: raises ₮2 to ₮3\nHero: folds',false,true]
] as [string,string,boolean,boolean][])test('3Bet '+name,async()=>{const p=await parsed(preflop(actions));assert.equal(p.hero.threeBetMade.value,made);assert.equal(p.hero.threeBetOpportunity.value,opportunity);});
test('short allin does not reopen previously acted Hero',async()=>{const p=await parsed(preflop('Hero: calls ₮1\nA: ALLIN ₮0.75\nHero: calls ₮0.25','100','1.25'));assert.equal(p.hero.threeBetOpportunity.value,false);assert.equal(p.ledger.actions.find(a=>a.raw.kind==='ALLIN')?.semantic,'shortRaise');});
test('call-only effective stack has no 3bet opportunity',async()=>{const p=await parsed(preflop('C: raises ₮2 to ₮3\nHero: calls ₮3','3'));assert.equal(p.hero.threeBetOpportunity.value,false);assert.equal(p.ledger.players.find(p=>p.name==='Hero')?.allIn,true);});
for(const n of [2,3,4,5,6])test('position ring '+n+' players',async()=>{let s=preflop('Hero: folds');const names=['Hero','A','B','C','D','E'];for(let i=n;i<6;i++)s=s.replace(new RegExp(`Seat ${i+1}: ${names[i]} .+\\n`),'').replace(`Dealt to ${names[i]}\n`,'');if(n===2)s=s.replace('A: posts small blind ₮0.50','Hero: posts small blind ₮0.50').replace('B: posts big blind ₮1','A: posts big blind ₮1');const p=await parsed(s);assert.equal(p.hero.position.value,n===2?'BTN_SB':'BTN');});
test('dead button unavailable',async()=>{const p=await parsed(preflop('Hero: folds').replace('Seat #1 is the button','Seat #7 is the button'));assert.equal(p.hero.position.value,null);});
test('malformed hand without seats survives and subsequent valid hand imports',async()=>{const broken='CoinPoker Hand #1: bad header\nHero: weird money ₮2\n';const p=await parsed(broken);assert.equal(p.hero.netWon.value,null);async function* bytes(){yield new TextEncoder().encode(broken+preflop('Hero: folds'));}const results=[];for await(const p of importHands(bytes(),{equity:false}))results.push(p);assert.equal(results.length,2);assert.equal(results[1]!.hand.handId,'999');});
test('side-pot EV with provable zero fees and exact actual awards',async()=>{const s=`CoinPoker Hand #998: NLH (₮1/₮2) 2026/10/02 09:00:00 MSK
Table 'x' 6-max Seat #1 is the button
Seat 1: A (₮50 in chips)
Seat 2: B (₮100 in chips)
Seat 3: Hero (₮100 in chips)
B: posts small blind ₮1
Hero: posts big blind ₮2
*** HOLE CARDS ***
Dealt to A
Dealt to B
Dealt to Hero [Ah Ad]
A: ALLIN ₮50
Hero: ALLIN ₮98
B: ALLIN ₮99
*** FLOP *** [2c 3d 4s]
*** TURN *** [2c 3d 4s] [5c]
*** RIVER *** [2c 3d 4s 5c] [7h]
*** SHOWDOWN ***
A: shows [Qs Qh] (One Pair)
B: shows [Ks Kh] (One Pair)
Hero: shows [Ah Ad] (Straight)
Hero collected ₮150 from pot
Hero collected ₮100 from pot
*** SUMMARY ***
Total pot ₮250 | Rake ₮0
Hand was run once
Board [ 2c 3d 4s 5c 7h ]
Game ended: 2026/10/02 09:01:00 MSK`;
 const p=await parsed(s,true);assert.equal(p.allInEV?.evCoverage,'fullyAdjusted');assert.equal(p.allInEV.pots.length,2);assert.equal(p.allInEV.pots[1]!.equities?.scenarioCount,1370754);assert.equal(p.hero.netWon.value,15000n);
 const q=await parsed(s.replace('Rake ₮0','Rake ₮1').replace('collected ₮150','collected ₮149'),true);assert.equal(q.allInEV?.evCoverage,'actualFallbackOnly');assert(q.allInEV?.pots.every(p=>p.reasonCodes.includes('FEE_ALLOCATION_UNKNOWN')));
});
test('earlier flop pot never shifts equity to turn in continued multiway betting',async()=>{
 let s=preflop('C: folds\nD: folds\nE: folds\nHero: raises ₮1 to ₮2\nA: calls ₮1.50\nB: calls ₮1');s=s.slice(0,s.indexOf('*** SUMMARY ***'))+`*** FLOP *** [2c 3d 4s]
A: ALLIN ₮98
Hero: calls ₮98
B: calls ₮98
*** TURN *** [2c 3d 4s] [5c]
Hero: checks
B: folds
*** RIVER *** [2c 3d 4s 5c] [7h]
*** SHOWDOWN ***
A: shows [Ks Kh] (One Pair)
Hero: shows [Ah Ad] (Straight)
Hero collected ₮300 from pot
*** SUMMARY ***
Total pot ₮300 | Rake ₮0
Hand was run once
Board [ 2c 3d 4s 5c 7h ]
Game ended: 2026/10/02 09:01:00 MSK`;
 // Deep Hero/B stacks preserve the future fold decision after matching A's flop all-in.
 s=s.replace('Hero (₮100 in chips)','Hero (₮200 in chips)').replace('B (₮100 in chips)','B (₮200 in chips)');
 const p=await parsed(s,true);assert.equal(p.allInEV?.evCoverage,'actualFallbackOnly');assert(p.allInEV.pots[0]!.reasonCodes.includes('MULTIWAY_FUTURE_ACTION_AMBIGUITY'));assert.equal(p.allInEV.pots[0]!.snapshot!.board.length,3);assert.deepEqual(p.allInEV.adjustedResult.value,rational(p.hero.netWon.value!));
});
test('unknown live cards actual fallback',async()=>{
 const s=fs.readFileSync('tests/fixtures/900000011.txt','utf8').replace(/\w+: shows \[Qs Qd\] \(One Pair\)/,'opponent: mucks hand');
 // Build from the real hand while hiding the opponent's reveal and summary cards.
 const original=fs.readFileSync('tests/fixtures/900000011.txt','utf8');const hidden=original.replace(/: shows \[Qs Qd\] \([^\n]+\)/,': mucks hand').replace(/showed \[Qs Qd\] and won \((₮[\d.]+)\) with [^\n]+/,'won ($1)');
 const p=await parsed(hidden,true);assert.equal(p.allInEV?.evCoverage,'actualFallbackOnly');assert(p.allInEV.pots.some(p=>p.reasonCodes.includes('UNKNOWN_OPPONENT_HOLE_CARDS')));assert.deepEqual(p.allInEV.adjustedResult.value,rational(-10000n));assert(s.length>0);
});
test('river allin has zero adjustment and deterministic actual fallback',async()=>{let s=fs.readFileSync('tests/fixtures/900000011.txt','utf8').replaceAll('\r','');s=s.replace('Hero: ALLIN ₮89.84\nPlayer47: calls ₮67.84','Hero: calls ₮22');s=s.replace('*** SHOWDOWN ***','Hero: ALLIN ₮67.84\nPlayer47: calls ₮67.84\n*** SHOWDOWN ***');const p=await parsed(s,true);assert.equal(p.allInEV?.evCoverage,'fullyAdjusted');assert.deepEqual(p.allInEV.availableAdjustment,rational(0n));assert.equal(p.allInEV.pots[0]!.snapshot?.board.length,5);assert.deepEqual(p.allInEV.adjustedResult.value,rational(-10000n));});
test('RIT2 exact tracker expectation equals one-run expectation',async()=>{const original=fs.readFileSync('tests/fixtures/900000011.txt','utf8').replaceAll('\r','');const once=await parsed(original,true);let s=original.replace(/\*\*\* (FLOP|TURN|RIVER|SHOWDOWN) \*\*\*/g,'*** FIRST $1 ***').replace('Hand was run once','Hand was run two times').replace('collected ₮199.14','collected ₮99.57');s=s.replace('*** FIRST SHOWDOWN ***',`*** SECOND FLOP *** [Ac 8c 7c]
*** SECOND TURN *** [Ac 8c 7c] [9c]
*** SECOND RIVER *** [Ac 8c 7c 9c] [Td]
*** FIRST SHOWDOWN ***`);s=s.replace('*** SUMMARY ***',`*** SECOND SHOWDOWN ***
Hero: shows [Ah Ks] (One Pair)
Hero collected ₮99.57 from pot
Player47: shows [Qs Qd] (One Pair)
*** SUMMARY ***`);s=s.replace('Board [ Th 2h Jc 3h 4d ]','FIRST Board [ Th 2h Jc 3h 4d ]\nSECOND Board [ Ac 8c 7c 9c Td ]');const p=await parsed(s,true);assert.equal(p.hand.runCount,2);assert.equal(p.ledger.payoutResidual,0n);assert.equal(p.allInEV?.evCoverage,'fullyAdjusted');assert.deepEqual(p.allInEV.adjustedResult.value,once.allInEV?.adjustedResult.value);assert.equal(p.allInEV.pots[0]!.equities?.scenarioCount,1712304);});
test('real RIT3 adjusts one fixed total while preserving written odd-chip awards',async()=>{const s=fs.readFileSync('tests/fixtures/900000014.txt','utf8');const p=await parsed(s,true);assert.equal(p.allInEV?.evCoverage,'fullyAdjusted');assert.equal(p.hand.runCount,3);assert.equal(p.allInEV.pots[0]!.snapshot!.board.length,0);const awards=p.hand.actions.filter(a=>a.kind==='collected').map(a=>a.amount);assert.deepEqual(awards,[6656n,6654n,6654n]);assert.equal(p.ledger.payoutResidual,0n);});
test('equity distinct main/side eligible sets and blockers',()=>{const main=exactEquity([['Ah','Ad'],['Ks','Kh'],['Qs','Qh']],['2c','3d','4s']);const side=exactEquity([['Ah','Ad'],['Ks','Kh']],['2c','3d','4s'],['Qs','Qh']);assert.equal(side.scenarioCount,903);assert.deepEqual(main.shares.reduce(add,rational(0n)),rational(1n));assert.deepEqual(side.shares.reduce(add,rational(0n)),rational(1n));});
