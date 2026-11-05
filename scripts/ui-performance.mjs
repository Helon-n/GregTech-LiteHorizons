import {chromium,expect} from '@playwright/test';
import {Game} from '../src/core/engine.js';
import {pickOption} from './ui-controls.mjs';

// Isolated browser storage: never reads or changes the desktop player's save.
const game=new Game();
game.add({stone:10000,clay:10000,coal:10000,wood:10000});
for(let i=0;i<60;i++){
  const {device}=game.build('furnace');
  game.toggle(device.id);
}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(snapshot=>localStorage.setItem('gtnh-long-road-v2',JSON.stringify({...snapshot,lastSeen:Date.now()})),game.snapshot());
  await page.goto('http://127.0.0.1:4173/');
  const go=name=>page.locator(`.nav [data-page="${name}"]`).click();
  const openAppearance=async()=>{await go('settings');await page.locator('#page [data-appearance-open]').click();};
  // A fixed theme must survive navigation without rewriting root styles/attributes.
  await openAppearance();
  await page.locator('[data-select-tier="MAX"]').click();await page.locator('[data-tier-use]').click();
  await expect(page.locator('html')).toHaveAttribute('data-tier','MAX');
  await expect(page.locator('html')).toHaveAttribute('data-light','true');
  const writes=await page.evaluate(async()=>{
    let count=0;
    const observer=new MutationObserver(records=>count+=records.length);
    observer.observe(document.documentElement,{attributes:true});
    for(const name of ['overview','resources','workshop','factory','inventory','research','space','settings']){
      document.querySelector(`.nav [data-page="${name}"]`).click();
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    observer.disconnect();return count;
  });
  expect(writes,'unchanged theme navigation writes').toBe(0);
  await openAppearance();await page.locator('[data-tier-auto]').click();
  await expect(page.locator('html')).toHaveAttribute('data-tier','ULV');
  // Multiple idle refreshes with many machines must leave the factory DOM alone.
  await go('factory');await page.waitForTimeout(300);
  const idleWrites=await page.evaluate(async()=>{
    let count=0;
    const observer=new MutationObserver(records=>count+=records.length);
    observer.observe(document.querySelector('#page'),{subtree:true,attributes:true,childList:true,characterData:true});
    await new Promise(resolve=>setTimeout(resolve,900));
    observer.disconnect();return count;
  });
  expect(idleWrites,'idle factory refresh writes').toBe(0);
  // Live progress and the select's companion button must still refresh in place.
  await pickOption(page,'[data-assign="d1"]','bricks');
  await page.locator('[data-toggle="d1"]').click();
  await expect(page.locator('[data-device-state="d1"]')).toHaveText('运行中');
  await expect(page.locator('[data-assign="d1"]+button')).toBeDisabled();
  const bar=page.locator('[data-device-bar="d1"]');
  const previous=await bar.evaluate(el=>el.style.width);
  await expect.poll(()=>bar.evaluate(el=>el.style.width)).not.toBe(previous);
  await page.locator('[data-force-stop="d1"]').click();
  await expect(page.locator('[data-device-state="d1"]')).toHaveText('已停止');
  await expect(page.locator('[data-assign="d1"]+button')).toBeEnabled();
  await expect(page.locator('[data-force-stop="d1"]')).toBeDisabled();
  await pickOption(page,'[data-assign="d1"]','charcoal');
  await page.locator('[data-toggle="d1"]').click();
  await expect(page.locator('[data-device-state="d1"]')).toHaveText('运行中');
  await expect(page.locator('[data-assign="d1"]')).toHaveValue('charcoal');
  await expect(page.locator('[data-assign="d1"]+button')).toContainText('煤炭');
  expect(errors).toEqual([]);
  console.log('UI performance regression OK: 0 root writes on navigation, 0 idle factory writes, MAX/auto themes, live progress, force-stop and recipe switching.');
}finally{await browser.close();}
