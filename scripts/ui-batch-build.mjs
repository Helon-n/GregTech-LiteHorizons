import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const app=await electron.launch({...(packaged?{executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:path.resolve('artifacts','batch-build-'+Date.now())},timeout:60000});
try{
  const win=await app.firstWindow(),errors=[];win.setDefaultTimeout(15000);
  win.on('pageerror',error=>errors.push(error.message));await win.waitForSelector('#page[data-page="overview"]');
  await expect(win.locator('#saveStatus')).toContainText('v'+metadata.version);
  const fixtures=await win.evaluate(async()=>{
    const {Game}=await import('./core/engine.js'),g=new Game();
    g.add(g.buildCost('furnace',8));g.add(g.buildCost('spinmatron1',2));
    const normal=JSON.stringify(g.snapshot());
    g.add(g.buildCost('workbench',499));g.build('workbench',499);
    return {normal,full:JSON.stringify(g.snapshot())};
  });
  await win.addInitScript(()=>{const raw=sessionStorage.getItem('batch-fixture');if(raw)localStorage.setItem('gtnh-long-road-v2',raw);});
  const open=async(type,query)=>{
    await win.locator('.nav [data-page="workshop"]').click();await win.locator('[data-tab="machines"]').click();
    await win.locator('#search').fill(query);await win.locator('[data-book-item="'+type+'"]').click();
  };
  async function fits(){
    const bad=await win.locator('#page button').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.bottom>innerHeight+1||r.right>innerWidth+1;}).map(n=>n.textContent));
    expect(bad,'Construction controls must fit').toEqual([]);
  }
  for(const size of [{width:1440,height:960},{width:1040,height:720}]){
    console.log(`Batch build at ${size.width}×${size.height}`);await win.setViewportSize(size);
    await win.evaluate(raw=>sessionStorage.setItem('batch-fixture',raw),fixtures.normal);await win.reload();await open('furnace','砖炉');
    await win.locator('[data-fill="build:furnace"]').click();await expect(win.locator('[data-build="furnace"]')).toBeEnabled();
    await win.locator('[data-build-step="1"]').click();
    await expect(win.locator('[data-build="furnace"]')).toBeDisabled();
    await expect(win.locator('[data-build-quantity]')).toHaveText('2');
    const totals=await win.locator('.bench-grid [data-slot-item]').evaluateAll(nodes=>nodes.reduce((r,n)=>({...r,[n.dataset.slotItem]:Number(n.dataset.slotTotal)}),{}));
    expect(totals).toEqual({stone:16,clay:8});await fits();
    await win.locator('[data-build-step="5"]').click();await expect(win.locator('[data-build-quantity]')).toHaveText('7');
    await win.locator('[data-build-max]').click();await expect(win.locator('[data-build-quantity]')).toHaveText('8');
    await win.locator('[data-fill="build:furnace"]').click();await win.locator('[data-build="furnace"]').click();
    const state=await win.evaluate(()=>JSON.parse(localStorage.getItem('gtnh-long-road-v2')));
    expect(state.devices.filter(d=>d.type==='furnace').length).toBe(8);expect(state.inventory.stone).toBe(0);expect(state.inventory.clay).toBe(0);
    await expect(win.locator('[data-build="furnace"]')).toBeDisabled();await expect(win.locator('[data-bench-status]')).toContainText('还缺');
    await open('spinmatron1','Spinmatron');
    await win.locator('[data-build-step="1"]').click();await expect(win.locator('[data-build-quantity]')).toHaveText('2');
    const expected=await win.evaluate(async()=>{const {CATALOG}=await import('./data/catalog.js');return Object.fromEntries(Object.entries(CATALOG.machines.spinmatron1.cost).map(([id,n])=>[id,n*2]));});
    const found={};
    for(let i=0;i<Math.ceil(Object.keys(expected).length/9);i++){
      Object.assign(found,await win.locator('.bench-grid [data-slot-item]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.slotItem,Number(n.dataset.slotTotal)]))));
      await fits();if(i+1<Math.ceil(Object.keys(expected).length/9))await win.locator('[data-pagination="bench-structure:build:spinmatron1"] button').last().click();
    }
    expect(found).toEqual(expected);
    await win.evaluate(raw=>sessionStorage.setItem('batch-fixture',raw),fixtures.full);await win.reload();await open('furnace','砖炉');
    await expect(win.locator('[data-build-step="1"]')).toBeDisabled();await win.locator('[data-fill="build:furnace"]').click();
    await win.locator('[data-build="furnace"]').click();await expect(win.locator('[data-build="furnace"]')).toBeDisabled();
    await expect(win.locator('[data-bench-status]')).toContainText('500');await fits();
  }
  expect(errors).toEqual([]);console.log('Batch construction UI OK: totals, quantity controls, full payment, large structures and capacity at two window sizes; isolated saves.');
}catch(error){await (await app.firstWindow()).screenshot({path:'artifacts/batch-build-failure.png',timeout:3000}).catch(()=>{});throw error;}
finally{await app.close();}
