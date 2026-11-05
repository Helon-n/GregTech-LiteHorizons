import { CATALOG } from '../data/catalog.js';
import {isFluid,containerCapacity,acceptsFluid,drainFluid,planFluids} from './fluids.js';

export const SCHEMA=3;
export const OFFLINE_LIMIT=12*3600;
const finite=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const clone=x=>JSON.parse(JSON.stringify(x));
export class Game {
  constructor(saved=null,catalog=CATALOG){
    this.catalog=catalog;
    this.recipeById=new Map(catalog.recipes.map(r=>[r.id,r]));
    this.state={schema:SCHEMA,stage:0,inventory:{},earned:{},devices:[],containers:[],collectors:{},manual:null,gatherProgress:{},lootSeed:Math.floor(Math.random()*4294967296),queue:[],energy:0,produced:0,playtime:0,lastSeen:Date.now(),nextId:1,completed:false,speed:1,log:[]};
    if(saved)this.restore(saved);
  }
  quantity(id){return isFluid(this.catalog,id)?this.state.containers.reduce((n,c)=>n+(c.fluid===id?c.amount:0),0):this.state.inventory[id]||0;}
  owned(id){return this.quantity(id)+this.state.devices.filter(d=>d.type===id).length+this.state.containers.filter(c=>c.type===id).length;}
  capacity(){return Math.max(3200,(this.stage.voltage||8)*20*120);}
  add(stacks,track=true){
    for(const[id,n]of Object.entries(stacks))if(!Object.hasOwn(this.catalog.items,id)||!finite(n))throw Error('物品数量无效');
    const plan=planFluids(this.catalog,this.state.containers,stacks);if(!plan)return false;
    this.state.containers=plan;
    for(const[id,n]of Object.entries(stacks)){if(!isFluid(this.catalog,id))this.state.inventory[id]=this.quantity(id)+n;if(track)this.state.earned[id]=(this.state.earned[id]||0)+n;}
    return true;
  }
  canPay(stacks){return Object.entries(stacks).every(([id,n])=>this.quantity(id)+1e-9>=n);}
  pay(stacks){if(!this.canPay(stacks))return false;for(const[id,n]of Object.entries(stacks)){if(isFluid(this.catalog,id))drainFluid(this.state.containers,id,n);else this.state.inventory[id]=Math.max(0,this.quantity(id)-n);}return true;}
  containerCapacity(c){return containerCapacity(this.catalog,c);}
  acceptsFluid(c,id){return acceptsFluid(this.catalog,c,id);}
  fluidRoom(id){return this.state.containers.reduce((n,c)=>n+((!c.fluid||c.fluid===id)&&this.acceptsFluid(c,id)?Math.max(0,this.containerCapacity(c)-c.amount):0),0);}
  canStore(stacks,inputs={}){return !!planFluids(this.catalog,this.state.containers,stacks,inputs);}
  placeContainer(type){
    const spec=this.catalog.containerTypes[type];
    if(!Object.hasOwn(this.catalog.containerTypes,type)||!spec||spec.migrationOnly||spec.stage>this.state.stage)return {ok:false,message:'容器尚未解锁'};
    if(this.state.containers.length>=10000)return {ok:false,message:'容器数量已达上限'};
    if(!this.pay({[type]:1}))return {ok:false,message:'先在工作台合成空桶或储罐'};
    const container={id:'c'+this.state.nextId++,type,fluid:null,amount:0};this.state.containers.push(container);return {ok:true,container};
  }
  reserveContainer(id,fluid){
    const c=this.state.containers.find(c=>c.id===id);
    if(!c||c.amount>0)return {ok:false,message:'只能更改空容器的流体类型'};
    if(fluid&&!this.acceptsFluid(c,fluid))return {ok:false,message:'此容器不能储存这种流体'};
    c.fluid=fluid||null;return {ok:true};
  }
  removeContainer(id){
    const c=this.state.containers.find(c=>c.id===id);if(!c)return {ok:false,message:'容器不存在'};
    if(c.amount>0)return {ok:false,message:'请先使用或转移容器内的流体'};
    if(c.type!=='legacyTank')this.add({[c.type]:1},false);
    this.state.containers=this.state.containers.filter(x=>x.id!==id);return {ok:true};
  }
  transferFluid(from,to){
    const src=this.state.containers.find(c=>c.id===from),dst=this.state.containers.find(c=>c.id===to);
    if(!src||!dst||src===dst||!src.fluid||src.amount<=0)return {ok:false,message:'请选择有流体的来源和另一个容器'};
    if(!this.acceptsFluid(dst,src.fluid)||(dst.fluid&&dst.fluid!==src.fluid))return {ok:false,message:'容器类型不兼容，不能混装流体'};
    const amount=Math.min(src.amount,this.containerCapacity(dst)-dst.amount);if(amount<=0)return {ok:false,message:'目标容器已满'};
    dst.fluid=src.fluid;dst.amount+=amount;src.amount-=amount;return {ok:true,amount};
  }
  collectDrops(node,batches=1){
    const drops={},skipped={},totals={},ranges=Object.entries(this.dropRanges(node));
    // Each collector and each completed round rolls independently, also during offline simulation.
    for(let batch=0;batch<batches;batch++)for(const[id,{min,max}]of ranges){
      const amount=min===max?min:min+Math.floor(this.nextDropRandom()*(max-min+1));
      totals[id]=(totals[id]||0)+amount;
    }
    for(const[id,requested]of Object.entries(totals)){const received=isFluid(this.catalog,id)?Math.min(requested,this.fluidRoom(id)):requested;if(received>0){this.add({[id]:received});drops[id]=received;}if(received<requested)skipped[id]=requested-received;}
    return {drops,skipped};
  }
  note(text){this.state.log.unshift({text,at:Date.now()});this.state.log=this.state.log.slice(0,40);}
  get stage(){return this.catalog.stages[this.state.stage];}
  nodeAvailable(node){return node.stage<=this.state.stage&&(!['moon','mars','belt'].includes(node.id)||this.owned(node.id==='belt'?'advancedRocket':'rocket')>0);}
  gatherClicks(node){return Math.max(3,Math.ceil(node.seconds*2));}
  gather(id){
    const node=this.catalog.gatherNodes.find(x=>x.id===id);
    if(!node||!this.nodeAvailable(node))return {ok:false,message:'采集点尚未解锁'};
    if(node.stage===0&&!['forest','surface','river'].includes(id)&&!this.owned('flintPick'))return {ok:false,message:'先在制造页制作燧石镐'};
    if(isFluid(this.catalog,node.output)&&this.fluidRoom(node.output)<=0)return {ok:false,message:'需要可用的桶或储罐，且必须有剩余容量'};
    const required=this.gatherClicks(node),clicks=(this.state.gatherProgress[id]||0)+1;
    const completed=clicks>=required,{drops,skipped}=completed?this.collectDrops(node):{drops:{},skipped:{}};
    this.state.gatherProgress[id]=completed?0:clicks;
    return {ok:true,completed,clicks:completed?0:clicks,required,drops,skipped};
  }
  collectorCost(node){const level=this.state.collectors[node.id]?.count||0;return Object.fromEntries(Object.entries(node.cost).map(([id,n])=>[id,Math.ceil(n*1.5**level)]).filter(([,n])=>n>0));}
  buildCollector(id){const node=this.catalog.gatherNodes.find(n=>n.id===id);if(!node||!this.nodeAvailable(node)||!this.owned('flintPick'))return {ok:false,message:'需要解锁采集点并制作燧石镐'};const cost=this.collectorCost(node);if(!this.pay(cost))return{ok:false,message:'采集设备建造材料不足'};this.state.collectors[id]??={count:0,elapsed:0};this.state.collectors[id].count++;this.note('部署自动采集：'+node.name);return {ok:true};}
  availableRecipes(process=null){return this.catalog.recipes.filter(r=>r.stage<=this.state.stage&&(!process||r.process===process));}
  missing(stacks){return Object.entries(stacks).filter(([id,n])=>this.quantity(id)<n).map(([id,n])=>({id,need:n,have:this.quantity(id)}));}
  canBuild(type){const m=this.catalog.machines[type];return !!m&&m.stage<=this.state.stage&&this.canPay(m.cost);}
  build(type){const m=this.catalog.machines[type];if(!m||m.stage>this.state.stage)return{ok:false,message:'机器科技尚未解锁'};if(!this.pay(m.cost))return{ok:false,message:'建造材料不足'};const device={id:'d'+this.state.nextId++,type,recipe:null,job:null,enabled:true,blocked:'请选择配方'};this.state.devices.push(device);this.state.earned[type]=(this.state.earned[type]||0)+1;this.note('建成：'+m.name);return{ok:true,device};}
  assign(deviceId,recipeId){const d=this.state.devices.find(x=>x.id===deviceId),r=this.recipeById.get(recipeId);if(!d)return{ok:false,message:'机器不存在'};if(d.job)return{ok:false,message:'请先强制停止或等待当前批次完成'};if(recipeId===''){d.recipe=null;d.blocked=d.enabled?'请选择配方':'已停止';return{ok:true};}if(!r||r.stage>this.state.stage||!this.catalog.machines[d.type].processes.includes(r.process))return{ok:false,message:'此机器不能执行该配方'};d.recipe=recipeId;d.blocked=d.enabled?'就绪':'已暂停';return{ok:true};}
  toggle(id){const d=this.state.devices.find(x=>x.id===id);if(d)d.enabled=!d.enabled;}
  forceStop(id){
    const d=this.state.devices.find(x=>x.id===id);if(!d)return{ok:false,message:'机器不存在'};
    // Paid inputs and spent energy remain consumed, including fuel that already generated power.
    d.job=null;d.recipe=null;d.enabled=false;d.blocked='已停止';
    return{ok:true};
  }
  dismantle(id){const d=this.state.devices.find(x=>x.id===id);if(!d)return{ok:false,message:'机器不存在'};if(d.job)return{ok:false,message:'请先完成当前批次'};this.add(this.catalog.machines[d.type].cost,false);this.state.devices=this.state.devices.filter(x=>x!==d);return{ok:true};}
  canCraft(r){return r&&r.stage<=this.state.stage&&this.canPay(r.inputs)&&this.canPay(r.tools||{});}
  craft(id,amount=1){const r=this.recipeById.get(id);if(!r||r.process!=='craft'||r.stage>this.state.stage)return{ok:false,message:'需要对应机器执行此配方'};if(this.state.queue.length>=20)return{ok:false,message:'手工队列已满'};if(![1,5,10].includes(amount))return{ok:false,message:'批次数量无效'};const inputs=Object.fromEntries(Object.entries(r.inputs).map(([id,n])=>[id,n*amount]));if(!this.canPay(r.tools||{}))return{ok:false,message:'缺少可重复使用的工具'};if(!this.pay(inputs))return{ok:false,message:'制作材料不足'};this.state.queue.push({recipe:id,remaining:r.seconds,amount});return{ok:true};}
  cancelQueue(index){const q=this.state.queue[index],r=q&&this.recipeById.get(q.recipe);if(!r)return{ok:false,message:'任务不存在'};const refund=Object.fromEntries(Object.entries(r.inputs).map(([id,n])=>[id,n*q.amount]));if(!this.add(refund,false))return {ok:false,message:'流体退料需要足够容器容量'};this.state.queue.splice(index,1);return{ok:true};}
  milestone(){return this.catalog.milestones[this.state.stage];}
  milestoneProgress(){return Object.entries(this.milestone()).map(([id,n])=>({id,need:n,have:Math.max(this.state.earned[id]||0,this.owned(id))}));}
  canAdvance(){return !this.state.completed&&this.milestoneProgress().every(x=>x.have>=x.need);}
  advance(){if(!this.canAdvance())return{ok:false,message:'先完成本阶段目标'};if(this.state.stage===this.catalog.stages.length-1){this.state.completed=true;this.note('星门已建成：格雷的长路完成');return{ok:true,message:'星门已建成！'};}this.state.stage++;this.note('进入 '+this.stage.name+' · '+this.stage.code);return{ok:true,message:'阶段解锁：'+this.stage.name};}
  drops(node){return this.catalog.nodeDrops[node.id]||{[node.output]:node.amount};}
  dropRanges(node){return Object.fromEntries(Object.entries(this.drops(node)).map(([id,n])=>[id,isFluid(this.catalog,id)?{min:n,max:n}:{min:Math.max(id===node.output?1:0,n-1),max:n+1}]));}
  nextDropRandom(){
    // Saved random state keeps future drops consistent after loading and across offline/online steps.
    let value=this.state.lootSeed=(this.state.lootSeed+0x6D2B79F5)>>>0;
    value=Math.imul(value^(value>>>15),value|1);value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  }
  finish(r){if(!this.add(r.outputs))return false;this.state.produced+=Object.values(r.outputs).reduce((a,b)=>a+b,0);return true;}
  tick(dt){
    if(!finite(dt,0,1))throw Error('单步时间必须为 0–1 秒');
    this.state.playtime+=dt;
    for(const[id,c]of Object.entries(this.state.collectors)){const node=this.catalog.gatherNodes.find(n=>n.id===id);if(!this.nodeAvailable(node))continue;c.elapsed+=dt;const period=node.seconds*4;if(c.elapsed>=period){const batches=Math.floor(c.elapsed/period);c.elapsed%=period;const {skipped}=this.collectDrops(node,c.count*batches);c.blocked=Object.keys(skipped).length?'流体容器不足':'运行中';}}
    let budget=dt;
    while(budget>0&&this.state.queue.length){const q=this.state.queue[0],r=this.recipeById.get(q.recipe);const used=Math.min(budget,q.remaining);q.remaining-=used;budget-=used;if(q.remaining<=1e-8){q.remaining=0;if(!this.finish(r))break;if(--q.amount>0)q.remaining=r.seconds;else this.state.queue.shift();}}
    // Generators run before consumers. One physical machine runs one recipe.
    const devices=[...this.state.devices].sort((a,b)=>Number(!!this.recipeById.get(b.recipe)?.generation)-Number(!!this.recipeById.get(a.recipe)?.generation));
    for(const d of devices){
      if(!d.enabled){d.blocked=d.recipe?'已暂停':'已停止';continue;}
      const r=this.recipeById.get(d.recipe);if(!r){d.blocked='请选择配方';continue;}
      if(d.job&&d.job.remaining<=1e-8){if(this.finish(r)){d.job=null;d.blocked='就绪';}else d.blocked='流体输出空间不足';continue;}
      if(!d.job){
        if(r.generation&&this.state.energy>=this.capacity()){d.blocked='储能已满';continue;}
        if(!this.canPay(r.tools||{})){d.blocked='缺少工具';continue;}
        if(!this.canPay(r.inputs)){d.blocked='缺少原料';continue;}
        if(!this.canStore(r.outputs,r.inputs)){d.blocked='流体输出空间不足';continue;}
        this.pay(r.inputs);d.job={remaining:r.seconds};
      }
      const used=Math.min(dt,d.job.remaining),required=(r.power||0)*20*used;
      if(required>this.state.energy+1e-8){d.blocked='电力不足';continue;}
      this.state.energy=Math.max(0,this.state.energy-required);
      if(r.generation)this.state.energy=Math.min(this.capacity(),this.state.energy+r.generation/r.seconds*used);
      d.job.remaining-=used;d.blocked='运行中';
      if(d.job.remaining<=1e-8){d.job.remaining=0;if(this.finish(r))d.job=null;else d.blocked='流体输出空间不足';}
    }
  }
  simulate(seconds){const duration=Math.min(OFFLINE_LIMIT,Math.max(0,seconds));let left=duration;const before=this.state.produced;while(left>1e-8){const dt=Math.min(.5,left);this.tick(dt);left-=dt;}return{seconds:duration,produced:this.state.produced-before};}
  snapshot(){this.state.lastSeen=Date.now();return clone(this.state);}
  restore(raw){
    if(!raw||![2,SCHEMA].includes(raw.schema))throw Error('存档版本不兼容');
    if(!Number.isInteger(raw.stage)||raw.stage<0||raw.stage>=this.catalog.stages.length)throw Error('科技阶段无效');
    const checkStacks=obj=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.entries(obj).every(([id,n])=>Object.hasOwn(this.catalog.items,id)&&finite(n));
    if(!checkStacks(raw.inventory)||!checkStacks(raw.earned)||!Array.isArray(raw.devices)||raw.devices.length>500||!Array.isArray(raw.queue)||raw.queue.length>20)throw Error('存档物品或机器数据无效');
    const ids=new Set();for(const d of raw.devices){const m=this.catalog.machines[d.type];if(!m||typeof d.id!=='string'||ids.has(d.id)||typeof d.enabled!=='boolean')throw Error('存档机器无效');ids.add(d.id);const r=d.recipe&&this.recipeById.get(d.recipe);if(d.recipe&&(!r||!m.processes.includes(r.process)||r.stage>raw.stage))throw Error('存档配方无效');if(d.job&&(!r||!finite(d.job.remaining,0,r.seconds)))throw Error('存档生产批次无效');}
    for(const q of raw.queue){const r=this.recipeById.get(q.recipe);if(!r||r.process!=='craft'||!Number.isInteger(q.amount)||q.amount<1||q.amount>10||!finite(q.remaining,0,r.seconds))throw Error('存档队列无效');}
    if(!raw.collectors||Object.entries(raw.collectors).some(([id,c])=>!this.catalog.gatherNodes.some(n=>n.id===id)||!Number.isInteger(c.count)||c.count<1||c.count>1000||!finite(c.elapsed,0,100)))throw Error('自动采集存档无效');
    const gatherProgress=clone(raw.gatherProgress??{});
    if(!gatherProgress||typeof gatherProgress!=='object'||Array.isArray(gatherProgress)||Object.entries(gatherProgress).some(([id,clicks])=>{const n=this.catalog.gatherNodes.find(n=>n.id===id);return !n||!Number.isInteger(clicks)||!finite(clicks,0,this.gatherClicks(n)-1);}))throw Error('采集进度无效');
    // Convert old schema-2 timers to partial click progress without granting drops.
    if(raw.manual){const n=this.catalog.gatherNodes.find(n=>n.id===raw.manual.id);if(!n||!finite(raw.manual.remaining,.000000001,n.seconds))throw Error('采集存档无效');gatherProgress[n.id]??=Math.min(this.gatherClicks(n)-1,Math.floor((1-raw.manual.remaining/n.seconds)*this.gatherClicks(n)));}
    for(const key of ['energy','produced','playtime','lastSeen','nextId'])if(!finite(raw[key]))throw Error('存档数值无效');
    if(Object.hasOwn(raw,'lootSeed')&&(!Number.isInteger(raw.lootSeed)||!finite(raw.lootSeed,0,4294967295)))throw Error('采集掉落存档无效');
    if(!Array.isArray(raw.log)||raw.log.some(x=>typeof x.text!=='string'||!finite(x.at)))throw Error('存档日志无效');
    const containers=raw.schema===2?[]:clone(raw.containers);
    if(!Array.isArray(containers)||containers.length>10000)throw Error('流体容器存档无效');
    for(const c of containers){
      if(!c||typeof c.id!=='string'||ids.has(c.id)||!Object.hasOwn(this.catalog.containerTypes,c.type)||!finite(c.amount))throw Error('流体容器存档无效');
      ids.add(c.id);
      if(c.type==='legacyTank'&&!finite(c.capacity,1))throw Error('迁移储罐容量无效');
      if(c.amount>this.containerCapacity(c)||(!c.fluid&&c.amount>0)||(c.fluid!==null&&!this.acceptsFluid(c,c.fluid)))throw Error('容器流体或容量无效');
    }
    if(raw.schema===SCHEMA&&Object.keys(raw.inventory).some(id=>isFluid(this.catalog,id)))throw Error('流体必须存放在容器中');
    this.state={...this.state,...clone(raw),schema:SCHEMA,containers,manual:null,gatherProgress,speed:1,log:raw.log.slice(0,40)};
    if(raw.schema===2){
      for(const[id,amount]of Object.entries(this.state.inventory))if(isFluid(this.catalog,id)){
        delete this.state.inventory[id];
        if(amount>0){let cid='c'+this.state.nextId++;while(ids.has(cid))cid='c'+this.state.nextId++;ids.add(cid);this.state.containers.push({id:cid,type:'legacyTank',fluid:id,amount,capacity:Math.max(1000,amount)});}
      }
      if(this.state.containers.length)this.note('旧版散装流体已装入迁移储罐，数量保留。');
    }
    const usedIds=new Set([...ids,...this.state.devices.map(d=>d.id)]);
    this.state.nextId=Math.max(1,Math.ceil(this.state.nextId),...[...usedIds].filter(id=>/^[cd]\d+$/.test(id)).map(id=>Number(id.slice(1))+1));
    this.state.energy=Math.min(this.state.energy,this.capacity());
  }
}
