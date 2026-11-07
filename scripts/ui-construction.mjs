import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

// Isolated regression against the selected source or unpacked application.
const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const app=await electron.launch({...(packaged?{executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:path.resolve('artifacts','construction-test-'+Date.now())},timeout:60000});
try{
  const page=await app.firstWindow(),errors=[];
  page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.waitForSelector('#page[data-page="overview"]');
  await expect(page.locator('#saveStatus')).toContainText('v'+metadata.version);
  const fixture=await page.evaluate(async()=>{
    const {Game}=await import('./core/engine.js'),g=new Game();
    const structures=Object.values(g.catalog.machines).filter(m=>Object.keys(m.cost).length>9);
    for(const m of structures)g.add(m.cost);
    return {save:JSON.stringify(g.snapshot()),structures:structures.map(m=>({id:m.id,name:m.name,cost:m.cost}))};
  });
  await page.addInitScript(save=>localStorage.setItem('gtnh-long-road-v2',save),fixture.save);
  await page.reload();await page.waitForSelector('#page[data-page="overview"]');
  await page.locator('.nav [data-page="workshop"]').click();
  await page.locator('[data-tab="machines"]').click();
  for(const viewport of [{width:1440,height:960},{width:1040,height:720}]){
    await page.setViewportSize(viewport);
    for(const m of fixture.structures){
      await page.locator('#search').fill(m.name);
      await page.locator(`[data-book-item="${m.id}"]`).click();
      const bench=page.locator(`[data-bench-recipe="build:${m.id}"]`);
      await expect(bench).toBeVisible();
      await expect(bench.locator('.bench-grid > .bench-slot')).toHaveCount(9);
      const previous=bench.locator(`[data-pagination="bench-structure:build:${m.id}"] button`).first();
      if(await previous.isEnabled())await previous.click();
      const costs={};
      for(let index=0;index<Math.ceil(Object.keys(m.cost).length/9);index++){
        const slots=await bench.locator('.bench-grid [data-slot-item]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.slotItem,Number(n.dataset.slotTotal)]));
        for(const [id,count]of slots){assert.equal(costs[id],undefined,'material repeated across pages: '+id);costs[id]=count;}
        if(index+1<Math.ceil(Object.keys(m.cost).length/9))await bench.locator(`[data-pagination="bench-structure:build:${m.id}"] button`).last().click();
      }
      assert.deepEqual(costs,m.cost,m.id+' must show its full structure cost');
      await expect(bench.locator(`[data-build="${m.id}"]`)).toBeDisabled();
      const outside=await bench.evaluate(el=>[...el.querySelectorAll('.bench-slot,button')].filter(n=>!n.disabled).some(n=>{const b=n.getBoundingClientRect();return b.right>innerWidth+1||b.bottom>innerHeight+1||b.left<0;}));
      assert.equal(outside,false,`${m.id} controls overflow at ${viewport.width}`);
    }
  }
  const target=fixture.structures.find(m=>m.id==='spinmatron1');
  await page.locator('#search').fill(target.name);
  await page.locator(`[data-book-item="${target.id}"]`).click();
  await page.locator(`[data-fill="build:${target.id}"]`).click();
  await expect(page.locator(`[data-build="${target.id}"]`)).toBeEnabled();
  await page.locator(`[data-build="${target.id}"]`).click();
  await page.locator('.nav [data-page="factory"]').click();
  await expect(page.locator(`[data-factory-type="${target.id}"]`)).toBeVisible();
  assert.deepEqual(errors,[]);
  console.log(`${packaged?'Packaged':'Source'} construction UI OK: ${fixture.structures.length} large structures, full costs across pages at 1440×960 / 1040×720, chapter-zero construction and factory navigation`);
}finally{await app.close();}
