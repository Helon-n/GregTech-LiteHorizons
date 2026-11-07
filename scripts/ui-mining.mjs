import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import {revealResource} from './ui-controls.mjs';

const packaged=process.argv.includes('--packaged');
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
const dataDir=path.resolve('artifacts','mining-test-'+Date.now()+'-'+process.pid);
const app=await electron.launch({...(packaged?{executablePath:path.resolve(`release/win-unpacked/${metadata.build.productName}.exe`),args:[]}:{args:['.']}),env:{...process.env,GTNH_TEST_DATA:dataDir},timeout:60000});
try {
  const win=await app.firstWindow(),errors=[];win.on('pageerror',error=>errors.push(error.message));win.setDefaultTimeout(10000);
  await win.waitForSelector('#page[data-page="overview"]');
  await expect(win.locator('#saveStatus')).toContainText('v'+metadata.version);
  await win.addInitScript(()=>{const value=sessionStorage.getItem('mining-fixture');if(value)localStorage.setItem('gtnh-long-road-v2',value);});
  const fixtures=await win.evaluate(async()=>{
    const {Game}=await import('./core/engine.js');const g=new Game();g.add({flintPick:1});
    const manual=g.snapshot();g.add({steelPick:1});
    const n=g.catalog.gatherNodes.find(n=>n.id==='ore:Sulfur');g.add({netherPortal:1,...n.cost});g.buildCollector(n.id);g.tick(.5);g.pay({netherPortal:1});g.tick(.5);
    return {manual:JSON.stringify(manual),auto:JSON.stringify(g.snapshot()),ready:JSON.stringify({...g.snapshot(),inventory:{...g.state.inventory,netherPortal:1}})};
  });
  for(const size of [{width:1440,height:960},{width:1040,height:720}]) {
    await win.setViewportSize(size);
    await win.evaluate(value=>sessionStorage.setItem('mining-fixture',value),fixtures.manual);await win.reload();
    await win.locator('.nav [data-page="resources"]').click();await revealResource(win,'ironVein');
    const iron=win.locator('[data-node="ironVein"]');await expect(iron.locator('[data-gather]')).toBeDisabled();
    await expect(iron.locator('[data-node-access]')).toContainText('采掘 2+ / 当前 1');await expect(iron.locator('[data-gather]')).toContainText('铁镐');
    expect(await iron.locator('[data-node-access]').getAttribute('title')).toContain('主世界');
    let rect=await iron.boundingBox();expect(rect.y+rect.height).toBeLessThanOrEqual(size.height);
    await win.evaluate(value=>sessionStorage.setItem('mining-fixture',value),fixtures.auto);await win.reload();
    await win.locator('.nav [data-page="resources"]').click();await revealResource(win,'ore:Sulfur');
    await win.locator('[data-node-id="ore:Sulfur"][data-node-view="auto"]').click();
    const sulfur=win.locator('[data-node="ore:Sulfur"]');await expect(sulfur.locator('[data-collector]')).toBeDisabled();
    await expect(sulfur.locator('[data-auto]')).toContainText('地区入口');await expect(sulfur.locator('[data-auto]')).toContainText('下界传送门');
    rect=await sulfur.boundingBox();expect(rect.y+rect.height).toBeLessThanOrEqual(size.height);
    expect(await win.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await win.evaluate(value=>sessionStorage.setItem('mining-fixture',value),fixtures.ready);await win.reload();
    await win.locator('.nav [data-page="resources"]').click();await revealResource(win,'ore:Sulfur');
    await expect(sulfur.locator('[data-gather]')).toBeEnabled();await expect(sulfur.locator('[data-node-access]')).toContainText('地区：下界');
  }
  await win.evaluate(async()=>{
    const {CATALOG}=await import('./data/catalog.js');
    await Promise.all(Object.keys(CATALOG.mining.tools).map(id=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(Error('Icon failed: '+id));image.src='./assets/gtnh/'+id+'.svg';})));
  });
  expect(errors).toEqual([]);console.log(`${packaged?'Packaged':'Source'} mining UI OK: tool/region locks, collector pause, access restoration and SVG tools at 1440×960 / 1040×720; isolated saves.`);
} finally {await app.close();}
