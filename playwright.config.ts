import {defineConfig} from '@playwright/test';
const port=process.env.COINPOKER_TEST_PORT||'5175';
const baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({testDir:'tests/browser',timeout:240000,workers:1,use:{baseURL,headless:true,viewport:{width:1440,height:1000},launchOptions:{channel:'chrome'}},webServer:{command:process.env.COINPOKER_PREVIEW==='1'?`npm run preview -- --port ${port} --strictPort`:`npm run dev -- --port ${port} --strictPort`,url:baseURL,reuseExistingServer:false},reporter:[['list'],['json',{outputFile:'analysis/phase2b-browser-tests.json'}]]});
