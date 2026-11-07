import {CATALOG as c} from '../src/data/catalog.js';
import {machineSupportsRecipe} from '../src/core/technology.js';
const known=new Set(),built=new Set();const stage=Number(process.argv[2]??1);let change=true;
while(change){
  change=false;
  const add=id=>{
    if(c.items[id].kind==='fluid'&&!Object.entries(c.containerTypes).some(([type,container])=>known.has(type)&&(!container.accepts||container.accepts.includes(id))))return;
    if(!known.has(id)){known.add(id);change=true;}
  };
  for(const n of c.gatherNodes){
    if(n.requires&&!known.has(n.requires)||n.id==='belt'&&!known.has('advancedRocket')||['moon','mars'].includes(n.id)&&!known.has('rocket')||n.stage===0&&!['forest','surface','river'].includes(n.id)&&!known.has('flintPick'))continue;
    Object.keys(c.nodeDrops[n.id]||n.dropRanges||{[n.output]:1}).forEach(add);
  }
  for(const m of Object.values(c.machines))if(Object.keys(m.cost).every(id=>known.has(id))&&!built.has(m.id)){built.add(m.id);add(m.id);change=true;}
  for(const r of c.recipes)if([...Object.keys({...r.inputs,...r.tools}),...[r.requirements?.researchData,r.requirements?.bioCulture,r.incubation?.seedFluid].filter(Boolean)].every(id=>known.has(id))&&(r.process==='craft'||[...built].some(id=>machineSupportsRecipe(c.machines[id],r))))Object.keys(r.outputs).forEach(add);
}
console.log('Static source inspection; chapters only select the displayed goals. Energy networks, quantities and all installed hardware are not simulated.');
console.log('missing goals',Object.keys(c.milestones[stage]).filter(id=>!known.has(id)));console.log('unbuilt',Object.values(c.machines).filter(m=>!built.has(m.id)).map(m=>({id:m.id,missing:Object.keys(m.cost).filter(id=>!known.has(id))})));
for(const id of process.argv.slice(3)){
  const seen=new Set();
  const routes=c.recipes.filter(r=>r.outputs[id]).map(r=>({id:r.id,stage:r.stage,process:r.process,missing:[...Object.keys({...r.inputs,...r.tools}),...[r.requirements?.researchData,r.requirements?.bioCulture,r.incubation?.seedFluid].filter(Boolean)].filter(id=>!known.has(id)),origin:r.origin}));
  routes.sort((a,b)=>(a.stage>stage)-(b.stage>stage)||a.missing.length-b.missing.length||a.stage-b.stage);
  console.log(id,known.has(id)?'reachable':routes.filter(r=>{const key=JSON.stringify([r.stage,r.process,r.missing]);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,12));
}
