// Used components remain physical objects with their remaining life. They are
// kept separately from stackable new items, so dismantling cannot repair them.
import {NUCLEAR_REFERENCE as NUCLEAR} from '../data/nuclear-reference.js';
const millCapacities=new WeakMap();
export function componentCapacity(game,item,kind){
  if(kind==='nuclear')return NUCLEAR.parts[item]?.capacity?NUCLEAR.parts[item].capacity+1:0;
  if(kind==='lavaFilter'&&item==='lavaFilter')return 100;
  if(kind==='rotor')return game.catalog.items[item]?.rotor?.durability??0;
  if(kind==='mill'){
    let capacities=millCapacities.get(game.catalog);
    if(!capacities){capacities=new Map();for(const r of game.catalog.recipes)for(const[id,life]of Object.entries(r.toolWear??{}))capacities.set(id,Math.max(life,capacities.get(id)??0));millCapacities.set(game.catalog,capacities);}
    return capacities.get(item)??0;
  }
  return 0;
}
export function componentCount(game,item){return (game.state.components??[]).filter(c=>c.item===item&&c.life>0).length;}
export function takeComponent(game,item,kind){
  const stored=game.state.components??=[],at=stored.findIndex(c=>c.kind===kind&&c.item===item&&c.life>0);
  if(at>=0)return stored.splice(at,1)[0];
  const life=componentCapacity(game,item,kind);
  return life&&game.pay({[item]:1})?{item,kind,life}:null;
}
export function returnComponents(game,d){
  game.state.components??=[];
  for(const life of d.rotor?.lives??[d.rotor?.life])if(life>0)game.state.components.push({item:d.rotor.item,life,kind:'rotor'});
  if(d.thermalFilter?.life>0)game.state.components.push({...d.thermalFilter,kind:'lavaFilter'});
  for(const[item,life]of Object.entries(d.toolLife??{}))if(life>0)game.state.components.push({item,life,kind:'mill'});
  delete d.rotor;delete d.thermalFilter;d.toolLife={};
}
export function setRotor(game,id,value){
  const d=game.state.devices.find(d=>d.id===id);
  if(!d||game.catalog.machines[d.type]?.energy?.cycle!=='turbine')return {ok:false,message:'请展开成员，逐台装入转子'};
  if(d.enabled||d.turbine?.power>0)return {ok:false,message:'请先强制停止涡轮'};
  if(game.catalog.machines[d.type].energy.rotorSlots===12){
    const item=value.startsWith('used:')?game.state.components[Number(value.slice(5))]?.item:value;
    if(value&&(!game.catalog.items[item]?.rotor||game.quantity(item)+componentCount(game,item)<12))return {ok:false,message:'XL 涡轮需要 12 个相同材质和尺寸的转子'};
    const next=value?Array.from({length:12},()=>takeComponent(game,item,'rotor')):[];
    for(const life of d.rotor?.lives??[])if(life>0)game.state.components.push({item:d.rotor.item,life,kind:'rotor'});
    if(next.length)d.rotor={item,kind:'rotor',lives:next.map(c=>c.life),life:Math.min(...next.map(c=>c.life))};else delete d.rotor;
    return {ok:true};
  }
  let next=null;
  if(value){
    const at=value.startsWith('used:')?Number(value.slice(5)):-1;
    if(at>=0){
      const c=game.state.components[at];
      if(!Number.isInteger(at)||!c||c.kind!=='rotor')return {ok:false,message:'转子已被取用，请重新选择'};
      next=game.state.components.splice(at,1)[0];
    }else{
      if(!game.catalog.items[value]?.rotor)return {ok:false,message:'请选择涡轮转子'};
      next=takeComponent(game,value,'rotor');
      if(!next)return {ok:false,message:'仓库中没有这个转子'};
    }
  }
  if(d.rotor?.life>0)game.state.components.push({...d.rotor,kind:'rotor'});
  if(next)d.rotor=next;else delete d.rotor;
  return {ok:true};
}
export function validateComponents(game,components){
  if(!Array.isArray(components)||components.length>10000)throw Error('设备耗材存档无效');
  for(const c of components){
    const max=c&&componentCapacity(game,c.item,c.kind);
    if(!c||!max||!Number.isSafeInteger(c.life)||c.life<1||c.life>max)throw Error('设备耗材寿命无效');
    if(c.control!==undefined&&(c.kind!=='nuclear'||!NUCLEAR.parts[c.item]?.gtCoolant||typeof c.control!=='boolean'))throw Error('冷却单元状态无效');
  }
}
