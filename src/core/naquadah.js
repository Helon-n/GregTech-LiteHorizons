import {NAQUADAH_REFERENCE as R} from '../data/naquadah-reference.js';

const scale=(stacks,n)=>Object.fromEntries(Object.entries(stacks).map(([id,count])=>[id,count*n]));
const enough=(game,d,[id,n])=>game.inputQuantity(id,d.fluidInputs[id])>=n;
export const naquadahFluids=(game,d)=>game.catalog.machines[d.type]?.energy?.cycle==='naquadah'?[R.air[0],...R.coolants.map(a=>a[0]),...R.exciters.map(a=>a[0])]:[];
export function naquadahRecipe(game,d,r){
  if(!r?.largeNaquadah)return r;
  const index=R.exciters.findIndex(row=>enough(game,d,row));
  const n=d.job?.naquadah?.multiplier??(index<0?1:R.exciters[index][2]);
  return {...r,inputs:scale(r.inputs,n),outputs:scale(r.outputs,n)};
}

export function runNaquadah(game,d,dt,limit){
  const r=game.recipeById.get(d.recipe);
  if(!d.enabled||!r){d.blocked=d.enabled?'请选择燃料配方':'已停止';return;}
  let left=dt;
  while(left>1e-8&&d.enabled&&d.recipe===r.id){
    if(d.job&&d.job.remaining<=1e-8){if(!game.finish(r,d)){d.blocked='乏燃料输出容器已满';return;}d.job=null;}
    if(!d.enabled||d.recipe!==r.id)return;
    if(!d.job){
      const excited=R.exciters.findIndex(row=>enough(game,d,row)),multiplier=excited<0?1:R.exciters[excited][2];
      const batch={...r,inputs:scale(r.inputs,multiplier),outputs:scale(r.outputs,multiplier)};
      if(!game.canPayInputs(d,batch.inputs)){d.blocked='液态核燃料不足';return;}
      if(!game.canStoreBatch(d,batch)){d.blocked='乏燃料需要输出容器';return;}
      game.payInputs(d,batch.inputs);
      d.job={duration:r.seconds,remaining:r.seconds,outputs:batch.outputs,naquadah:{excited,multiplier,clock:0,power:0,efficiency:100}};
    }
    const s=d.job.naquadah;
    if(s.clock<=1e-8){
      s.clock=1;s.power=0;s.efficiency=0;
      if(!R.air[1]||game.payInputs(d,{[R.air[0]]:R.air[1]})){
        const coolant=R.coolants.find(row=>enough(game,d,row));
        const efficiency=coolant?coolant[2]:100;
        if(coolant)game.payInputs(d,{[coolant[0]]:coolant[1]});
        const exciter=s.excited<0?null:R.exciters[s.excited];
        const factor=exciter&&game.payInputs(d,{[exciter[0]]:exciter[1]})?s.multiplier:1;
        s.efficiency=efficiency;s.power=Math.trunc(r.generationPower*efficiency*factor/100);
      }
    }
    if(s.power>limit){d.blocked='输出功率超过 64 A 发电仓容量，请升级输出电压';return;}
    const used=Math.min(left,d.job.remaining,s.clock);
    // Like the source dynamo, a full buffer discards unaccepted energy;
    // it never becomes an implicit battery or delays fuel burn-down.
    d.eu=Math.min(limit*80+512,d.eu+s.power*20*used);
    d.job.remaining=Math.max(0,d.job.remaining-used);s.clock=Math.max(0,s.clock-used);left-=used;
    d.blocked=s.power?'运行中':'液态空气不足，本秒无输出';
    if(d.job.remaining<=1e-8){if(!game.finish(r,d)){d.blocked='乏燃料输出容器已满';return;}d.job=null;}
  }
}

export function validNaquadah(game,d,r){
  const s=d.job?.naquadah;
  if(!s)return !d.job||!r?.largeNaquadah;
  if(game.catalog.machines[d.type]?.energy?.cycle!=='naquadah'||!r?.largeNaquadah||!Number.isInteger(s.excited)||s.excited< -1||s.excited>=R.exciters.length||s.multiplier!==(s.excited<0?1:R.exciters[s.excited][2])||!Number.isFinite(s.clock)||s.clock<0||s.clock>1||!Number.isSafeInteger(s.power)||s.power<0||s.power>R.maxPower||!Number.isSafeInteger(s.efficiency)||![0,100,...R.coolants.map(a=>a[2])].includes(s.efficiency))return false;
  const expected=scale(r.outputs,s.multiplier);
  return Object.keys(expected).length===Object.keys(d.job.outputs??{}).length&&Object.entries(expected).every(([id,n])=>d.job.outputs[id]===n);
}
