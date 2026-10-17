import {test,expect} from '@playwright/test';
import fs from 'node:fs';
declare global {interface Window {scaleAnte?:string}}

// Optional volume check: COINPOKER_STRESS_HANDS=350000 npm run test:e2e -- import-scale.spec.ts
// Synthetic histories contain no expensive equity candidates so this isolates import and query capacity.
test('large split export imports every hand across four files',async({page},testInfo)=>{
 const count=Number(process.env.COINPOKER_STRESS_HANDS??0);
 test.skip(!count,'Set COINPOKER_STRESS_HANDS to run the synthetic volume check.');
 test.setTimeout(600000);
 const history=`CoinPoker Hand #HAND_ID: NLH (₮0.50/₮1/₮0.16) 2026/10/02 09:00:00 MSK
Table 'synthetic' 2-max Seat #1 is the button
Seat 1: Player1 (₮100 in chips)
Seat 2: Hero (₮100 in chips)
Player1: posts ante ₮0.16
Hero: posts ante ₮0.16
Player1: posts small blind ₮0.50
Hero: posts big blind ₮1
*** HOLE CARDS ***
Dealt to Player1
Dealt to Hero [Ah Ad]
Player1: raises ₮1 to ₮2
Hero: folds
Player1: RETURN ₮1
Player1 collected ₮2.32 from pot
*** SUMMARY ***
Total pot ₮2.32 | Rake ₮0
Hand was run once
Board [  ]
Game ended: 2026/10/02 09:01:00 MSK`;
 const size=Math.ceil(count/3.5),files:string[]=[];
 fs.mkdirSync(testInfo.outputDir,{recursive:true});
 for(let start=0;start<count;start+=size){const end=Math.min(count,start+size),text=Array.from({length:end-start},(_,i)=>history.replace('HAND_ID',String(800000000+start+i))).join('\n');const file=testInfo.outputPath(`split-${files.length+1}.txt`);fs.writeFileSync(file,text);files.push(file);}
 await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends Native {constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.addEventListener('message',e=>{if(e.data.type==='result'){window.latestResult=e.data.payload.result;window.scaleAnte=e.data.payload.filters.ante;}});}};});
 await page.goto('/');const start=Date.now();
 await page.getByLabel('Select CoinPoker file').setInputFiles(files);
 await expect.poll(()=>page.evaluate(()=>window.latestResult?.database.unique),{timeout:540000}).toBe(count);
 await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0,{timeout:60000});
 const result=await page.evaluate(()=>{const r=window.latestResult;return {files:r.database.files.length,parsed:r.database.parsed,unique:r.database.unique,duplicates:r.database.duplicates,conflicts:r.database.conflicts,errors:r.database.errors,hands:r.summary.hands,net:r.summary.net.toString(),points:r.points.length,last:r.points.at(-1)?.currency[0],timing:r.database.timing};});
 expect(result).toMatchObject({files:4,parsed:count,unique:count,duplicates:0,conflicts:0,errors:0,hands:count,net:String(-116*count),points:count,last:-1.16*count});
 console.log(JSON.stringify({elapsedMs:Date.now()-start,...result}));
 await page.getByLabel('Ante').selectOption({label:'0.16 bb'});await expect.poll(()=>page.evaluate(()=>window.scaleAnte),{timeout:90000}).toBe('4/25');
 expect(Number((await page.getByTestId('card-hands').locator('strong').innerText()).replace(/\D/g,''))).toBe(count);
});
