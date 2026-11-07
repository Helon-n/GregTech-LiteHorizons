// Binnie IncubatorComponentLogic: each powered tick has a 1/20 task
// probability; a successful task independently rolls catalyst loss.
export function runIncubator(game,d,r,dt,pull){
  if(!d.enabled||!r?.incubation){d.blocked=d.enabled?'请选择培养配方':'已暂停';return;}
  d.eu+=pull();d.incubatorClock=(d.incubatorClock??0)+dt;
  while(d.incubatorClock>=.05-1e-9){
    if(!d.enabled||d.recipe!==r.id){d.incubatorClock=0;return;}
    d.incubatorClock=Math.max(0,d.incubatorClock-.05);
    const q=r.incubation;
    if(!game.hasTools(r)){d.blocked='缺少培养原料';continue;}
    if(game.inputQuantity(q.seedFluid,d.fluidInputs[q.seedFluid])<Math.max(1,r.inputs[q.seedFluid]??0)||!game.canPayInputs(d,r.inputs)){d.blocked='培养液不足，请检查输入容器';continue;}
    if(!game.canStoreBatch(d,r)){d.blocked='培养液输出容器空间不足';continue;}
    if(d.eu+1e-9<r.power){d.blocked='培养箱缺电';continue;}
    d.eu=Math.max(0,d.eu-r.power);d.blocked='运行中';
    if(game.nextDropRandom()>=q.taskChance)continue;
    if(!game.payInputs(d,r.inputs))continue;
    if(!game.finish(r,d))return;
    if(game.nextDropRandom()<q.lossChance)game.pay({[q.catalyst]:1});
  }
}
