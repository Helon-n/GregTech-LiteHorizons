import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';

function build(g,type){g.add(g.catalog.machines[type].cost);const result=g.build(type);assert.equal(result.ok,true);return result.device;}
function tank(g,type){g.add({[type]:1});assert.equal(g.placeContainer(type).ok,true);}

test('force stop unlocks a paused batch, survives reload, and allows another product without refund or late output',()=>{
  const g=new Game(),d=build(g,'furnace');g.add({clay:1,coal:2,sand:4});
  g.assign(d.id,'bricks');g.tick(.5);g.toggle(d.id);
  assert.equal(g.assign(d.id,'glass').ok,false);
  const inventory=structuredClone(g.state.inventory),earned=structuredClone(g.state.earned);
  assert.equal(g.forceStop(d.id).ok,true);assert.equal(g.forceStop(d.id).ok,true);
  assert.deepEqual(g.state.inventory,inventory);assert.deepEqual(g.state.earned,earned);
  assert.equal(d.job,null);assert.equal(d.recipe,null);assert.equal(d.enabled,false);
  const loaded=new Game(g.snapshot());loaded.simulate(10);
  assert.equal(loaded.quantity('brick'),0);assert.equal(loaded.state.devices[0].blocked,'已停止');
  assert.equal(loaded.assign(d.id,'glass').ok,true);loaded.simulate(10);assert.equal(loaded.quantity('glass'),0);
  loaded.toggle(d.id);loaded.simulate(6);assert.equal(loaded.quantity('glass'),4);assert.equal(loaded.quantity('brick'),0);
  assert.equal(g.forceStop('missing').ok,false);
});

test('force stop works for a completed batch blocked by a full tank without phantom products or returned fuel',()=>{
  const g=new Game();g.state.stage=1;
  tank(g,'fluidTank');g.add({creosote:63000,coal:8});
  const a=build(g,'cokeOven'),b=build(g,'cokeOven');g.assign(a.id,'coke');g.assign(b.id,'coke');g.simulate(15);
  assert.equal(b.job.remaining,0);assert.equal(b.blocked,'流体输出空间不足');
  assert.equal(g.forceStop(b.id).ok,true);assert.equal(g.quantity('creosote'),64000);assert.equal(g.quantity('coal'),0);
  g.pay({creosote:1000});g.simulate(10);assert.equal(g.quantity('creosote'),63000);assert.equal(g.state.produced,1004);
  assert.equal(g.assign(b.id,'coke').ok,true);assert.equal(b.job,null);assert.equal(b.enabled,false);
});

test('force stop preserves spent electricity and cannot turn partly burned generator fuel into free energy',()=>{
  const g=new Game();g.state.stage=2;
  const electrolyzer=build(g,'electrolyzer');g.add({sand:4});electrolyzer.eu=1000;
  g.assign(electrolyzer.id,'silicon');g.simulate(1);const remainingEnergy=g.state.energy;
  assert.equal(remainingEnergy,680);g.forceStop(electrolyzer.id);
  assert.equal(g.state.energy,remainingEnergy);assert.equal(g.quantity('sand'),0);assert.equal(g.quantity('silicon'),0);
  tank(g,'fluidTank');g.add({steam:3200});const generator=build(g,'turbine');
  g.assign(generator.id,'steamPower');g.setSupply(generator.id,'storage',g.state.containers[0].id);g.simulate(1);const generatedEnergy=g.state.energy;
  assert.equal(generatedEnergy,remainingEnergy+1371);assert.equal(g.quantity('steam'),0);assert.equal(generator.fuel,1);
  g.forceStop(generator.id);g.simulate(20);
  assert.equal(g.state.energy,generatedEnergy);assert.equal(g.quantity('steam'),0);
});
