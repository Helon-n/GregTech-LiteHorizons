import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const app=await electron.launch({...(packaged?{executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:path.resolve('artifacts','container-placement-'+Date.now())},timeout:60000});
try{
  const win=await app.firstWindow(),errors=[];win.setDefaultTimeout(10000);
  win.on('pageerror',error=>errors.push(error.message));await win.waitForSelector('#page[data-page="overview"]');
  await expect(win.locator('#saveStatus')).toContainText('v'+metadata.version);
  const fixture=await win.evaluate(async()=>{
    const {Game}=await import('./core/engine.js'),g=new Game();g.add({fluidTank:3,largeTank:1,ironBucket:2,woodBucket:1});
    return JSON.stringify(g.snapshot());
  });
  await win.addInitScript(raw=>localStorage.setItem('gtnh-long-road-v2',raw),fixture);
  const find=async type=>{
    const card=win.locator('.container-option').filter({has:win.locator(`[data-place-container="${type}"]`)});
    const pager=win.locator('[data-pagination="container-catalog"]');
    if(await pager.count())while(await pager.locator('button').first().isEnabled())await pager.locator('button').first().click();
    for(let i=0;i<10&&!await card.count();i++)await pager.locator('button').last().click();
    await expect(card).toBeVisible();return card;
  };
  const fits=async locator=>{
    expect(await locator.evaluateAll(nodes=>nodes.filter(n=>{const b=n.getBoundingClientRect();return b.height&&(b.bottom>innerHeight+1||b.right>innerWidth+1||b.left<0);}).map(n=>n.textContent)),'controls must fit without scrolling').toEqual([]);
  };
  for(const size of [{width:1440,height:960},{width:1040,height:720}]){
    await win.setViewportSize(size);await win.reload();await win.waitForSelector('#page[data-page="overview"]');
    await win.locator('.nav [data-page="inventory"]').click();await win.locator('[data-inventory-tab="containers"]').click();await win.locator('[data-container-view="catalog"]').click();
    const tank=await find('fluidTank');
    await expect(tank.locator('[data-place-container]')).toBeDisabled();
    await tank.locator('[data-container-place-fluid]+button').click();
    const dialog=win.locator('#choiceDialog');await expect(dialog).toHaveAttribute('aria-label','选择储存流体');
    await dialog.locator('#choiceSearch').fill('zhengqi');await fits(dialog.locator('button,input'));
    await dialog.locator('[data-choice-option]').filter({has:win.getByText('蒸汽',{exact:true})}).click();
    await expect(tank.locator('[data-container-place-fluid]')).toHaveValue('steam');
    await tank.locator('[data-container-place-all]').click();await expect(tank.locator('[data-place-container]')).toHaveText('放置 ×3');
    await fits(tank.locator('button'));await tank.locator('[data-place-container]').click();
    await expect(win.locator('[data-container-view="catalog"]')).toHaveClass(/active/);
    let saved=await win.evaluate(()=>JSON.parse(localStorage.getItem('gtnh-long-road-v2')));
    expect(saved.containers).toHaveLength(3);expect(saved.containers.every(c=>c.fluid==='steam'&&c.amount===0)).toBe(true);expect(saved.inventory.fluidTank).toBe(0);
    const iron=await find('ironBucket');await iron.locator('[data-container-place-fluid]+button').click();await dialog.locator('#choiceSearch').fill('');
    expect(await dialog.locator('[data-choice-option] strong').allTextContents()).toEqual(['水','杂酚油','原油','柴油']);
    await dialog.locator('[data-close-choice]').click();await expect(iron.locator('[data-place-container]')).toBeDisabled();
    const wood=await find('woodBucket');await expect(wood.locator('[data-container-place-fluid]')).toHaveValue('water');
    await wood.locator('[data-place-container]').click();
    await win.locator('[data-container-view="placed"]').click();
    await expect(win.locator('[data-container-fluid]').first()).toHaveText('蒸汽');
    console.log(`Container placement OK at ${size.width}×${size.height}: required choice, pinyin cards, batch reservation, compatible fluids, water-only bucket, no auto navigation.`);
  }
  expect(errors).toEqual([]);
}catch(error){await (await app.firstWindow()).screenshot({path:'artifacts/container-placement-failure.png',timeout:3000}).catch(()=>{});throw error;}
finally{await app.close();}
