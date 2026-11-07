import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {CATALOG as c} from '../src/data/catalog.js';
import {MINING_REFERENCE as reference} from '../src/data/mining-reference.js';
import {planGatherNodes} from '../src/core/production-plan.js';

const site=id=>c.gatherNodes.find(n=>n.id===id);
const clickRound=(g,id)=>{let outcome;for(let i=0;i<g.gatherClicks(site(id));i++){outcome=g.gather(id);assert.equal(outcome.ok,true,outcome.message);}return outcome;};

test('every imported vein has a referenced harvest level and known alternative worlds, even at chapter MAX',()=>{
  const g=new Game();g.state.stage=15;
  for(const n of c.gatherNodes.filter(n=>n.id.startsWith('ore:'))){
    assert.equal(n.miningLevel,reference.materials[n.id.slice(4)].oreLevel,n.id);
    assert.ok(n.regions.length,n.id);for(const id of n.regions)assert.ok(c.mining.regions[id],id);
    assert.equal(g.gather(n.id).ok,false,n.id+' must require an actual pick');
    assert.equal(g.buildCollector(n.id).ok,false,n.id+' automation must not bypass access');
  }
  assert.equal(g.gather('forest').ok,true);assert.equal(g.gather('surface').ok,true);
});

test('higher picks satisfy lower harvest levels while chapter progress never substitutes for tool quality',()=>{
  const g=new Game();g.add({flintPick:1});
  assert.equal(g.nodeAvailable(site('copperVein')),true);assert.equal(g.gather('ironVein').ok,false);
  assert.equal(g.gather('tinVein').ok,false);g.add({steelPick:1});assert.equal(g.nodeAvailable(site('tinVein')),true);
  assert.equal(g.gather('diamondVein').ok,false);g.add({stainlessPick:1});assert.equal(g.nodeAvailable(site('diamondVein')),true);
  assert.equal(g.state.stage,0);g.pay({flintPick:1});assert.equal(g.nodeAvailable(site('copperVein')),true);
  for(const id of ['neutroniumPick','duraniumPick','infinityPick']) {
    const r=c.recipes.find(r=>r.id==='mining:'+id);assert.equal(r.process,'assemble');assert.ok(r.power>0);
  }
});

test('small iron provides a paid furnace bootstrap without weakening the ordinary iron vein',()=>{
  const g=new Game();g.add({flintPick:1,stick:2,coal:3,...c.machines.furnace.cost});
  const {device}=g.build('furnace');g.nextDropRandom=()=>.1;
  assert.equal(site('smallOre:Iron').miningLevel,1);assert.equal(site('smallOre:Tin').miningLevel,2);
  assert.equal(g.gather('ironVein').ok,false);
  for(let i=0;i<3;i++)assert.deepEqual(clickRound(g,'smallOre:Iron').drops,{ironCrushed:1});
  assert.equal(g.assign(device.id,'mining:smelt:ironCrushed').ok,true);g.simulate(24);
  assert.equal(g.quantity('iron'),3);assert.equal(g.quantity('coal'),0);
  assert.equal(g.craft('mining:ironPick').ok,true);g.simulate(4);
  assert.equal(g.quantity('iron'),0);assert.equal(g.quantity('ironPick'),1);
  assert.equal(g.nodeAvailable(site('ironVein')),true);assert.equal(g.nodeAvailable(site('tinVein')),false);
});

test('remote veins require a real world entrance as well as a pick, and any valid natural world is sufficient',()=>{
  const g=new Game();g.add({steelPick:1});
  for(const id of ['ore:Sulfur','ore:Amber','endstoneQuarry','moon'])assert.equal(g.nodeAvailable(site(id)),false,id);
  g.add({netherPortal:1});assert.equal(g.nodeAvailable(site('ore:Sulfur')),true);
  assert.equal(g.nodeAvailable(site('ore:Amber')),false);g.add({twilightPortal:1});assert.equal(g.nodeAvailable(site('ore:Amber')),true);
  g.add({endPortal:1});assert.equal(g.nodeAvailable(site('endstoneQuarry')),true);
  g.add({advancedRocket:1});assert.equal(g.nodeAvailable(site('moon')),true);
  // Owning just the travel prerequisite never supplies the missing mining tool.
  g.pay({steelPick:1});assert.equal(g.nodeAvailable(site('moon')),false);
});

test('collectors pause on missing tools or entrances, restore paused state, and never bank inaccessible time',()=>{
  const g=new Game(),n=site('ore:Sulfur');g.add({steelPick:1,netherPortal:1,...n.cost});
  assert.equal(g.buildCollector(n.id).ok,true);g.tick(.5);const before=g.state.collectors[n.id].elapsed;
  g.pay({netherPortal:1});g.simulate(30);assert.equal(g.state.collectors[n.id].elapsed,before);
  assert.match(g.state.collectors[n.id].blocked,/地区入口/);assert.equal(g.quantity(n.output),0);
  const h=new Game(g.snapshot());h.simulate(30);assert.equal(h.state.collectors[n.id].elapsed,before);
  h.add({netherPortal:1});h.pay({steelPick:1});h.tick(.5);assert.match(h.state.collectors[n.id].blocked,/采掘等级/);
  h.add({ironPick:1});h.tick(.5);assert.equal(h.state.collectors[n.id].elapsed,before+.5);
  assert.equal(h.state.collectors[n.id].blocked,'运行中');assert.equal(h.quantity(n.output),0);
  h.simulate(n.seconds*4-1);assert.ok(h.quantity(n.output)>0);
});

test('manual partial progress and production-plan sources respect changed access conditions',()=>{
  const g=new Game(),n=site('ore:Sulfur');g.add({ironPick:1,netherPortal:1});g.gather(n.id);
  assert.equal(g.state.gatherProgress[n.id],1);assert.ok(planGatherNodes(g,n.output).some(s=>s.id===n.id));
  g.pay({netherPortal:1});assert.equal(g.gather(n.id).ok,false);assert.equal(g.state.gatherProgress[n.id],1);
  assert.equal(planGatherNodes(g,n.output).some(s=>s.id===n.id),false);
  const h=new Game(g.snapshot());assert.equal(h.gather(n.id).ok,false);h.add({netherPortal:1});
  assert.equal(h.gather(n.id).clicks,2);
});

test('world entrances charge physical construction and quenching requires real fluid containers',()=>{
  const g=new Game();assert.equal(g.build('netherPortal').ok,false);assert.equal(g.craft('mining:quenchObsidian').ok,false);
  g.add({fluidTank:2});g.placeContainer('fluidTank');g.placeContainer('fluidTank');g.add({water:1000,lava:1000});
  assert.equal(g.craft('mining:quenchObsidian').ok,true);assert.equal(g.quantity('water'),0);assert.equal(g.quantity('lava'),0);
  g.simulate(5);assert.equal(g.quantity('obsidianBlock'),1);
  g.add({obsidianBlock:9,flint:1,iron:1});assert.equal(g.build('netherPortal').ok,true);assert.equal(g.quantity('obsidianBlock'),0);
  assert.equal(g.owned('netherPortal'),1);assert.equal(g.dismantle(g.state.devices[0].id).ok,true);
  assert.equal(g.owned('netherPortal'),0);assert.equal(g.quantity('obsidianBlock'),10);
});
