import {SMELTERY_REFERENCE as S} from '../data/smeltery-reference.js';

const EPS=1e-8;
export const smelteryFluids=(game,d)=>game.catalog.machines[d.type]?.energy?.cycle==='smeltery'?S.fuels.map(f=>f.id):[];
export function initializeSmeltery(d){d.smeltery??={fraction:0,useTime:0,temperature:20,fuel:null};}

function refuel(game,d,r){
  const s=d.smeltery;
  // Selecting a sufficient connected fuel avoids burning a cooler fluid
  // indefinitely. The original fuel power and integer refill math remain.
  const f=S.fuels.find(f=>f.temperature>=r.smeltery.temperature&&game.inputQuantity(f.id,d.fluidInputs[f.id])>=1);
  if(!f)return false;
  const amount=Math.min(S.fuelTankCapacity,Math.floor(game.inputQuantity(f.id,d.fluidInputs[f.id])));
  if(!game.payInputs(d,{[f.id]:amount}))return false;
  const whole=Math.floor(amount/15),rest=amount%15;
  s.useTime=whole*f.ticks+(rest?f.ticks*Math.round(15/rest):0);
  s.temperature=f.temperature;s.fuel=f.id;return s.useTime>0;
}

export function runSmeltery(game,d,r,dt){
  initializeSmeltery(d);const s=d.smeltery;
  s.fraction+=dt*20;const ticks=Math.floor((s.fraction+EPS)/4);s.fraction=Math.max(0,s.fraction-ticks*4);
  for(let i=0;i<ticks;i++){
    // Burning fuel continues to run down while paused; closing the app does
    // not invoke this function or advance the clock.
    s.useTime=Math.max(0,s.useTime-4);
    if(!d.enabled){d.blocked=d.recipe?'已暂停':'已停止';continue;}
    if(!r?.smeltery){d.blocked='请选择熔炼配方';continue;}
    if(d.job?.remaining<=EPS){
      if(!game.finish(r,d)){d.blocked='熔融产物需要输出容器';continue;}
      d.job=null;
      if(!d.enabled||d.recipe!==r.id)return;
    }
    if(!d.job){
      if(!game.canPayInputs(d,r.inputs)){d.blocked='缺少熔炼原料';continue;}
      if(!game.canStoreBatch(d,r)){d.blocked='熔融产物需要输出容器';continue;}
      if(s.useTime<=0&&!refuel(game,d,r)){d.blocked='缺少温度足够的液体燃料';continue;}
      game.payInputs(d,r.inputs);
      d.job={duration:r.seconds,remaining:r.seconds,outputs:{...r.outputs},smelteryTemperature:200};
    }
    if(s.useTime<=0&&!refuel(game,d,r)){d.blocked='缺少温度足够的液体燃料';continue;}
    const job=d.job,required=r.smeltery.temperature*10;
    if(job.smelteryTemperature>=required){
      job.remaining=0;
      if(game.finish(r,d)){
        d.job=null;
        if(!d.enabled||d.recipe!==r.id)return;
      }else d.blocked='熔融产物需要输出容器';
    }else if(job.smelteryTemperature<s.temperature*10){
      const speed=Math.floor(s.temperature/100);
      job.smelteryTemperature+=speed;
      job.remaining=Math.max(.2,Math.min(job.duration,(Math.ceil(Math.max(0,required-job.smelteryTemperature)/speed)+1)*.2));
      d.blocked='运行中';
    }else d.blocked='当前燃料温度不足';
  }
}

export function validSmeltery(game,d,r){
  const s=d.smeltery,enabled=game.catalog.machines[d.type]?.energy?.cycle==='smeltery';
  if(!enabled)return s===undefined&&d.job?.smelteryTemperature===undefined;
  if(s===undefined)return !d.job;
  if(!s||typeof s!=='object'||Array.isArray(s)||!Number.isFinite(s.fraction)||s.fraction<0||s.fraction>=4+EPS||!Number.isInteger(s.useTime)||s.useTime<0||s.useTime>Math.ceil(S.fuelTankCapacity/15)*15*Math.max(...S.fuels.map(f=>f.ticks)))return false;
  if(s.fuel===null?(s.useTime!==0||s.temperature!==20):!S.fuels.some(f=>f.id===s.fuel&&f.temperature===s.temperature))return false;
  return !d.job||!!r?.smeltery&&Number.isInteger(d.job.smelteryTemperature)&&d.job.smelteryTemperature>=200&&d.job.smelteryTemperature<=r.smeltery.temperature*10+Math.floor(Math.max(...S.fuels.map(f=>f.temperature))/100);
}
