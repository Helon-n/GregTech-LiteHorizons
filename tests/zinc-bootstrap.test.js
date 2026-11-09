import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {CATALOG as c} from '../src/data/catalog.js';
import {planRoutes} from '../src/core/production-plan.js';

const site=id=>c.gatherNodes.find(n=>n.id===id);
const route=(input,fuel)=>c.recipes.find(r=>r.process==='smelt'&&r.inputs[input]&&r.inputs[fuel]&&r.outputs.zinc);

test('a fresh world can gather and smelt Overworld zinc using only a flint pick and brick furnace',()=>{
  const g=new Game();g.state.lootSeed=123456;
  function collect(nodeId,item,amount){
    assert.equal(g.nodeAvailable(site(nodeId)),true,nodeId);
    let attempts=0;
    while(g.quantity(item)<amount){
      assert.ok(attempts++<1000,'gathering failed: '+item);
      assert.equal(g.gather(nodeId).ok,true,nodeId);
    }
  }
  function craft(id){
    const r=g.recipeById.get(id);
    assert.equal(g.craft(id).ok,true,id);g.simulate(r.seconds);
  }
  collect('forest','wood',8);collect('surface','stone',16);
  collect('surface','flint',8);collect('river','clay',4);
  craft('sticks');craft('pick');
  assert.equal(g.nodeAvailable(site('ore:Sphalerite')),false,'Nether ore keeps its entrance requirement');
  collect('ore:Zinc','zincOre',8);collect('coalVein','coal',1);
  const built=g.build('furnace');assert.equal(built.ok,true);
  const r=route('zincOre','coal');assert.ok(r,'primitive zinc smelting must be discoverable');
  assert.ok(planRoutes(g,'zinc').some(candidate=>candidate.id===r.id));
  const before={ore:g.quantity('zincOre'),coal:g.quantity('coal')};
  assert.equal(g.assign(built.device.id,r.id).ok,true);g.simulate(r.seconds);
  assert.equal(g.quantity('zinc'),8);
  assert.equal(g.quantity('zincOre'),before.ore-8);assert.equal(g.quantity('coal'),before.coal-1);
  assert.deepEqual(g.state.devices.map(d=>d.type),['furnace']);
  assert.equal(g.owned('netherPortal'),0);assert.equal(g.quantity('steam'),0);assert.equal(g.state.energy,0);
  assert.equal(g.state.stage,0);
  const restored=new Game(g.snapshot());assert.equal(restored.quantity('zinc'),8);
});

test('zinc ore and dust retain ordinary coal/charcoal smelting and the original steam/electric route',()=>{
  for(const input of ['zincOre','zincDust']){
    for(const fuel of ['coal','charcoal']){
      const r=route(input,fuel);assert.ok(r,input+' '+fuel);
      assert.deepEqual(r.inputs,{[input]:8,[fuel]:1});assert.deepEqual(r.outputs,{zinc:8});
      assert.equal(r.seconds,80);assert.equal(r.power,0);assert.equal(r.furnaceRegistry,true);
      const original=c.recipes.find(candidate=>candidate.id===r.furnaceBatch.recipe);
      assert.equal(original.process,'electricSmelt');assert.equal(original.power,4);assert.equal(original.seconds,6.4);
      assert.deepEqual(original.inputs,{[input]:1});assert.deepEqual(original.outputs,{zinc:1});
      const g=new Game();g.add({...c.machines.furnace.cost,...r.inputs});
      const built=g.build('furnace');assert.equal(built.ok,true);
      assert.equal(g.assign(built.device.id,r.id).ok,true);g.simulate(r.seconds);
      assert.equal(g.quantity('zinc'),8);assert.equal(g.quantity(fuel),0);assert.equal(g.quantity(input),0);
    }
  }
});

test('the zinc fix preserves existing sphalerite smelting and does not grant blast metals ordinary furnace routes',()=>{
  assert.ok(route('sphaleriteOre','coal'));assert.ok(route('sphaleriteOre','charcoal'));
  for(const output of ['tungstensteel','neutronium','infinity']){
    assert.equal(c.recipes.some(r=>r.process==='smelt'&&r.furnaceBatch&&r.outputs[output]),false,output);
  }
});
