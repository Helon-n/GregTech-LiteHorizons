import {rollOutputs} from './recipe-yields.js';

// MTENuclearReactor: efficiency rises by 2 per tick to 10000. At full
// efficiency the processing logic generates LFTR_OUTPUT_POWER * 4 EU/t.
export const LFTR=Object.freeze({warmupSeconds:250,bonusChanceTicks:300});

export function runReactor(game,d,dt){
  const r=game.recipeById.get(d.recipe);
  if(!d.enabled||!r){d.blocked=d.enabled?'请选择燃料配方':'已停止';return;}
  let left=dt;
  if(d.reactorWarmup<LFTR.warmupSeconds){
    const used=Math.min(left,LFTR.warmupSeconds-d.reactorWarmup);
    d.reactorWarmup+=used;left-=used;d.blocked='反应堆预热中';
  }
  while(left>1e-8&&d.enabled&&d.recipe===r.id){
    if(d.job&&d.job.remaining<=1e-8){
      if(!game.finish(r,d)){d.blocked='后处理产物容器已满';return;}
      d.job=null;if(!d.enabled||d.recipe!==r.id)return;
    }
    if(!d.job){
      if(!game.canPayInputs(d,r.inputs)){
        d.reactorWarmup=0;d.blocked='熔盐燃料或载盐不足，需重新预热';return;
      }
      if(!game.canStoreBatch(d,r)){d.blocked='后处理产物需要输出容器';return;}
      game.payInputs(d,r.inputs);
      d.job={duration:r.seconds,remaining:r.seconds,outputs:rollOutputs(game,r)};
    }
    const used=Math.min(left,d.job.remaining);
    d.eu+=r.generationPower*20*used;
    d.reactorTicks+=used*20;const ticks=Math.floor(d.reactorTicks+1e-8);d.reactorTicks=Math.max(0,d.reactorTicks-ticks);
    // Each original tick independently rolls U-233. Full output containers
    // cannot turn this bonus into loose fluid in the item warehouse.
    for(let i=0;i<ticks;i++)if(game.nextDropRandom()*LFTR.bonusChanceTicks<1){
      const n=1+Math.floor(game.nextDropRandom()*10);
      game.add({[r.reactorBonus]:n},true,d.fluidOutputs);
    }
    d.job.remaining=Math.max(0,d.job.remaining-used);left-=used;d.blocked='运行中';
    if(d.job.remaining<=1e-8){
      if(!game.finish(r,d)){d.blocked='后处理产物容器已满';return;}
      d.job=null;
    }
  }
}
