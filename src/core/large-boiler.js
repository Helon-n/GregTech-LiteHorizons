import {LARGE_BOILERS,largeBoilerBurnTicks} from '../data/large-energy-reference.js';
import {SOLID_FUELS} from '../data/industry-catalog.js';
import {devicePeers} from './groups.js';

export function initializeLargeBoiler(d){
  d.largeBoiler??={efficiency:0,fraction:0,solidTicks:0,fluidTicks:0,solidCircuit:0,fluidCircuit:0,excessEU:0,excessWater:0,excessSteam:0,increase:0,burnDecrease:2};
  d.largeBoiler.excessFuel??=0;
}

// One tick clock preserves integer burn-time, water and throttle remainders.
// Dry-boiler explosions and hatch overflow are replaced by a production interlock.
export function runLargeBoiler(game,d,dt,B,pullWater){
  initializeLargeBoiler(d);const s=d.largeBoiler,profile=LARGE_BOILERS[B.large];
  if(!d.enabled||!d.recipe){d.blocked='已停止';return;}
  const r=game.recipeById.get(d.recipe);
  if(!r){d.blocked='请选择燃料';return;}
  d.water+=pullWater(B.waterCapacity-d.water);
  s.fraction+=dt*20;const ticks=Math.floor(s.fraction+1e-8);s.fraction=Math.max(0,s.fraction-ticks);
  const superheated=profile.steam!=='steam';
  function ignite(raw,isFluid){
    const safe=Math.max(1,Math.trunc(raw*profile.boost[0]/profile.boost[1]));
    const circuit=d.boilerCircuit??0;
    s[isFluid?'fluidCircuit':'solidCircuit']=circuit;
    const eut=Math.max(25,profile.eut-(superheated?75:25)*Math.max(s.solidCircuit,s.fluidCircuit));
    let adjusted=Math.trunc(safe*profile.eut/eut);
    s.excessEU+=profile.eut*safe-eut*adjusted;
    adjusted+=Math.trunc(s.excessEU/eut);s.excessEU%=eut;
    s[isFluid?'fluidTicks':'solidTicks']=adjusted*2;
    s.increase=safe*profile.increase>5000?20:Math.max(1,profile.increase);
  }
  for(let t=0;t<ticks;t++){
    // Original processing checks the liquid channel before the solid channel.
    if(!s.fluidTicks&&r.boilerFuel&&game.canPayInputs(d,{[r.boilerFuel]:1000})){
      game.payInputs(d,{[r.boilerFuel]:1000});ignite(r.boilerBurnTicks,true);
    }else if(!s.solidTicks&&(!superheated||SOLID_FUELS[d.solidFuel]?.highTier)){
      const donor=devicePeers(game,d.id).filter(x=>x.coal>0&&x.solidFuel===d.solidFuel).sort((a,b)=>b.coal-a.coal)[0];
      const fuel=SOLID_FUELS[d.solidFuel],value=fuel?.heat*10;
      if(donor&&Math.trunc(value*2/profile.eut)>1){
        donor.coal--;s.excessFuel+=value%80;
        const burn=Math.trunc(value/80)+Math.trunc(s.excessFuel/80);s.excessFuel%=80;
        ignite(largeBoilerBurnTicks(burn/20),false);
      }
    }
    if(!s.fluidTicks&&!s.solidTicks){s.efficiency=Math.max(0,s.efficiency-1);d.blocked='等待燃料';continue;}
    const target=s.burnDecrease===1?12500:10000;
    const efficiency=s.efficiency<target?Math.min(target,s.efficiency+Math.max(1,s.increase)):Math.max(target,s.efficiency-1);
    const eut=Math.max(25,profile.eut-(superheated?75:25)*Math.max(s.solidCircuit,s.fluidCircuit));
    const equivalent=Math.trunc(eut*2*efficiency/10000),denominator=superheated?480:160;
    const water=Math.trunc((equivalent+s.excessWater)/denominator);
    const steam=superheated?Math.trunc((equivalent+s.excessSteam)/3):equivalent;
    if(d.water<Math.max(1,water)){d.blocked='缺水，产汽已暂停';continue;}
    s.efficiency=efficiency;s.excessWater=(equivalent+s.excessWater)%denominator;
    if(superheated)s.excessSteam=(equivalent+s.excessSteam)%3;
    // Keep this step's production available to direct consumers before the
    // logical output buffer is capped; a 0.5 s update must not limit EU/t.
    d.water-=water;d.steam+=steam;
    if(equivalent>0){
      s.burnDecrease=s.solidTicks&&s.fluidTicks?1:2;
      s.solidTicks=Math.max(0,s.solidTicks-s.burnDecrease);s.fluidTicks=Math.max(0,s.fluidTicks-s.burnDecrease);
      if(!s.solidTicks)s.solidCircuit=0;if(!s.fluidTicks)s.fluidCircuit=0;
    }
    // MTEMultiBlockBase adds mEfficiencyIncrease after each one-tick recipe.
    s.efficiency=Math.min(s.efficiency+1,s.burnDecrease===1?12500:10000);
    game.state.earned[profile.steam]=(game.state.earned[profile.steam]??0)+steam;game.state.produced+=steam;
    d.blocked=efficiency<10000?'锅炉升温中':s.burnDecrease===1?'双燃料运行中':'运行中';
  }
}
