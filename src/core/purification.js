// GT5 5.09.54.265 purification units. Sensors and metering valves are automated
// for the idle game; amounts, cycle length and probability are source values.
import {PURIFICATION_REFERENCE as R} from '../data/purification-reference.js';
import {validBatchOutputs} from './recipe-yields.js';

const safe=n=>Number.isSafeInteger(n)&&n>=0;
const rand=(game,n)=>Math.floor(game.nextDropRandom()*n);
export const purificationTier=(game,d)=>game.catalog.machines[d?.type]?.purification??0;
export const purificationHost=(game,d)=>game.state.devices.find(h=>h.id===d.purificationHost&&purificationTier(game,h)==='host');
const config=d=>({dose:d.purificationDose??900000,superconductor:d.purificationSuperconductor??0,sequence:d.purificationSequence??[0,1,2,3,4,5]});
const quantity=(game,d,id)=>game.inputQuantity(id,d.fluidInputs?.[id]);
const take=(game,d,id,max)=>{const n=Math.max(0,Math.min(max,Math.floor(quantity(game,d,id))));return n&&game.payInputs(d,{[id]:n})?n:0;};
export function purificationFluids(game,d){
  const tier=purificationTier(game,d),r=game.recipeById.get(d.recipe);
  return [...new Set([...(r?.purification?[R.waters[tier]]:[]),...(tier===3?[R.pac]:tier===4?[R.acid]:tier===5?[R.plasma,R.coolant]:tier===7?[...R.gases.map(a=>a[0]),R.superconductors[config(d).superconductor][0],R.neutronium,R.coolant]:tier===8?[R.infinity]:[])])];
}
export function purificationOutputs(game,d){
  const tier=purificationTier(game,d);
  if(typeof tier!=='number'||!tier)return [];
  return [R.distilled,...R.waters.slice(1,tier),...(tier===3?[R.waste]:[])];
}
export function purificationFailure(game,d){
  const h=purificationHost(game,d),tier=purificationTier(game,d);
  if(!h)return '请连接纯净水厂主控';
  if(!h.enabled)return '纯净水厂主控已停止';
  if(h.energyTier<d.energyTier)return '纯净水厂供电电压不足';
  if(tier===6&&!d.purificationLenses)return '请装入九片处理透镜';
  return '';
}
export function beginPurification(game,d,r){
  const t=r.purification.tier,c=config(d),boost=quantity(game,d,R.waters[t])>=90;
  if(boost)game.payInputs(d,{[R.waters[t]]:90});
  const s=d.job.purification={ticks:0,fraction:0,chance:Math.min(100,r.purification.chance+(boost?15:0)),settled:false};
  if(t===1&&rand(game,100)<R.filterDamage)game.pay({[R.filter]:1});
  if(t===3)s.chemical=0,s.dose=c.dose;
  if(t===4)s.ph=Math.round((7+(rand(game,2000)-1000)/1000*2.5)*100)/100;
  if(t===5)Object.assign(s,{temperature:0,cycles:0,cooling:false,ruined:false});
  if(t===6)Object.assign(s,{lens:0,swaps:0,until:0});
  if(t===7){
    s.signal=rand(game,8)+(rand(game,5)===0?8:0);s.inserted={};s.multiplier=1;s.superconductor=c.superconductor;
  }
  if(t===8){
    const first=rand(game,6),second=rand(game,5);
    Object.assign(s,{pair:[first,second>=first?second+1:second],sequence:[...c.sequence],inserted:[],match:-1,bonus:0});
  }
}
function updateSecond(game,d,s,tier){
  if(tier===3)s.chemical+=take(game,d,R.pac,Math.max(0,s.dose-s.chemical));
  if(tier===4){
    // Meter only the exact quantity requested by the pH sensor.
    if(s.ph<7){const n=Math.min(Math.round((7-s.ph)*100),Math.floor(game.quantity(R.alkaline)));if(n&&game.pay({[R.alkaline]:n}))s.ph+=n*.01;}
    else if(s.ph>7){const amount=Math.min(Math.round((s.ph-7)*100),Math.floor(quantity(game,d,R.acid)/10))*10;s.ph-=take(game,d,R.acid,amount)/1000;}
    s.ph=Math.round(Math.max(0,Math.min(14,s.ph))*100)/100;
  }
  if(tier===5){
    s.temperature=Math.max(0,s.temperature+(s.cooling?-5*take(game,d,R.coolant,100):100*take(game,d,R.plasma,10)));
    if(s.temperature>12500)s.ruined=true;
    if(!s.cooling&&s.temperature>=10000)s.cooling=true;
    else if(s.cooling&&s.temperature===0){s.cooling=false;s.cycles++;}
  }
  if(tier===7){
    const n=s.signal,requests=[];
    if(!(n&8)){
      if(!n)requests.push([R.coolant,10000]);
      if(n&1)requests.push(R.gases[(n>>1)&3]);
      if(n&2){const [id,amount,multiplier]=R.superconductors[s.superconductor];requests.push([id,amount]);s.multiplier=multiplier;}
      if(n&4)requests.push([R.neutronium,4608]);
    }
    for(const [id,amount]of requests)s.inserted[id]=(s.inserted[id]??0)+take(game,d,id,amount-(s.inserted[id]??0));
  }
  if(tier===8&&s.match<0&&s.inserted.length<s.sequence.length){
    const index=s.sequence[s.inserted.length],id=R.catalysts[index],duplicates=s.inserted.filter(n=>n===index).length,cost=144*2**duplicates;
    if(game.quantity(id)<1||quantity(game,d,R.infinity)<cost)return;
    if(!game.payInputs(d,{[id]:1,[R.infinity]:cost}))return;
    s.inserted.push(index);
    if(s.inserted.length>1){
      const at=s.inserted.length-2,a=s.inserted[at],b=index;
      if(a!==b&&s.pair.includes(a)&&s.pair.includes(b)){s.match=at;s.bonus=2000;}
    }
  }
}
export function advancePurification(game,d,r,seconds){
  const s=d.job.purification;if(!s||s.settled)return;
  s.fraction+=seconds*20;const ticks=Math.floor(s.fraction+1e-8);s.fraction=Math.max(0,s.fraction-ticks);
  for(let i=0;i<ticks;i++){
    s.ticks++;
    if(r.purification.tier===6){
      if(s.until>0){if(--s.until===0){s.lens++;if(s.lens===9)s.until=R.cycleTicks+1;}}
      else if(d.purificationLenses){s.swaps++;s.until=75+rand(game,225);}
    }
    if(s.ticks%20===0)updateSecond(game,d,s,r.purification.tier);
  }
}
export function purificationChance(r,s){
  const t=r.purification.tier;
  if(t===3){const levels=Math.floor(s.chemical/100000),overflow=s.chemical-levels*100000;return Math.min(100,s.chance+levels*10)*2**(-10*overflow/100000);}
  if(t===4)return Math.abs(s.ph-7)<=.050001?100:0;
  if(t===5)return s.ruined?0:s.cycles*33+s.chance;
  if(t===6)return s.swaps*10+s.chance;
  if(t===7){
    const requests={};const n=s.signal;
    if(!(n&8)){
      if(!n)requests[R.coolant]=10000;
      if(n&1){const[id,amount]=R.gases[(n>>1)&3];requests[id]=amount;}
      if(n&2){const[id,amount]=R.superconductors[s.superconductor];requests[id]=amount;}
      if(n&4)requests[R.neutronium]=4608;
    }
    return Object.keys(s.inserted).every(id=>Object.hasOwn(requests,id))&&Object.entries(requests).every(([id,n])=>s.inserted[id]===n)?100:0;
  }
  if(t===8)return s.match>=0?100:0;
  return s.chance;
}
export function settlePurification(game,d,r){
  const s=d.job?.purification;if(!s||s.settled)return;
  const tier=r.purification.tier,success=rand(game,10000)/100<purificationChance(r,s);
  let outputs=success?{...d.job.outputs}:{};
  if(!success&&rand(game,2))for(let t=tier;t>0;t--)if(rand(game,2)){outputs[t===1?R.distilled:R.waters[t-1]]=900;break;}
  if(tier===3){const n=Math.floor(s.chemical/100000)*100000;if(n)outputs[R.waste]=n;}
  if(tier===7&&success)outputs[R.waters[7]]=Math.trunc(900*s.multiplier);
  if(tier===8){
    if(s.bonus)outputs[R.baryonic]=(outputs[R.baryonic]??0)+s.bonus;
    for(let i=0;i<s.inserted.length;i++)if(s.match<0||i!==s.match&&i!==s.match+1){const id=R.catalysts[s.inserted[i]];outputs[id]=(outputs[id]??0)+1;}
  }
  s.settled=true;s.success=success;d.job.outputs=outputs;
}
export function changePurification(game,id,action,value){
  const d=game.state.devices.find(d=>d.id===id),t=purificationTier(game,d);
  if(!d||!t||t==='host')return {ok:false,message:'请选择水处理单元'};
  if(d.job)return {ok:false,message:'请先完成当前批次'};
  if(action==='host'){
    if(value&&!game.state.devices.some(h=>h.id===value&&purificationTier(game,h)==='host'))return {ok:false,message:'纯净水厂主控不存在'};
    d.purificationHost=value||null;
  }else if(action==='dose'&&t===3&&safe(value)&&value<=1000000&&value%100000===0)d.purificationDose=value;
  else if(action==='superconductor'&&t===7&&safe(value)&&value<5)d.purificationSuperconductor=value;
  else if(action==='lenses'&&t===6){
    const stacks=Object.fromEntries(R.lenses.map(id=>[id,1]));
    if(d.purificationLenses){game.add(stacks,false);d.purificationLenses=false;}
    else {if(!game.pay(stacks))return {ok:false,message:'需要九种处理透镜各一片'};d.purificationLenses=true;}
  }else if(action==='catalyst'&&t===8&&safe(value)&&value<6){const seq=[...config(d).sequence];if(seq.length>=32)return {ok:false,message:'序列最多 32 个位置'};d.purificationSequence=[...seq,value];}
  else if(action==='undo'&&t===8)d.purificationSequence=config(d).sequence.slice(0,-1);
  else if(action==='clear'&&t===8)d.purificationSequence=[];
  else return {ok:false,message:'设置无效'};
  return {ok:true};
}
export function validPurification(game,d,r){
  const t=purificationTier(game,d),fields=['purificationHost','purificationDose','purificationSuperconductor','purificationLenses','purificationSequence'];
  if(!t)return !fields.some(k=>d[k]!==undefined)&&!d.job?.purification;
  const owners={purificationHost:[1,2,3,4,5,6,7,8],purificationDose:[3],purificationSuperconductor:[7],purificationLenses:[6],purificationSequence:[8]};
  if(fields.some(k=>d[k]!==undefined&&!owners[k].includes(t)))return false;
  if(d.purificationHost!==undefined&&d.purificationHost!==null&&(typeof d.purificationHost!=='string'||!/^d\d+$/.test(d.purificationHost)))return false;
  if(d.purificationDose!==undefined&&(!safe(d.purificationDose)||d.purificationDose>1000000||d.purificationDose%100000))return false;
  if(d.purificationSuperconductor!==undefined&&(!safe(d.purificationSuperconductor)||d.purificationSuperconductor>4))return false;
  if(d.purificationLenses!==undefined&&typeof d.purificationLenses!=='boolean')return false;
  if(d.purificationSequence!==undefined&&(!Array.isArray(d.purificationSequence)||d.purificationSequence.length>32||d.purificationSequence.some(n=>!safe(n)||n>5)))return false;
  const j=d.job,s=j?.purification;if(!j)return true;
  if(!r?.purification||r.purification.tier!==t||!s||typeof s!=='object'||Array.isArray(s)||!safe(s.ticks)||s.ticks>2400||!Number.isFinite(s.fraction)||s.fraction<0||s.fraction>=1||![r.purification.chance,Math.min(100,r.purification.chance+15)].includes(s.chance)||typeof s.settled!=='boolean')return false;
  if(t===3&&(!safe(s.chemical)||!safe(s.dose)||s.dose>1000000||s.chemical>s.dose))return false;
  if(t===4&&(!Number.isFinite(s.ph)||s.ph<0||s.ph>14))return false;
  if(t===5&&(!safe(s.temperature)||s.temperature>13000||!safe(s.cycles)||s.cycles>4||typeof s.cooling!=='boolean'||typeof s.ruined!=='boolean'))return false;
  if(t===6&&(!d.purificationLenses||!safe(s.swaps)||s.swaps>9||!safe(s.lens)||s.lens>9||!safe(s.until)||s.until>2401))return false;
  if(t===7){
    if(!safe(s.signal)||s.signal>15||!safe(s.superconductor)||s.superconductor>4||!s.inserted||Array.isArray(s.inserted)||!Number.isFinite(s.multiplier)||s.multiplier<1||s.multiplier>2)return false;
    const allowed=new Map([...R.gases,...R.superconductors.map(a=>[a[0],a[1]]),[R.coolant,10000],[R.neutronium,4608]]);
    if(Object.entries(s.inserted).some(([id,n])=>!allowed.has(id)||!safe(n)||n>allowed.get(id)))return false;
  }
  if(t===8){
    if(!Array.isArray(s.pair)||s.pair.length!==2||new Set(s.pair).size!==2||s.pair.some(n=>!safe(n)||n>5)||!Array.isArray(s.sequence)||s.sequence.length>32||s.sequence.some(n=>!safe(n)||n>5)||!Array.isArray(s.inserted)||s.inserted.length>s.sequence.length||s.inserted.some((n,i)=>n!==s.sequence[i])||!Number.isInteger(s.match)||s.match< -1||s.match>=Math.max(0,s.inserted.length-1)||![0,2000].includes(s.bonus))return false;
    if(s.match>=0&&(s.inserted[s.match]===s.inserted[s.match+1]||!s.pair.includes(s.inserted[s.match])||!s.pair.includes(s.inserted[s.match+1])||s.bonus!==2000))return false;
  }
  if(!s.settled)return validBatchOutputs(r,j.outputs);
  if(typeof s.success!=='boolean'||j.remaining>1e-8||!j.outputs||Array.isArray(j.outputs))return false;
  const envelope={...r.outputs,...Object.fromEntries(purificationOutputs(game,d).map(id=>[id,900]))};
  if(t===3)envelope[R.waste]=1000000;
  if(t===7)envelope[R.waters[7]]=1800;
  if(t===8){envelope[R.baryonic]=2500;for(const id of R.catalysts)envelope[id]=32;}
  return Object.entries(j.outputs).every(([id,n])=>safe(n)&&n>0&&n<=(envelope[id]??0));
}
