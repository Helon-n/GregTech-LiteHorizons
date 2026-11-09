import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {constructionSlots} from '../src/core/workbench.js';

test('batch construction charges full totals, creates independent machines and survives reload',()=>{
  const g=new Game(),cost=g.buildCost('furnace',5);g.add(cost);
  assert.equal(g.buildLimit('furnace'),5);assert.equal(g.canBuild('furnace',5),true);
  const result=g.build('furnace',5);assert.equal(result.ok,true);assert.equal(result.devices.length,5);
  assert.equal(result.device,result.devices[0]);assert.equal(new Set(result.devices.map(d=>d.id)).size,5);
  for(const id of Object.keys(cost))assert.equal(g.quantity(id),0);
  assert.equal(g.state.earned.furnace,5);assert.equal(g.state.log[0].text,'建成：砖炉 ×5');
  result.devices[0].fluidInputs.water='test';assert.equal(result.devices[1].fluidInputs.water,undefined);
  delete result.devices[0].fluidInputs.water;
  const loaded=new Game(g.snapshot());assert.equal(loaded.state.devices.length,5);assert.equal(loaded.state.earned.furnace,5);
});

test('invalid quantity, missing materials and exceeding the device limit never charge or partially build',()=>{
  const g=new Game();g.add(g.buildCost('furnace',2));
  for(const count of [0,-1,1.5,NaN,Infinity,'2',501,Number.MAX_SAFE_INTEGER]){
    const before=structuredClone(g.state);assert.equal(g.canBuild('furnace',count),false);assert.equal(g.build('furnace',count).ok,false);
    assert.deepEqual(g.state,before);
  }
  const before=structuredClone(g.state);assert.equal(g.build('furnace',3).ok,false);assert.deepEqual(g.state,before);
  assert.equal(g.build('unknown',2).ok,false);assert.equal(g.buildLimit('unknown'),0);
  g.add(g.buildCost('workbench',499));assert.equal(g.build('workbench',499).ok,true);
  assert.equal(g.buildLimit('furnace'),1);assert.equal(g.canBuild('furnace',2),false);
  const full=structuredClone(g.state);assert.equal(g.build('furnace',2).ok,false);assert.deepEqual(g.state,full);
  assert.equal(g.build('furnace').ok,true);assert.equal(g.state.devices.length,500);
  assert.equal(g.canBuild('furnace'),false);assert.equal(g.buildLimit('furnace'),0);
});

test('batch construction consumes contained fluids once and preserves each device initialization',()=>{
  const g=new Game();g.add({fluidTank:1});g.placeContainer('fluidTank');
  const type='twilightPortal',cost=g.buildCost(type,2);g.add(cost);
  assert.equal(g.buildLimit(type),2);const result=g.build(type,2);assert.equal(result.ok,true);
  assert.equal(g.quantity('water'),0);assert.equal(g.state.containers.length,1);
  for(const type of ['boiler','batteryBuffer','dysonGenerator']){
    if(!g.catalog.machines[type])continue;
    g.add(g.buildCost(type,2));const built=g.build(type,2);assert.equal(built.ok,true);
    for(const d of built.devices){assert.equal(d.eu,0);assert.equal(d.batteries,0);assert.equal(d.recipe,null);}
    if(g.catalog.machines[type].energy?.kind==='dyson')for(const d of built.devices)assert.equal(d.modules,g.catalog.machines[type].cost.dyson||0);
  }
});

test('batch totals preserve all ingredients across large construction pages without changing single-machine recipes',()=>{
  const g=new Game();
  for(const m of Object.values(g.catalog.machines)){
    const original=structuredClone(m.cost),cost=g.buildCost(m.id,7),totals={};
    for(const slot of constructionSlots('build:'+m.id,cost).filter(Boolean))totals[slot.id]=(totals[slot.id]||0)+slot.count;
    assert.deepEqual(totals,Object.fromEntries(Object.entries(original).map(([id,n])=>[id,n*7])),m.id);
    assert.deepEqual(m.cost,original,m.id);
  }
});
