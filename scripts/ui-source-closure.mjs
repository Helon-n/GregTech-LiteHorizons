import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import {CATALOG as c} from '../src/data/catalog.js';
import {MAGIC_REFERENCE as magic} from '../src/data/magic-reference.js';

const dataDir=path.resolve('artifacts','source-test-'+Date.now()+'-'+process.pid);
const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const app=await electron.launch({...(packaged?{executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:dataDir},timeout:60000});
try{
  const win=await app.firstWindow(),errors=[];
  win.setDefaultTimeout(15000);win.on('pageerror',error=>errors.push(error.message));
  await win.waitForSelector('#page[data-page="overview"]');
  await expect(win.locator('#saveStatus')).toContainText('v'+metadata.version);
  for(const size of [{width:1440,height:960},{width:1040,height:720}]){
    await win.setViewportSize(size);
    for(const [id,node,missing]of [[magic.resources.prideShard,'netherSinExpedition','恶魔召唤研究笔记'],[magic.resources.soulShard,'demonGruntExpedition','恶魔召唤研究笔记']]){
      await win.locator('.nav [data-page="workshop"]').click();
      await win.locator('[data-tab="recipes"]').click();
      await win.locator('[data-recipe-mode="uses"]').click();
      await win.locator('#search').fill(c.items[id].name);
      const tile=win.locator('[data-book-item="'+id+'"]');
      await tile.click();await tile.hover();await win.keyboard.press('r');
      await expect(win.locator('.workbench')).toContainText('获取地点');
      await win.locator('[data-resource-source="'+node+'"]').click();
      await expect(win.locator('#page')).toHaveAttribute('data-page','space');
      const card=win.locator('[data-node="'+node+'"]');
      await expect(card).toBeVisible();await expect(card).toContainText(missing);
      await expect(card.locator('[data-gather]')).toBeDisabled();
      expect(await card.locator('img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
      const rect=await card.boundingBox();expect(rect.y+rect.height).toBeLessThanOrEqual(size.height);
    }
  }
  expect(errors).toEqual([]);
  console.log('Source navigation OK: primary/secondary exclusive drops, locked research, correct remote page and original icons at 1440×960 / 1040×720; isolated save.');
}finally{await app.close();}
