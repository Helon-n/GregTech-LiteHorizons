import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const dataDir=path.resolve('artifacts','choice-input-'+Date.now()+'-'+process.pid);
const app=await electron.launch({...(packaged?{executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:dataDir},timeout:60000});
try {
  const win=await app.firstWindow(),errors=[];win.setDefaultTimeout(10000);win.on('pageerror',error=>errors.push(error.message));
  await win.waitForSelector('#page[data-page="overview"]');
  await expect(win.locator('#saveStatus')).toContainText('v'+metadata.version);
  const fixture=await win.evaluate(async()=>{
    const {Game}=await import('./core/engine.js');const g=new Game();g.add(g.catalog.machines.furnace.cost);g.build('furnace');
    return JSON.stringify(g.snapshot());
  });
  await win.addInitScript(value=>localStorage.setItem('gtnh-long-road-v2',value),fixture);
  await win.reload();await win.waitForSelector('#page[data-page="overview"]');
  await win.locator('.nav [data-page="factory"]').click();
  const trigger=win.locator('[data-assign="d1"]+button');await trigger.click();
  const dialog=win.locator('#choiceDialog'),search=dialog.locator('#choiceSearch');
  await expect(dialog).toBeVisible();await expect(search).toBeFocused();
  await win.evaluate(()=>{window.choiceInputBefore=document.querySelector('#choiceSearch');});
  await search.pressSequentially('abc');await expect(search).toHaveValue('abc');
  expect(await win.evaluate(()=>window.choiceInputBefore===document.querySelector('#choiceSearch')),'typing must keep the original input element mounted').toBe(true);
  await expect(search).toBeFocused();await expect(dialog.locator('.choice-options')).toContainText('没有匹配');
  await search.press('ControlOrMeta+A');await search.press('Backspace');
  await search.pressSequentially('hongzhuan');await expect(search).toHaveValue('hongzhuan');
  await expect(dialog.locator('[data-choice-option] strong')).toHaveText('红砖');
  for(const query of ['HZ','hong zhuan']){
    await search.fill(query);await expect(dialog.locator('[data-choice-option] strong')).toHaveText('红砖');
  }
  expect(await win.evaluate(()=>window.choiceInputBefore===document.querySelector('#choiceSearch')),'pinyin search must keep the original input mounted').toBe(true);
  await search.fill('');
  const before=await dialog.locator('[data-choice-option]').count();
  const cdp=await win.context().newCDPSession(win);
  await cdp.send('Input.imeSetComposition',{text:'hong',selectionStart:4,selectionEnd:4});
  await expect(search).toHaveValue('hong');await expect(search).toBeFocused();
  expect(await dialog.locator('[data-choice-option]').count(),'uncommitted composition must not filter options').toBe(before);
  await cdp.send('Input.insertText',{text:'红砖'});await expect(search).toHaveValue('红砖');
  await expect(dialog.locator('[data-choice-option]')).toHaveCount(1);
  await expect(dialog.locator('[data-choice-option] strong')).toHaveText('红砖');
  // Editing and selection stay in the existing input as the results refresh.
  await search.press('Home');await search.press('Delete');await expect(search).toHaveValue('砖');
  expect(await search.evaluate(input=>input.selectionStart)).toBe(0);
  await dialog.locator('[data-choice-option]').click();await expect(dialog).not.toBeVisible();
  await expect(win.locator('[data-assign="d1"]')).toHaveValue('bricks');
  await trigger.click();await expect(search).toHaveValue('');await expect(search).toBeFocused();
  await search.press('Escape');await expect(dialog).not.toBeVisible();
  expect(errors).toEqual([]);
  console.log(`${packaged?'Packaged':'Source'} choice input OK: pinyin/initials and spaced syllables, continuous typing, native Chromium IME composition/commit, caret editing, search filtering, recipe selection, reset and Escape; isolated save.`);
} finally {await app.close();}
