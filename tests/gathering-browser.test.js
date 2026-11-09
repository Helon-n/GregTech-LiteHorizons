import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG as c} from '../src/data/catalog.js';
import {gatheringRegions,gatheringDestination} from '../src/core/gathering-browser.js';

test('region browsing covers every source and follows world distribution, not chapters',()=>{
  const local=gatheringRegions(c,'resources'),space=gatheringRegions(c,'space');
  assert.deepEqual(local.map(r=>r.id),['OW','NETHER','TWILIGHT_FOREST','THE_END','EVERGLADES']);
  assert.deepEqual(space.slice(0,3).map(r=>r.id),['Moon','Mars','Asteroids']);
  assert.equal(new Set([...local,...space].map(r=>r.id)).size,Object.keys(c.mining.regions).length);
  for(const node of c.gatherNodes){
    const regions=[...local,...space].filter(region=>region.nodes.includes(node));
    assert.deepEqual(new Set(regions.map(r=>r.id)),new Set(node.regions),node.id);
    for(const region of regions)assert.equal(region.nodes.filter(n=>n.id===node.id).length,1);
  }
  assert.ok(local.find(r=>r.id==='NETHER').nodes.some(n=>n.id==='netherSinExpedition'&&n.stage>=5));
});

test('source links prefer an accessible destination, retaining the locked destination when necessary',()=>{
  const sulfur=c.gatherNodes.find(n=>n.id==='ore:Sulfur');
  assert.deepEqual(gatheringDestination(c,sulfur,()=>false),{page:'resources',region:'NETHER'});
  const node={regions:['Moon','OW']};
  assert.deepEqual(gatheringDestination(c,node,()=>false),{page:'resources',region:'OW'});
  assert.deepEqual(gatheringDestination(c,node,id=>id==='advancedRocket'),{page:'resources',region:'OW'});
  assert.deepEqual(gatheringDestination(c,{regions:['Moon']},id=>id==='advancedRocket'),{page:'space',region:'Moon'});
  const same=c.gatherNodes.find(n=>n.regions.includes('OW')&&n.regions.includes('Moon'));
  assert.ok(same);
  assert.equal(gatheringRegions(c,'resources').find(r=>r.id==='OW').nodes.find(n=>n.id===same.id),
    gatheringRegions(c,'space').find(r=>r.id==='Moon').nodes.find(n=>n.id===same.id));
});
