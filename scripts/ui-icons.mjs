import {chromium,_electron as electron} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {CATALOG} from '../src/data/catalog.js';
import {itemIconPath} from '../src/item-art.js';

const manifest=JSON.parse(fs.readFileSync('src/assets/gtnh/sources.json','utf8'));
const repaired=Object.entries(manifest.icons).filter(([,entry])=>entry.note?.includes('No resource pack.')).map(([key])=>`assets/gtnh/${encodeURIComponent(key)}.svg`);
const paths=[...new Set([...repaired,...Object.values(CATALOG.items).map(item=>itemIconPath(item,item.id)),'assets/ui/item-unavailable.svg'])];
const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(fs.readFileSync('package.json','utf8'));
const app=packaged?await electron.launch({executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[],env:{...process.env,GTNH_TEST_DATA:path.resolve('artifacts',`icons-${Date.now()}-${process.pid}`)},timeout:60000}):null;
const browser=app?null:await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  const page=app?await app.firstWindow():await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];
  const watch=page=>{
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  };watch(page);
  if(app)await page.waitForSelector('#page[data-page="overview"]');
  else await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  const catalogSize=await page.evaluate(async()=>Object.keys((await import('./data/catalog.js')).CATALOG.items).length);
  if(catalogSize!==Object.keys(CATALOG.items).length)throw Error('Packaged catalog differs from source');
  const failures=[];
  // SVG documents remain in Chromium's image cache after Image references are
  // released. Scan every path in fresh ephemeral renderer sessions so a full
  // 20,000-image audit cannot exhaust one renderer's memory.
  for(let offset=0;offset<paths.length;offset+=1024){
    let scan=page,windowId=null;
    if(app){
      const opened=app.waitForEvent('window');
      windowId=await app.evaluate(({BrowserWindow,app},offset)=>{
        const win=new BrowserWindow({show:false,webPreferences:{partition:'icon-audit-'+offset,sandbox:true,contextIsolation:true,nodeIntegration:false}});
        win.loadFile(app.getAppPath()+'/src/index.html');return win.id;
      },offset);
      scan=await opened;watch(scan);await scan.waitForSelector('#page[data-page="overview"]');
    }else{
      scan=await browser.newPage();watch(scan);await scan.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
    }
    try{failures.push(...await scan.evaluate(async paths=>{
    let cursor=0;const failures=[];
    await Promise.all(Array.from({length:12},async()=>{
      while(cursor<paths.length) {
        const path=paths[cursor++];
        try{const image=new Image();image.src=path;await Promise.race([image.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('decode timeout')),15000))]);if(!image.naturalWidth)failures.push(path);image.src='';}
        catch{failures.push(path);}
      }
    }));
    return failures;
    },paths.slice(offset,offset+1024)));}
    finally{if(app)await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id)?.destroy(),windowId);else await scan.close();}
    console.log(`Original SVG decode: ${Math.min(offset+1024,paths.length)}/${paths.length}`);
  }
  for(const view of ['workshop','inventory','factory','resources']) {
    await page.locator(`[data-page="${view}"]`).first().click();
    await page.waitForTimeout(100);
    const broken=await page.locator('img').evaluateAll(images=>images.filter(img=>img.getAttribute('src')&&img.complete&&!img.naturalWidth).map(img=>img.src));
    errors.push(...broken);
  }
  console.log(JSON.stringify({checked:paths.length,repaired:repaired.length,failures,errors}));
  if(failures.length||errors.length)throw Error('Icon loading check failed');
} finally {if(app)await app.close();else await browser.close();}
