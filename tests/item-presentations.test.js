import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATALOG} from '../src/data/catalog.js';
import {ITEM_PRESENTATIONS} from '../src/data/item-presentations.js';
import {applyItemPresentations} from '../src/data/item-presentation-catalog.js';
import {productName} from '../src/core/recipe-browser.js';

const native=(registry,meta)=>Object.values(CATALOG.items).find(i=>i.nativeItem?.registry===registry&&i.nativeItem.meta===meta);

test('unfired seared brick smelts into named seared brick with an original vector icon',()=>{
  const item=native('TConstruct:materials',2);
  assert.equal(item.name,'焦黑砖');
  assert.equal(item.nativeItem.texture,'assets/tinker/textures/items/materials/material_searedbrick.png');
  const recipe=CATALOG.recipes.find(r=>r.inputs.nhItem_UnfiredSearedBrick);
  assert.deepEqual(recipe.outputs,{[item.id]:1});
  assert.equal(recipe.name,'焦黑砖');assert.equal(productName(CATALOG,recipe),'焦黑砖');
  assert.equal(recipe.power,4);assert.equal(recipe.seconds,6.4);
  const svg=fs.readFileSync(new URL(`../src/assets/gtnh/${item.id}.svg`,import.meta.url),'utf8');
  assert.match(svg,/<path /);assert.doesNotMatch(svg,/<image\b|data:image/);
});

test('metadata siblings retain their own materials, shapes, colors and computer tiers',()=>{
  assert.equal(native('TConstruct:materials',0).name,'纸叠');
  assert.equal(native('TConstruct:materials',36).name,'凝胶球');
  assert.notEqual(native('TConstruct:metalPattern',2).name,native('TConstruct:metalPattern',3).name);
  assert.notEqual(native('TConstruct:clayPattern',2).name,native('TConstruct:metalPattern',2).name);
  assert.equal(native('TConstruct:BowLimbPart',11).nativeItem.color,'a53000','generic part silhouette retains registered Ardite tint');
  assert.equal(native('appliedenergistics2:item.ItemMultiMaterial',13).name,'运算压印模板');
  assert.notEqual(native('appliedenergistics2:item.ItemMultiMaterial',22).name,native('appliedenergistics2:item.ItemMultiMaterial',23).name);
  assert.notEqual(ITEM_PRESENTATIONS['appliedenergistics2:item.ItemMultiPart@0'].name,ITEM_PRESENTATIONS['appliedenergistics2:item.ItemMultiPart@16'].name);
  assert.notEqual(native('OpenComputers:item',1).name,native('OpenComputers:item',2).name);
  assert.match(native('OpenComputers:item',5).name,/硬盘/);
  assert.notEqual(native('LogisticsPipes:item.itemModule',1).name,native('LogisticsPipes:item.itemModule',3).name);
});

test('confirmed presentation mappings contain no raw translation keys or replacement characters, and their vector assets exist',()=>{
  let icons=0;
  for(const item of Object.values(CATALOG.items)){
    const n=item.nativeItem;if(!n)continue;
    const key=`${n.registry}@${n.meta??0}`,p=ITEM_PRESENTATIONS[key];if(!p)continue;
    assert.equal(item.name,p.name,key);assert.doesNotMatch(item.name,/\ufffd|^(?:item|tile)\./,key);
    if(!p.nativeItem)continue;
    assert.equal(p.nativeItem.registry,n.registry);assert.equal(p.nativeItem.meta,n.meta);
    const asset=new URL(`../src/assets/gtnh/${item.icon||item.id}.svg`,import.meta.url);
    assert.ok(fs.existsSync(asset),key);icons++;
  }
  assert.ok(icons>800,'the batch must include real original textures beyond the screenshot');
});

test('presentation repair preserves item IDs, recipe operands, tools, research and authored route titles',()=>{
  const model={items:{a:{id:'a',name:'materials',kind:'item',nativeItem:{registry:'test:materials',meta:2,texture:'old.png'}},b:{id:'b',name:'炉渣',kind:'item'}},recipes:[
    {id:'derived',name:'materials + 炉渣',inputs:{b:3},outputs:{a:1,b:1},tools:{b:1},requirements:{research:'r1'},power:4,seconds:6.4},
    {id:'route',name:'特殊浇铸路线',inputs:{b:2},outputs:{a:1}},
    {id:'random',name:'materials',randomChoice:true,inputs:{b:2},outputs:{a:1}}
  ]};
  const before=structuredClone(model);
  applyItemPresentations(model,{'test:materials@2':{name:'焦黑砖'}});
  assert.equal(model.recipes[0].name,'焦黑砖 + 炉渣');
  assert.equal(model.recipes[1].name,'特殊浇铸路线');assert.equal(model.recipes[2].name,'materials');
  for(let i=0;i<before.recipes.length;i++){
    const {name:a,...oldRules}=before.recipes[i],{name:b,...newRules}=model.recipes[i];assert.deepEqual(newRules,oldRules);
  }
  const {name:a,nativeItem:an,...oldItem}=before.items.a,{name:b,nativeItem:bn,...newItem}=model.items.a;
  assert.deepEqual(newItem,oldItem);assert.equal(an.registry,bn.registry);assert.equal(an.meta,bn.meta);
  assert.deepEqual(model.items.b,before.items.b);
});
