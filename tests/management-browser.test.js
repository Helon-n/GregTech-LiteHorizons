import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {deviceMatches,compareDevices,compareNames} from '../src/core/management-browser.js';

test('management search finds machine types, aliases, products and grouped member aliases without changing devices',()=>{
  const g=new Game();
  const build=()=>{g.add(g.catalog.machines.furnace.cost);return g.build('furnace').device;};
  const a=build(),b=build(),idle=build();
  g.renameDevice(a.id,'红砖一号炉');g.renameDevice(idle.id,'备用炉');
  g.assign(a.id,'bricks');g.assign(b.id,'bricks');
  assert.equal(g.saveGroup('device','烧砖车间',[a.id,b.id]).ok,true);
  const group=g.deviceEntries().find(d=>d.group),before=JSON.stringify(g.state);
  for(const query of ['zhuanlu','hongzhuan','hz','红砖','烧砖车间',a.id])assert.equal(deviceMatches(g,group,query),true,query);
  assert.equal(deviceMatches(g,b,'hongzhuan'),true,'an unnamed machine is searchable by its product');
  assert.equal(deviceMatches(g,group,'zzzz-no-match'),false);
  assert.equal(deviceMatches(g,idle,'备用'),true);
  assert.deepEqual([idle,group].sort((a,b)=>compareDevices(g,a,b)).map(d=>d.id),[group.id,idle.id]);
  assert.deepEqual([idle,group].sort((a,b)=>compareDevices(g,a,b,false)).map(d=>d.id),[idle.id,group.id]);
  assert.equal(JSON.stringify(g.state),before);
  assert.ok(compareNames('设备2','设备10')<0);
});
