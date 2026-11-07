import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';

async function load(page:Page,ids=['900000022']){
 await page.goto('/');
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'replayer.txt',mimeType:'text/plain',buffer:Buffer.from(ids.map(id=>fs.readFileSync(`tests/fixtures/${id}.txt`,'utf8')).join('\n'))});
 const section=page.getByRole('region',{name:'Top 10 hands',exact:true});
 await expect(section.locator('tbody tr')).toHaveCount(ids.length,{timeout:90000});
 await expect(section.getByRole('button',{name:'Replay hand '+ids[0],exact:true})).toBeEnabled();
 return section;
}

async function checkTableClearance(page:Page){
 // Viewport changes are applied by ResizeObserver before the next paint.
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const collisions=await page.locator('.replay-table-stage').evaluate(stage=>{
  const overlaps=(a:DOMRect,b:DOMRect)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const cards=Array.from(stage.querySelectorAll('.replay-seat .review-cards')).map(node=>node.getBoundingClientRect());
  const seats=Array.from(stage.querySelectorAll('.replay-seat')).map(node=>node.getBoundingClientRect());
  const dealer=stage.querySelector('.dealer-marker')!.getBoundingClientRect();
  const center=Array.from(stage.querySelectorAll('.replay-pot-summary,.replay-board,.replay-brand')).map(node=>node.getBoundingClientRect());
  const wagers=Array.from(stage.querySelectorAll('.replay-wager>.replay-chip-stack,.replay-wager>strong')).map(node=>node.getBoundingClientRect());
  const describe=(rect:DOMRect)=>[rect.x,rect.y,rect.width,rect.height].map(value=>Math.round(value));
  const detail={width:stage.clientWidth,dealer:describe(dealer),dealerHits:[...cards,...seats,...center,...wagers].filter(region=>overlaps(dealer,region)).map(describe),wagerHits:wagers.flatMap(wager=>[...seats,...cards].filter(region=>overlaps(wager,region)).map(region=>({wager:describe(wager),region:describe(region)})))};
  return {dealer:[...cards,...seats,...center,...wagers].some(region=>overlaps(dealer,region)),wager:wagers.some(wager=>[...seats,...cards].some(region=>overlaps(wager,region))),center:wagers.some(wager=>center.some(region=>overlaps(wager,region))),detail};
 });
 expect(collisions,JSON.stringify(collisions.detail)).toMatchObject({dealer:false,wager:false,center:false});
}

test('replayer uses position labels, removes folded cards and converts every live amount',async({page})=>{
 const section=await load(page);
 await section.getByRole('button',{name:'Replay hand 900000022',exact:true}).click();
 const replay=page.getByRole('dialog',{name:'Hand replayer',exact:true});
 await expect(replay.locator('.replay-brand')).toHaveText('CoinPoker Dashboard');
 for(const position of ['SB','BB','EP','MP','CO','BU'])await expect(replay.locator('.replay-seat-name').filter({hasText:new RegExp('^'+(position==='SB'?'Hero':'Player')+' '+position+'$')})).toHaveCount(1);
 await expect(replay).not.toContainText('Player104');
 await expect(replay.getByRole('button',{name:/Hero Cards/})).toHaveCount(0);
 await replay.getByRole('button',{name:'Show replay in BB',exact:true}).click();
 await replay.getByRole('button',{name:'Flop',exact:true}).click();
 await expect(replay.locator('.seat-folded .review-cards')).toHaveCount(0);
 await expect(replay.locator('.replay-board .playing-card')).toHaveCount(3);
 await replay.getByRole('button',{name:'Next action',exact:true}).click();
 await expect(replay.locator('.replay-wager')).toContainText('9.36 BB');
 await expect(replay.locator('.replay-current')).toHaveText('Player BB bets 9.36 BB');
 await replay.getByRole('button',{name:'Show replay in ₮',exact:true}).click();
 await expect(replay.locator('.replay-wager')).toContainText('₮18.72');
 await expect(replay.locator('.replay-current')).toHaveText('Player BB bets ₮18.72');
 await expect(replay.locator('.replay-pot')).toContainText('₮');
 await expect(replay.locator('.seat-stack').first()).toContainText('₮');
 const dealer=await replay.locator('.dealer-marker').boundingBox(),felt=await replay.locator('.replay-felt').boundingBox();
 expect(dealer).not.toBeNull();expect(felt).not.toBeNull();
 for(const x of [dealer!.x,dealer!.x+dealer!.width])for(const y of [dealer!.y,dealer!.y+dealer!.height])expect(((x-felt!.x-felt!.width/2)/(felt!.width/2-16))**2+((y-felt!.y-felt!.height/2)/(felt!.height/2-16))**2).toBeLessThan(1);
 const units=await replay.getByRole('group',{name:'Replay units'}).boundingBox(),text=await replay.getByRole('button',{name:'Text history',exact:true}).boundingBox();
 expect(units!.x+units!.width).toBeLessThan(text!.x);
 await checkTableClearance(page);
 await replay.screenshot({path:'test-results/replayer-design-desktop.png'});
 await page.setViewportSize({width:390,height:900});
 await replay.screenshot({path:'test-results/replayer-design-mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await replay.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
 await checkTableClearance(page);
 await expect(replay.locator('.replay-action-log [aria-current=step]')).toBeInViewport();
 await replay.getByRole('button',{name:'Next action',exact:true}).click();
 await expect(replay.locator('.replay-wager')).toHaveCount(2);
 await checkTableClearance(page);
});

test('hand buttons follow the displayed ranking and Text opens an independent window',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const section=await load(page,['900000022','900000020']);
 const buttons=section.getByRole('button',{name:/^Replay hand /});
 const first=(await buttons.nth(0).getAttribute('aria-label'))!.replace('Replay hand ',''),second=(await buttons.nth(1).getAttribute('aria-label'))!.replace('Replay hand ','');
 await buttons.nth(0).click();
 const replay=page.getByRole('dialog',{name:'Hand replayer',exact:true});
 await expect(replay.getByRole('button',{name:'Previous hand',exact:true})).toBeDisabled();
 const handPath=await replay.getByRole('button',{name:'Next hand',exact:true}).locator('path').getAttribute('d');
 expect(handPath).not.toEqual(await replay.getByRole('button',{name:'Next action',exact:true}).locator('path').getAttribute('d'));
 await replay.getByRole('button',{name:'Show replay in BB',exact:true}).click();
 await replay.getByRole('button',{name:'Next hand',exact:true}).click();
 await expect(replay).toContainText('Hand #'+second);
 await expect(replay.getByRole('button',{name:'Next hand',exact:true})).toBeDisabled();
 await expect(replay.getByRole('button',{name:'Show replay in BB',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(replay.getByRole('slider',{name:'Replay action'})).toHaveValue('0');
 await replay.getByRole('button',{name:'Previous hand',exact:true}).click();
 await expect(replay).toContainText('Hand #'+first);
 await replay.getByRole('button',{name:'Flop',exact:true}).click();
 const before=await replay.getByRole('slider',{name:'Replay action'}).inputValue();
 const popupEvent=page.waitForEvent('popup');
 await replay.getByRole('button',{name:'Text history',exact:true}).click();
 const popup=await popupEvent;popup.on('pageerror',error=>errors.push(error.message));
 const history=popup.getByRole('dialog',{name:'Hand history',exact:true});
 await expect(history).toBeVisible();await expect(history).toContainText('Hand #'+first);
 await expect(replay).toBeVisible();
 await expect(replay.getByRole('slider',{name:'Replay action'})).toHaveValue(before);
 await history.getByRole('button',{name:'Original text',exact:true}).click();
 await expect(history.locator('pre')).toContainText('CoinPoker Hand #'+first);
 await history.getByRole('button',{name:'Formatted',exact:true}).click();
 await history.getByRole('button',{name:'Show hand history in BB',exact:true}).click();
 const downloadEvent=popup.waitForEvent('download');
 await history.getByRole('button',{name:'Save hand history screenshot',exact:true}).click();
 expect((await downloadEvent).suggestedFilename()).toBe('coinpoker-hand-'+first+'-bb.png');
 await history.screenshot({path:'test-results/replayer-text-window.png'});
 await replay.getByRole('button',{name:'Next hand',exact:true}).click();
 await expect(replay).toContainText('Hand #'+second);
 await expect(history).toBeVisible();await expect(history).toContainText('Hand #'+first);
 await replay.getByRole('button',{name:'Previous hand',exact:true}).click();
 await replay.getByRole('button',{name:'Flop',exact:true}).click();
 await history.getByRole('button',{name:'Close window',exact:true}).click();
 await expect.poll(()=>popup.isClosed()).toBe(true);
 await expect(replay).toBeVisible();
 await expect(replay.getByRole('slider',{name:'Replay action'})).toHaveValue(before);
 await replay.getByRole('button',{name:'Previous action',exact:true}).click();
 await expect(replay.getByRole('slider',{name:'Replay action'})).toHaveValue(String(Number(before)-1));
 await replay.getByRole('button',{name:'Close window',exact:true}).click();
 expect(errors).toEqual([]);
});

test('blocked Text popup leaves the replay usable with a retry message',async({page})=>{
 const section=await load(page);
 await section.getByRole('button',{name:'Replay hand 900000022',exact:true}).click();
 await page.evaluate(()=>{window.open=()=>null;});
 const replay=page.getByRole('dialog',{name:'Hand replayer',exact:true});
 await replay.getByRole('button',{name:'Text history',exact:true}).click();
 await expect(replay.getByRole('alert')).toContainText('Allow pop-ups');
 await replay.getByRole('button',{name:'Next action',exact:true}).click();
 await expect(replay.getByRole('slider',{name:'Replay action'})).toHaveValue('1');
});

test('ten-player seats stay inside the table stage and playback restores folded cards',async({page})=>{
 const names=Array.from({length:10},(_,i)=>i===0?'Hero':'SeatPlayer'+(i+1));
 const source=`CoinPoker Hand #930001010: NLH (₮0.50/₮1) 2026/11/07 12:00:00 MSK
Table 'Dense' 10-max Seat #10 is the button
${names.map((name,i)=>`Seat ${i+1}: ${name} (₮100 in chips)`).join('\n')}
Hero: posts small blind ₮0.50
SeatPlayer2: posts big blind ₮1
*** HOLE CARDS ***
Dealt to Hero [As Kd]
${names.slice(1).map(name=>'Dealt to '+name).join('\n')}
${names.slice(2).map(name=>name+': folds').join('\n')}
Hero: folds
SeatPlayer2: RETURN ₮0.50
SeatPlayer2 collected ₮1 from pot
*** SUMMARY ***
Total pot ₮1 | Rake ₮0
Hand was run once
Game ended: 2026/11/07 12:01:00 MSK
Seat 1: Hero folded before Flop (didn't bet)
Seat 2: SeatPlayer2 won (₮1)
`;
 await page.goto('/');
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'dense.txt',mimeType:'text/plain',buffer:Buffer.from(source)});
 await page.getByRole('button',{name:'Replay hand 930001010',exact:true}).click();
 const replay=page.getByRole('dialog',{name:'Hand replayer',exact:true});
 await expect(replay.locator('.replay-seat')).toHaveCount(10);
 await replay.getByRole('button',{name:'Next action',exact:true}).click();await replay.getByRole('button',{name:'Next action',exact:true}).click();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  expect(await replay.locator('.replay-table-stage').evaluate(stage=>{
   const bounds=stage.getBoundingClientRect();return Array.from(stage.querySelectorAll('.replay-seat,.replay-seat .review-cards')).every(node=>{const rect=node.getBoundingClientRect();return rect.left>=bounds.left&&rect.right<=bounds.right&&rect.top>=bounds.top&&rect.bottom<=bounds.bottom;});
  })).toBe(true);
  await replay.screenshot({path:`test-results/replayer-dense-${width}.png`});
  await checkTableClearance(page);
 }
 const hero=replay.locator('.seat-hero');
 await expect(hero.locator('.review-cards')).toHaveCount(1);
 await replay.getByRole('button',{name:'Play',exact:true}).click();
 await expect(hero.locator('.review-cards')).toHaveCount(0,{timeout:15000});
 await replay.getByRole('button',{name:'Pause',exact:true}).click();
 let remaining=10;
 while(await hero.locator('.review-cards').count()===0&&remaining-->0)await replay.getByRole('button',{name:'Previous action',exact:true}).click();
 await expect(hero.locator('.playing-card')).toHaveCount(2);
});

test('all recorded boards remain visible in triple-run hands',async({page})=>{
 // Unrevealed opponents avoid exhaustive preflop equity work unrelated to this layout check.
 const source=fs.readFileSync('tests/fixtures/900000014.txt','utf8').replaceAll('Player63: shows [Kd Ks] (Three Of A Kind)','Player63: mucks hand').replaceAll('Player63: shows [Kd Ks] (Two Pair)','Player63: mucks hand').replace(/Seat 3: Player63 showed \[Kd Ks\].*/,'Seat 3: Player63 didn\'t show');
 await page.goto('/');
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'triple-run.txt',mimeType:'text/plain',buffer:Buffer.from(source)});
 await page.getByRole('button',{name:'Replay hand 900000014',exact:true}).click();
 const replay=page.getByRole('dialog',{name:'Hand replayer',exact:true});
 await replay.getByRole('button',{name:'Showdown',exact:true}).click();
 await expect(replay.locator('.replay-board')).toHaveCount(3);
 await expect(replay.locator('.replay-board .playing-card')).toHaveCount(15);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  expect(await replay.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
  await checkTableClearance(page);
 }
});

test('larger Hero cards and classic opponent backs leave every wager readable',async({page})=>{
 const section=await load(page,['900000020']);
 await section.getByRole('button',{name:'Replay hand 900000020',exact:true}).click();
 const replay=page.getByRole('dialog',{name:'Hand replayer',exact:true}),hero=replay.locator('.seat-hero');
 await expect(hero.locator('.replay-seat-name')).toHaveText('Hero BB');
 for(let i=0;i<12;i++){
  if((await replay.locator('.replay-current').innerText()).includes('posts big blind'))break;
  await replay.getByRole('button',{name:'Next action',exact:true}).click();
 }
 await expect(replay.locator('.replay-current')).toContainText('Hero BB posts big blind');
 await expect(hero.locator('.playing-card')).toHaveCount(2);
 const backs=replay.locator('.replay-seat:not(.seat-hero) .playing-card-back');
 await expect(backs).toHaveCount(10);
 expect((await backs.allTextContents()).every(text=>text==='')).toBe(true);
 for(const width of [1440,900,390]){
  await page.setViewportSize({width,height:1000});
  expect((await hero.locator('.playing-card').first().boundingBox())!.height).toBeGreaterThanOrEqual(width>1100?60:width>500?50:42);
  await checkTableClearance(page);
  await replay.screenshot({path:`test-results/replayer-large-cards-${width}.png`});
 }
});

test('ordinary Pot and recorded Splash drop are separate and follow playback and units',async({page})=>{
 for(const mega of [false,true]){
  const source=fs.readFileSync('tests/fixtures/900000016.txt','utf8').replace('SPLASH dropped ₮12',(mega?'MEGA SPLASH':'SPLASH')+' dropped ₮40').replace('Total pot ₮186.92','Total pot ₮214.92').replaceAll('₮168.72','₮196.72');
  await page.goto('/');
  await page.getByLabel('Select CoinPoker file').setInputFiles({name:'splash.txt',mimeType:'text/plain',buffer:Buffer.from(source)});
  await page.getByRole('button',{name:'Replay hand 900000016',exact:true}).click();
  const replay=page.getByRole('dialog',{name:'Hand replayer',exact:true}),drop=replay.locator('.replay-splash');
  await replay.getByRole('button',{name:'Show replay in ₮',exact:true}).click();
  await expect(drop).toHaveCount(0);
  await replay.getByRole('button',{name:'Next action',exact:true}).click();
  await expect(replay.locator('.replay-pot')).toHaveText('Pot ₮0.00');
  await expect(drop).toContainText((mega?'MEGA SPLASH':'SPLASH')+' dropped');
  await expect(drop).toContainText('₮40.00');
  for(let i=0;i<7;i++)await replay.getByRole('button',{name:'Next action',exact:true}).click();
  await expect(replay.locator('.replay-pot')).toHaveText('Pot ₮4.60');
  await expect(drop).toContainText('₮40.00');
  for(const width of [1440,900,390]){
   await page.setViewportSize({width,height:1000});
   if(!mega)await replay.screenshot({path:`test-results/replayer-splash-${width}.png`});
   await checkTableClearance(page);
  }
  await replay.getByRole('button',{name:'Show replay in BB',exact:true}).click();
  await expect(replay.locator('.replay-pot')).toHaveText('Pot 2.30 BB');
  await expect(drop).toContainText('20.00 BB');
  for(let i=0;i<8;i++)await replay.getByRole('button',{name:'Previous action',exact:true}).click();
  await expect(drop).toHaveCount(0);
  await expect(replay.locator('.replay-pot')).toHaveText('Pot 0.00 BB');
  await replay.getByRole('button',{name:'Showdown',exact:true}).click();
  await expect(replay.locator('.replay-pot')).toHaveText('Pot 87.46 BB');
  const next=replay.getByRole('button',{name:'Next action',exact:true});
  for(let i=0;i<20&&await next.isEnabled();i++)await next.click();
  await expect(replay.locator('.replay-pot')).toHaveText('Pot 0.00 BB');
  await expect(drop).toContainText('20.00 BB');
 }
});
