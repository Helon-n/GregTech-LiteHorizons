import {BIOCHEMISTRY_REFERENCE as B} from '../data/biochemistry-reference.js';
import {endpointMembers} from './groups.js';
import {acceptsFluid,containerCapacity} from './fluids.js';

const isVat=(game,d)=>!!game.catalog.machines[d.type]?.bioVat;
const dose=(level,coverage)=>level-Math.ceil(Math.fround(Math.fround(level/100)*coverage));
const candidateCache=new Map();
const coverageFor=(level,req)=>{
  if(!req||!req.value)return 100;
  for(let c=0;c<=100;c++)if(req.exact?dose(level,c)===req.value:dose(level,c)>=req.value)return c;
  return null;
};
function candidates(req){
  const key=req.value+':'+!!req.exact;
  if(!candidateCache.has(key))candidateCache.set(key,Object.entries(B.fuels)
    .map(([id,fuel])=>({id,fuel,coverage:coverageFor(fuel.sievert,req)})).filter(x=>x.coverage!==null)
    .sort((a,b)=>a.fuel.sievert-b.fuel.sievert||a.fuel.mass-b.fuel.mass||a.id.localeCompare(b.id)));
  return candidateCache.get(key);
}
export const bioDose=d=>d.bioVat?.ticks>0?dose(B.fuels[d.bioVat.fuel].sievert,d.bioVat.coverage):0;

export function initializeBioVat(game,d,reset=false){
  if(reset)delete d.bioVat;
  if(isVat(game,d))d.bioVat??={culture:null,fuel:null,ticks:0,coverage:100};
}
export function validBioVat(game,d,r){
  const s=d.bioVat;
  if(d.job?.bioMultiplier!==undefined&&(!r||r.process!=='bioVat'||!isVat(game,d)||!Number.isInteger(d.job.bioMultiplier)||d.job.bioMultiplier<1||d.job.bioMultiplier>B.vat.maxBonus+1))return false;
  if(s===undefined)return true;
  if(!isVat(game,d)||!s||typeof s!=='object'||Array.isArray(s))return false;
  const fuel=B.fuels[s.fuel];
  if(s.culture!==null&&!Object.values(B.cultures).some(key=>'gtItem_'+key===s.culture))return false;
  if(!Number.isInteger(s.coverage)||s.coverage<0||s.coverage>100||!Number.isFinite(s.ticks)||s.ticks<0)return false;
  if(s.fuel!==null&&!fuel||s.ticks>0&&!fuel||fuel&&s.ticks>fuel.mass*Math.max(1,fuel.decayTicks-1))return false;
  return true;
}

export function bioFailure(game,d,r){
  if(r?.process!=='bioVat')return '';
  const req=r.requirements??{},s=d.bioVat;
  if(!isVat(game,d))return '需要细菌培养仓';
  if((game.catalog.machines[d.type].capabilities?.bioGlass??0)<(req.bioGlass??0))return '需要 '+req.bioGlass+' 级玻璃';
  if(req.bioCulture&&s?.culture!==req.bioCulture&&game.quantity(req.bioCulture)<1)return '需要 '+game.catalog.items[req.bioCulture].name;
  const radiation=req.radiation;
  if(radiation?.value){
    const value=bioDose(d);
    if(radiation.exact?value!==radiation.value:value<radiation.value){
      // Dispatch can select an idle vat before its automatic physical feeder
      // runs. Loaded rods cannot be discarded to bypass their decay period.
      const canPrepare=d.recipe!==r.id&&!d.job&&(s?.ticks>0?coverageFor(B.fuels[s.fuel].sievert,radiation)!==null:candidates(radiation).some(x=>game.quantity(x.id)>=1));
      if(!canPrepare)return '需要'+(radiation.exact?'精确':'至少')+' '+radiation.value+' Sv 辐射；请备好辐射棒';
    }
  }
  return '';
}

// The physical hatch keeps decaying while the machine is paused. It is never
// rewound/refunded when a recipe changes or when production is force-stopped.
export function tickBioVats(game,dt){
  for(const d of game.state.devices){
    if(!isVat(game,d))continue;
    initializeBioVat(game,d);
    const s=d.bioVat;
    s.ticks=Math.max(0,s.ticks-dt*20);
    const r=game.recipeById.get(d.recipe);
    if(!d.enabled||r?.process!=='bioVat')continue;
    const req=r.requirements??{};
    if(req.bioCulture&&s.culture!==req.bioCulture&&!d.job&&game.quantity(req.bioCulture)>=1){
      if(s.culture)game.add({[s.culture]:1},false);
      game.pay({[req.bioCulture]:1});s.culture=req.bioCulture;
    }
    if(!req.radiation?.value){s.coverage=100;continue;}
    if(s.ticks>0){
      const coverage=coverageFor(B.fuels[s.fuel].sievert,req.radiation);
      if(coverage!==null)s.coverage=coverage;
      continue;
    }
    const selected=candidates(req.radiation).find(x=>game.quantity(x.id)>=1);
    if(selected&&game.pay({[selected.id]:1}))Object.assign(s,{fuel:selected.id,ticks:selected.fuel.mass*Math.max(1,selected.fuel.decayTicks-1),coverage:selected.coverage});
  }
}

function outputHatch(game,d,fluid){
  if(d.fluidOutputs?.[fluid])return endpointMembers(game,d.fluidOutputs[fluid]).filter(c=>game.catalog.containerTypes[c.type]);
  const candidates=game.state.containers.filter(c=>acceptsFluid(game.catalog,c,fluid)&&(!c.fluid||c.fluid===fluid));
  const container=candidates.find(c=>c.fluid===fluid)??candidates[0];
  return container?[container]:[];
}
export function bioRecipe(game,d,r){
  if(r?.process!=='bioVat'||!isVat(game,d))return r;
  const input=Object.keys(r.inputs).find(id=>game.catalog.items[id].kind==='fluid');
  const output=Object.keys(r.outputs).find(id=>game.catalog.items[id].kind==='fluid');
  if(!input||!output)return r;
  let multiplier=d.job?.bioMultiplier;
  if(multiplier===undefined){
    const hatch=outputHatch(game,d,output),capacity=hatch.reduce((n,c)=>n+containerCapacity(game.catalog,c),0);
    const amount=hatch.reduce((n,c)=>n+(c.fluid===output?c.amount:0),0),half=capacity/2;
    const bonus=amount>0&&half>0?Math.min(B.vat.maxBonus,Math.max(1,Math.ceil((1-((amount-half)/half)**2)*B.vat.maxBonus))):0;
    multiplier=Math.max(1,Math.min(bonus+1,Math.floor(game.inputQuantity(input,d.fluidInputs?.[input])/r.inputs[input])));
  }
  return {...r,bioMultiplier:multiplier,inputs:{...r.inputs,[input]:r.inputs[input]*multiplier},
    outputs:{...r.outputs,[output]:r.outputs[output]*multiplier},
    ...(r.outputRolls?{outputRolls:r.outputRolls.map(slot=>slot.id===output?{...slot,count:slot.count*multiplier}:slot)}:{})};
}
