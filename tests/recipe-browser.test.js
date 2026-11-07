import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../src/data/catalog.js';
import {recipeEntries,recipesForItem,productName} from '../src/core/recipe-browser.js';

test('item lookup finds all production routes, byproducts, constructions and reusable-tool usages',()=>{
  const entries=recipeEntries(CATALOG);
  assert.equal(productName(CATALOG,entries.find(r=>r.id==='pick')),'燧石镐');
  assert.equal(productName(CATALOG,entries.find(r=>r.id==='sticks')),'木棍');
  assert.ok(recipesForItem(entries,'creosote').some(r=>r.process==='coke'&&r.outputs.creosote===500));
  assert.ok(recipesForItem(entries,'furnace').some(r=>r.id==='build:furnace'));
  assert.ok(recipesForItem(entries,'hammer','uses').some(r=>r.id==='ironPlateHand'));
  assert.ok(recipesForItem(entries,'water','uses').some(r=>r.id==='steam'));
  assert.equal(entries.length,CATALOG.recipes.length+Object.keys(CATALOG.machines).length);
  const initial=recipeEntries(CATALOG,0);
  assert.deepEqual(initial.map(r=>r.id),entries.map(r=>r.id),'chapter metadata cannot hide recipes');
  assert.ok(recipesForItem(initial,'steam').some(r=>r.id==='steam'));
  assert.ok(initial.some(r=>r.stage>2),'late recipes remain visible');
});
