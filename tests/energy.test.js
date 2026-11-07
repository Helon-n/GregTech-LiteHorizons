import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {energyCapacity,generatorFuel,voltage} from '../src/core/energy.js';

const world=()=>{const g=new Game();g.state.stage=15;return g;};
function build(g,type,recipe){g.add(g.catalog.machines[type].cost);const result=g.build(type);assert.equal(result.ok,true);if(recipe)assert.equal(g.assign(result.device.id,recipe).ok,true);return result.device;}
function tank(g,fluid,amount=0){g.add({largeTank:1});const {container}=g.placeContainer('largeTank');g.reserveContainer(container.id,fluid);assert.equal(g.add({[fluid]:amount}),true);return container.id;}
function battery(g,tier=1,cells=1,eu=0){const d=build(g,'batteryBuffer');d.energyTier=tier;g.add({['battery'+['','LV','MV','HV','EV','IV','LuV','ZPM','UV','UHV','UEV','UIV','UMV','UXV'][tier]]:cells});for(let i=0;i<cells;i++)assert.equal(g.changeBattery(d.id,true).ok,true);d.eu=eu;return d;}

test('boiler requires manual coal, warms up, and preserves water/steam conversion remainders',()=>{
  const g=world(),d=build(g,'boiler','steam');tank(g,'water',1000);g.add({coal:2});
  g.simulate(100);assert.equal(d.temperature,20);assert.equal(d.steam,0);assert.equal(g.quantity('coal'),2);
  assert.equal(g.loadCoal(d.id).ok,true);g.simulate(100);assert.ok(d.temperature>100);assert.ok(d.steam>0);assert.equal(g.quantity('coal'),1);
  const h=world(),hot=build(h,'boiler','steam');hot.temperature=500;hot.water=10;hot.startupTicks=0;
  h.simulate(4);assert.equal(hot.steam,480);assert.equal(hot.water,7);assert.equal(hot.waterRemainder,0);
  assert.equal(new Game(h.snapshot()).state.devices[0].steam,480);
});

test('boiler surplus goes to its selected tank and full internal steam vents without overfill',()=>{
  const g=world(),d=build(g,'boiler','steam'),id=tank(g,'steam');d.temperature=500;d.water=100;d.startupTicks=0;
  assert.equal(g.setSteamOutput(d.id,id).ok,true);g.simulate(2);assert.equal(g.quantity('steam'),240);assert.equal(d.steam,0);
  g.setSteamOutput(d.id,null);d.steam=16000;g.tick(.5);assert.equal(d.steam,12000);assert.match(d.blocked,/排汽/);
});

test('bronze machines use the same continuous steam through direct and tank connections',()=>{
  for(const mode of ['direct','storage']){
    const g=world(),d=build(g,'steamMacerator','gt29:77c21e83e9e5d4');g.add({copperOre:1});
    let source;
    if(mode==='direct'){const b=build(g,'boiler');b.enabled=false;b.steam=5000;source=b.id;}
    else source=tank(g,'steam',5000);
    assert.equal(g.setSupply(d.id,mode,source).ok,true);
    assert.deepEqual(g.deviceRuntime(d),{seconds:40,power:2,steamPerSecond:80,valid:true});
    g.simulate(40);assert.equal(g.quantity('copperCrushed'),2);assert.equal(d.steam,1800);assert.equal(g.quantity('copperOre'),0);
  }
});

test('generator operations conserve fuel and EU across all four fuel families',()=>{
  for(const [type,recipe,fluid,amount] of [['turbine','steamPower','steam',10000],['dieselGenerator','dieselPower','diesel',100],['gasTurbine','gasPower','hydrogen',1000],['fusionGenerator','plasmaPower','plasma',100]]){
    const g=world(),d=build(g,type,recipe),id=tank(g,fluid,amount),f=generatorFuel(g,d);
    assert.equal(g.setSupply(d.id,'storage',id).ok,true);g.simulate(1);
    const burned=(amount-d.fuel-g.quantity(fluid))/f.amount;
    assert.equal(burned,Math.trunc(burned));assert.equal(d.eu,burned*f.eu);assert.ok(d.eu<=energyCapacity(g,d));
    assert.equal(f.eu,{steam:3,diesel:432,hydrogen:19,plasma:57344}[fluid]);
  }
});

test('a generator output is shared, and disconnected global summary EU cannot power devices',()=>{
  const g=world(),source=build(g,'turbine');source.eu=2000;
  const a=build(g,'assembler','tech29:49193d890804ec2a'),b=build(g,'assembler','tech29:49193d890804ec2a');
  for(const d of [a,b]){g.add(g.recipeById.get('tech29:49193d890804ec2a').inputs);assert.equal(g.setSupply(d.id,'direct',source.id).ok,true);}
  g.tick(.5);assert.equal(source.eu,1680);assert.equal(g.state.energy,1920);assert.equal([a,b].filter(d=>d.job).length,1);
  const h=world(),d=build(h,'assembler','tech29:49193d890804ec2a');h.add(h.recipeById.get('tech29:49193d890804ec2a').inputs);h.state.energy=1e8;h.tick(.5);
  assert.equal(d.job,null);assert.equal(h.state.energy,0);
});

test('physical batteries gate charge capacity, match tier, and cannot duplicate stored energy',()=>{
  const g=world(),d=build(g,'batteryBuffer'),source=build(g,'gasTurbine','gasPower');
  const id=tank(g,'hydrogen',10000);g.setSupply(source.id,'storage',id);g.setSupply(d.id,'direct',source.id);
  g.simulate(1);assert.equal(d.eu,0);assert.equal(energyCapacity(g,d),0);
  g.add({batteryMV:1});assert.equal(g.changeBattery(d.id,true).ok,false);
  g.add({batteryLV:1});assert.equal(g.changeBattery(d.id,true).ok,true);assert.equal(g.quantity('batteryLV'),0);
  g.simulate(1);assert.ok(d.eu>0);assert.equal(energyCapacity(g,d),108192);
  assert.equal(g.changeBattery(d.id,false).ok,false);assert.equal(g.quantity('batteryLV'),0);
  d.eu=0;assert.equal(g.changeBattery(d.id,false).ok,true);assert.equal(g.quantity('batteryLV'),1);assert.equal(energyCapacity(g,d),0);
});

test('battery output scales with inserted cells and is shared by consumers',()=>{
  for(const count of [1,2,4]){
    const g=world(),s=battery(g,1,count,50000),consumers=[];
    for(let i=0;i<4;i++){const d=build(g,'assembler','tech29:49193d890804ec2a');g.add(g.recipeById.get('tech29:49193d890804ec2a').inputs);g.setSupply(d.id,'storage',s.id);consumers.push(d);}
    g.tick(.5);assert.equal(50000-s.eu,320*count);assert.equal(consumers.filter(d=>d.job).length,count);
  }
});

test('overvoltage is rejected and upgrades require materials instead of chapter unlocks',()=>{
  const g=world(),source=build(g,'dieselGenerator'),d=build(g,'assembler','tech29:49193d890804ec2a');
  assert.equal(g.setSupply(d.id,'direct',source.id).ok,false);assert.equal(g.supplyOptions(d,'direct').some(s=>s.id===source.id),false);
  assert.equal(g.upgradeEnergy(d.id).ok,false);g.add(g.energyUpgradeCost(d));assert.equal(g.upgradeEnergy(d.id).ok,true);assert.equal(voltage(d),128);
  assert.equal(g.setSupply(d.id,'direct',source.id).ok,true);assert.equal(g.deviceRuntime(d).power,32);assert.equal(g.deviceRuntime(d).seconds,3.75);
  g.state.stage=0;
  const cost=g.energyUpgradeCost(d),before=g.quantity(Object.keys(cost)[0]);
  assert.equal(g.upgradeEnergy(d.id).ok,false,'removing chapter gates must not remove material costs');
  g.add(cost);assert.equal(g.upgradeEnergy(d.id).ok,true);assert.equal(voltage(d),512);
  assert.equal(g.quantity(Object.keys(cost)[0]),before,'upgrade consumes the full physical cost');
  assert.equal(new Game(g.snapshot()).state.devices.find(x=>x.id===d.id).energyTier,d.energyTier);
});

test('fusion pays startup once, keeps its batch across pause, and requires startup again after force stop',()=>{
  const g=world(),d=build(g,'fusion','fusionFuel');tank(g,'deuterium',125);tank(g,'tritium',125);tank(g,'plasma');
  d.eu=39999999;g.tick(.5);assert.equal(d.job,null);assert.equal(g.quantity('deuterium'),125);
  d.eu=40100000;g.tick(.5);assert.equal(d.eu,61600);assert.equal(d.ignited,true);assert.equal(g.quantity('deuterium'),0);
  g.toggle(d.id);const remaining=d.job.remaining;g.simulate(1);assert.equal(d.job.remaining,remaining);assert.equal(d.ignited,true);
  g.toggle(d.id);g.simulate(.3);assert.equal(g.quantity('plasma'),125);assert.equal(d.eu,38560);
  g.forceStop(d.id);assert.equal(d.ignited,false);g.assign(d.id,'fusionFuel');g.toggle(d.id);g.add({deuterium:125,tritium:125});g.tick(.5);
  assert.equal(d.job,null);assert.equal(d.blocked,'等待聚变启动储能');
});

test('same-step fluid output does not leave consumers or boiler output writing stale tanks',()=>{
  const g=world(),c=build(g,'cokeOven','gt29:0be510620aeeb4'),d=build(g,'steamMacerator','gt29:77c21e83e9e5d4');
  tank(g,'creosote');const id=tank(g,'steam',5000);g.add({coal:4,copperOre:1});g.setSupply(d.id,'storage',id);
  c.job={remaining:.5,duration:15};g.pay({coal:4});g.state.playtime=.5;
  g.tick(.5);assert.equal(g.quantity('creosote'),500);assert.equal(g.quantity('steam'),0);assert.equal(d.steam,4960);
  assert.equal(g.quantity('steam')+d.steam,4960);
});

test('schema-3 energy and prepaid fuel migrate once and require physical batteries to recover EU',()=>{
  const g=world(),d=build(g,'turbine','steamPower');const raw=g.snapshot();raw.schema=3;raw.energy=12345;raw.devices[0].job={remaining:2.5};
  const h=new Game(raw),m=h.state.devices[0];assert.equal(h.state.legacyEnergy,12345);assert.equal(h.state.energy,0);assert.equal(m.fuel,1600);assert.equal(m.job,null);
  const s=battery(h);assert.equal(h.recoverEnergy(s.id).ok,true);assert.equal(s.eu,12345);assert.equal(h.state.legacyEnergy,0);
  const again=new Game(h.snapshot());assert.equal(again.state.legacyEnergy,0);assert.equal(again.state.devices.find(x=>x.id===s.id).eu,12345);
});

test('energy save roundtrip preserves network simulation and rejects impossible energy, cells and IDs',()=>{
  const a=world(),s=build(a,'gasTurbine','gasPower'),id=tank(a,'hydrogen',10000),b=battery(a);
  a.setSupply(s.id,'storage',id);a.setSupply(b.id,'direct',s.id);a.simulate(4);const h=new Game(a.snapshot());
  a.simulate(60);for(let i=0;i<120;i++)h.tick(.5);
  for(const key of ['devices','containers','energy','inventory'])assert.deepEqual(a.state[key],h.state[key]);
  for(const mutate of [x=>x.devices[0].eu=1e20,x=>x.devices[1].batteries=5,x=>x.devices[0].energyTier=14,x=>x.containers[0].id='<bad>']){
    const raw=a.snapshot();mutate(raw);assert.throws(()=>new Game(raw));
  }
});

test('Dyson generation uses configured modules and coolant and can charge multiple battery boxes',()=>{
  const g=world(),d=build(g,'dysonGenerator','stellarPower');d.modules=1000;
  for(let i=0;i<4;i++)tank(g,'cryotheum',1000000);
  const boxes=Array.from({length:6},()=>battery(g,11,4));for(const b of boxes)g.setSupply(b.id,'direct',d.id);
  g.tick(.5);assert.equal(d.cyclePower,1e10);assert.ok(d.modules<1000);assert.equal(g.quantity('cryotheum'),400000);
  assert.equal(d.cycleRemaining,3599.5);assert.equal(boxes.reduce((n,b)=>n+b.eu,0),6*8*33554432*10);
  assert.ok(d.eu<=energyCapacity(g,d));g.forceStop(d.id);assert.equal(d.cycleRemaining,0);
});
