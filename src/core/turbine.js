// GT5 5.09.54.265: MTELargeTurbine{Base,Steam,HPSteam,SCSteam,Gas,Plasma}
// and TurbineStatCalculator. The dynamo voltage is selected by machine upgrade.
const integer=n=>Math.max(0,Math.min(2147483646,Math.trunc(n)));
import {takeComponent} from './components.js';
export function turbineStats(game,d,r){
  const rotor=game.catalog.items[d.rotor?.item]?.rotor;
  if(!rotor)return null;
  const kind=r.turbineKind,steam=['steam','superheated','supercritical'].includes(kind),plasma=kind==='plasma';
  const base=rotor.efficiency,loose=-.2+Math.floor(base*85+.5)*.01;
  let flow=rotor.flow*(steam?rotor.steam:plasma?rotor.plasma*42:rotor.gas);
  let efficiency=base;
  if(d.looseFit){
    flow*=steam?3*1.1**((base-.8)*20):plasma?2*1.03**((base-.8)*20):2*1.05**((base-.8)*20);
    efficiency=loose*(steam?.9:plasma?1:.95);
  }
  const overflow=1+Math.min(2,Math.trunc(rotor.quality/3));
  const fuel=steam?0:game.catalog.fuels.find(f=>f.id===r.turbineFuel&&f.family===(plasma?'Plasma':'Gas'))?.eu??0;
  const weak=kind==='gas'&&rotor.flow*rotor.gas*base<fuel;
  const optimum=r.xlTurbine?weak?1:steam?flow*16:integer(flow*(plasma?320:16)/fuel):steam?flow:weak?1:plasma?Math.ceil(flow*20/fuel):integer(flow/fuel);
  const max=integer(optimum*(r.xlTurbine?1.25:kind==='supercritical'?1.25:steam?.5*overflow+1:plasma?1.5*overflow+1:1.5*overflow));
  return {kind,flow:optimum,maximum:max,efficiency,overflow,fuel,weak,weakPower:rotor.flow*rotor.gas*base,plasmaEU:rotor.flow*rotor.plasma*42*base};
}
export function runTurbine(game,d,dt,pull,available,limit){
  d.turbine??={fraction:0,power:0,efficiency:0,runtime:0,water:0,cycle:0,flow:0};
  const s=d.turbine,r=game.recipeById.get(d.recipe);
  if(!d.enabled||!r){d.blocked=d.enabled?'请选择燃料':'已停止';return;}
  if(r.xlTurbine&&d.rotor?.lives){
    for(let i=0;i<12;i++)if(d.rotor.lives[i]<=0){const replacement=takeComponent(game,d.rotor.item,'rotor');if(replacement)d.rotor.lives[i]=replacement.life;}
    d.rotor.life=Math.min(...d.rotor.lives);
  }
  if(!d.rotor?.life){s.power=0;s.efficiency=0;d.blocked='请装入可用转子';return;}
  const stat=turbineStats(game,d,r);if(!stat||!stat.flow){d.blocked='转子与燃料不兼容';return;}
  const plasma=stat.kind==='plasma',period=plasma?20:1;
  s.fraction+=dt*20;const ticks=Math.floor(s.fraction+1e-8);s.fraction=Math.max(0,s.fraction-ticks);
  for(let t=0;t<ticks;t++){
    if(!d.rotor?.life){s.power=0;s.efficiency=0;d.blocked='转子已耗尽';break;}
    if(s.cycle===0){
      const scale=r.denseSteam?1000:1;
      const amount=Math.min(Math.floor(available()),Math.ceil(stat.maximum/scale));
      const effective=n=>Math.min(stat.maximum,n*scale);
      const water=n=>r.xlTurbine?Math.fround(Math.fround(effective(n))/Math.fround(r.denseSteam?160.1:160)):n/160;
      const outputs=n=>r.turbineExhaust?{[r.turbineExhaust]:stat.kind==='steam'?r.xlTurbine?Math.floor(s.water+water(n)):Math.floor((s.water+n)/160):n}:{};
      // Output interlocks replace GT's optional voiding. Never consume fuel
      // while the selected exhaust tank has insufficient free capacity.
      if(!game.canStore(outputs(amount),{},d.fluidOutputs)){s.power=0;d.blocked='排气或冷凝水容器空间不足';return;}
      const consumed=amount>0?pull(amount):0;
      if(consumed>0){game.add(outputs(consumed),true,d.fluidOutputs);if(stat.kind==='steam')s.water=r.xlTurbine?Math.fround(Math.fround(s.water+water(consumed))%1):(s.water+consumed)%160;}
      s.flow=consumed;
      let target=0;
      if(consumed>0){
        if(stat.weak)target=integer(stat.weakPower);
        else{
          const optimum=integer(stat.flow);
          const overflowDivisor=stat.kind==='steam'?stat.overflow+1:stat.kind==='superheated'?stat.overflow+2:stat.kind==='gas'?stat.overflow*3-1:stat.overflow*3+1;
          const used=effective(consumed);
          const correction=r.xlTurbine||stat.kind==='supercritical'?1-Math.abs((used-stat.flow)/stat.flow):used>optimum?1-(used-optimum)/(optimum*overflowDivisor):used/optimum;
          const raw=stat.kind==='gas'?consumed*stat.fuel:plasma?integer(consumed*stat.fuel/20):used;
          target=integer(integer(raw*correction)*stat.efficiency*(stat.kind==='steam'?.5:1));
          if(['steam','superheated','supercritical'].includes(stat.kind)&&consumed!==optimum)target=Math.max(1,target);
        }
      }
      // XL plasma fuel matching uses the tight rotor's EU/t, even in loose mode.
      if(plasma&&r.xlTurbine&&stat.plasmaEU>0){
        const v=Math.fround(stat.fuel*Math.fround(.005));
        const loss=Math.min(1,Math.fround(Math.fround(v*v)/Math.round(stat.plasmaEU)));
        target=integer(Math.fround(Math.fround(target)*loss));
      }
      target=Math.min(limit,target);
      const diff=target-s.power,change=plasma&&r.xlTurbine?Math.max(200,integer(Math.abs(diff)/5)):Math.max(10,integer(Math.abs(diff)/100));
      s.power=Math.abs(diff)>change?s.power+Math.sign(diff)*change:target;
      if(s.power<=0){s.power=0;s.efficiency=0;d.blocked='等待燃料';continue;}
      s.cycle=period;
    }
    d.eu+=integer(s.power*s.efficiency/10000);
    // Component damage follows MTEMultiBlockBase's 1002-tick runtime clock.
    if(s.runtime++>1000){
      s.runtime=0;
      if(r.xlTurbine){
        for(let i=0;i<12;i++)if(game.nextDropRandom()<.5){
          const wear=stat.kind==='gas'?game.nextDropRandom()<.25?0:1:['steam','superheated','supercritical'].includes(stat.kind)&&d.looseFit&&game.nextDropRandom()<.25?0:1;
          d.rotor.lives[i]=Math.max(0,d.rotor.lives[i]-wear*Math.trunc(Math.min(s.power/25,(s.power/5)**.6)));
        }
        d.rotor.life=Math.min(...d.rotor.lives);
      }else if(game.nextDropRandom()<.5){
        const damageFactor=stat.kind==='supercritical'?(d.looseFit?(game.nextDropRandom()<.5?0:1):2):['steam','superheated'].includes(stat.kind)&&d.looseFit?(game.nextDropRandom()<.25?0:1):1;
        d.rotor.life=Math.max(0,d.rotor.life-damageFactor*Math.trunc(Math.min(s.power/5,s.power**.6)));
      }
    }
    if(--s.cycle===0)s.efficiency=Math.min(10000,s.efficiency+(plasma?200:10));
    d.blocked=s.efficiency<10000?'涡轮加速中':s.flow>0?'运行中':'余速发电中';
  }
}
