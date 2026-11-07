import {INDUSTRY_IMPORT as I} from './industry-import.js';
import {ENERGY_REFERENCE as E} from './energy-reference.js';
import {LARGE_BOILERS} from './large-energy-reference.js';

// Construction and gathering are idle-game adaptations. Registered processing
// quantities, chances, durations and EU/t are kept separate from those costs.
export const INDUSTRY_VERSION=6;
export const SOLID_FUELS=Object.freeze({
  coal:{heat:160,ash:'darkAshDustTiny',chance:1/3},
  charcoal:{heat:160,ash:'ashDustTiny',chance:1/3},
  coke:{heat:320,ash:'ashDustTiny',chance:.5},
  gtItem_Block_SSFUEL:{heat:10000,ash:'ashDust',chance:1,highTier:true},
  gtItem_Block_MSSFUEL:{heat:15000,ash:'ashDust',chance:1,highTier:true},
});
export const BOILER_PROFILES=Object.freeze({
  bronze:{...E.boiler,heatConsumption:1,heatAmount:1},
  steel:{...E.boiler,steamPerSecond:300,steamCapacity:32000,waterCapacity:32000,maxTemperature:1000,coolTicks:41,heatConsumption:2,heatAmount:1},
  lava:{...E.boiler,steamPerSecond:600,steamCapacity:32000,waterCapacity:32000,maxTemperature:1000,coolTicks:21,heatConsumption:3,heatAmount:1,lava:true},
  solar:{...E.boiler,heatConsumption:5,heatAmount:5,coolTicks:10,solar:true,minimumOutput:40,calcificationTicks:1080000},
  solarSteel:{...E.boiler,steamPerSecond:360,steamCapacity:32000,waterCapacity:32000,heatConsumption:5,heatAmount:5,coolTicks:16,solar:true,minimumOutput:120,calcificationTicks:1080000},
  heatExchanger:{...E.boiler,exchanger:true,steamCapacity:64000,waterCapacity:64000,heatConsumption:0,heatAmount:1,steamPerSecond:0},
  thermalBoiler:{...E.boiler,thermal:true,steamCapacity:128000,waterCapacity:64000,heatConsumption:0,heatAmount:1,steamPerSecond:0},
  ...Object.fromEntries([1,2,3].map(tier=>['smart'+tier,{...E.boiler,smart:true,steamPerSecond:750*tier,waterCapacity:16000*(tier+1),steamCapacity:32000*(tier+1),maxTemperature:1000+250*tier,heatConsumption:2,heatAmount:1,heatTicks:10,coolTicks:41}])),
  ...Object.fromEntries(Object.entries(LARGE_BOILERS).map(([id,p])=>[id,{...E.boiler,large:id,steam:p.steam,steamPerSecond:p.eut*40/(p.steam==='steam'?1:3),steamCapacity:64000,waterCapacity:64000,heatConsumption:0,heatAmount:1}])),
});
export function applyIndustryCatalog({items,machines,recipes,gatherNodes}){
  const legacy={};
  const retire=new Set(['copperGrind','tinGrind','ironGrind','acid','chlorine','diesel','ticl','tungstenDust','platinum','chrome','bauxiteElectrolysis','lithiumDust','waterElectrolysis','coke']);
  for(let at=recipes.length-1;at>=0;at--)if(retire.has(recipes[at].id)){
    const r=recipes[at];legacy[r.id]=structuredClone(r);recipes.splice(at,1);
  }
  for(const[id,item]of Object.entries(I.items)){
    if(items[id]){items[id].native=item.native;continue;}
    items[id]={...item};
  }
  const addItem=(id,name,kind='item',category='材料')=>items[id]??={id,name,kind,category};
  addItem('lava','熔岩','fluid','流体');addItem('obsidian','黑曜石');
  addItem('charcoal','木炭','item','燃料');
  addItem('ashDustTiny','小堆灰烬');addItem('darkAshDustTiny','小堆黑灰');
  // These profiles match the installed original small boiler classes/config.
  machines.boiler.energy={kind:'boiler',profile:'bronze'};
  machines.dieselGenerator.energy.family='Diesel';
  machines.gasTurbine.energy.family='Gas';
  machines.fusionGenerator.energy.family='Plasma';
  const machine=(id,name,stage,processes,cost,energy,description='')=>{
    machines[id]={id,name,stage,processes,cost,energy,power:energy?.kind==='consumer'?E.voltage[energy.tier]:0,description};
    addItem(id,name,'item','机器');
  };
  machine('steelBoiler','高压燃煤锅炉',1,['boilSteel'],{steelPlate:8,brick:6},{kind:'boiler',profile:'steel'});
  machine('lavaBoiler','强化熔岩锅炉',1,['boilLava'],{steelPlate:8,glass:4},{kind:'boiler',profile:'lava'});
  machine('solarBoiler','简易太阳能锅炉',1,['boilSolar'],{bronzePlate:8,glass:8},{kind:'boiler',profile:'solar'});
  machine('solarSteelBoiler','高级太阳能锅炉',2,['boilSolarSteel'],{steelPlate:8,glass:8},{kind:'boiler',profile:'solarSteel'});
  for(const tier of [1,2,3])machine('smartBoiler'+tier,['低压','中压','高压'][tier-1]+'智能锅炉',tier+1,['boilSmart'+tier],{[['steelPlate','aluminiumPlate','stainlessPlate'][tier-1]]:8,basicCircuit:2,pump:2},{kind:'boiler',profile:'smart'+tier});
  machine('semiFluidGenerator','半流质发电机',2,['generateSemiFluid'],{steelPlate:8,basicCircuit:2,motor:2},{kind:'generator',family:'SemiFluid',fuel:'creosote',tier:1,maxTier:3},'杂酚油、重燃油与其他稠液燃料');
  machine('geothermalGenerator','地热发电机',5,['generateHot'],{titaniumPlate:8,advancedCircuit:2,pump:2},{kind:'generator',family:'Hot',fuel:'lava',tier:4,maxTier:6},'使用熔岩发电');
  machine('solarPanel','太阳能发电板',2,['generateSolar'],{steelPlate:4,glass:6,silicon:4,basicCircuit:2},{kind:'solar',tier:1,maxTier:8},'晴天、露天时输出电力');
  const processing=[
    ['electricMacerator','电动研磨机',2,['grind']],['oreWasher','洗矿机',2,['oreWash']],
    ['thermalCentrifuge','热力离心机',3,['thermalCentrifuge']],['chemicalBath','化学浸洗机',2,['chemicalBath']],
    ['sifter','筛选机',2,['sift']],['electromagneticSeparator','电磁选矿机',2,['electromagnetic']],
    ['mixer','搅拌机',2,['mix']],['distillery','蒸馏室',2,['distillery']],
    ['largeChemical','大型化学反应釜',3,['largeChemistry','chemistry']],['oilCracker','石油裂化机',4,['crack']],
    ['fluidHeater','流体加热器',2,['fluidHeat']],['extractor','提取机',2,['extract']],
    ['electricFurnace','电炉',2,['electricSmelt']],['steamFurnace','蒸汽炉',1,['electricSmelt']],
    ['pyrolyseOven','热解炉',3,['pyrolyse']],
  ];
  for(const[id,name,stage,processes]of processing){
    const steam=id==='steamFurnace';
    machine(id,name,stage,processes,{[steam?'bronzePlate':stage>=4?'stainlessPlate':stage>=3?'aluminiumPlate':'steelPlate']:8,[steam?'glass':stage>=3?'goodCircuit':'basicCircuit']:2,...(steam?{}:{motor:2,pump:1})},steam?{kind:'steam'}:{kind:'consumer',tier:stage-1,maxTier:14});
  }
  // Chemistry and low-voltage distillation exist at LV; voltage still gates recipes.
  machines.chemical.stage=2;machines.chemical.energy.tier=1;
  machines.chemical.cost={steelPlate:8,basicCircuit:2,pump:2};
  for(const r of I.recipes)recipes.push({...r});
  const addRecipe=(id,process,stage,inputs,outputs,extra={})=>recipes.push({id,name:Object.keys(outputs).map(id=>items[id].name).join(' + ')||'电力输出',process,stage,inputs,outputs,seconds:.5,power:0,source:'GTNH2.9',...extra});
  for(const[type,m]of Object.entries(machines))if(m.energy?.kind==='boiler'&&type!=='boiler'){
    const b=BOILER_PROFILES[m.energy.profile];
    addRecipe('energy:'+type,m.processes[0],m.stage,{water:1},{steam:160},{seconds:160/b.steamPerSecond});
  }
  const families={Diesel:['generateDiesel',2],Gas:['generateGas',2],SemiFluid:['generateSemiFluid',2],Plasma:['generatePlasma',5],Hot:['generateHot',5]};
  const fuels=I.fuels.map(f=>({...f}));
  fuels.push({id:'lava',family:'Hot',eu:32,origin:{file:'gtPlusPlus/core/recipe/RecipesGregTech.java',line:1538}});
  // ProcessingCell derives plasma EU/mB from max(1024, mass*1024).
  // Only values already cross-checked against the installed class are enabled.
  if(!fuels.some(f=>f.id==='plasma'&&f.family==='Plasma'))fuels.push({id:'plasma',family:'Plasma',eu:E.plasma.heliumEU,origin:{file:'ProcessingCell.java'}});
  // All diesel/gas fuel entries use their declared base value. Dense liquid
  // cells use SemiFluidFuelHandler's item-derived multipliers and 512 EU cap.
  for(const f of fuels){
    if(f.family==='SemiFluid'){
      f.eu=Math.trunc(f.eu*(f.id==='creosote'?6:['heavyFuel','oilHeavy'].includes(f.id)?1.5:2));
      if(f.eu>512){f.disabled=true;continue;}
    }
    const pair=families[f.family];if(!pair)continue;
    const id='fuel:'+f.family+':'+f.id;
    addRecipe(id,pair[0],pair[1],{[f.id]:1},{},{fuel:f.id,fuelFamily:f.family,fuelEU:f.eu,origin:f.origin});
  }
  for(const [id,fluid,family]of [['dieselPower','diesel','Diesel'],['gasPower','hydrogen','Gas'],['plasmaPower','plasma','Plasma']]){
    const r=recipes.find(r=>r.id===id),fuel=fuels.find(f=>f.id===fluid&&f.family===family);
    if(r&&fuel)Object.assign(r,{fuel:fluid,fuelFamily:family,fuelEU:fuel.eu});
  }
  addRecipe('energy:solar','generateSolar',2,{},{});
  // Only ores listed in original veins for supported dimensions get gathering
  // cards. Spatial deposits and mining are an idle adaptation, not worldgen.
  const existing=new Set(gatherNodes.map(n=>n.output));
  for(const m of I.oreMaterials){
    const dims=m.dimensions??[];
    const region=dims.some(d=>['OW','NETHER','TWILIGHT_FOREST','THE_END'].includes(d))?'surface':dims.includes('Moon')?'moon':dims.includes('Mars')?'mars':dims.some(d=>['Asteroids','EndAsteroids'].includes(d))?'belt':null;
    if(!region)continue;
    const base=Object.values(items).find(i=>i.native?.material===m.id&&i.native.prefix==='ore');
    if(!base||existing.has(base.id))continue;
    existing.add(base.id);
    gatherNodes.push({id:'ore:'+m.id,name:m.name+'矿脉',output:base.id,stage:region==='surface'?2:region==='moon'?5:region==='mars'?6:7,requires:region==='surface'?null:region==='belt'?'advancedRocket':'rocket',amount:1,seconds:6,description:region==='surface'?'开采矿石':region==='moon'?'月球矿脉':region==='mars'?'火星矿脉':'小行星矿脉',cost:{ironPlate:12,motor:2}});
  }
  gatherNodes.push({id:'lavaPool',name:'熔岩池',output:'lava',stage:1,amount:1000,seconds:6,description:'抽取熔岩，需要流体容器',cost:{ironPlate:12,pump:2}});
  return {legacy,fuels:fuels.filter(f=>!f.disabled)};
}
