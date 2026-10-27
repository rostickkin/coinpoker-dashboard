import {test,expect} from '@playwright/test';
import fs from 'node:fs';

function foldHand(id:number,bb:number,raise:number){
 const chip=(n:number)=>'₮'+(n*bb).toFixed(2),villain='NorthStar';
 return `CoinPoker Hand #${id}: NLH (${chip(.5)}/${chip(1)}) 2026/10/24 20:00:00 MSK
Table 'Review' 2-max Seat #1 is the button
Seat 1: Hero (${chip(100)} in chips)
Seat 2: ${villain} (${chip(100)} in chips)
Hero: posts small blind ${chip(.5)}
${villain}: posts big blind ${chip(1)}
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
Dealt to ${villain}
Hero: raises ${chip(raise-1)} to ${chip(raise)}
${villain}: raises ${chip(raise*2)} to ${chip(raise*3)}
Hero: folds
${villain}: RETURN ${chip(raise*2)}
${villain} collected ${chip(raise*2)} from pot
*** SUMMARY ***
Total pot ${chip(raise*2)} | Rake ₮0
Hand was run once
Game ended: 2026/10/24 20:01:00 MSK
Seat 1: Hero folded before Flop (didn't bet)
Seat 2: ${villain} won (${chip(raise*2)})
`;
}
test('losing hands rank independently, follow filters and open both safe accessible review modals',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const sample=[foldHand(910000201,50,3),foldHand(910000202,1,30),...Array.from({length:10},(_,i)=>foldHand(910000300+i,2,4+i)),fs.readFileSync('tests/fixtures/900000022.txt','utf8')].join('\r\n');
 await page.goto('/');
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'review.txt',mimeType:'text/plain',buffer:Buffer.from('\uFEFF'+sample)});
 await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0,{timeout:90000});
 const section=page.getByRole('region',{name:'Top 10 losing hands'}),rows=section.locator('tbody tr');
 await expect(rows).toHaveCount(10);await expect(rows.first()).toContainText('910000201');
 await expect(section.getByRole('button',{name:'Replay hand 910000201',exact:true})).toBeEnabled();
 await section.screenshot({path:'test-results/losing-hands-table.png'});
 await section.getByRole('button',{name:'Sort pots by BB',exact:true}).click();
 await expect(rows.first()).toContainText('910000202');await expect(rows.first()).toContainText('₮60.00');
 await page.getByRole('button',{name:'BB',exact:true}).click();await expect(rows.first()).toContainText('60.00 BB');
 await section.getByRole('button',{name:'Sort pots by ₮',exact:true}).click();await expect(rows.first()).toContainText('910000201');
 await page.getByLabel('Limit',{exact:true}).selectOption('200');await expect(rows).toHaveCount(10);await expect(rows.first()).not.toContainText('910000201');
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await section.getByRole('button',{name:'Replay hand 900000022',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Hand replayer'});
 await expect(dialog).toBeVisible();await expect(dialog.locator('.replay-board .playing-card')).toHaveCount(0);
 await dialog.getByRole('button',{name:'Flop',exact:true}).click();await expect(dialog.locator('.replay-board .playing-card')).toHaveCount(3);
 await expect(dialog.locator('.replay-seat').filter({hasText:'Player104'}).locator('.playing-card')).toHaveCount(0);
 await dialog.getByRole('button',{name:'Next action',exact:true}).click();await expect(dialog.locator('.replay-current')).toContainText('bets');
 await dialog.screenshot({path:'test-results/hand-replayer.png'});
 await dialog.getByRole('button',{name:'Showdown',exact:true}).click();
 await dialog.getByRole('button',{name:'Text history',exact:true}).click();
 const text=page.getByRole('dialog',{name:'Hand history'});await expect(text).toBeVisible();
 await text.screenshot({path:'test-results/hand-text-history.png'});
 await text.getByRole('button',{name:'Original text',exact:true}).click();await expect(text.locator('pre')).toContainText('Hero: folds');
 await page.keyboard.press('Escape');await expect(text).toHaveCount(0);
 await expect(section.getByRole('button',{name:'Replay hand 900000022',exact:true})).toBeFocused();
 await section.getByRole('button',{name:'Text history for hand 900000022',exact:true}).click();await expect(text).toBeVisible();
 await text.getByRole('button',{name:'Close window',exact:true}).click();
 await page.setViewportSize({width:390,height:900});
 await section.getByRole('button',{name:'Replay hand 900000022',exact:true}).click();await expect(dialog).toBeVisible();
 await dialog.screenshot({path:'test-results/hand-replayer-mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await dialog.getByRole('button',{name:'Close window',exact:true}).click();
 const unsafe=foldHand(910000999,1,3).replaceAll('NorthStar','<img src=x onerror=alert(1)>');
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'unsafe.txt',mimeType:'text/plain',buffer:Buffer.from(unsafe)});
 await expect(rows).toHaveCount(1);await expect(rows).toContainText('910000999');
 await section.getByRole('button',{name:'Replay hand 910000999',exact:true}).click();
 await expect(dialog.locator('img')).toHaveCount(0);await expect(dialog).toContainText('<img src=x onerror=alert(1)>');
 await dialog.getByRole('button',{name:'Close window',exact:true}).click();
 const summaryOnly=fs.readFileSync('tests/fixtures/900000022.txt','utf8').replace(/^.*: shows \[.*\r?\n/gm,'');
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'summary-only.txt',mimeType:'text/plain',buffer:Buffer.from(summaryOnly)});
 await expect(rows).toContainText('900000022');
 await section.getByRole('button',{name:'Text history for hand 900000022',exact:true}).click();
 await expect(text.locator('.history-body')).toContainText('Player104 showed');
 expect(errors).toEqual([]);
});
