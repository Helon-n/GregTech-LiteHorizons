import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {CATALOG as c} from '../src/data/catalog.js';
import {MAGIC_REFERENCE as magic} from '../src/data/magic-reference.js';
import {BOOTSTRAP_REFERENCE as bootstrap} from '../src/data/bootstrap-reference.js';
import {energyCapacity} from '../src/core/energy.js';
import {machineSupportsRecipe,requirementFailure,requirementLabels} from '../src/core/technology.js';
import {rollOutputs,validBatchOutputs} from '../src/core/recipe-yields.js';
import {deviceReadout} from '../src/device-readout.js';

function build(g,type){assert.equal(g.add(c.machines[type].cost),true);const result=g.build(type);assert.equal(result.ok,true);return result.device;}
function tank(g,fluid,amount=0,type='largeTank'){
  g.add({[type]:1});const result=g.placeContainer(type);assert.equal(result.ok,true);
  assert.equal(g.reserveContainer(result.container.id,fluid).ok,true);assert.equal(g.add({[fluid]:amount}),true);return result.container;
}

test('arcane batches spend all six primal charges once and preserve paid work through reload',()=>{
  const g=new Game(),d=build(g,'arcaneWorkbench'),r=c.recipes.find(r=>r.process==='arcaneCraft');
  assert.equal(r.requirements.vis,125);assert.equal(Object.values(r.inputs).reduce((a,b)=>a+b,0),9);
  g.add({...r.inputs,...r.tools});g.assign(d.id,r.id);g.tick(.5);
  assert.equal(d.job,null);assert.equal(g.quantity(Object.keys(r.inputs)[0]),r.inputs[Object.keys(r.inputs)[0]]);
  d.vis=125;g.tick(.5);assert.ok(d.job);assert.equal(d.vis,.25);
  const h=new Game(g.snapshot()),restored=h.state.devices[0],out=Object.keys(r.outputs)[0];
  h.simulate(r.seconds);assert.equal(h.quantity(out),1);assert.ok(restored.vis<125);assert.equal(restored.job,null);
  assert.equal(h.quantity(Object.keys(r.tools)[0]),1);assert.match(deviceReadout(h,restored),/原始灵气/);
  for(const value of [-1,151,NaN]){const save=g.snapshot();save.devices[0].vis=value;assert.throws(()=>new Game(save));}
});

test('essentia needs physical jars; Ichor requires paid research, all inputs and actual aspects',()=>{
  const g=new Game(),r=c.recipes.find(r=>r.process==='thaumicInfusion'),d=build(g,'infusionAltar');
  assert.equal(r.requirements.instability,10);assert.equal(r.outputs[Object.keys(r.outputs)[0]],2);
  for(const [key,n]of Object.entries({MAN:32,LIGHT:32,SOUL:64,ELDRITCH:16,ORDER:16}))assert.equal(r.inputs[magic.essentia[key]],n);
  const raw=Object.fromEntries(Object.entries(r.inputs).filter(([id])=>c.items[id].kind!=='fluid'));
  g.add(raw);assert.equal(g.add({[magic.essentia.MAN]:32}),false);
  for(const [id,n]of Object.entries(r.inputs))if(c.items[id].kind==='fluid')tank(g,id,n,'magicEssentiaJar');
  g.assign(d.id,r.id);g.tick(.5);assert.equal(d.job,null);assert.equal(g.quantity(magic.essentia.MAN),32);
  g.add(r.tools);g.tick(.5);assert.ok(d.job);assert.equal(g.quantity(magic.essentia.MAN),0);
  assert.equal(g.quantity(Object.keys(r.tools)[0]),1);g.simulate(r.seconds);assert.equal(g.quantity(Object.keys(r.outputs)[0]),2);
});

test('Botania coal is consumed over time in a physical pool and mana is charged once per batch',()=>{
  const g=new Game(),d=build(g,'botaniaWorkshop');g.add({coal:1});g.simulate(40);
  assert.equal(g.quantity('coal'),0);assert.equal(d.mana,1200);assert.equal(d.manaFuel,0);
  const r=c.recipes.find(r=>r.process==='manaInfuse'&&r.requirements.mana===3000);g.add(r.inputs);g.assign(d.id,r.id);g.tick(.5);assert.equal(d.job,null);
  d.mana=3000;g.tick(.5);assert.ok(d.job);assert.equal(d.mana,0);
  const saved=g.snapshot(),h=new Game(saved);h.simulate(1);assert.equal(h.quantity(Object.keys(r.outputs)[0]),1);
  assert.equal(h.state.devices[0].mana,0);assert.match(deviceReadout(h,h.state.devices[0]),/魔力池/);
  for(const [field,value]of [['mana',-1],['mana',1000001],['manaFuel',41]]){const save=g.snapshot();save.devices[0][field]=value;assert.throws(()=>new Game(save));}
  const terra=c.recipes.find(r=>r.process==='terraPlate');assert.equal(terra.requirements.mana,500000);assert.equal(Object.keys(terra.inputs).length,3);
  const gaia=c.recipes.find(r=>r.process==='gaiaEncounter');assert.deepEqual(gaia.inputs,{[bootstrap.mana.terra]:1});assert.deepEqual(gaia.outputs,{[bootstrap.mana.spirit]:8});assert.equal(Object.keys(gaia.tools).length,1);
  const full=new Game(),pool=build(full,'botaniaWorkshop');pool.mana=999990;full.add({coal:2});full.simulate(10);
  assert.equal(pool.mana,1000000);assert.equal(pool.manaFuel,30);assert.equal(full.quantity('coal'),1);
  full.simulate(40);assert.equal(pool.manaFuel,0);assert.equal(full.quantity('coal'),1);
});

test('space mining keeps module tiers, plasma, reusable drones, consumed drill heads and original power',()=>{
  const g=new Game(),d=build(g,'spaceMiner1'),r=c.recipes.find(r=>r.spaceMining?.asteroid==='lutetiumAsteroid');
  assert.equal(r.power,30720);assert.equal(r.seconds,25);assert.equal(r.requirements.computation,90);assert.equal(r.inputs.plasma,825);
  assert.equal(r.inputs.tungstensteelDrillHead,4);assert.equal(r.inputs.tungstensteelRod,4);
  assert.deepEqual(r.randomChoice,{weights:{telluriumOre:1500,thuliumOre:1000,tantalumOre:1500,lutetiumOre:500,redstoneOre:5500},count:64,rolls:20});
  assert.equal(g.setMachineLocation(d.id,'orbit').ok,false);build(g,'spaceElevator');assert.equal(g.setMachineLocation(d.id,'orbit').ok,true);
  assert.equal(g.add({plasma:825}),false);tank(g,'plasma',824);g.add({...r.tools,tungstensteelDrillHead:4,tungstensteelRod:4});g.assign(d.id,r.id);
  d.eu=energyCapacity(g,d);g.tick(.5);assert.equal(d.job,null);assert.equal(g.quantity('tungstensteelDrillHead'),4);
  g.add({plasma:1});const before=d.eu;g.nextDropRandom=()=>.2;g.tick(.5);
  assert.ok(d.job);assert.equal(g.quantity('plasma'),0);assert.equal(g.quantity('tungstensteelDrillHead'),0);assert.equal(g.quantity('tungstensteelRod'),0);
  assert.equal(g.quantity(Object.keys(r.tools)[0]),1);assert.equal(before-d.eu,30720*20*.5);
  assert.deepEqual(d.job.outputs,{thuliumOre:1280});const saved=new Game(g.snapshot());assert.deepEqual(saved.state.devices[0].job.outputs,d.job.outputs);
  const ruin=c.recipes.find(r=>r.spaceMining?.asteroid==='draconicCoreRuin');assert.equal(machineSupportsRecipe(c.machines.spaceMiner1,ruin),false);assert.equal(machineSupportsRecipe(c.machines.spaceMiner3,ruin),true);
  assert.equal(ruin.power,7864320);assert.equal(ruin.seconds,100);assert.equal(ruin.requirements.computation,1000);
  assert.ok(requirementLabels(g,ruin).some(label=>label.includes('太空采矿模块型号')));
  for(const head of ['naquadriaDrillHead','infinityDrillHead'])assert.ok(c.recipes.some(r=>r.process==='extrude'&&r.outputs[head]),head);
});

test('rare ruin outputs retain 1% / 1% / 98% exclusive probabilities, including empty saved batches',()=>{
  const r=c.recipes.find(r=>r.spaceMining?.asteroid==='draconicCoreRuin'),ids=Object.keys(r.outputs);
  const g=new Game();for(const [random,expected]of [[0,{[ids[0]]:1}],[.0099,{[ids[0]]:1}],[.01,{[ids[1]]:1}],[.0199,{[ids[1]]:1}],[.02,{}],[.9999,{}]]){
    g.nextDropRandom=()=>random;const outputs=rollOutputs(g,r);assert.deepEqual(outputs,expected);assert.equal(validBatchOutputs(r,outputs),true);
  }
  assert.equal(validBatchOutputs(r,{[ids[0]]:1,[ids[1]]:1}),false);
  const d=build(g,'spaceMiner3');build(g,'spaceElevator');g.setMachineLocation(d.id,'orbit');tank(g,'plasma',825);
  g.add({...r.inputs,plasma:0,...r.tools});d.eu=energyCapacity(g,d);g.assign(d.id,r.id);g.nextDropRandom=()=>.5;g.tick(.5);
  assert.deepEqual(d.job.outputs,{});const h=new Game(g.snapshot());assert.deepEqual(h.state.devices[0].job.outputs,{});
});

test('magical resource gates and mutually exclusive demon shards survive collector use',()=>{
  const g=new Game(),n=c.gatherNodes.find(n=>n.id==='demonGruntExpedition');g.add({flintPick:1});assert.equal(g.nodeAvailable(n),false);
  g.add({[magic.research.demon]:1});assert.equal(g.nodeAvailable(n),true);
  for(const [random,id]of [[.1,magic.resources.lifeShard],[.4,magic.resources.soulShard],[.9,null]]){
    g.nextDropRandom=()=>random;assert.deepEqual(g.collectDrops(n).drops,id?{[id]:1}:{});
  }
  const end=c.gatherNodes.find(n=>n.id==='endShardHunt');assert.equal(g.nodeAvailable(end),false);g.add({advancedRocket:1});assert.equal(g.nodeAvailable(end),true);
  assert.ok(Object.hasOwn(g.drops(n),magic.resources.soulShard));
  const sins=c.gatherNodes.find(n=>n.id==='netherSinExpedition');assert.equal(g.nodeAvailable(sins),false);
  g.add({[magic.research.eldritch]:1});assert.equal(g.nodeAvailable(sins),true);
  for(const [random,id]of [[0,magic.resources.prideShard],[.4,magic.resources.lustShard],[.8,magic.resources.gluttonyShard]]){g.nextDropRandom=()=>random;assert.deepEqual(g.collectDrops(sins).drops,{[id]:1});}
});

test('Deep Dark portal keeps its real UIV parts, research, seven aspects, and physical output',()=>{
  const g=new Game(),r=c.recipes.find(r=>r.outputs[magic.resources.deepdarkPortal]),d=build(g,'infusionAltar');
  assert.equal(r.origin.file,'NewHorizonsCoreMod/com/dreammaster/scripts/ScriptTCCoreMod.java');assert.equal(r.origin.line,213);
  assert.equal(r.requirements.instability,32);assert.equal(r.inputs.gtItem_Block_BedrockiumCompressed,1);assert.equal(r.inputs.gtItem_Field_Generator_UIV,4);
  assert.equal(r.inputs.modItem_EternalSingularity_eternalsingularity_0,4);
  for(const key of ['VOID','TEMPUS','LUST','GLUTTONY','PRIDE','ELDRITCH','ULTRA_DEATH']){assert.equal(r.inputs[magic.essentia[key]],512);for(let i=0;i<8;i++)tank(g,magic.essentia[key],64,'magicEssentiaJar');}
  g.add(Object.fromEntries(Object.entries(r.inputs).filter(([id])=>c.items[id].kind!=='fluid')));g.assign(d.id,r.id);g.tick(.5);assert.equal(d.job,null);
  g.add(r.tools);g.tick(.5);assert.ok(d.job);for(const key of ['VOID','TEMPUS','LUST','GLUTTONY','PRIDE','ELDRITCH','ULTRA_DEATH'])assert.equal(g.quantity(magic.essentia[key]),0);
  g.simulate(r.seconds);assert.equal(g.quantity(magic.resources.deepdarkPortal),1);assert.equal(g.quantity(magic.research.deepdark),1);
  const mining=c.recipes.find(r=>r.process==='voidMine1'&&r.outputs.darkIronOre);assert.equal(mining.tools[magic.resources.deepdarkPortal],1);
});

test('Bloody Ichorium needs the fifth altar, real Ichorium and 50000 contained LP for 2500 ticks',()=>{
  const g=new Game(),d=build(g,'bloodAltar5'),r=c.recipes.find(r=>r.process==='bloodAltar');
  assert.equal(r.requirements.bloodAltarTier,5);assert.equal(r.seconds,125);assert.equal(r.inputs[magic.lifeEssence],50000);
  const solids=Object.fromEntries(Object.entries(r.inputs).filter(([id])=>c.items[id].kind!=='fluid'));g.add(solids);
  assert.equal(g.add({[magic.lifeEssence]:50000}),false);tank(g,magic.lifeEssence,49999);
  assert.equal(g.assign(d.id,r.id).ok,true);g.tick(.5);assert.equal(d.job,null);
  for(const [id,n]of Object.entries(solids))assert.equal(g.quantity(id),n);
  g.add({[magic.lifeEssence]:1});g.tick(.5);assert.ok(d.job);assert.equal(g.quantity(magic.lifeEssence),0);
  const h=new Game(g.snapshot());h.simulate(124);assert.equal(h.quantity(Object.keys(r.outputs)[0]),0);
  h.simulate(.5);assert.equal(h.quantity(Object.keys(r.outputs)[0]),1);assert.equal(h.state.devices[0].job,null);
});

test('BEC starts with a paid UIV feed and later voltages still require paid hatch upgrades',()=>{
  const g=new Game(),d=build(g,'becassembler');assert.equal(d.energyTier,11);d.enabled=false;
  const cost=g.energyUpgradeCost(d);assert.equal(g.upgradeEnergy(d.id).ok,false);g.add(cost);assert.equal(g.upgradeEnergy(d.id).ok,true);
  assert.equal(d.energyTier,12);for(const id of Object.keys(cost))assert.equal(g.quantity(id),0);
  assert.equal(new Game(g.snapshot()).state.devices[0].energyTier,12);
});
