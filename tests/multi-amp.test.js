import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {energyCapacity,voltage} from '../src/core/energy.js';

function build(g,type){g.add(g.catalog.machines[type].cost);const result=g.build(type);assert.equal(result.ok,true);return result.device;}

test('nano forge consumes the full multi-amp recipe energy, pauses, and resumes after loading',()=>{
  let g=new Game();g.state.stage=15;
  const r=g.catalog.recipes.find(r=>r.process==='nanoForge'&&r.outputs.neutroniumNanite);
  let d=build(g,'nanoForge');d.energyTier=9;
  const run=g.deviceRuntime(d,r);assert.ok(r.power>voltage(d));assert.equal(run.valid,true);
  assert.equal(run.power,r.power);assert.equal(run.seconds,r.seconds);
  g.add({largeTank:1});g.placeContainer('largeTank');assert.equal(g.add({...r.inputs,...r.tools}),true);
  assert.equal(g.assign(d.id,r.id).ok,true);d.eu=energyCapacity(g,d);
  g.tick(.5);assert.ok(d.job);assert.equal(d.eu,energyCapacity(g,d)-r.power*10);
  let consumed=r.power*10;
  const reserve=d.eu;d.eu=0;const remaining=d.job.remaining;
  g.tick(.5);assert.equal(d.job.remaining,remaining);assert.equal(d.blocked,'电力不足');
  g=new Game(g.snapshot());d=g.state.devices.find(x=>x.id===d.id);assert.equal(d.job.remaining,remaining);d.eu=reserve;
  for(let i=0;i<1000&&d.job;i++){
    d.eu=energyCapacity(g,d);const before=d.eu;g.tick(.5);consumed+=before-d.eu;
  }
  assert.equal(d.job,null);assert.equal(g.quantity('neutroniumNanite'),1);
  assert.equal(consumed,r.power*20*r.seconds);
  for(const id of Object.keys(r.inputs))assert.equal(g.quantity(id),0);
  for(const [id,n]of Object.entries(r.tools))assert.equal(g.quantity(id),n);
  d.energyTier=7;assert.equal(g.deviceRuntime(d,r).valid,false);
});

test('nanochip matrix uses hatch total power and never overclocks below five seconds',()=>{
  const g=new Game();g.state.stage=15;
  const r=g.catalog.recipes.find(r=>r.process==='nanochipAssemble'&&r.outputs.nanoComponent_PicoCircuit);
  assert.ok(r);
  const machine=Object.values(g.catalog.machines).find(m=>m.energy?.nanochip&&m.capabilities?.nanochipTier===r.requirements.nanochipTier);
  assert.ok(machine);const d=build(g,machine.id);d.energyTier=12;
  const run=g.deviceRuntime(d,r);assert.equal(run.valid,true);assert.ok(r.power>voltage(d));
  assert.equal(run.power,r.power*4);assert.equal(run.seconds,r.seconds/4);
  d.energyTier=14;const fast=g.deviceRuntime(d,r);assert.ok(fast.seconds>=5);assert.ok(fast.seconds<run.seconds);
  assert.ok(fast.power<=voltage(d)*64);assert.ok(fast.power*fast.seconds>=r.power*r.seconds);
});
