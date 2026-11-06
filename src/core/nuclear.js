import {NUCLEAR_REFERENCE as N} from '../data/nuclear-reference.js';
import {componentCount,takeComponent} from './components.js';

export const nuclearSpec=item=>N.parts[item];
export function initializeNuclear(d){
  d.nuclear??={slots:Array(54).fill(null),chambers:0,fluid:false,heat:0,maxHeat:N.baseHeat,clock:0,power:0,emit:0,cold:0,hot:0,tripped:false};
}
const adjacent=(i,width)=>[i%9?i-1:-1,i%9+1<width?i+1:-1,i>=9?i-9:-1,i<45?i+9:-1].filter(i=>i>=0);
const canStore=(p,part,s)=>p&&['storage','vent','exchanger','condensator'].includes(p.kind)&&(!p.gtCoolant||!s.fluid||!part.control)&&(p.kind!=='condensator'||part.damage+1<p.capacity);
const round=n=>Math.floor(n+.5),f=Math.fround;

// IC2's alterHeat return is the unaccepted amount. Keep its actual signed
// overflow branch; redistributing that remainder as positive heat changes
// the behavior of vent/exchanger layouts.
function alter(s,index,heat,heldPart=null){
  const part=heldPart??s.slots[index],p=part&&nuclearSpec(part.item);if(!p)return heat;
  if(p.kind==='condensator'){
    if(heat<0)return heat;
    const used=Math.min(p.capacity-part.damage-1,heat);part.damage+=used;return heat-used;
  }
  if(!['storage','vent','exchanger'].includes(p.kind))return heat;
  if(p.gtCoolant&&part.damage===0)part.control=false;
  let value=part.damage+heat;
  if(value>p.capacity){s.slots[index]=null;return p.capacity-value+1;}
  const remainder=value<0?value:0;value=Math.max(0,value);part.damage=value;
  if(p.gtCoolant&&value>0&&!s.fluid)part.control=true;
  return remainder;
}
function pulse(s,index,source,heatRun){
  const part=s.slots[index],p=part&&nuclearSpec(part.item);if(!p)return false;
  if(p.kind==='fuel'){
    if(!heatRun)s.raw=f(s.raw+f(p.energy*(p.mox?f(1+f(p.heatBonus*f(s.heat/s.maxHeat))):1)));
    return true;
  }
  if(p.kind==='reflector'){
    if(!heatRun)pulse(s,source,index,false);
    else if(p.capacity){if(++part.damage>=p.capacity)s.slots[index]=null;}
    return true;
  }
  if(p.kind==='breeder'){
    if(heatRun){part.damage+=1+Math.trunc(s.heat/p.step)*p.multiplier;if(part.damage>=p.capacity)s.slots[index]={item:p.depleted,damage:0};}
    return p.deflector;
  }
  return false;
}
function fuel(s,i,part,p,heatRun,active,width){
  if(!active)return;
  for(let cell=0;cell<p.cells;cell++){
    let pulses=1+Math.trunc(p.cells/2);
    if(!heatRun)for(let n=0;n<pulses;n++)pulse(s,i,i,false);
    for(const other of adjacent(i,width))if(pulse(s,other,i,heatRun))pulses++;
    if(heatRun){
      let heat=round(f((pulses*pulses+pulses)/2*(p.mox&&s.fluid&&f(s.heat/s.maxHeat)>.5?2:1)*p.heat));
      const acceptors=adjacent(i,width).filter(j=>{const part=s.slots[j];return part&&canStore(nuclearSpec(part.item),part,s);});
      while(acceptors.length&&heat>0){const share=Math.trunc(heat/acceptors.length);heat-=share;heat+=alter(s,acceptors.shift(),share);}
      if(heat>0)s.heat+=heat;
    }
  }
  if(part.damage>=p.capacity-1)s.slots[i]={item:p.depleted,damage:0};
  else if(heatRun)part.damage++;
}
function transfer(my,other,max,side,rounded=false){
  let n=rounded?round(max/100*(other+my/2)):Math.trunc(max/100*(other+my/2));
  n=Math.min(n,side);
  if(other+my/2<1)n=Math.trunc(side/2);
  if(other+my/2<.75)n=Math.trunc(side/4);
  if(other+my/2<.5)n=Math.trunc(side/8);
  if(other+my/2<.25)n=1;
  return round(other*10)>round(my*10)?-n:round(other*10)===round(my*10)?0:n;
}
function exchanger(s,i,part,p,width){
  let change=0;
  if(p.side)for(const j of adjacent(i,width)){
    const other=s.slots[j],q=other&&nuclearSpec(other.item);if(!canStore(q,other,s))continue;
    const mine=part.damage*100/p.capacity,theirs=(q.kind==='condensator'?0:other.damage)*100/q.capacity;
    const n=transfer(mine,theirs,q.capacity,p.side);change-=n;change+=alter(s,j,n);
  }
  if(p.reactor){
    // IC2 uses switchSide for the low-temperature fallback even when only
    // switchReactor is enabled. Preserve this quirk of 2.2.828.
    const mine=part.damage*100/p.capacity,theirs=s.heat*100/s.maxHeat;
    let n=Math.min(round(s.maxHeat/100*(theirs+mine/2)),p.reactor);
    if(theirs+mine/2<1)n=Math.trunc(p.side/2);
    if(theirs+mine/2<.75)n=Math.trunc(p.side/4);
    if(theirs+mine/2<.5)n=Math.trunc(p.side/8);
    if(theirs+mine/2<.25)n=1;
    n=round(theirs*10)>round(mine*10)?-n:round(theirs*10)===round(mine*10)?0:n;
    change-=n;s.heat+=n;
  }
  alter(s,i,change,part);
}
function cycle(s,active){
  s.raw=0;s.maxHeat=N.baseHeat;s.emit=0;const width=N.baseColumns+s.chambers;
  // Original traversal: complete heat pass first, then complete pulse pass;
  // row-major in both passes. Depletion can replace a rod before pulse pass.
  for(const heatRun of [true,false])for(let y=0;y<6;y++)for(let x=0;x<width;x++){
    const i=y*9+x,part=s.slots[i],p=part&&nuclearSpec(part.item);if(!p)continue;
    if(p.kind==='fuel')fuel(s,i,part,p,heatRun,active,width);
    else if(heatRun&&p.kind==='plating')s.maxHeat+=p.heatAdd;
    else if(heatRun&&p.kind==='vent'){
      if(p.reactorVent){const drain=Math.min(s.heat,p.reactorVent),remainder=alter(s,i,drain,part);if(remainder>0)continue;s.heat-=drain;}
      const remainder=alter(s,i,-p.selfVent,part);if(remainder<=0)s.emit+=remainder+p.selfVent;
    }else if(heatRun&&p.kind==='spread'){
      for(const j of adjacent(i,width)){const other=s.slots[j];if(!other||!canStore(nuclearSpec(other.item),other,s))continue;const remainder=alter(s,j,-p.sideVent);if(remainder<=0)s.emit+=remainder+p.sideVent;}
    }else if(heatRun&&p.kind==='exchanger')exchanger(s,i,part,p,width);
  }
  s.power=s.fluid?0:f(s.raw*N.euMultiplier);delete s.raw;
  if(s.fluid){
    let hu=Math.trunc(f(N.huMultiplier*s.emit));
    const converted=Math.min(hu,N.tankCapacity-s.hot,s.cold);
    s.cold-=converted;s.hot+=converted;hu-=converted;s.emit=converted;
    s.heat+=Math.trunc(hu/2);
  }
  if(s.heat>=s.maxHeat){s.tripped=true;s.power=0;}
}
export function runNuclear(game,d,dt){
  initializeNuclear(d);const s=d.nuclear;
  if(s.fluid){
    const want=d.enabled||s.heat>0?Math.floor(Math.min(N.tankCapacity-s.cold,game.inputQuantity(N.cold,d.fluidInputs[N.cold]))):0;
    if(want>0&&game.payInputs(d,{[N.cold]:want}))s.cold+=want;
    if(s.hot&&game.add({[N.hot]:s.hot},false,d.fluidOutputs))s.hot=0;
  }
  // Integrate the previously established output up to the next reactor
  // boundary. Applying the new output to the whole dt grants power before
  // its fuel pulse, and makes production depend on the UI tick size.
  let remaining=dt;
  while(remaining>0){
    const span=Math.min(remaining,N.tickSeconds-s.clock);
    if(d.enabled&&!s.tripped&&N.generatorEnabled)d.eu=Math.min(2048*80+512,d.eu+s.power*20*span);
    remaining=Math.max(0,remaining-span);s.clock+=span;
    if(s.clock>=N.tickSeconds){cycle(s,d.enabled&&!s.tripped&&N.generatorEnabled);s.clock=0;}
  }
  d.blocked=s.tripped?'过热保护，冷却后复位':d.enabled?(s.power>0||s.fluid&&s.emit>0?'运行中':'等待燃料或冷却布局'):'已停止，散热中';
}
function store(game,part){
  const p=nuclearSpec(part.item);
  if(!part.damage&&!part.control){game.add({[part.item]:1},false);return;}
  game.state.components.push({item:part.item,kind:'nuclear',life:p.capacity+1-part.damage,...(part.control?{control:true}:{})});
}
export function changeNuclear(game,id,action,value){
  const d=game.state.devices.find(d=>d.id===id);if(!d||game.catalog.machines[d.type]?.energy?.cycle!=='nuclear')return {ok:false,message:'请选择单台核反应堆'};
  const s=d.nuclear;if(d.enabled)return {ok:false,message:'请先停止反应堆，再更换组件'};
  if(action==='chamber'){
    if(s.chambers>=6||!game.pay({[N.chamber]:1}))return {ok:false,message:'需要一个反应堆仓，最多六个'};
    s.chambers++;
  }else if(action==='fluid'){
    if(s.chambers!==6||s.fluid||s.heat||d.eu||s.slots.some(Boolean))return {ok:false,message:'需要六个反应堆仓，清空组件和电量并冷却后改造'};
    if(!game.pay(N.fluidStructure))return {ok:false,message:'压力容器结构材料不足'};
    s.fluid=true;s.power=0;
  }else if(action==='reset'){
    if(s.heat>=s.maxHeat)return {ok:false,message:'堆芯尚未冷却到安全范围'};
    s.tripped=false;
  }else if(action==='repair'){
    const part=s.slots[value],cost=part&&N.repairs[part.item];
    if(!Number.isInteger(value)||!cost||!part.damage)return {ok:false,message:'请选择已使用的冷凝器'};
    if(!game.pay(cost))return {ok:false,message:'维修材料不足'};
    part.damage=0;
  }else if(action==='slot'){
    const {index,item}=value??{};
    if(!Number.isInteger(index)||index<0||index>=54||index%9>=N.baseColumns+s.chambers)return {ok:false,message:'槽位不可用'};
    let next=null;
    if(item){
      const p=nuclearSpec(item);if(!p)return {ok:false,message:'请选择反应堆组件'};
      if(p.capacity){
        if(!game.quantity(item)&&!componentCount(game,item))return {ok:false,message:'组件库存不足'};
        const c=takeComponent(game,item,'nuclear');
        if(!c)return {ok:false,message:'组件库存不足'};
        next={item,damage:p.capacity+1-c.life,...(c.control?{control:true}:{})};
        if(s.fluid&&p.kind==='storage'&&!p.gtCoolant&&next.damage){store(game,next);return {ok:false,message:'流体反应堆不能装入已蓄热的普通冷却单元'};}
      }else {if(!game.pay({[item]:1}))return {ok:false,message:'组件库存不足'};next={item,damage:0};}
    }
    if(s.slots[index])store(game,s.slots[index]);s.slots[index]=next;
  }else return {ok:false,message:'反应堆操作无效'};
  return {ok:true};
}
export function nuclearRefund(d){
  const s=d.nuclear;if(!s)return {};
  return {...(s.chambers?{[N.chamber]:s.chambers}:{}),...(s.fluid?N.fluidStructure:{})};
}
export function validNuclear(game,d){
  const isReactor=game.catalog.machines[d.type]?.energy?.cycle==='nuclear',s=d.nuclear;
  if(!isReactor)return s===undefined;
  if(!s||!Array.isArray(s.slots)||s.slots.length!==54||!Number.isInteger(s.chambers)||s.chambers<0||s.chambers>6||typeof s.fluid!=='boolean'||typeof s.tripped!=='boolean'||s.fluid&&s.chambers!==6)return false;
  if(Object.entries({heat:2147483647,maxHeat:1000000,power:1000000000,emit:2147483647,cold:N.tankCapacity,hot:N.tankCapacity,clock:1}).some(([k,max])=>!Number.isFinite(s[k])||s[k]<0||s[k]>max)||s.clock>=1)return false;
  return s.slots.every((part,i)=>{
    if(!part)return part===null;
    const p=nuclearSpec(part.item);return i%9<N.baseColumns+s.chambers&&p&&Number.isInteger(part.damage)&&part.damage>=0&&part.damage<=(p.capacity??0)&&(part.control===undefined||p.gtCoolant&&typeof part.control==='boolean');
  });
}
