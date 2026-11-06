import {COILS} from '../data/technology-catalog.js';
import {devicePeers} from './groups.js';
import {fusionCapacity} from './fusion.js';
import {godforgeKind,forgeHost,forgeHeat,forgeFailure} from './godforge.js';
import {bioFailure} from './biochemistry.js';

export function recipeProcesses(recipe){return [recipe?.process,...(recipe?.alsoProcesses??[])].filter(Boolean);}
export function machineSupportsRecipe(machine,recipe){return !!machine&&recipeProcesses(recipe).some(process=>machine.processes.includes(process));}

export function machineHeat(game,d){
  if(godforgeKind(game,d)&&godforgeKind(game,d)!=='host'){const s=forgeHost(game,d)?.godforge;return s?forgeHeat(s,godforgeKind(game,d)):0;}
  const coil=COILS.find(c=>c.item===d.coil);
  return coil?coil.heat+(d.type==='ebf'?100*(d.energyTier-2):0):0;
}
export function requirementFailure(game,d,r){
  const biological=bioFailure(game,d,r);if(biological)return biological;
  const forge=godforgeKind(game,d);
  if(forge&&forge!=='host'){const failure=forgeFailure(game,d,r);if(failure)return failure;}
  const req=r?.requirements;if(!req)return '';
  if(req.heat&&machineHeat(game,d)<req.heat)return '线圈温度不足，需要 '+req.heat+' K';
  if(req.cleanroom&&!game.state.devices.some(x=>x.type==='cleanroomFacility'&&x.enabled&&x.cleanroomReady))return '需要供电中的洁净室';
  if(req.lowGravity&&d.location!=='orbit')return '需要轨道环境';
  if(game.catalog.machines[d.type]?.orbital&&d.location!=='orbit')return '请将设备部署到轨道';
  if(req.researchData&&game.quantity(req.researchData)<1)return '需要先完成扫描研究';
  const spec=game.catalog.machines[d.type]?.energy;
  if(req.startup&&(!spec?.fusion||req.startup>fusionCapacity(spec,d.energyTier)))return '聚变反应堆启动容量不足';
  const capabilities=game.catalog.machines[d.type]?.capabilities??{};
  if(req.algaeTier!==undefined&&capabilities.algaeTier!==req.algaeTier)return '培养等级需要 '+req.algaeTier+' 级';
  for(const [key,label]of [['compressionTier','压缩等级'],['chemicalCasing','化工外壳'],['preciseCasing','精密外壳'],['componentCasing','部件装配线外壳'],['spaceModule','轨道模块'],['pcbTier','PCB 工厂等级'],['qftTier','量子转换等级'],['qftFocus','量子聚焦等级'],['algaeTier','藻类池等级'],['nanoForgeTier','纳米锻炉等级'],['refineryCoil','硅岩精炼厂线圈等级'],['plasmaTier','造物主等离子等级'],['exoticTier','造物主奇异物质等级']]){
    if(forge&&['plasmaTier','exoticTier'].includes(key))continue;
    if(req[key]!==undefined&&(capabilities[key]??-1)<req[key])return label+'需要 '+req[key]+' 级';
  }
  if(req.bioUpgrade&&!capabilities.bioUpgrade)return '需要生物升级模块';
  if(req.multiStepPlasma&&!forge&&!capabilities.multiStepPlasma)return '需要多阶段等离子升级';
  if(req.heavyCentrifuge&&!capabilities.heavyCentrifuge)return '需要重型离心模式';
  if(req.nanochipTier!==undefined&&(capabilities.nanochipTier??-1)<req.nanochipTier)return '纳米芯片矩阵等级需要 '+req.nanochipTier+' 级';
  if(req.nkeRange&&(!capabilities.nkeRange||capabilities.nkeRange.min<req.nkeRange.min||capabilities.nkeRange.max>req.nkeRange.max))return '中子能量需处于 '+req.nkeRange.min+'–'+req.nkeRange.max+' keV';
  return '';
}
export function requirementLabels(game,r){
  const req=r?.requirements??{};
  const calibrations={PRIMITIVE:'基础电路',CRYSTAL:'晶体电路',WETWARE:'湿件电路',BIO:'生物电路',OPTICAL:'光学电路',EXOTIC:'奇异电路',COSMIC:'宇宙电路',TEMPORAL:'时空电路',SPECIAL:'特殊电路'};
  return [req.bioCulture&&game.catalog.items[req.bioCulture].name,req.bioGlass&&('玻璃 ≥ '+req.bioGlass+' 级'),req.radiation?.value&&((req.radiation.exact?'精确 ':'至少 ')+req.radiation.value+' Sv'),req.heat&&('线圈 ≥ '+req.heat+' K'),req.cleanroom&&'洁净室',req.lowGravity&&'轨道环境',req.startup&&('启动 '+req.startup.toLocaleString()+' EU'),req.researchData&&('研究：'+game.catalog.items[req.researchData].name),...[
    ['compressionTier','压缩等级'],['chemicalCasing','化工外壳'],['preciseCasing','精密外壳'],['componentCasing','部件装配线外壳'],['spaceModule','轨道模块'],
    ['pcbTier','PCB 工厂等级'],['qftTier','量子转换等级'],['qftFocus','量子聚焦等级'],['algaeTier','藻类池等级'],['nanoForgeTier','纳米锻炉等级'],['refineryCoil','硅岩精炼厂线圈等级'],['plasmaTier','造物主等离子等级'],['exoticTier','造物主奇异物质等级'],['nanochipTier','纳米芯片矩阵等级'],
  ].filter(([key])=>req[key]!==undefined).map(([key,label])=>label+(key==='algaeTier'?' = ':' ≥ ')+req[key]),req.bioUpgrade&&'生物升级模块',req.multiStepPlasma&&'多阶段等离子升级',req.heavyCentrifuge&&'重型离心模式',req.compostBoost&&'堆肥培养',req.dissolutionRatio&&('流体配比 '+req.dissolutionRatio+':1'),req.nanochipCalibration&&req.nanochipCalibration!=='NONE'&&((calibrations[req.nanochipCalibration]??'特殊电路')+'校准'),req.nkeRange&&('中子能量 '+req.nkeRange.min+'–'+req.nkeRange.max+' keV')].filter(Boolean);
}
export function installCoil(game,id,item){
  const peers=devicePeers(game,id),coil=COILS.find(c=>c.item===item);
  if(!peers.length||!coil||peers.some(d=>!game.catalog.machines[d.type]?.coils))return {ok:false,message:'请选择可安装的线圈'};
  if(peers.some(d=>d.job||d.enabled))return {ok:false,message:'请先结束批次并暂停设备'};
  const changed=peers.filter(d=>d.coil!==item);
  if(!game.pay({[item]:16*changed.length}))return {ok:false,message:'每台高炉需要 16 个相同线圈方块'};
  const refund={};for(const d of changed){if(d.coil)refund[d.coil]=(refund[d.coil]??0)+16;d.coil=item;}
  game.add(refund,false);return {ok:true};
}
export function setMachineLocation(game,id,location){
  const peers=devicePeers(game,id);
  if(!peers.length||!['ground','orbit'].includes(location))return {ok:false,message:'地点无效'};
  if(location==='orbit'&&!game.state.devices.some(d=>d.type==='spaceElevator'&&d.enabled))return {ok:false,message:'请先建造并启用太空电梯'};
  if(peers.some(d=>d.job))return {ok:false,message:'请先结束当前批次'};
  for(const d of peers)d.location=location;return {ok:true};
}
