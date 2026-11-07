import test from 'node:test';
import assert from 'node:assert/strict';
import {createSearch} from '../src/core/search.js';
import {items} from '../src/data/catalog.js';

test('search keeps literal Chinese, English and registry ID lookup',()=>{
  assert.ok(createSearch('红砖')('红砖','bricks'));
  assert.ok(createSearch('IRONINGOT')('铁锭','ironIngot'));
  assert.ok(createSearch('LV')('蒸汽锻造锤','LV · 32 EU/t'));
  assert.ok(createSearch('蒸汽 LV')('蒸汽锻造锤','LV · 32 EU/t'));
  assert.equal(createSearch('红砖')('玻璃','glass'),false);
  assert.ok(createSearch('  ')(null,undefined));
  assert.equal(createSearch('不存在')(),false);
});

test('full pinyin supports case, syllable spaces, apostrophes and width normalization',()=>{
  for(const query of ['hongzhuan','HONGZHUAN','hong zhuan',"hong'zhuan",'hong-zhuan','ｈｏｎｇｚｈｕａｎ','hóngzhuān']){
    assert.ok(createSearch(query)('红砖'),query);
  }
  assert.ok(createSearch('sui shi gao')(items.flintPick.name));
  assert.ok(createSearch('ssg')(items.flintPick.name));
  assert.ok(createSearch('tiegao')(items.ironPick.name));
  assert.equal(createSearch('hongzhuan')('玻璃'),false);
});

test('pinyin initials work with tier codes, numeric labels and independent search fields',()=>{
  assert.ok(createSearch('hz')('红砖'));
  assert.ok(createSearch('zqdzc')('蒸汽锻造锤'));
  assert.ok(createSearch('LV zqdzc')('蒸汽锻造锤','LV · 32 EU/t'));
  assert.ok(createSearch('zqlv')('蒸汽 LV'));
  assert.ok(createSearch('1 hsg')('红石罐 #1','空容器'));
  assert.equal(createSearch('hz MV')('红砖','LV · 32 EU/t'),false);
  assert.equal(createSearch('zzzz')('红砖'),false);
});

test('material and machine polyphones use contextual readings',()=>{
  assert.ok(createSearch('zhongxinglixinji')('重型离心机'));
  assert.ok(createSearch('zxlxj')('重型离心机'));
  assert.ok(createSearch('changgan')('钨钢长杆'));
  assert.ok(createSearch('bxg')('不锈钢'));
  assert.ok(createSearch('bugang')('钚钢'));
});

test('aluminium can be searched with v, umlaut or accented umlaut',()=>{
  for(const query of ['lvding','lüding','lǚdìng','lv ding','ld'])assert.ok(createSearch(query)('铝锭'),query);
});
