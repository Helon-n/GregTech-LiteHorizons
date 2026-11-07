import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const app=await electron.launch({...(packaged?{executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:path.resolve('artifacts','recipe-tree-'+Date.now()+'-'+process.pid)},timeout:60000});
try{
  const win=await app.firstWindow(),errors=[];win.setDefaultTimeout(15000);
  win.on('pageerror',error=>errors.push(error.message));
  await win.waitForSelector('#page[data-page="overview"]');
  const fixture=await win.evaluate(async()=>{
    const {Game}=await import('./core/engine.js'),g=new Game();g.add({wood:2});
    const random=g.catalog.recipes.find(r=>r.incubation);
    const favorites=['ironPlateHand','sticks','stargate',random.id].map(id=>{
      const r=g.recipeById.get(id);return {key:id,recipeId:id,itemId:Object.keys(r.outputs)[0],tab:'recipes',mode:'recipes'};
    });
    return {save:JSON.stringify(g.snapshot()),favorites,randomId:random.id};
  });
  await win.addInitScript(data=>{
    localStorage.setItem('gtnh-long-road-v2',data.save);
    localStorage.setItem('gtnh-recipe-favorites-v1',JSON.stringify(data.favorites));
    window.treeRequests=[];window.treeGap=0;let last=performance.now();
    setInterval(()=>{const now=performance.now();window.treeGap=Math.max(window.treeGap,now-last);last=now;},16);
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker{
      postMessage(data,...rest){window.treeRequests.push({root:data.root,batches:data.batches});return super.postMessage(data,...rest);}
    };
  },fixture);
  await win.reload();await win.waitForSelector('#page[data-page="overview"]');
  await win.locator('.nav [data-page="workshop"]').click();
  await win.locator('[data-book-view="favorites"]').click();
  const open=async id=>{
    await win.locator(`[data-favorite-open="${id}"]`).click();
    await win.locator('[data-bench-view="tree"]').click();
    await expect(win.locator('.recipe-tree')).toHaveAttribute('data-tree-root',id);
  };
  const ready=async()=>expect(win.locator('[data-tree-preview-summary]')).toContainText(/库存快照|部分材料预览/);
  await win.evaluate(()=>window.treeGap=0);
  await open('ironPlateHand');await ready();
  await expect(win.locator('.tree-row').first()).toContainText('铁板');
  const ironGap=await win.evaluate(()=>window.treeGap);
  expect(ironGap,'recipe preview must not freeze the UI heartbeat').toBeLessThan(800);
  console.log('Iron-plate preview UI maximum heartbeat gap: '+Math.round(ironGap)+' ms');
  expect(await win.evaluate(()=>window.treeRequests.some(r=>r.root==='ironPlateHand'))).toBe(true);
  const calls=await win.evaluate(()=>window.treeRequests.length);
  await win.locator('[data-tree-fold="0"]').click();
  await expect(win.locator('.tree-row')).toHaveCount(1);
  await win.locator('[data-tree-fold="0"]').click();
  expect(await win.evaluate(()=>window.treeRequests.length),'folding must reuse the preview').toBe(calls);
  // Change targets while calculation is pending; an old result must not overwrite it.
  await win.evaluate(()=>{
    document.querySelector('[data-tree-action="refresh"]').click();
    document.querySelector('[data-favorite-open="sticks"]').click();
    document.querySelector('[data-bench-view="tree"]').click();
  });
  await ready();await expect(win.locator('.recipe-tree')).toHaveAttribute('data-tree-root','sticks');
  await expect(win.locator('.tree-row').first()).toContainText('木棍');
  await win.locator('[data-tree-amount]').fill('2');await win.locator('[data-tree-amount]').press('Tab');await ready();
  await expect(win.locator('.tree-row').first()).toContainText('本次制作 8');
  // Navigating away during computation must keep the selected page.
  await win.locator('[data-tree-action="refresh"]').click();
  await win.locator('.nav [data-page="inventory"]').click();
  await expect.poll(()=>win.evaluate(()=>document.querySelector('#page').dataset.page)).toBe('inventory');
  await win.locator('.nav [data-page="workshop"]').click();await ready();
  await win.locator('[data-tree-action="start"]').click();
  await expect(win.locator('[data-plan-status]')).toContainText('制作完成');
  // A different target always opens its material tree, not the previous plan tab.
  await open(fixture.randomId);await ready();
  await expect(win.locator('[data-tree-content]')).toContainText('培养箱');
  await expect(win.locator('.tree-row')).not.toHaveCount(0);
  await expect(win.locator('[data-tree-action="start"]')).toBeDisabled();
  await win.setViewportSize({width:1040,height:720});
  await expect(win.locator('.tree-row').first()).toBeVisible();
  await expect.poll(()=>win.locator('.recipe-tree').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1),{message:'direct-input preview must fit the minimum window'}).toBe(true);
  await win.setViewportSize({width:1440,height:960});
  await win.locator('[data-tree-view="steps"]').click();
  await expect(win.locator('[data-tree-content]')).toContainText('暂不能生成完整制作顺序');
  await expect(win.locator('[data-tree-action="start"]')).toBeDisabled();
  await open('stargate');await ready();
  await expect(win.locator('[data-tree-content]')).toContainText('保留已展开的材料');
  await expect(win.locator('.tree-row')).not.toHaveCount(0);
  await expect(win.locator('[data-tree-action="start"]')).toBeDisabled();
  await win.setViewportSize({width:1040,height:720});
  await expect(win.locator('.tree-row').first()).toBeVisible();
  await expect.poll(()=>win.locator('.recipe-tree').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1),{message:'partial preview must fit the minimum window'}).toBe(true);
  await win.setViewportSize({width:1440,height:960});
  // A natural-only ingredient still exposes locked locations and their requirements.
  const natural=await win.evaluate(async()=>{
    const {MAGIC_REFERENCE}=await import('./data/magic-reference.js');return MAGIC_REFERENCE.resources.prideShard;
  });
  await win.locator('[data-tab="recipes"]').click();await win.locator('[data-book-view="items"]').click();
  await win.locator('[data-recipe-mode="uses"]').click();await win.locator('#search').fill(natural);
  const tile=win.locator(`[data-book-item="${natural}"]`);await tile.click();await tile.hover();await win.keyboard.press('r');
  await win.locator('[data-bench-view="tree"]').click();
  await expect(win.locator('[data-tree-content]')).toContainText('恶魔召唤研究笔记');
  await expect(win.locator('[data-tree-action="start"]')).toBeDisabled();
  await win.locator('[data-resource-source="netherSinExpedition"]').click();
  await expect(win.locator('#page')).toHaveAttribute('data-page','space');
  expect(errors).toEqual([]);
  console.log(`${packaged?'Packaged':'Source'} recipe tree OK: real module worker, responsive iron-plate preview, fold cache, stale requests, batch edits, page switching, actual plan completion, unsupported and bounded previews, locked gathering sources; isolated save.`);
}catch(error){
  const win=await app.firstWindow();
  console.log(JSON.stringify(await win.locator('.recipe-tree').evaluate(el=>({height:innerHeight,panel:el.getBoundingClientRect().toJSON(),parts:[...el.children].map(n=>({tag:n.className,bounds:n.getBoundingClientRect().toJSON()}))}))));
  throw error;
}finally{await app.close();}
