import {findGroup,endpointId,endpointMembers,devicePeers,includesEndpoint,deviceEntries,fluidEntries,takeFluid,putFluid} from './groups.js';
import {ENERGY_REFERENCE as E} from '../data/energy-reference.js';

const EPS=1e-8;
export const energySpec=(game,d)=>game.catalog.machines[d.type]?.energy;
export const voltage=d=>E.voltage[d.energyTier];
export const batteryItem=d=>'battery'+E.codes[d.energyTier];
export function energyCapacity(game,d){
  if(d.group)return endpointMembers(game,d.id).reduce((n,d)=>n+energyCapacity(game,d),0);
  const spec=energySpec(game,d);if(!spec)return 0;
  if(spec.kind==='battery')return d.batteries?d.batteries*E.battery.capacity[d.energyTier]+voltage(d)*64*E.battery.slots:0;
  if(['generator','dyson'].includes(spec.kind))return voltage(d)*80+512;
  if(spec.fusion)return E.fusion.capacity*2**(d.energyTier-6)+3000*(d.energyTier-5);
  return spec.kind==='consumer'?voltage(d)*64:0;
}
export function initializeEnergy(game,d,reset=false){
  const spec=energySpec(game,d);
  if(reset)for(const key of ['energyTier','eu','steam','supply','output','batteries','temperature','heat','water','coal','thermalTick','thermalFraction','waterRemainder','generatorClock','fuel','modules','cycleRemaining','cyclePower','ignited','cooldownClock','startupTicks'])delete d[key];
  d.energyTier??=spec?.tier??0;d.eu??=0;d.steam??=0;
  d.supply??={mode:spec?.kind==='battery'?'direct':'storage',source:null};d.output??=null;d.batteries??=0;
  d.alias??='';d.fluidOutputs??={};
  d.temperature??=20;d.heat??=0;d.water??=0;d.coal??=0;
  d.thermalTick??=0;d.thermalFraction??=0;d.waterRemainder??=0;d.generatorClock??=0;
  d.fuel??=0;d.modules??=0;d.cycleRemaining??=0;d.cyclePower??=0;
  d.ignited??=false;d.cooldownClock??=0;d.startupTicks??=20;
}
export function runtime(game,d,r){
  if(!r)return {seconds:1,power:0,steamPerSecond:0,valid:true};
  const spec=energySpec(game,d);
  if(spec?.kind==='steam')return {seconds:r.seconds*E.steamMachine.durationMultiplier,power:r.power,steamPerSecond:r.power*20*E.steamMachine.steamPerEU,valid:r.power<=32};
  let power=r.power||0,seconds=r.seconds;
  if(spec?.kind==='consumer'){
    if(power>voltage(d))return {seconds,power,steamPerSecond:0,valid:false};
    // Standard GT overclock: four times EU/t, half duration; minimum one tick.
    // Special multiblock heat/laser/coil overclocks are outside the adapted recipe model.
    const recipeTier=power>0?Math.max(1,Math.ceil(Math.log(power/8)/Math.log(4))):d.energyTier;
    let overclocks=Math.max(0,d.energyTier-recipeTier),factor=4;
    if(spec.fusion&&r.startup){overclocks=Math.max(0,d.energyTier-6);factor=2;}
    while(overclocks-->0&&power>0&&power*factor<=voltage(d)&&seconds>.05){power*=factor;seconds/=2;}
    seconds=Math.ceil(seconds*20-1e-8)/20;
  }
  return {seconds:Math.max(.05,seconds),power,steamPerSecond:0,valid:true};
}
export function carrier(game,d){
  const spec=energySpec(game,d);
  return spec?.kind==='boiler'?'water':spec?.kind==='dyson'?'cryotheum':spec?.kind==='steam'?'steam':spec?.kind==='generator'?spec.fuel:['consumer','battery'].includes(spec?.kind)?'electric':null;
}
export function sourceOptions(game,d,mode=d.supply.mode){
  const type=carrier(game,d),self=endpointId(game,d.id);
  if(mode==='direct')return deviceEntries(game).filter(s=>s.id!==self&&(
    type==='steam'?energySpec(game,s)?.kind==='boiler':type==='electric'&&['generator','dyson'].includes(energySpec(game,s)?.kind)&&voltage(s)<=voltage(d)&&(energySpec(game,d)?.kind!=='battery'||!s.output||devicePeers(game,d.id).every(b=>includesEndpoint(game,s.output,b.id)))));
  if(type==='electric')return energySpec(game,d)?.kind==='battery'?[]:deviceEntries(game).filter(s=>s.id!==self&&energySpec(game,s)?.kind==='battery'&&voltage(s)<=voltage(d));
  return fluidEntries(game).filter(c=>game.acceptsFluid(c,type)&&(!c.fluid||c.fluid===type));
}
export function setSupply(game,id,mode,source){
  const peers=devicePeers(game,id),d=peers[0];
  if(!d||!['direct','storage'].includes(mode)||!carrier(game,d))return {ok:false,message:'此设备没有这种供给方式'};
  if(energySpec(game,d).kind==='battery'&&mode!=='direct')return {ok:false,message:'电池箱从发电设备充电'};
  source=source?endpointId(game,source):null;
  if(source&&!sourceOptions(game,d,mode).some(s=>s.id===source))return {ok:false,message:'来源不兼容，请检查能源类型和电压'};
  if(energySpec(game,d).kind==='battery')for(const s of game.state.devices)if(peers.some(b=>includesEndpoint(game,s.output,b.id))&&!includesEndpoint(game,source,s.id))s.output=null;
  for(const d of peers)d.supply={mode,source};return {ok:true};
}
export function generatorFuel(game,d){
  const spec=energySpec(game,d),tier=d.energyTier;
  if(spec?.kind!=='generator')return null;
  if(spec.fuel==='steam')return {id:'steam',amount:6+tier,eu:3,capacity:24000*tier};
  const efficiency=spec.fuel==='diesel'?E.diesel.efficiency[tier]:spec.fuel==='hydrogen'?E.gas.efficiency[tier]:10+10*tier;
  const base=spec.fuel==='diesel'?E.diesel.fuelEU:spec.fuel==='hydrogen'?E.gas.hydrogenEU:E.plasma.heliumEU;
  return {id:spec.fuel,amount:1,eu:Math.floor(base*efficiency/100),efficiency,capacity:16000};
}

function inputFluid(game,d,fluid,want){
  if(!d.supply.source||want<=0)return 0;
  const group=findGroup(game,d.id);
  if(group&&game.groupFluidInputs){
    const key=group.id+'/'+d.supply.source+'/'+fluid;
    let pending=game.groupFluidInputs.get(key);
    if(!pending){pending=new Set(devicePeers(game,d.id).filter(p=>energySpec(game,p)?.kind==='boiler'||p.enabled&&p.recipe).map(p=>p.id));game.groupFluidInputs.set(key,pending);}
    if(pending.has(d.id)){
      const available=endpointMembers(game,d.supply.source).reduce((n,s)=>n+(d.supply.mode==='direct'?(energySpec(game,s)?.kind==='boiler'?s.steam:0):s.fluid===fluid?s.amount:0),0);
      want=Math.min(want,available/pending.size);pending.delete(d.id);
    }
  }
  if(d.supply.mode!=='direct')return takeFluid(game,d.supply.source,fluid,want);
  let moved=0;
  for(const src of endpointMembers(game,d.supply.source)){
    if(fluid!=='steam'||energySpec(game,src)?.kind!=='boiler')continue;
    const amount=Math.min(want-moved,src.steam);src.steam-=amount;moved+=amount;
    if(moved>=want-1e-8)break;
  }
  return moved;
}
function pullElectric(game,d,want,dt,budgets,inputAmps){
  const sources=endpointMembers(game,d.supply.source);let total=0;
  const inputLimit=(sources.length?voltage(sources[0]):0)*inputAmps*20*dt;
  for(const src of sources){
    if(!src.enabled)continue;
    const sourceKind=energySpec(game,src)?.kind;
    if(d.supply.mode==='direct'?!['generator','dyson'].includes(sourceKind):sourceKind!=='battery')continue;
    if(energySpec(game,d)?.kind==='battery'&&src.output&&!includesEndpoint(game,src.output,d.id))continue;
    if(voltage(src)>voltage(d)){d.blocked='来源电压过高';continue;}
    const reserve=sourceKind==='battery'?0:512;
    const amount=Math.max(0,Math.min(want-total,inputLimit-total,Math.max(0,src.eu-reserve),budgets.get(src.id)||0));
    src.eu=Math.max(0,src.eu-amount);budgets.set(src.id,Math.max(0,(budgets.get(src.id)||0)-amount));total+=amount;
    if(total>=want-1e-8||total>=inputLimit-1e-8)break;
  }
  return total;
}
function runBoiler(game,d,dt){
  const B=E.boiler;
  // Water can enter via a fluid port even with small-boiler item automation disabled.
  const room=Math.max(0,B.waterCapacity-d.water);
  if(d.supply.source)d.water+=inputFluid(game,d,'water',room);
  else {const water=Math.min(room,game.quantity('water'));if(water>0&&game.pay({water}))d.water+=water;}
  d.thermalFraction+=dt*20;const ticks=Math.floor(d.thermalFraction+EPS);d.thermalFraction=Math.max(0,d.thermalFraction-ticks);
  let produced=0,vented=0;
  for(let i=0;i<ticks;i++){
    d.thermalTick=(d.thermalTick+1)%1380;
    if(d.startupTicks>0){d.startupTicks--;continue;}
    if(d.temperature<=20){d.temperature=20;d.cooldownClock=0;}
    else if(++d.cooldownClock>=46){d.temperature--;d.cooldownClock=0;}
    if(d.thermalTick%10===0&&d.temperature>100&&d.water>0){
      const amount=B.steamPerSecond/2;
      d.waterRemainder+=amount;const consumed=Math.floor(d.waterRemainder/B.steamPerWater);
      d.water=Math.max(0,d.water-consumed);d.waterRemainder-=consumed*B.steamPerWater;
      d.steam+=amount;produced+=amount;
      if(d.steam>B.steamCapacity){vented+=d.steam-B.steamCapacity*.75;d.steam=B.steamCapacity*.75;}
    }
    if(d.heat<=0&&d.enabled&&d.recipe&&d.coal>0){d.coal--;d.heat+=B.coalHeat;}
    if(d.temperature<B.maxTemperature&&d.heat>0&&d.thermalTick%12===0){d.temperature++;d.heat=Math.max(0,d.heat-1);}
  }
  if(produced){game.state.earned.steam=(game.state.earned.steam||0)+produced;game.state.produced+=produced;}
  // Dry hot boilers are interlocked in the 2D adaptation, rather than exploding the base.
  d.blocked=vented?'蒸汽过满，安全阀排汽':d.temperature>100?(d.water>0?'运行中':'缺水，禁止进汽'):d.heat>0?'升温中':d.temperature>20?'余热冷却中':d.enabled&&d.recipe?'请装入煤炭':'已停止';
}
function runGenerator(game,d,dt){
  const fuel=generatorFuel(game,d);
  if(!d.enabled||!d.recipe){d.blocked=d.enabled?'请选择配方':'已停止';return;}
  d.fuel+=inputFluid(game,d,fuel.id,Math.max(0,fuel.capacity-d.fuel));
  d.generatorClock+=dt;const cycles=Math.floor((d.generatorClock+EPS)/.5);d.generatorClock=Math.max(0,d.generatorClock-cycles*.5);
  if(cycles){
    const operations=Math.max(0,Math.floor(Math.min(d.fuel/fuel.amount,(energyCapacity(game,d)-d.eu)/fuel.eu)+EPS));
    d.fuel=Math.max(0,d.fuel-operations*fuel.amount);d.eu+=operations*fuel.eu;
  }
  d.blocked=d.eu>=energyCapacity(game,d)-fuel.eu?'机内储能已满':d.fuel>=fuel.amount||d.eu>512?'运行中':d.supply.source?'燃料不足':'请选择燃料来源';
}
function runDyson(game,d,dt){
  if(!d.enabled||!d.recipe){d.blocked=d.enabled?'请选择配方':'已停止';return;}
  if(d.cycleRemaining<=EPS){
    if(!d.modules){d.blocked='请装入戴森模块';return;}
    const available=d.supply.source?endpointMembers(game,d.supply.source).reduce((n,c)=>n+(c.fluid==='cryotheum'?c.amount:0),0):game.quantity('cryotheum');
    if(available<E.dyson.coolant){d.blocked='极寒之凛冰不足';return;}
    if(d.supply.source)takeFluid(game,d.supply.source,'cryotheum',E.dyson.coolant);else game.pay({cryotheum:E.dyson.coolant});
    d.cyclePower=d.modules*E.dyson.euPerModule*E.dyson.powerFactor;
    d.modules=Math.max(0,Math.trunc(d.modules-d.modules*(2*E.dyson.destroyChance)/(Math.exp(-E.dyson.destroyA*(d.modules-1))+1)));
    d.cycleRemaining=E.dyson.cycleSeconds;
  }
  const used=Math.min(dt,d.cycleRemaining);d.cycleRemaining=Math.max(0,d.cycleRemaining-used);
  // Deliver this interval's generation before capping retained output energy.
  // Otherwise a large swarm's rate is accidentally limited by simulation step size.
  d.eu+=d.cyclePower*20*used;d.blocked='运行中';
}
function runMachine(game,d,dt,budgets){
  const spec=energySpec(game,d),r=game.recipeById.get(d.recipe),run=runtime(game,d,r);
  if(spec?.kind==='battery'){
    if(!d.enabled){d.blocked='已停止';return;}
    if(!d.batteries){d.blocked='请装入同级电池';return;}
    d.eu+=pullElectric(game,d,Math.max(0,energyCapacity(game,d)-d.eu),dt,budgets,d.batteries*2);
    d.blocked=d.eu>=energyCapacity(game,d)-EPS?'电池已充满':d.supply.source?'充放电中':'请选择充电来源';return;
  }
  if(!d.enabled){d.blocked=d.recipe?'已暂停':'已停止';return;}
  if(!r){d.blocked='请选择配方';return;}
  if(!run.valid){d.blocked='机器电压等级不足';return;}
  if(spec?.kind==='steam')d.steam+=inputFluid(game,d,'steam',Math.max(0,E.steamMachine.capacity-d.steam));
  if(spec?.kind==='consumer')d.eu+=pullElectric(game,d,Math.max(0,energyCapacity(game,d)-d.eu),dt,budgets,Math.floor(2*run.power/voltage(d))+1);
  let left=dt;
  // Carry a completed/short recipe into the rest of this step, without losing time.
  while(left>EPS){
    if(d.job&&d.job.remaining<=EPS){if(!game.finish(r,d)){d.blocked='流体输出空间不足';return;}d.job=null;}
    if(!d.job){
      if(!game.canPay(r.tools||{})){d.ignited=false;d.blocked='缺少工具';return;}
      if(!game.canPay(r.inputs)){d.ignited=false;d.blocked='缺少原料';return;}
      if(!game.canStore(r.outputs,r.inputs,d.fluidOutputs)){d.ignited=false;d.blocked='流体输出空间不足';return;}
      if(r.startup&&!d.ignited){
        if(d.eu<r.startup){d.blocked='等待聚变启动储能';return;}
        d.eu-=r.startup;d.ignited=true;
      }
      if(spec?.kind==='steam'&&d.steam<E.steamMachine.minimumSteam){d.blocked='机内蒸汽不足';return;}
      if(spec?.kind==='consumer'&&d.eu<run.power){d.blocked=d.supply.source?'电力不足':'请选择供能来源';return;}
      game.pay(r.inputs);d.job={remaining:run.seconds,duration:run.seconds};
    }
    const used=Math.min(left,d.job.remaining),eu=run.power*20*used,steam=run.steamPerSecond*used;
    if(spec?.kind==='steam'&&d.steam+EPS<steam){d.blocked='蒸汽不足';return;}
    if(spec?.kind==='consumer'&&d.eu+EPS<eu){d.blocked='电力不足';return;}
    if(spec?.kind==='steam')d.steam=Math.max(0,d.steam-steam);
    if(spec?.kind==='consumer')d.eu=Math.max(0,d.eu-eu);
    d.job.remaining=Math.max(0,d.job.remaining-used);left-=used;d.blocked='运行中';
    if(d.job.remaining<=EPS){if(game.finish(r,d))d.job=null;else {d.blocked='流体输出空间不足';return;}}
  }
}
export function tickMachines(game,dt){
  if(dt<=0)return;
  game.groupFluidInputs=new Map();
  const devices=game.state.devices,budgets=new Map();
  for(const d of devices)if(energySpec(game,d)?.kind==='boiler')runBoiler(game,d,dt);
  for(const d of devices){
    const kind=energySpec(game,d)?.kind;
    if(kind==='generator')runGenerator(game,d,dt);
    if(kind==='dyson')runDyson(game,d,dt);
    if(['generator','dyson','battery'].includes(kind))budgets.set(d.id,voltage(d)*20*dt*(kind==='battery'?d.batteries:kind==='dyson'?Math.max(1,Math.ceil(d.cyclePower/voltage(d))):1));
  }
  // Consumers share each source's output limit; adding cables never creates extra amperes.
  const consumers=devices.filter(d=>!['boiler','generator','battery','dyson'].includes(energySpec(game,d)?.kind));
  const first=Math.floor(game.state.playtime*2)%Math.max(1,consumers.length);
  const ordered=consumers.map((_,i)=>consumers[(i+first)%consumers.length]);
  for(const d of ordered)if(d.supply.mode==='direct')runMachine(game,d,dt,budgets);
  // Direct consumers use their share first; surplus charges the selected battery boxes.
  for(const d of devices)if(energySpec(game,d)?.kind==='battery')runMachine(game,d,dt,budgets);
  for(const d of ordered)if(d.supply.mode!=='direct')runMachine(game,d,dt,budgets);
  for(const d of devices)if(energySpec(game,d)?.kind==='boiler'&&d.output&&d.steam>EPS){
    d.steam=Math.max(0,d.steam-putFluid(game,d.output,'steam',d.steam));
  }
  for(const d of devices)if(energySpec(game,d)?.kind==='dyson')d.eu=Math.min(d.eu,energyCapacity(game,d));
  game.state.energy=devices.reduce((n,d)=>n+d.eu,0);
}
