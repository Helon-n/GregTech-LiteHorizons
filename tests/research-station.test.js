import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {energyCapacity} from '../src/core/energy.js';
import {requirementFailure,requirementLabels} from '../src/core/technology.js';

function build(g,type){g.add(g.catalog.machines[type].cost);const b=g.build(type);assert.equal(b.ok,true);return b.device;}
function setup(){
  const g=new Game();g.state.stage=15;
  const r=g.catalog.recipes.find(r=>r.process==='stationResearch'&&r.inputs.gtItem_Circuit_Wetwaresupercomputer);
  assert.ok(r);
  const d=build(g,'researchStationCps'+r.requirements.computation);
  const b=build(g,'batteryBuffer');b.energyTier=8;
  g.add({batteryUV:4});for(let i=0;i<4;i++)assert.equal(g.changeBattery(b.id,true).ok,true);
  b.eu=energyCapacity(g,b);g.add(r.inputs);
  assert.equal(g.setSupply(d.id,'storage',b.id).ok,true);
  assert.equal(g.assign(d.id,r.id).ok,true);
  return {g,d,b,r};
}

test('station research spends its sample, data stick and full EU once across pause and reload',()=>{
  const {g,d,b,r}=setup(),data=Object.keys(r.outputs)[0],before=d.eu+b.eu;
  const run=g.deviceRuntime(d,r);assert.equal(run.valid,true);assert.equal(run.power,r.power);assert.equal(run.seconds,r.seconds);
  g.tick(.5);assert.ok(d.job);for(const id of Object.keys(r.inputs))assert.equal(g.quantity(id),0);
  assert.equal(g.quantity(data),0);assert.equal(d.eu+b.eu,before-r.power*10);
  g.toggle(d.id);const remaining=d.job.remaining;g.simulate(2);assert.equal(d.job.remaining,remaining);
  const h=new Game(g.snapshot()),loaded=h.state.devices.find(v=>v.id===d.id),battery=h.state.devices.find(v=>v.id===b.id);
  assert.deepEqual(loaded.job,d.job);assert.equal(loaded.enabled,false);
  h.toggle(loaded.id);h.simulate(remaining);
  assert.equal(h.quantity(data),1);assert.equal(loaded.job,null);
  assert.equal(loaded.eu+battery.eu,before-r.power*20*r.seconds);
  h.simulate(1);assert.equal(h.quantity(data),1);
  const ass=h.catalog.recipes.find(v=>v.process==='assemblyLine'&&v.requirements?.researchData===data);
  assert.ok(ass);const line=build(h,'assemblyLine');
  assert.equal(requirementFailure(h,line,ass),'');h.pay({[data]:1});
  assert.match(requirementFailure(h,line,ass),/研究/);
});

test('insufficient computation or research voltage cannot spend samples or generate data',()=>{
  const {g,d,r}=setup(),data=Object.keys(r.outputs)[0];
  const weak=build(g,'researchStationCps16');
  assert.equal(g.assign(weak.id,r.id).ok,true);weak.eu=energyCapacity(g,weak);
  assert.match(requirementFailure(g,weak,r),/算力不足/);d.enabled=false;g.tick(.5);
  assert.equal(weak.job,null);for(const [id,n]of Object.entries(r.inputs))assert.equal(g.quantity(id),n);
  assert.equal(g.quantity(data),0);
  const high=g.catalog.recipes.find(v=>v.process==='stationResearch'&&v.requirements.researchVoltage>8*4**8);
  assert.ok(high);const voltageLimited=build(g,'researchStationCps'+high.requirements.computation);
  assert.match(requirementFailure(g,voltageLimited,high),/研究电压不足/);assert.equal(g.deviceRuntime(voltageLimited,high).valid,false);
  assert.ok(requirementLabels(g,r).some(label=>label.includes('算力')));
});
