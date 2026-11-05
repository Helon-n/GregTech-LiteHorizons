import {chromium,expect} from '@playwright/test';
import {Game} from '../src/core/engine.js';
import {pickOption} from './ui-controls.mjs';

const g=new Game();g.state.stage=15;
const build=(type,recipe)=>{g.add(g.catalog.machines[type].cost);const {device}=g.build(type);if(recipe)g.assign(device.id,recipe);return device;};
const place=(fluid,amount=0)=>{g.add({largeTank:1});const {container}=g.placeContainer('largeTank');g.reserveContainer(container.id,fluid);g.add({[fluid]:amount});return container.id;};
const box=build('batteryBuffer'),gas=build('gasTurbine','gasPower'),assembler=build('assembler'),boiler=build('boiler','steam'),grinder=build('steamMacerator','copperGrind');
const hydrogen=place('hydrogen',10000),steam=place('steam'),water=place('water',10000);
g.setSupply(gas.id,'storage',hydrogen);g.add({batteryLV:1,coal:20,copperOre:5,basicCircuit:20,silicon:20,copperWire:40});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let checks=0;
try{
  const page=await browser.newPage({viewport:{width:1040,height:680}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(snapshot=>localStorage.setItem('gtnh-long-road-v2',JSON.stringify({...snapshot,lastSeen:Date.now()})),g.snapshot());
  await page.goto('http://127.0.0.1:4173/');await page.locator('.nav [data-page="factory"]').click();
  async function type(id){
    const first=page.locator('[data-pagination="machine-types"] button').first();if(await first.count()&&!await first.isDisabled())await first.click();
    for(let i=0;i<20&&!await page.locator(`[data-factory-type="${id}"]`).count();i++)await page.locator('[data-pagination="machine-types"] button').last().click();
    await page.locator(`[data-factory-type="${id}"]`).click();
  }
  async function fit(label){
    const issues=await page.evaluate(()=>[...document.querySelectorAll('#page,.device-card,#page button')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]')).flatMap(el=>{
      const r=el.getBoundingClientRect();return r.bottom>innerHeight+1||r.right>innerWidth+1||el.scrollWidth>el.clientWidth+3||el.scrollHeight>el.clientHeight+3?[el.outerHTML.slice(0,180)]:[];
    }));
    if(issues.length)await page.screenshot({path:'artifacts/energy-ui-failure.png'});
    expect(issues,label).toEqual([]);checks++;
  }
  await type('batteryBuffer');await expect(page.locator('[data-device-energy]')).toContainText('0 / 4 格');
  await pickOption(page,`[data-energy-source="${box.id}"]`,gas.id);
  await page.waitForTimeout(600);await expect(page.locator('[data-device-energy]')).toContainText('0 / 4 格');
  await page.locator(`[data-battery-in="${box.id}"]`).click();
  await expect(page.locator('.battery-slot.occupied')).toHaveCount(1);
  await expect.poll(()=>page.locator('[data-device-energy]').innerText()).not.toMatch(/^0 \/ /);
  await fit('battery controls at 1040x680');
  await type('assembler');await pickOption(page,`[data-assign="${assembler.id}"]`,'goodCircuit');
  await page.locator(`[data-device-view="${assembler.id}"][data-view="energy"]`).click();
  await pickOption(page,`[data-energy-source="${assembler.id}"]`,box.id);
  await expect(page.locator(`[data-device-state="${assembler.id}"]`)).toHaveText('运行中');
  await page.locator(`[data-energy-mode="${assembler.id}"][data-mode="direct"]`).click();
  await pickOption(page,`[data-energy-source="${assembler.id}"]`,gas.id);await fit('direct supply controls');
  await type('boiler');await page.locator(`[data-device-view="${boiler.id}"][data-view="energy"]`).click();
  await page.locator(`[data-load-coal="${boiler.id}"][data-count="1"]`).click();
  await pickOption(page,`[data-steam-output="${boiler.id}"]`,steam);await fit('boiler controls');
  await type('steamMacerator');await page.locator(`[data-device-view="${grinder.id}"][data-view="energy"]`).click();
  await page.locator(`[data-energy-mode="${grinder.id}"][data-mode="direct"]`).click();
  await pickOption(page,`[data-energy-source="${grinder.id}"]`,boiler.id);await fit('direct steam controls');
  for(const [width,height] of [[1280,720],[1440,960],[2560,1440]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(180);
    for(const id of ['batteryBuffer','gasTurbine','assembler','boiler','steamMacerator']){await type(id);await fit(`${width}x${height} ${id}`);}
  }
  await type('batteryBuffer');await page.screenshot({path:'artifacts/energy-battery.png'});
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('gtnh-long-road-v2')));
  const restored=new Game(save);expect(restored.state.devices.find(d=>d.id===box.id).batteries).toBe(1);
  expect(restored.state.devices.find(d=>d.id===assembler.id).supply).toEqual({mode:'direct',source:gas.id});
  expect(restored.state.inventory.coal).toBe(19);expect(restored.state.devices.find(d=>d.id===boiler.id).output).toBe(steam);
  expect(errors).toEqual([]);console.log(`Energy UI OK: ${checks} layout checks; battery installation/charging, direct/storage electric supply, coal loading, tank output and direct steam, persisted network.`);
}finally{await browser.close();}
