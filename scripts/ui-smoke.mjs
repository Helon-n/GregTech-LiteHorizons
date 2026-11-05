import {chromium,expect} from '@playwright/test';

const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  page.on('pageerror',e=>errors.push('page: '+e.message));
  const go=async name=>page.locator(`[data-page="${name}"]`).first().click();
  const clickNode=async(id,count)=>{for(let i=0;i<count;i++)await page.locator(`[data-gather="${id}"]`).click();};
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.screenshot({path:'artifacts/ui-overview.png',fullPage:true});
  for(const name of ['resources','workshop','factory','inventory','research','space','reference','settings']){
    await go(name);await expect(page.locator('#page')).not.toBeEmpty();
  }

  await go('resources');
  await page.locator('[data-gather-hit="forest"]').click();
  await page.waitForTimeout(2300);
  await expect(page.locator('[data-qty="wood"]')).toHaveText('0');
  await expect(page.locator('[data-click-progress="forest"]')).toHaveText('1 / 4 次点击');
  await clickNode('river',1);await clickNode('forest',3);
  await expect(page.locator('[data-qty="wood"]')).toHaveText('2');
  await expect(page.locator('[data-last-drops]')).toContainText('黏性树脂');
  await expect(page.locator('[data-drop-layer="forest"] .floating-drop')).toHaveCount(2);
  await page.waitForTimeout(130);await page.screenshot({path:'artifacts/ui-gather-drops.png',fullPage:true});
  await clickNode('surface',4);await clickNode('river',3);
  await expect(page.locator('[data-qty="clay"]')).toHaveText('2');
  await go('inventory');
  for(const name of ['原木','黏性树脂','圆石','燧石','沙砾','黏土','沙子','水'])await expect(page.locator('#page')).toContainText(name);

  await go('workshop');
  await expect(page.locator('.bench-grid > .bench-slot')).toHaveCount(9);
  await expect(page.locator('.recipe-card')).toHaveCount(0);
  await expect(page.locator('[data-craft="sticks"][data-count="1"]')).toBeDisabled();
  await page.locator('[data-fill="sticks"]').click();
  await expect(page.locator('[data-craft="sticks"][data-count="1"]')).toBeEnabled();
  await page.locator('[data-craft="sticks"][data-count="1"]').click();
  await expect(page.locator('#queuePanel')).toContainText('拆分木棍');
  await expect(page.locator('#queuePanel')).toContainText('队列为空',{timeout:3000});
  await page.locator('[data-select-recipe="pick"]').click();
  await expect(page.locator('[data-fill="pick"]')).toBeDisabled();
  await expect(page.locator('[data-bench-status]')).toContainText('燧石');
  await go('resources');await clickNode('surface',8);
  await go('workshop');await page.locator('[data-select-recipe="pick"]').click();
  await expect(page.locator('.bench-grid [data-slot-item="flint"]')).toHaveCount(3);
  await expect(page.locator('.bench-grid [data-slot-item="stick"]')).toHaveCount(2);
  await page.locator('[data-fill="pick"]').click();
  await page.screenshot({path:'artifacts/ui-workbench.png',fullPage:true});
  // A search never replaces the selected recipe or shows full recipes in the book.
  await page.locator('#search').fill('木棍');await page.waitForTimeout(250);
  await expect(page.locator('[data-bench-recipe]')).toHaveAttribute('data-bench-recipe','pick');
  await page.locator('#search').fill('');await page.waitForTimeout(250);
  await page.locator('[data-craft="pick"][data-count="1"]').click();
  await expect(page.locator('#queuePanel')).toContainText('队列为空',{timeout:5000});
  await go('inventory');await expect(page.locator('#page')).toContainText('燧石镐');
  await go('settings');await page.screenshot({path:'artifacts/ui-settings.png',fullPage:true});

  // Clearly isolated browser fixture for construction and machine configuration.
  const fixture=await page.evaluate(async()=>{const {Game}=await import('/core/engine.js');const g=new Game();g.add({stone:20,clay:20,coal:20});return JSON.stringify(g.snapshot());});
  await page.addInitScript(value=>localStorage.setItem('gtnh-long-road-v2',value),fixture);
  await page.reload({waitUntil:'networkidle'});await go('workshop');
  await page.locator('[data-tab="machines"]').click();await page.locator('[data-select-recipe="build:furnace"]').click();
  await expect(page.locator('[data-build="furnace"]')).toBeDisabled();
  await page.locator('[data-fill="build:furnace"]').click();await page.locator('[data-build="furnace"]').click();
  await go('factory');await page.locator('[data-assign]').selectOption('bricks');
  await page.waitForTimeout(5300);await expect(page.locator('[data-device-state]').first()).not.toHaveText('请选择配方');
  await page.screenshot({path:'artifacts/ui-factory.png',fullPage:true});
  await page.setViewportSize({width:1040,height:720});
  for(const name of ['overview','resources','workshop','factory','research']){
    await go(name);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow at 1040px: '+name);
    if(name==='workshop')await page.screenshot({path:'artifacts/ui-workbench-1040.png',fullPage:true});
  }
  if(errors.length)throw Error(errors.join('\n'));
  console.log('UI smoke OK: click-only progress, drops, recipe book, workbench, missing materials, crafting, construction, machines, 1040px layout');
}finally{await browser.close();}
