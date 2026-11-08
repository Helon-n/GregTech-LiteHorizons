import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeClock} from '../src/core/runtime-clock.js';
test('Android discards background time, including a delayed timer on resume',()=>{
  const clock=createRuntimeClock({pauseInBackground:true,now:0});
  assert.equal(clock.step(1000),1);
  clock.visibility(true,1100);
  assert.equal(clock.step(10000),0);
  assert.equal(clock.visibility(false,600000),0);
  assert.equal(clock.step(600100),.1);
});
test('desktop continues background ticks and catches up when timers were suspended',()=>{
  const clock=createRuntimeClock({now:0});clock.visibility(true,500);
  assert.equal(clock.step(1000),1);
  assert.equal(clock.step(2000),1);
  assert.equal(clock.visibility(false,12000),10);
  assert.equal(clock.step(12100),.1);
});
test('clock bounds timer steps, duplicate lifecycle events do not grant time',()=>{
  const clock=createRuntimeClock({pauseInBackground:true,now:0});
  assert.equal(clock.step(120000),60);
  clock.visibility(true,120001);clock.visibility(true,130000);
  clock.visibility(false,140000);clock.visibility(false,140001);
  assert.equal(clock.step(140101),.1);
});
