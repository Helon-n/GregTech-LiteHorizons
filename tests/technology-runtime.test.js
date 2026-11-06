import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {BIOCHEMISTRY_REFERENCE as B} from '../src/data/biochemistry-reference.js';
import {MATTER_REFERENCE as M} from '../src/data/matter-reference.js';
import {bioRecipe,bioFailure,bioDose,tickBioVats} from '../src/core/biochemistry.js';
import {energyCapacity} from '../src/core/energy.js';
import {CIRCUIT_MIGRATIONS} from '../src/data/circuit-progression.js';

const world=()=>{const g=new Game();g.state.stage=15;return g;};
function build(g,type){assert.equal(g.add(g.catalog.machines[type].cost),true);const result=g.build(type);assert.equal(result.ok,true);return result.device;}
function tank(g,fluid,amount=0){g.add({largeTank:1});const result=g.placeContainer('largeTank');assert.equal(result.ok,true);g.reserveContainer(result.container.id,fluid);assert.equal(g.add({[fluid]:amount}),true);return result.container;}

test('biology consumes physical culture and rod once, preserves decay on pause and reload, and refunds only culture',()=>{
  const g=world(),r=g.catalog.recipes.find(r=>r.process==='bioVat'&&r.requirements.radiation&&!r.requirements.radiation.exact&&r.requirements.bioGlass<=4&&r.requirements.radiation.value<=95);
  assert.ok(r);const d=build(g,'bioVatEV');
  const rod=Object.entries(B.fuels).find(([,v])=>v.sievert>=r.requirements.radiation.value);
  g.add({[r.requirements.bioCulture]:1,[rod[0]]:1});
  assert.equal(bioFailure(g,d,r),'');assert.equal(g.assign(d.id,r.id).ok,true);
  tickBioVats(g,.5);assert.equal(g.quantity(r.requirements.bioCulture),0);assert.equal(g.quantity(rod[0]),0);assert.equal(d.bioVat.culture,r.requirements.bioCulture);assert.ok(bioDose(d)>=r.requirements.radiation.value);
  const ticks=d.bioVat.ticks;g.toggle(d.id);tickBioVats(g,1);assert.equal(d.bioVat.ticks,ticks-20);
  const h=new Game(g.snapshot()),loaded=h.state.devices[0];assert.deepEqual(loaded.bioVat,d.bioVat);
  assert.equal(h.dismantle(loaded.id).ok,true);assert.equal(h.quantity(r.requirements.bioCulture),1);assert.equal(h.quantity(rod[0]),0);
});

test('vat multiplier scales only first fluids, stays fixed for paid jobs, and rejects invalid saved multipliers',()=>{
  const g=world(),d=build(g,'bioVatHV'),r=g.catalog.recipes.find(r=>r.process==='bioVat'&&!r.requirements.radiation&&r.requirements.bioGlass<=3);
  const input=Object.keys(r.inputs).find(id=>g.catalog.items[id].kind==='fluid'),output=Object.keys(r.outputs).find(id=>g.catalog.items[id].kind==='fluid');
  tank(g,input,r.inputs[input]*5);const target=tank(g,output,500000);d.fluidOutputs[output]=target.id;
  const scaled=bioRecipe(g,d,r);assert.equal(scaled.bioMultiplier,5);assert.equal(scaled.inputs[input],r.inputs[input]*5);assert.equal(scaled.outputs[output],r.outputs[output]*5);assert.equal(scaled.power,r.power);assert.equal(scaled.seconds,r.seconds);
  d.job={bioMultiplier:5};g.pay({[output]:500000});assert.equal(bioRecipe(g,d,r).bioMultiplier,5);d.job=null;
  const raw=g.snapshot();raw.devices[0].bioVat.coverage=101;assert.throws(()=>new Game(raw));
});

test('mass fabrication requires a container, consumes calibrated EU, and persists a prepaid batch',()=>{
  for(const amplified of [false,true]){
    const g=world(),d=build(g,'massFabricatorLV'),r=g.catalog.recipes.find(r=>r.matterFabrication&&!!r.inputs[M.amplifier]===amplified);
    if(amplified)tank(g,M.amplifier,1);
    const boxes=Array.from({length:2},()=>{const box=build(g,'batteryBuffer');g.add({batteryLV:4});for(let i=0;i<4;i++)assert.equal(g.changeBattery(box.id,true).ok,true);box.eu=energyCapacity(g,box);return box;});
    const grouped=g.saveGroup('device','测试电池组',boxes.map(b=>b.id));assert.equal(grouped.ok,true);
    assert.equal(g.setSupply(d.id,'storage',g.state.groups[0].id).ok,true);
    assert.equal(g.assign(d.id,r.id).ok,true);d.eu=energyCapacity(g,d);g.tick(.5);assert.equal(d.job,null);
    tank(g,M.matter);const before=d.eu+boxes.reduce((n,b)=>n+b.eu,0);g.tick(.5);assert.ok(d.job);assert.equal(d.eu+boxes.reduce((n,b)=>n+b.eu,0),before-M.power*10);
    const h=new Game(g.snapshot());assert.deepEqual(h.state.devices[0].job,d.job);
    g.simulate(r.seconds-.5);assert.equal(g.quantity(M.matter),1,JSON.stringify({amplified,job:d.job,blocked:d.blocked,eu:d.eu,boxes:boxes.map(b=>b.eu)}));assert.equal(d.eu+boxes.reduce((n,b)=>n+b.eu,0),before-r.seconds*20*M.power);if(amplified)assert.equal(g.quantity(M.amplifier),0);
  }
});

test('mass fabricators use their dedicated double-EU overclock instead of ordinary quadruple-EU overclock',()=>{
  const g=world(),r=g.catalog.recipes.find(r=>r.matterFabrication&&!r.inputs[M.amplifier]);
  for(const [code,tier]of [['LV',1],['MV',2],['HV',3]]){const d=build(g,'massFabricator'+code),run=g.deviceRuntime(d,r);assert.equal(run.valid,true);assert.equal(run.power,M.power*2**(tier-1));assert.equal(run.seconds,Math.trunc(M.ticks/2**(tier-1))/20);}
});

test('retired circuit inventory and earned credit migrate once and do not duplicate across reloads',()=>{
  const g=world(),raw=g.snapshot();raw.industryRulesVersion=4;
  for(const old of Object.keys(CIRCUIT_MIGRATIONS)){raw.inventory[old]=3;raw.earned[old]=7;}
  const h=new Game(raw),again=new Game(h.snapshot());
  for(const [old,current]of Object.entries(CIRCUIT_MIGRATIONS)){assert.equal(h.quantity(old),0);assert.equal(h.quantity(current),3);assert.equal(h.state.earned[current],7);assert.equal(again.quantity(current),3);}
});

test('original water electrolysis cell conversion preserves 1000 mB oxygen per 1000 mB water',()=>{
  const g=world(),routes=g.catalog.recipes.filter(r=>r.process==='electrolyze'&&r.inputs.water===1000&&r.outputs.hydrogen&&r.outputs.oxygen);
  assert.ok(routes.length>=2);for(const r of routes){assert.equal(r.outputs.oxygen,1000,r.id);assert.equal(r.outputs.hydrogen,2000,r.id);}
});
