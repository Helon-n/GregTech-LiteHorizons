import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const dataDir=path.resolve('artifacts','electron-test-'+Date.now());
const packaged=process.argv.includes('--packaged');
const app=await electron.launch({...(packaged?{executablePath:path.resolve('release/win-unpacked/格雷的长路.exe'),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:dataDir}});
try{
  const win=await app.firstWindow();const errors=[];win.on('pageerror',x=>errors.push(x.message));
  await win.waitForSelector('[data-page="resources"]');
  await win.locator('[data-page="resources"]').first().click();await win.locator('[data-gather-hit="forest"]').click();await win.waitForTimeout(2300);
  await expect(win.locator('[data-qty="wood"]')).toHaveText('0');
  for(let i=0;i<3;i++)await win.locator('[data-gather="forest"]').click();
  await expect(win.locator('[data-qty="wood"]')).toHaveText('2');
  await expect(win.locator('[data-last-drops]')).toContainText('黏性树脂');
  await win.locator('[data-page="workshop"]').first().click();
  await expect(win.locator('.bench-grid > .bench-slot')).toHaveCount(9);
  await win.locator('[data-fill="sticks"]').click();await win.locator('[data-craft="sticks"][data-count="1"]').click();
  await expect(win.locator('#queuePanel')).toContainText('队列为空',{timeout:3000});
  await win.locator('[data-page="reference"]').first().click();await win.waitForSelector('.quest-card');
  const content=await win.locator('#page').innerText();if(!content.includes('3814'))throw Error('Local reference failed to load');
  await win.locator('.quest-card').first().click();if(!await win.locator('#modal').isVisible())throw Error('Quest dialog not visible');await win.locator('[data-action="close-modal"]').click();
  await win.locator('[data-page="overview"]').first().click();await win.screenshot({path:'artifacts/electron-overview.png',fullPage:true});
  if(errors.length)throw Error(errors.join('\n'));
  console.log((packaged?'Packaged exe':'Electron')+' smoke OK: click gathering, item drops, workbench crafting, local reference fetch, quest dialog, render');
}finally{await app.close();}
