import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const dataDir=path.resolve('artifacts',`item-presentations-${Date.now()}-${process.pid}`);
const app=await electron.launch({...(packaged?{executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:dataDir},timeout:60000});
try{
  const win=await app.firstWindow(),errors=[];win.setDefaultTimeout(12000);
  win.on('pageerror',error=>errors.push(error.message));
  await win.waitForSelector('#page[data-page="overview"]');
  const fixture=await win.evaluate(async()=>{
    const {Game}=await import('./core/engine.js'),g=new Game();
    const recipe=g.catalog.recipes.find(r=>r.inputs.nhItem_UnfiredSearedBrick);
    const item=Object.keys(recipe.outputs)[0];
    g.add({[item]:1,nhItem_UnfiredSearedBrick:2});
    g.add(g.catalog.machines.electricFurnace.cost);const built=g.build('electricFurnace');
    if(!built.ok||!g.assign(built.device.id,recipe.id).ok)throw Error('Cannot prepare furnace fixture');
    return {item,recipeId:recipe.id,save:JSON.stringify(g.snapshot()),favorites:[{key:recipe.id,recipeId:recipe.id,itemId:item,tab:'recipes',mode:'recipes'}]};
  });
  await win.addInitScript(data=>{
    localStorage.setItem('gtnh-long-road-v2',data.save);
    localStorage.setItem('gtnh-recipe-favorites-v1',JSON.stringify(data.favorites));
  },fixture);
  await win.reload();await win.waitForSelector('#page[data-page="overview"]');
  await win.locator('.nav [data-page="workshop"]').click();
  await win.locator('[data-book-view="favorites"]').click();
  const favorite=win.locator(`[data-favorite-open="${fixture.recipeId}"]`);
  await expect(favorite).toContainText('焦黑砖');await favorite.click();
  await expect(win.locator('.bench-heading h2')).toHaveText('焦黑砖');
  await expect(win.locator('.recipe-facts')).toContainText('4 EU/t');
  const images=win.locator('.workbench .bench-layout img');
  await expect(images).toHaveCount(2);
  await expect.poll(()=>images.evaluateAll(nodes=>nodes.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
  await win.locator('[data-bench-view="tree"]').click();
  await expect(win.locator('[data-tree-preview-summary]')).toContainText(/库存快照|部分材料预览/);
  await expect(win.locator('.tree-row').first()).toContainText('焦黑砖');
  await win.locator('.nav [data-page="inventory"]').click();await win.locator('#search').fill('jia o hei zhuan'.replaceAll(' ',''));
  await expect(win.locator(`[data-inventory-item="${fixture.item}"]`)).toContainText('焦黑砖');
  await win.locator('#search').fill('');await win.locator('.nav [data-page="factory"]').click();
  await expect(win.getByRole('region',{name:'电炉',exact:true})).toContainText('焦黑砖');
  await expect(win.getByRole('button',{name:/选择生产配方：焦黑砖/})).toBeVisible();
  expect(errors).toEqual([]);
  console.log('Item presentation UI OK: seared-brick recipe, favorites, actual SVG loading, tree, pinyin inventory search and factory; isolated save.');
}finally{await app.close();}
