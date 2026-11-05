import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {loadWorld,saveWorld} from '../src/core/storage.js';
const data=new Map();
globalThis.localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
test('valid backup survives a damaged primary save and subsequent saving repairs it',()=>{
 data.clear();const g=new Game();g.add({wood:5});assert.equal(saveWorld(g),true);g.add({wood:2});assert.equal(saveWorld(g),true);data.set('gtnh-long-road-v2','broken');const loaded=loadWorld();assert.equal(loaded.recovered,true);assert.equal(loaded.game.quantity('wood'),5);assert.equal(saveWorld(loaded.game),true);assert.equal(loadWorld().recovered,false);assert.equal(loadWorld().game.quantity('wood'),5);
});
test('unknown save schema returns a fresh world when no backup exists',()=>{data.clear();data.set('gtnh-long-road-v2',JSON.stringify({schema:999}));const {game}=loadWorld();assert.equal(game.state.stage,0);assert.deepEqual(game.state.inventory,{});});
