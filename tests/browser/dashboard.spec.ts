import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type {Result} from '../../src/ui/data.ts';
declare global {interface Window {latestResult:Result}}
const fixture=Buffer.concat(['900000001','900000004','900000016','900000017','900000008','900000013','900000015','900000010'].map(f=>Buffer.concat([fs.readFileSync('tests/fixtures/'+f+'.txt'),Buffer.from('\n')])));
test.beforeEach(async({page})=>{await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends Native {constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.addEventListener('message',e=>{if(e.data.type==='result')window.latestResult=e.data.payload.result;});}};});});
test('same source update, invalid persisted selections, conflicts, other filters and drag/drop',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('coinpoker.ui.v1',JSON.stringify({unit:'₮',lines:[true,true,true,true],tab:'Overview',orders:{Days:[],Months:[],Limits:[],Positions:[]},filters:{period:'All Time',from:'',to:'',month:'',limits:['9999'],positions:['missing'],tables:['missing'],players:'9',game:'',splash:''}})));await page.reload();
 async function load(name:string,buffer:Buffer){const prior=await page.evaluate(()=>window.latestResult?.database.importedAt);await page.getByLabel('Select CoinPoker file').setInputFiles({name,mimeType:'text/plain',buffer});await expect.poll(()=>page.evaluate(()=>window.latestResult?.database.importedAt),{timeout:90000}).not.toBe(prior);await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0,{timeout:90000});await expect(page.getByTestId('card-hands')).toBeVisible();}
 await load('same.txt',fixture);await expect.poll(()=>page.evaluate(()=>window.latestResult.summary.hands)).toBe(8);expect(await page.getByLabel('Limit',{exact:true}).evaluate((s:HTMLSelectElement)=>s.selectedOptions.length)).toBe(0);const net=await page.getByTestId('card-net').innerText();await load('same.txt',fixture);expect(await page.getByTestId('card-net').innerText()).toBe(net);await page.locator('.diagnostics summary').click();await expect(page.getByText('Duplicates: 0 · Conflicts: 0')).toBeVisible();
 await load('conflicts.txt',Buffer.concat([fixture,Buffer.from('\n'),Buffer.from(fixture.toString().replace('Game ended:','\nGame ended:'))]));await expect(page.getByText('Duplicates: 7 · Conflicts: 1')).toBeVisible();
 await page.getByLabel('Game Type').selectOption('BombPot');await expect(page.getByTestId('card-vpip')).toContainText('—');await page.getByRole('button',{name:'Clear filters'}).click();await page.getByLabel('Players',{exact:true}).selectOption({index:1});await expect.poll(()=>page.evaluate(()=>window.latestResult.summary.hands)).toBeLessThan(8);await page.getByRole('button',{name:'Clear filters'}).click();await page.getByLabel('Splash',{exact:true}).selectOption('any');await expect.poll(()=>page.evaluate(()=>window.latestResult.summary.splashEvents)).toBeGreaterThan(0);await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.getByText('Tables',{exact:true})).toHaveCount(0);await page.getByLabel('Ante',{exact:true}).selectOption({label:'0.16 bb'});await expect.poll(()=>page.evaluate(()=>window.latestResult.summary.hands)).toBeLessThan(8);
 const sameUniverse=await page.evaluate(()=>{const r=window.latestResult;return Object.values(r.rows).every(rows=>rows.reduce((n,v)=>n+v.summary.hands,0)===r.summary.hands&&rows.reduce((n,v)=>n+v.summary.net,0n)===r.summary.net)&&(!r.points.length||Math.abs(r.points.at(-1)!.currency[0]!-Number(r.summary.net)/100)<1e-8);});expect(sameUniverse).toBe(true);
 await page.getByRole('button',{name:'Clear filters'}).click();await page.evaluate(text=>{const dt=new DataTransfer();dt.items.add(new File([text],'dropped.txt',{type:'text/plain'}));document.querySelector('main')!.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));},fixture.toString());await expect(page.getByText('dropped.txt',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0,{timeout:90000});
});
test('local import, filters, units, tables, preferences, diagnostics and recovery',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.getByText('Your files stay on this device.')).toBeVisible();
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'fixtures.txt',mimeType:'text/plain',buffer:fixture});await expect(page.getByTestId('card-hands')).toBeVisible({timeout:30000});await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0,{timeout:90000});const initial=await page.getByTestId('card-hands').innerText();
 await expect(page.getByTestId('card-splash')).toHaveCount(0);await page.getByRole('button',{name:'BB',exact:true}).click();await expect(page.getByTestId('card-net')).toContainText('bb');await page.getByRole('button',{name:'Non-Showdown',exact:true}).click();await expect(page.getByRole('button',{name:'Non-Showdown',exact:true})).toHaveAttribute('aria-pressed','false');await page.getByRole('button',{name:'Reset zoom'}).click();
 await page.getByLabel('Limit',{exact:true}).selectOption({index:0});await expect(page.getByTestId('card-hands')).not.toHaveText(initial);await page.getByRole('button',{name:'Clear filters'}).click();await page.getByLabel('Position',{exact:true}).selectOption({index:0});await expect(page.getByTestId('card-hands')).not.toHaveText(initial);await page.getByRole('button',{name:'Clear filters'}).click();
 await page.getByLabel('Period',{exact:true}).selectOption('Custom Range');await page.getByLabel('From date').fill('2026-01-01');await page.getByLabel('To date').fill('2026-12-31');await page.getByRole('button',{name:'Clear filters'}).click();
 for(const tab of ['Days','Months','Limits','Positions']){await page.getByRole('button',{name:tab,exact:true}).click();await expect(page.locator('tfoot')).toContainText('TOTAL');await expect(page.getByRole('button',{name:'Sort EV Net Won',exact:true})).toBeAttached();await expect(page.locator('tfoot td').nth(6)).toHaveText(await page.getByTestId('card-evNet').locator('strong').innerText());await expect(page.getByRole('button',{name:'Sort Rake bb/100',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sort Splash Fee bb/100',exact:true})).toBeAttached();await page.getByRole('button',{name:'Sort Hands',exact:true}).click();if(tab==='Days'||tab==='Months'){await page.locator('tbody tr').first().click();await expect(page.getByLabel('Period',{exact:true})).toHaveValue(tab==='Days'?'Day':'Month');await page.getByRole('button',{name:'Clear filters'}).click();}}
 await page.getByRole('button',{name:'Days',exact:true}).click();await page.getByRole('columnheader').nth(1).dragTo(page.getByRole('columnheader').nth(3));await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('coinpoker.ui.v1')!).orders.Days)).not.toEqual(['key','hands','hours','handsPerHour','hourly','net','evNet','bb100','evBB100','rake','rakeBB100','fee','feeBB100','vpip','pfr','threeBet','wtsd','wsd','wwsf']);
 await page.getByText('Data Quality / Coverage', {exact:false}).click();await expect(page.getByText('BOMBPOT_EV_UNSUPPORTED',{exact:true})).toHaveCount(0);await page.getByLabel('Game Type').selectOption('');await expect(page.getByText('BOMBPOT_EV_UNSUPPORTED',{exact:true})).toBeVisible();
 const settings=await page.evaluate(()=>localStorage.getItem('coinpoker.ui.v1'));await page.reload();await expect(page.getByRole('button',{name:'BB',exact:true})).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>localStorage.getItem('coinpoker.ui.v1'))).toBe(settings);
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'duplicate.txt',mimeType:'text/plain',buffer:Buffer.concat([fixture,Buffer.from('\n'),fixture])});await expect(page.getByTestId('card-hands')).toBeVisible();await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0);await page.getByText('Data Quality / Coverage',{exact:false}).click();await expect(page.getByText(/Duplicates: [1-9]/)).toBeVisible();
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('not hand history')});await expect(page.getByRole('alert')).toContainText('No CoinPoker hands');await expect(page.getByTestId('card-hands')).toBeVisible();
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'cancel.txt',mimeType:'text/plain',buffer:Buffer.concat(Array(1000).fill(fixture))});await page.getByLabel('Game Type').selectOption('BombPot');await expect(page.getByTestId('card-vpip')).toContainText('—');await page.getByRole('button',{name:'Cancel import'}).click();await expect(page.getByRole('alert')).toContainText('cancelled');await expect(page.getByTestId('card-hands')).toBeVisible();expect(errors).toEqual([]);await page.screenshot({path:'analysis/phase2b-fixture.png',fullPage:true});
});
test('full source browser regression and worker responsiveness',async({page,browser})=>{test.setTimeout(300000);const source=process.env.COINPOKER_SOURCE;test.skip(!source || !fs.existsSync(source),'Set COINPOKER_SOURCE to run the private full-dataset regression.');if(!source)return;const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.evaluate(()=>{(window as unknown as {beats:number}).beats=0;setInterval(()=>{(window as unknown as {beats:number}).beats++;},50);});const start=Date.now();await page.getByLabel('Select CoinPoker file').setInputFiles(source);await expect(page.getByTestId('card-hands')).toContainText('95,739',{timeout:150000});await expect(page.getByTestId('card-evNet').locator('strong')).toBeVisible();expect(await page.evaluate(()=>window.latestResult.summary.splash)).toBeGreaterThan(0);const firstMs=Date.now()-start;await page.getByRole('button',{name:'BB',exact:true}).click();await expect(page.getByRole('button',{name:'BB',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'₮',exact:true}).click();await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0,{timeout:180000});
 await expect(page.getByTestId('card-net')).toContainText('₮5,536.72');const nlh=await page.evaluate(()=>({net:window.latestResult.summary.net.toString(),financial:window.latestResult.summary.financialHands,bb100:window.latestResult.summary.bb100,evBB100:window.latestResult.summary.evBB100,hours:window.latestResult.summary.hours}));await page.getByLabel('Game Type').selectOption('');await expect(page.getByTestId('card-hands')).toContainText('95,750');
 for(const [card,text] of [['net','₮5,525.53'],['bb100','1.72'],['evBB100','0.88'],['hours','323.55'],['vpip','25.82%'],['pfr','20.90%'],['threeBet','12.28%'],['wtsd','31.50%'],['wsd','55.18%'],['wwsf','52.31%']])await expect(page.getByTestId('card-'+card)).toContainText(text!);
 const reconciliation=await page.evaluate(()=>{const r=window.latestResult;return {net:r.summary.net.toString(),sd:r.summary.sd.toString(),nsd:r.summary.nsd.toString(),financial:r.summary.financialHands,bb100:r.summary.bb100,evBB100:r.summary.evBB100,hours:r.summary.hours,last:r.points.at(-1),timing:r.database.timing,hash:r.database.hash,queryMs:r.latency};});expect(reconciliation.net).toBe('552553');expect(reconciliation.sd).toBe('2284325');expect(reconciliation.nsd).toBe('-1731772');expect(reconciliation.financial).toBe(95647);expect(reconciliation.bb100).toBeCloseTo(1.7215,4);expect(reconciliation.evBB100).toBeCloseTo(.8829,4);expect(reconciliation.hours).toBeCloseTo(323.5492,4);expect(reconciliation.last!.currency[0]).toBe(5525.53);expect(reconciliation.last!.currency[1]!+reconciliation.last!.currency[2]!).toBeCloseTo(5525.53,8);expect(100*reconciliation.last!.bb[3]!/95647).toBeCloseTo(reconciliation.evBB100!,10);fs.writeFileSync('analysis/phase2b-browser-reconciliation.json',JSON.stringify({nlh,all:reconciliation},null,2));
 await page.getByText('Data Quality / Coverage',{exact:false}).click();await expect(page.getByText('Parsed: 95,750 · Unique: 95,750')).toBeVisible();await page.getByLabel('Game Type').selectOption('');await expect(page.getByTestId('card-hands')).toContainText('95,750');await expect(page.getByText('Financial unavailable: 103')).toBeVisible();await expect(page.getByText('unsupported: 11',{exact:true})).toBeVisible();
 const workerEvidence=await page.evaluate(async()=>{return {beats:(window as unknown as {beats:number}).beats,memory:(performance as unknown as {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize};});const filterStart=Date.now();await page.getByLabel('Limit',{exact:true}).selectOption('200');await expect(page.getByTestId('card-hands')).not.toContainText('95,750');await page.getByRole('button',{name:'Days',exact:true}).click();await expect(page.locator('tfoot')).toContainText('TOTAL');await expect(page.getByRole('button',{name:'Sort Rake bb/100',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sort Splash Fee bb/100',exact:true})).toBeAttached();await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.getByTestId('card-hands')).toContainText('95,739');await page.screenshot({path:'analysis/phase2b-full.png',fullPage:true});fs.writeFileSync(path.resolve('analysis/phase2b-browser-benchmark.json'),JSON.stringify({browser:browser.version(),firstUsableMs:firstMs,totalMs:Date.now()-start,filterFlowMs:Date.now()-filterStart,...workerEvidence,errors},null,2));expect(errors).toEqual([]);
});

const splitHistory=(id:string,ante='0.16')=>fs.readFileSync('tests/fixtures/900000010.txt','utf8').replace('#900000010:',`#${id}:`).replaceAll('₮0.16',`₮${ante}`).trimEnd();
test('four split files combine, deduplicate, filter ante and preserve the database after a failed batch',async({page})=>{
 await page.goto('/');
 const parts=[splitHistory('910000001'),splitHistory('910000002','0.25'),splitHistory('910000003'),splitHistory('910000004','0.25')];
 const files=parts.map((text,i)=>({name:`part-${i+1}.txt`,mimeType:'text/plain',buffer:Buffer.from((i===1?'\uFEFF':'')+text+(i===3?'\n'+parts[0]:''))}));
 await page.getByLabel('Select CoinPoker file').setInputFiles(files);
 await expect(page.getByTestId('card-hands')).toContainText('4');await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>({files:window.latestResult.database.files.length,unique:window.latestResult.database.unique,duplicates:window.latestResult.database.duplicates}))).toEqual({files:4,unique:4,duplicates:1});
 await expect(page.getByLabel('Ante')).toContainText('0.16 bb');await expect(page.getByLabel('Ante')).toContainText('0.25 bb');
 await page.getByLabel('Ante').selectOption({label:'0.25 bb'});await expect.poll(()=>page.evaluate(()=>window.latestResult.summary.hands)).toBe(2);
 expect(await page.evaluate(()=>Object.values(window.latestResult.rows).every(rows=>rows.reduce((n,row)=>n+row.summary.hands,0)===2))).toBe(true);
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.latestResult.summary.hands)).toBe(4);await expect(page.getByLabel('Ante')).toHaveValue('');
 expect(await page.locator('.table-actions button').allTextContents()).toEqual(['Reset filters','Reset columns']);
 await page.getByRole('button',{name:'Positions',exact:true}).click();await page.locator('tbody tr').first().click();await expect(page.getByLabel('Position')).toHaveValues(['BB']);await page.getByRole('button',{name:'Reset filters',exact:true}).click();await expect(page.getByLabel('Position')).toHaveValues([]);
 const before=await page.evaluate(()=>window.latestResult.database.importedAt);
 await page.getByLabel('Select CoinPoker file').setInputFiles([files[0]!,{name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not hand history')}]);
 await expect(page.getByRole('alert')).toContainText('No CoinPoker hands were found in invalid.txt');await expect(page.getByTestId('card-hands')).toContainText('4');expect(await page.evaluate(()=>window.latestResult.database.importedAt)).toBe(before);
 await page.evaluate(texts=>{const dt=new DataTransfer();for(const [i,text] of texts.entries())dt.items.add(new File([text],`drop-${i}.txt`,{type:'text/plain'}));document.querySelector('main')!.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));},parts.slice(0,2));
 await expect.poll(()=>page.evaluate(()=>window.latestResult.database.files.length)).toBe(2);await expect(page.getByTestId('card-hands')).toContainText('2');
});

test('card rows, renamed positions and saved filter migration',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>localStorage.setItem('coinpoker.ui.v1',JSON.stringify({unit:'₮',lines:[true,true,true,true],tab:'Overview',orders:{},filters:{period:'All Time',from:'',to:'',month:'',limits:[],positions:['BTN'],tables:['obsolete table'],players:'',game:'NLH',splash:''}})));await page.reload();
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'positions.txt',mimeType:'text/plain',buffer:fixture});await expect(page.getByTestId('card-hands')).toBeVisible();await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0,{timeout:90000});
 await expect(page.getByLabel('Position')).toHaveValues(['BU']);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('coinpoker.ui.v1')!).filters.tables)).toBeUndefined();
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();
 expect(await page.locator('.results-cards .stat').evaluateAll(cards=>cards.map(card=>card.firstElementChild!.firstChild!.textContent!.trim()))).toEqual(['Net Won','EV Net Won','bb/100','EV bb/100','Hands','Hours Played','Hands per hour','$/hour']);
 expect(await page.locator('.poker-cards .stat').evaluateAll(cards=>cards.map(card=>card.firstElementChild!.firstChild!.textContent!.trim()))).toEqual(['VPIP','PFR','3Bet','WTSD','W$SD','WWSF','Rake','Splash Fee']);
 await expect(page.getByTestId('card-splash')).toHaveCount(0);await expect(page.getByLabel('Table',{exact:true})).toHaveCount(0);
 const expected=await page.evaluate(()=>{const r=window.latestResult;return {ev:'₮'+r.summary.evNet!.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),hourly:'₮'+r.summary.hourly!.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})};});
 await expect(page.getByTestId('card-evNet').locator('strong')).toHaveText(expected.ev);await expect(page.getByTestId('card-hourly').locator('strong')).toHaveText(expected.hourly);
 await page.getByRole('button',{name:'BB',exact:true}).click();await expect(page.getByTestId('card-evNet').locator('strong')).toContainText('bb');await expect(page.getByTestId('card-hourly').locator('strong')).toHaveText(expected.hourly);
 await page.screenshot({path:'analysis/dashboard-updated-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'analysis/dashboard-updated-mobile.png',fullPage:true});
 expect(await page.locator('.results-cards .stat').evaluateAll(cards=>cards.every(card=>card.scrollWidth<=card.clientWidth))).toBe(true);
});

const tableHistory=(id:number,players:number,ante:number)=>{
 const names=Array.from({length:players},(_,i)=>i===1?'Hero':`Player${i+1}`),pot=(2+players*ante).toFixed(2);
 return [`CoinPoker Hand #${id}: NLH (₮1/₮2/₮${ante}) 2026/10/02 09:00:00 MSK`,
  `Table 'synthetic-${players}' ${players}-max Seat #${players===2?1:players} is the button`,
  ...names.map((name,i)=>`Seat ${i+1}: ${name} (₮100 in chips)`),
  ...names.map(name=>`${name}: posts ante ₮${ante}`),
  'Player1: posts small blind ₮1','Hero: posts big blind ₮2','*** HOLE CARDS ***',
  ...names.map(name=>`Dealt to ${name}${name==='Hero'?' [Ah Ad]':''}`),
  ...names.slice(2).map(name=>`${name}: folds`),'Player1: folds','Hero: RETURN ₮1',
  `Hero collected ₮${pot} from pot`,'*** SUMMARY ***',`Total pot ₮${pot} | Rake ₮0 | Splash Fee ₮0`,
  'Hand was run once','Board [  ]','Game ended: 2026/10/02 09:01:00 MSK'].join('\n');
};

test('hourly cards and table totals, ante-specific limit rows and empty player selections',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'antes.txt',mimeType:'text/plain',buffer:Buffer.from([tableHistory(920000001,6,.5),tableHistory(920000002,6,.32)].join('\n'))});
 await expect(page.getByTestId('card-hands').locator('strong')).toHaveText('2');await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0);
 await expect(page.getByTestId('card-handsPerHour').locator('strong')).toHaveText('120.00');
 expect(await page.getByLabel('Players',{exact:true}).locator('option').allTextContents()).toEqual(['All','HU','3-max','4-max','5-max','6-max']);
 expect(await page.locator('.table-scroll tbody tr td:first-child').allTextContents()).toEqual(['NL200 (0.32)','NL200 (0.5)']);
 for(const tab of ['Days','Months','Limits','Positions']){
  await page.getByRole('button',{name:tab,exact:true}).click();
  expect((await page.getByRole('columnheader').allTextContents()).slice(2,5)).toEqual(['Hours ↕','Hands/hour ↕','$/hour ↕']);
  await expect(page.locator('tfoot td').nth(3)).toHaveText(await page.getByTestId('card-handsPerHour').locator('strong').innerText());
  await expect(page.locator('tfoot td').nth(4)).toHaveText(await page.getByTestId('card-hourly').locator('strong').innerText());
  await page.getByRole('button',{name:'Sort Hands/hour',exact:true}).click();
  await page.getByRole('button',{name:'Sort $/hour',exact:true}).click();
 }
 await page.getByRole('button',{name:'Limits',exact:true}).click();await page.getByRole('button',{name:'Sort Period / group',exact:true}).click();
 expect(await page.locator('.table-scroll tbody tr td:first-child').allTextContents()).toEqual(['NL200 (0.32)','NL200 (0.5)']);
 await page.getByRole('button',{name:'Sort Period / group',exact:true}).click();expect(await page.locator('.table-scroll tbody tr td:first-child').allTextContents()).toEqual(['NL200 (0.5)','NL200 (0.32)']);
 await page.getByText('NL200 (0.32)',{exact:true}).click();await expect(page.getByLabel('Limit',{exact:true})).toHaveValues(['200']);await expect(page.getByLabel('Ante',{exact:true})).toHaveValue('4/25');await expect(page.getByTestId('card-hands').locator('strong')).toHaveText('1');await expect(page.getByTestId('card-handsPerHour').locator('strong')).toHaveText('60.00');
 const hourly=await page.getByTestId('card-hourly').locator('strong').innerText();await page.getByRole('button',{name:'BB',exact:true}).click();await expect(page.locator('tfoot td').nth(4)).toHaveText(hourly);
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();await page.getByLabel('Players',{exact:true}).selectOption('2');
 await expect(page.getByLabel('Players',{exact:true})).toHaveValue('2');await expect(page.getByTestId('card-hands').locator('strong')).toHaveText('0');await expect(page.getByTestId('card-handsPerHour').locator('strong')).toHaveText('—');await expect(page.getByTestId('card-hourly').locator('strong')).toHaveText('—');
});

test('larger player options follow database contents and hourly columns migrate saved order',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>localStorage.setItem('coinpoker.ui.v1',JSON.stringify({unit:'₮',lines:[true,true,true,true],tab:'Limits',filters:{period:'All Time',from:'',to:'',month:'',limits:[],positions:[],players:'',game:'NLH',splash:''},orders:{Limits:['hands','key','hours','net','evNet','bb100','evBB100','rake','rakeBB100','fee','feeBB100','vpip','pfr','threeBet','wtsd','wsd','wwsf']}})));await page.reload();
 const upload=async(counts:number[])=>{
  const previous=await page.evaluate(()=>window.latestResult?.database.importedAt);
  await page.getByLabel('Select CoinPoker file').setInputFiles({name:'players.txt',mimeType:'text/plain',buffer:Buffer.from(counts.map(p=>tableHistory(930000000+p,p,.32)).join('\n'))});
  await expect.poll(()=>page.evaluate(()=>window.latestResult?.database.importedAt)).not.toBe(previous);await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0);
 };
 await upload([10,7,9,8]);
 expect(await page.getByLabel('Players',{exact:true}).locator('option').allTextContents()).toEqual(['All','HU','3-max','4-max','5-max','6-max','7-max','8-max','9-max','10-max']);
 expect((await page.getByRole('columnheader').allTextContents()).slice(0,6)).toEqual(['Hands ↕','Period / group ↕','Hours ↕','Hands/hour ↕','$/hour ↕','Net Won ↕']);
 for(const count of ['7','8','9','10']){await page.getByLabel('Players',{exact:true}).selectOption(count);await expect(page.getByTestId('card-hands').locator('strong')).toHaveText('1');await expect.poll(()=>page.evaluate(()=>window.latestResult.summary.net.toString())).toBe(String(100+(Number(count)-1)*32));await expect.poll(()=>page.evaluate(()=>window.latestResult.points.length)).toBe(1);}
 await upload([8]);await expect(page.getByLabel('Players',{exact:true})).toHaveValue('');expect(await page.getByLabel('Players',{exact:true}).locator('option').allTextContents()).toEqual(['All','HU','3-max','4-max','5-max','6-max','8-max']);
 await page.getByRole('button',{name:'Reset columns',exact:true}).click();expect((await page.getByRole('columnheader').allTextContents()).slice(0,5)).toEqual(['Period / group ↕','Hands ↕','Hours ↕','Hands/hour ↕','$/hour ↕']);
});
