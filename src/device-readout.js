import {energySpec,energyCapacity,voltage,generatorFuel} from './core/energy.js';
import {ENERGY_REFERENCE as E} from './data/energy-reference.js';
import {updateText,updateAttribute,updatePercent} from './live-view.js';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const exact=n=>Math.floor(Math.max(0,n||0)).toLocaleString('zh-CN');
const amount=n=>n>=1e9?(n/1e9).toFixed(1)+'G':n>=1e6?(n/1e6).toFixed(1)+'M':exact(n);
const percent=m=>(m.value-(m.min||0))/Math.max(1,m.max-(m.min||0))*100;
const image=(game,id)=>`<img src="assets/gtnh/${escape(game.catalog.items[id]?.icon||id)}.svg" alt="" draggable="false">`;
const description=m=>`${m.label}，${m.direction}，${exact(m.value)} / ${exact(m.max)} ${m.unit}${m.detail?'，'+m.detail:''}`;

function model(game,d){
  const spec=energySpec(game,d);if(!spec)return {meters:[],note:''};
  const members=d.group?game.members(d.id):[d],count=members.length;
  const r=game.recipeById.get(d.recipe),run=game.deviceRuntime(d,r),meters=[];
  const fluid=(key,id,value,max,direction)=>meters.push({key,label:game.catalog.items[id].name,icon:id,value,max,unit:'mB',direction,kind:'fluid',color:game.catalog.items[id].color||'var(--a)'});
  const power=()=>meters.push({key:'eu',label:'电力',value:d.eu,max:energyCapacity(game,d),unit:'EU',direction:'储能',kind:'power',color:'var(--a)'});
  let note=count>1?`${count} 台合计` :'';
  if(spec.kind==='boiler'){
    const temperatures=members.map(d=>d.temperature),low=Math.min(...temperatures),high=Math.max(...temperatures);
    const temperature=temperatures.reduce((n,t)=>n+t,0)/count;
    meters.push({key:'temperature',label:count>1?'平均温度':'温度',value:temperature,min:E.boiler.ambient,max:E.boiler.maxTemperature,unit:'°C',direction:'炉温',kind:'temperature',color:'var(--warning)',
      detail:`高于 ${E.boiler.boiling} °C 产汽${count>1?`，各炉 ${exact(low)}–${exact(high)} °C`:''}`});
    fluid('water','water',d.water,E.boiler.waterCapacity*count,'输入');
    fluid('steam','steam',d.steam,E.boiler.steamCapacity*count,'输出');
    meters.push({key:'coal',label:'煤炭',value:d.coal,max:64*count,unit:'块',direction:'燃料',kind:'item',icon:'coal'});
    note=count>1?`${count} 台合计 · 炉温 ${exact(low)}–${exact(high)} °C`:'';
  }else if(spec.kind==='steam'){
    fluid('steam','steam',d.steam,E.steamMachine.capacity*count,'输入');
    if(r)note+=(note?' · ':'')+`消耗 ${amount(run.steamPerSecond*count)} mB/s · ${run.seconds} 秒/批`;
  }else if(spec.kind==='generator'){
    const fuel=generatorFuel(game,d);
    fluid('fuel',fuel.id,d.fuel,fuel.capacity*count,'输入');power();
    note=`额定 ${amount(voltage(d)*count)} EU/t · ${count} A`;
  }else if(spec.kind==='dyson'){
    power();meters.push({key:'modules',label:'戴森模块',value:d.modules,max:E.dyson.maxModules*count,unit:'个',direction:'装载',kind:'item',icon:'dyson'});
    const remaining=Math.max(...members.map(d=>d.cycleRemaining));
    note=`发电 ${amount(d.cyclePower)} EU/t · 剩余 ${Math.ceil(remaining/60)} 分钟`;
  }else{
    power();
    if(spec.kind==='battery')note=`电池 ${exact(d.batteries)} / ${E.battery.slots*count} 节 · 输出 ${exact(d.batteries)} A`;
    else if(r)note+=(note?' · ':'')+`${amount(run.power)} EU/t${count>1?' / 台':''} · ${run.seconds} 秒/批`;
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
