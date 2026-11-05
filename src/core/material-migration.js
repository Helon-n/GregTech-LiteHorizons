import {MATERIAL_PROCESSING} from '../data/material-processing.js';

// Retired routes must not reject an entire world or finish with changed yields.
// Refund paid material for cancelled batches; already spent energy is not restored.
export function migrateMaterialRecipes(saved,catalog){
  if(!catalog.materialRulesVersion||(saved.materialRulesVersion??0)>=catalog.materialRulesVersion)return saved;
  const raw=JSON.parse(JSON.stringify(saved));
  if(!raw.inventory||!Array.isArray(raw.devices)||!Array.isArray(raw.queue))return raw;
  const recipeById=new Map(catalog.recipes.map(r=>[r.id,r]));
  let cancelled=0;
  const oldRoute=id=>{
    if(id==='steelRodEarly')return {material:'steel',form:'RodHand',replacement:'steelRodHand',seconds:6};
    for(const material of Object.keys(MATERIAL_PROCESSING))for(const form of ['PlateHand','RodHand','WireHand','Plate','Wire']){
      if(id===material+form)return {material,form,replacement:id,seconds:['Plate','Wire'].includes(form)?3:4};
    }
    return null;
  };
  const refund=(route,count)=>{
    const key=route.material+(route.form==='WireHand'?'Plate':'');
    const amount=(route.form==='PlateHand'?2:1)*count;
    raw.inventory[key]=(raw.inventory[key]||0)+amount;cancelled++;
  };
  raw.queue=raw.queue.filter(q=>{
    if(!q||!Number.isInteger(q.amount)||q.amount<1||q.amount>10||!Number.isFinite(q.remaining)||q.remaining<0)throw Error('旧存档队列无效');
    const route=oldRoute(q.recipe);if(!route)return true;
    const r=recipeById.get(route.replacement);
    if(!r||route.form==='WireHand'){refund(route,q.amount);return false;}
    q.recipe=r.id;q.remaining=Math.min(r.seconds,q.remaining/route.seconds*r.seconds);return true;
  });
  for(const d of raw.devices){
    if(!d)throw Error('旧存档设备无效');
    const route=oldRoute(d.recipe);if(!route)continue;
    if(d.job&&(!Number.isFinite(d.job.remaining)||d.job.remaining<0||raw.schema===4&&(!Number.isFinite(d.job.duration)||d.job.duration<=0||d.job.remaining>d.job.duration)))throw Error('旧存档生产批次无效');
    const r=recipeById.get(route.replacement),compatible=r&&catalog.machines[d.type]?.processes.includes(r.process);
    if(!compatible||route.form==='WireHand'){
      if(d.job)refund(route,1);
      d.job=null;d.recipe=compatible?r.id:null;d.blocked=d.recipe?'就绪':'请选择配方';
    }else{
      d.recipe=r.id;
      if(d.job){
        const fraction=d.job.remaining/(d.job.duration||route.seconds);
        // Restart the paid batch at its new base duration; voltage overclocking
        // applies to subsequent batches. Keep completed output blocked at zero.
        d.job={remaining:Math.max(0,Math.min(1,fraction))*r.seconds,duration:r.seconds};
      }
    }
  }
  raw.materialRulesVersion=catalog.materialRulesVersion;
  if(Array.isArray(raw.log))raw.log.unshift({at:raw.playtime,text:'材料加工已更新：板使用锻造锤或卷板机，杆使用锉刀或车床，导线使用剪线钳或线材轧机。'+(cancelled?'已取消旧路线的未完成批次并退还原料。':'')});
  return raw;
}
