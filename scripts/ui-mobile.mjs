import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {revealResource} from './ui-controls.mjs';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
await fs.mkdir('artifacts/mobile',{recursive:true});
const errors=[];
async function fit(page,label){
  const outside=await page.locator('#page').evaluate(root=>{
    const boundary=root.getBoundingClientRect();
    return [...root.querySelectorAll('button,input,.surface')].filter(el=>el.getClientRects().length&&!el.closest('[hidden],.machine-categories')).map(el=>({text:el.textContent.trim().slice(0,50),rect:el.getBoundingClientRect()})).filter(({rect})=>rect.right>boundary.right+1||rect.bottom>boundary.bottom+1).map(({text,rect})=>({text,right:rect.right,bottom:rect.bottom}));
  });
  if(outside.length){await page.screenshot({path:'artifacts/mobile/failure.png'});console.log(await page.locator('.fluid-container').first().evaluate(el=>[...el.children].map(c=>[c.className,c.getBoundingClientRect().height,getComputedStyle(c).margin])).catch(()=>[]));}
  expect(outside,label+' controls must be reachable without scrolling').toEqual([]);
}
async function showPart(page,selector){
  if(await page.locator(selector).isVisible())return;
  const panel=page.locator(selector).locator('xpath=ancestor::*[contains(@class,"surface")][1]');
  const previous=panel.locator('[data-mobile-panel-step="-1"]');
  while(await previous.count()&&!await previous.isDisabled())await previous.click();
  for(let i=0;i<15&&!await page.locator(selector).isVisible();i++)await panel.locator('[data-mobile-panel-step="1"]').click();
  await expect(page.locator(selector)).toBeVisible();
}
async function checkPanelPages(page,label){
  for(const nav of await page.locator('.mobile-panel-pages').all()){
    const next=nav.locator('[data-mobile-panel-step="1"]');
    for(let i=0;i<30&&!await next.isDisabled();i++){await next.click();await fit(page,label+' part '+i);}
    expect(await next.isDisabled()).toBe(true);
  }
}
try{
  for(const size of [{width:854,height:393},{width:960,height:480},{width:740,height:360}]){
    const context=await browser.newContext({viewport:size,isMobile:true,hasTouch:true});
    await context.addInitScript(()=>{
      window.nativeCalls=[];window.cancelExport=false;
      window.GTLHAndroid={request(json){const req=JSON.parse(json);window.nativeCalls.push(req);
        const result=req.action==='import'?{text:window.importText||'{}'}:window.cancelExport?{cancelled:true}:{saved:true};
        setTimeout(()=>window.gtlhNativeResult(req.id,result),10);
      }};
    });
    const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/');await expect(page.locator('[data-gather]')).toHaveCount(0);
    const go=async name=>{await page.locator('.nav [data-page="'+name+'"]').click();await fit(page,name+' '+size.width);};
    for(const section of ['overview','resources','workshop','factory','inventory','research','space','settings'])await go(section);
    await go('resources');await revealResource(page,'forest');for(let i=0;i<4;i++)await page.locator('[data-gather=forest]').click();
    await expect(page.locator('[data-qty=wood]')).toHaveText(/^[1-3]$/);
    await page.locator('[data-node-details=forest]').click();await expect(page.locator('#modal')).toContainText('每轮掉落范围');
    expect(await page.evaluate(()=>window.gtlhBack())).toBe(true);
    await go('workshop');await page.locator('[data-book-item=stick]').click();
    await fit(page,'recipe details');await expect(page.locator('.bench-grid>.bench-slot')).toHaveCount(9);
    await showPart(page,'[data-fill=sticks]');await page.locator('[data-fill=sticks]').click();
    await showPart(page,'[data-craft=sticks][data-count="1"]');await page.locator('[data-craft=sticks][data-count="1"]').click();
    await expect(page.locator('[data-queue-count]')).toHaveText('0',{timeout:4000});
    await page.locator('[data-bench-view=tree]').click();
    await expect(page.locator('[data-tree-content]')).toContainText('木棍',{timeout:15000});
    await showPart(page,'[data-pagination=recipe-tree] button:last-child');
    await page.locator('[data-pagination=recipe-tree] button:last-child').click();
    await expect(page.locator('[data-tree-content]')).toContainText('原木');
    await fit(page,'recipe tree');
    expect(await page.evaluate(()=>window.gtlhBack())).toBe(true);
    await expect(page.locator('.recipe-book')).toBeVisible();
    await go('settings');await page.locator('[data-action=export]').click();
    await expect.poll(()=>page.evaluate(()=>window.nativeCalls.length)).toBe(1);
    const exported=await page.evaluate(()=>JSON.parse(window.nativeCalls[0].text));expect(exported.inventory.stick).toBe(4);
    await page.evaluate(()=>{window.gtlhLifecycle(true);window.gtlhLifecycle(false);});
    // Cancelling the backup must leave both reset and import unchanged.
    await page.evaluate(()=>{window.cancelExport=true;});
    await showPart(page,'[data-action=reset]');await page.locator('[data-action=reset]').click();await page.locator('[data-action=confirm-reset]').click();
    await page.waitForTimeout(50);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gtnh-long-road-v2')).inventory.stick)).toBe(4);
    await page.evaluate(()=>window.gtlhBack());
    await page.evaluate(()=>{window.importText=JSON.stringify({...JSON.parse(window.nativeCalls[0].text),inventory:{wood:99}});});
    await showPart(page,'[data-action=import]');await page.locator('[data-action=import]').click();await page.waitForTimeout(100);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gtnh-long-road-v2')).inventory.stick)).toBe(4);
    await page.evaluate(()=>{window.cancelExport=false;});await page.locator('[data-action=import]').click();await page.waitForTimeout(100);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gtnh-long-road-v2')).inventory.wood)).toBe(99);
    // Native onPause saves before timer suspension. No production while hidden or catch-up on resume.
    const before=await page.evaluate(()=>{window.gtlhLifecycle(true);return JSON.parse(localStorage.getItem('gtnh-long-road-v2')).playtime;});
    await page.waitForTimeout(500);
    const paused=await page.evaluate(()=>{window.gtlhLifecycle(true);return JSON.parse(localStorage.getItem('gtnh-long-road-v2')).playtime;});expect(paused).toBe(before);
    await page.evaluate(()=>window.gtlhLifecycle(false));await page.waitForTimeout(120);await page.evaluate(()=>window.gtlhLifecycle(true));
    const resumed=await page.evaluate(()=>JSON.parse(localStorage.getItem('gtnh-long-road-v2')).playtime);expect(resumed-before).toBeLessThan(.3);
    await page.evaluate(()=>window.gtlhLifecycle(false));
    await go('settings');await page.locator('#page [data-appearance-open]').click();
    for(const view of ['ladder','preview','dna']){await page.locator('[data-tier-view="'+view+'"]').click();await fit(page,'appearance '+view);}
    await page.locator('[data-tier-view=ladder]').click();await page.locator('[data-tier-step="1"]').click();
    await expect(page.locator('[data-select-tier=LV]')).toHaveAttribute('aria-pressed','true');
    await page.evaluate(()=>window.gtlhBack());
    await go('resources');await page.screenshot({path:`artifacts/mobile/resources-${size.width}.png`});
    // Isolated synthetic factory fixture, never a player's saved world.
    const factoryFixture=await page.evaluate(async()=>{const {Game}=await import('/core/engine.js');const g=new Game();g.add({wood:10000,coal:10000,steel:10000,bronze:10000,copper:10000,iron:10000,tin:10000,brick:10000,stone:10000,flintPick:1,wrench:1,hammer:1});
      for(const type of ['cokeOven','steamMacerator','forgeHammer','boiler']){const cost=g.catalog.machines[type].cost;g.add(cost);const result=g.build(type);if(!result.ok)throw Error(type+': '+result.message);}
      g.add({woodBucket:3});g.placeContainer('woodBucket',3);return JSON.stringify(g.snapshot());});
    await page.addInitScript(value=>localStorage.setItem('gtnh-long-road-v2',value),factoryFixture);
    await page.reload();await go('factory');
    for(const type of ['cokeOven','steamMacerator','forgeHammer','boiler']){
      const button=page.locator('[data-factory-type="'+type+'"]');await expect(button).toHaveCount(1);
      await button.click();await fit(page,'factory '+type);
      for(const view of ['production','energy','output']){
        const tab=page.locator('[data-device-view][data-view="'+view+'"]').first();if(await tab.isVisible()){await tab.click();await fit(page,type+' '+view);await checkPanelPages(page,type+' '+view);}
      }
    }
    await page.screenshot({path:`artifacts/mobile/factory-${size.width}.png`});
    await go('inventory');await page.locator('[data-inventory-tab=containers]').click();await fit(page,'containers');
    await checkPanelPages(page,'containers');
    const reserve='[data-container]:first-child [data-container-reserve]';if(await page.locator(reserve).count()){
      await showPart(page,reserve+'+button');
      await page.locator(reserve+'+button').first().click();await page.locator('#choiceSearch').fill('shui');
      // Soft keyboard resize must preserve the active search field and its value.
      await page.setViewportSize({...size,height:size.height-80});await expect(page.locator('#choiceSearch')).toBeFocused();await expect(page.locator('#choiceSearch')).toHaveValue('shui');
      await page.setViewportSize(size);await page.evaluate(()=>window.gtlhBack());
    }
    await page.locator('[data-create-group=fluid]').click();
    await page.locator('[name=groupName]').fill('测试水桶组');await page.locator('[data-group-pick-all]').click();
    await expect(page.locator('#groupDialog')).toContainText('已选 3');
    const dialogOutside=await page.locator('#groupDialog button,#groupDialog input').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).some(n=>n.getBoundingClientRect().bottom>innerHeight));expect(dialogOutside).toBe(false);
    await page.locator('#groupDialog [type=submit]').click();await expect(page.locator('[data-container]')).toHaveCount(1);
    await context.close();console.log(`PASS Android touch preview ${size.width}×${size.height}`);
  }
  expect(errors).toEqual([]);
}finally{await browser.close();}
