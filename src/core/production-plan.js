import {requirementFailure} from './technology.js';
import {recipeEntries} from './recipe-browser.js';
import {energySpec,runtime} from './energy.js';
import {guaranteedOutputs} from './recipe-yields.js';
import {machineSupportsRecipe} from './technology.js';
import {componentCount} from './components.js';

const EPS=1e-8,MAX_STEPS=512,MAX_COUNT=1e9;
const indexes=new WeakMap();
function recipeIndex(game){
  let cached=indexes.get(game.catalog);
  if(!cached){
    const entries=recipeEntries(game.catalog,game.catalog.stages.length-1),byId=new Map(entries.map(r=>[r.id,r])),byOutput=new Map();
    for(const r of entries)if(r.process!=='build'&&!r.dynamic&&!r.dynamicAmount)for(const id of Object.keys(guaranteedOutputs(r))){
      if(!byOutput.has(id))byOutput.set(id,[]);byOutput.get(id).push(r);
    }
    cached={entries,byId,byOutput};indexes.set(game.catalog,cached);
  }
  return cached;
}
export function planRecipe(game,id){return recipeIndex(game).byId.get(id);}
export function recipeMachines(game,r){
  return Object.values(game.catalog.machines).filter(m=>m.stage<=game.state.stage&&machineSupportsRecipe(m,r)&&!['boiler','generator','dyson','solar','battery'].includes(m.energy?.kind));
}
export function planRoutes(game,id){
  return (recipeIndex(game).byOutput.get(id)||[]).filter(r=>r.stage<=game.state.stage&&(r.process==='craft'||recipeMachines(game,r).length));
}
export function planGatherNodes(game,id){return game.catalog.gatherNodes.filter(n=>game.nodeAvailable(n)&&Object.hasOwn(game.drops(n),id));}
export function planSupplyMachines(game,id){return Object.values(game.catalog.machines).filter(m=>m.stage<=game.state.stage&&['boiler','generator','dyson','solar'].includes(m.energy?.kind)&&game.catalog.recipes.some(r=>r.stage<=game.state.stage&&machineSupportsRecipe(m,r)&&(r.outputs[id]>0||(r.energyOutputs??[]).includes(id))));}
const count=n=>{if(!Number.isFinite(n)||n<0||n>MAX_COUNT)throw Error('材料需求过大，请减少目标批数');return n;};

// A stock ledger is shared by every branch: yields, byproducts and reusable
// tools must never be counted twice. Only real storage enters the ledger.
export function createProductionPlan(game,recipeId,batches=1,choices={},favorites=[]){
  const root=planRecipe(game,recipeId);
  if(root?.dynamic==='godforge')throw Error('请先在造物主模块生成配料，再根据本批配料安排加工');
  if(root?.dynamicAmount)throw Error('此设备按实时蓄热连续转换，请在工厂配置输入和输出容器');
  if(!root||root.stage>game.state.stage||!Number.isInteger(batches)||batches<1||batches>999)throw Error('请选择已解锁配方和 1–999 批');
  if(!Object.keys(root.outputs).length||root.process!=='craft'&&root.process!=='build'&&!recipeMachines(game,root).length)throw Error('发电与锅炉请在工厂配置，不按普通合成批次安排');
  const stock=new Map(),reserved=new Map(),wear=new Map(),baths=new Set(),missing=new Map(),nodes=[],steps=[],preferred=new Set(favorites);
  const routesCache=new Map(),gatherCache=new Map(),scores=new Map();
  const routesFor=id=>{if(!routesCache.has(id))routesCache.set(id,planRoutes(game,id));return routesCache.get(id);};
  const gathersFor=id=>{if(!gatherCache.has(id))gatherCache.set(id,planGatherNodes(game,id));return gatherCache.get(id);};
  const quantity=id=>{if(!stock.has(id))stock.set(id,game.quantity(id));return stock.get(id);};
  const plus=(id,n)=>{const value=Math.max(0,quantity(id)+n);if(!Number.isFinite(value)||value>Number.MAX_SAFE_INTEGER)throw Error('材料总量过大，请拆分目标');stock.set(id,value);};
  const available=(id,tool)=>Math.max(0,quantity(id)-(tool?0:reserved.get(id)||0));
  const score=r=>{if(!scores.has(r.id))scores.set(r.id,(preferred.has(r.id)?-10000:0)+(r.process==='craft'?0:game.state.devices.some(d=>machineSupportsRecipe(game.catalog.machines[d.type],r)&&runtime(game,d,r).valid)?-20:40)+r.stage*2+r.seconds/1000);return scores.get(r.id);};
  // Detect circular conversion routes before choosing one. Stock and gathered
  // resources terminate the search; a favourite is a preference, not a bypass.
  let routeVisits=0;
  function viable(r,path,depth=0){
    if(++routeVisits>10000||depth>32||path.has(r.id))return false;
    const next=new Set(path);next.add(r.id);
    return [...Object.keys({...r.inputs,...r.tools}),...[r.requirements?.researchData,r.requirements?.bioCulture].filter(Boolean)].every(id=>quantity(id)>0||r.containerTools?.[id]&&game.toolQuantity(id,r)>0||gathersFor(id).length||routesFor(id).some(p=>viable(p,next,depth+1)));
  }
  function ensure(id,amount,parent,depth,path,tool=false,deployed=0){
    if(nodes.length>=MAX_STEPS||depth>48)throw Error('配方树过长，请拆分目标或更换循环配方');
    count(amount);
    const have=Math.min(amount,available(id,tool)+deployed),shortage=Math.max(0,amount-have);
    const node={key:String(nodes.length),parent,depth,item:id,amount,have,shortage,tool,recipe:null,batches:0,reason:''};nodes.push(node);
    if(shortage>EPS){
      const routes=routesFor(id).filter(r=>!path.has(r.id)).sort((a,b)=>score(a)-score(b));
      const explicit=choices[id],chosen=explicit==='gather'?null:explicit?routes.find(r=>r.id===explicit):gathersFor(id).length?null:routes.find(r=>viable(r,path))||routes[0];
      if(chosen){node.recipe=chosen.id;node.batches=count(Math.ceil((shortage-EPS)/guaranteedOutputs(chosen)[id]));make(chosen,node.batches,node.key,depth+1,path);}
      else{
        node.reason=planGatherNodes(game,id).length?'需要采集':planSupplyMachines(game,id).length?'需要产能设备供给':routes.length||explicit&&explicit!=='gather'?'请更换循环或失效配方':(recipeIndex(game).byOutput.get(id)||[]).length?'配方或加工设备尚未解锁':'需要自行取得';
        const key=id+':'+node.reason,entry=missing.get(key)||{item:id,amount:0,reason:node.reason};entry.amount=count(entry.amount+shortage);missing.set(key,entry);
        // Borrow missing leaves only in the preview, never in the game state.
        plus(id,shortage);
      }
    }
    if(tool)reserved.set(id,Math.max(reserved.get(id)||0,Math.max(0,amount-deployed)));else plus(id,-amount);
  }
  function make(r,n,parent,depth,path){
    if(steps.length>=MAX_STEPS||path.has(r.id))throw Error('配方存在循环，请更换加工路线');
    const next=new Set(path);next.add(r.id);
    if(r.requirements?.researchData)ensure(r.requirements.researchData,1,parent,depth,next,true);
    if(r.requirements?.bioCulture&&!game.state.devices.some(d=>d.bioVat?.culture===r.requirements.bioCulture&&machineSupportsRecipe(game.catalog.machines[d.type],r)))ensure(r.requirements.bioCulture,1,parent,depth,next,true);
    if(r.bath&&!baths.has(r.bath.fluid)){
      baths.add(r.bath.fluid);
      const stored=Math.max(0,...game.state.devices.filter(d=>machineSupportsRecipe(game.catalog.machines[d.type],r)&&d.boardBath?.fluid===r.bath.fluid).map(d=>d.boardBath.amount));
      // Reserve an initial full bath. It is a startup charge, not an ingredient
      // consumed per board. Existing fluid inside a compatible module counts.
      const needed=Math.max(0,1000000-stored);if(needed)ensure(r.bath.fluid,needed,parent,depth,next);
    }
    for(const [id,value]of Object.entries(r.tools||{})){
      if(r.toolWear?.[id]){
        if(!wear.has(id))wear.set(id,{loose:(game.state.components??[]).filter(c=>c.kind==='mill'&&c.item===id).reduce((n,c)=>n+c.life,0),installed:new Map(game.state.devices.filter(d=>(d.toolLife?.[id]??0)>0).map(d=>[d.id,{device:d,life:d.toolLife[id]}]))});
        const pool=wear.get(id);let remaining=n;
        for(const entry of pool.installed.values())if(machineSupportsRecipe(game.catalog.machines[entry.device.type],r)&&runtime(game,entry.device,r).valid&&!requirementFailure(game,entry.device,r)){
          const used=Math.min(remaining,entry.life);entry.life-=used;remaining-=used;if(remaining<=EPS)break;
        }
        const used=Math.min(remaining,pool.loose);pool.loose-=used;remaining-=used;
        const life=r.toolWear[id],fresh=Math.ceil(Math.max(0,remaining)/life);
        if(fresh)ensure(id,fresh,parent,depth,next);
        pool.loose+=fresh*life-remaining;
      }
      else ensure(id,value,parent,depth,next,true,r.containerTools?.[id]?game.toolQuantity(id,r)-game.quantity(id):0);
    }
    for(const [id,value]of Object.entries(r.inputs))ensure(id,count(value*n),parent,depth,next);
    steps.push({recipe:r.id,batches:n,done:0});
    if(r.process!=='build')for(const[id,value]of Object.entries(guaranteedOutputs(r)))plus(id,count(value*n));
  }
  const item=Object.keys(root.outputs)[0];nodes.push({key:'0',parent:null,depth:0,item,amount:count(root.outputs[item]*batches),have:0,shortage:0,tool:false,recipe:root.id,batches,reason:''});
  make(root,batches,'0',1,new Set());
  return {root:recipeId,batches,nodes,steps,missing:[...missing.values()]};
}

function taskMatches(plan,task){return task&&task.plan===plan.id&&Number.isInteger(task.step)&&plan.steps[task.step];}
export function planInFlight(game){return game.state.queue.some(q=>q.planTask)||game.state.devices.some(d=>d.planTask);}
export function startProductionPlan(game,recipe,batches,choices,favorites){
  const old=game.state.productionPlan;
  if(old&&!old.cancelled&&old.steps.some(s=>s.done<s.batches)||planInFlight(game))return {ok:false,message:'请先完成或取消当前制作计划，并等待在制批次结束'};
  try{
    const preview=createProductionPlan(game,recipe,batches,choices,favorites);
    game.state.productionPlan={id:'p'+game.state.nextId++,root:recipe,batches,steps:preview.steps,paused:false,cancelled:false,status:'等待安排'};
    game.note('已安排配方树制作计划');return {ok:true};
  }catch(error){return {ok:false,message:error.message};}
}
export function completePlanBatch(game,task){
  const p=game.state.productionPlan,s=p&&taskMatches(p,task);if(s){s.done=Math.min(s.batches,s.done+1);game.planClock=.5;}
}
export function finishPlanDevice(game,d){
  if(!d?.planTask)return;
  completePlanBatch(game,d.planTask);
  const p=game.state.productionPlan,s=p&&taskMatches(p,d.planTask);
  if(s&&s.done<s.batches&&!p.paused&&!p.cancelled)return;
  delete d.planTask;d.recipe=null;d.enabled=false;d.ignited=false;d.blocked='计划批次完成';
}
export function releaseUnstartedPlanDevices(game){
  for(const d of game.state.devices)if(d.planTask&&!d.job){delete d.planTask;d.recipe=null;d.enabled=false;d.blocked='计划已停止安排';}
}
export function interruptPlanTask(game,entity){
  if(!entity.planTask)return;
  const p=game.state.productionPlan;if(p&&taskMatches(p,entity.planTask)&&!p.cancelled){p.paused=true;p.status='已暂停 · 生产任务被手动调整';releaseUnstartedPlanDevices(game);}
  delete entity.planTask;
}
export function tickProductionPlan(game,dt){
  const p=game.state.productionPlan;if(!p)return;
  game.planClock=(game.planClock||0)+dt;if(game.planClock<.5)return;game.planClock=0;
  const flight=game.state.queue.find(q=>taskMatches(p,q.planTask))||game.state.devices.find(d=>taskMatches(p,d.planTask));
  if(p.cancelled){p.status=flight?'已取消 · 当前批次完成后停止':'已取消';return;}
  if(p.paused){p.status=flight?'已暂停 · 当前批次继续完成':'已暂停';return;}
  const at=p.steps.findIndex(s=>s.done<s.batches);
  if(at<0){p.status='制作完成';return;}
  if(flight){p.status=flight.id?(flight.blocked==='运行中'?'机器加工中':flight.blocked||'等待机器'):'手工制作中';return;}
  const step=p.steps[at],r=planRecipe(game,step.recipe),label=id=>game.catalog.items[id]?.name||id;
  if(!r||r.stage>game.state.stage){p.status='等待解锁配方';return;}
  const tool=Object.entries(r.tools||{}).find(([id,n])=>game.toolQuantity(id,r)+(r.toolWear?.[id]?componentCount(game,id):0)+EPS<n&&(!r.toolWear?.[id]||!game.state.devices.some(d=>machineSupportsRecipe(game.catalog.machines[d.type],r)&&(d.toolLife?.[id]??0)>0)));
  if(tool){p.status='缺少工具：'+label(tool[0]);return;}
  const input=Object.entries(r.inputs).find(([id,n])=>game.quantity(id)+EPS<n);
  if(input){p.status='缺少原料：'+label(input[0]);return;}
  if(r.process==='build'){
    const out=game.build(r.machine);if(out.ok){step.done++;p.status='设备已建成';}else p.status=out.message;return;
  }
  const task={plan:p.id,step:at};
  if(r.process==='craft'){
    if(!game.canStore(r.outputs,r.inputs)){p.status='等待流体容器空间';return;}
    const out=game.craft(r.id,1);if(out.ok){game.state.queue.at(-1).planTask=task;p.status='已加入手工队列';}else p.status=out.message;return;
  }
  const compatible=game.state.devices.filter(d=>machineSupportsRecipe(game.catalog.machines[d.type],r)&&!['boiler','generator','dyson','solar','battery'].includes(energySpec(game,d)?.kind)&&runtime(game,d,r).valid);
  const ready=d=>{const kind=energySpec(game,d)?.kind;return !['consumer','steam'].includes(kind)?3:(kind==='steam'?d.steam>0:d.eu>0)?2:d.supply.source?1:0;};
  const conditioned=compatible.filter(d=>!requirementFailure(game,d,r));
  const free=conditioned.filter(d=>!d.recipe&&!d.job&&!d.planTask).sort((a,b)=>ready(b)-ready(a));
  const d=free.find(d=>game.canStoreBatch(d,r)&&Object.entries(r.tools||{}).every(([id,n])=>game.quantity(id)+(r.toolWear?.[id]?componentCount(game,id):0)+EPS>=n||r.toolWear?.[id]&&(d.toolLife?.[id]??0)>0));
  if(!d){p.status=compatible.length&&!conditioned.length?requirementFailure(game,compatible[0],r):free.length?'等待流体输出容器空间':compatible.length?'等待空闲机器':'需要兼容机器：'+recipeMachines(game,r).map(m=>m.name).join(' / ');return;}
  delete d.stopAfterBatch;d.recipe=r.id;d.planTask=task;d.enabled=true;d.ignited=false;d.blocked='等待开工';p.status='已派工';
}

// One marker owns the current machine step or a single paid hand-crafting batch.
// Retain paid in-flight work on load; older saves simply have no plan markers.
export function validateProductionPlan(game,raw){
  const p=raw.productionPlan;
  if(p!=null){
    if(typeof p!=='object'||typeof p.id!=='string'||!/^p\d+$/.test(p.id)||!Number.isSafeInteger(Number(p.id.slice(1)))||!planRecipe(game,p.root)||!Number.isInteger(p.batches)||p.batches<1||p.batches>999||typeof p.paused!=='boolean'||typeof p.cancelled!=='boolean'||typeof p.status!=='string'||p.status.length>300||!Array.isArray(p.steps)||!p.steps.length||p.steps.length>MAX_STEPS)throw Error('制作计划存档无效');
    for(const s of p.steps){
      const r=s&&planRecipe(game,s.recipe),supported=r&&(r.process==='craft'||r.process==='build'||Object.values(game.catalog.machines).some(m=>m.stage<=raw.stage&&machineSupportsRecipe(m,r)&&!['boiler','generator','dyson','solar','battery'].includes(m.energy?.kind)));
      if(!supported||r.stage>raw.stage||!Object.keys(r.outputs).length||!Number.isInteger(s.batches)||s.batches<1||s.batches>MAX_COUNT||!Number.isInteger(s.done)||s.done<0||s.done>s.batches)throw Error('制作步骤存档无效');
    }
    if(p.steps.at(-1).recipe!==p.root||p.steps.at(-1).batches!==p.batches)throw Error('制作计划目标无效');
  }
  let markers=0;
  for(const entity of [...raw.devices,...raw.queue])if(entity.planTask!=null){
    const s=p&&taskMatches(p,entity.planTask);
    if(!s||s.recipe!==entity.recipe||s.done>=s.batches||entity.amount!==undefined&&entity.amount!==1||!entity.amount&&['boiler','generator','dyson','solar','battery'].includes(game.catalog.machines[entity.type]?.energy?.kind)||++markers>1)throw Error('制作计划在制批次无效');
  }
}
