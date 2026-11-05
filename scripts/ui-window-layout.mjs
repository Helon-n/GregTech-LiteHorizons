import {chromium,expect} from '@playwright/test';
import {Game} from '../src/core/engine.js';
import {items,machines,recipes,gatherNodes} from '../src/data/catalog.js';
import {pickOption,revealResource} from './ui-controls.mjs';

const game=new Game();game.state.stage=15;
game.add(Object.fromEntries(Object.values(items).filter(i=>i.kind!=='fluid').map(i=>[i.id,100000])));
for(const type of Object.keys(machines)){
  const recipe=recipes.find(r=>machines[type].processes.includes(r.process));
  for(let i=0;i<2;i++){
    const built=game.build(type);expect(built.ok).toBe(true);
    if(recipe)game.assign(built.device.id,recipe.id);
    game.toggle(built.device.id);
  }
}
const idle=game.build('furnace').device;game.toggle(idle.id);
for(let i=0;i<8;i++)game.placeContainer('largeTank');
for(const node of gatherNodes){
  game.buildCollector(node.id);game.buildCollector(node.id);
  if(game.state.collectors[node.id])game.state.collectors[node.id].enabled=false;
}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let checks=0;
try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(raw=>{
    localStorage.setItem('gtnh-long-road-v2',JSON.stringify({...raw,lastSeen:Date.now()}));
    localStorage.setItem('glh-voltage-appearance','ULV');
  },game.snapshot());
  const go=name=>page.locator(`.nav [data-page="${name}"]`).click();
  async function fit(label){
    const bad=await page.evaluate(()=>{
      const bad=[];
      for(const el of document.querySelectorAll('#page, #page article, #page .workbench, #page .recipe-book, #page .section, dialog[open]')){
        if(el.scrollHeight>el.clientHeight+3||el.scrollWidth>el.clientWidth+3)bad.push(`${el.id||el.className}: ${el.scrollHeight}/${el.clientHeight}, ${el.scrollWidth}/${el.clientWidth}`);
      }
      for(const el of document.querySelectorAll('#page button,#page input,dialog[open] button,dialog[open] input')){
        if(!el.getClientRects().length||el.closest('[hidden]'))continue;
        const r=el.getBoundingClientRect();
        if(r.bottom>innerHeight+1||r.right>innerWidth+1||r.top<0)bad.push(el.textContent.trim().slice(0,30));
      }
      return bad;
    });
    if(bad.length)await page.screenshot({path:'artifacts/window-layout-failure.png'});
    expect(bad,label).toEqual([]);checks++;
  }
  for(const [width,height] of [[1040,680],[1280,720],[1440,960],[1920,1080],[2048,1090],[2560,1440]]){
    await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:4173/');
    for(const name of ['overview','resources','workshop','factory','inventory','research','space','settings']){
      await go(name);await fit(`${width}x${height} ${name}`);
      if(name==='resources'){
        if(width===2048){
          expect(await page.locator('[data-node]').count()).toBeGreaterThan(4);
          expect(await page.locator('.fitted-cards').evaluate(el=>innerHeight-el.getBoundingClientRect().bottom)).toBeLessThan(100);
          await page.screenshot({path:'artifacts/window-resources.png'});
        }
        const ids=await page.locator('[data-node]').evaluateAll(nodes=>nodes.map(n=>n.dataset.node));
        for(const id of ids){await revealResource(page,id);await page.locator(`[data-node-id="${id}"][data-node-view="auto"]`).click();}
        await fit(`${width}x${height} automatic collectors`);
        const first=ids[0];
        await revealResource(page,first);await page.locator(`[data-node-id="${first}"][data-node-view="auto"]`).click();
        await page.locator(`[data-worker-node="${first}"][data-worker-count="1"]`).first().click();
        expect(await page.evaluate(id=>JSON.parse(localStorage.getItem('gtnh-long-road-v2')).collectors[id].activeCount,first)).toBe(1);
      }
      if(name==='factory'){
        await page.locator('[data-factory-type="furnace"]').click();
        await expect(page.locator('[data-device-stack^="furnace-bricks-"]')).toHaveCount(1);
        await expect(page.locator('[data-stack-status]')).not.toHaveCount(0);
        await page.locator('[data-factory-type="furnace"]').click();
        await page.locator('[data-expand-stack^="furnace-bricks-"]').click();
        await fit(`${width}x${height} expanded devices`);
        await page.locator('[data-expand-stack^="furnace-bricks-"]').click();
        await page.locator(`[data-assign="${idle.id}"]+button`).click();
        await expect(page.locator('.choice-option .choice-art img').first()).toBeVisible();
        await fit(`${width}x${height} recipe cards`);
        await page.locator('[data-close-choice]').click();
      }
      if(name==='inventory'){
        await page.locator('[data-inventory-tab="containers"]').click();await fit(`${width}x${height} tanks`);
        const id=await page.locator('[data-container]').first().getAttribute('data-container');
        await pickOption(page,`[data-container-reserve="${id}"]`,'steam');
        await expect(page.locator(`[data-container-fluid="${id}"]`)).toHaveText('蒸汽');
        await page.locator(`[data-transfer-target="${id}"]+button`).click();await fit(`${width}x${height} container cards`);
        await page.locator('[data-close-choice]').click();
      }
    }
  }
  // Resize the same open page; density must change without restarting/navigation.
  await go('resources');await page.setViewportSize({width:1280,height:720});
  await expect(page.locator('[data-node]')).toHaveCount(2);
  const compactCount=await page.locator('[data-node]').count();
  await page.setViewportSize({width:2048,height:1090});await expect.poll(()=>page.locator('[data-node]').count()).toBeGreaterThan(compactCount);
  await fit('live resize');
  expect(errors).toEqual([]);
  console.log(`Window layout OK: ${checks} viewport/interaction checks, automatic factory grouping, icon cards, worker controls and live resize.`);
}finally{await browser.close();}
