// MTEThermalBoiler: 20-tick batches, 12 efficiency points per tick and
// ceiling-rounded water consumption. Dry-heat explosions become an interlock.
// Paid fuel, water and random byproducts survive pause/save without a reroll.
import {rollOutputs,validBatchOutputs} from './recipe-yields.js';
import {takeComponent,componentCount} from './components.js';

export function thermalSteam(game,d){return d.thermalBoiler?.steam??game.recipeById.get(d.recipe)?.thermalBoiler?.steam??'steam';}
export function runThermalBoiler(game,d,dt,B,pullWater){
  d.thermalBoiler??={efficiency:0,remaining:0,steam:'steam',outputs:{}};
  const s=d.thermalBoiler,r=game.recipeById.get(d.recipe);
  if(!d.enabled||!r?.thermalBoiler){d.blocked=d.enabled?'请选择热流体':'已停止';return;}
  d.water+=pullWater(Math.max(0,B.waterCapacity-d.water));
  let ticks=dt*20;
  while(ticks>1e-8){
    if(s.remaining<=1e-8){
      if(Object.keys(s.outputs).length){
        if(!game.add(s.outputs,true,d.fluidOutputs)){d.blocked='冷却流体输出容器空间不足';return;}
        s.outputs={};
      }
      const spec=r.thermalBoiler;
      if(d.steam>0&&s.steam!==spec.steam){d.blocked='请先排出原有蒸汽';return;}
      const steam=Math.max(1,Math.trunc(spec.amount*s.efficiency/10000)),water=Math.ceil(steam/160);
      if(d.steam+steam>B.steamCapacity){d.blocked='蒸汽缓冲已满，等待输出';return;}
      const inputs=Object.fromEntries(Object.entries(r.inputs).filter(([id])=>!['water','distilledWater'].includes(id)));
      const outputs=Object.fromEntries(Object.entries(r.outputs).filter(([id])=>id!==spec.steam));
      if(d.water<water){d.blocked='水不足，热力锅炉已暂停';return;}
      if(!game.canPayInputs(d,inputs)){d.blocked='等待热流体';return;}
      if(!game.canStoreBatch(d,{inputs,outputs})){d.blocked='冷却流体输出容器空间不足';return;}
      if(!game.payInputs(d,inputs)){d.blocked='等待热流体';return;}
      d.water-=water;s.steam=spec.steam;s.remaining=20;
      if(!d.thermalFilter?.life&&(game.quantity('lavaFilter')+componentCount(game,'lavaFilter')>0))d.thermalFilter=takeComponent(game,'lavaFilter','lavaFilter');
      s.outputs=rollOutputs(game,r);delete s.outputs[spec.steam];
      if(!d.thermalFilter?.life)for(const id of Object.keys(s.outputs))if(game.catalog.items[id].kind!=='fluid'&&id!=='obsidian')delete s.outputs[id];
      if(Object.keys(r.outputs).some(id=>game.catalog.items[id].kind!=='fluid')&&d.thermalFilter?.life&&game.nextDropRandom()<1/30)d.thermalFilter.life--;
      s.producedSteam=steam;
    }
    const used=Math.min(ticks,s.remaining);ticks-=used;s.remaining=Math.max(0,s.remaining-used);
    if(s.remaining<=1e-8){
      const steam=s.producedSteam??0;d.steam+=steam;s.producedSteam=0;
      game.state.earned[s.steam]=(game.state.earned[s.steam]??0)+steam;game.state.produced+=steam;
      s.efficiency=Math.min(10000,s.efficiency+240);
      // Retain paid outputs if the chosen destination filled during the cycle.
      if(!game.add(s.outputs,true,d.fluidOutputs)){d.blocked='冷却流体输出容器空间不足';return;}
      s.outputs={};
    }
    d.blocked=s.efficiency<10000?'热力锅炉升温中':'运行中';
  }
}
export function validThermalCycle(game,d,r){
  const s=d.thermalBoiler;
  if(!s||typeof s!=='object'||Array.isArray(s)||!Number.isInteger(s.efficiency)||s.efficiency<0||s.efficiency>10000||!Number.isFinite(s.remaining)||s.remaining<0||s.remaining>20||!['steam','superheatedSteam'].includes(s.steam))return false;
  if(!Number.isInteger(s.producedSteam??0)||(s.producedSteam??0)<0||(s.producedSteam??0)>(r?.thermalBoiler?.amount??0))return false;
  if(!s.outputs||Array.isArray(s.outputs)||typeof s.outputs!=='object')return false;
  if(!r?.thermalBoiler)return s.remaining===0&&!s.producedSteam&&!Object.keys(s.outputs).length;
  const outputs={...s.outputs,[r.thermalBoiler.steam]:r.thermalBoiler.amount};
  // A missing filter may suppress any solid except obsidian. Check those slots
  // separately instead of permitting arbitrary saved quantities or fluid IDs.
  const optional=Object.keys(r.outputs).filter(id=>game.catalog.items[id].kind!=='fluid'&&id!=='obsidian');
  const adjusted={...r,outputRolls:(r.outputRolls??Object.entries(r.outputs).map(([id,count])=>({id,count,chance:10000}))).map(slot=>optional.includes(slot.id)?{...slot,chance:slot.chance===0?0:9999}:slot)};
  return !Object.keys(s.outputs).length||validBatchOutputs(adjusted,outputs);
}
