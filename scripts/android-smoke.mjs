import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,expect} from '@playwright/test';
import {revealResource} from './ui-controls.mjs';

// This test changes saves only in the project's disposable emulator.
const serial=process.argv[process.argv.indexOf('--serial')+1];
if(!process.argv.includes('--serial')||!/^emulator-\d+$/.test(serial||''))
  throw Error('指定专用测试模拟器：--serial emulator-5580');
const sdk=path.resolve(process.env.ANDROID_SDK_ROOT||'.local/android-sdk');
const executable=path.join(sdk,'platform-tools',process.platform==='win32'?'adb.exe':'adb');
const adb=(...args)=>execFileSync(executable,['-s',serial,...args],{encoding:'utf8',timeout:30000});
const avd=adb('emu','avd','name').split(/[\r\n]+/)[0].trim();
if(!/^GTLH_test(?:_[\w-]+)?$/.test(avd))throw Error('仅允许 GTLH_test 专用模拟器，拒绝修改其他设备的存档。');
const pid=adb('shell','pidof','dev.gtnh.litehorizons').trim();
if(!/^\d+$/.test(pid))throw Error('请先安装并打开 --debug-webview 诊断包。');
const port=adb('forward','tcp:0','localabstract:webview_devtools_remote_'+pid).trim();
let browser;
const errors=[];
await fs.mkdir('artifacts/android',{recursive:true});
async function showPart(page,selector){
  if(await page.locator(selector).isVisible())return;
  const panel=page.locator(selector).locator('xpath=ancestor::*[contains(@class,"surface")][1]');
  const previous=panel.locator('[data-mobile-panel-step="-1"]');
  while(await previous.count()&&!await previous.isDisabled())await previous.click();
  for(let i=0;i<15&&!await page.locator(selector).isVisible();i++)await panel.locator('[data-mobile-panel-step="1"]').click();
  await expect(page.locator(selector)).toBeVisible();
}
async function imagesLoaded(page){
  await expect.poll(()=>page.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src'))),{timeout:15000}).toEqual([]);
}
try{
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{noDefaults:true});
  const page=browser.contexts()[0].pages().find(p=>p.url().includes('appassets.androidplatform.net'));
  if(!page)throw Error('没有找到游戏 WebView。');
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.reload({waitUntil:'load'});
  await expect(page.locator('html')).toHaveAttribute('data-mobile','true');
  await expect(page.locator('#page .heading')).toBeVisible();
  await page.addInitScript(()=>{
    const seed=sessionStorage.getItem('gtlh-test-seed');
    if(seed){localStorage.setItem('gtnh-long-road-v2',seed);sessionStorage.removeItem('gtlh-test-seed');}
  });
  // A new synthetic world, never an imported or real player's save.
  await page.evaluate(async()=>{
    const {Game}=await import('./core/engine.js');
    sessionStorage.setItem('gtlh-test-seed',JSON.stringify(new Game().snapshot()));
  });
  await page.reload({waitUntil:'load'});
  const go=async name=>{
    await page.locator('.nav [data-page="'+name+'"]').click();
    await expect(page.locator('#page')).toHaveAttribute('data-page',name);
    await imagesLoaded(page);
  };
  for(const name of ['overview','resources','workshop','factory','inventory','research','space','settings'])await go(name);
  console.log('Native WebView: startup, all 8 pages, icons and modules passed.');
  await go('resources');await revealResource(page,'forest');
  for(let i=0;i<4;i++)await page.locator('[data-gather=forest]').click();
  await expect(page.locator('[data-qty=wood]')).toHaveText(/^[1-3]$/);
  await go('workshop');await page.locator('[data-book-item=stick]').click();
  await showPart(page,'[data-fill=sticks]');await page.locator('[data-fill=sticks]').click();
  await showPart(page,'[data-craft=sticks][data-count="1"]');await page.locator('[data-craft=sticks][data-count="1"]').click();
  await expect(page.locator('[data-queue-count]')).toHaveText('0');
  await page.locator('[data-bench-view=tree]').click();
  await expect(page.locator('[data-tree-content]')).toContainText('木棍',{timeout:20000});
  await expect(page.locator('[data-tree-content]')).not.toContainText('加载失败');
  console.log('Native WebView: gathering, crafting and recipe-tree Worker passed.');
  await page.evaluate(async()=>{
    const {Game}=await import('./core/engine.js');
    const game=new Game();game.add({wood:10000,coal:10000,steel:10000,bronze:10000,copper:10000,iron:10000,tin:10000,brick:10000,stone:10000,flintPick:1,wrench:1,hammer:1});
    for(const type of ['cokeOven','steamMacerator','forgeHammer','boiler']){
      game.add(game.catalog.machines[type].cost);const result=game.build(type);if(!result.ok)throw Error(result.message);
    }
    game.add({woodBucket:3});const result=game.placeContainer('woodBucket',3);if(!result.ok)throw Error(result.message);
    sessionStorage.setItem('gtlh-test-seed',JSON.stringify(game.snapshot()));
  });
  await page.reload({waitUntil:'load'});await go('inventory');
  await expect(page.locator('#page')).toContainText('物品仓库');
  await go('factory');
  for(const type of ['cokeOven','steamMacerator','forgeHammer','boiler']){
    await page.locator('[data-factory-type="'+type+'"]').click();
    await expect(page.locator('.device-card').first()).toBeVisible();await imagesLoaded(page);
  }
  await fs.writeFile('artifacts/android/factory.png',execFileSync(executable,['-s',serial,'exec-out','screencap','-p'],{timeout:10000}));
  await go('overview');
  adb('shell','input','keyevent','KEYCODE_HOME');
  await new Promise(r=>setTimeout(r,700));
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gtnh-long-road-v2')).playtime);
  const before=await saved();
  await new Promise(r=>setTimeout(r,1000));
  expect(await saved()).toBe(before);
  adb('shell','am','start','-W','-n','dev.gtnh.litehorizons/.MainActivity');
  await expect(page.locator('#page .heading')).toBeVisible();
  expect(await page.evaluate(()=>window.gtlhLifecycle(true))).toBeUndefined();
  const resumed=await saved();expect(resumed-before).toBeLessThan(1);
  await page.evaluate(()=>window.gtlhLifecycle(false));
  await imagesLoaded(page);
  await fs.writeFile('artifacts/android/overview.png',execFileSync(executable,['-s',serial,'exec-out','screencap','-p'],{timeout:10000}));
  expect(errors).toEqual([]);
  console.log('Native WebView: containers, factory and background pause/resume passed.');
}finally{
  await browser?.close();adb('forward','--remove','tcp:'+port);
}
