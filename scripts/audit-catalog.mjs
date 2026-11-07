// Static catalog inspection only. Does not create a Game, tick production,
// start the app, or assert gameplay outcomes.
import {writeFile,mkdir,access,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {CATALOG as c} from '../src/data/catalog.js';
import {ENERGY_REFERENCE as energy} from '../src/data/energy-reference.js';
import {recipeProcesses,machineSupportsRecipe} from '../src/core/technology.js';
import {COILS} from '../src/data/technology-catalog.js';
import {fusionCapacity} from '../src/core/fusion.js';
import {GODFORGE_REFERENCE as forge} from '../src/data/godforge-reference.js';
import {forgeHeat,forgeVoltage} from '../src/core/godforge.js';
import {PURIFICATION_REFERENCE as water} from '../src/data/purification-reference.js';
import {NAQUADAH_REFERENCE as naquadah} from '../src/data/naquadah-reference.js';
import {RENEWABLES_REFERENCE as renewables} from '../src/data/renewables-reference.js';
import {NUCLEAR_REFERENCE as nuclear} from '../src/data/nuclear-reference.js';
import {BIOCHEMISTRY_REFERENCE as biology} from '../src/data/biochemistry-reference.js';
import {BEC_REFERENCE as bec} from '../src/data/bec-reference.js';
import {EOH_REFERENCE as eoh} from '../src/data/eoh-reference.js';
import {LATE_MACHINES_REFERENCE as late} from '../src/data/late-machines-reference.js';
import {FOUNDRY_REFERENCE as foundry} from '../src/data/foundry-reference.js';
import {BEAMLINE_REFERENCE as beam} from '../src/data/beamline-reference.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const errors=[],ids=new Set(),outputSources=new Map(),processes={},conditions={};
const fail=(kind,id,detail)=>errors.push({kind,id,detail});
const item=(id,owner)=>{if(!c.items[id])fail('missing-item',owner,id);};
const possibleOutput=(r,id)=>r.outputRolls?r.outputRolls.some(s=>s.id===id&&s.chance>0):(r.outputChances?.[id]??10000)>0;
for(const r of c.recipes){
  if(ids.has(r.id))fail('duplicate-recipe',r.id,'');ids.add(r.id);
  for(const field of ['inputs','outputs','tools'])for(const[id,n]of Object.entries(r[field]??{})){
    item(id,r.id);if(!Number.isFinite(n)||n<=0)fail('quantity',r.id,field+':'+id+'='+n);
  }
  if(!Number.isFinite(r.seconds)||r.seconds<=0)fail('duration',r.id,r.seconds);
  if(!Number.isFinite(r.power??0)||(r.power??0)<0)fail('power',r.id,r.power);
  if(!Number.isInteger(r.stage)||r.stage<0||r.stage>=c.stages.length)fail('stage',r.id,r.stage);
  for(const[id,n]of Object.entries(r.outputs??{}))if(n>0&&possibleOutput(r,id)){const list=outputSources.get(id)??[];list.push(r.id);outputSources.set(id,list);}
  for(const process of recipeProcesses(r))processes[process]=(processes[process]??0)+1;
  for(const key of Object.keys(r.requirements??{}))conditions[key]=(conditions[key]??0)+1;
  for(const key of ['researchData','researchItem','bioCulture'])if(r.requirements?.[key])item(r.requirements[key],r.id);
  for(const q of r.beamNeeds??[]){if(!beam.particles[q.particle]||!Number.isInteger(q.amount)||q.amount<1)fail('beam-requirement',r.id,q);else item(beam.particles[q.particle].id,r.id);}
  if(r.reactorBonus)item(r.reactorBonus,r.id);
  for(const slot of r.requirements?.becSlots??[]){item(slot.item,r.id);item(slot.nanite,r.id);if(!Number.isInteger(slot.tier)||slot.tier<0)fail('bec-slot',r.id,slot);}
  if(r.incubation){const q=r.incubation;item(q.catalyst,r.id);item(q.seedFluid,r.id);if(!r.tools?.[q.catalyst]||!(q.taskChance>0&&q.taskChance<=1)||!(q.lossChance>=0&&q.lossChance<=1))fail('incubation',r.id,q);}
  if(r.randomChoice){
    const q=r.randomChoice;
    if(!q.weights||Object.keys(q.weights).length!==Object.keys(r.outputs).length||!Number.isInteger(q.count)||q.count<1||!Number.isInteger(q.rolls)||q.rolls<1||q.rolls>4096||(q.noneWeight!==undefined&&(!Number.isInteger(q.noneWeight)||q.noneWeight<0))||Object.entries(q.weights).some(([id,w])=>!Number.isFinite(w)||w<=0||r.outputs[id]!==q.count*q.rolls))fail('weighted-output',r.id,q);
  }
  if(r.bath){item(r.bath.fluid,r.id);item(r.bath.waste,r.id);if(!(r.bath.divisor>0))fail('bath',r.id,r.bath.divisor);}
  for(const[id,n]of Object.entries(r.toolWear??{})){item(id,r.id);if(!r.tools?.[id]||!Number.isInteger(n)||n<1)fail('tool-wear',r.id,id);}
  for(const[id,n]of Object.entries(r.containerTools??{})){item(id,r.id);if(r.process!=='craft'||!c.containerTypes[id]||r.tools?.[id]!==n||!Number.isInteger(n)||n<1||!r.containerPortAdapted)fail('crafting-container-tool',r.id,id);}
  for(const slot of r.outputRolls??[]){item(slot.id,r.id);if(!Object.hasOwn(r.outputs,slot.id)||!Number.isFinite(slot.count)||slot.count<=0||!Number.isInteger(slot.chance)||slot.chance<0||slot.chance>10000)fail('chance-slot',r.id,slot);}
  for(const[id,chance]of Object.entries(r.outputChances??{}))if(!Object.hasOwn(r.outputs,id)||!Number.isInteger(chance)||chance<0||chance>10000)fail('chance',r.id,{id,chance});
  for(const id of r.energyOutputs??[])item(id,r.id);
  if(r.batchEU&&(!Number.isSafeInteger(r.batchEU)||r.batchEU<1))fail('batch-energy',r.id,r.batchEU);
  for(const field of ['hot','cold','normal','heated'])if(r.exchanger?.[field])item(r.exchanger[field],r.id);
  if(r.thermalBoiler){item(r.thermalBoiler.steam,r.id);if(r.outputs[r.thermalBoiler.steam]!==r.thermalBoiler.amount||r.power!==0||r.seconds!==1)fail('thermal-cycle',r.id,r.thermalBoiler);}
  if(r.grid){
    const quantities={};for(const id of r.grid)if(id){item(id,r.id);quantities[id]=(quantities[id]??0)+1;}
    if(![3,9].includes(r.gridWidth??3)||r.grid.length!==(r.gridWidth??3)**2||Object.keys(quantities).length!==Object.keys(r.inputs).length||Object.entries(quantities).some(([id,n])=>!Number.isInteger(r.inputs[id]/n)))fail('crafting-grid',r.id,r.grid);
    for(const [index,id]of Object.entries(r.gridTools??{})){item(id,r.id);if(!r.tools?.[id]||!/^\d+$/.test(index)||Number(index)>=r.grid.length||r.grid[index])fail('crafting-tool-grid',r.id,{index,id});}
  }
}
const machineList=Object.values(c.machines),unserved=[],servingMachines=new Map();
for(const u of forge.upgrades){for(const id of Object.keys(u.cost))item(id,'godforge-upgrade:'+u.code);}
for(const [piece,cost] of Object.entries(forge.structures))for(const id of Object.keys(cost))item(id,'godforge-structure:'+piece);
item(forge.startup,'godforge-startup');for(const id of forge.fuels)item(id,'godforge-fuel');
item(forge.shard,'godforge-shard');
for(const id of [naquadah.controller,naquadah.air[0],...naquadah.coolants.map(a=>a[0]),...naquadah.exciters.map(a=>a[0])])item(id,'large-naquadah-reactor');
for(const id of [renewables.solar.controller,renewables.solar.reflector,renewables.solar.cold,renewables.solar.hot,...Object.keys(renewables.solar.structure),renewables.pump.controller,renewables.pump.pipe,...Object.keys(renewables.pump.structure)])item(id,'renewable-energy');
for(const key of ['items','fluids','magmatter'])for(const row of forge.exotic[key]){
  item(row.sample,'exotic-sample');item(row.plasma,'exotic-plasma');if(!Number.isSafeInteger(row.weight)||row.weight<1)fail('exotic-weight',row.sample,row.weight);
}
for(const key of ['quark','mag','time','space','controller'])item(forge.exotic[key],'exotic-'+key);
for(const id of [...water.controllers,...water.waters,water.filter,water.pac,water.waste,water.alkaline,water.acid,water.plasma,water.coolant,...water.lenses,...water.gases.map(a=>a[0]),...water.superconductors.map(a=>a[0]),water.neutronium,water.infinity,...water.catalysts,water.baryonic])item(id,'waterline');
const forgeState={factor:2147483647,rings:3,upgrades:forge.upgrades.filter(u=>!u.unresolved.length).map(u=>u.code)};
for(const m of machineList){
  item(m.id,m.id);for(const id of Object.keys(m.cost))item(id,m.id);
  if(m.energy&&!(m.energy.tier===undefined||Number.isInteger(m.energy.tier)&&m.energy.tier>=0&&m.energy.tier<energy.voltage.length))fail('machine-voltage',m.id,m.energy.tier);
}
for(const r of c.recipes){
  if(['craft','build'].includes(r.process))continue;
  const machines=machineList.filter(m=>machineSupportsRecipe(m,r));
  if(!machines.length){unserved.push({recipe:r.id,process:r.process,reason:'no-machine'});continue;}
  const voltageOK=m=>m.godforge&&m.godforge!=='host'?(r.power??0)<=forgeVoltage(forgeState):m.energy?.prepaid?!!r.batchEU:!['steam','consumer'].includes(m.energy?.kind)||(r.power??0)<=(m.energy?.kind==='steam'?32:energy.voltage[m.energy?.maxTier??m.energy?.tier??0]*(m.energy?.recipeAmps??1));
  if(!machines.some(voltageOK)){unserved.push({recipe:r.id,process:r.process,reason:'voltage'});continue;}
  const conditionOK=m=>{
    const q=r.requirements??{},cap=m.capabilities??{},tier=m.energy?.maxTier??m.energy?.tier??0;
    if(r.process==='stationResearch'&&q.researchVoltage>energy.voltage[tier])return false;
    if(q.startup&&(!m.energy?.fusion||q.startup>fusionCapacity(m.energy,tier)))return false;
    if(q.heat&&(m.godforge?q.heat>forgeHeat(forgeState,m.godforge):!m.coils||q.heat>Math.max(...COILS.map(c=>c.heat))+(m.id==='ebf'?100*(tier-2):0)))return false;
    for(const key of ['compressionTier','chemicalCasing','preciseCasing','componentCasing','spaceModule','pcbTier','qftTier','qftFocus','nanoForgeTier','refineryCoil','plasmaTier','exoticTier','nanochipTier','computation'])if(q[key]!==undefined&&!(m.godforge&&['plasmaTier','exoticTier'].includes(key))&&(cap[key]??-1)<q[key])return false;
    if(q.algaeTier!==undefined&&cap.algaeTier!==q.algaeTier)return false;
    if(q.bioGlass!==undefined&&(cap.bioGlass??-1)<q.bioGlass)return false;
    for(const key of ['bioUpgrade','multiStepPlasma','heavyCentrifuge','nonCell'])if(q[key]&&!(m.godforge&&key==='multiStepPlasma')&&!cap[key])return false;
    if(q.nkeRange&&(!cap.nkeRange||cap.nkeRange.min<q.nkeRange.min||cap.nkeRange.max>q.nkeRange.max))return false;
    return true;
  };
  const serving=machines.filter(m=>voltageOK(m)&&conditionOK(m));servingMachines.set(r.id,serving);
  if(!serving.length)unserved.push({recipe:r.id,process:r.process,reason:'machine-condition'});
}
const gathered=new Set();
for(const node of c.gatherNodes){
  for(const id of [node.requires,...(node.requiresAll??[])].filter(Boolean))item(id,node.id);
  if(node.exclusiveDrops){
    if(node.exclusiveDrops.reduce((sum,d)=>sum+d.chance,0)>1)fail('exclusive-drop-total',node.id);
    for(const d of node.exclusiveDrops){
      if(!(d.chance>0&&d.chance<=1))fail('exclusive-drop-chance',node.id);
      for(const [id,n]of Object.entries(d.items)){item(id,node.id);const range=node.dropRanges?.[id];if(!Number.isInteger(n)||n<1||!range||n>range.max)fail('exclusive-drop-count',node.id,id);}
    }
  }
  gathered.add(node.output);for(const id of Object.keys(c.nodeDrops[node.id]??{}))gathered.add(id);
  for(const [id,p]of Object.entries(node.dropProbabilities??{})){
    const range=node.dropRanges?.[id];
    if(!Number.isFinite(p)||p<0||p>1||range?.min!==0||range?.max!==1)fail('gather-probability',node.id,{id,p,range});
  }
}
const used=new Set(c.recipes.flatMap(r=>Object.keys({...r.inputs,...r.tools})).concat(machineList.flatMap(m=>Object.keys(m.cost))));
for(const r of c.recipes)for(const q of r.beamNeeds??[])if(beam.particles[q.particle])used.add(beam.particles[q.particle].id);
for(const module of Object.values(beam.modules)){item(module.casing,'beam-detector');used.add(module.casing);}
for(const r of c.recipes){
  if(r.incubation)used.add(r.incubation.seedFluid);
  for(const id of [r.requirements?.researchData,r.requirements?.researchItem])if(id)used.add(id);
  for(const slot of r.requirements?.becSlots??[])used.add(slot.nanite);
}
for(const f of Object.values(eoh.fields))for(const id of f.items){item(id,'eoh-field');used.add(id);}
for(const m of foundry.modules)for(const id of Object.keys(m.cost)){item(id,'foundry-module:'+m.code);used.add(id);}
for(const id of [late.fluid,late.kerosene,...foundry.coolants.map(c=>c.item)]){item(id,'auxiliary-fluid');used.add(id);}
for(const r of c.recipes)if(r.requirements?.bioCulture)used.add(r.requirements.bioCulture);
for(const id of Object.keys(biology.fuels)){item(id,'radiation-hatch');used.add(id);}
for(const u of forge.upgrades)for(const id of Object.keys(u.cost))used.add(id);
for(const cost of Object.values(forge.structures))for(const id of Object.keys(cost))used.add(id);
used.add(forge.startup);for(const id of forge.fuels)used.add(id);
for(const id of [naquadah.air[0],...naquadah.coolants.map(a=>a[0]),...naquadah.exciters.map(a=>a[0])])used.add(id);
for(const r of c.recipes.filter(r=>r.purification))for(const id of [water.waters[r.purification.tier],...(r.purification.tier===3?[water.pac]:r.purification.tier===4?[water.alkaline,water.acid]:r.purification.tier===5?[water.plasma,water.coolant]:r.purification.tier===6?water.lenses:r.purification.tier===7?[...water.gases.map(a=>a[0]),...water.superconductors.map(a=>a[0]),water.neutronium,water.coolant]:r.purification.tier===8?[...water.catalysts,water.infinity]:[])])used.add(id);
// These outputs are made by explicitly modelled dynamic operations, not a
// registered recipe. Include their actual dependencies in the material graph.
const dynamicSources=forge.fuels.map(fuel=>({id:'godforge:shards:'+fuel,inputs:[...Object.keys(c.machines.godforge.cost),forge.startup,fuel],outputs:[forge.shard]}));
// Optimistic collision sources still require the physical source/collider,
// an installed detector and an acceleratable input beam. Energy thresholds
// and ongoing supply are runtime conditions, not proved by this graph.
for(const [module,m]of Object.entries(beam.modules))for(const input of Object.values(beam.particles).filter(p=>p.accelerates))dynamicSources.push({id:'beam-collision:'+module+':'+input.id,inputs:[...Object.keys(c.machines.beamcollider.cost),m.casing,input.id],outputs:m.particles.filter(k=>beam.particles[k].weight>0).map(k=>beam.particles[k].id)});
for(const [fuel,spec]of Object.entries(nuclear.parts))if(spec.depleted){
  const drivers=spec.kind==='breeder'?Object.keys(nuclear.parts).filter(id=>nuclear.parts[id].kind==='fuel'):[null];
  for(const driver of drivers)dynamicSources.push({id:'nuclear:'+fuel+(driver?':'+driver:''),inputs:[nuclear.controller,fuel,...(driver?[driver]:[])],outputs:[spec.depleted]});
}
for(const id of [nuclear.controller,nuclear.chamber,...Object.keys(nuclear.fluidStructure),...Object.keys(nuclear.parts)])item(id,'nuclear-reactor');
for(const id of [nuclear.chamber,...Object.keys(nuclear.fluidStructure)])used.add(id);
for(const [part,cost]of Object.entries(nuclear.repairs)){item(part,'nuclear-repair');for(const id of Object.keys(cost)){item(id,'nuclear-repair:'+part);used.add(id);}}
for(const s of dynamicSources)for(const id of s.outputs){const list=outputSources.get(id)??[];list.push(s.id);outputSources.set(id,list);}
const sourceLess=[...used].filter(id=>!outputSources.has(id)&&!gathered.has(id)).map(id=>({id,name:c.items[id]?.name,kind:c.items[id]?.kind}));
// Optimistic material reachability: ignores quantities, stages, energy, world
// travel, machine construction and structure gates. Even under these relaxed
// assumptions an unreachable material is a real catalog dependency gap.
const extraInputs=r=>[...[r.requirements?.researchData,r.requirements?.bioCulture,r.incubation?.seedFluid].filter(Boolean),...(r.beamNeeds??[]).map(q=>beam.particles[q.particle]?.id).filter(Boolean)];
const reachable=new Set(gathered),graph=c.recipes.map(r=>({id:r.id,inputs:[...Object.keys(r.inputs??{}),...Object.keys(r.tools??{}),...extraInputs(r)],outputs:Object.keys(r.outputs??{}).filter(id=>possibleOutput(r,id))})).concat(dynamicSources);
let changed=true,passes=0;
while(changed){changed=false;passes++;for(const r of graph)if(r.inputs.every(id=>reachable.has(id)))for(const id of r.outputs)if(!reachable.has(id)){reachable.add(id);changed=true;}}
const unreachable=[...used].filter(id=>!reachable.has(id)).map(id=>({id,name:c.items[id]?.name,sources:outputSources.get(id)??[]}));
const blockedRecipes=graph.filter(r=>r.inputs.some(id=>!reachable.has(id))).map(r=>({id:r.id,missing:r.inputs.filter(id=>!reachable.has(id))}));
// A second graph includes construction, collection tools, research/cultures,
// physical fluid containment and selected special-machine installations. It
// still cannot prove a runnable energy network or enough material quantities.
const constructed=new Set(),supported=new Set();let constructionPasses=0,buildingChanged=true;
const spinRotors=Object.values(c.items).filter(i=>i.rotor);
const canContain=id=>c.items[id]?.kind!=='fluid'||Object.entries(c.containerTypes).some(([type,spec])=>constructed.has(type)&&(!spec.accepts||spec.accepts.includes(id)));
const addConstructed=id=>{if(!constructed.has(id)&&canContain(id)){constructed.add(id);buildingChanged=true;}};
const installedConditions=(r,m)=>{
  const q=r.requirements??{};
  if(q.cleanroom&&!constructed.has('cleanroomFacility'))return false;
  if(q.heat&&!m.godforge&&!COILS.some(coil=>constructed.has(coil.item)&&coil.heat+(m.id==='ebf'?100*((m.energy.maxTier??m.energy.tier)-2):0)>=q.heat))return false;
  if(m.spinmatron&&(!spinRotors.some(i=>constructed.has(i.id))||!(constructed.has(late.fluid)||!q.heavyCentrifuge&&constructed.has(late.kerosene))))return false;
  if((m.orbital||q.lowGravity)&&!constructed.has('spaceElevator'))return false;
  if(m.foundry&&r.power>8*4**10&&!foundry.modules.some(module=>['HELIOCAST_REINFORCEMENT','UNIVERSAL_COLLAPSER'].includes(module.code)&&Object.keys(module.cost).every(id=>constructed.has(id))&&(!module.chassis||constructed.has(foundry.chassis[m.foundry-1]))))return false;
  if(m.bec&&m.bec!=='storage'&&!constructed.has('becstorage'))return false;
  if(q.becSlots&&!q.becSlots.every(slot=>bec.nanites.some(n=>n.tier>=slot.tier&&constructed.has(n.item))))return false;
  if(q.eohSpace!==undefined&&!eoh.fields.space.items.slice(q.eohSpace).some(id=>constructed.has(id)))return false;
  return true;
};
while(buildingChanged){
  buildingChanged=false;constructionPasses++;
  for(const n of c.gatherNodes)if((!n.requires||constructed.has(n.requires))&&(n.requiresAll??[]).every(id=>constructed.has(id))&&(!['moon','mars','belt'].includes(n.id)||constructed.has(n.id==='belt'?'advancedRocket':'rocket'))&&(n.stage!==0||['forest','surface','river'].includes(n.id)||constructed.has('flintPick')))for(const id of Object.keys(c.nodeDrops[n.id]??n.dropRanges??{[n.output]:1}))addConstructed(id);
  for(const m of machineList)if(Object.keys(m.cost).every(id=>constructed.has(id)))addConstructed(m.id);
  for(const r of c.recipes){
    const deps=[...Object.keys(r.inputs),...Object.keys(r.tools??{}),...extraInputs(r)];
    if(deps.some(id=>!constructed.has(id))||r.process!=='craft'&&!(servingMachines.get(r.id)??[]).some(m=>constructed.has(m.id)&&installedConditions(r,m)))continue;
    supported.add(r.id);for(const id of Object.keys(r.outputs).filter(id=>possibleOutput(r,id)))addConstructed(id);
  }
  for(const s of dynamicSources)if(s.inputs.every(id=>constructed.has(id)))for(const id of s.outputs)addConstructed(id);
}
const constructionReachability={assumptions:'Static dependencies only; ignores quantities, actual energy-network reachability, machine upgrade costs, timing, probability and spatial mechanics. Includes machine construction, gather tools/rockets, fluid containers, research/cultures, cleanroom, coils, BEC nanites/network and EOH space fields. Includes beam particle/module dependencies but ignores collision energy thresholds. No chapter gating.',passes:constructionPasses,reachable:constructed.size,unreachable:[...used].filter(id=>!constructed.has(id)),unsupportedRecipes:c.recipes.filter(r=>!supported.has(r.id)).map(r=>r.id),milestones:c.milestones.map((goals,stage)=>({stage,missing:Object.keys(goals).filter(id=>!constructed.has(id))}))};
constructionReachability.unbuiltMachines=machineList.filter(m=>!constructed.has(m.id)).map(m=>({id:m.id,missing:Object.keys(m.cost).filter(id=>!constructed.has(id))}));
for(const goal of constructionReachability.milestones)for(const id of goal.missing)fail('mainline-source-gap',id,{stage:goal.stage});
for(const m of constructionReachability.unbuiltMachines)fail('machine-source-gap',m.id,m.missing);
const missingIcons=[];
await Promise.all([...Object.values(c.items)].map(async i=>{try{await access(path.join(root,'src/assets/gtnh',`${i.icon||i.id}.svg`));}catch{missingIcons.push({id:i.id,icon:i.icon||i.id,name:i.name});}}));
const provenance={};
for(const label of ['industry','technology']){
  const p=JSON.parse(await readFile(path.join(root,`src/data/${label}-provenance.json`),'utf8'));
  provenance[label]={recipes:p.recipes,unresolved:p.unresolved?.length??0,sourceFiles:Object.keys(p.sourceFiles??{}).length,...(p.crafting?{literalCrafting:p.crafting.recipes,craftingUnresolved:p.crafting.unresolved.length}:{})};
}
const report={description:'Static catalog audit; counts do not prove runtime recipe parity or gameplay correctness. Machine-condition checks use hypothetical fully upgraded devices, not a reachable upgrade path.',totals:{items:Object.keys(c.items).length,recipes:c.recipes.length,machines:machineList.length,fuels:c.fuels.length},provenance,processes,conditions,errors,unserved,sourceLess,materialReachability:{assumptions:'Optimistic: only input/tool/research dependencies; ignores quantities, energy, stages, machine construction and world gates. Reachable does not mean playable.',passes,reachable:reachable.size,unreachable,blockedRecipes},missingIcons,dynamic:{sources:dynamicSources,exoticPools:Object.fromEntries(['items','fluids','magmatter'].map(k=>[k,forge.exotic[k].length])),exoticUnresolved:forge.exotic.unresolved,waterlineRecipes:c.recipes.filter(r=>r.purification).length},unusedMachines:machineList.filter(m=>!m.facility&&!m.orbital&&!['battery'].includes(m.energy?.kind)&&m.id!=='spaceElevator'&&m.beamline!=='collider'&&!c.recipes.some(r=>machineSupportsRecipe(m,r))).map(m=>({id:m.id,name:m.name}))};
await mkdir(path.join(root,'docs/generated'),{recursive:true});
report.constructionReachability=constructionReachability;
await writeFile(path.join(root,'docs/generated/catalog-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,errors:errors.length,unserved:unserved.length,sourceLess:sourceLess.length,materialUnreachable:unreachable.length,blockedRecipes:blockedRecipes.length,constructionUnreachable:constructionReachability.unreachable.length,milestones:constructionReachability.milestones,missingIcons:missingIcons.length,unusedMachines:report.unusedMachines},null,2));
if(errors.length)process.exitCode=1;
