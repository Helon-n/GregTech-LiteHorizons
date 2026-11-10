import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const app=await electron.launch({...(packaged?{executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:path.resolve('artifacts','management-'+Date.now())},timeout:60000});
try{
  const win=await app.firstWindow(),errors=[];win.setDefaultTimeout(10000);
  win.on('pageerror',error=>errors.push(error.message));await win.waitForSelector('#page[data-page="overview"]');
  const fixture=await win.evaluate(async()=>{
    const {Game}=await import('./core/engine.js'),g=new Game();
    for(const type of ['furnace','furnace','furnace','castingtable']){g.add(g.catalog.machines[type].cost);if(!g.build(type).ok)throw Error('fixture build');}
    g.renameDevice('d1','烧砖一号炉');g.renameDevice('d2','备用炉');g.assign('d1','bricks');g.assign('d3','bricks');
    g.add({fluidTank:2,iron:4,brick:5});g.placeContainer('fluidTank',1,'steam');g.placeContainer('fluidTank',1,'water');
    return JSON.stringify(g.snapshot());
  });
  await win.addInitScript(raw=>localStorage.setItem('gtnh-long-road-v2',raw),fixture);
  const fits=async()=>expect(await win.locator('#page .management-tools input,#page .management-tools button,#page [data-pagination] button,#page [data-device],#page [data-container]').evaluateAll(nodes=>nodes.filter(n=>{const b=n.getBoundingClientRect();return b.height&&(b.bottom>innerHeight+1||b.right>innerWidth+1||b.left<0);}).map(n=>n.textContent.slice(0,60)))).toEqual([]);
  for(const size of [{width:1440,height:960},{width:1040,height:720}]){
    await win.setViewportSize(size);await win.reload();await win.waitForSelector('#page[data-page="overview"]');
    await win.locator('.nav [data-page="factory"]').click();
    const search=win.locator('#search');
    await expect(win.locator('[data-management-sort="organized"]')).toHaveAttribute('aria-pressed','true');
    await expect(win.locator('[data-factory-type][aria-pressed="true"]')).toHaveAttribute('data-factory-type','furnace');
    await expect(win.locator('[data-device]').first()).toHaveAttribute('data-device','d1');
    for(const query of ['jiaozhutai','浇铸台']){await search.fill(query);await expect(win.locator('[data-factory-type]')).toHaveCount(1);await expect(win.locator('[data-device="d4"]')).toBeVisible();}
    await search.fill('shaozhuan');await expect(win.locator('[data-device="d1"]')).toBeVisible();await expect(win.locator('[data-device]')).toHaveCount(1);
    await search.fill('zzzz-no-match');await expect(win.locator('.factory-content')).toContainText('没有匹配');
    await search.fill('');await expect(win.locator('[data-factory-type]')).toHaveCount(2);
    await win.locator('[data-management-sort="name"]').click();await expect(win.locator('[data-device]').first()).toHaveAttribute('data-device','d2');
    await win.locator('[data-management-sort="organized"]').click();await expect(win.locator('[data-device]').first()).toHaveAttribute('data-device','d1');
    await search.focus();await search.dispatchEvent('compositionstart');await search.evaluate(el=>{el.value='烧砖';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));});
    await win.waitForTimeout(240);await expect(search).toBeFocused();await expect(search).toHaveValue('烧砖');await search.dispatchEvent('compositionend');await expect(win.locator('[data-device]')).toHaveCount(1);
    await search.fill('');await expect(win.locator('[data-factory-type]')).toHaveCount(2);await expect(win.locator('[data-device]').first()).toHaveAttribute('data-device','d1');await fits();
    const factoryPager=win.locator('[data-pagination="factory"]');
    for(let i=0;i<4&&!await win.locator('[data-device="d2"]').count();i++)await factoryPager.locator('button').last().click();
    await expect(win.locator('[data-device="d2"]')).toBeVisible();await fits();
    await win.locator('.nav [data-page="inventory"]').click();await win.locator('[data-inventory-tab="containers"]').click();
    await search.fill('zhengqi');await expect(win.locator('[data-container]')).toHaveCount(1);await expect(win.locator('[data-container-fluid]')).toHaveText('蒸汽');
    await search.fill('zzzz-no-match');await expect(win.locator('#containerList')).toContainText('没有匹配的容器');
    await search.fill('');await expect(win.locator('[data-container-fluid]').first()).toHaveText('蒸汽');await fits();
    if(await win.locator('[data-container]').count()===1){await win.locator('[data-pagination="fluids"] button').last().click();await expect(win.locator('[data-container-fluid]')).toHaveText('水');await fits();}
    await win.locator('.nav [data-page="resources"]').click();await fits();await search.fill('forest');await expect(win.locator('[data-node="surface"]')).toHaveCount(0);await expect(win.locator('[data-node="forest"]')).toBeVisible();await fits();
    console.log(`Management UI OK at ${size.width}x${size.height}: organize, name order, machine/alias/product/pinyin search, IME, empty/clear, fluids, resources and fitted controls.`);
  }
  expect(errors).toEqual([]);
}catch(error){await (await app.firstWindow()).screenshot({path:'artifacts/management-failure.png',timeout:3000}).catch(()=>{});throw error;}
finally{await app.close();}
