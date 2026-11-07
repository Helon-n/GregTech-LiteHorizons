import {initializeEOH,isEOH,eohRuntime,runEOH} from './eoh.js';
import {initializeBeam,beamKind,beamSourceRuntime,runBeamCrafter,runCollider,ageBeamPackets} from './beamline.js';
import {runIncubator} from './incubator.js';
import {foundryTier,foundryRuntime,foundryFailure,beginFoundry,foundryBatchCount,advanceFoundry} from './foundry.js';
import {parallelRecipe} from './parallel.js';
import {initializeBEC,becKind,runBECStorage,becSpeed,becStep} from './bec.js';
import {spinTier,spinMode,spinRecipe,spinBatchCount,advanceSpin,spinFailure} from './spinmatron.js';
import {LATE_MACHINES_REFERENCE as LATE} from '../data/late-machines-reference.js';
import {findGroup,endpointId,endpointMembers,devicePeers,includesEndpoint,deviceEntries,fluidEntries,bindFluid,takeFluid,putFluid} from './groups.js';
import {ENERGY_REFERENCE as E} from '../data/energy-reference.js';
import {rollOutputs} from './recipe-yields.js';
import {BOILER_PROFILES,SOLID_FUELS} from '../data/industry-catalog.js';
import {requirementFailure,machineHeat} from './technology.js';
import {runReactor} from './reactor.js';
import {initializeLargeBoiler,runLargeBoiler} from './large-boiler.js';
import {runCombustion} from './combustion.js';
import {prepareBoardBath,boardBathDuration,soilBoardBath,tickBoardBath} from './board-bath.js';
import {runTurbine} from './turbine.js';
import {runHeatExchanger} from './heat-exchanger.js';
import {componentCount,takeComponent} from './components.js';
import {fusionCapacity,fusionOverclock} from './fusion.js';
import {runThermalBoiler,thermalSteam} from './thermal-boiler.js';
import {godforgeKind,initializeGodforge,forgeRuntime,tickGodforges,forgeHost} from './godforge.js';
import {purificationTier,purificationHost,purificationFailure,beginPurification,advancePurification} from './purification.js';
import {exoticRecipe,issueExoticSamples} from './exotic.js';
import {runNaquadah} from './naquadah.js';
import {runSolarTower} from './solar-tower.js';
import {RTG_REFERENCE as RTG} from '../data/rtg-reference.js';
import {initializeNuclear,runNuclear} from './nuclear.js';
import {initializeSmeltery,runSmeltery} from './smeltery.js';
import {initializeBioVat,tickBioVats} from './biochemistry.js';

const EPS=1e-8;
export const energySpec=(game,d)=>game.catalog.machines[d.type]?.energy;
export const voltage=d=>d.rtgVoltage??E.voltage[d.energyTier];
export const batteryItem=d=>'battery'+E.codes[d.energyTier];
export const boilerProfile=(game,d)=>BOILER_PROFILES[energySpec(game,d)?.profile]??BOILER_PROFILES.bronze;
export function boilerSolidFuels(game,d){
  const B=boilerProfile(game,d);
  if(energySpec(game,d)?.kind!=='boiler'||B.solar||B.lava||B.exchanger||B.thermal)return [];
  return Object.keys(SOLID_FUELS).filter(id=>game.catalog.items[id]&&(!B.large||B.steam==='steam'||SOLID_FUELS[id].highTier));
}
export const boilerSteam=(game,d)=>energySpec(game,d)?.cycle==='thermal'?thermalSteam(game,d):energySpec(game,d)?.cycle==='exchanger'?d.exchanger?.steam??'steam':boilerProfile(game,d).steam??'steam';
export const daylight=game=>game.state.playtime%1200<600;
export const solarAvailable=(game,d)=>daylight(game)&&d.skyAccess;
export function energyCapacity(game,d){
  if(d.group)return endpointMembers(game,d.id).reduce((n,d)=>n+energyCapacity(game,d),0);
  const spec=energySpec(game,d);if(!spec)return 0;
  if(spec.kind==='battery')return d.batteries?d.batteries*E.battery.capacity[d.energyTier]+voltage(d)*64*E.battery.slots:0;
  if(spec.cycle==='ic2RTG')return RTG.ic2.capacity;
  if(spec.kind==='solar')return voltage(d)*10000;
  if(spec.solid||game.recipeById.get(d.recipe)?.itemFuel)return Math.max(d.eu??0,voltage(d)*80+512);
  if(spec.cycle==='naquadah')return voltage(d)*80*spec.outputAmps+512;
  if(['generator','dyson'].includes(spec.kind))return voltage(d)*80+512;
  if(spec.fusion)return fusionCapacity(spec,d.energyTier)+(spec.startupCapacity?0:3000*(d.energyTier-5));
  return spec.kind==='consumer'?voltage(d)*(spec.bufferTicks??64):0;
}
export function initializeEnergy(game,d,reset=false){
  const spec=energySpec(game,d);
  if(reset){delete d.rtgVoltage;delete d.rtgFuel;delete d.isotopePellets;}
  if(reset)for(const key of ['energyTier','eu','steam','supply','output','batteries','temperature','heat','water','coal','thermalTick','thermalFraction','waterRemainder','generatorClock','fuel','modules','cycleRemaining','cyclePower','ignited','cooldownClock','startupTicks','reactorWarmup','reactorTicks','combustion','largeBoiler','boilerCircuit'])delete d[key];
  d.energyTier??=spec?.tier??0;d.eu??=0;d.steam??=0;
  if(spec?.rtg)d.rtgVoltage??=0;
  if(spec?.cycle==='ic2RTG')d.isotopePellets??=0;
  if(reset)delete d.nuclear;
  if(spec?.cycle==='nuclear')initializeNuclear(d);
  if(reset)delete d.smeltery;
  if(spec?.cycle==='smeltery')initializeSmeltery(d);
  initializeBioVat(game,d,reset);
  initializeBEC(game,d);
  initializeEOH(game,d);
  initializeBeam(game,d);
  d.supply??={mode:spec?.kind==='battery'?'direct':'storage',source:null};d.output??=null;d.batteries??=0;
  d.alias??='';d.fluidOutputs??={};
  d.fluidInputs??={};d.solidFuel??='coal';d.waterFluid??='water';d.calcification??=0;d.cooledLava??=0;d.skyAccess??=true;
  if(spec?.cycle==='exchanger')d.waterFluid='distilledWater';
  d.temperature??=20;d.heat??=0;d.water??=0;d.coal??=0;
  d.thermalTick??=0;d.thermalFraction??=0;d.waterRemainder??=0;d.generatorClock??=0;
  d.fuel??=0;d.modules??=0;d.cycleRemaining??=0;d.cyclePower??=0;
  d.fuelType??=spec?.fuel??null;
  d.coil??=null;d.location??='ground';
  d.cleanroomReady=false;
  d.ignited??=false;d.cooldownClock??=0;d.startupTicks??=20;
  d.reactorWarmup??=0;d.reactorTicks??=0;
  d.toolLife??={};
  d.boilerCircuit??=0;
  d.bathFlushPercent??=100;d.bathClock??=0;
  if(boilerProfile(game,d).large)initializeLargeBoiler(d);
  if(godforgeKind(game,d)==='host')initializeGodforge(d);
}
export function runtime(game,d,r){
  if(!r)return {seconds:1,power:0,steamPerSecond:0,valid:true};
  const spec=energySpec(game,d);
  if(godforgeKind(game,d)&&godforgeKind(game,d)!=='host')return forgeRuntime(game,d,r);
  if(isEOH(game,d)&&r.eoh)return eohRuntime(d,r);
  if(foundryTier(game,d))return foundryRuntime(game,d,r);
  if(r.purification)return {seconds:r.seconds,power:r.power,steamPerSecond:0,valid:r.power<=voltage(d)};
  if(spec?.prepaid&&r.batchEU)return {seconds:r.seconds,power:0,batchEU:r.batchEU,steamPerSecond:0,valid:Number.isSafeInteger(r.batchEU)&&r.batchEU>0};
  if(spec?.kind==='steam')return {seconds:r.seconds*E.steamMachine.durationMultiplier,power:r.power,steamPerSecond:r.power*20*E.steamMachine.steamPerEU,valid:r.power<=32};
  if(spec?.massFabricator&&r.matterFabrication){
    // MTEMassfabricator uses 8A for the OC calculator, doubles EU/t per
    // overclock and caps their count at tier-1. It accepts up to 10A.
    const count=Math.max(0,d.energyTier-1),power=r.power*2**count;
    return {seconds:Math.max(1,Math.trunc(r.seconds*20/2**count))/20,power,steamPerSecond:0,valid:r.power<=voltage(d)*spec.recipeAmps&&power<=voltage(d)*spec.recipeAmps};
  }
  if(becKind(game,d))return {seconds:r.seconds,power:r.power,steamPerSecond:0,valid:r.power<=voltage(d)*spec.recipeAmps};
  let power=r.power||0,seconds=r.seconds*(r.bath?boardBathDuration(d):1);
  if(spinTier(game,d)){power*=LATE.euMultiplier*(spinMode(d,r)==='heavy'?LATE.heavyMultiplier:1)*(d.job?.parallel??1);seconds/=spinMode(d,r)==='light'?4:LATE.speed;}
  if(spec?.nanochip){
    const capacity=voltage(d)*spec.recipeAmps;
    const matrix=r.process==='nanochipAssemble';
    const recipeTier=matrix?r.requirements?.nanochipTier??1:Math.ceil(Math.log(Math.max(8,power)/8)/Math.log(4));
    const casing=game.catalog.machines[d.type].capabilities?.nanochipTier??recipeTier;
    if(matrix)power*=.95**Math.max(0,casing-recipeTier);
    if(power>capacity)return {seconds,power,steamPerSecond:0,valid:false};
    // MTENanochipAssemblyModuleBase: 2/2 OC, then spare-power 2/4 OC.
    // Both phases stop before a batch would become shorter than five seconds.
    let overclocks=Math.max(0,d.energyTier-recipeTier);
    while(overclocks-->0&&power>0&&seconds/2>=5&&power*2<=capacity){seconds/=2;power*=2;}
    power=Math.trunc(power);seconds=Math.max(.05,Math.trunc(seconds*20)/20);
    while(power>0&&seconds/2>=5&&power*4<=capacity){seconds=Math.trunc(seconds*20/2)/20;power*=4;}
    return {seconds,power,steamPerSecond:0,valid:true};
  }
  if(r.beamSource)return beamSourceRuntime(d,r);
  if(r.fixedRuntime)return {seconds,power,steamPerSecond:0,valid:power<=voltage(d)*(spec?.recipeAmps??1)&&(!r.requirements?.researchVoltage||r.requirements.researchVoltage<=voltage(d))};
  if(r.process==='algaePond')return {seconds,power,steamPerSecond:0,valid:power<=voltage(d)};
  if(spec?.kind==='consumer'){
    const recipeCapacity=voltage(d)*(spec.recipeAmps??1);
    if(power>recipeCapacity)return {seconds,power,steamPerSecond:0,valid:false};
    if(spec.fusion&&(r.startup??0)>fusionCapacity(spec,d.energyTier))return {seconds,power,steamPerSecond:0,valid:false};
    // EBF surplus heat grants 5% EU discount per 900 K and perfect
    // overclocks per 1800 K. Installed coils and voltage heat are independent.
    const surplus=d.type==='ebf'&&r.requirements?.heat?Math.max(0,machineHeat(game,d)-r.requirements.heat):0;
    let perfect=game.catalog.machines[d.type]?.perfectOverclock?Number.MAX_SAFE_INTEGER:Math.floor(surplus/1800);
    const recipeTier=power>0?Math.max(1,Math.ceil(Math.log((spinTier(game,d)?r.power:power)/8)/Math.log(4))):d.energyTier;
    const processingTier=spec.combinedInput||spec.amperageOC?Math.floor(Math.log(recipeCapacity/8)/Math.log(4)):d.energyTier;
    let overclocks=Math.max(0,processingTier-recipeTier),factor=4;
    if(spinTier(game,d)&&spinMode(d,r)!=='heavy')overclocks=Math.min(overclocks,Math.max(0,d.energyTier-recipeTier+1));
    if(spec.fusion){const fusion=fusionOverclock(spec,d.energyTier,r);overclocks=fusion.count;factor=fusion.factor;perfect=spec.advancedFusion?Number.MAX_SAFE_INTEGER:0;}
    if(surplus)power*=.95**Math.floor(surplus/900);
    while(overclocks-->0&&power>0&&power*factor<=(spec.combinedInput||spec.amperageOC?recipeCapacity:voltage(d))&&seconds>.05){power*=factor;seconds/=perfect-->0?4:2;}
    power=Math.ceil(power);
    seconds=Math.ceil(seconds*20-1e-8)/20;
  }
  return {seconds:Math.max(.05,seconds),power,steamPerSecond:0,valid:true};
}
export function carrier(game,d){
  const spec=energySpec(game,d);
  if(spec?.cycle==='turbine')return game.recipeById.get(d.recipe)?.turbineFuel??null;
  return spec?.cycle==='exchanger'?'distilledWater':spec?.cycle==='thermal'?d.waterFluid:spec?.solid||spec?.cycle?null:spec?.kind==='boiler'?d.waterFluid??'water':spec?.kind==='dyson'?'cryotheum':spec?.kind==='steam'?'steam':spec?.kind==='generator'?generatorFuel(game,d)?.id:['consumer','battery'].includes(spec?.kind)?'electric':null;
}
export function sourceOptions(game,d,mode=d.supply.mode){
  const type=carrier(game,d),self=endpointId(game,d.id);
  if(energySpec(game,d)?.prepaid)return mode==='storage'?deviceEntries(game).filter(s=>s.id!==self&&energySpec(game,s)?.kind==='battery'):[];
  if(mode==='direct')return deviceEntries(game).filter(s=>s.id!==self&&(
    game.catalog.items[type]?.kind==='fluid'?endpointMembers(game,s.id).some(p=>energySpec(game,p)?.kind==='boiler'&&boilerSteam(game,p)===type):type==='electric'&&['generator','dyson','solar'].includes(energySpec(game,s)?.kind)&&voltage(s)<=voltage(d)&&(energySpec(game,d)?.kind!=='battery'||!s.output||devicePeers(game,d.id).every(b=>includesEndpoint(game,s.output,b.id)))));
  if(type==='electric')return energySpec(game,d)?.kind==='battery'?[]:deviceEntries(game).filter(s=>s.id!==self&&energySpec(game,s)?.kind==='battery'&&voltage(s)<=voltage(d));
  return fluidEntries(game).filter(c=>energySpec(game,d)?.kind==='boiler'&&energySpec(game,d)?.cycle!=='exchanger'?['water','distilledWater'].some(id=>game.acceptsFluid(c,id)&&(!c.fluid||c.fluid===id)):game.acceptsFluid(c,type)&&(!c.fluid||c.fluid===type));
}
export function setSupply(game,id,mode,source){
  const peers=devicePeers(game,id),d=peers[0];
  if(!d||!['direct','storage'].includes(mode)||!carrier(game,d))return {ok:false,message:'此设备没有这种供给方式'};
  if(typeof purificationTier(game,d)==='number'&&purificationTier(game,d)>0)return {ok:false,message:'水处理单元由连接的纯净水厂主控统一供电'};
  if(energySpec(game,d)?.prepaid&&mode!=='storage')return {ok:false,message:'此设备在开工时从实体电池组预付整批电量'};
  if(energySpec(game,d).kind==='battery'&&mode!=='direct')return {ok:false,message:'电池箱从发电设备充电'};
  source=source?endpointId(game,source):null;
  if(source&&!sourceOptions(game,d,mode).some(s=>s.id===source))return {ok:false,message:'来源不兼容，请检查能源类型和电压'};
  if(energySpec(game,d)?.kind==='boiler'&&source){
    const fluid=fluidEntries(game).find(c=>c.id===source)?.fluid??d.waterFluid;
    if(energySpec(game,d)?.cycle==='exchanger'&&fluid!=='distilledWater')return {ok:false,message:'换热机只能使用蒸馏水'};
    if(peers.some(p=>p.water>0&&p.waterFluid!==fluid))return {ok:false,message:'请先用完或排空炉内的水，再更换水种'};
    if(!bindFluid(game,source,fluid))return {ok:false,message:'进水容器与炉内水种不兼容'};
    for(const p of peers)p.waterFluid=fluid;
  }
  if(energySpec(game,d).kind==='battery')for(const s of game.state.devices)if(peers.some(b=>includesEndpoint(game,s.output,b.id))&&!includesEndpoint(game,source,s.id))s.output=null;
  for(const d of peers)d.supply={mode,source};return {ok:true};
}
export function generatorFuel(game,d){
  const spec=energySpec(game,d),tier=d.energyTier;
  if(spec?.kind!=='generator'||spec.cycle)return null;
  const recipe=game.recipeById.get(d.recipe);
  if(spec.rtg)return recipe?.rtg?{id:recipe.fuel,amount:recipe.inputs[recipe.fuel],eu:recipe.fuelEU,efficiency:100,solid:true,capacity:0,outputRate:recipe.outputRate}:null;
  if(spec.solid||recipe?.itemFuel){const r=recipe,efficiency=spec.family==='Magic'?100-tier*5:tier===4?80:100+50*(tier-5);return r?.fuelFamily===spec.family?{id:r.fuel,amount:r.inputs[r.fuel],eu:spec.family==='Magic'?r.fuelEU*10*efficiency:r.fuelEU,efficiency,capacity:0,solid:true}:null;}
  if(spec.fuel==='steam')return {id:'steam',amount:6+tier,eu:3,capacity:24000*tier};
  const r=game.recipeById.get(d.recipe),id=d.fuel>EPS?(d.fuelType??spec.fuel):r?.fuel??spec.fuel;
  const family=spec.family??(spec.fuel==='diesel'?'Diesel':spec.fuel==='hydrogen'?'Gas':'Plasma');
  const entry=game.catalog.fuels?.find(f=>f.id===id&&f.family===family);
  const efficiency=spec.efficiency??(family==='Diesel'?E.diesel.efficiency[tier]:family==='Gas'?E.gas.efficiency[tier]:['SemiFluid','Magic'].includes(family)?100-tier*5:family==='Hot'?100-tier*7:10+10*tier);
  const base=entry?.eu??(!game.catalog.fuels?(family==='Diesel'?E.diesel.fuelEU:family==='Gas'?E.gas.hydrogenEU:family==='Plasma'?E.plasma.heliumEU:0):0);
  return {id,amount:1,eu:Math.floor(base*efficiency/100),efficiency,capacity:family==='Hot'?5000*tier:16000,family};
}

function inputFluid(game,d,fluid,want,whole=false){
  if(!d.supply.source||want<=0)return 0;
  const group=findGroup(game,d.id);
  if(group&&game.groupFluidInputs){
    const key=group.id+'/'+d.supply.source+'/'+fluid;
    let pending=game.groupFluidInputs.get(key);
    if(!pending){pending=new Set(devicePeers(game,d.id).filter(p=>energySpec(game,p)?.kind==='boiler'||p.enabled&&p.recipe).map(p=>p.id));game.groupFluidInputs.set(key,pending);}
    if(pending.has(d.id)){
      const available=endpointMembers(game,d.supply.source).reduce((n,s)=>n+(d.supply.mode==='direct'?(energySpec(game,s)?.kind==='boiler'&&boilerSteam(game,s)===fluid?s.steam:0):s.fluid===fluid?s.amount:0),0);
      want=Math.min(want,available/pending.size);pending.delete(d.id);
    }
  }
  if(whole)want=Math.floor(want);
  if(d.supply.mode!=='direct')return takeFluid(game,d.supply.source,fluid,want);
  let moved=0;
  for(const src of endpointMembers(game,d.supply.source)){
    if(fluid!==boilerSteam(game,src)||energySpec(game,src)?.kind!=='boiler')continue;
    const amount=Math.min(want-moved,src.steam);src.steam-=amount;moved+=amount;
    if(moved>=want-1e-8)break;
  }
  return moved;
}
function pullElectric(game,d,want,dt,budgets,inputAmps){
  const battery=energySpec(game,d)?.kind==='battery';
  if(battery)want=Math.min(want,game.batteryChargeBudget?.get(d.id)??0);
  const sources=endpointMembers(game,d.supply.source);let total=0;
  const inputLimit=(sources.length?Math.max(...sources.map(voltage)):0)*inputAmps*20*dt;
  for(const src of sources){
    if(!src.enabled)continue;
    const sourceKind=energySpec(game,src)?.kind;
    if(d.supply.mode==='direct'?!['generator','dyson','solar'].includes(sourceKind):sourceKind!=='battery')continue;
    if(energySpec(game,d)?.kind==='battery'&&src.output&&!includesEndpoint(game,src.output,d.id))continue;
    if(voltage(src)>voltage(d)){d.blocked='来源电压过高';continue;}
    const reserve=sourceKind==='battery'?0:energySpec(game,src)?.reserve??512;
    const amount=Math.max(0,Math.min(want-total,inputLimit-total,Math.max(0,src.eu-reserve),budgets.get(src.id)||0));
    src.eu=Math.max(0,src.eu-amount);budgets.set(src.id,Math.max(0,(budgets.get(src.id)||0)-amount));total+=amount;
    if(total>=want-1e-8||total>=inputLimit-1e-8)break;
  }
  if(battery)game.batteryChargeBudget.set(d.id,Math.max(0,(game.batteryChargeBudget.get(d.id)??0)-total));
  return total;
}
// The original mixer prepays its wireless network. This adaptation explicitly
// selects a physical battery endpoint; check the whole group before any debit.
function prepayElectric(game,d,amount){
  if(d.supply.mode!=='storage'||!Number.isSafeInteger(amount)||amount<1)return false;
  const sources=endpointMembers(game,d.supply.source).filter(s=>s.enabled&&s.batteries>0&&energySpec(game,s)?.kind==='battery');
  if(sources.reduce((n,s)=>n+s.eu,0)+EPS<amount)return false;
  let left=amount;
  for(const s of sources){const take=Math.min(left,s.eu);s.eu-=take;left-=take;if(left<=EPS)break;}
  return true;
}
function consumeSharedFuel(game,d){
  const peers=devicePeers(game,d.id).filter(p=>p.solidFuel===d.solidFuel&&p.coal>0);
  const donor=peers.sort((a,b)=>b.coal-a.coal)[0];
  if(!donor)return false;
  donor.coal--;const fuel=SOLID_FUELS[d.solidFuel],B=boilerProfile(game,d);d.heat+=fuel.heat;
  if(B.smart)d.temperature+=Math.floor(fuel.heat/50);
  if(game.nextDropRandom()<(B.smart?1/3:fuel.chance))game.add({[B.smart?(['charcoal','coke'].includes(d.solidFuel)?'ashDustTiny':'darkAshDustTiny'):fuel.ash]:1});
  return true;
}
function runBoiler(game,d,dt){
  const B=boilerProfile(game,d),water=d.waterFluid;
  if(B.thermal){runThermalBoiler(game,d,dt,B,want=>{
    if(d.supply.source)return inputFluid(game,d,water,want);
    const n=Math.min(want,game.quantity(water));return n>0&&game.pay({[water]:n})?n:0;
  });return;}
  if(B.exchanger){runHeatExchanger(game,d,dt,B,want=>{
    if(d.supply.source)return inputFluid(game,d,'distilledWater',want);
    const n=Math.min(want,game.quantity('distilledWater'));return n>0&&game.pay({distilledWater:n})?n:0;
  });return;}
  if(B.large){runLargeBoiler(game,d,dt,B,want=>{
    if(d.supply.source)return inputFluid(game,d,water,want);
    const n=Math.min(want,game.quantity(water));return n>0&&game.pay({[water]:n})?n:0;
  });return;}
  // Water can enter via a fluid port even with small-boiler item automation disabled.
  const room=Math.max(0,B.waterCapacity-d.water);
  if(d.supply.source)d.water+=inputFluid(game,d,water,room);
  else {const amount=Math.min(room,game.quantity(water));if(amount>0&&game.pay({[water]:amount}))d.water+=amount;}
  if(B.lava){
    const source=d.fluidInputs.lava;
    if(source)d.fuel+=takeFluid(game,source,'lava',Math.max(0,B.waterCapacity-d.fuel));
  }
  d.thermalFraction+=dt*20;const ticks=Math.floor(d.thermalFraction+EPS);d.thermalFraction=Math.max(0,d.thermalFraction-ticks);
  let produced=0,vented=0;
  for(let i=0;i<ticks;i++){
    d.thermalTick=(d.thermalTick+1)%24000;
    if(d.startupTicks>0){d.startupTicks--;continue;}
    if(d.temperature<=20){d.temperature=20;d.cooldownClock=0;}
    else if(++d.cooldownClock>=B.coolTicks){d.temperature--;d.cooldownClock=0;}
    if(d.thermalTick%10===0&&d.temperature>100&&d.water>0){
      const maxRuntime=B.solar?(B.steamPerSecond-B.minimumOutput)*B.calcificationTicks/B.steamPerSecond+B.calcificationTicks:0;
      const output=B.solar?d.calcification>maxRuntime?B.minimumOutput:d.calcification>B.calcificationTicks?B.steamPerSecond-Math.trunc(B.steamPerSecond*(d.calcification-B.calcificationTicks)/B.calcificationTicks):B.steamPerSecond:B.steamPerSecond;
      const amount=Math.trunc(output/2);
      const consumed=Math.floor((d.waterRemainder+amount)/B.steamPerWater);
      if(d.water+EPS>=consumed){
        d.water-=consumed;d.waterRemainder+=amount-consumed*B.steamPerWater;
        d.steam+=amount;produced+=amount;
        if(B.solar&&water==='water')d.calcification=Math.min(2147483647,d.calcification+10);
        if(d.steam>B.steamCapacity){vented+=d.steam-B.steamCapacity*.75;d.steam=B.steamCapacity*.75;}
      }
    }
    if(d.heat<=0&&d.enabled&&d.recipe){
      if(B.solar){if(d.skyAccess&&d.thermalTick%240===0)d.heat+=daylight(game)?40:5;}
      else if(B.lava){
        if(d.cooledLava>=1000){game.add({obsidian:1});d.cooledLava-=1000;}
        const amount=Math.min(d.fuel,1000);d.fuel-=amount;d.heat+=amount;
      }else if(!B.smart||d.temperature<=101)consumeSharedFuel(game,d);
    }
    if(d.temperature<B.maxTemperature&&d.heat>0&&d.thermalTick%B.heatTicks===0){d.temperature+=B.heatAmount;d.heat=Math.max(0,d.heat-B.heatConsumption);if(B.lava)d.cooledLava+=B.heatConsumption;}
  }
  if(produced){game.state.earned.steam=(game.state.earned.steam||0)+produced;game.state.produced+=produced;}
  // Dry hot boilers are interlocked in the 2D adaptation, rather than exploding the base.
  d.blocked=vented?'蒸汽过满，安全阀排汽':d.temperature>100?(d.water>0?'运行中':'缺水，禁止进汽'):d.heat>0?'升温中':d.temperature>20?'余热冷却中':d.enabled&&d.recipe?(B.solar?'等待日照':B.lava?'等待熔岩':'请投入燃料'):'已停止';
}
function runGenerator(game,d,dt){
  const fuel=generatorFuel(game,d);
  if(!d.enabled||!d.recipe){d.blocked=d.enabled?'请选择配方':'已停止';return;}
  if(!fuel?.eu){d.blocked='燃料与机型不兼容';return;}
  if(fuel.solid){
    d.generatorClock+=dt;const cycles=Math.floor((d.generatorClock+EPS)/.5);d.generatorClock=Math.max(0,d.generatorClock-cycles*.5);
    const r=game.recipeById.get(d.recipe);
    if(cycles&&d.eu<voltage(d)*20+512&&game.canPay(r.inputs)&&game.add(r.outputs,true,d.fluidOutputs)){
      game.pay(r.inputs);d.eu+=fuel.eu;
      if(energySpec(game,d)?.rtg){d.rtgVoltage=r.outputRate;d.rtgFuel=r.id;}
    }
    d.blocked=d.eu>512?'运行中':game.canPay(r.inputs)?'等待燃料周期':'固体燃料不足';return;
  }
  d.fuelType=fuel.id;
  d.fuel+=inputFluid(game,d,fuel.id,Math.max(0,fuel.capacity-d.fuel));
  d.generatorClock+=dt;const cycles=Math.floor((d.generatorClock+EPS)/.5);d.generatorClock=Math.max(0,d.generatorClock-cycles*.5);
  if(cycles){
    const operations=Math.max(0,Math.floor(Math.min(d.fuel/fuel.amount,(energyCapacity(game,d)-d.eu)/fuel.eu)+EPS));
    d.fuel=Math.max(0,d.fuel-operations*fuel.amount);d.eu+=operations*fuel.eu;
  }
  d.blocked=d.eu>=energyCapacity(game,d)-fuel.eu?'机内储能已满':d.fuel>=fuel.amount||d.eu>512?'运行中':d.supply.source?'燃料不足':'请选择燃料来源';
}
function runDyson(game,d,dt){
  if(!d.enabled||!d.recipe){d.blocked=d.enabled?'请选择配方':'已停止';return;}
  if(d.cycleRemaining<=EPS){
    if(!d.modules){d.blocked='请装入戴森模块';return;}
    const available=d.supply.source?endpointMembers(game,d.supply.source).reduce((n,c)=>n+(c.fluid==='cryotheum'?c.amount:0),0):game.quantity('cryotheum');
    if(available<E.dyson.coolant){d.blocked='极寒之凛冰不足';return;}
    if(d.supply.source)takeFluid(game,d.supply.source,'cryotheum',E.dyson.coolant);else game.pay({cryotheum:E.dyson.coolant});
    d.cyclePower=d.modules*E.dyson.euPerModule*E.dyson.powerFactor;
    d.modules=Math.max(0,Math.trunc(d.modules-d.modules*(2*E.dyson.destroyChance)/(Math.exp(-E.dyson.destroyA*(d.modules-1))+1)));
    d.cycleRemaining=E.dyson.cycleSeconds;
  }
  const used=Math.min(dt,d.cycleRemaining);d.cycleRemaining=Math.max(0,d.cycleRemaining-used);
  // Deliver this interval's generation before capping retained output energy.
  // Otherwise a large swarm's rate is accidentally limited by simulation step size.
  d.eu+=d.cyclePower*20*used;d.blocked='运行中';
}
function runMachine(game,d,dt,budgets){
  const spec=energySpec(game,d),r=game.deviceRecipe(d);let run=runtime(game,d,r);
  if(spec?.cycle==='solarTower'){runSolarTower(game,d,dt);return;}
  if(spec?.cycle==='smeltery'){runSmeltery(game,d,r,dt);return;}
  if(godforgeKind(game,d)==='host')return;
  if(purificationTier(game,d)==='host'){
    if(!d.enabled){d.blocked='已停止';return;}
    const demand=game.state.devices.filter(u=>u.purificationHost===d.id&&u.enabled).reduce((n,u)=>n+(game.recipeById.get(u.recipe)?.power??0),0);
    d.eu+=pullElectric(game,d,Math.max(0,energyCapacity(game,d)-d.eu),dt,budgets,Math.max(2,Math.ceil(demand/voltage(d))+1));
    d.blocked=demand?'为处理单元供电':'等待处理单元';return;
  }
  if(isEOH(game,d)){runEOH(game,d,r,dt,()=>pullElectric(game,d,Math.max(0,energyCapacity(game,d)-d.eu),dt,budgets,spec.inputAmps),b=>energyCapacity(game,b));return;}
  if(['crafter','collider'].includes(beamKind(game,d))){const unmet=d.enabled&&r&&requirementFailure(game,d,r);if(unmet){d.blocked=unmet;return;}const pull=()=>pullElectric(game,d,Math.max(0,energyCapacity(game,d)-d.eu),dt,budgets,spec.inputAmps);if(beamKind(game,d)==='crafter')runBeamCrafter(game,d,r,dt,pull);else runCollider(game,d,dt,pull);return;}
  if(game.catalog.machines[d.type]?.incubator){runIncubator(game,d,r,dt,()=>pullElectric(game,d,Math.max(0,energyCapacity(game,d)-d.eu),dt,budgets,1));return;}
  if(becKind(game,d)==='storage'){runBECStorage(game,d,dt,()=>pullElectric(game,d,Math.max(0,energyCapacity(game,d)-d.eu),dt,budgets,spec.inputAmps));return;}
  if(game.catalog.machines[d.type]?.facility==='cleanroom'){
    d.cleanroomReady=false;
    if(!d.enabled){d.blocked='已停止';return;}
    d.eu+=pullElectric(game,d,Math.max(0,energyCapacity(game,d)-d.eu),dt,budgets,2);
    const eu=4*20*dt;
    if(d.eu+EPS<eu){d.blocked='洁净室缺电';return;}
    d.eu=Math.max(0,d.eu-eu);d.cleanroomReady=true;d.blocked='运行中';return;
  }
  if(spec?.kind==='battery'){
    if(!d.enabled){d.blocked='已停止';return;}
    if(!d.batteries){d.blocked='请装入同级电池';return;}
    d.eu+=pullElectric(game,d,Math.max(0,energyCapacity(game,d)-d.eu),dt,budgets,d.batteries*2);
    d.blocked=d.eu>=energyCapacity(game,d)-EPS?'电池已充满':d.supply.source?'充放电中':'请选择充电来源';return;
  }
  if(!d.enabled){d.blocked=d.recipe?'已暂停':'已停止';return;}
  if(!r){d.blocked='请选择配方';return;}
  if(r.purification){const failure=purificationFailure(game,d);if(failure){d.blocked=failure;return;}}
  const unmet=requirementFailure(game,d,r);if(unmet){if(d.job&&(spinTier(game,d)&&spinFailure(game,d,r)||foundryTier(game,d)&&foundryFailure(game,d,r))){d.job=null;d.enabled=false;if(spinTier(game,d))d.spinClock=0;if(foundryTier(game,d))d.foundryClock=0;d.blocked=unmet+' · 批次已停止';}else d.blocked=unmet;return;}
  if(!run.valid&&!(foundryTier(game,d)&&!d.job)){d.blocked='机器电压等级不足';return;}
  if(r.dynamic==='godforge'){
    const failure=issueExoticSamples(game,d,r,run.batchEU);if(failure){d.blocked=failure;return;}
  }
  if(spec?.kind==='steam')d.steam+=inputFluid(game,d,'steam',Math.max(0,E.steamMachine.capacity-d.steam));
  if(spec?.kind==='consumer'&&!spec.prepaid&&!r.purification)d.eu+=pullElectric(game,d,Math.max(0,energyCapacity(game,d)-d.eu),dt,budgets,spec.inputAmps??(spec.fusion?32:Math.floor(2*run.power/voltage(d))+1));
  const electrical=r.purification?purificationHost(game,d):d;
  let left=dt;
  // Carry a completed/short recipe into the rest of this step, without losing time.
  while(left>EPS){
    // A planned batch releases its machine on completion. Never spend the
    // remaining interval starting an unwanted extra batch of the old recipe.
    if(!d.enabled||d.recipe!==r.id)return;
    if(d.job&&d.job.remaining<=EPS){if(!game.finish(r,d)){d.blocked='流体输出空间不足';return;}d.job=null;}
    if(!d.enabled||d.recipe!==r.id)return;
    if(!d.job){
      run=runtime(game,d,r);
      const spin=spinFailure(game,d,r);if(spin){d.blocked=spin;return;}
      const bathFailure=prepareBoardBath(game,d,r);if(bathFailure){d.blocked=bathFailure;return;}
      if(!Object.entries(r.tools||{}).every(([id,n])=>r.toolWear?.[id]?(d.toolLife[id]??0)>0||game.quantity(id)+componentCount(game,id)>=n:game.quantity(id)>=n)){d.ignited=false;d.blocked='缺少工具或研磨球';return;}
      if(!game.canPayInputs(d,r.inputs)){d.ignited=false;d.blocked='缺少原料或指定输入容器为空';return;}
      if(r.deepHeat&&Object.entries(r.inputs).some(([id,n])=>game.inputQuantity(id,d.fluidInputs[id])<=n)){d.blocked='进液不足，需保留至少 1 mB 安全余量';return;}
      if(!game.canStoreBatch(d,r)){d.ignited=false;d.blocked='流体输出空间不足';return;}
      if(foundryTier(game,d)){
        beginFoundry(game,d);run=runtime(game,d,r);
        if(!run.valid){d.blocked='机器电压等级不足';return;}
      }
      if(r.startup&&!d.ignited){
        if(d.eu<r.startup){d.blocked='等待聚变启动储能';return;}
        d.eu-=r.startup;d.ignited=true;
      }
      if(spec?.kind==='steam'&&d.steam<E.steamMachine.minimumSteam){d.blocked='机内蒸汽不足';return;}
      if(spec?.kind==='consumer'&&electrical.eu<run.power){d.blocked=r.purification?'纯净水厂储能不足':d.supply.source?'电力不足':'请选择供能来源';return;}
      if(run.batchEU&&!prepayElectric(game,d,run.batchEU)){d.blocked='等待电池组储能 '+run.batchEU.toLocaleString()+' EU / 批';return;}
      if(run.batchEU&&godforgeKind(game,d)){const s=forgeHost(game,d).godforge;s.totalEU=(BigInt(s.totalEU)+BigInt(run.batchEU)).toString();if(r.process!=='smelt')s.recipes=Math.min(Number.MAX_SAFE_INTEGER,s.recipes+1);}
      const parallel=spinTier(game,d)?spinBatchCount(game,d,r):foundryTier(game,d)?foundryBatchCount(game,d,r):1,batch=parallel>1?parallelRecipe(r,parallel):r;
      if(parallel<1){d.blocked='等待可用原料或产物容器空间';return;}
      game.payInputs(d,batch.inputs);
      for(const [id,life]of Object.entries(r.toolWear||{})){
        if(!d.toolLife[id])d.toolLife[id]=takeComponent(game,id,'mill').life;
        d.toolLife[id]--;
      }
      const duration=r.bath?runtime(game,d,r).seconds:run.seconds;
      d.job={remaining:duration,duration,outputs:rollOutputs(game,batch),...(spinTier(game,d)||foundryTier(game,d)?{parallel}:{}),...(r.bioMultiplier?{bioMultiplier:r.bioMultiplier}:{}),...(run.batchEU?{prepaidEU:run.batchEU}:{})};
      if(spinTier(game,d)||foundryTier(game,d)){run=runtime(game,d,r);d.job.duration=d.job.remaining=run.seconds;}
      if(r.purification)beginPurification(game,d,r);
      soilBoardBath(d,r);
    }
    if(run.batchEU&&d.job.prepaidEU===undefined){
      if(!prepayElectric(game,d,run.batchEU)){d.blocked='等待电池组补付整批电量';return;}
      d.job.prepaidEU=run.batchEU;
      if(godforgeKind(game,d)){const s=forgeHost(game,d).godforge;s.totalEU=(BigInt(s.totalEU)+BigInt(run.batchEU)).toString();if(r.process!=='smelt')s.recipes=Math.min(Number.MAX_SAFE_INTEGER,s.recipes+1);}
    }
    const speed=r.requirements?.becSlots?becSpeed(game,d,r):1;
    if(!speed){d.blocked='等待当前槽位所需的纳米蜂群';return;}
    const boundary=r.requirements?.becSlots?Math.max(0,becStep(d,r).end-(d.job.duration-d.job.remaining)):Infinity;
    if(boundary<1e-10){d.job.remaining=Math.max(0,d.job.remaining-1e-8);continue;}
    const used=Math.min(left,d.job.remaining/speed,boundary/speed),eu=run.power*20*used,steam=run.steamPerSecond*used;
    if(spec?.kind==='steam'&&d.steam+EPS<steam){d.blocked='蒸汽不足';return;}
    if(spec?.kind==='consumer'&&electrical.eu+EPS<eu){d.blocked=r.purification?'纯净水厂电力不足':'电力不足';return;}
    if(spec?.kind==='steam')d.steam=Math.max(0,d.steam-steam);
    if(spec?.kind==='consumer')electrical.eu=Math.max(0,electrical.eu-eu);
    if(r.purification)advancePurification(game,d,r,used);
    if(advanceSpin(game,d,r,used)===false)return;
    if(!advanceFoundry(game,d,used))return;
    d.job.remaining=Math.max(0,d.job.remaining-used*speed);left-=used;d.blocked='运行中';
    if(d.job.remaining<=EPS){if(game.finish(r,d))d.job=null;else {d.blocked='流体输出空间不足';return;}}
  }
}
export function tickMachines(game,dt){
  if(dt<=0)return;
  ageBeamPackets(game,dt);
  game.groupFluidInputs=new Map();
  const devices=game.state.devices,budgets=new Map();
  game.batteryChargeBudget=new Map(devices.filter(d=>energySpec(game,d)?.kind==='battery').map(d=>[d.id,voltage(d)*d.batteries*2*20*dt]));
  for(const d of devices)if(d.becStorage)d.becStorage.ready=false;
  tickGodforges(game,dt);
  tickBioVats(game,dt);
  for(const d of devices)tickBoardBath(game,d,game.recipeById.get(d.recipe),dt);
  for(const d of devices)if(energySpec(game,d)?.kind==='boiler')runBoiler(game,d,dt);
  for(const d of devices){
    const kind=energySpec(game,d)?.kind;
    if(kind==='generator'){
      if(energySpec(game,d)?.cycle==='lftr')runReactor(game,d,dt);
      else if(energySpec(game,d)?.cycle==='nuclear')runNuclear(game,d,dt);
      else if(energySpec(game,d)?.cycle==='ic2RTG'){
        if(d.enabled){d.eu=Math.min(energyCapacity(game,d),d.eu+RTG.ic2.rates[d.isotopePellets]*20*dt);d.blocked=d.isotopePellets?'运行中':'请装入同位素燃料';}
        else d.blocked='已停止';
      }
      else if(energySpec(game,d)?.cycle==='naquadah')runNaquadah(game,d,dt,voltage(d)*energySpec(game,d).outputAmps);
      else if(energySpec(game,d)?.cycle==='combustion')runCombustion(game,d,dt);
      else if(energySpec(game,d)?.cycle==='turbine'){
        const fluid=carrier(game,d),available=()=>endpointMembers(game,d.supply.source).reduce((n,s)=>n+(d.supply.mode==='direct'&&energySpec(game,s)?.kind==='boiler'&&boilerSteam(game,s)===fluid?s.steam:s.fluid===fluid?s.amount:0),0);
        runTurbine(game,d,dt,n=>inputFluid(game,d,fluid,n,true),available,voltage(d)*(energySpec(game,d).rotorSlots===12?16:1));
      }
      else runGenerator(game,d,dt);
    }
    if(kind==='solar'){
      if(d.enabled&&d.recipe&&solarAvailable(game,d)){d.eu=Math.min(energyCapacity(game,d),d.eu+voltage(d)*20*dt);d.blocked='运行中';}
      else d.blocked=!d.enabled?'已停止':!d.recipe?'请选择配方':d.skyAccess?'夜间停机':'上方被遮挡';
    }
    if(kind==='dyson')runDyson(game,d,dt);
    if(['generator','dyson','solar','battery'].includes(kind))budgets.set(d.id,voltage(d)*20*dt*(kind==='battery'?d.batteries:kind==='dyson'?Math.max(1,Math.ceil(d.cyclePower/voltage(d))):energySpec(game,d)?.outputAmps??(energySpec(game,d)?.rotorSlots===12?16:energySpec(game,d)?.cycle==='combustion'?3:energySpec(game,d)?.cycle?Math.max(1,Math.ceil((game.recipeById.get(d.recipe)?.generationPower??0)/voltage(d))):1)));
  }
  // Consumers share each source's output limit; adding cables never creates extra amperes.
  const consumers=devices.filter(d=>!['boiler','generator','battery','dyson','solar'].includes(energySpec(game,d)?.kind));
  const first=Math.floor(game.state.playtime*2)%Math.max(1,consumers.length);
  const ordered=consumers.map((_,i)=>consumers[(i+first)%consumers.length]);
  for(const d of ordered)if(game.catalog.machines[d.type]?.facility)runMachine(game,d,dt,budgets);
  for(const d of ordered)if(!game.catalog.machines[d.type]?.facility&&d.supply.mode==='direct')runMachine(game,d,dt,budgets);
  // Direct consumers use their share first; surplus charges the selected battery boxes.
  for(const d of devices)if(energySpec(game,d)?.kind==='battery')runMachine(game,d,dt,budgets);
  for(const d of ordered)if(!game.catalog.machines[d.type]?.facility&&d.supply.mode!=='direct')runMachine(game,d,dt,budgets);
  for(const d of devices)if(energySpec(game,d)?.kind==='boiler'&&d.steam>EPS){
    const fluid=boilerSteam(game,d),target=['exchanger','thermal'].includes(energySpec(game,d)?.cycle)?d.fluidOutputs[fluid]:d.output;
    if(target)d.steam=Math.max(0,d.steam-putFluid(game,target,fluid,d.steam));
  }
  for(const d of devices)if((boilerProfile(game,d).large||boilerProfile(game,d).exchanger||boilerProfile(game,d).thermal)&&d.steam>boilerProfile(game,d).steamCapacity){d.steam=boilerProfile(game,d).steamCapacity;d.blocked='余汽无法存放，已排放';}
  for(const d of devices)if(energySpec(game,d)?.kind==='dyson'||energySpec(game,d)?.cycle)d.eu=Math.min(d.eu,energyCapacity(game,d));
  game.state.energy=devices.reduce((n,d)=>n+d.eu,0);
}
