import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {CATALOG as c} from '../src/data/catalog.js';

test('starter smeltery infrastructure reaches the basin, table, reusable casts and copper ingot without electricity',()=>{
  const g=new Game(),brick='modItem_TinkerConstruct_materials_2',block='modItem_TinkerConstruct_Smeltery_2';
  g.add({...c.machines.smeltery.cost,[brick]:50,ironBucket:1,bronzePlate:24,glass:8,stone:20,brassDust:2,copperDust:1,iron:1});
  const smeltery=g.build('smeltery').device;assert.ok(smeltery);
  assert.equal(g.placeContainer('ironBucket',1,'water').ok,true);
  const collect=(node,item,amount)=>{let attempts=0;const n=c.gatherNodes.find(n=>n.id===node);assert.equal(g.nodeAvailable(n),true);while(g.quantity(item)<amount){assert.ok(attempts++<1000);g.collectDrops(n);}};
  function craft(output){
    const r=c.recipes.find(r=>r.process==='craft'&&r.outputs[output]);assert.ok(r,output);
    assert.equal(g.craft(r.id).ok,true,output);g.simulate(r.seconds);
  }
  for(let i=0;i<4;i++){craft('fluidTank');assert.equal(g.placeContainer('fluidTank',1,['lava','searedStone','brassMolten','copperMolten'][i]).ok,true);}
  collect('lavaPool','lava',16000);
  for(let i=0;i<6;i++){collect('river','water',1000);craft(block);}
  craft('modItem_TinkerConstruct_SearedBlock_2');const basin=g.build('castingbasin').device;assert.ok(basin);
  function run(d,r,batches=1,extra=0){
    assert.ok(r);assert.equal(g.assign(d.id,r.id).ok,true);if(!d.enabled)g.toggle(d.id);
    g.simulate(r.seconds*batches+extra);assert.equal(g.forceStop(d.id).ok,true);
  }
  run(smeltery,c.recipes.find(r=>r.process==='smelteryMelt'&&r.inputs.stone),20,10);
  assert.equal(g.quantity('searedStone'),360);
  run(basin,c.recipes.find(r=>r.process==='basinCast'&&r.outputs.modItem_TinkerConstruct_Smeltery_4));
  assert.equal(g.quantity('modItem_TinkerConstruct_Smeltery_4'),1);
  craft('modItem_TinkerConstruct_SearedBlock_0');const table=g.build('castingtable').device;assert.ok(table);
  run(smeltery,c.recipes.find(r=>r.process==='smelteryMelt'&&r.inputs.brassDust),2,1);
  const cast='modItem_TinkerConstruct_metalPattern_0';
  run(table,c.recipes.find(r=>r.process==='tableCast'&&r.outputs[cast]&&r.tools?.iron));
  assert.equal(g.quantity(cast),1);assert.equal(g.quantity('iron'),1,'casting the mold retains its template');
  run(smeltery,c.recipes.find(r=>r.process==='smelteryMelt'&&r.inputs.copperDust),1,1);
  run(table,c.recipes.find(r=>r.process==='tableCast'&&r.outputs.copper));
  assert.equal(g.quantity('copper'),1);assert.equal(g.quantity(cast),1,'the cast is reusable');
  assert.equal(g.quantity('copperMolten'),0);assert.equal(g.quantity('brassMolten'),144);
  assert.equal(g.state.stage,0);assert.equal(g.state.energy,0);
  assert.doesNotThrow(()=>new Game(g.snapshot()));
});

test('both starter cast families have brass sources and honor the pack gold restriction and Core casting delays',()=>{
  for(const [meta,shape]of [[0,'iron'],[27,'ironNugget']]){
    const id='modItem_TinkerConstruct_metalPattern_'+meta;
    const r=c.recipes.find(r=>r.process==='tableCast'&&r.outputs[id]&&r.tools?.[shape]);
    assert.ok(r);assert.deepEqual(r.inputs,{brassMolten:144});assert.equal(r.seconds,2.5);
    assert.equal(r.casting.consumed,false);
    assert.ok(!c.recipes.some(r=>r.outputs[id]&&r.inputs.goldMolten),'GTNH disables gold casts');
  }
  assert.equal(c.recipes.find(r=>r.process==='tableCast'&&r.outputs.copper).seconds,5);
  assert.equal(c.recipes.find(r=>r.process==='tableCast'&&r.outputs.iron).seconds,4);
  assert.equal(c.recipes.find(r=>r.process==='tableCast'&&r.outputs.modItem_TinkerConstruct_materials_12).seconds,10);
  assert.ok(!c.recipes.some(r=>r.process==='tableCast'&&r.outputs.aluminium),'raw aluminium must not become refined GT aluminium');
});
