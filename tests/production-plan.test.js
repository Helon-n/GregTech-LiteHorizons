import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/engine.js';
import {CATALOG as c} from '../src/data/catalog.js';
import {createProductionPlan,createProductionPreview,planSupplyMachines,recipeMachines,planGatherNodes} from '../src/core/production-plan.js';
import {machineSupportsRecipe} from '../src/core/technology.js';

test('indexed supply and processing routes retain alternate processes and machine capability requirements',()=>{
  const g=new Game();
  for(const id of ['steam','water','energy','creosote']){
    const expected=Object.values(c.machines).filter(m=>['boiler','generator','dyson','solar'].includes(m.energy?.kind)&&c.recipes.some(r=>machineSupportsRecipe(m,r)&&(r.outputs[id]>0||(r.energyOutputs??[]).includes(id))));
    assert.deepEqual(planSupplyMachines(g,id).map(m=>m.id),expected.map(m=>m.id),id);
  }
  for(const r of [c.recipes.find(r=>r.alsoProcesses?.length),c.recipes.find(r=>r.requirements?.heavyCentrifuge),c.recipes.find(r=>r.requirements?.nonCell)]){
    assert.ok(r);
    const expected=Object.values(c.machines).filter(m=>machineSupportsRecipe(m,r)&&!['boiler','generator','dyson','solar','battery'].includes(m.energy?.kind));
    assert.deepEqual(new Set(recipeMachines(g,r).map(m=>m.id)),new Set(expected.map(m=>m.id)));
  }
});

test('possible gathering sources remain visible while live access still requires tools and world entrances',()=>{
  const g=new Game(),n=c.gatherNodes.find(n=>n.id==='ore:Sulfur');
  assert.ok(planGatherNodes(g,n.output,false).some(x=>x.id===n.id));
  assert.equal(planGatherNodes(g,n.output).some(x=>x.id===n.id),false);
  g.add({ironPick:1,netherPortal:1});
  assert.ok(planGatherNodes(g,n.output).some(x=>x.id===n.id));
  g.pay({netherPortal:1});
  assert.equal(planGatherNodes(g,n.output).some(x=>x.id===n.id),false);
});

test('oversized previews keep known materials but execution rejects incomplete trees without changing inventory',()=>{
  const inputs=Object.fromEntries(Array.from({length:520},(_,i)=>['raw'+i,1]));
  const r={id:'wide',name:'wide',process:'craft',stage:0,seconds:1,inputs,outputs:{stick:1}};
  const g=new Game(null,{...c,recipes:[r],gatherNodes:[]}),before=structuredClone(g.state);
  const p=createProductionPreview(g,r.id);
  assert.equal(p.incomplete,true);assert.match(p.blockedReason,/配方树过长/);
  assert.equal(p.nodes.length,512);assert.equal(p.missing.length,511);
  assert.equal(p.nodes[0].recipe,r.id);assert.equal(p.nodes[1].item,'raw0');
  assert.deepEqual(g.state,before);
  assert.throws(()=>createProductionPlan(g,r.id),/配方树过长/);
  assert.equal(g.arrangeProduction(r.id,1).ok,false);
  assert.equal(g.state.productionPlan,undefined);assert.deepEqual(g.state,before);
});

test('continuous or random recipes expose actual inputs while remaining unavailable for batch scheduling',()=>{
  const g=new Game();
  for(const r of [c.recipes.find(r=>r.dynamicAmount),c.recipes.find(r=>r.incubation),c.recipes.find(r=>r.randomChoice),c.recipes.find(r=>r.beamSource)]){
    assert.ok(r);
    const p=createProductionPreview(g,r.id,2);
    assert.equal(p.directOnly,true);assert.equal(p.incomplete,true);assert.ok(p.blockedReason);
    for(const [id,n]of Object.entries(r.inputs)){
      const node=p.nodes.find(n=>n.depth===1&&!n.tool&&n.item===id);
      assert.equal(node.amount,n*2);assert.equal(node.have,Math.min(n*2,g.quantity(id)));
    }
    assert.equal(g.arrangeProduction(r.id,2).ok,false);assert.equal(g.state.productionPlan,undefined);
  }
  assert.throws(()=>createProductionPreview(g,'missing'),/请选择配方/);
  assert.throws(()=>createProductionPreview(g,'sticks',0),/请选择配方/);
});

test('shared byproducts and reusable tools are not charged again in later branches',()=>{
  const recipes=[
    {id:'root',name:'root',process:'craft',stage:0,seconds:1,inputs:{a:1,b:1},outputs:{stick:1},tools:{hammer:1}},
    {id:'branch',name:'branch',process:'craft',stage:0,seconds:1,inputs:{wood:1},outputs:{a:2,b:1},tools:{hammer:1}}
  ];
  const g=new Game(null,{...c,recipes,gatherNodes:[]});g.add({wood:1,hammer:1});
  const p=createProductionPreview(g,'root');
  assert.equal(p.missing.length,0);assert.deepEqual(p.steps.map(s=>s.recipe),['branch','root']);
  assert.equal(p.nodes.find(n=>n.item==='b').shortage,0);
  assert.equal(g.quantity('wood'),1);assert.equal(g.quantity('hammer'),1);
});

test('a real plan still executes and restores without offline rewards',()=>{
  const g=new Game();g.add({wood:2});
  const before=structuredClone(g.state),p=createProductionPreview(g,'sticks',2);
  assert.ok(!p.incomplete);assert.equal(p.missing.length,0);assert.deepEqual(g.state,before);
  assert.equal(g.arrangeProduction('sticks',2).ok,true);g.simulate(.5);
  const h=new Game(g.snapshot());
  assert.equal(h.quantity('stick'),g.quantity('stick'));
  h.simulate(30);
  assert.equal(h.state.productionPlan.status,'制作完成');
  assert.equal(h.quantity('stick'),8);assert.equal(h.quantity('wood'),0);
});
