import {revealResource,pickOption,checkLastDrop} from './ui-controls.mjs';
import {chromium,expect} from '@playwright/test';

const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  page.on('pageerror',e=>errors.push('page: '+e.message));
  const go=async name=>{await page.locator(`[data-page="${name==='fluids'?'inventory':name}"]`).first().click();if(name==='fluids'||name==='inventory')await page.locator(`[data-inventory-tab="${name==='fluids'?'containers':'items'}"]`).click();};
  const clickNode=async(id,count)=>{await revealResource(page,id);for(let i=0;i<count;i++)await page.locator(`[data-gather="${id}"]`).click();};
  const stock=async(id,amount,node)=>{
    for(let i=0;i<100;i++){
      // Resource cards show the main output only; check byproducts in storage.
      await go('inventory');
      const quantity=page.locator(`[data-inventory-item="${id}"] [data-qty]`);
      const have=await quantity.count()?Number((await quantity.innerText()).replaceAll(',','')):0;
      await go('resources');
      if(have>=amount)return;
      await clickNode(node,4);
    }
    throw Error('Insufficient gathered material: '+id);
  };
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.screenshot({path:'artifacts/ui-overview.png',fullPage:true});
  for(const name of ['resources','workshop','factory','inventory','fluids','research','space','settings']){
    await go(name);await expect(page.locator('#page')).not.toBeEmpty();
  }

  await go('resources');
  await page.locator('[data-gather-hit="forest"]').click();
  await page.waitForTimeout(2300);
  await expect(page.locator('[data-qty="wood"]')).toHaveText('0');
  await expect(page.locator('[data-click-progress="forest"]')).toHaveText('1 / 4 次点击');
  await clickNode('river',1);await clickNode('forest',3);
  await expect(page.locator('[data-qty="wood"]')).toHaveText(/^[1-3]$/);
  await checkLastDrop(page,expect,'原木');
  expect(await page.locator('[data-drop-layer="forest"] .floating-drop').count()).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(130);await page.screenshot({path:'artifacts/ui-gather-drops.png',fullPage:true});
  await clickNode('surface',4);await clickNode('river',3);
  await expect(page.locator('[data-qty="clay"]')).toHaveText(/^[1-3]$/);
  await go('inventory');
  for(const name of ['原木','圆石','黏土','沙子'])await expect(page.locator('#page')).toContainText(name);

  await go('workshop');
  await expect(page.locator('.bench-grid > .bench-slot')).toHaveCount(9);
  await expect(page.locator('.recipe-card')).toHaveCount(0);
  await expect(page.locator('[data-craft="sticks"][data-count="1"]')).toBeDisabled();
  await page.locator('[data-fill="sticks"]').click();
  await expect(page.locator('[data-craft="sticks"][data-count="1"]')).toBeEnabled();
  await page.locator('[data-craft="sticks"][data-count="1"]').click();
  await expect(page.locator('[data-queue-count]')).toHaveText('1');
  await expect(page.locator('[data-queue-count]')).toHaveText('0',{timeout:3000});
  await page.locator('[data-book-item="flintPick"]').click();
  await expect(page.locator('[data-fill="pick"]')).toBeDisabled();
  await expect(page.locator('[data-bench-status]')).toContainText('燧石');
  await go('resources');await stock('flint',3,'surface');
  await go('workshop');await page.locator('[data-book-item="flintPick"]').click();
  await expect(page.locator('.bench-grid [data-slot-item="flint"]')).toHaveCount(3);
  await expect(page.locator('.bench-grid [data-slot-item="stick"]')).toHaveCount(2);
  await page.locator('[data-fill="pick"]').click();
  await page.screenshot({path:'artifacts/ui-workbench.png',fullPage:true});
  // A search never replaces the selected recipe or shows full recipes in the book.
  await page.locator('#search').fill('木棍');await page.waitForTimeout(250);
  await expect(page.locator('[data-bench-recipe]')).toHaveAttribute('data-bench-recipe','pick');
  await page.locator('#search').fill('');await page.waitForTimeout(250);
  await page.locator('[data-craft="pick"][data-count="1"]').click();
  await expect(page.locator('[data-queue-count]')).toHaveText('0',{timeout:5000});
  await go('inventory');await expect(page.locator('#page')).toContainText('燧石镐');
  // NEI-style product names and recipe/usage lookup via keyboard and ingredients.
  await go('workshop');await page.locator('[data-book-item="stick"]').hover();await page.keyboard.press('u');
  await expect(page.locator('[data-recipe-mode="uses"]')).toHaveClass(/active/);
  await expect(page.locator('.bench-heading h2')).toHaveText('燧石镐');
  await page.locator('.bench-grid [data-lookup-item="flint"]').first().click();
  await expect(page.locator('.workbench')).toContainText('获取地点：地表石层');
  await page.locator('[data-book-item="stick"]').hover();await page.keyboard.press('r');
  await expect(page.locator('.bench-heading h2')).toHaveText('木棍');
  await expect(page.locator('.recipe-book')).not.toContainText('制作');

  // Craft, enable and fill a bucket; there is no loose water inventory item.
  await go('resources');await stock('wood',3,'forest');
  await go('workshop');await page.locator('[data-tab="craft"]').click();await page.locator('#search').fill('木桶');await page.locator('[data-book-item="woodBucket"]').click();await page.locator('#search').fill('');
  await page.locator('[data-fill="woodBucket"]').click();await page.locator('[data-craft="woodBucket"][data-count="1"]').click();
  await expect(page.locator('[data-queue-count]')).toHaveText('0',{timeout:4000});
  await go('fluids');await page.locator('[data-container-view="catalog"]').click();await page.locator('[data-place-container="woodBucket"]').click();
  await expect(page.locator('[data-container-view="catalog"]')).toHaveClass(/active/);await page.locator('[data-container-view="placed"]').click();await expect(page.locator('[data-container]')).toHaveCount(1);
  await go('resources');await clickNode('river',4);
  await go('fluids');await expect(page.locator('[data-container-amount]')).toHaveText('1,000');
  await expect(page.locator('[data-container-reserve]')).toBeDisabled();
  await expect(page.locator('[data-remove-container]')).toBeDisabled();
  await page.screenshot({path:'artifacts/ui-fluid-bucket.png',fullPage:true});
  await go('inventory');await expect(page.locator('[data-inventory-item="water"]')).toHaveCount(0);
  await go('settings');await page.screenshot({path:'artifacts/ui-settings.png',fullPage:true});

  // Clearly isolated browser fixture for construction and machine configuration.
  const fixture=await page.evaluate(async()=>{const {Game}=await import('/core/engine.js');const g=new Game();g.add({stone:20,clay:20,coal:20});return JSON.stringify(g.snapshot());});
  await page.addInitScript(value=>localStorage.setItem('gtnh-long-road-v2',value),fixture);
  await page.reload({waitUntil:'networkidle'});await go('workshop');
  await page.locator('[data-tab="machines"]').click();await page.locator('[data-book-item="furnace"]').click();
  await expect(page.locator('[data-build="furnace"]')).toBeDisabled();
  await page.locator('[data-fill="build:furnace"]').click();await page.locator('[data-build="furnace"]').click();
  await go('factory');await pickOption(page,'[data-assign="d1"]','bricks');
  await page.waitForTimeout(5300);await expect(page.locator('[data-device-state]').first()).not.toHaveText('请选择配方');
  await page.screenshot({path:'artifacts/ui-factory.png',fullPage:true});
  await page.setViewportSize({width:1040,height:720});
  for(const name of ['overview','resources','workshop','factory','fluids','research']){
    await go(name);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow at 1040px: '+name);
    if(name==='workshop')await page.screenshot({path:'artifacts/ui-workbench-1040.png',fullPage:true});
  }
  // Independent hot boiler fixture: surplus remains inside until tank transfer makes room.
  const steamFixture=await page.evaluate(async()=>{
    const {Game}=await import('/core/engine.js');const g=new Game();g.state.stage=1;
    g.add({woodBucket:1,fluidTank:2,bronzePlate:6,brick:6,coal:3});
    g.placeContainer('woodBucket');g.placeContainer('fluidTank');g.placeContainer('fluidTank');
    g.reserveContainer('c2','steam');g.reserveContainer('c3','oil');g.add({water:1000,steam:64000});
    const {device}=g.build('boiler');g.assign(device.id,'steam');g.setSteamOutput(device.id,'c2');
    Object.assign(device,{temperature:500,water:1000,steam:16000,startupTicks:0});return JSON.stringify(g.snapshot());
  });
  const context=await browser.newContext({viewport:{width:1040,height:720}});
  await context.addInitScript(value=>localStorage.setItem('gtnh-long-road-v2',value),steamFixture);
  const steamPage=await context.newPage();steamPage.on('pageerror',e=>errors.push(e.message));
  await steamPage.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await steamPage.locator('[data-page="factory"]').first().click();
  await expect(steamPage.locator('[data-machine-readout]')).toContainText('°C');
  await steamPage.locator('[data-page="inventory"]').first().click();await steamPage.locator('[data-inventory-tab="containers"]').click();
  await steamPage.locator('[data-pagination="fluids"] button').last().click();
  await pickOption(steamPage,'[data-container-reserve="c3"]','');
  await steamPage.locator('[data-pagination="fluids"] button').first().click();
  await pickOption(steamPage,'[data-transfer-target="c2"]','c3');await steamPage.locator('[data-transfer="c2"]').click();
  await steamPage.locator('[data-pagination="fluids"] button').last().click();
  await expect(steamPage.locator('[data-container-amount="c3"]')).toHaveText('64.0k');
  await steamPage.locator('[data-pagination="fluids"] button').first().click();
  await expect.poll(async()=>{
    const value=await steamPage.locator('[data-container-amount="c2"]').innerText();return parseFloat(value.replaceAll(',',''))*(value.endsWith('k')?1000:1);
  }).toBeGreaterThan(10000);
  if(await steamPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Container overflow at 1040px');
  await steamPage.screenshot({path:'artifacts/ui-fluid-tanks-1040.png',fullPage:true});
  await steamPage.locator('[data-page="workshop"]').first().click();await steamPage.locator('[data-tab="recipes"]').click();
  await steamPage.locator('#search').fill('铜板');
  await steamPage.locator('[data-book-item="copperPlate"]').click();
  await expect(steamPage.locator('[data-recipe-step="1"]')).toBeEnabled();
  const first=await steamPage.locator('[data-bench-recipe]').getAttribute('data-bench-recipe');
  await steamPage.locator('[data-recipe-step="1"]').click();
  await expect(steamPage.locator('[data-bench-recipe]')).not.toHaveAttribute('data-bench-recipe',first);
  await steamPage.screenshot({path:'artifacts/ui-nei-machine-recipe.png',fullPage:true});
  await context.close();
  if(errors.length)throw Error(errors.join('\n'));
  console.log('UI smoke OK: NEI item recipes/usages, recipe navigation, click gathering, bucket storage, boiler surplus and tank transfer, construction, 1040px layout');
}finally{await browser.close();}
