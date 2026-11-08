import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {CATALOG as c} from '../src/data/catalog.js';
import {applyFurnaceCatalog} from '../src/data/furnace-catalog.js';

test('primitive smelting accepts only physical ordinary-furnace registrations and preserves the electric route',()=>{
  const electric=c.recipes.find(r=>r.inputs.nhItem_UnfiredSearedBrick);
  assert.equal(electric.process,'electricSmelt');assert.equal(electric.power,4);assert.equal(electric.seconds,6.4);
  for(const fuel of ['coal','charcoal']){
    const r=c.recipes.find(r=>r.furnaceBatch?.recipe===electric.id&&r.furnaceBatch.fuel===fuel);
    assert.ok(r);assert.deepEqual(r.inputs,{nhItem_UnfiredSearedBrick:8,[fuel]:1});
    assert.deepEqual(r.outputs,{modItem_TinkerConstruct_materials_2:8});
    assert.equal(r.seconds,80);assert.equal(r.power,0);assert.equal(r.process,'smelt');
  }
  const model={items:{a:{kind:'item'},b:{kind:'item'},fluid:{kind:'fluid'}},recipes:[
    {id:'registered',process:'electricSmelt',furnaceRegistry:true,inputs:{a:1},outputs:{b:1},power:4},
    {id:'electric-only',process:'electricSmelt',inputs:{b:1},outputs:{a:1},power:4},
    {id:'bad-fluid',process:'electricSmelt',furnaceRegistry:true,inputs:{a:1},outputs:{fluid:144},power:4}
  ]};
  applyFurnaceCatalog(model);applyFurnaceCatalog(model);
  assert.equal(model.recipes.length,5,'no duplicate routes, guessed electric conversions or fluid furnace outputs');
});

test('a fresh world builds a smeltery from accessible gathered resources with only a brick furnace',()=>{
  const g=new Game();g.state.lootSeed=123456;
  function collect(nodeId,item,amount){
    const node=c.gatherNodes.find(n=>n.id===nodeId);assert.ok(g.nodeAvailable(node),nodeId);
    let tries=0;
    while(g.quantity(item)<amount){assert.ok(tries++<1000,'gathering failed: '+item);g.collectDrops(node);}
  }
  function craft(id){
    const r=g.recipeById.get(id),before=Object.fromEntries(Object.keys(r.outputs).map(id=>[id,g.quantity(id)]));
    assert.equal(g.craft(id).ok,true,id);g.simulate(r.seconds);
    for(const [id,n]of Object.entries(r.outputs))assert.equal(g.quantity(id),before[id]+n);
  }
  function manual(output,ingredient){
    const r=c.recipes.find(r=>r.process==='craft'&&r.outputs[output]&&(!ingredient||r.inputs[ingredient]));
    assert.ok(r,output);craft(r.id);
  }
  collect('forest','wood',8);collect('surface','stone',32);collect('surface','flint',16);collect('river','clay',64);
  craft('sticks');craft('pick');
  collect('smallOre:Iron','ironCrushed',12);collect('coalVein','coal',24);
  const built=g.build('furnace');assert.equal(built.ok,true);const furnace=built.device;
  function smelt(id,batches=1){
    const r=g.recipeById.get(id),before=Object.fromEntries(Object.keys(r.outputs).map(id=>[id,g.quantity(id)]));
    assert.equal(g.assign(furnace.id,id).ok,true);if(!furnace.enabled)g.toggle(furnace.id);
    g.simulate(r.seconds*batches);assert.equal(g.forceStop(furnace.id).ok,true);
    for(const [id,n]of Object.entries(r.outputs))assert.equal(g.quantity(id),before[id]+n*batches);
  }
  smelt('mining:smelt:ironCrushed',12);craft('hammer');
  for(let i=0;i<3;i++)craft('ironPlateHand');manual('ironBucket');
  assert.equal(g.placeContainer('ironBucket').ok,true);
  manual('mortar');manual('knife');
  collect('sugarcaneBank','reeds',6);manual('paperPlate','reeds');manual('paperPlate','reeds');
  manual('modItem_TinkerConstruct_blankPattern_0');manual('nhItem_WoodenBrickForm');
  collect('river','sand',48);collect('surface','gravel',48);
  for(let i=0;i<32;i++)manual('clayDust','clay');
  for(let i=0;i<16;i++){
    collect('river','water',1000);manual('modItem_TinkerConstruct_CraftedSoil_1','clayDust');
  }
  for(let i=0;i<8;i++)manual('nhItem_UnfiredSearedBrick','modItem_TinkerConstruct_CraftedSoil_1');
  const route=c.recipes.find(r=>r.furnaceBatch?.fuel==='coal'&&r.outputs.modItem_TinkerConstruct_materials_2);
  const coal=g.quantity('coal');smelt(route.id,8);
  assert.equal(g.quantity('coal'),coal-8);assert.equal(g.quantity('modItem_TinkerConstruct_materials_2'),64);
  for(let i=0;i<5;i++){
    collect('river','water',1000);manual('modItem_TinkerConstruct_Smeltery_2','water');
  }
  manual('furnace','flint');manual('modItem_TinkerConstruct_Smeltery_0');
  manual('modItem_TinkerConstruct_CastingChannel_0');manual('modItem_TinkerConstruct_Smeltery_1');
  manual('modItem_TinkerConstruct_LavaTank_0');
  const result=g.build('smeltery');assert.equal(result.ok,true);
  assert.deepEqual(g.state.devices.map(d=>d.type),['furnace','smeltery']);
  assert.equal(g.quantity('modItem_TinkerConstruct_materials_2'),1);
  assert.equal(g.quantity('steam'),0);assert.equal(g.state.energy,0);
  assert.equal(g.state.stage,0,'the route does not require chapter advancement');
  assert.equal(g.quantity('water'),0,'all crafting water is taken from the placed bucket');
  assert.equal(g.quantity('nhItem_WoodenBrickForm'),1,'the brick form is reusable');
  assert.equal(g.state.containers.length,1,'only a real water bucket is needed');
  const restored=new Game(g.snapshot());assert.equal(restored.state.devices[1].type,'smeltery');
});
