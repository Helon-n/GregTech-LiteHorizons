import test from 'node:test';
import assert from 'node:assert/strict';
import {craftingGrid} from '../src/core/workbench.js';
import {recipes,machines} from '../src/data/catalog.js';

test('every nine-slot layout matches all ingredient counts without adding or hiding materials',()=>{
  for(const r of [...recipes,...Object.values(machines).map(m=>({id:'build:'+m.id,inputs:m.cost}))]){
    const grid=craftingGrid(r.id,r.inputs),totals={};assert.equal(grid.length,9);
    for(const slot of grid.filter(Boolean))totals[slot.id]=(totals[slot.id]||0)+slot.count;
    assert.deepEqual(totals,r.inputs,r.id);
  }
});

test('starter tools have recognizable shapes and reusable tools are separate from consumable ingredients',()=>{
  assert.deepEqual(craftingGrid('pick',{flint:3,stick:2}).map(s=>s?.id||null),['flint','flint','flint',null,'stick',null,null,'stick',null]);
  const plate=recipes.find(r=>r.id==='ironPlateHand');assert.ok(plate.tools.hammer);
  assert.equal(craftingGrid(plate.id,plate.inputs).some(s=>s?.id==='hammer'),false);
  assert.equal(craftingGrid('build:furnace',machines.furnace.cost)[4].count,4);
});
