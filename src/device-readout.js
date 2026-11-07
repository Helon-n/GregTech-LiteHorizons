import {energySpec,energyCapacity,voltage,generatorFuel,boilerProfile,boilerSteam,daylight} from './core/energy.js';
import {ENERGY_REFERENCE as E} from './data/energy-reference.js';
import {updateText,updateAttribute,updatePercent} from './live-view.js';
import {godforgeKind,forgeHeat} from './core/godforge.js';
import {purificationTier,purificationHost,purificationChance} from './core/purification.js';
import {RTG_REFERENCE as RTG} from './data/rtg-reference.js';
import {NUCLEAR_REFERENCE as NUCLEAR} from './data/nuclear-reference.js';
import {bioDose} from './core/biochemistry.js';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const exact=n=>Math.floor(Math.max(0,n||0)).toLocaleString('zh-CN');
const amount=n=>n>=1e9?(n/1e9).toFixed(1)+'G':n>=1e6?(n/1e6).toFixed(1)+'M':exact(n);
const percent=m=>(m.value-(m.min||0))/Math.max(1,m.max-(m.min||0))*100;
const image=(game,id)=>`<img src="assets/gtnh/${escape(game.catalog.items[id]?.icon||id)}.svg" alt="" draggable="false">`;
const description=m=>`${m.label}，${m.direction}，${exact(m.value)} / ${exact(m.max)} ${m.unit}${m.detail?'，'+m.detail:''}`;

function model(game,d){
  const spec=energySpec(game,d),magic=game.catalog.machines[d.type];
  if(magic?.aura||magic?.mana){
    const members=d.group?game.members(d.id):[d],aura=magic.aura,config=aura??magic.mana,key=aura?'vis':'mana';
    return {meters:[{key,label:aura?'原始灵气':'魔力池',value:members.reduce((sum,p)=>sum+(p[key]??0),0),max:config.capacity*members.length,unit:aura?'vis / 要素':'mana',direction:'储量',kind:'progress',color:'var(--a)'}],note:aura?'六种原始要素等量充能；开工时扣除灵气':'火红莲自动取煤 · 每块煤 40 秒 / 1,200 mana'};
  }
  if(!spec)return {meters:[],note:''};
  const members=d.group?game.members(d.id):[d],count=members.length;
  const r=game.recipeById.get(d.recipe),run=game.deviceRuntime(d,r),meters=[];
  if(game.catalog.machines[d.type]?.bioVat){
    const value=members.reduce((n,p)=>n+bioDose(p),0)/count;
    return {meters:[{key:'vatRadiation',label:count>1?'平均辐射':'辐射',value,max:Math.max(value,r?.requirements?.radiation?.value??0,1),unit:'Sv',direction:'培养',kind:'progress',color:'var(--a)'}],
      note:`${count>1?count+' 台 · ':''}${game.catalog.items[d.bioVat?.culture]?.name??'等待培养皿'} · 辐射棒剩余 ${exact((d.bioVat?.ticks??0)/20)} 秒 · 培养 ×${d.job?.bioMultiplier??1}`};
  }
  if(spec.cycle==='smeltery'){
    const heat=members.reduce((n,p)=>n+(p.smeltery?.useTime??0),0)/20;
    const required=r?.smeltery?.temperature??20;
    const temperature=members.reduce((n,p)=>n+(p.job?.smelteryTemperature??200)/10,0)/count;
    return {meters:[{key:'smelteryTemperature',label:count>1?'平均料温':'料温',value:temperature,min:20,max:Math.max(21,required),unit:'°C',direction:'加热',kind:'temperature',color:'var(--warning)'}],note:`熔点 ${required} °C · 燃烧储备 ${exact(heat)} 秒${count>1?'（全组合计）':''}`};
  }
  const waterTier=purificationTier(game,d);
  if(typeof waterTier==='number'&&waterTier>0){
    const s=d.job?.purification,host=purificationHost(game,d),chance=s&&r?.purification?purificationChance(r,s):r?.purification?.chance??0;
    meters.push({key:'waterChance',label:'处理成功率',value:Math.min(100,chance),max:100,unit:'%',direction:'本批',kind:'progress',color:'var(--a)'});
    let note=host?`主控 #${host.id.slice(1)} · ${amount(run.power)} EU/t`:'未连接主控';
    if(waterTier===3)note+=` · 已投入 ${amount(s?.chemical??0)} mB 絮凝剂`;
    if(waterTier===4)note+=` · pH ${s?s.ph.toFixed(2):'—'}`;
    if(waterTier===5){meters.push({key:'waterTemperature',label:'处理温度',value:s?.temperature??0,max:12500,unit:'K',direction:s?.cooling?'冷却':'加热',kind:'progress',color:'var(--warning)'});note+=` · 完成 ${s?.cycles??0} 次冷热循环`;}
    if(waterTier===6)note+=` · 已匹配 ${s?.swaps??0} / 9 片透镜`;
    if(waterTier===7)note+=` · 控制信号 ${s?s.signal.toString(2).padStart(4,'0'):'—'}`;
    if(waterTier===8)note+=` · 已投入 ${s?.inserted.length??0} 枚催化剂${s?.match>=0?' · 配对成功':''}`;
    return {meters,note};
  }
  if(godforgeKind(game,d)==='host'){
    const s=d.godforge;
    return {meters:[{key:'forgeCharge',label:'燃烧储备',value:s.charge,max:s.capacity,unit:'点',direction:'恒星维持',kind:'progress',color:'var(--a)'}],note:`熔炼温度 ${exact(forgeHeat(s))} K · ${s.rings} 环`};
  }
  if(spec.cycle==='solarTower'){
    const states=members.map(x=>x.solarTower??{heat:0,efficiency:0});
    return {meters:[{key:'solarSaltHeat',label:count>1?'平均蓄热':'蓄热',value:states.reduce((n,s)=>n+s.heat,0)/count,max:100000,unit:'点',direction:'太阳热量',kind:'progress',color:'var(--warning)'},{key:'solarSaltEfficiency',label:'启动进度',value:Math.min(...states.map(s=>s.efficiency))/100,max:100,unit:'%',direction:'预热',kind:'progress',color:'var(--a)'}],note:count>1?`${count} 台 · 按各塔蓄热分别转换熔盐`:'30,000 热量起转化 · 50,000 热量时吸热效率最高'};
  }
  const fluid=(key,id,value,max,direction)=>meters.push({key,label:game.catalog.items[id].name,icon:id,value,max,unit:'mB',direction,kind:'fluid',color:game.catalog.items[id].color||'var(--a)'});
  const power=()=>meters.push({key:'eu',label:'电力',value:d.eu,max:energyCapacity(game,d),unit:'EU',direction:'储能',kind:'power',color:'var(--a)'});
  let note=count>1?`${count} 台合计` :'';
  if(spec.cycle==='nuclear'){
    const s=d.nuclear;
    meters.push({key:'nuclearHeat',label:'堆芯热量',value:s.heat,max:s.maxHeat,unit:'HU',direction:'堆芯',kind:'temperature',color:'var(--warning)'});
    if(s.fluid){fluid('nuclearCold',NUCLEAR.cold,s.cold,NUCLEAR.tankCapacity,'输入');fluid('nuclearHot',NUCLEAR.hot,s.hot,NUCLEAR.tankCapacity,'输出');}
    else power();
    return {meters,note:s.fluid?`热冷却液 ${amount(s.emit)} mB/s`:`发电 ${amount(s.power)} EU/t · EV 输出`};
  }
  if(spec.kind==='boiler'){
    const B=boilerProfile(game,d);
    const temperatures=members.map(d=>d.temperature),low=Math.min(...temperatures),high=Math.max(...temperatures);
    const temperature=temperatures.reduce((n,t)=>n+t,0)/count;
    if(B.exchanger||B.thermal){
      const efficiency=members.reduce((n,d)=>n+((B.thermal?d.thermalBoiler:d.exchanger)?.efficiency??0),0)/count;
      meters.push({key:'heatExchangerEfficiency',label:'换热效率',value:efficiency/100,max:100,unit:'%',direction:'升温',kind:'progress',color:'var(--warning)'});
    }else if(B.large){
      const efficiency=members.reduce((n,d)=>n+(d.largeBoiler?.efficiency??0),0)/count;
      meters.push({key:'thermalEfficiency',label:'热效率',value:efficiency/100,max:125,unit:'%',direction:'炉温',kind:'progress',color:'var(--warning)'});
    }else meters.push({key:'temperature',label:count>1?'平均温度':'温度',value:temperature,min:B.ambient,max:B.maxTemperature,unit:'°C',direction:'炉温',kind:'temperature',color:'var(--warning)',
      detail:`高于 ${E.boiler.boiling} °C 产汽${count>1?`，各炉 ${exact(low)}–${exact(high)} °C`:''}`});
    fluid('water',d.waterFluid,d.water,B.waterCapacity*count,'输入');
    for(const id of new Set(members.map(p=>boilerSteam(game,p)))){
      const same=members.filter(p=>boilerSteam(game,p)===id);
      fluid('steam-'+id,id,same.reduce((n,p)=>n+p.steam,0),B.steamCapacity*same.length,'输出');
    }
    if(B.lava)fluid('fuel','lava',d.fuel,B.waterCapacity*count,'燃料');
    else if(!B.exchanger&&!B.solar&&!B.thermal)meters.push({key:'coal',label:game.catalog.items[d.solidFuel].name,value:d.coal,max:64*count,unit:'块',direction:count>1?'全组共用':'燃料',kind:'item',icon:d.solidFuel});
    note=count>1?`${count} 台合计 · 炉温 ${exact(low)}–${exact(high)} °C`:'';
    if(B.large)note=`${count} 台 · ${game.catalog.items[B.steam].name} · 节流电路 ${d.boilerCircuit??0}`;
    if(B.exchanger)note=`${count} 台 · ${game.catalog.items[boilerSteam(game,d)].name} · 电路 ${d.boilerCircuit??0} · 仅使用蒸馏水`;
    if(B.thermal){
      const life=members.reduce((n,d)=>n+(d.thermalFilter?.life??0),0);
      meters.push({key:'lavaFilter',label:'熔岩过滤器',value:life,max:100*count,unit:'点',direction:'剩余耐久',kind:'progress',color:'var(--a)'});
      note=`${count} 台 · ${life>0?'过滤器可用':'无过滤器时仅回收黑曜石'} · 水耗按每批蒸汽量向上取整`;
    }
  }else if(spec.kind==='steam'){
    fluid('steam','steam',d.steam,E.steamMachine.capacity*count,'输入');
    if(r)note+=(note?' · ':'')+`消耗 ${amount(run.steamPerSecond*count)} mB/s · ${run.seconds} 秒/批`;
  }else if(spec.kind==='generator'){
    const fuel=generatorFuel(game,d);
    if(fuel&&!fuel.solid)fluid('fuel',fuel.id,d.fuel,fuel.capacity*count,'输入');
    if(fuel?.solid)meters.push({key:'solidFuel',label:game.catalog.items[fuel.id].name,value:game.quantity(fuel.id),max:Math.max(64,game.quantity(fuel.id)),unit:'个',direction:'仓库供给',kind:'item',icon:fuel.id});
    power();
    if(spec.cycle==='lftr'){
      const warmup=Math.min(...members.map(d=>d.reactorWarmup??0));
      meters.push({key:'warmup',label:'预热',value:warmup,max:250,unit:'秒',direction:'反应堆',kind:'progress',color:'var(--warning)'});
      note=`发电 ${amount((r?.generationPower??0)*count)} EU/t · ${E.codes[d.energyTier]} 输出`;
    }else if(spec.cycle==='naquadah'){
      const power=members.reduce((n,d)=>n+(d.job?.naquadah?.power??0),0),efficiency=members.reduce((n,d)=>n+(d.job?.naquadah?.efficiency??0),0)/count;
      meters.push({key:'naquadahEfficiency',label:'冷却效率',value:efficiency,max:500,unit:'%',direction:'反应堆',kind:'progress',color:'var(--a)'});
      note=`输出 ${amount(power)} EU/t · 本批 ${d.job?.naquadah?.multiplier??1} 倍燃料 · ${E.codes[d.energyTier]} / 64 A 输出仓`;
    }else if(spec.cycle==='turbine'){
      const life=members.reduce((n,d)=>n+(d.rotor?.lives?.reduce((n,v)=>n+v,0)??d.rotor?.life??0),0),capacity=members.reduce((n,d)=>n+(game.catalog.items[d.rotor?.item]?.rotor?.durability??0)*(spec.rotorSlots??1),0);
      const output=members.reduce((n,d)=>n+Math.trunc((d.turbine?.power??0)*(d.turbine?.efficiency??0)/10000),0);
      meters.push({key:'rotorLife',label:'转子寿命',value:life,max:Math.max(1,capacity),unit:'点',direction:'剩余耐久',kind:'progress',color:'var(--a)'});
      note=`输出 ${amount(output)} EU/t · ${d.looseFit?'宽松装配':'紧密装配'} · ${members.every(d=>d.rotor?.life)?'转子已装入':'缺少可用转子'}`;
    }else if(spec.cycle==='combustion'){
      const efficiency=members.reduce((n,d)=>n+(d.combustion?.efficiency??0),0)/count;
      meters.push({key:'combustionEfficiency',label:'启动效率',value:efficiency/100,max:300,unit:'%',direction:'内燃机',kind:'progress',color:'var(--warning)'});
      note=`额定 2048 EU/t · 氧气增压最高 6144 EU/t / 台`;
    }else if(spec.cycle==='ic2RTG'){
      meters.push({key:'isotopeSlots',label:'同位素槽',value:members.reduce((n,p)=>n+p.isotopePellets,0),max:RTG.ic2.slots*count,unit:'枚',direction:'永久燃料',kind:'item',icon:RTG.ic2.pellet});
      note=`发电 ${amount(members.reduce((n,p)=>n+RTG.ic2.rates[p.isotopePellets],0))} EU/t · LV 输出`;
    }else if(spec.rtg)note=`当前输出 ${amount(members.reduce((n,p)=>n+voltage(p),0))} EU/t · 换料后按新燃料改变输出 · 关机不消耗`;
    else note=`额定 ${amount(voltage(d)*count)} EU/t · ${count} A`;
  }else if(spec.kind==='dyson'){
    power();meters.push({key:'modules',label:'戴森模块',value:d.modules,max:E.dyson.maxModules*count,unit:'个',direction:'装载',kind:'item',icon:'dyson'});
    const remaining=Math.max(...members.map(d=>d.cycleRemaining));
    note=`发电 ${amount(d.cyclePower)} EU/t · 剩余 ${Math.ceil(remaining/60)} 分钟`;
  }else if(spec.kind==='solar'){
    power();note=`${daylight(game)?'白天':'夜间'} · ${d.skyAccess?'露天':'上方遮挡'} · 额定 ${amount(voltage(d)*count)} EU/t`;
  }else{
    power();
    if(spec.kind==='battery')note=`电池 ${exact(d.batteries)} / ${E.battery.slots*count} 节 · 输出 ${exact(d.batteries)} A`;
    else if(run.batchEU)note=`开工从选定电池组预付 ${amount(run.batchEU)} EU / 批 · ${run.seconds} 秒/批`;
    else if(game.catalog.machines[d.type]?.beamline==='collider')note=`当前周期 ${amount(d.beam.power??0)} EU/t · 加速 ${d.beam.step} / ${d.beam.cycles}`;
    else if(r)note+=(note?' · ':'')+`${amount(run.power)} EU/t${count>1?' / 台':''} · ${run.seconds} 秒/批`;
  }
  if(r?.bath){
    const amount=members.reduce((n,d)=>n+(d.boardBath?.amount??0),0),impurity=members.reduce((n,d)=>n+(d.boardBath?.impurity??0),0);
    fluid('boardBath',r.bath.fluid,amount,1000000*count,'浸液');
    meters.push({key:'bathPurity',label:'洁净度',value:amount?(1-impurity/amount)*100:0,max:100,unit:'%',direction:'浸液',kind:'progress',color:'var(--a)'});
  }
  for(const [id,life]of Object.entries(r?.toolWear||{})){
    const remaining=members.reduce((n,d)=>n+(d.toolLife?.[id]??0),0);
    meters.push({key:'tool:'+id,label:game.catalog.items[id].name,icon:id,value:remaining,max:life*count,unit:'批',direction:'剩余寿命',kind:'item'});
  }
  return {meters,note};
}

export function deviceReadout(game,d,{compact=false}={}){
  const {meters,note}=model(game,d);if(!meters.length)return '';
  return `<div class="machine-readout${compact?' compact':''}" data-machine-readout="${d.id}"><div class="machine-gauges">${meters.map(m=>{
    const value=Math.max(m.min||0,Math.min(m.max,m.value)),label=description(m);
    const gauge=m.kind==='item'?`<div class="machine-item-slot">${image(game,m.icon)}<b data-gauge-item-count>${amount(m.value)}</b></div>`:
      `<div class="machine-gauge-well" role="meter" tabindex="0" aria-label="${escape(m.label+' · '+m.direction)}" aria-valuemin="${m.min||0}" aria-valuemax="${m.max}" aria-valuenow="${value}" aria-valuetext="${escape(label)}"><div class="machine-gauge-fill" style="height:${Math.max(0,Math.min(100,percent(m)))}%">${m.icon?image(game,m.icon):''}</div><span class="machine-gauge-ticks" aria-hidden="true"></span></div>`;
    return `<div class="machine-gauge" data-gauge="${m.key}" data-gauge-kind="${m.kind}" style="--gauge-color:${escape(m.color||'var(--a)')}" title="${escape(label)}"><span class="machine-gauge-label">${escape(m.label)}<small>${escape(m.direction)}</small></span><div class="machine-gauge-body">${gauge}</div><strong data-gauge-value>${amount(m.value)}${m.kind==='temperature'?' °C':''}</strong><small class="machine-gauge-capacity" data-gauge-capacity>/ ${amount(m.max)} ${m.unit}</small></div>`;
  }).join('')}</div><div class="machine-readout-note" data-gauge-note ${note?'':'hidden'}>${escape(note)}</div></div>`;
}

export function updateDeviceReadout(card,game,d){
  const root=card.querySelector('[data-machine-readout]');if(!root)return;
  const {meters,note}=model(game,d),byKey=new Map(meters.map(m=>[m.key,m]));
  for(const slot of root.querySelectorAll('[data-gauge]')){
    const m=byKey.get(slot.dataset.gauge);if(!m)continue;
    const label=description(m),well=slot.querySelector('[role="meter"]');
    updateAttribute(slot,'title',label);
    updateText(slot.querySelector('[data-gauge-value]'),amount(m.value)+(m.kind==='temperature'?' °C':''));
    updateText(slot.querySelector('[data-gauge-item-count]'),amount(m.value));
    updateText(slot.querySelector('[data-gauge-capacity]'),`/ ${amount(m.max)} ${m.unit}`);
    updateAttribute(well,'aria-valuemax',m.max);
    updateAttribute(well,'aria-valuenow',Math.max(m.min||0,Math.min(m.max,m.value)));
    updateAttribute(well,'aria-valuetext',label);
    updatePercent(slot.querySelector('.machine-gauge-fill'),'height',percent(m));
  }
  const footer=root.querySelector('[data-gauge-note]');updateText(footer,note);footer.hidden=!note;
}
