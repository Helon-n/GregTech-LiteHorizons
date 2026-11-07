import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG as c} from '../src/data/catalog.js';
import {Game} from '../src/core/engine.js';
import {machineSupportsRecipe} from '../src/core/technology.js';
import {migrateRecipeFavorites} from '../src/core/identity-migration.js';

test('bronze chapter reaches its circuit, motor and casting infrastructure using only available materials',()=>{
  const known=new Set(),built=new Set();let changed=true;
  while(changed){
    changed=false;
    const add=id=>{
      if(c.items[id].kind==='fluid'&&!Object.entries(c.containerTypes).some(([type,v])=>known.has(type)&&(!v.accepts||v.accepts.includes(id))))return;
      if(!known.has(id)){known.add(id);changed=true;}
    };
    for(const n of c.gatherNodes){
      if(n.stage>1||n.requires&&!known.has(n.requires)||n.stage===0&&!['forest','surface','river'].includes(n.id)&&!known.has('flintPick'))continue;
      Object.keys(c.nodeDrops[n.id]??{[n.output]:1}).forEach(add);
    }
    for(const m of Object.values(c.machines))if(m.stage<=1&&!built.has(m.id)&&Object.keys(m.cost).every(id=>known.has(id))){built.add(m.id);changed=true;}
    for(const r of c.recipes)if(r.stage<=1&&Object.keys({...r.inputs,...r.tools}).every(id=>known.has(id))&&(r.process==='craft'||[...built].some(id=>machineSupportsRecipe(c.machines[id],r))))Object.keys(r.outputs).forEach(add);
  }
  for(const id of ['basicCircuit','motor','vacuumTube','redAlloyCable1','tinCable1','rubberPlate','gtItem_Shape_Mold_Ball','gtItem_Shape_Mold_Plate'])assert.ok(known.has(id),id);
  for(const m of Object.values(c.machines).filter(m=>m.stage<=1))assert.ok(built.has(m.id),m.id);
});

function bronzeWorld(){const g=new Game();g.state.stage=1;return g;}
function build(g,type){g.add(g.catalog.machines[type].cost);const result=g.build(type);assert.equal(result.ok,true);return result.device;}
function tank(g,fluid,amount){g.add({fluidTank:1});const result=g.placeContainer('fluidTank');assert.equal(result.ok,true);g.reserveContainer(result.container.id,fluid);assert.equal(g.add({[fluid]:amount}),true);return result.container;}

test('wet paper crafting uses gathered water and keeps the placed bucket across crafting and reload',()=>{
  const g=bronzeWorld(),r=c.recipes.find(r=>r.process==='craft'&&r.outputs.paperPlate&&r.inputs.woodDust&&r.inputs.water);
  assert.ok(r);g.add({woodDust:8,ironBucket:1});assert.equal(g.placeContainer('ironBucket').ok,true);
  assert.equal(g.add({water:1000}),true);assert.equal(g.craft(r.id).ok,true);g.simulate(r.seconds);
  assert.equal(g.quantity('paperPlate'),r.outputs.paperPlate);assert.equal(g.quantity('water'),0);assert.equal(g.quantity('woodDust'),0);
  const h=new Game(g.snapshot());assert.equal(h.state.containers.filter(v=>v.type==='ironBucket').length,1);assert.equal(h.quantity('ironBucket'),0);
});

test('rubber insulation consumes two ingots, retains its mold and pays the full steam cost',()=>{
  const g=bronzeWorld(),d=build(g,'alloySmelter'),r=c.recipes.find(r=>r.process==='alloy'&&r.outputs.rubberPlate);
  assert.ok(r);assert.equal(r.stage,1);assert.equal(r.inputs.rubber,2);
  g.add({rubber:2,...r.tools});const source=tank(g,'steam',16000);
  assert.equal(g.setSupply(d.id,'storage',source.id).ok,true);assert.equal(g.assign(d.id,r.id).ok,true);
  const run=g.deviceRuntime(d,r);assert.equal(run.valid,true);g.simulate(run.seconds);
  assert.equal(g.quantity('rubberPlate'),1);assert.equal(g.quantity('rubber'),0);assert.equal(g.quantity('gtItem_Shape_Mold_Plate'),1);
  assert.ok(Math.abs(g.quantity('steam')+d.steam-(16000-run.steamPerSecond*run.seconds))<1e-6);
});

test('native stone melting and Core basin casting preserve their distinct 18 and 360 mB yields',()=>{
  const g=bronzeWorld(),d=build(g,'smeltery');tank(g,'lava',1000);tank(g,'searedStone',0);
  const r=c.recipes.find(r=>r.process==='smelteryMelt'&&r.inputs.stone&&r.outputs.searedStone);
  assert.ok(r);g.add({stone:1});assert.equal(g.assign(d.id,r.id).ok,true);g.simulate(r.seconds+1);
  assert.equal(g.quantity('stone'),0);assert.equal(g.quantity('searedStone'),18);
  const basin=build(g,'castingbasin'),cast=c.recipes.find(r=>r.process==='basinCast'&&r.outputs.modItem_TinkerConstruct_Smeltery_4);
  assert.ok(cast);g.add({searedStone:342});assert.equal(g.assign(basin.id,cast.id).ok,true);g.simulate(cast.seconds);
  assert.equal(g.quantity('searedStone'),0);assert.equal(g.quantity('modItem_TinkerConstruct_Smeltery_4'),1);
});

test('LV blast furnace uses four physical battery amps for gallium arsenide and requires coils',()=>{
  const g=new Game();g.state.stage=2;
  const d=build(g,'ebf'),r=c.recipes.find(r=>r.process==='electricBlast'&&r.outputs.gtItem_GalliumArsenideCrystal&&r.inputs.galliumDust);
  assert.ok(r);assert.equal(r.power,120);assert.equal(r.seconds,60);
  g.add({...r.inputs});assert.equal(g.assign(d.id,r.id).ok,true);g.tick(.5);assert.equal(d.job,null);
  d.enabled=false;g.add({gtItem_Casing_Coil_Cupronickel:16});assert.equal(g.installCoil(d.id,'gtItem_Casing_Coil_Cupronickel').ok,true);
  const boxes=Array.from({length:2},()=>{const b=build(g,'batteryBuffer');g.add({batteryLV:2});for(let i=0;i<2;i++)assert.equal(g.changeBattery(b.id,true).ok,true);b.eu=100000;return b;});
  const grouped=g.saveGroup('device','LV 能源仓',boxes.map(b=>b.id));assert.equal(grouped.ok,true);
  assert.equal(g.setSupply(d.id,'storage',g.state.groups[0].id).ok,true);d.enabled=true;
  assert.equal(g.deviceRuntime(d,r).valid,true);g.simulate(60);
  assert.equal(g.quantity('gtItem_GalliumArsenideCrystal'),1);
  assert.equal(boxes.reduce((n,b)=>n+b.eu,0)+d.eu,200000-144000);
  for(const id of Object.keys(r.inputs))assert.equal(g.quantity(id),0);
  assert.equal(g.deviceRuntime(build(g,'assembler'),r).valid,false);
  assert.doesNotThrow(()=>new Game(g.snapshot()));
});

test('registry migration retains tank amounts, paid machine batches, plans and favorites',()=>{
  const g=new Game();g.state.stage=15;
  const [oldId,id]=Object.entries(c.recipeIdentityMigrations).find(([,id])=>c.recipes.find(r=>r.id===id)?.process==='cut'),r=g.recipeById.get(id),d=build(g,'cuttingMachine');
  const source=tank(g,'water',4321);g.add(r.inputs);assert.equal(g.assign(d.id,id).ok,true);
  g.tick(.5); // no power: create a paid in-flight batch explicitly below
  const raw=g.snapshot(),saved=raw.devices.find(x=>x.id===d.id);
  saved.recipe=oldId;saved.job={remaining:r.seconds/2,duration:r.seconds,outputs:{...r.outputs}};
  saved.fluidInputs={gTPP_Water:source.id};saved.fluidOutputs={gTPP_Water:source.id};
  raw.containers.find(x=>x.id===source.id).fluid='gTPP_Water';
  raw.earned.gTPP_Water=20;raw.earned.water=10;
  raw.inventory.gTPP_RhodiumDust=2;raw.inventory.werkstoffLoader_RhodiumDust=3;
  raw.inventory.gTPP_RutheniumDust=7;
  raw.productionPlan={id:'p999',root:oldId,batches:1,steps:[{recipe:oldId,batches:1,done:0}],paused:true,cancelled:false,status:'已暂停'};
  const h=new Game(raw),again=new Game(h.snapshot()),loaded=h.state.devices.find(x=>x.id===d.id);
  assert.equal(h.quantity('water'),g.quantity('water'));assert.equal(h.state.earned.water,30);
  assert.equal(h.quantity('werkstoffLoader_RhodiumDust'),5);assert.equal(h.quantity('werkstoffLoader_RutheniumDust'),7);
  assert.equal(again.quantity('werkstoffLoader_RhodiumDust'),5);assert.equal(again.quantity('werkstoffLoader_RutheniumDust'),7);
  assert.equal(loaded.recipe,id);assert.deepEqual(loaded.job,saved.job);assert.deepEqual(loaded.fluidInputs,{water:source.id});
  assert.equal(h.state.productionPlan.root,id);assert.equal(h.state.productionPlan.steps[0].recipe,id);
  assert.deepEqual(again.state.devices,h.state.devices);assert.equal(again.quantity('water'),h.quantity('water'));
  const favorite={key:oldId,recipeId:oldId,itemId:'gTPP_Water',tab:'recipes',mode:'uses'};
  assert.deepEqual(migrateRecipeFavorites([favorite,{...favorite,key:id,recipeId:id}],c),[{...favorite,key:id,recipeId:id,itemId:'water'}]);
  const invalid=structuredClone(raw);invalid.earned.gTPP_Water=-1;assert.throws(()=>new Game(invalid));
});

test('renamed manual recipes retain their paid queue and cancellation refund without duplicate glass stacks',()=>{
  const [oldId,id]=Object.entries(c.recipeIdentityMigrations).find(([,id])=>c.recipes.find(r=>r.id===id)?.process==='craft'),g=new Game();g.state.stage=15;
  const r=g.recipeById.get(id);g.add({...r.inputs,...r.tools});assert.equal(g.craft(id).ok,true);
  const raw=g.snapshot();raw.queue[0].recipe=oldId;raw.queue[0].remaining=r.seconds/2;
  raw.inventory.borosilicateGlassBlock=2;raw.inventory.modItem_BartWorks_BWTieredGlass_0=3;
  const h=new Game(raw);assert.equal(h.state.queue[0].recipe,id);assert.equal(h.state.queue[0].remaining,r.seconds/2);
  assert.equal(h.quantity('modItem_BartWorks_BWTieredGlass_0'),5);assert.equal(h.quantity('borosilicateGlassBlock'),0);
  assert.equal(h.cancelQueue(0).ok,true);for(const [item,n]of Object.entries(r.inputs))assert.equal(h.quantity(item),n+(r.tools?.[item]??0));
  assert.equal(new Game(h.snapshot()).quantity('modItem_BartWorks_BWTieredGlass_0'),5);
});
