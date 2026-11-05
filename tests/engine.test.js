import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {CATALOG,recipes,machines,STAGES} from '../src/data/catalog.js';
import {generatorFuel,energyCapacity} from '../src/core/energy.js';
function tanks(g,count=3){g.add({largeTank:count});for(let i=0;i<count;i++)assert.equal(g.placeContainer('largeTank').ok,true);}

test('catalog IDs and all costs / recipes refer to known items',()=>{
  assert.equal(new Set(recipes.map(r=>r.id)).size,recipes.length);
  for(const r of recipes){assert.ok(r.seconds>0,r.id);assert.ok(r.stage<STAGES.length,r.id);for(const o of [r.inputs,r.outputs,r.tools||{}])for(const[id,n]of Object.entries(o)){assert.ok(CATALOG.items[id],r.id+' unknown '+id);assert.ok(Number.isFinite(n)&&n>0,r.id);}}
  for(const m of Object.values(machines))for(const id of Object.keys(m.cost))assert.ok(CATALOG.items[id],m.id+' '+id);
});

test('every chapter goal and machine can be reached without future-stage ingredients',()=>{
  const known=new Set(),built=new Set();
  for(let stage=0;stage<STAGES.length;stage++){
    let changed=true;
    while(changed){changed=false;const add=id=>{if(CATALOG.items[id].kind==='fluid'&&!Object.entries(CATALOG.containerTypes).some(([type,c])=>known.has(type)&&(!c.accepts||c.accepts.includes(id))))return;if(!known.has(id)){known.add(id);changed=true;}};
      for(const n of CATALOG.gatherNodes){if(n.stage>stage)continue;if(n.id==='belt'&&!known.has('advancedRocket'))continue;if(['moon','mars'].includes(n.id)&&!known.has('rocket'))continue;if(n.stage===0&&!['forest','surface','river'].includes(n.id)&&!known.has('flintPick'))continue;Object.keys(CATALOG.nodeDrops[n.id]||{[n.output]:n.amount}).forEach(add);}
      for(const m of Object.values(machines)){if(m.stage<=stage&&Object.keys(m.cost).every(id=>known.has(id))&&!built.has(m.id)){built.add(m.id);add(m.id);}}
      for(const r of recipes){if(r.stage<=stage&&Object.keys({...r.inputs,...r.tools}).every(id=>known.has(id))&&(r.process==='craft'||[...built].some(id=>machines[id].processes.includes(r.process))))Object.keys(r.outputs).forEach(add);}
    }
    for(const id of Object.keys(CATALOG.milestones[stage]))assert.ok(known.has(id),`Chapter ${stage} cannot reach ${id}`);
    for(const m of Object.values(machines).filter(x=>x.stage<=stage))assert.ok(built.has(m.id),`Chapter ${stage} cannot build ${m.id}`);
  }
});

test('manual gathering advances only with clicks and drops exactly once at completion',()=>{
  const g=new Game();assert.equal(g.gather('copperVein').ok,false);
  assert.equal(g.gather('forest').clicks,1);g.simulate(3600);
  assert.equal(g.state.gatherProgress.forest,1);assert.equal(g.quantity('wood'),0);
  assert.equal(g.gather('river').ok,true);assert.equal(g.state.gatherProgress.forest,1);
  assert.equal(g.gather('forest').completed,false);assert.equal(g.gather('forest').completed,false);
  const result=g.gather('forest');assert.equal(result.completed,true);assert.ok(result.drops.wood>=1&&result.drops.wood<=3);
  assert.equal(g.quantity('wood'),result.drops.wood);assert.ok(g.quantity('resin')>=0&&g.quantity('resin')<=2);assert.equal(g.state.gatherProgress.forest,0);
  assert.equal(g.gather('forest').completed,false);assert.equal(g.quantity('wood'),result.drops.wood);
});

test('click progress survives saves and old timers migrate without advancing during offline simulation',()=>{
  const g=new Game();g.gather('forest');g.gather('river');const loaded=new Game(g.snapshot());
  assert.deepEqual(loaded.state.gatherProgress,{forest:1,river:1});loaded.simulate(120);
  assert.deepEqual(loaded.state.gatherProgress,{forest:1,river:1});assert.deepEqual(loaded.state.inventory,{});
  const old=g.snapshot();delete old.gatherProgress;old.manual={id:'forest',remaining:1};old.inventory={wood:7};old.earned={wood:7};
  const migrated=new Game(old);assert.equal(migrated.state.gatherProgress.forest,2);assert.equal(migrated.state.manual,null);migrated.simulate(10);assert.equal(migrated.quantity('wood'),7);
  migrated.gather('forest');migrated.gather('forest');assert.ok(migrated.quantity('wood')>=8&&migrated.quantity('wood')<=10);
  for(const progress of [{forest:-1},{forest:4},{forest:1.5},{unknown:1},[]]){const raw=g.snapshot();raw.gatherProgress=progress;assert.throws(()=>new Game(raw));}
});

test('all unlocked resource nodes award their declared drops after the required number of clicks',()=>{
  const g=new Game();g.state.stage=15;tanks(g,8);g.add({flintPick:1,rocket:1,advancedRocket:1});
  for(const node of CATALOG.gatherNodes){
    const before=Object.fromEntries(Object.keys(CATALOG.items).map(id=>[id,g.quantity(id)])),expected=g.dropRanges(node);
    for(let i=1;i<g.gatherClicks(node);i++){assert.equal(g.gather(node.id).completed,false);for(const id of Object.keys(expected))assert.equal(g.quantity(id),before[id]);}
    const outcome=g.gather(node.id);assert.equal(outcome.completed,true);
    for(const[id,{min,max}]of Object.entries(expected)){const count=outcome.drops[id]||0;assert.ok(count>=min&&count<=max,node.id+' '+id);assert.equal(g.quantity(id),before[id]+count);}
  }
  assert.equal(new Game().gather('moon').ok,false);assert.equal(g.gather('unknown').ok,false);
});

test('craft queues are sequential, reserve materials, and refund remaining batches',()=>{
  const g=new Game();g.add({wood:10});assert.equal(g.craft('sticks',5).ok,true);assert.equal(g.quantity('wood'),5);g.simulate(2);assert.equal(g.quantity('stick'),8);assert.equal(g.state.queue[0].amount,3);g.cancelQueue(0);assert.equal(g.quantity('wood'),8);assert.equal(g.state.queue.length,0);assert.equal(g.craft('sticks',-5).ok,false);
});

test('one machine cannot auto-run several recipes; times and input conservation hold',()=>{
  const g=new Game();g.add({stone:8,clay:8,coal:2,wood:20});const {device}=g.build('furnace');g.assign(device.id,'bricks');g.simulate(4);assert.equal(g.quantity('brick'),0);g.simulate(1);assert.equal(g.quantity('brick'),4);assert.equal(g.quantity('coal'),1);assert.equal(g.quantity('wood'),20);assert.equal(g.state.produced,4);
});

test('powered machines pause without losing prepaid input or producing free output',()=>{
  const g=new Game();g.state.stage=2;tanks(g);g.add({...machines.electrolyzer.cost,water:1000});
  const {device}=g.build('electrolyzer');g.assign(device.id,'waterElectrolysis');g.state.energy=10000;
  g.simulate(4);assert.equal(g.quantity('water'),1000);assert.equal(device.job,null);assert.equal(g.state.energy,0);
  device.eu=300;g.tick(.5);assert.equal(g.quantity('water'),0);assert.equal(g.quantity('hydrogen'),0);
  const job=JSON.stringify(device.job);g.simulate(2);assert.equal(device.blocked,'电力不足');assert.equal(JSON.stringify(device.job),job);
  g.add({...machines.batteryBuffer.cost,batteryLV:1});const battery=g.build('batteryBuffer').device;
  assert.equal(g.changeBattery(battery.id,true).ok,true);battery.eu=60000;
  assert.equal(g.setSupply(device.id,'storage',battery.id).ok,true);g.simulate(99.5);
  assert.equal(g.quantity('hydrogen'),2000);assert.equal(g.quantity('oxygen'),1000);assert.equal(g.state.energy,300);
});

test('generator consumes fuel and adds bounded energy over time',()=>{
  const g=new Game();g.state.stage=2;tanks(g,1);g.add({...machines.turbine.cost,steam:3200});
  const {device}=g.build('turbine');g.assign(device.id,'steamPower');g.setSupply(device.id,'storage',g.state.containers[0].id);
  g.simulate(5);assert.equal(g.quantity('steam'),0);assert.equal(device.fuel,1);assert.equal(g.state.energy,1371);
  assert.ok(device.eu<=energyCapacity(g,device));g.simulate(5);assert.equal(g.state.energy,1371);
});

test('offline simulation matches online steps and survives save roundtrip',()=>{
  const a=new Game();a.add({stone:16,clay:20,coal:10});const {device}=a.build('furnace');a.assign(device.id,'bricks');a.state.collectors.river={count:1,activeCount:1,enabled:true,elapsed:0};const b=new Game(a.snapshot());a.simulate(60);for(let i=0;i<120;i++)b.tick(.5);for(const key of ['inventory','queue','devices','energy','collectors'])assert.deepEqual(a.state[key],b.state[key]);const loaded=new Game(a.snapshot());assert.deepEqual(loaded.state.inventory,a.state.inventory);
});

test('stage advancement counts consumed production and never charges goal items',()=>{
  const g=new Game();g.add({flintPick:1,brick:8});g.pay({brick:8});assert.equal(g.canAdvance(),true);assert.equal(g.advance().ok,true);assert.equal(g.state.stage,1);assert.equal(g.quantity('flintPick'),1);
});

test('bad imports reject unknown items, NaN, duplicate devices, invalid jobs and huge queues',()=>{
  const g=new Game(),s=g.snapshot();for(const mutate of [x=>x.inventory.fake=1,x=>x.energy=NaN,x=>x.stage=99,x=>x.collectors.forest={count:-1,elapsed:0},x=>x.queue=Array(21).fill({}),x=>x.devices=[{id:'x',type:'furnace',enabled:true,recipe:'bricks',job:{remaining:999}}]]){const raw=structuredClone(s);mutate(raw);assert.throws(()=>new Game(raw));}
});

test('automatic collectors scale with elapsed time, not UI render frequency',()=>{
  const g=new Game();g.state.collectors.forest={count:2,elapsed:0};g.simulate(16);assert.ok(g.quantity('wood')>=4&&g.quantity('wood')<=12);assert.ok(g.quantity('resin')>=0&&g.quantity('resin')<=8);
});

test('initial chapter can be completed through collection, crafting, and a working furnace',()=>{
 const g=new Game();g.nextDropRandom=()=>.5;
 for(const[id,batches]of [['forest',3],['surface',4],['river',4]]){const node=CATALOG.gatherNodes.find(n=>n.id===id);for(let i=0;i<batches*g.gatherClicks(node);i++)assert.equal(g.gather(id).ok,true);}
 assert.equal(g.craft('sticks').ok,true);g.simulate(1);assert.equal(g.craft('pick').ok,true);g.simulate(3);
 const built=g.build('furnace');assert.equal(built.ok,true);g.assign(built.device.id,'charcoal');g.simulate(6);assert.equal(g.quantity('coal'),3);g.assign(built.device.id,'bricks');g.simulate(10);assert.equal(g.quantity('brick'),8);assert.equal(g.canAdvance(),true);g.advance();assert.equal(g.state.stage,1);
});

test('generator operation values match calibrated fuels and its plasma cycle has positive net yield',()=>{
 for(const r of recipes.filter(x=>x.generation)){const machine=Object.values(machines).find(m=>m.processes.includes(r.process));const g=new Game();g.state.stage=15;g.add(machine.cost);const d=g.build(machine.id).device,fuel=generatorFuel(g,d);assert.equal(r.generation,fuel.eu,r.id);assert.equal(r.inputs[fuel.id],fuel.amount,r.id);assert.equal(Math.abs(machine.power),g.catalog.machines[d.type].energy.tier===d.energyTier?8*4**d.energyTier:0);}
 const fusion=recipes.find(r=>r.id==='fusionFuel'),generator=recipes.find(r=>r.id==='plasmaPower');assert.ok(fusion.outputs.plasma/generator.inputs.plasma*generator.generation>fusion.power*20*fusion.seconds);
});
