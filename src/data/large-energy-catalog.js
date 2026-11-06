import {INDUSTRY_IMPORT as I} from './industry-import.js';
import {TECHNOLOGY_IMPORT as T} from './technology-import.js';
import {LARGE_BOILERS,LARGE_BOILER_FLUIDS,largeBoilerBurnTicks} from './large-energy-reference.js';

export function applyLargeEnergyCatalog({items,machines,recipes,fuels}){
  for(const[id,name,stage,process]of [['heatExchanger','大型热交换机',5,'heatExchange'],['heatExchangerXL','XL 热交换机',7,'heatExchangeXL'],['heatExchangerExtreme','极限热交换机',7,'heatExchangeExtreme']]){
    machines[id]={id,name,stage,processes:[process],cost:{[stage>=7?'tungstensteelPlate':'titaniumPlate']:32,pump:8,advancedCircuit:4},power:0,energy:{kind:'boiler',cycle:'exchanger',profile:'heatExchanger'}};
    items[id]={id,name,kind:'item',category:'机器'};
  }
  items.superheatedSteam??={id:'superheatedSteam',name:'过热蒸汽',kind:'fluid',category:'流体'};
  machines.thermalBoiler={id:'thermalBoiler',name:'热力锅炉',stage:5,processes:['thermalBoil'],cost:{tungstensteelPlate:32,pump:8,advancedCircuit:4},power:0,energy:{kind:'boiler',cycle:'thermal',profile:'thermalBoiler'}};
  items.thermalBoiler={id:'thermalBoiler',name:'热力锅炉',kind:'item',category:'机器'};
  const families={Diesel:['generateDiesel',2],Gas:['generateGas',2],SemiFluid:['generateSemiFluid',2],Hot:['generateHot',5],Plasma:['generatePlasma',5],Acid:['generateAcid',2],Rocket:['generateRocket',5]};
  for(const raw of T.fuels??[]){
    const existing=fuels.find(f=>f.id===raw.id&&f.family===raw.family);
    if(existing)continue;
    const f={...raw};
    if(f.family==='SemiFluid'){f.eu=Math.trunc(f.eu*(f.id==='creosote'?6:['heavyFuel','oilHeavy'].includes(f.id)?1.5:2));if(f.eu>512)continue;}
    const [process,stage]=families[f.family]??[];if(!process)continue;
    fuels.push(f);
    recipes.push({id:'fuel:'+f.family+':'+f.id,name:items[f.id].name+'发电',process,stage,inputs:{[f.id]:1},outputs:{},seconds:.5,power:0,source:'GTNH2.9',fuel:f.id,fuelFamily:f.family,fuelEU:f.eu,origin:f.origin});
  }
  const fluids=[...I.fuels,...T.fuels??[]].filter(f=>['Diesel','Gas','SemiFluid'].includes(f.family));
  for(const [id,p]of Object.entries(LARGE_BOILERS)){
    const process='boil:'+id;
    machines[id]={id,name:p.name,stage:p.stage,processes:[process],cost:{[p.material]:32,brick:16,pump:4},power:0,energy:{kind:'boiler',profile:id}};
    items[id]={id,name:p.name,kind:'item',category:'机器'};
    const origin={file:'gregtech/common/tileentities/machines/multi/MTELargeBoilerBase.java',line:333};
    recipes.push({id:'energy:'+id,process,name:p.name+'固体燃料',stage:p.stage,inputs:{water:1},outputs:{[p.steam]:160},seconds:160/(p.eut*40/(p.steam==='steam'?1:3)),power:0,source:'GTNH2.9',origin,largeBoiler:id});
    const seen=new Set();
    for(const f of fluids){
      const registry=items[f.id]?.native?.registry?.toLowerCase();
      if(seen.has(f.id)||p.steam!=='steam'&&!LARGE_BOILER_FLUIDS.includes(registry))continue;
      const burnTicks=largeBoilerBurnTicks(f.eu/(f.family==='SemiFluid'?10:20));
      if(burnTicks<=0)continue;seen.add(f.id);
      recipes.push({id:'energy:'+id+':'+f.id,name:items[f.id].name+'供热',process,stage:p.stage,inputs:{[f.id]:1000},outputs:{[p.steam]:1},seconds:.05,power:0,source:'GTNH2.9',origin,largeBoiler:id,boilerFuel:f.id,boilerBurnTicks:burnTicks});
    }
  }
  machines.largeCombustionEngine={id:'largeCombustionEngine',name:'大型内燃机',stage:5,processes:['generateDiesel'],cost:{titaniumPlate:32,advancedCircuit:4,motor:8,pump:4},power:0,energy:{kind:'generator',cycle:'combustion',family:'Diesel',tier:4}};
  items.largeCombustionEngine={id:'largeCombustionEngine',name:'大型内燃机',kind:'item',category:'机器'};
  for(const[id,name,stage,kind,fluid,exhaust]of [
    ['largeSteamTurbine','大型蒸汽涡轮',4,'steam','steam','distilledWater'],
    ['largeHPSteamTurbine','大型过热蒸汽涡轮',5,'superheated','superheatedSteam','steam'],
    ['largeSCSteamTurbine','大型超临界蒸汽涡轮',8,'supercritical','supercriticalSteam','superheatedSteam'],
    ['largeGasTurbine','大型燃气涡轮',4,'gas',null,null],
    ['largePlasmaTurbine','大型等离子涡轮',7,'plasma',null,null],
  ]){
    const process='turbine:'+kind;
    machines[id]={id,name,stage,processes:[process],cost:{[stage>=7?'tungstensteelPlate':stage>=5?'titaniumPlate':'stainlessPlate']:32,motor:8,pump:4,advancedCircuit:4},power:0,energy:{kind:'generator',cycle:'turbine',tier:Math.max(3,stage-1),maxTier:14}};
    items[id]={id,name,kind:'item',category:'机器'};
    const origin={file:'gregtech/common/tileentities/machines/multi/turbines/MTELargeTurbine'+({steam:'Steam',superheated:'HPSteam',supercritical:'SCSteam',gas:'Gas',plasma:'Plasma'}[kind])+'.java'};
    if(fluid){
      items[fluid]??={id:fluid,name:'超临界蒸汽',kind:'fluid',category:'流体'};
      recipes.push({id:'energy:'+id,name:items[fluid].name+'发电',process,stage,inputs:{[fluid]:1},outputs:{[exhaust]:1},seconds:.05,power:0,source:'GTNH2.9',origin,turbineKind:kind,turbineFuel:fluid,turbineExhaust:exhaust});
    }else for(const f of fuels.filter(f=>f.family===(kind==='gas'?'Gas':'Plasma'))){
      const native=items[f.id]?.native;
      const cold=kind==='plasma'?Object.values(items).find(i=>i.kind==='fluid'&&i.native?.material===native?.material&&['gas','fluid','molten'].includes(i.native?.prefix))?.id:null;
      recipes.push({id:'energy:'+id+':'+f.id,name:items[f.id].name+'发电',process,stage,inputs:{[f.id]:1},outputs:cold?{[cold]:1}:{},seconds:kind==='plasma'?1:.05,power:0,source:'GTNH2.9',origin,turbineKind:kind,turbineFuel:f.id,turbineExhaust:cold});
    }
  }
  // XL controllers require 12 equal rotors and process at the original 16x
  // flow. Dense steam is 1000x by volume; no decompression shortcut is added.
  for(const [base,id]of [['largeSteamTurbine','xlSteamTurbine'],['largeHPSteamTurbine','xlHPSteamTurbine'],['largeSCSteamTurbine','xlSCSteamTurbine'],['largeGasTurbine','xlGasTurbine'],['largePlasmaTurbine','xlPlasmaTurbine']]){
    const m=machines[base],process='xl:'+m.processes[0];
    machines[id]={...m,id,name:m.name.replace('大型','XL '),stage:Math.max(6,m.stage),icon:base,processes:[process],cost:{...m.cost,tungstensteelPlate:64},energy:{...m.energy,tier:5,rotorSlots:12}};
    items[id]={id,name:machines[id].name,kind:'item',category:'机器',icon:base};
    for(const r of recipes.filter(r=>m.processes.includes(r.process))){
      const copy={...r,id:'energy:'+id+':'+r.turbineFuel,process,stage:machines[id].stage,xlTurbine:true,origin:{file:r.origin.file.replace('/turbines/MTELargeTurbine','/xlturbines/MTEXLTurbine')}};
      recipes.push(copy);
      if(['steam','superheated','supercritical'].includes(r.turbineKind)){
        const dense={steam:['denseSteam','致密蒸汽'],superheated:['denseSuperheatedSteam','致密过热蒸汽'],supercritical:['denseSupercriticalSteam','致密超临界蒸汽']};
        const [fluid,name]=dense[r.turbineKind],exhaust=r.turbineKind==='steam'?'distilledWater':dense[r.turbineKind==='supercritical'?'superheated':'steam'][0];
        items[fluid]??={id:fluid,name,kind:'fluid',category:'流体',icon:r.turbineFuel};
        recipes.push({...copy,id:copy.id+':dense',name:name+'发电',inputs:{[fluid]:1},outputs:{[exhaust]:1},turbineFuel:fluid,turbineExhaust:exhaust,denseSteam:true});
      }
    }
  }
}
