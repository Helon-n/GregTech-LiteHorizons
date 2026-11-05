import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SCHEMA} from '../src/core/engine.js';

function place(g,type,count=1){g.add({[type]:count});const containers=[];for(let i=0;i<count;i++){const r=g.placeContainer(type);assert.equal(r.ok,true);containers.push(r.container.id);}return containers;}
function harvest(g,id){let r;for(let i=0;i<g.gatherClicks(g.catalog.gatherNodes.find(n=>n.id===id));i++)r=g.gather(id);return r;}

test('fluids cannot enter inventory; a crafted and enabled bucket is required to collect water',()=>{
  const g=new Game();assert.equal(g.add({water:1000,wood:2}),false);assert.equal(g.quantity('wood'),0);
  const bare=harvest(g,'river');for(const id of ['clay','sand'])assert.ok(bare.drops[id]>=1&&bare.drops[id]<=3);assert.deepEqual(bare.skipped,{water:1000});assert.equal(g.quantity('water'),0);
  g.add({wood:3});assert.equal(g.craft('woodBucket').ok,true);g.simulate(2);assert.equal(g.quantity('woodBucket'),1);
  harvest(g,'river');assert.equal(g.quantity('water'),0);
  const enabled=g.placeContainer('woodBucket');assert.equal(enabled.ok,true);assert.equal(g.quantity('woodBucket'),0);
  harvest(g,'river');assert.equal(g.quantity('water'),1000);assert.equal(g.state.containers[0].amount,1000);
  assert.equal(Object.hasOwn(g.state.inventory,'water'),false);assert.equal(g.add({water:1}),false);
  assert.equal(g.removeContainer(enabled.container.id).ok,false);
  g.pay({water:1000});assert.equal(g.removeContainer(enabled.container.id).ok,true);assert.equal(g.quantity('woodBucket'),1);
});

test('one container holds one compatible fluid; partial collection, reservation, transfer and reuse conserve volumes',()=>{
  const g=new Game();const [a,b]=place(g,'woodBucket',2);
  assert.equal(g.add({oil:1}),false);assert.equal(g.reserveContainer(a,'steam').ok,false);
  assert.equal(g.add({water:1500}),true);assert.equal(g.quantity('water'),1500);
  assert.equal(g.reserveContainer(a,'water').ok,false);assert.equal(g.transferFluid(a,b).amount,500);assert.equal(g.quantity('water'),1500);
  assert.equal(g.transferFluid(a,b).ok,false);g.pay({water:1200});assert.equal(g.quantity('water'),300);
  const collected=harvest(g,'river');assert.equal(collected.drops.water,1000);
  harvest(g,'river');assert.equal(g.quantity('water'),2000);assert.equal(g.state.earned.water,3200);
  g.state.stage=2;const [tank]=place(g,'largeTank');assert.equal(g.reserveContainer(tank,'oil').ok,true);
  assert.equal(g.transferFluid(a,tank).ok,false);assert.equal(g.add({steam:1}),false);
  assert.equal(g.reserveContainer(tank,'').ok,true);assert.equal(g.transferFluid(a,tank).ok,true);assert.equal(g.quantity('water'),2000);
});

test('multi-fluid output planning is atomic and does not allocate a single empty tank twice',()=>{
  const g=new Game();g.state.stage=2;place(g,'largeTank');
  assert.equal(g.add({hydrogen:2000,oxygen:1000,iron:5}),false);
  assert.equal(g.quantity('hydrogen'),0);assert.equal(g.quantity('iron'),0);assert.equal(g.state.containers[0].fluid,null);
  place(g,'largeTank');assert.equal(g.add({hydrogen:2000,oxygen:1000}),true);
  assert.equal(g.state.containers[0].fluid,'hydrogen');assert.equal(g.state.containers[1].fluid,'oxygen');
});

test('machines wait before consuming inputs when fluid output has no compatible container',()=>{
  const g=new Game();g.state.stage=1;g.add({...g.catalog.machines.cokeOven.cost,coal:4});place(g,'woodBucket');
  const {device}=g.build('cokeOven');g.assign(device.id,'coke');g.simulate(15);
  assert.equal(device.blocked,'流体输出空间不足');assert.equal(g.quantity('coal'),4);assert.equal(device.job,null);
  place(g,'fluidTank');g.simulate(15);assert.equal(g.quantity('creosote'),1000);assert.equal(g.quantity('coal'),0);assert.equal(g.quantity('coke'),4);
});

test('competing producers retain completed batches when a tank fills; reloading and draining release output exactly once',()=>{
  const g=new Game();g.state.stage=1;g.add({brick:48,clay:24,coal:8});
  place(g,'fluidTank');g.add({creosote:63000});
  const a=g.build('cokeOven').device,b=g.build('cokeOven').device;g.assign(a.id,'coke');g.assign(b.id,'coke');g.simulate(15);
  assert.equal(g.quantity('creosote'),64000);assert.equal(b.job.remaining,0);assert.equal(b.blocked,'流体输出空间不足');
  const loaded=new Game(g.snapshot());loaded.simulate(30);assert.equal(loaded.quantity('creosote'),64000);assert.equal(loaded.quantity('coal'),0);
  loaded.pay({creosote:1000});loaded.tick(.5);assert.equal(loaded.quantity('creosote'),64000);assert.equal(loaded.state.devices[1].job,null);
  loaded.simulate(20);assert.equal(loaded.quantity('creosote'),64000);assert.equal(loaded.state.produced,2008);
});

test('offline collectors respect container capacity and do not store uncollected fluids for later',()=>{
  const a=new Game();place(a,'woodBucket');a.state.collectors.river={count:2,elapsed:0};const b=new Game(a.snapshot());
  a.simulate(80);for(let i=0;i<160;i++)b.tick(.5);
  assert.equal(a.quantity('water'),1000);assert.ok(a.quantity('clay')>=20&&a.quantity('clay')<=60);assert.equal(a.state.collectors.river.blocked,'流体容器不足');
  assert.deepEqual(a.state.containers,b.state.containers);assert.deepEqual(a.state.inventory,b.state.inventory);
  a.pay({water:1000});a.tick(.5);assert.equal(a.quantity('water'),0);
});

test('schema-2 fluids migrate to explicit tanks without loss or repeated migration',()=>{
  const old=new Game().snapshot();old.schema=2;delete old.containers;old.inventory={wood:8,water:2300,steam:2000000,oil:0};old.earned={wood:10,water:5000,steam:3000000};
  const g=new Game(old);assert.equal(g.state.schema,SCHEMA);assert.deepEqual(g.state.inventory,{wood:8});
  assert.equal(g.quantity('water'),2300);assert.equal(g.quantity('steam'),2000000);assert.equal(g.state.containers.length,2);assert.equal(g.state.earned.water,5000);
  assert.equal(g.fluidRoom('steam'),0);assert.equal(new Game(g.snapshot()).state.containers.length,2);
  assert.equal(g.state.containers[1].capacity,2000000);
});

test('invalid fluid saves reject loose fluids, overfill, mixed types, duplicate IDs and invalid capacity',()=>{
  const g=new Game();place(g,'woodBucket');const base=g.snapshot();
  for(const mutate of [s=>s.inventory.water=0,s=>s.containers[0].amount=1001,s=>{s.containers[0].fluid='oil';s.containers[0].amount=1;},s=>s.containers.push({...s.containers[0]}),s=>s.containers[0].fluid='unknown',s=>{s.containers[0].type='legacyTank';s.containers[0].capacity=-1;},s=>s.containers[0].amount=NaN]){
    const raw=structuredClone(base);mutate(raw);assert.throws(()=>new Game(raw));
  }
});
