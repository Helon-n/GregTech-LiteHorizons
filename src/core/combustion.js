import {COMBUSTION as C} from '../data/large-energy-reference.js';

// MTELargeCombustionEngine uses the preceding boost state for fuel quantity,
// then samples oxygen for the next tick. Fuel and oil are charged per tick.
export function runCombustion(game,d,dt){
  d.combustion??={fraction:0,efficiency:0,runtime:0,boosted:false};
  const s=d.combustion,r=game.recipeById.get(d.recipe);
  if(!d.enabled||!r){d.blocked=d.enabled?'请选择燃料':'已停止';return;}
  const fuel=game.catalog.fuels.find(f=>f.family==='Diesel'&&f.id===r.fuel);
  if(!fuel?.eu){d.blocked='燃料与机型不兼容';return;}
  s.fraction+=dt*20;const ticks=Math.floor(s.fraction+1e-8);s.fraction=Math.max(0,s.fraction-ticks);
  for(let t=0;t<ticks;t++){
    let n=Math.trunc(C.nominal*(s.boosted?C.boostFactor:1)/fuel.eu);
    if(s.boosted){
      const value=Math.trunc(fuel.eu*1.5);
      if(value*2>C.nominal*3){const ratio=C.nominal*3/value;if(game.nextDropRandom()<ratio-Math.trunc(ratio))n++;}
    }
    if(!game.payInputs(d,{[fuel.id]:n})){s.efficiency=0;d.blocked='燃料不足';continue;}
    s.boosted=game.payInputs(d,{oxygen:C.oxygenPerTick});
    if(!s.boosted&&fuel.eu>C.nominal){s.efficiency=0;d.blocked='高热值燃料需要氧气增压';continue;}
    if(s.runtime%C.lubricantPeriod===0&&!game.payInputs(d,{lubricant:s.boosted?2:1})){
      s.efficiency=0;d.blocked='润滑油不足';continue;
    }
    const generated=s.efficiency<C.minimumEfficiency?0:Math.trunc(C.nominal*s.efficiency/10000);
    d.eu+=generated;
    s.efficiency=Math.min(s.efficiency+C.efficiencyIncrease,s.boosted?C.boostEfficiency:C.normalEfficiency);
    // Base multiblock maintenance clock resets after the 1001st count.
    s.runtime=s.runtime>1000?0:s.runtime+1;
    d.blocked=s.efficiency<C.minimumEfficiency?'内燃机启动中':s.boosted?'氧气增压运行中':'运行中';
  }
}
