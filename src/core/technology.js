import {becFailure} from './bec.js';
import {auraFailure} from './magic.js';
import {spinFailure} from './spinmatron.js';
import {foundryFailure} from './foundry.js';
import {COILS} from '../data/technology-catalog.js';
import {devicePeers} from './groups.js';
import {fusionCapacity} from './fusion.js';
import {godforgeKind,forgeHost,forgeHeat,forgeFailure} from './godforge.js';
import {bioFailure} from './biochemistry.js';

export function recipeProcesses(recipe){return [recipe?.process,...(recipe?.alsoProcesses??[])].filter(Boolean);}
export function machineSupportsRecipe(machine,recipe){return !!machine&&['heavyCentrifuge','nonCell'].every(key=>!recipe?.requirements?.[key]||!!machine.capabilities?.[key])&&['solarTier','defcTier','bloodAltarTier','instability','miningModule'].every(key=>recipe?.requirements?.[key]===undefined||(machine.capabilities?.[key]??-1)>=recipe.requirements[key])&&recipeProcesses(recipe).some(process=>machine.processes.includes(process));}

export function machineHeat(game,d){
  if(godforgeKind(game,d)&&godforgeKind(game,d)!=='host'){const s=forgeHost(game,d)?.godforge;return s?forgeHeat(s,godforgeKind(game,d)):0;}
  const coil=COILS.find(c=>c.item===d.coil);
  return coil?coil.heat+(d.type==='ebf'?100*(d.energyTier-2):0):0;
}
export function requirementFailure(game,d,r){
  const aura=auraFailure(game,d,r);if(aura)return aura;
  const advanced=becFailure(game,d,r)||spinFailure(game,d,r)||foundryFailure(game,d,r);if(advanced)return advanced;
  const biological=bioFailure(game,d,r);if(biological)return biological;
  const forge=godforgeKind(game,d);
  if(forge&&forge!=='host'){const failure=forgeFailure(game,d,r);if(failure)return failure;}
  const req=r?.requirements;if(!req)return '';
  if(req.bioLabTier!==undefined&&d.energyTier<req.bioLabTier)return '生物实验室需要 '+req.bioLabTier+' 级电压';
  if(req.eohSpace!==undefined&&(!game.catalog.machines[d.type]?.eoh||(d.eoh?.space??0)<req.eohSpace))return '空间压缩场需要 '+(req.eohSpace+1)+' 级';
  if(req.heat&&machineHeat(game,d)<req.heat)return '线圈温度不足，需要 '+req.heat+' K';
  if(req.cleanroom&&!game.state.devices.some(x=>x.type==='cleanroomFacility'&&x.enabled&&x.cleanroomReady))return '需要供电中的洁净室';
  if(req.lowGravity&&d.location!=='orbit')return '需要轨道环境';
  if(game.catalog.machines[d.type]?.orbital&&d.location!=='orbit')return '请将设备部署到轨道';
  if(req.researchData&&game.quantity(req.researchData)<1)return '需要先完成对应研究';
  const spec=game.catalog.machines[d.type]?.energy;
  if(req.startup&&(!spec?.fusion||req.startup>fusionCapacity(spec,d.energyTier)))return '聚变反应堆启动容量不足';
  const capabilities=game.catalog.machines[d.type]?.capabilities??{};
  if(req.instability!==undefined&&(capabilities.instability??-1)<req.instability)return '注魔稳定能力不足';
  if(req.bloodAltarTier!==undefined&&(capabilities.bloodAltarTier??0)<req.bloodAltarTier)return '血之祭坛需要 '+req.bloodAltarTier+' 级';
  if(req.miningModule!==undefined&&(capabilities.miningModule??0)<req.miningModule)return '太空采矿模块需要 '+req.miningModule+' 型';
  if(req.computation&&(capabilities.computation??0)<req.computation)return '算力不足，需要 '+req.computation;
  if(r.process==='stationResearch'&&req.researchVoltage>8*4**d.energyTier)return '研究电压不足';
  if(req.algaeTier!==undefined&&capabilities.algaeTier!==req.algaeTier)return '培养等级需要 '+req.algaeTier+' 级';
  for(const [key,label]of [['compressionTier','压缩等级'],['chemicalCasing','化工外壳'],['preciseCasing','精密外壳'],['componentCasing','部件装配线外壳'],['spaceModule','轨道模块'],['pcbTier','PCB 工厂等级'],['qftTier','量子转换等级'],['qftFocus','量子聚焦等级'],['algaeTier','藻类池等级'],['nanoForgeTier','纳米锻炉等级'],['refineryCoil','硅岩精炼厂线圈等级'],['plasmaTier','造物主等离子等级'],['exoticTier','造物主奇异物质等级']]){
    if(forge&&['plasmaTier','exoticTier'].includes(key))continue;
    if(req[key]!==undefined&&(capabilities[key]??-1)<req[key])return label+'需要 '+req[key]+' 级';
  }
  if(req.bioUpgrade&&!capabilities.bioUpgrade)return '需要生物升级模块';
  if(req.solarTier!==undefined&&(capabilities.solarTier??0)<req.solarTier)return '太阳能工厂需要 '+req.solarTier+' 型';
  if(req.defcTier!==undefined&&(capabilities.defcTier??0)<req.defcTier)return '龙之融合外壳需要 '+req.defcTier+' 级';
  if(req.multiStepPlasma&&!forge&&!capabilities.multiStepPlasma)return '需要多阶段等离子升级';
  if(req.heavyCentrifuge&&!capabilities.heavyCentrifuge)return '需要重型离心模式';
  if(req.nonCell&&!capabilities.nonCell)return '需要工业机型的多流体输入输出';
  if(req.nanochipTier!==undefined&&(capabilities.nanochipTier??-1)<req.nanochipTier)return '纳米芯片矩阵等级需要 '+req.nanochipTier+' 级';
  if(req.nkeRange&&(!capabilities.nkeRange||capabilities.nkeRange.min<req.nkeRange.min||capabilities.nkeRange.max>req.nkeRange.max))return '中子能量需处于 '+req.nkeRange.min+'–'+req.nkeRange.max+' keV';
  return '';
}
export function requirementLabels(game,r){
  const req=r?.requirements??{};
  const calibrations={PRIMITIVE:'基础电路',CRYSTAL:'晶体电路',WETWARE:'湿件电路',BIO:'生物电路',OPTICAL:'光学电路',EXOTIC:'奇异电路',COSMIC:'宇宙电路',TEMPORAL:'时空电路',SPECIAL:'特殊电路'};
  return [...(r?.beamNeeds??[]).map(q=>((game.catalog.items['beam_'+q.particle]?.name??q.particle)+' × '+q.amount)),req.computation&&('算力 ≥ '+req.computation.toLocaleString()),r.process==='stationResearch'&&req.researchVoltage&&('研究供能 '+req.researchVoltage.toLocaleString()+' EU/t × '+req.researchAmperage+' A'),req.bioCulture&&game.catalog.items[req.bioCulture].name,req.bioGlass&&('玻璃 ≥ '+req.bioGlass+' 级'),req.radiation?.value&&((req.radiation.exact?'精确 ':'至少 ')+req.radiation.value+' Sv'),req.eohSpace!==undefined&&('空间压缩场 ≥ '+(req.eohSpace+1)+' 级'),req.heat&&('线圈 ≥ '+req.heat+' K'),req.cleanroom&&'洁净室',req.lowGravity&&'轨道环境',req.startup&&('启动 '+req.startup.toLocaleString()+' EU'),req.researchData&&('研究：'+game.catalog.items[req.researchData].name),...[
    ['compressionTier','压缩等级'],['instability','注魔稳定能力'],['bloodAltarTier','祭坛等级'],['vis','六种原始灵气各需'],['mana','魔力消耗'],['miningModule','太空采矿模块型号'],['chemicalCasing','化工外壳'],['preciseCasing','精密外壳'],['componentCasing','部件装配线外壳'],['spaceModule','轨道模块'],
    ['pcbTier','PCB 工厂等级'],['qftTier','量子转换等级'],['qftFocus','量子聚焦等级'],['algaeTier','藻类池等级'],['nanoForgeTier','纳米锻炉等级'],['refineryCoil','硅岩精炼厂线圈等级'],['plasmaTier','造物主等离子等级'],['exoticTier','造物主奇异物质等级'],['nanochipTier','纳米芯片矩阵等级'],['bioLabTier','生物实验室电压等级'],['solarTier','太阳能工厂型号'],['defcTier','龙之融合外壳等级'],
  ].filter(([key])=>req[key]!==undefined).map(([key,label])=>label+(key==='algaeTier'?' = ':' ≥ ')+req[key]),req.bioUpgrade&&'生物升级模块',req.multiStepPlasma&&'多阶段等离子升级',req.heavyCentrifuge&&'重型离心模式',req.nonCell&&'工业多流体输入输出',req.becSlots&&('纳米蜂群按 '+req.becSlots.map(s=>s.tier+' 级').join(' → ')+' 逐槽加工'),req.compostBoost&&'堆肥培养',req.dissolutionRatio&&('流体配比 '+req.dissolutionRatio+':1'),req.nanochipCalibration&&req.nanochipCalibration!=='NONE'&&((calibrations[req.nanochipCalibration]??'特殊电路')+'校准'),req.nkeRange&&('中子能量 '+req.nkeRange.min+'–'+req.nkeRange.max+' keV')].filter(Boolean);
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
