import {FOUNDRY_REFERENCE as F} from '../data/foundry-reference.js';
import {parallelCount} from './parallel.js';

export const foundryTier=(game,d)=>game.catalog.machines[d.type]?.foundry??0;
export const foundryModuleCost=(tier,m)=>({...m.cost,...(m.chassis?{[F.chassis[tier-1]]:m.chassis}:{})});
export function foundryStats(d){
  const modules=d.foundryModules??[],has=id=>modules.includes(id),count=id=>modules.filter(m=>m===id).length;
  let parallel=F.parallel+12*count('EXTRA_CASTING_BASINS'),speed=F.speed+1.5*count('STREAMLINED_CASTERS'),eu=1-.1*count('POWER_EFFICIENT_SUBSYSTEMS'),oc=2+(has('EFFICIENT_OC')?.4:0);
  if(has('STREAMLINED_CASTERS')&&has('EXTRA_CASTING_BASINS')){speed+=.8;parallel+=8;}
  if(has('POWER_EFFICIENT_SUBSYSTEMS')&&has('EFFICIENT_OC')){oc+=.1;eu-=.5;}
  const helio=count('HELIOCAST_REINFORCEMENT'),roll=helio>=3?d.foundryRoll??[0,0,0,0,0]:[0,0,0,0,0];
  speed+=roll[0];eu-=.15*roll[1];oc+=.05*roll[2];parallel+=8*roll[3];
  eu*=.8**count('POWER_EFFICIENT_SUBSYSTEMS');
  if(has('UNIVERSAL_COLLAPSER')){eu*=4;speed*=4;}
  if(has('HYPERCOOLER')&&has('UNIVERSAL_COLLAPSER')){eu*=2;speed*=2;}
  return {parallel:Math.floor(parallel)*d.energyTier,speed,eu,oc,extra:roll[4],
    coolant:has('HYPERCOOLER'),eternity:has('HYPERCOOLER')&&has('UNIVERSAL_COLLAPSER'),moduleOnly:has('UNIVERSAL_COLLAPSER')||helio>0};
}
export function foundryFailure(game,d,r){
  if(!foundryTier(game,d)||!r)return '';
  const stats=foundryStats(d);
  if(r.power>8*4**10&&!stats.moduleOnly)return 'UIV 及以上配方需要日铸强化或通用坍缩模块';
  if(stats.coolant){
    const selected=d.job?F.coolants.find(c=>c.item===d.foundryCoolant):F.coolants.find(c=>game.inputQuantity(c.item,d.fluidInputs?.[c.item])>=c.amount);
    if(!selected)return '超级冷却器缺少冷却液';
    if(selected.oc===3&&!stats.eternity)return '永恒冷却液需要超级冷却器与通用坍缩器组合';
    if(game.inputQuantity(selected.item,d.fluidInputs?.[selected.item])+1e-8<selected.amount)return '冷却液不足';
  }
  return '';
}
export function beginFoundry(game,d){
  const n=(d.foundryModules??[]).filter(m=>m==='HELIOCAST_REINFORCEMENT').length;
  d.foundryRoll=n>=3?Array.from({length:5},(_,i)=>i===4?(n===4?Math.floor(game.nextDropRandom()*n):0):Math.floor(game.nextDropRandom()*(n+1))):[0,0,0,0,0];
  d.foundryCoolant=foundryStats(d).coolant?F.coolants.find(c=>game.inputQuantity(c.item,d.fluidInputs?.[c.item])>=c.amount)?.item??null:null;
}
export function foundryRuntime(game,d,r){
  const stats=foundryStats(d),coolant=F.coolants.find(c=>c.item===d.foundryCoolant),capacity=8*4**d.energyTier*64;
  let power=r.power*stats.eu*(d.job?.parallel??1),seconds=r.seconds/stats.speed;
  if(power>capacity)return {seconds,power,steamPerSecond:0,valid:false};
  const tier=Math.max(0,Math.ceil(Math.log(Math.max(8,r.power)/8)/Math.log(4)));
  let overclocks=Math.max(0,d.energyTier-tier+(stats.coolant?coolant?.oc??0:0)+stats.extra);
  while(overclocks-->0&&power>0&&power*4<=capacity&&seconds>.05){power*=4;seconds/=stats.oc;}
  return {seconds:Math.max(.05,Math.ceil(seconds*20-1e-8)/20),power:Math.ceil(power),steamPerSecond:0,valid:true};
}
export function foundryBatchCount(game,d,r){return parallelCount(game,d,r,foundryStats(d).parallel,r.power*foundryStats(d).eu);}
export function advanceFoundry(game,d,used){
  if(!foundryTier(game,d)||!foundryStats(d).coolant)return true;
  d.foundryClock=(d.foundryClock??0)+used;
  const coolant=F.coolants.find(c=>c.item===d.foundryCoolant);
  while(d.foundryClock>=1){
    if(!coolant||!game.payInputs(d,{[coolant.item]:coolant.amount})){d.job=null;d.enabled=false;d.foundryClock=0;d.blocked='冷却液耗尽，批次已停止';return false;}
    d.foundryClock-=1;
  }
  return true;
}
export function changeFoundry(game,id,slot,code){
  const d=game.state.devices.find(d=>d.id===id),tier=d&&foundryTier(game,d);
  if(!tier||!Number.isInteger(slot)||slot<0||slot>tier)return {ok:false,message:'模块槽位无效'};
  if(d.job||d.enabled)return {ok:false,message:'请先结束批次并暂停设备'};
  const m=F.modules.find(m=>m.code===code);if(code&&!m)return {ok:false,message:'模块不存在'};
  d.foundryModules??=Array(tier+1).fill(null);
  const old=F.modules.find(m=>m.code===d.foundryModules[slot]);
  if(old?.code===code||!old&&!code)return {ok:true};
  if(m?.unique&&d.foundryModules.some((key,i)=>i!==slot&&key===code))return {ok:false,message:'此模块只能安装一个'};
  if(m&&!game.pay(foundryModuleCost(tier,m)))return {ok:false,message:'模块整套结构材料不足'};
  if(old)game.add(foundryModuleCost(tier,old),false);
  d.foundryModules[slot]=code||null;d.foundryRoll=[0,0,0,0,0];d.foundryCoolant=null;return {ok:true};
}
export function foundryRefund(game,d){
  const cost={};for(const key of d.foundryModules??[]){const m=F.modules.find(m=>m.code===key);if(m)for(const[id,n]of Object.entries(foundryModuleCost(foundryTier(game,d),m)))cost[id]=(cost[id]??0)+n;}return cost;
}
export function validFoundry(game,d){
  const tier=foundryTier(game,d),modules=d.foundryModules;
  if(modules!==undefined&&(!tier||!Array.isArray(modules)||modules.length!==tier+1||modules.some(k=>k!==null&&!F.modules.some(m=>m.code===k))||F.modules.some(m=>m.unique&&modules.filter(k=>k===m.code).length>1)))return false;
  const helio=(modules??[]).filter(k=>k==='HELIOCAST_REINFORCEMENT').length;
  if(d.foundryRoll!==undefined&&(!tier||!Array.isArray(d.foundryRoll)||d.foundryRoll.length!==5||d.foundryRoll.some((n,i)=>!Number.isInteger(n)||n<0||n>(helio>=3?(i===4?(helio===4?3:0):helio):0))))return false;
  if(d.foundryCoolant!=null&&(!tier||!foundryStats(d).coolant||!F.coolants.some(c=>c.item===d.foundryCoolant&&(c.oc!==3||foundryStats(d).eternity))))return false;
  if(d.foundryClock!==undefined&&(!tier||!Number.isFinite(d.foundryClock)||d.foundryClock<0||d.foundryClock>=1))return false;
  return d.job?.parallel===undefined||!tier||Number.isInteger(d.job.parallel)&&d.job.parallel>=1&&d.job.parallel<=foundryStats(d).parallel;
}
