import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {energyCapacity} from '../src/core/energy.js';
import {migrateCatalogIdentities} from '../src/core/identity-migration.js';
import {validBatchOutputs} from '../src/core/recipe-yields.js';

function build(g,type,tier){
  g.add(g.catalog.machines[type].cost);const result=g.build(type);assert.equal(result.ok,true);
  result.device.energyTier=tier;return result.device;
}
function stock(g,stacks){
  for(const [id,n]of Object.entries(stacks))if(g.catalog.items[id].kind==='fluid'){
    g.add({largeTank:1});const placed=g.placeContainer('largeTank');assert.equal(placed.ok,true);
    assert.equal(g.reserveContainer(placed.container.id,id).ok,true);
  }
  assert.equal(g.add(stacks),true);
}
function execute(g,d,r){
  assert.equal(g.assign(d.id,r.id).ok,true);const run=g.deviceRuntime(d,r);assert.equal(run.valid,true);
  let eu=0;
  for(let elapsed=0;elapsed<run.seconds-1e-8;elapsed+=.5){
    d.eu=energyCapacity(g,d);const before=d.eu;g.tick(Math.min(.5,run.seconds-elapsed));eu+=before-d.eu;
  }
  assert.equal(d.job,null);assert.ok(Math.abs(eu-run.power*20*run.seconds)<.001);
}

test('native Tesseract recycling provides eight solid Transcendent Metal dust at full UIV energy cost',()=>{
  const g=new Game();g.state.stage=15;
  const r=g.catalog.recipes.find(r=>r.process==='grind'&&r.inputs.gtItem_Tesseract&&r.outputs.transcendentMetalDust);
  assert.ok(r);assert.equal(r.origin.file,'gregtech/common/items/MetaGeneratedItem02.java');
  assert.deepEqual(r.inputs,{gtItem_Tesseract:1});assert.deepEqual(r.outputs,{transcendentMetalDust:8});
  assert.equal(r.power,31457280);assert.equal(r.seconds,5);
  const d=build(g,'electricMacerator',11);stock(g,r.inputs);execute(g,d,r);
  assert.equal(g.quantity('gtItem_Tesseract'),0);assert.equal(g.quantity('transcendentMetalDust'),8);
});

test('Proto-Halkonite fine wire uses the native hot-part bath then both cooling fluids',()=>{
  const g=new Game();g.state.stage=15;
  const bath=g.catalog.recipes.find(r=>r.process==='chemicalBath'&&r.inputs.infinityFineWire&&r.outputs.hotProtoHalkoniteFineWire);
  const cold=g.catalog.recipes.find(r=>r.process==='freeze'&&r.inputs.hotProtoHalkoniteFineWire&&r.outputs.protoHalkoniteFineWire);
  assert.deepEqual(bath.inputs,{infinityFineWire:8,moltenProtoHalkoniteBase:144});assert.equal(bath.seconds,8);
  assert.deepEqual(cold.inputs,{hotProtoHalkoniteFineWire:8,dimensionallyShiftedSuperfluid:36,superCoolant:576});
  assert.equal(cold.seconds,1);assert.equal(cold.power,31457280);
  stock(g,bath.inputs);execute(g,build(g,'chemicalBath',10),bath);
  stock(g,{dimensionallyShiftedSuperfluid:36,superCoolant:576});execute(g,build(g,'vacuumFreezer',11),cold);
  assert.equal(g.quantity('protoHalkoniteFineWire'),8);assert.equal(g.quantity('hotProtoHalkoniteFineWire'),0);
  assert.equal(g.quantity('dimensionallyShiftedSuperfluid'),0);assert.equal(g.quantity('superCoolant'),0);
});

test('plasma forge accepts the native billion-EU spacetime recipe through its multi-amp feed',()=>{
  const g=new Game();g.state.stage=15;
  const r=g.catalog.recipes.find(r=>r.process==='plasmaForge'&&r.outputs.spacetimeMolten===144&&r.power===1000000000);
  assert.ok(r);assert.equal(r.seconds,40);assert.equal(r.requirements.heat,12600);
  const d=build(g,'plasmaForge',11);d.coil='gtItem_Casing_Coil_Hypogen';
  assert.equal(g.deviceRuntime(d,r).valid,true);
  assert.equal(g.deviceRuntime(d,r).power,1000000000);assert.equal(g.deviceRuntime(d,r).seconds,40);
  stock(g,r.inputs);g.add({largeTank:1});g.placeContainer('largeTank');
  execute(g,d,r);assert.equal(g.quantity('spacetimeMolten'),144);
  d.energyTier=10;assert.equal(g.deviceRuntime(d,r).valid,false);
});

test('registered Core circuits can be wrapped with the original sixteen-circuit and solder recipe',()=>{
  const g=new Game();g.state.stage=15;
  for(const [tier,item]of [['UMV','nhItem_PikoCircuit'],['UXV','nhItem_QuantumCircuit'],['MAX','nhItem_PlanckCircuit']]){
    const r=g.catalog.recipes.find(r=>r.process==='assemble'&&r.inputs[item]===16&&r.outputs['circuitWrap'+tier]===1);
    assert.ok(r,tier);assert.equal(r.inputs.solderingAlloyMolten,72);assert.equal(r.seconds,30);assert.equal(r.power,30);
    assert.equal(r.circuit,16);assert.equal(r.origin.file,'goodgenerator/loader/ComponentAssemblyLineMiscRecipes.java');
    stock(g,r.inputs);execute(g,build(g,'assembler',1),r);assert.equal(g.quantity('circuitWrap'+tier),1);
  }
});

test('GT++ ingots are physical items: 144 mB solidifies into one ingot, then eight Rhugnor bolts',()=>{
  const g=new Game();g.state.stage=15;
  assert.equal(g.catalog.items.gTPP_RhugnorIngot.kind,'item');assert.equal(g.catalog.items.gTPP_RhugnorMolten.kind,'fluid');
  const cast=g.catalog.recipes.find(r=>r.process==='solidify'&&r.outputs.gTPP_RhugnorIngot);
  const bolts=g.catalog.recipes.find(r=>r.process==='extrude'&&r.outputs.gTPP_RhugnorBolt);
  assert.deepEqual(cast.inputs,{gTPP_RhugnorMolten:144});assert.deepEqual(bolts.inputs,{gTPP_RhugnorIngot:1});
  stock(g,{...cast.inputs,...cast.tools,...bolts.tools});execute(g,build(g,'fluidSolidifier',9),cast);
  assert.equal(g.state.inventory.gTPP_RhugnorIngot,1);assert.equal(g.quantity('gTPP_RhugnorMolten'),0);
  execute(g,build(g,'extruder',9),bolts);assert.equal(g.quantity('gTPP_RhugnorBolt'),8);
  assert.equal(g.quantity('gTPP_RhugnorIngot'),0);
  for(const [id,n]of Object.entries(bolts.tools))assert.equal(g.quantity(id),n);
  assert.equal(new Game(g.snapshot()).quantity('gTPP_RhugnorBolt'),8);
});

test('old GT++ tanks and pending ingot outputs migrate separately and only once',()=>{
  const g=new Game();g.state.stage=15;
  const [oldId,id]=Object.entries(g.catalog.recipeIdentityMigrations).find(([oldId,id])=>g.catalog.recipeOutputIdentityMigrations[oldId]?.gTPP_Rhugnor==='gTPP_RhugnorIngot'&&g.recipeById.get(id)?.process==='solidify');
  assert.ok(oldId);const r=g.recipeById.get(id),d=build(g,'fluidSolidifier',9);
  stock(g,{gTPP_RhugnorMolten:4321});d.recipe=id;d.enabled=true;
  d.job={remaining:r.seconds/2,duration:r.seconds,outputs:{gTPP_RhugnorIngot:1}};
  const raw=g.snapshot();raw.devices.find(x=>x.id===d.id).recipe=oldId;
  raw.devices.find(x=>x.id===d.id).job.outputs={gTPP_Rhugnor:1};
  raw.containers.find(x=>x.fluid==='gTPP_RhugnorMolten').fluid='gTPP_Rhugnor';
  const h=new Game(raw),again=new Game(h.snapshot()),loaded=h.state.devices.find(x=>x.id===d.id);
  assert.equal(h.quantity('gTPP_RhugnorMolten'),4321);assert.equal(again.quantity('gTPP_RhugnorMolten'),4321);
  assert.deepEqual(loaded.job.outputs,{gTPP_RhugnorIngot:1});assert.equal(loaded.job.remaining,r.seconds/2);
  assert.deepEqual(again.state.devices,h.state.devices);
  loaded.eu=energyCapacity(h,loaded);
  for(let remaining=r.seconds/2;remaining>1e-8;remaining-=.5)h.tick(Math.min(.5,remaining));
  assert.equal(h.quantity('gTPP_RhugnorIngot'),1);assert.equal(h.quantity('gTPP_RhugnorMolten'),4321);
});

test('pending Godforge batches correct the former 1000/144 fluid conversion without duplicating tanks or EU',()=>{
  const g=new Game(),c=g.catalog;
  const [oldId,factors]=Object.entries(c.recipeOutputFactors).find(([,f])=>f.gTPP_Hypogen);
  assert.ok(oldId);assert.equal(factors.gTPP_Hypogen,.144);
  const r=g.recipeById.get(c.recipeIdentityMigrations[oldId]);
  const raw={inventory:{},earned:{},containers:[{fluid:'gTPP_Hypogen',amount:9000}],devices:[{recipe:oldId,eu:123,job:{remaining:5,duration:10,outputs:{gTPP_Hypogen:1000},prepaidEU:987654321}}]};
  const migrated=migrateCatalogIdentities(raw,c),again=migrateCatalogIdentities(migrated,c);
  assert.equal(migrated.containers[0].amount,9000);assert.equal(migrated.containers[0].fluid,'gTPP_HypogenMolten');
  assert.equal(migrated.devices[0].eu,123);assert.equal(migrated.devices[0].job.prepaidEU,987654321);
  assert.equal(migrated.devices[0].job.remaining,5);assert.equal(validBatchOutputs(r,migrated.devices[0].job.outputs),true);
  assert.deepEqual(migrated.devices[0].job.outputs,{gTPP_HypogenMolten:144});assert.deepEqual(again,migrated);
});
