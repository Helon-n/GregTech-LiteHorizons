import {LATE_MACHINES_REFERENCE as L} from '../data/late-machines-reference.js';
import {takeComponent} from './components.js';
import {parallelRecipe,parallelCount} from './parallel.js';

export const spinTier=(game,d)=>game.catalog.machines[d.type]?.spinmatron??0;
export const spinFluid=L.fluid;
export const spinMode=(d,r)=>d.spinMode??(r?.requirements?.heavyCentrifuge?'heavy':'standard');
export const spinCarrier=d=>d.spinFluid??L.fluid;
export const spinDose=r=>Math.max(1,Math.ceil(Math.log(Math.max(8,r.power)/8)/Math.log(4)))*L.fluidPerTier;
export function spinParallel(game,d,r){
  const level=(d.spinRotors??[]).reduce((n,c)=>n+(game.catalog.items[c.item].rotor.spinLevel??0),0);
  return Math.max(0,Math.floor(Math.floor(level*4*(spinCarrier(d)===L.fluid?1.25:1))/(spinMode(d,r)==='heavy'?32:1)));
}
export const spinRecipe=parallelRecipe;
export function spinBatchCount(game,d,r){
  // Production plans account for one completed operation at a time.
  const power=r.power*L.euMultiplier*(spinMode(d,r)==='heavy'?L.heavyMultiplier:1);
  return parallelCount(game,d,r,spinParallel(game,d,r),power);
}
export function spinFailure(game,d,r){
  if(!spinTier(game,d)||!r)return '';
  const mode=spinMode(d,r);
  if(!spinParallel(game,d,r))return '需要装入足够等级的离心转子';
  if(r.requirements?.heavyCentrifuge&&mode!=='heavy')return '此配方需要重型模式';
  if(mode==='heavy'&&spinCarrier(d)!==L.fluid)return '重型模式需要生物催化推进液';
  if(mode==='light'&&d.energyTier-Math.max(0,Math.ceil(Math.log(Math.max(8,r.power)/8)/Math.log(4)))<3)return '轻型模式要求机组高于配方至少三级电压';
  const dose=spinDose(r)*(d.job?1:5);
  const fluid=spinCarrier(d);
  return game.inputQuantity(fluid,d.fluidInputs?.[fluid])+1e-8<dose?game.catalog.items[fluid].name+'不足，需要 '+dose+' mB':'';
}
export function advanceSpin(game,d,r,used){
  if(!spinTier(game,d))return;
  d.spinClock=(d.spinClock??0)+used;
  while(d.spinClock>=1){
    if(!game.payInputs(d,{[spinCarrier(d)]:spinDose(r)})){d.job=null;d.enabled=false;d.spinClock=0;d.blocked='助转液耗尽，批次已停止';return false;}
    d.spinClock-=1;
  }
  return true;
}
export function changeSpin(game,id,item,remove=false){
  const d=game.state.devices.find(d=>d.id===id),tier=d&&spinTier(game,d);
  if(!tier)return {ok:false,message:'请逐台配置 Spinmatron'};
  if(d.job||d.enabled)return {ok:false,message:'请先结束批次并暂停设备'};
  if(['light','standard','heavy'].includes(item)){d.spinMode=item;return {ok:true};}
  if([L.fluid,L.kerosene].includes(item)){d.spinFluid=item;return {ok:true};}
  d.spinRotors??=[];
  if(remove){const c=d.spinRotors.pop();if(c)game.state.components.push(c);return {ok:true};}
  if(d.spinRotors.length>=tier*2)return {ok:false,message:'转子槽位已满'};
  const c=takeComponent(game,item,'rotor');if(!c)return {ok:false,message:'仓库中没有这个转子'};
  d.spinRotors.push(c);return {ok:true};
}
export function validSpin(game,d){
  if(d.spinMode!==undefined&&(!spinTier(game,d)||!['light','standard','heavy'].includes(d.spinMode)))return false;
  if(d.spinFluid!==undefined&&(!spinTier(game,d)||![L.fluid,L.kerosene].includes(d.spinFluid)))return false;
  if(spinTier(game,d)&&d.job?.parallel!==undefined&&(!Number.isInteger(d.job.parallel)||d.job.parallel<1||d.job.parallel>spinParallel(game,d,game.recipeById.get(d.recipe))))return false;
  if(d.spinRotors!==undefined&&(!spinTier(game,d)||!Array.isArray(d.spinRotors)||d.spinRotors.length>spinTier(game,d)*2||d.spinRotors.some(c=>!game.catalog.items[c?.item]?.rotor||c.kind!=='rotor'||!Number.isInteger(c.life)||c.life<1||c.life>game.catalog.items[c.item].rotor.durability)))return false;
  return d.spinClock===undefined||spinTier(game,d)&&Number.isFinite(d.spinClock)&&d.spinClock>=0&&d.spinClock<1;
}
