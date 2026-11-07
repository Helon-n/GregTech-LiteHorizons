import {BEAMLINE_REFERENCE as B} from '../data/beamline-reference.js';
import {rollOutputs} from './recipe-yields.js';

export const beamKind=(game,d)=>game.catalog.machines[d?.type]?.beamline;
export function initializeBeam(game,d){if(beamKind(game,d))d.beam??={target:null,buffer:{},input:null,cached:null,cycles:10,targetEnergy:1000000,boost:0,activeBoost:0,modules:[],filter:null,step:0,clock:0};}
export function resetBeamAcceleration(d){if(d.beam){d.beam.input=null;d.beam.cached=null;d.beam.initial=null;d.beam.step=0;d.beam.clock=0;d.beam.waiting=0;d.beam.inputLife=0;d.beam.power=0;}}
export function ageBeamPackets(game,dt){for(const d of game.state.devices)if(d.beam?.input){d.beam.inputLife=Math.max(0,(d.beam.inputLife??1.25)-dt);if(!d.beam.inputLife)d.beam.input=null;}}
const same=(a,b)=>a&&b&&['particle','energy','rate','focus'].every(k=>a[k]===b[k]);
const packetValid=p=>p&&B.particles[p.particle]&&Number.isFinite(p.energy)&&p.energy>0&&p.energy<=2e9&&Number.isInteger(p.rate)&&p.rate>0&&p.rate<=2147483647&&Number.isFinite(p.focus)&&p.focus>=0&&p.focus<=100;
function send(game,d,packet){
  const t=game.state.devices.find(x=>x.id===d.beam.target);
  if(!t||!t.enabled||!packetValid(packet))return;
  if(beamKind(game,t)==='crafter')t.beam.buffer[packet.particle]=Math.min(2000000000,(t.beam.buffer[packet.particle]??0)+packet.rate);
  else if(beamKind(game,t)==='collider'){t.beam.input={...packet};t.beam.inputLife=1.25;}
}
export function finishBeamSource(game,d,r,outputs){
  const actual=Object.fromEntries(Object.entries(outputs).filter(([id])=>game.catalog.items[id].kind!=='beam'));
  if(!game.add(actual,true,d.fluidOutputs))return false;
  const s=r.beamSource,p=B.particles[s.particle],v=8*4**d.energyTier;
  const energy=Math.fround(Math.min(s.maxEnergy*(1-Math.pow(1.001,-s.ratio*(v-r.power))),p.maxSourceEnergy));
  send(game,d,{particle:s.particle,rate:s.rate,energy,focus:s.focus});return true;
}
export function beamSourceRuntime(d,r){return {seconds:r.seconds,power:Math.trunc((8*4**d.energyTier)*15/16),steamPerSecond:0,valid:r.power<=8*4**d.energyTier*15/16};}
function draw(game,d,power,dt,pull){
  d.eu+=pull();const amount=power*20*dt;
  if(d.eu+1e-8<amount){d.blocked='束流设备供电不足';return false;}
  d.eu=Math.max(0,d.eu-amount);return true;
}
export function runBeamCrafter(game,d,r,dt,pull){
  if(!d.enabled){d.blocked='已暂停';return;}
  if(!r?.beamNeeds){d.blocked='请选择束流合成配方';return;}
  if(r.power>8*4**d.energyTier*64){d.blocked='机器供电功率不足';return;}
  d.eu+=pull();pull=()=>0;
  d.beam.clock+=dt;let ticks=Math.floor((d.beam.clock+1e-8)*20);d.beam.clock=Math.max(0,d.beam.clock-ticks/20);
  while(ticks-->0&&d.enabled&&d.recipe===r.id){
    if(d.job&&d.job.remaining<=1e-8){if(!game.finish(r,d)){d.blocked='等待输出容器空间';return;}d.job=null;if(!d.enabled||d.recipe!==r.id)return;}
    if(!d.job){
      if(!game.hasTools(r)||!game.canPayInputs(d,r.inputs)){d.blocked='缺少原料或工具';return;}
      if(!game.canStoreBatch(d,r)){d.blocked='请配置产物容器';return;}
      // Materials are committed once; a missing beam pauses the same job.
      if(d.eu<r.power){d.eu+=pull();if(d.eu<r.power){d.blocked='束流合成机供电不足';return;}}
      game.payInputs(d,r.inputs);d.job={duration:r.seconds,remaining:r.seconds,outputs:rollOutputs(game,r),beamConsumed:[0,0]};
    }
    if(!draw(game,d,r.power,.05,pull))return;
    for(let i=0;i<2;i++){
      const q=r.beamNeeds[i],n=Math.min(d.beam.buffer[q.particle]??0,q.amount-d.job.beamConsumed[i]);
      d.beam.buffer[q.particle]=(d.beam.buffer[q.particle]??0)-n;d.job.beamConsumed[i]+=n;
    }
    d.job.remaining=r.beamNeeds.reduce((n,q,i)=>n+q.amount-d.job.beamConsumed[i],0)/20;
    d.blocked=d.job.remaining?'等待粒子束流':'等待输出';
  }
  if(d.job?.remaining<=1e-8&&game.finish(r,d))d.job=null;
}
const cyclePower=(p,step)=>Math.trunc(524288*(step+1)**2*p.rate);
const booster=(mode)=>mode===1?'quarkGluonPlasma':mode===2?'magMatterMolten':null;
export function runCollider(game,d,dt,pull){
  const s=d.beam;
  if(!d.enabled){resetBeamAcceleration(d);d.blocked='已暂停';return;}
  d.eu+=pull();pull=()=>0;
  s.clock=Math.min(1,s.clock+dt);
  if(s.clock<1-1e-8)return;
  // A packet is consumed once, including while preparing the next cycle.
  const input=s.input;if(!input){s.waiting=(s.waiting??0)+dt;if(s.waiting>1.25)resetBeamAcceleration(d);d.blocked='等待粒子源输入';return;}
  s.waiting=0;
  if(!B.particles[input.particle].accelerates){resetBeamAcceleration(d);d.blocked='输入粒子不能加速';return;}
  if(s.cached&&!same(s.initial,input)){s.cached=null;s.step=0;}
  const first=!s.cached,mode=first?s.boost:s.activeBoost,p={...(first?input:s.cached)};
  const fuel=booster(mode),fuelAmount=p.rate,accelerating=!first&&s.step<s.cycles;
  if(first&&mode)p.energy=1e9;
  if(accelerating){
    if(p.energy<s.targetEnergy)p.energy=Math.fround(Math.min(1e9,p.energy+524288*(s.step+1)**2*20*.0001));
    else p.rate=Math.min(2147483647,p.rate<15000?Math.ceil(p.rate*Math.fround(1.3)):p.rate+Math.ceil((p.rate*(Math.fround(1.3)-1))**(mode===1?.7:mode===2?.9:.5)));
  }
  const cost=cyclePower(p,s.step+(accelerating?1:0));s.power=cost;
  if(cost>8*4**d.energyTier*64){d.blocked='加速周期所需功率超出输入上限';return;}
  if(fuel&&!game.canPayInputs(d,{[fuel]:fuelAmount})){d.blocked='缺少助推流体';return;}
  if(!draw(game,d,cost,1,pull))return;
  if(fuel)game.payInputs(d,{[fuel]:fuelAmount});
  s.input=null;s.clock=0;
  s.cached=p;
  if(first){s.initial={...input};s.activeBoost=mode;s.step=0;d.blocked='准备加速';return;}
  if(accelerating){
    s.step++;d.blocked='加速 '+s.step+' / '+s.cycles;return;
  }
  for(const module of s.modules){
    const pool=B.modules[module].particles.map(k=>[k,B.particles[k]]).filter(([,q])=>p.energy*2/1000>=Math.max(q.mass,.5)&&q.weight>0);
    let pick=game.nextDropRandom()*pool.reduce((n,[,q])=>n+q.weight,0);
    for(const [key,q]of pool){pick-=q.weight;if(pick<0){if(!s.filter||s.filter===key)send(game,d,{...p,energy:p.energy*2,particle:key});break;}}
  }
  d.blocked='对撞中 · '+p.rate+' 粒子 / 秒';
}
export function changeBeam(game,id,action,value){
  const d=game.state.devices.find(d=>d.id===id),kind=beamKind(game,d);if(!kind)return {ok:false,message:'请选择束流设备'};
  const s=d.beam;
  if(action==='target'){
    if(value&&!game.state.devices.some(t=>t.id===value&&t.id!==id&&['crafter','collider'].includes(beamKind(game,t))))return {ok:false,message:'束流目标不存在'};
    const target=game.state.devices.find(t=>t.id===value);
    if(beamKind(game,target)==='collider'&&game.state.devices.some(t=>t.id!==id&&t.beam?.target===value))return {ok:false,message:'对撞机输入端已连接粒子源，请先断开原连接'};
    s.target=value||null;return {ok:true};
  }
  if(action==='filter'&&kind==='collider'&&(!value||B.particles[value])){s.filter=value||null;return {ok:true};}
  if(d.enabled||d.job)return {ok:false,message:'请先暂停并结束当前批次'};
  if(action==='module'&&kind==='collider'&&B.modules[value]){
    const at=s.modules.indexOf(value),item=B.modules[value].casing;
    if(at>=0){s.modules.splice(at,1);game.add({[item]:1},false);}
    else{if(!game.pay({[item]:1}))return {ok:false,message:'缺少对应探测器外壳'};s.modules.push(value);}
  }else if(action==='cycles'&&kind==='collider'&&Number.isInteger(value)&&value>=0&&value<=256)s.cycles=value;
  else if(action==='energy'&&kind==='collider'&&Number.isFinite(value)&&value>=1&&value<=1e9)s.targetEnergy=value;
  else if(action==='boost'&&kind==='collider'&&[0,1,2].includes(value))s.boost=value;
  else if(action==='clear')s.buffer={};
  else return {ok:false,message:'束流设置无效'};
  resetBeamAcceleration(d);return {ok:true};
}
export const beamRefund=d=>Object.fromEntries((d.beam?.modules??[]).map(k=>[B.modules[k].casing,1]));
export function validBeam(game,d,r,devices=game.state.devices){
  const kind=beamKind(game,d),s=d.beam;if(!kind)return s===undefined&&!d.job?.beamConsumed;
  if(!s||typeof s!=='object'||!s.buffer||Array.isArray(s.buffer)||Object.entries(s.buffer).some(([k,n])=>!B.particles[k]||!Number.isInteger(n)||n<0||n>2e9)||s.target!==null&&(typeof s.target!=='string'||!/^d\d+$/.test(s.target)))return false;
  if(s.target){const t=devices.find(t=>t.id===s.target);if(!t||t.id===d.id||!['crafter','collider'].includes(beamKind(game,t))||beamKind(game,t)==='collider'&&devices.some(x=>x.id!==d.id&&x.beam?.target===s.target))return false;}
  if(!Array.isArray(s.modules)||new Set(s.modules).size!==s.modules.length||s.modules.some(k=>!B.modules[k])||kind!=='collider'&&s.modules.length||![0,1,2].includes(s.boost)||![0,1,2].includes(s.activeBoost)||!Number.isInteger(s.cycles)||s.cycles<0||s.cycles>256||!Number.isFinite(s.targetEnergy)||s.targetEnergy<1||s.targetEnergy>1e9||!Number.isInteger(s.step)||s.step<0||s.step>s.cycles||!Number.isFinite(s.clock)||s.clock<0||s.clock>1.000001||s.filter!==null&&!B.particles[s.filter])return false;
  for(const key of ['input','cached','initial'])if(s[key]!==undefined&&s[key]!==null&&!packetValid(s[key]))return false;
  if(kind!=='collider'&&['input','cached','initial'].some(k=>s[k]!=null)||kind!=='crafter'&&Object.values(s.buffer).some(n=>n>0))return false;
  if(s.cached&&!s.initial||s.step&&!s.cached)return false;
  for(const [key,max]of [['waiting',1.500001],['inputLife',1.25],['power',1e20]])if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<0||s[key]>max))return false;
  if(d.job?.beamConsumed){const q=d.job.beamConsumed;return kind==='crafter'&&r?.beamNeeds&&Array.isArray(q)&&q.length===2&&q.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=r.beamNeeds[i].amount)&&Math.abs(d.job.remaining-r.beamNeeds.reduce((n,x,i)=>n+x.amount-q[i],0)/20)<1e-8;}
  return !d.job||kind!=='crafter';
}
