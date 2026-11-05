import {chromium,expect} from '@playwright/test';
import {VOLTAGE_TIERS} from '../src/data/voltage-tiers.js';
import {Game} from '../src/core/engine.js';
import {items,machines} from '../src/data/catalog.js';

const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let checks=0;
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const open=async()=>{await page.locator('[data-page="settings"]').first().click();await page.locator('#page [data-appearance-open]').click();};
  const view=async name=>{const tab=page.locator(`[data-tier-view="${name}"]`);if(await tab.isVisible())await tab.click();};
  const fit=async label=>{
    const outside=await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll('#tierAppearance button,#tierAppearance h2,#tierAppearance h3,#tierAppearance dl,#tierAppearance p,#tierAppearance .tier-palette,.nav button')];
      return nodes.filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').filter(el=>{const r=el.getBoundingClientRect();return r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5;}).map(el=>el.outerHTML.slice(0,140));
    });
    expect(outside,`${label}: all content remains accessible within the viewport`).toEqual([]);checks++;
    expect(await page.evaluate(()=>[document.documentElement,document.body].every(el=>!['auto','scroll'].includes(getComputedStyle(el).overflowY)))).toBe(true);
  };
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('html')).toHaveAttribute('data-tier','ULV');
  await open();
  const stage=await page.locator('#headerStage').textContent();
  for(const tier of VOLTAGE_TIERS){
    await page.locator(`[data-select-tier="${tier.code}"]`).click();
    await expect(page.locator('.tier-inspector')).toHaveAttribute('data-tier',tier.code);
    await expect(page.locator('.tier-inspector')).toHaveAttribute('data-tex',tier.texture);
    await expect(page.locator('.tier-inspector .tier-detail')).toHaveAttribute('data-detail',tier.detail);
    await expect(page.locator('[data-dna-description]')).toHaveText(tier.description);
    await expect(page.locator('[data-select-tier][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('[data-swatch="a"]')).toHaveText(tier.palette.accent[0].toUpperCase());
    expect(await page.locator('.tier-inspector').evaluate(el=>getComputedStyle(el).getPropertyValue('--a').trim())).toBe(tier.palette.accent[0]);checks++;
  }
  await expect(page.locator('#headerStage')).toHaveText(stage);
  await expect(page.locator('html')).toHaveAttribute('data-tier','ULV');
  await expect(page.locator('[data-tier-step="1"]')).toBeDisabled();
  await page.locator('[data-select-tier="MAX"]').focus();await page.keyboard.press('Home');
  await expect(page.locator('[data-select-tier="ULV"]')).toBeFocused();
  await expect(page.locator('[data-tier-step="-1"]')).toBeDisabled();
  await page.keyboard.press('ArrowRight');await expect(page.locator('[data-select-tier="LV"]')).toBeFocused();
  await page.keyboard.press('End');await expect(page.locator('[data-select-tier="MAX"]')).toBeFocused();
  await page.locator('[data-tier-step="-1"]').click();await expect(page.locator('.tier-inspector')).toHaveAttribute('data-tier','UXV');
  await page.locator('[data-tier-step="1"]').click();
  await page.locator('[data-tier-use]').click();await expect(page.locator('html')).toHaveAttribute('data-light','true');
  await expect(page.locator('[data-tier-use]')).toBeFocused();
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-tier','MAX');
  for(const name of ['resources','workshop','factory','inventory','research','settings']){
    await page.locator(`[data-page="${name}"]`).first().click();await expect(page.locator('#page')).not.toBeEmpty();
    expect(await page.locator('#page').evaluate(el=>getComputedStyle(el).color)).toBe('rgb(38, 35, 29)');
  }
  await open();await page.locator('[data-tier-auto]').click();await expect(page.locator('html')).toHaveAttribute('data-tier','ULV');checks++;
  // A real progressed world, with actual devices; no demo products or recipes.
  const g=new Game();g.state.stage=5;
  g.add(Object.fromEntries(Object.values(items).filter(i=>i.kind!=='fluid').map(i=>[i.id,100000])));
  for(const type of ['steamMacerator','workbench']){const r=g.build(type);expect(r.ok).toBe(true);g.toggle(r.device.id);}
  const snapshot=g.snapshot();
  await page.addInitScript(data=>{if(!sessionStorage.getItem('tier-fixture')){localStorage.setItem('gtnh-long-road-v2',JSON.stringify(data));localStorage.removeItem('glh-voltage-appearance');sessionStorage.setItem('tier-fixture','yes');}},snapshot);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-tier','EV');await open();
  await expect(page.locator('.tier-preview')).toContainText(machines.steamMacerator.name);
  await expect(page.locator('.tier-preview')).toContainText('2 台机器');
  await page.locator('[data-select-tier="IV"]').click();await page.locator('[data-tier-use]').click();
  await page.locator('[data-tier-auto]').click();await expect(page.locator('html')).toHaveAttribute('data-tier','EV');checks++;
  // Validate layout both when all panels fit and when explicit page tabs are used.
  for(const [width,height] of [[1920,1080],[1440,960],[1280,800],[1040,720],[1120,1600],[760,1600],[760,900],[420,844],[390,844],[390,680]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(240);
    await view('ladder');
    const count=await page.locator('.tier-ladder').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(count).toBe(width>1120?4:width>760?2:1);
    if(width<=420)expect(await page.locator('[data-era-group]:not([hidden]) .tier-era-grid').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
    await fit(`${width}x${height} ladder`);
    if(await page.locator('.tier-era-pages').isVisible()){
      for(let i=0;i<3;i++){await page.locator('[data-era-step="-1"]').isEnabled().then(async enabled=>{if(enabled)await page.locator('[data-era-step="-1"]').click();});}
      for(let i=0;i<4;i++){
        await fit(`${width}x${height} era ${i}`);
        const tiles=page.locator('[data-era-group]:not([hidden]) [data-select-tier]');await tiles.last().click();
        await expect(page.locator('.tier-inspector')).toHaveAttribute('data-tier',await tiles.last().getAttribute('data-select-tier'));
        if(i<3)await page.locator('[data-era-step="1"]').click();
      }
      await page.locator('[data-era-group]:not([hidden]) [data-select-tier]').last().focus();await page.keyboard.press('Home');
      await expect(page.locator('[data-select-tier="ULV"]')).toBeFocused();await page.keyboard.press('End');
      await expect(page.locator('[data-select-tier="MAX"]')).toBeFocused();
    }
    await view('preview');await fit(`${width}x${height} preview`);
    if(await page.locator('.tier-preview-pages').isVisible())for(const part of ['production','energy']){
      await page.locator(`[data-preview-view="${part}"]`).click();await fit(`${width}x${height} ${part} preview`);
    }
    await view('dna');await fit(`${width}x${height} DNA`);
    if(await page.locator('.tier-dna-pages').isVisible()){
      await page.locator('[data-dna-view="palette"]').click();await fit(`${width}x${height} DNA palette`);
      await page.locator('[data-dna-view="spec"]').click();await fit(`${width}x${height} DNA spec`);
    }
  }
  // The longest copy/material names also fit the smallest supported preview.
  await page.setViewportSize({width:390,height:680});await page.waitForTimeout(240);await view('dna');
  for(let i=14;i>=0;i--){
    for(const section of ['spec','palette']){const tab=page.locator(`[data-dna-view="${section}"]`);if(await tab.isVisible())await tab.click();await fit(`390x680 ${VOLTAGE_TIERS[i].code} ${section}`);}
    if(i)await page.locator('[data-tier-step="-1"]').click();
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.locator('.tier-preview .progress>div').evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
  await page.setViewportSize({width:1440,height:960});await page.waitForTimeout(240);
  await page.locator('[data-select-tier="MAX"]').click();
  await page.screenshot({path:'artifacts/tier-system-max.png'});
  await page.locator('[data-select-tier="LV"]').click();
  await page.screenshot({path:'artifacts/tier-system-lv.png'});
  expect(errors).toEqual([]);console.log(`Voltage appearance UI: ${checks} data, interaction and layout checks passed.`);
}finally{await browser.close();}
