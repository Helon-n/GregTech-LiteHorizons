import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const dataDir=path.resolve('artifacts','search-'+Date.now()+'-'+process.pid);
const app=await electron.launch({...(packaged?{executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:dataDir},timeout:60000});
try{
  const win=await app.firstWindow(),errors=[];win.setDefaultTimeout(10000);win.on('pageerror',error=>errors.push(error.message));
  await win.waitForSelector('#page[data-page="overview"]');
  await expect(win.locator('#saveStatus')).toContainText('v'+metadata.version);
  const fixture=await win.evaluate(async()=>{
    const {Game}=await import('./core/engine.js');const g=new Game();
    for(let i=0;i<2;i++){g.add(g.catalog.machines.furnace.cost);if(!g.build('furnace').ok)throw Error('Fixture construction failed');}
    if(!g.renameDevice('d1','红砖一号炉').ok)throw Error('Fixture rename failed');
    g.add({iron:2,brick:3});return JSON.stringify(g.snapshot());
  });
  await win.addInitScript(value=>localStorage.setItem('gtnh-long-road-v2',value),fixture);
  await win.reload();await win.waitForSelector('#page[data-page="overview"]');
  await win.locator('.nav [data-page="workshop"]').click();
  const search=win.locator('#search');
  for(const query of ['suishigao','ssg','sui shi gao']){
    await search.fill(query);await expect(win.locator('[data-book-item="flintPick"]')).toBeVisible();
    await expect(win.locator('.recipe-book .section-head span')).toHaveText('1 项');
  }
  await win.locator('[data-book-item="flintPick"]').click();await win.locator('[data-favorite-toggle]').click();
  await search.fill('SSG');await expect(win.locator('[data-favorite-open]')).toContainText('燧石镐');
  await search.fill('zzzz-no-match');await expect(win.locator('.recipe-favorite-list')).toContainText('没有匹配');
  await win.locator('.nav [data-page="inventory"]').click();
  for(const query of ['tieding','td','iron','铁锭']){
    await search.fill(query);await expect(win.locator('[data-inventory-item="iron"]')).toBeVisible();
    await expect(win.locator('[data-inventory-item="brick"]')).toHaveCount(0);
  }
  await search.fill('');await expect(win.locator('[data-inventory-item="brick"]')).toBeVisible();
  await win.locator('.nav [data-page="factory"]').click();await win.locator('[data-create-group="device"]').click();
  const group=win.locator('#groupDialog');
  for(const query of ['hongzhuan','hz']){
    await group.locator('[data-group-query]').fill(query);
    await expect(group.locator('[data-group-member]')).toHaveCount(1);
    await expect(group.locator('[data-group-member="d1"]')).toContainText('红砖一号炉');
  }
  await group.locator('[data-group-close]').click();expect(errors).toEqual([]);
  console.log(`${packaged?'Packaged':'Source'} search UI OK: full pinyin/initials in workbench, favorites, inventory and aliased group members; Chinese/English/ID search and clear/no-match preserved; isolated save.`);
}finally{await app.close();}
