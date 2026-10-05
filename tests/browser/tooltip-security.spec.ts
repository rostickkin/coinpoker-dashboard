import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const history=fs.readFileSync('tests/fixtures/900000004.txt','utf8');
for(const timezone of ['MSK','<svg/onload=window.tooltipExecuted=true>',"<img/src='missing'/onerror='window.tooltipExecuted=true'>",'&lt;svg/onload=window.tooltipExecuted=true&gt;']){
 test(`chart tooltip treats timezone as text: ${timezone}`,async({page})=>{
  await page.goto('/');
  await page.getByLabel('Select CoinPoker file').setInputFiles({name:'tooltip.txt',mimeType:'text/plain',buffer:Buffer.from(history.replace('08:20:05 MSK','08:20:05 '+timezone))});
  await expect(page.getByRole('button',{name:'Cancel import'})).toHaveCount(0,{timeout:30000});
  await expect(page.getByTestId('card-hands')).toContainText('1');
  await expect(page.getByTestId('card-net')).toContainText('₮3.45');
  await page.locator('.chart').hover({position:{x:90,y:100}});
  const tooltip=page.locator('.chart > div').filter({hasText:'Hand #1'});
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('2026/03/04 08:20:05 '+timezone);
  await expect(tooltip.locator('svg,img,[onload],[onerror]')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as unknown as {tooltipExecuted?:boolean}).tooltipExecuted)).toBeUndefined();
  await page.getByRole('button',{name:'BB',exact:true}).click();
  await page.locator('.chart').hover({position:{x:90,y:100}});
  await expect(tooltip).toContainText('Net Won: 3.45 bb');
 });
}
