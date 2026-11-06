import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../src/data/catalog.js';
import {recipeEntries,recipesForItem,productName} from '../src/core/recipe-browser.js';

test('item lookup finds all production routes, byproducts, constructions and reusable-tool usages',()=>{
  const entries=recipeEntries(CATALOG,2);
  assert.equal(productName(CATALOG,entries.find(r=>r.id==='pick')),'燧石镐');
  assert.equal(productName(CATALOG,entries.find(r=>r.id==='sticks')),'木棍');
  assert.ok(recipesForItem(entries,'creosote').some(r=>r.process==='coke'&&r.outputs.creosote===500));
  assert.ok(recipesForItem(entries,'furnace').some(r=>r.id==='build:furnace'));
  assert.ok(recipesForItem(entries,'hammer','uses').some(r=>r.id==='ironPlateHand'));
  assert.ok(recipesForItem(entries,'water','uses').some(r=>r.id==='steam'));
  assert.equal(recipesForItem(recipeEntries(CATALOG,0),'steam').length,0);
  assert.ok(entries.every(r=>r.stage<=2));
});
