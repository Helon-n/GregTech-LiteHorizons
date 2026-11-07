import {BEC_REFERENCE as B} from '../data/bec-reference.js';

export const becKind=(game,d)=>game.catalog.machines[d.type]?.bec;
export const isCondensate=(game,id)=>game.catalog.items[id]?.kind==='condensate';
export const becHost=(game,d)=>game.state.devices.find(h=>h.id===d.becHost&&becKind(game,h)==='storage');
export const condensateQuantity=(game,id)=>game.state.devices.reduce((n,d)=>n+(d.becStorage?.contents[id]??0),0);
export function initializeBEC(game,d){
  if(becKind(game,d)==='storage')d.becStorage??={strength:1,contents:{},clock:0,ready:false};
  if(becKind(game,d)==='assembler')d.nanites??={};
}
export function naniteInfo(d){
  const installed=B.nanites.filter(n=>(d.nanites?.[n.item]??0)>0);
  return {tier:Math.min(...installed.map(n=>n.tier)),count:Math.min(30720,Object.values(d.nanites??{}).reduce((n,v)=>n+v,0))};
}
export function becStep(d,r){
  const slots=r.requirements?.becSlots??[];
  if(!slots.length)return null;
  const ticks=Math.round(r.seconds*20),base=Math.floor(ticks/slots.length),remainder=ticks%slots.length;
  const elapsed=(d.job?d.job.duration-d.job.remaining:0)*20;
  let end=0;
  for(let i=0;i<slots.length;i++){
    end+=base+(i<remainder?1:0);
    if(elapsed<end-1e-7)return {...slots[i],index:i,end:end/20};
  }
  return {...slots.at(-1),index:slots.length-1,end:r.seconds};
}
export function becSpeed(game,d,r){
  const slot=becStep(d,r),info=naniteInfo(d);if(!slot||!info.count||info.tier<slot.tier)return 0;
  const valid=new Set(Object.keys(r.inputs).filter(id=>isCondensate(game,id)));
  const pollution=Object.keys(becHost(game,d)?.becStorage?.contents??{}).filter(id=>!valid.has(id)).length;
  return pollution>3?0:info.count/2**Math.abs(slot.tier-info.tier)/(pollution+1);
}
export function becFailure(game,d,r){
  if(!becKind(game,d)||becKind(game,d)==='storage')return '';
  if(!becHost(game,d)?.becStorage?.ready)return '请连接已供电的凝聚态存储器';
  if(r?.requirements?.becSlots&&!becSpeed(game,d,r)){
    const slot=becStep(d,r),info=naniteInfo(d);
    return !info.count||info.tier<slot.tier?'第 '+(slot.index+1)+' 槽需要 '+game.catalog.items[slot.nanite].name:'网络混入超过三种无关凝聚态，请分开存储';
  }
  return '';
}
export function runBECStorage(game,d,dt,pull){
  const s=d.becStorage;s.ready=false;
  if(!d.enabled){s.contents={};d.blocked='已停止 · 凝聚态已散失';return;}
  d.eu+=pull();const demand=s.strength*20*dt;
  if(d.eu+1e-8<demand){s.contents={};d.blocked='维持磁场缺电 · 凝聚态已散失';return;}
  d.eu=Math.max(0,d.eu-demand);s.ready=true;s.clock+=dt;
  while(s.clock>=1){
    s.clock-=1;
    if(Object.values(s.contents).reduce((n,v)=>n+v,0)>s.strength){
      for(const [id,n]of Object.entries(s.contents)){s.contents[id]=Math.floor(n*.9);if(!s.contents[id])delete s.contents[id];}
    }
  }
  d.blocked=Object.values(s.contents).reduce((n,v)=>n+v,0)>s.strength?'超过场容量 · 每秒衰减 10%':'磁场稳定';
}
export function finishCondensate(game,d,outputs){
  const contents=becHost(game,d)?.becStorage;
  if(!contents?.ready)return false;
  for(const [id,n]of Object.entries(outputs)){
    if(!isCondensate(game,id)||!Number.isSafeInteger(n)||!Number.isSafeInteger((contents.contents[id]??0)+n))return false;
  }
  for(const [id,n]of Object.entries(outputs)){contents.contents[id]=(contents.contents[id]??0)+n;game.state.earned[id]=(game.state.earned[id]??0)+n;}
  return true;
}
export function changeBEC(game,id,action,value){
  const d=game.state.devices.find(d=>d.id===id);if(!d||!becKind(game,d))return {ok:false,message:'请逐台配置凝聚态设备'};
  if(action==='nanite'){
    const item=value.item,n=value.count,old=d.nanites?.[item]??0;
    if(becKind(game,d)!=='assembler'||!B.nanites.some(row=>row.item===item)||!Number.isInteger(n)||!n)return {ok:false,message:'纳米蜂群设置无效'};
    if(n>0&&(naniteInfo(d).count+n>30720||!game.pay({[item]:n})))return {ok:false,message:'纳米蜂群不足或已达到 30,720 个上限'};
    if(n<0){if(old< -n)return {ok:false,message:'已安装数量不足'};game.add({[item]:-n},false);}
    d.nanites[item]=old+n;if(!d.nanites[item])delete d.nanites[item];return {ok:true};
  }
  if(d.job)return {ok:false,message:'请先结束批次或强制停止'};
  if(action==='host'){
    if(becKind(game,d)==='storage'||value&&!game.state.devices.some(h=>h.id===value&&becKind(game,h)==='storage'))return {ok:false,message:'凝聚态存储器不存在'};
    d.becHost=value||null;return {ok:true};
  }
  if(action==='strength'&&d.becStorage&&Number.isSafeInteger(value)&&value>=1&&value<=Number.MAX_SAFE_INTEGER/20){d.becStorage.strength=value;return {ok:true};}
  if(action==='clear'&&d.becStorage&&!d.enabled){d.becStorage.contents={};return {ok:true};}
  return {ok:false,message:'请先暂停设备再调整'};
}
export function validBEC(game,d,devices){
  const kind=becKind(game,d),s=d.becStorage;
  if(s&&(!kind||kind!=='storage'||!Number.isSafeInteger(s.strength)||s.strength<1||s.strength>Number.MAX_SAFE_INTEGER/20||!s.contents||Array.isArray(s.contents)||Object.entries(s.contents).some(([id,n])=>!isCondensate(game,id)||!Number.isSafeInteger(n)||n<1)||!Number.isFinite(s.clock)||s.clock<0||s.clock>=1||typeof s.ready!=='boolean'))return false;
  if(d.becHost!==undefined&&d.becHost!==null&&(!['generator','assembler'].includes(kind)||!devices.some(h=>h.id===d.becHost&&becKind(game,h)==='storage')))return false;
  if(d.nanites!==undefined&&(kind!=='assembler'||!d.nanites||Array.isArray(d.nanites)||Object.entries(d.nanites).some(([id,n])=>!B.nanites.some(row=>row.item===id)||!Number.isSafeInteger(n)||n<1)||Object.values(d.nanites).reduce((n,v)=>n+v,0)>30720))return false;
  return true;
}
