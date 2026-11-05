// Groups expose shared ports; resources and power limits remain on their members.
const cache=new WeakMap();
function index(game){
  const s=game.state,old=cache.get(game);
  if(old&&old.devices===s.devices&&old.containers===s.containers&&old.groups===s.groups&&old.size===s.devices.length+s.containers.length)return old;
  const result={devices:s.devices,containers:s.containers,groups:s.groups,size:s.devices.length+s.containers.length,
    entities:new Map([...s.devices,...s.containers].map(x=>[x.id,x])),byId:new Map(),membership:new Map()};
  for(const g of s.groups){result.byId.set(g.id,g);for(const id of g.members)result.membership.set(id,g);}
  cache.set(game,result);return result;
}
export const findGroup=(game,id)=>index(game).byId.get(id)||index(game).membership.get(id)||null;
export const endpointId=(game,id)=>findGroup(game,id)?.id||id;
export function endpointMembers(game,id){
  const idx=index(game),g=idx.byId.get(id);
  return g?g.members.map(id=>idx.entities.get(id)).filter(Boolean):idx.entities.has(id)?[idx.entities.get(id)]:[];
}
export const devicePeers=(game,id)=>endpointMembers(game,endpointId(game,id)).filter(d=>game.catalog.machines[d.type]);
export const includesEndpoint=(game,endpoint,id)=>endpoint===id||!!index(game).byId.get(endpoint)?.members.includes(id);
export function fluidEntries(game){
  const idx=index(game),result=game.state.containers.filter(c=>!idx.membership.has(c.id));
  for(const g of game.state.groups.filter(g=>g.kind==='fluid')){
    const members=endpointMembers(game,g.id),first=members[0];if(!first)continue;
    result.push({...first,id:g.id,name:g.name,group:g,fluid:members.find(c=>c.fluid)?.fluid||null,
      amount:members.reduce((n,c)=>n+c.amount,0),capacity:members.reduce((n,c)=>n+game.containerCapacity(c),0)});
  }
  return result;
}
export function deviceEntries(game){
  const idx=index(game),result=game.state.devices.filter(d=>!idx.membership.has(d.id));
  for(const g of game.state.groups.filter(g=>g.kind==='device')){
    const members=endpointMembers(game,g.id),first=members[0];if(!first)continue;
    const d={...first,id:g.id,alias:g.name,group:g,job:members.find(d=>d.job)?.job||null,
      enabled:members.every(d=>d.enabled),hasTask:members.some(d=>d.recipe||d.job),recipe:members.every(d=>d.recipe===first.recipe)?first.recipe:null};
    for(const key of ['eu','steam','water','coal','fuel','batteries','modules','cyclePower'])d[key]=members.reduce((n,d)=>n+d[key],0);
    result.push(d);
  }
  return result;
}
export function bindFluid(game,id,fluid){
  const members=endpointMembers(game,endpointId(game,id));
  if(!members.length||members.some(c=>!game.catalog.containerTypes[c.type]||!game.acceptsFluid(c,fluid)||(c.fluid&&c.fluid!==fluid)))return false;
  for(const c of members)c.fluid=fluid;
  return true;
}
export function takeFluid(game,id,fluid,want){
  let moved=0;
  for(const c of endpointMembers(game,endpointId(game,id))){
    if(c.fluid!==fluid||!game.catalog.containerTypes[c.type])continue;
    const amount=Math.min(want-moved,c.amount);c.amount=Math.max(0,c.amount-amount);moved+=amount;
    if(moved>=want-1e-8)break;
  }
  return moved;
}
export function putFluid(game,id,fluid,want){
  if(!bindFluid(game,id,fluid))return 0;
  let moved=0;
  for(const c of endpointMembers(game,endpointId(game,id))){
    const amount=Math.min(want-moved,Math.max(0,game.containerCapacity(c)-c.amount));c.amount+=amount;moved+=amount;
    if(moved>=want-1e-8)break;
  }
  return moved;
}
function rewriteLinks(game,from,to){
  for(const d of game.state.devices){
    if(from.has(d.supply.source))d.supply.source=to;
    if(from.has(d.output))d.output=to;
    for(const fluid of Object.keys(d.fluidOutputs))if(from.has(d.fluidOutputs[fluid]))d.fluidOutputs[fluid]=to;
  }
}
function reconcilePorts(game){
  for(const p of game.state.devices.filter(d=>['generator','dyson'].includes(game.catalog.machines[d.type].energy?.kind))){
    if(p.output&&endpointMembers(game,p.output).some(b=>!includesEndpoint(game,b.supply?.source,p.id)))p.output=null;
  }
  for(const b of game.state.devices.filter(d=>game.catalog.machines[d.type].energy?.kind==='battery')){
    const producers=endpointMembers(game,b.supply.source);
    if(producers.length&&producers.every(p=>p.output&&!includesEndpoint(game,p.output,b.id)))b.supply.source=null;
  }
}
export function saveGroup(game,kind,name,ids,id=null){
  if(!['fluid','device'].includes(kind)||typeof name!=='string'||!name.trim()||name.trim().length>24||/[\u0000-\u001f\u007f]/.test(name))return {ok:false,message:'请输入 1–24 字的组名'};
  if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.length<2)return {ok:false,message:'请至少选择两个成员'};
  const existing=game.state.groups.find(g=>g.id===id);
  if(id&&(!existing||existing.kind!==kind))return {ok:false,message:'分组不存在'};
  const selected=new Set(ids),all=kind==='fluid'?game.state.containers:game.state.devices,members=all.filter(x=>selected.has(x.id));
  if(members.length!==ids.length||members.some(x=>{const g=findGroup(game,x.id);return g&&g.id!==id;}))return {ok:false,message:'成员不存在或已在其他组中'};
  const first=members[0];
  if(kind==='fluid'){
    const fluids=new Set(members.map(c=>c.fluid).filter(Boolean)),fluid=[...fluids][0];
    if(fluids.size>1||fluid&&members.some(c=>!game.acceptsFluid(c,fluid)))return {ok:false,message:'同组容器只能储存同一种兼容流体'};
    if(fluid)for(const c of members)c.fluid=fluid;
  }else{
    if(members.some(d=>d.type!==first.type||d.energyTier!==first.energyTier))return {ok:false,message:'设备组需要相同机型和电压等级'};
    for(const d of members){d.supply={...first.supply};d.output=first.output;d.fluidOutputs={...first.fluidOutputs};}
  }
  const group={id:id||'g'+game.state.nextId++,kind,name:name.trim(),members:members.map(x=>x.id)};
  game.state.groups=[...game.state.groups.filter(g=>g.id!==id),group];
  rewriteLinks(game,new Set(group.members),group.id);
  reconcilePorts(game);
  return {ok:true,group};
}
export function dissolveGroup(game,id){
  const g=game.state.groups.find(g=>g.id===id);if(!g)return {ok:false,message:'分组不存在'};
  rewriteLinks(game,new Set([id]),g.members[0]);
  game.state.groups=game.state.groups.filter(g=>g.id!==id);reconcilePorts(game);return {ok:true};
}
export function validateGroups(catalog,groups,devices,containers){
  if(!Array.isArray(groups)||groups.length>5250)throw Error('分组存档无效');
  const entities=new Map([...devices,...containers].map(x=>[x.id,x])),used=new Set(),groupIds=new Set();
  for(const g of groups){
    if(!g||typeof g.id!=='string'||!/^g\d+$/.test(g.id)||groupIds.has(g.id)||!['fluid','device'].includes(g.kind)||typeof g.name!=='string'||!g.name.trim()||g.name.length>24||/[\u0000-\u001f\u007f]/.test(g.name)||!Array.isArray(g.members)||g.members.length<2||g.members.length>10000)throw Error('分组数据无效');
    groupIds.add(g.id);
    const members=g.members.map(id=>entities.get(id));
    for(const x of members){if(!x||used.has(x.id)||(g.kind==='fluid'?!catalog.containerTypes[x.type]:!catalog.machines[x.type]))throw Error('分组成员无效');used.add(x.id);}
    const first=members[0];
    if(g.kind==='fluid'){
      const fluids=new Set(members.map(c=>c.fluid).filter(Boolean)),fluid=[...fluids][0];
      if(fluids.size>1||fluid&&members.some(c=>catalog.containerTypes[c.type].accepts&&!catalog.containerTypes[c.type].accepts.includes(fluid)))throw Error('容器组流体不兼容');
    }else if(members.some(d=>d.type!==first.type||d.energyTier!==first.energyTier||JSON.stringify(d.supply)!==JSON.stringify(first.supply)||d.output!==first.output||JSON.stringify(d.fluidOutputs||{})!==JSON.stringify(first.fluidOutputs||{})))throw Error('设备组端口或机型不一致');
  }
}
