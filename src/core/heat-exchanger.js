// MTEHeatExchanger, MTEAdvHeatExchanger and MTEExtremeHeatExchanger.
// Cold coolant is returned once when heat is loaded. The paid heat cycle and
// water remainder persist independently of pause, so it cannot be loaded twice.
export function runHeatExchanger(game,d,dt,B,pullWater){
  d.exchanger??={fraction:0,efficiency:0,remaining:0,power:0,steam:'steam',water:0};
  const s=d.exchanger,r=game.recipeById.get(d.recipe),x=r?.exchanger;
  if(!d.enabled||!x){d.blocked=d.enabled?'请选择热流体':'已停止';return;}
  d.water+=pullWater(Math.max(0,B.waterCapacity-d.water));
  s.fraction+=dt*20;const ticks=Math.floor(s.fraction+1e-8);s.fraction=Math.max(0,s.fraction-ticks);
  for(let t=0;t<ticks;t++){
    if(!s.remaining){
      const circuit=Math.max(0,(d.boilerCircuit??0)-1),efficiency=1-.015*circuit;
      const threshold=x.extreme?Math.max(1,x.threshold-150*circuit):Math.trunc((4000-150*circuit)*x.scale*x.threshold);
      const available=Math.floor(game.inputQuantity(x.hot,d.fluidInputs[x.hot]));
      const hot=Math.min(available,x.extreme?x.maxHot:threshold*2);
      if(hot<=0){d.blocked='等待热流体';continue;}
      const steam=hot>=threshold?x.heated:x.normal;
      if(steam!==s.steam&&d.steam>0){d.blocked='蒸汽类型将改变，请先用完或排出余汽';return;}
      const inputs={[x.hot]:hot},outputs={[x.cold]:hot};
      if(!game.canStoreBatch(d,{inputs,outputs})){d.blocked='冷却流体输出容器空间不足';return;}
      if(!game.payInputs(d,inputs)){d.blocked='等待热流体';return;}
      game.add(outputs,true,d.fluidOutputs);
      s.power=Math.max(0,Math.trunc(x.extreme?x.eut*efficiency*hot/x.maxHot:hot*20*x.multiplier*efficiency));
      s.remaining=20;s.steam=steam;
    }
    let steam,water,nextWater=s.water;
    if(x.extreme){
      const unit=s.steam==='steam'?.5:1;
      water=Math.trunc(Math.trunc(s.power/unit)/160);steam=Math.trunc(water*160/(x.plasma?1000:1));
    }else{
      steam=Math.trunc(s.power*2*s.efficiency/10000);
      if(s.steam===x.heated)steam=Math.trunc(steam/2);
      if(x.scale===32){water=Math.floor((s.water+steam)/160);nextWater=(s.water+steam)%160;}
      else{water=Math.max(0,Math.ceil((steam-s.water)/160));nextWater=s.water-steam+water*160;}
    }
    // Water hatches can supply a single extreme pulse larger than the idle
    // staging buffer. Draw the deficit atomically; no oversized buffer needed.
    if(d.water<water){
      const need=water-d.water,ports={...d,fluidInputs:{...d.fluidInputs,distilledWater:d.supply.source}};
      if(game.canPayInputs(ports,{distilledWater:need})&&game.payInputs(ports,{distilledWater:need}))d.water+=need;
    }
    if(d.water<water){d.blocked='蒸馏水不足，换热已暂停';return;}
    d.water-=water;s.water=nextWater;d.steam+=steam;
    game.state.earned[s.steam]=(game.state.earned[s.steam]??0)+steam;game.state.produced+=steam;
    if(--s.remaining===0)s.efficiency=Math.min(10000,s.efficiency+(x.extreme?160:80));
    d.blocked=!x.extreme&&s.efficiency<10000?'换热器升温中':'运行中';
  }
}
