import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';

const node=(g,id)=>g.catalog.gatherNodes.find(n=>n.id===id);
test('resource drops reach both range endpoints; ordinary primary resources stay positive and unenchanted hunts drop at 50%',()=>{
  const g=new Game(),forest=node(g,'forest');
  const before=g.state.lootSeed;assert.deepEqual(g.dropRanges(forest),{wood:{min:1,max:3},resin:{min:0,max:2}});assert.equal(g.state.lootSeed,before);
  g.nextDropRandom=()=>0;assert.deepEqual(g.collectDrops(forest).drops,{wood:1});
  g.nextDropRandom=()=>1-Number.EPSILON;assert.deepEqual(g.collectDrops(forest).drops,{wood:3,resin:2});
  const hunts={endermanHunt:'enderPearlGem',blazeHunt:'blazeRod'};
  for(const [encounter,item]of Object.entries(hunts)){
    const n=node(g,encounter);assert.ok(n);assert.deepEqual(g.dropRanges(n),{[item]:{min:0,max:1}});
    g.nextDropRandom=()=>.499999;assert.deepEqual(g.collectDrops(n).drops,{});
    g.nextDropRandom=()=>.5;assert.deepEqual(g.collectDrops(n).drops,{[item]:1});
  }
  const skeleton=node(g,'skeletonHunt');assert.deepEqual(g.dropRanges(skeleton),{bone:{min:0,max:2}});
  for(const [roll,amount]of [[0,0],[.34,1],[1-Number.EPSILON,2]]){
    g.nextDropRandom=()=>roll;assert.deepEqual(g.collectDrops(skeleton).drops,amount?{bone:amount}:{});
  }
  for(const n of g.catalog.gatherNodes)for(const[id,{min,max}]of Object.entries(g.dropRanges(n))){assert.ok(Number.isInteger(min)&&Number.isInteger(max));assert.ok(min>=0&&max>=min);if(id===n.output&&!Object.hasOwn(hunts,n.id)&&n.id!=='skeletonHunt'&&!n.dropProbabilities?.[id])assert.ok(min>=1,n.id);}
});

test('automatic collectors roll each machine independently and never before its cycle',()=>{
  const g=new Game(),rolls=[0,.999,.999,0];g.nextDropRandom=()=>{assert.ok(rolls.length);return rolls.shift();};
  g.state.collectors.forest={count:2,elapsed:0};g.simulate(7.5);assert.equal(g.quantity('wood'),0);assert.equal(rolls.length,4);
  g.tick(.5);assert.equal(rolls.length,0);assert.equal(g.quantity('wood'),4);assert.equal(g.quantity('resin'),2);
});

test('dimensional shard chance is one in sixteen with a separate roll for each collection',()=>{
  const g=new Game(),n=node(g,'netherShardHunt'),id=n.output;
  assert.equal(n.dropProbabilities[id],1/16);
  const rolls=[0,.9375-Number.EPSILON,.9375,1-Number.EPSILON];
  g.nextDropRandom=()=>{assert.ok(rolls.length);return rolls.shift();};
  const result=g.collectDrops(n,4);
  assert.equal(rolls.length,0);assert.equal(result.drops[id],2);assert.equal(g.quantity(id),2);
});

test('saved random state reproduces online/offline drops and reload does not change the next rolls',()=>{
  const g=new Game();g.state.lootSeed=12345;g.state.collectors.forest={count:3,elapsed:0};g.state.collectors.surface={count:2,elapsed:0};
  const loaded=new Game(g.snapshot());g.simulate(80);for(let i=0;i<160;i++)loaded.tick(.5);
  assert.deepEqual(loaded.state.inventory,g.state.inventory);assert.equal(loaded.state.lootSeed,g.state.lootSeed);
  const reloaded=new Game(g.snapshot());assert.deepEqual(reloaded.collectDrops(node(reloaded,'forest'),10),g.collectDrops(node(g,'forest'),10));
  const raw=g.snapshot();delete raw.lootSeed;assert.ok(Number.isInteger(new Game(raw).state.lootSeed));
  for(const invalid of [-1,1.5,4294967296,null]){const bad=g.snapshot();bad.lootSeed=invalid;assert.throws(()=>new Game(bad));}
});

test('real random sequence varies within range while fluid volume remains fixed and capacity limits apply',()=>{
  const g=new Game();g.state.lootSeed=12345;const amounts=new Set();
  for(let i=0;i<30;i++){const drops=g.collectDrops(node(g,'forest')).drops;amounts.add(drops.wood);assert.ok(drops.wood>=1&&drops.wood<=3);assert.ok((drops.resin||0)>=0&&(drops.resin||0)<=2);}
  assert.equal(amounts.size,3);
  g.add({woodBucket:1});g.placeContainer('woodBucket');
  assert.deepEqual(g.dropRanges(node(g,'river')).water,{min:1000,max:1000});
  const first=g.collectDrops(node(g,'river'));assert.equal(first.drops.water,1000);assert.equal(g.quantity('water'),1000);
  const full=g.collectDrops(node(g,'river'));assert.equal(full.drops.water,undefined);assert.equal(full.skipped.water,1000);assert.equal(Object.hasOwn(g.state.inventory,'water'),false);
});
