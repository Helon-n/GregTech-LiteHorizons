import {EOH_REFERENCE as H} from '../data/eoh-reference.js';
import {endpointMembers} from './groups.js';

export const isEOH=(game,d)=>!!game.catalog.machines[d.type]?.eoh;
const unsigned=n=>typeof n==='string'&&/^(0|[1-9]\d{0,49})$/.test(n);
const clamp=n=>Math.max(0,Math.min(1,n));
export function initializeEOH(game,d){if(isEOH(game,d))d.eoh??={charge:'0',returnEU:'0',time:0,space:0,stability:0,circuit:0,pity:0,previous:0,resetPity:true};}
export function eohRuntime(d,r){
  const s=d.eoh,seconds=Math.max(1,Math.floor(r.seconds*20*2**-s.time*.97**(s.space-r.requirements.eohSpace)*2**-s.circuit))/20;
  return {seconds,power:0,steamPerSecond:0,valid:s.space>=r.requirements.eohSpace};
}
export const eohCost=(d,r)=>BigInt(r.eoh.inputEU)*4n**BigInt(d.eoh.circuit);
export function eohChance(d,r){
  const s=d.eoh,base=r.eoh.chance-s.time*.0925+s.stability*.05;
  return clamp(base===s.previous&&!s.resetPity&&s.pity>=1?1:base);
}
// Match Java's double multiplication followed by a saturating long cast.
// Stored balances and transfers remain exact integer EU afterwards.
const refundFor=(d,r)=>{
  const n=Math.trunc(Number(r.eoh.outputEU)*(1-(8-d.eoh.stability)*.05));
  return n>=Number(9223372036854775807n)?'9223372036854775807':BigInt(n).toString();
};
function outcome(d,r,success,chance){
  if(!success){const n=Math.floor(chance*14400*2**(r.eoh.rocketTier+1));return n?{spacetimeMolten:n}:{};}
  return Object.fromEntries(Object.entries(r.outputs).map(([id,n])=>[id,Math.floor(n*(1-d.eoh.stability*.05))]).filter(([,n])=>n>0));
}
export function runEOH(game,d,r,dt,pull,capacity){
  const s=d.eoh;
  // Physical return EU uses the same battery input allowance as generator
  // charging in this simulation step. A full output box retains the balance.
  if(d.enabled&&BigInt(s.returnEU)>0n){
    let transfer=Math.floor(8*4**d.energyTier*64*20*dt);
    for(const b of endpointMembers(game,d.output)){
      if(!b.enabled||!b.batteries||game.catalog.machines[b.type]?.energy?.kind!=='battery'||b.energyTier<d.energyTier)continue;
      const n=Math.max(0,Math.floor(Math.min(transfer,capacity(b)-b.eu,game.batteryChargeBudget?.get(b.id)??0)));
      const credit=BigInt(n)>BigInt(s.returnEU)?Number(BigInt(s.returnEU)):n;
      b.eu+=credit;s.returnEU=(BigInt(s.returnEU)-BigInt(credit)).toString();transfer-=credit;
      game.batteryChargeBudget.set(b.id,(game.batteryChargeBudget.get(b.id)??0)-credit);
    }
  }
  if(!d.enabled){d.blocked='已暂停';return;}
  if(!r){d.blocked=BigInt(s.returnEU)>0n?'返还电量等待电池箱':'请选择维度配方';return;}
  if(!eohRuntime(d,r).valid){d.blocked='空间压缩场等级不足';return;}
  if(!d.job){
    const needed=eohCost(d,r),stored=BigInt(s.charge);
    if(stored<needed){
      d.eu+=pull();
      const n=BigInt(Math.floor(d.eu)),take=n<needed-stored?n:needed-stored;
      d.eu-=Number(take);s.charge=(stored+take).toString();d.blocked='预充电 '+s.charge+' / '+needed+' EU';
      if(BigInt(s.charge)<needed)return;
    }
    if(!game.hasTools(r)){d.blocked='需要对应维度显示方块';return;}
    if(!game.canPayInputs(d,r.inputs)){d.blocked='氢或氦不足，请检查输入容器';return;}
    if(!game.canStoreBatch(d,r)){d.blocked='请配置产物及失败补偿的输出容器';return;}
    if(s.resetPity){s.pity=r.eoh.chance-s.time*.0925+s.stability*.05;s.resetPity=false;}
    const chance=eohChance(d,r),success=game.nextDropRandom()*10000<Math.trunc(chance*10000),seconds=eohRuntime(d,r).seconds;
    s.charge=(BigInt(s.charge)-needed).toString();game.payInputs(d,r.inputs);
    d.job={duration:seconds,remaining:seconds,outputs:outcome(d,r,success,chance),eoh:{paid:needed.toString(),success,chance,refund:refundFor(d,r)}};
  }
  d.job.remaining=Math.max(0,d.job.remaining-dt);d.blocked='运行中';
  if(d.job.remaining>1e-8)return;
  const result=d.job.eoh;
  if(!game.finish(r,d)){d.blocked='等待产物输出容器空间';return;}
  s.returnEU=(BigInt(s.returnEU)+BigInt(result.refund)).toString();
  if(result.success){s.resetPity=true;s.pity=0;}
  else {s.pity=s.previous===result.chance?s.pity+(1-result.chance)*result.chance:result.chance;s.resetPity=false;}
  s.previous=result.chance;d.job=null;
}
export function changeEOH(game,id,action,value){
  const d=game.state.devices.find(d=>d.id===id);if(!d||!isEOH(game,d))return {ok:false,message:'请逐台配置和谐之眼'};
  if(d.job)return {ok:false,message:'请先结束当前演化批次'};
  if(action==='circuit'&&Number.isInteger(value)&&value>=0&&value<=24){d.eoh.circuit=value;return {ok:true};}
  if(H.fields[action]&&Number.isInteger(value)&&value>=0&&value<=8){
    const f=H.fields[action],old=d.eoh[action];if(old===value)return {ok:true};
    if(!game.pay({[f.items[value]]:f.count}))return {ok:false,message:'更换场发生器的材料不足'};
    game.add({[f.items[old]]:f.count},false);d.eoh[action]=value;return {ok:true};
  }
  return {ok:false,message:'场发生器等级无效'};
}
export function validEOH(game,d,r){
  const s=d.eoh;if(s===undefined)return !isEOH(game,d)||!d.job;
  if(!isEOH(game,d)||!s||!unsigned(s.charge)||!unsigned(s.returnEU)||['time','space','stability','circuit'].some(key=>!Number.isInteger(s[key])||s[key]<0||s[key]>(key==='circuit'?24:8))||typeof s.resetPity!=='boolean'||!Number.isFinite(s.pity)||s.pity< -1||s.pity>2||!Number.isFinite(s.previous)||s.previous<0||s.previous>1)return false;
  if(!d.job)return true;
  const j=d.job.eoh;
  if(!r?.eoh||!j||!unsigned(j.paid)||BigInt(j.paid)!==eohCost(d,r)||typeof j.success!=='boolean'||!Number.isFinite(j.chance)||j.chance!==eohChance(d,r)||j.success&&Math.trunc(j.chance*10000)===0||!j.success&&j.chance===1||!unsigned(j.refund)||j.refund!==refundFor(d,r)||d.job.duration!==eohRuntime(d,r).seconds)return false;
  const expected=outcome(d,r,j.success,j.chance);
  return Object.keys(d.job.outputs??{}).length===Object.keys(expected).length&&Object.entries(expected).every(([id,n])=>n===(d.job.outputs??{})[id]);
}
export function eohRefund(d){
  const cost={};for(const [key,f]of Object.entries(H.fields)){cost[f.items[0]]=(cost[f.items[0]]??0)-f.count;cost[f.items[d.eoh[key]]]=(cost[f.items[d.eoh[key]]]??0)+f.count;}return cost;
}
