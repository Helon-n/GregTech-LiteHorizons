import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';

function build(game,type){game.add(game.catalog.machines[type].cost);const result=game.build(type);assert.equal(result.ok,true);return result.device;}

test('dispatch accepts compatible empty machines and never overwrites an existing recipe or paid batch',()=>{
  const g=new Game(),bench=build(g,'workbench'),furnace=build(g,'furnace');
  g.add({wood:2,clay:1,coal:1});furnace.enabled=false;
  assert.equal(g.dispatch('sticks',furnace.id).ok,false);assert.equal(furnace.recipe,null);
  assert.equal(g.dispatch('sticks',bench.id).ok,true);
  assert.equal(g.dispatch('bricks',furnace.id).ok,true);assert.equal(furnace.enabled,true);
  const before=structuredClone(g.state.inventory);
  assert.equal(g.dispatch('glass',furnace.id).ok,false);assert.deepEqual(g.state.inventory,before);
  g.tick(.5);const job=structuredClone(furnace.job),paid=structuredClone(g.state.inventory);
  assert.equal(g.dispatch('glass',furnace.id).ok,false);assert.deepEqual(furnace.job,job);assert.deepEqual(g.state.inventory,paid);
  const loaded=new Game(g.snapshot());loaded.simulate(4.5);
  assert.equal(loaded.quantity('brick'),4);assert.ok(loaded.quantity('stick')>=4);
  assert.equal(g.dispatch('missing',bench.id).ok,false);assert.equal(g.dispatch('bricks','missing').ok,false);
});

test('collector concurrency changes independent drop rolls while stop preserves progress including offline time',()=>{
  const g=new Game();g.state.collectors.forest={count:3,activeCount:2,enabled:true,elapsed:0};
  let rolls=0;g.nextDropRandom=()=>{rolls++;return 0;};
  g.simulate(4);assert.equal(rolls,0);assert.equal(g.state.collectors.forest.elapsed,4);
  g.toggleCollector('forest');g.simulate(30);assert.equal(rolls,0);assert.equal(g.state.collectors.forest.elapsed,4);
  assert.equal(g.setCollectorWorkers('forest',1).ok,true);g.toggleCollector('forest');g.simulate(4);
  assert.equal(rolls,2);assert.equal(g.quantity('wood'),1);
  g.setCollectorWorkers('forest',3);g.simulate(8);assert.equal(rolls,8);assert.equal(g.quantity('wood'),4);
  for(const value of [0,-1,4,1.5,NaN,'2'])assert.equal(g.setCollectorWorkers('forest',value).ok,false);
  assert.equal(g.toggleCollector('missing').ok,false);assert.equal(g.setCollectorWorkers('missing',1).ok,false);
});

test('collector selection survives reload, legacy saves run all machines, invalid settings are rejected',()=>{
  const g=new Game();g.state.collectors.forest={count:3,elapsed:3};
  const legacy=new Game(g.snapshot());assert.equal(legacy.state.collectors.forest.activeCount,3);assert.equal(legacy.state.collectors.forest.enabled,true);
  legacy.setCollectorWorkers('forest',2);legacy.toggleCollector('forest');
  const loaded=new Game(legacy.snapshot());loaded.simulate(40);
  assert.equal(loaded.state.collectors.forest.activeCount,2);assert.equal(loaded.state.collectors.forest.elapsed,3);assert.equal(loaded.quantity('wood'),0);
  loaded.add({flintPick:1,...loaded.collectorCost(loaded.catalog.gatherNodes.find(n=>n.id==='forest'))});
  loaded.buildCollector('forest');assert.equal(loaded.state.collectors.forest.count,4);assert.equal(loaded.state.collectors.forest.activeCount,2);assert.equal(loaded.state.collectors.forest.enabled,false);
  for(const invalid of [{activeCount:0},{activeCount:4},{activeCount:1.5},{enabled:'false'}]){
    const raw=legacy.snapshot();Object.assign(raw.collectors.forest,invalid);assert.throws(()=>new Game(raw));
  }
  const online=new Game(g.snapshot()),offline=new Game(g.snapshot());online.setCollectorWorkers('forest',2);offline.setCollectorWorkers('forest',2);
  for(let i=0;i<40;i++)online.tick(.5);offline.simulate(20);assert.deepEqual(online.state.inventory,offline.state.inventory);
});
