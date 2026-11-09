import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';

test('collector prices use modest bands, halve starting materials and keep motors and pumps fixed',()=>{
  const g=new Game();
  const cases=[
    ['forest',[{ironPlate:3},{ironPlate:4},{ironPlate:5}]],
    ['endermanHunt',[{ironPlate:6,motor:1},{ironPlate:8,motor:1},{ironPlate:9,motor:1}]],
    ['dragonExpedition',[{tungstensteelPlate:12,motor:2},{tungstensteelPlate:15,motor:2},{tungstensteelPlate:18,motor:2}]],
    ['alienFluidWell',[{tungstensteelPlate:6,pump:1},{tungstensteelPlate:8,pump:1},{tungstensteelPlate:9,pump:1}]],
  ];
  for(const [id,prices] of cases){
    const node=g.catalog.gatherNodes.find(n=>n.id===id);
    for(const [count,band] of [[0,0],[4,0],[5,1],[9,1],[10,2],[100,2],[1000000,2]]){
      g.state.collectors[id]={count};assert.deepEqual(g.collectorCost(node),prices[band],`${id}: ${count} deployed`);
    }
  }
});

test('deployments charge the displayed price per site, reject insufficient stock and preserve saved collectors',()=>{
  const g=new Game(),node=g.catalog.gatherNodes.find(n=>n.id==='forest');g.add({ironPlate:40});
  for(let i=0;i<11;i++)assert.equal(g.buildCollector('forest').ok,true);
  // Five × 3, five × 4, one × 5 = 40 plates.
  assert.equal(g.quantity('ironPlate'),0);assert.equal(g.state.collectors.forest.count,11);
  assert.deepEqual(g.collectorCost(node),{ironPlate:5});
  assert.equal(g.buildCollector('forest').ok,false);assert.equal(g.state.collectors.forest.count,11);
  assert.deepEqual(g.collectorCost(g.catalog.gatherNodes.find(n=>n.id==='surface')),{ironPlate:3});
  g.state.collectors.forest.count=1000;g.state.collectors.forest.activeCount=2;g.state.collectors.forest.enabled=false;
  const loaded=new Game(g.snapshot());
  assert.deepEqual(loaded.collectorCost(node),{ironPlate:5});
  loaded.add({ironPlate:5});assert.equal(loaded.buildCollector('forest').ok,true);
  assert.equal(loaded.quantity('ironPlate'),0);assert.equal(loaded.state.collectors.forest.count,1001);
  assert.equal(loaded.state.collectors.forest.activeCount,2);assert.equal(loaded.state.collectors.forest.enabled,false);
});

test('every existing gathering site has finite capped material costs at large collector counts',()=>{
  const g=new Game();
  for(const node of g.catalog.gatherNodes){
    const original=structuredClone(node.cost);
    g.state.collectors[node.id]={count:10};const capped=g.collectorCost(node);
    g.state.collectors[node.id].count=1000000;assert.deepEqual(g.collectorCost(node),capped,node.id);
    for(const [id,n] of Object.entries(capped)){
      assert.ok(Number.isSafeInteger(n)&&n>0,node.id);
      assert.ok(n<=original[id],`${node.id}/${id}: capped price must stay below the former starting price`);
    }
    assert.deepEqual(node.cost,original);
  }
});
