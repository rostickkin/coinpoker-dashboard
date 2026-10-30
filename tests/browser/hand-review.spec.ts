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
test('Top 10 hands ranks both ways, follows filters and opens safe accessible review modals',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const sample=[foldHand(910000201,50,3),foldHand(910000202,1,30),...Array.from({length:10},(_,i)=>foldHand(910000300+i,2,4+i)),fs.readFileSync('tests/fixtures/900000022.txt','utf8')].join('\r\n');
 await page.goto('/');
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'review.txt',mimeType:'text/plain',buffer:Buffer.from('\uFEFF'+sample)});
 await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0,{timeout:90000});
 const section=page.getByRole('region',{name:'Top 10 hands',exact:true}),rows=section.locator('tbody tr');
 await expect(rows).toHaveCount(10);await expect(rows.first()).toContainText('910000201');
 await section.getByRole('button',{name:'Reverse hand sort order'}).click();
 await expect(rows.first()).toContainText('900000022');
 await section.getByRole('button',{name:'Reverse hand sort order'}).click();
 await expect(rows.first()).toContainText('910000201');
 await expect(section.getByRole('button',{name:'Replay hand 910000201',exact:true})).toBeEnabled();
 await section.screenshot({path:'test-results/losing-hands-table.png'});
 await section.getByRole('button',{name:'Rank hands in BB',exact:true}).click();
 await expect(rows.first()).toContainText('910000202');await expect(rows.first()).toContainText('₮60.00');
 await page.getByRole('button',{name:'BB',exact:true}).click();await expect(rows.first()).toContainText('60.00 BB');
 await section.getByRole('button',{name:'Rank hands in ₮',exact:true}).click();await expect(rows.first()).toContainText('910000201');
 await page.getByLabel('Limit',{exact:true}).selectOption('200');await expect(rows).toHaveCount(10);await expect(rows.first()).not.toContainText('910000201');
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await expect(section.getByRole('button',{name:'Replay hand 900000022',exact:true})).toHaveCount(0);
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'replay.txt',mimeType:'text/plain',buffer:Buffer.from(fs.readFileSync('tests/fixtures/900000022.txt','utf8'))});
 await expect(rows).toHaveCount(1);
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
 await expect(text.getByRole('region',{name:'Hand results'})).toContainText('Player104');
 await expect(text.getByRole('region',{name:'Hand results'})).toContainText('Three of a kind');
 expect(errors).toEqual([]);
});

test('Net Won and Pot sort both ways and Splash-only filtering includes regular and Mega Splash',async({page})=>{
 const splash=fs.readFileSync('tests/fixtures/900000016.txt','utf8');
 const mega=splash.replaceAll('900000016','900000116').replace('SPLASH dropped','MEGA SPLASH dropped');
 const sample=[fs.readFileSync('tests/fixtures/900000015.txt','utf8'),foldHand(910001001,1,20),splash,mega].join('\r\n');
 await page.goto('/');
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'splash-review.txt',mimeType:'text/plain',buffer:Buffer.from(sample)});
 const section=page.getByRole('region',{name:'Top 10 hands',exact:true}),rows=section.locator('tbody tr');
 await expect(rows).toHaveCount(4,{timeout:90000});
 await expect(rows.locator('.hand-open')).toHaveText([
  /#900000116/,/#900000016/,/#910001001/,/#900000015/
 ]);
 await expect(section.getByRole('columnheader',{name:'Net Won'})).toHaveAttribute('aria-sort','ascending');
 await section.getByLabel('Rank hands by').selectOption('pot');
 await expect(rows.locator('.hand-open')).toHaveText([/#900000116/,/#900000016/,/#900000015/,/#910001001/]);
 await section.getByRole('button',{name:'Sort by Pot',exact:true}).click();
 await expect(rows.locator('.hand-open')).toHaveText([/#910001001/,/#900000015/,/#900000116/,/#900000016/]);
 for(const id of ['900000016','900000116']){
  const row=rows.filter({has:page.getByRole('button',{name:'Replay hand '+id,exact:true})});
  await expect(row.getByLabel('Splash hand',{exact:true})).toHaveText('S');
 }
 for(const id of ['900000015','910001001']){
  await expect(rows.filter({has:page.getByRole('button',{name:'Replay hand '+id,exact:true})}).getByLabel('Splash hand',{exact:true})).toHaveCount(0);
 }
 const globalHands=await page.getByTestId('card-hands').locator('strong').innerText();
 await section.getByRole('checkbox',{name:'Splash hands only'}).check();
 await expect(rows).toHaveCount(2);
 await expect(rows.locator('.hand-open')).toHaveText([/#900000116/,/#900000016/]);
 await expect(page.getByTestId('card-hands').locator('strong')).toHaveText(globalHands);
 await section.getByRole('checkbox',{name:'Splash hands only'}).uncheck();await expect(rows).toHaveCount(4);
 await section.getByRole('button',{name:'Sort by Net Won',exact:true}).click();
 await expect(rows.locator('.hand-open')).toHaveText([/#900000116/,/#900000016/,/#910001001/,/#900000015/]);
 await section.getByLabel('Rank hands by').selectOption('pot');
 await section.getByLabel('Rank hands by').selectOption('net');
 await expect(section.getByRole('columnheader',{name:'Net Won'})).toHaveAttribute('aria-sort','ascending');
 await expect(rows.first()).toContainText('900000116');
 await section.screenshot({path:'test-results/losing-hands-splash.png'});
});

test('winning hands open a visual street history with cards, results and responsive layouts',async({page})=>{
 await page.goto('/');
 const sample=['900000006','900000011','900000020'].map(id=>fs.readFileSync('tests/fixtures/'+id+'.txt','utf8')).join('\n');
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'wins-and-losses.txt',mimeType:'text/plain',buffer:Buffer.from(sample)});
 const section=page.getByRole('region',{name:'Top 10 hands',exact:true}),rows=section.locator('tbody tr');
 await expect(rows).toHaveCount(3,{timeout:90000});await expect(rows.first()).toContainText('900000011');
 await expect(rows.first().locator('.negative')).toBeVisible();
 await expect(rows.filter({hasText:'900000006'}).locator('.positive')).toBeVisible();
 const tableHeart=section.locator('.losing-hands-scroll .playing-card[aria-label="Kh"]');
 await expect(tableHeart).toBeVisible();
 const tableCardColor=await tableHeart.evaluate(node=>getComputedStyle(node).backgroundColor);
 expect((await section.locator('.playing-card').allTextContents()).join('')).not.toMatch(/[♠♥♦♣]/);
 await section.getByRole('button',{name:'Text history for hand 900000006',exact:true}).click();
 const history=page.getByRole('dialog',{name:'Hand history',exact:true});await expect(history).toBeVisible();
 await expect(history.locator('.history-street')).toHaveCount(4);
 await expect(history.locator('.history-roster-hero')).toContainText('Hero');
 await expect(history.locator('.history-street').first()).toContainText('Pot');
 await expect(history.locator('.history-action.is-hero')).not.toHaveCount(0);
 await expect(history.getByRole('region',{name:'Hand results'})).toContainText('Won');
 await history.getByRole('button',{name:'Close window',exact:true}).click();
 await section.getByRole('button',{name:'Text history for hand 900000020',exact:true}).click();
 await expect(history).toBeVisible();
 await expect(history.locator('.playing-card[aria-label="Kh"]').first()).toHaveCSS('background-color',tableCardColor);
 expect((await history.locator('.playing-card').allTextContents()).join('')).not.toMatch(/[♠♥♦♣]/);
 await page.setViewportSize({width:1440,height:1600});
 await history.screenshot({path:'test-results/hand-history-visual-desktop.png'});
 await page.setViewportSize({width:390,height:1800});
 await expect.poll(()=>history.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
 await history.screenshot({path:'test-results/hand-history-visual-mobile.png'});
 await history.getByRole('button',{name:'Original text',exact:true}).click();await expect(history.locator('pre')).toContainText('CoinPoker Hand #900000020');
 await history.getByRole('button',{name:'Formatted',exact:true}).click();
 await page.keyboard.press('Escape');await expect(history).toHaveCount(0);
 await expect(section.getByRole('button',{name:'Text history for hand 900000020',exact:true})).toBeFocused();
});

test('Hand History switches stakes between currency and BB independently of the dashboard',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Select CoinPoker file').setInputFiles('tests/fixtures/900000016.txt');
 const section=page.getByRole('region',{name:'Top 10 hands',exact:true});
 await section.getByRole('button',{name:'Text history for hand 900000016',exact:true}).click();
 const history=page.getByRole('dialog',{name:'Hand history',exact:true});
 const bb=history.getByRole('button',{name:'Show hand history in BB',exact:true}),currency=history.getByRole('button',{name:'Show hand history in ₮',exact:true});
 await expect(bb).toBeVisible();await expect(currency).toHaveAttribute('aria-pressed','true');
 await expect(history.locator('.history-action-line').first()).toContainText('Hero raises to ₮25.00');
 await expect(history.locator('.history-action-line').nth(1)).toContainText('Hero bets ₮58.95');
 await bb.click();await expect(bb).toHaveAttribute('aria-pressed','true');
 await expect(history.locator('.history-action-line').first()).toContainText('Hero raises to 12.50 BB');
 await expect(history.locator('.history-action-line').nth(1)).toContainText('Hero bets 29.48 BB');
 await expect(history.locator('.history-hero-result')).toContainText('−41.74 BB');
 await history.locator('.history-forced summary').click();
 await expect(history.locator('.history-forced')).toContainText('posts small blind 0.50 BB');
 await expect(history.locator('.history-forced')).toContainText('Splash dropped 6.00 BB');
 await expect(page.getByRole('button',{name:'₮',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(section.locator('.losing-hands-scroll .review-number.negative')).toContainText('−₮83.48');
 await currency.click();await expect(history.locator('.history-action-line').first()).toContainText('Hero raises to ₮25.00');
 await bb.click();await history.getByRole('button',{name:'Original text',exact:true}).click();
 await expect(bb).toBeDisabled();await expect(currency).toBeDisabled();
 await expect(history.locator('pre')).toContainText('Hero: bets ₮58.95');
 await history.getByRole('button',{name:'Formatted',exact:true}).click();
 await expect(bb).toBeEnabled();await expect(bb).toHaveAttribute('aria-pressed','true');
 await expect(history.locator('.history-action-line').first()).toContainText('Hero raises to 12.50 BB');
 await page.setViewportSize({width:390,height:1200});
 await expect.poll(()=>history.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
 await currency.click();await expect(history.locator('.history-action-line').first()).toContainText('Hero raises to ₮25.00');
});
