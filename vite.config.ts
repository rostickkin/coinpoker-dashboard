import {defineConfig} from 'vite';
import {readFileSync} from 'node:fs';

const {version}=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')) as {version:string};

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  define:{__APP_VERSION__:JSON.stringify(version),__BUILD_DATE__:JSON.stringify(new Date().toISOString())},
});
