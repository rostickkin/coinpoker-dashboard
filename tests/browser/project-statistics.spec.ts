import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {UsageEvent} from '../../src/statistics/protocol.ts';

const configured=Boolean(process.env.COINPOKER_STATS_API_URL||process.env.VITE_STATS_API_URL);
const totals={schemaVersion:1,totalVisits:12846,uniqueVisitors:3218,databasesLoaded:1407,handsProcessed:8420000,filesImported:4892,dataProcessed:12600000000,startedAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-18T00:00:00.000Z'};
async function collector(page:Page,available=true){
 const events:UsageEvent[]=[];
 await page.route('**/__project-statistics/**',async route=>{
  const request=route.request();
  if(request.method()==='POST'){events.push(request.postDataJSON() as UsageEvent);await route.fulfill({status:204});}
  else await route.fulfill({status:available?200:503,json:available?totals:{error:'unavailable'}});
 });
 return events;
}

test('unconfigured deployments show honest unavailable values and no usage-sharing control',async({page})=>{
 test.skip(configured,'This case verifies a build without an API URL.');
 await page.goto('/');const section=page.getByRole('region',{name:'Project Statistics'});
 await expect(section).toBeVisible();await expect(section.locator('.project-stat strong')).toHaveText(['—','—','—','—','—','—']);
 await expect(section.getByText('Statistics are not available yet.')).toBeVisible();await expect(page.getByLabel('Share usage statistics')).toHaveCount(0);
});

test('Cards show real aggregates, count one session across reloads, and persist opt-out',async({page})=>{
 test.skip(!configured,'Set COINPOKER_STATS_API_URL to the local mocked collector.');
 const events=await collector(page);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');const section=page.getByRole('region',{name:'Project Statistics'});
 await expect(section.getByText('12,846',{exact:true})).toBeVisible();await expect(section.getByText('8.42M',{exact:true})).toBeVisible();await expect(section.getByText('12.6 GB',{exact:true})).toBeVisible();
 await expect.poll(()=>events.filter(event=>event.type==='visit').length).toBe(1);
 await page.reload();await expect(section.getByText('12,846',{exact:true})).toBeVisible();expect(events.filter(event=>event.type==='visit')).toHaveLength(1);
 await page.getByLabel('Share usage statistics').uncheck();await page.reload();await expect(page.getByLabel('Share usage statistics')).not.toBeChecked();
 expect(events.filter(event=>event.type==='visit')).toHaveLength(1);expect(errors).toEqual([]);
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await expect(section).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await section.screenshot({path:`analysis/project-statistics-${width}.png`});
 }
});

test('one completed multi-file selection sends one minimal summary; filters do not count imports',async({page})=>{
 test.skip(!configured,'Set COINPOKER_STATS_API_URL to the local mocked collector.');
 const events=await collector(page);await page.goto('/');
 const files=['900000001','900000004'].map(id=>({name:`private-${id}.txt`,mimeType:'text/plain',buffer:readFileSync(`tests/fixtures/${id}.txt`)}));
 await page.getByLabel('Select CoinPoker file').setInputFiles(files);
 await expect.poll(()=>events.filter(event=>event.type==='import').length).toBe(1);
 const imported=events.find(event=>event.type==='import')!;
 expect(imported).toMatchObject({type:'import',hands:2,files:2,bytes:files.reduce((n,file)=>n+file.buffer.length,0)});
 expect(Object.keys(imported).sort()).toEqual(['bytes','eventId','files','hands','occurredAt','schemaVersion','type','visitorId']);
 await page.getByRole('button',{name:'Clear filters'}).click();expect(events.filter(event=>event.type==='import')).toHaveLength(1);
 await page.getByLabel('Select CoinPoker file').setInputFiles(files);await expect.poll(()=>events.filter(event=>event.type==='import').length).toBe(2);
 await page.getByLabel('Share usage statistics').uncheck();await page.getByLabel('Select CoinPoker file').setInputFiles(files);
 await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0);expect(events.filter(event=>event.type==='import')).toHaveLength(2);
});

test('unavailable telemetry does not block imports, and a failed import is not counted',async({page})=>{
 test.skip(!configured,'Set COINPOKER_STATS_API_URL to the local mocked collector.');
 const events=await collector(page,false);await page.goto('/');
 await expect(page.getByText('Statistics are temporarily unavailable.')).toBeVisible();
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('not a history')});
 await expect(page.getByRole('alert')).toContainText('No CoinPoker hands');expect(events.filter(event=>event.type==='import')).toHaveLength(0);
 await page.getByLabel('Select CoinPoker file').setInputFiles({name:'valid.txt',mimeType:'text/plain',buffer:readFileSync('tests/fixtures/900000001.txt')});
 await expect(page.getByTestId('card-hands')).toBeVisible();await expect.poll(()=>events.filter(event=>event.type==='import').length).toBe(1);
});

test('cancelled staging workers cannot submit a late completion event',async({page})=>{
 test.skip(!configured,'Set COINPOKER_STATS_API_URL to the local mocked collector.');
 const events=await collector(page);
 await page.addInitScript(()=>{
  window.Worker=class extends EventTarget {
   onmessage:((event:MessageEvent)=>void)|null=null;
   postMessage(message:{type:string}){if(message.type==='import')setTimeout(()=>{this.onmessage?.(new MessageEvent('message',{data:{type:'complete',payload:{hands:10,files:1,bytes:100}}}));(window as unknown as {lateCompletion:boolean}).lateCompletion=true;},1000);}
   terminate(){}
  } as unknown as typeof Worker;
 });
 await page.goto('/');await page.getByLabel('Select CoinPoker file').setInputFiles({name:'cancel.txt',mimeType:'text/plain',buffer:Buffer.from('history')});
 await page.getByRole('button',{name:'Cancel import'}).click();await expect(page.getByRole('alert')).toContainText('cancelled');
 await page.waitForFunction(()=>(window as unknown as {lateCompletion:boolean}).lateCompletion);
 expect(events.filter(event=>event.type==='import')).toHaveLength(0);
});
