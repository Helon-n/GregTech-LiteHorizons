import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import {CATALOG} from '../src/data/catalog.js';
import {gatheringRegions} from '../src/core/gathering-browser.js';

const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const app=await electron.launch({...(packaged?{executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:path.resolve('artifacts','region-test-'+Date.now())},timeout:60000});
try{
  const win=await app.firstWindow(),errors=[];
  win.setDefaultTimeout(15000);win.on('pageerror',error=>errors.push(error.message));
  await win.waitForSelector('#page[data-page="overview"]');
  await expect(win.locator('#saveStatus')).toContainText('v'+metadata.version);
  for(const size of [{width:1440,height:960},{width:1040,height:720}]){
    await win.setViewportSize(size);
    for(const key of ['resources','space']){
      console.log(`Checking ${key} regions at ${size.width}×${size.height}`);
      await win.locator('.nav [data-page="'+key+'"]').click();
      while(!await win.locator('[data-region-step="-1"]').isDisabled())await win.locator('[data-region-step="-1"]').click();
      const seen=new Set();
      for(let group=0;group<50;group++){
        const regions=await win.locator('[data-gather-region]').evaluateAll(nodes=>nodes.map(n=>n.dataset.gatherRegion));
        regions.forEach(id=>seen.add(id));
        const active=await win.locator('[data-gather-region][aria-pressed="true"]').getAttribute('data-gather-region');
        const ids=await win.locator('[data-node]').evaluateAll(nodes=>nodes.map(n=>n.dataset.node));
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.every(id=>CATALOG.gatherNodes.find(n=>n.id===id).regions.includes(active))).toBe(true);
        const outside=await win.locator('#page').evaluate(el=>[...el.querySelectorAll('button,[data-node]')].filter(node=>{
          const r=node.getBoundingClientRect();return r.bottom>innerHeight+1||r.right>innerWidth+1||r.top<0;
        }).map(node=>node.textContent.trim().slice(0,80)));
        expect(outside,`${key}/${active} controls must fit`).toEqual([]);
        if(await win.locator('[data-region-step="1"]').isDisabled())break;
        await win.locator('[data-region-step="1"]').click();
      }
      expect([...seen].sort()).toEqual(gatheringRegions(CATALOG,key).map(r=>r.id).sort());
    }
    await win.locator('.nav [data-page="resources"]').click();
    while(!await win.locator('[data-region-step="-1"]').isDisabled())await win.locator('[data-region-step="-1"]').click();
    await win.locator('[data-gather-region="NETHER"]').focus();await win.keyboard.press('Enter');
    await expect(win.locator('[data-gather-region="NETHER"]')).toHaveAttribute('aria-pressed','true');
    await expect(win.locator('[data-region-status]')).toContainText('下界传送门');
    await expect(win.locator('[data-gather-region="NETHER"]')).toBeFocused();
    await win.locator('.nav [data-page="overview"]').click();await win.locator('.nav [data-page="resources"]').click();
    await expect(win.locator('[data-gather-region="NETHER"]')).toHaveAttribute('aria-pressed','true');
  }
  // Check the shipped price display, actual payment, band transition and cap.
  const fixture=await win.evaluate(async()=>{
    const {Game}=await import('./core/engine.js');const g=new Game();
    g.add({ironPlate:9});g.state.collectors.forest={count:9,activeCount:9,enabled:false,elapsed:0};
    return JSON.stringify(g.snapshot());
  });
  await win.addInitScript(raw=>localStorage.setItem('gtnh-long-road-v2',raw),fixture);
  await win.reload();await win.locator('.nav [data-page="resources"]').click();
  await win.locator('[data-node-id="forest"][data-node-view="auto"]').click();
  const cost=win.locator('[data-node="forest"] .collector-cost');
  await expect(cost.locator('[data-ingredient="ironPlate"]')).toHaveAttribute('data-need','4');
  await win.locator('[data-collector="forest"]').click();
  await expect(cost.locator('[data-ingredient="ironPlate"]')).toHaveAttribute('data-need','5');
  await win.locator('[data-collector="forest"]').click();
  const deployed=await win.evaluate(()=>JSON.parse(localStorage.getItem('gtnh-long-road-v2')));
  expect(deployed.inventory.ironPlate??0).toBe(0);expect(deployed.collectors.forest.count).toBe(11);
  expect(deployed.collectors.forest.enabled).toBe(false);
  await expect(cost.locator('[data-ingredient="ironPlate"]')).toHaveAttribute('data-need','5');
  await expect(cost).toContainText('11 台起封顶');
  expect(errors).toEqual([]);
  console.log('Gathering regions OK: every region reachable, real distribution, keyboard selection, remembered region, entry hints and visible controls at both window sizes; isolated save.');
}catch(error){await (await app.firstWindow()).screenshot({path:'artifacts/region-ui-failure.png',timeout:3000}).catch(()=>{});throw error;}
finally{await app.close();}
