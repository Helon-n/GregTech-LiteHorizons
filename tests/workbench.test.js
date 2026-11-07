import test from 'node:test';
import assert from 'node:assert/strict';
import {craftingGrid,constructionSlots} from '../src/core/workbench.js';
import {recipes,machines} from '../src/data/catalog.js';

test('every nine-slot layout matches all ingredient counts without adding or hiding materials',()=>{
  for(const r of recipes.filter(r=>r.process==='craft')){
    const grid=craftingGrid(r.id,r.inputs,r.grid),totals={};assert.equal(grid.length,(r.gridWidth??3)**2);
    for(const slot of grid.filter(Boolean))totals[slot.id]=(totals[slot.id]||0)+slot.count;
    assert.deepEqual(totals,r.inputs,r.id);
  }
});

test('construction pages preserve all structure materials, including structures with more than nine ingredients',()=>{
  let large=0;
  for(const m of Object.values(machines)){
    const slots=constructionSlots('build:'+m.id,m.cost),totals={};
    assert.equal(slots.length%9,0,m.id);
    for(const slot of slots.filter(Boolean))totals[slot.id]=(totals[slot.id]||0)+slot.count;
    assert.deepEqual(totals,m.cost,m.id);
    if(Object.keys(m.cost).length>9){large++;assert.ok(slots.length>9,m.id);}
  }
  assert.ok(large>=13,'regression coverage must include every known large structure');
  assert.throws(()=>craftingGrid('invalid',Object.fromEntries(Array.from({length:10},(_,i)=>['item'+i,1]))),/超过九种/);
});

test('starter tools have recognizable shapes and reusable tools are separate from consumable ingredients',()=>{
  assert.deepEqual(craftingGrid('pick',{flint:3,stick:2}).map(s=>s?.id||null),['flint','flint','flint',null,'stick',null,null,'stick',null]);
  const plate=recipes.find(r=>r.id==='ironPlateHand');assert.ok(plate.tools.hammer);
  assert.equal(craftingGrid(plate.id,plate.inputs).some(s=>s?.id==='hammer'),false);
  assert.equal(craftingGrid('build:furnace',machines.furnace.cost)[4].count,4);
});
