import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {VOLTAGE_TIERS,VOLTAGE_ERAS} from '../src/data/voltage-tiers.js';
import {tierFor,tierTokens,readAppearance,saveAppearance} from '../src/tier-theme.js';
import {STAGES} from '../src/data/catalog.js';

test('all 15 tiers preserve the design reference data, including copy and every palette group',()=>{
  const source=fs.readFileSync(new URL('../资料/voltage-tier-styles.html',import.meta.url),'utf8');
  const read=name=>JSON.parse(JSON.stringify(vm.runInNewContext(source.match(new RegExp('var '+name+' = (\\[[\\s\\S]*?\\n  \\]);'))[1],{},{timeout:1000})));
  assert.deepEqual(VOLTAGE_ERAS,read('ERAS'));
  const reference=read('TIERS');assert.equal(VOLTAGE_TIERS.length,15);
  for(const [i,t] of VOLTAGE_TIERS.entries()){
    const r=reference[i];
    assert.deepEqual([t.code,t.index,t.era,t.name,t.fullName,t.voltage,t.voltageShort,t.material,t.materialEn,t.background,t.lcdBackground,t.texture,t.detail,t.light,t.tags,t.description],
      [r.code,r.idx,r.era,r.name,r.full,r.v,r.vShort,r.material,r.materialEn,r.bg,r.lcdBg,r.tex,r.detail,!!r.light,r.tags,r.desc]);
    assert.deepEqual(t.palette,{accent:[r.a,r.a2],casing:r.c,panel:r.p});
    assert.deepEqual(t.spec,{texture:r.specTex,glow:r.specGlow,progress:r.specProg});
  }
});
test('16 gameplay chapters map to 15 visual tiers without changing gameplay data',()=>{
  assert.equal(STAGES.length,16);
  assert.equal(tierFor('STONE').code,'ULV');assert.equal(tierFor('STEAM').code,'ULV');
  for(const stage of STAGES.slice(2))assert.equal(tierFor(stage.code).code,stage.code);
  assert.equal(tierFor('luv').code,'LuV');assert.equal(tierFor(undefined).code,'ULV');
});
test('appearance preference is separate from world saves and tolerates damaged/unavailable storage',()=>{
  const map=new Map([['gtnh-long-road-v2','world']]);
  const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  assert.equal(readAppearance(storage),null);assert.equal(saveAppearance(storage,'MAX'),true);assert.equal(readAppearance(storage),'MAX');
  map.set('glh-voltage-appearance','bad');assert.equal(readAppearance(storage),null);
  saveAppearance(storage,'EV');saveAppearance(storage,null);assert.deepEqual([...map],[['gtnh-long-road-v2','world']]);
  const unavailable={getItem(){throw Error('unavailable');},setItem(){throw Error('unavailable');}};
  assert.equal(readAppearance(unavailable),null);assert.equal(saveAppearance(unavailable,'LV'),false);
});
test('normal and MAX text tokens remain readable against their actual panel surfaces',()=>{
  const l=hex=>{const c=hex.slice(1).match(/../g).map(s=>parseInt(s,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  const contrast=(a,b)=>(Math.max(l(a),l(b))+.05)/(Math.min(l(a),l(b))+.05);
  for(const tier of VOLTAGE_TIERS){const t=tierTokens(tier.code);for(const ink of ['ink','readable-dim','a-ink'])for(const surface of ['p1','p2','bg'])assert.ok(contrast(t[ink],t[surface])>=4.5,`${tier.code}: ${ink}/${surface}`);}
});
