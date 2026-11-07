import {isEOH,changeEOH,validEOH,eohRefund} from './eoh.js';
import {validAura} from './magic.js';
import {changeBeam,validBeam,beamRefund,finishBeamSource,resetBeamAcceleration} from './beamline.js';
import {becKind,becHost,isCondensate,condensateQuantity,finishCondensate,changeBEC,validBEC} from './bec.js';
import {changeSpin,validSpin,spinRecipe} from './spinmatron.js';
import {foundryTier,changeFoundry,validFoundry,foundryRefund} from './foundry.js';
import {LATE_MACHINES_REFERENCE as LATE} from '../data/late-machines-reference.js';
import { CATALOG } from '../data/catalog.js';
import {isFluid,containerCapacity,acceptsFluid,drainFluid,planFluids} from './fluids.js';
import {findGroup,endpointId,endpointMembers,devicePeers,includesEndpoint,fluidEntries,deviceEntries,bindFluid,takeFluid,putFluid,saveGroup,dissolveGroup,validateGroups} from './groups.js';
import {ENERGY_REFERENCE as ENERGY} from '../data/energy-reference.js';
import {energySpec,energyCapacity,initializeEnergy,runtime,sourceOptions,setSupply,tickMachines,batteryItem,boilerProfile,boilerSteam,boilerSolidFuels,generatorFuel,voltage} from './energy.js';
import {migrateMaterialRecipes} from './material-migration.js';
import {validBatchOutputs} from './recipe-yields.js';
import {migrateIndustry} from './industry-migration.js';
import {migrateCatalogIdentities} from './identity-migration.js';
import {SOLID_FUELS} from '../data/industry-catalog.js';
import {COILS} from '../data/technology-catalog.js';
import {installCoil,setMachineLocation,machineSupportsRecipe} from './technology.js';
import {flushBoardBath,BATH_CAPACITY} from './board-bath.js';
import {componentCapacity,returnComponents,setRotor,validateComponents} from './components.js';
import {validThermalCycle} from './thermal-boiler.js';
import {godforgeKind,changeGodforge,validGodforge} from './godforge.js';
import {PURIFICATION_REFERENCE as PURIFICATION} from '../data/purification-reference.js';
import {changePurification,validPurification,settlePurification,purificationOutputs} from './purification.js';
import {exoticRecipe,exoticOutputFluids,validExotic} from './exotic.js';
import {validNaquadah,naquadahRecipe} from './naquadah.js';
import {validSolarTower} from './solar-tower.js';
import {RTG_REFERENCE as RTG} from '../data/rtg-reference.js';
import {NUCLEAR_REFERENCE as NUCLEAR} from '../data/nuclear-reference.js';
import {changeNuclear,validNuclear,nuclearRefund} from './nuclear.js';
import {validSmeltery} from './smeltery.js';
import {bioRecipe,validBioVat} from './biochemistry.js';
import {startProductionPlan,completePlanBatch,finishPlanDevice,tickProductionPlan,validateProductionPlan,releaseUnstartedPlanDevices,interruptPlanTask} from './production-plan.js';

export const SCHEMA=4;
export const OFFLINE_LIMIT=12*3600;
const finite=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const clone=x=>JSON.parse(JSON.stringify(x));
export class Game {
  constructor(saved=null,catalog=CATALOG){
    this.catalog=catalog;
    this.recipeById=new Map(catalog.recipes.map(r=>[r.id,r]));
    this.recipeOptionsCache=new Map();
    this.state={schema:SCHEMA,materialRulesVersion:catalog.materialRulesVersion??0,industryRulesVersion:catalog.industryRulesVersion??0,stage:0,inventory:{},components:[],earned:{},devices:[],containers:[],groups:[],collectors:{},manual:null,gatherProgress:{},lootSeed:Math.floor(Math.random()*4294967296),queue:[],energy:0,produced:0,playtime:0,lastSeen:Date.now(),nextId:1,completed:false,speed:1,log:[]};
    if(saved)this.restore(saved);
  }
  quantity(id){if(isCondensate(this,id))return condensateQuantity(this,id);return isFluid(this.catalog,id)?this.state.containers.reduce((n,c)=>n+(c.fluid===id?c.amount:0),0):this.state.inventory[id]||0;}
  owned(id){return this.quantity(id)+this.state.devices.filter(d=>d.type===id).length+this.state.containers.filter(c=>c.type===id).length;}
  toolQuantity(id,r){return this.quantity(id)+(r?.containerTools?.[id]?this.state.containers.filter(c=>c.type===id).length:0);}
  missingTools(r){return Object.entries(r?.tools??{}).filter(([id,n])=>this.toolQuantity(id,r)+1e-9<n).map(([id,need])=>({id,need,have:this.toolQuantity(id,r)}));}
  hasTools(r){return !this.missingTools(r).length;}
  capacity(){return this.state.devices.reduce((n,d)=>n+energyCapacity(this,d),0);}
  deviceRuntime(d,r=this.recipeById.get(d.recipe)){return runtime(this,d,r);}
  installCoil(id,item){return installCoil(this,id,item);}
  setRotor(id,value){return setRotor(this,id,value);}
  changeGodforge(id,action,value){return changeGodforge(this,id,action,value);}
  changePurification(id,action,value){return changePurification(this,id,action,value);}
  changeEOH(id,action,value){return changeEOH(this,id,action,value);}
  changeBeam(id,action,value){return changeBeam(this,id,action,value);}
  changeBEC(id,action,value){return changeBEC(this,id,action,value);}
  changeSpin(id,item,remove=false){return changeSpin(this,id,item,remove);}
  changeFoundry(id,slot,code){return changeFoundry(this,id,slot,code);}
  changeNuclear(id,action,value){return changeNuclear(this,id,action,value);}
  deviceRecipe(d){return bioRecipe(this,d,naquadahRecipe(this,d,exoticRecipe(this,d,this.recipeById.get(d.recipe))));}
  setTurbineFit(id,loose){
    const peers=devicePeers(this,id);
    if(typeof loose!=='boolean'||!peers.length||peers.some(d=>energySpec(this,d)?.cycle!=='turbine'))return {ok:false,message:'请选择涡轮'};
    if(peers.some(d=>d.enabled||d.turbine?.power>0))return {ok:false,message:'请先强制停止涡轮'};
    for(const d of peers)d.looseFit=loose;return {ok:true};
  }
  setMachineLocation(id,location){return setMachineLocation(this,id,location);}
  supplyOptions(d,mode=d.supply.mode){return sourceOptions(this,d,mode);}
  setSupply(id,mode,source){return setSupply(this,id,mode,source);}
  setFluidInput(id,fluid,target){
    const peers=devicePeers(this,id);target=target?endpointId(this,target):null;
    if(!peers.length||!isFluid(this.catalog,fluid))return {ok:false,message:'设备或流体不存在'};
    const tanks=target?endpointMembers(this,target):[];
    if(target&&(!tanks.length||tanks.some(c=>!this.catalog.containerTypes[c.type]||!this.acceptsFluid(c,fluid)||(c.fluid&&c.fluid!==fluid))))return {ok:false,message:'请选择兼容的流体容器'};
    if(target&&!bindFluid(this,target,fluid))return {ok:false,message:'容器内的流体不兼容'};
    for(const d of peers){if(target)d.fluidInputs[fluid]=target;else delete d.fluidInputs[fluid];}return {ok:true};
  }
  inputQuantity(id,target){return target?endpointMembers(this,target).reduce((n,c)=>n+(this.catalog.containerTypes[c.type]&&c.fluid===id?c.amount:0),0):this.quantity(id);}
  flushBoardBath(id){
    const peers=devicePeers(this,id);if(!peers.length)return {ok:false,message:'设备不存在'};
    for(const d of peers){const result=flushBoardBath(this,d);if(!result.ok)return result;}
    return {ok:true};
  }
  setBathFlush(id,percent){
    const peers=devicePeers(this,id);
    if(!peers.length||peers.some(d=>d.type!=='nanochipBoardProcessor')||!Number.isInteger(percent)||percent<1||percent>100)return {ok:false,message:'自动排液阈值需要为 1–100%'};
    for(const d of peers)d.bathFlushPercent=percent;return {ok:true};
  }
  canPayInputs(d,inputs){return Object.entries(inputs).every(([id,n])=>(isCondensate(this,id)?becHost(this,d)?.becStorage?.contents[id]??0:isFluid(this.catalog,id)?this.inputQuantity(id,d.fluidInputs[id]):this.quantity(id))+1e-9>=n);}
  payInputs(d,inputs){if(!this.canPayInputs(d,inputs))return false;for(const[id,n]of Object.entries(inputs)){if(isCondensate(this,id)){const contents=becHost(this,d).becStorage.contents;contents[id]-=n;if(!contents[id])delete contents[id];}else if(isFluid(this.catalog,id)&&d.fluidInputs[id])takeFluid(this,d.fluidInputs[id],id,n);else this.pay({[id]:n});}return true;}
  canStoreBatch(d,r){if(r.eoh&&!planFluids(this.catalog,this.state.containers,{spacetimeMolten:Math.floor(14400*2**(r.eoh.rocketTier+1))},{},d.fluidOutputs,this.state.groups))return false;if(r.process==='condensateGenerate')return !!becHost(this,d)?.becStorage?.ready;return !!planFluids(this.catalog,this.state.containers,r.outputs,r.inputs,d.fluidOutputs,this.state.groups,d.fluidInputs);}
  groupFor(id){return findGroup(this,id);}
  members(id){return endpointMembers(this,id);}
  containerEntries(){return fluidEntries(this);}
  deviceEntries(){return deviceEntries(this);}
  saveGroup(kind,name,members,id=null){return saveGroup(this,kind,name,members,id);}
  dissolveGroup(id){return dissolveGroup(this,id);}
  reserveFluid(id,fluid){return bindFluid(this,id,fluid);}
  takeFluid(id,fluid,amount){return takeFluid(this,id,fluid,amount);}
  putFluid(id,fluid,amount){return putFluid(this,id,fluid,amount);}

  renameDevice(id,alias){
    const d=this.state.devices.find(d=>d.id===id);
    if(!d)return {ok:false,message:'设备不存在'};
    if(typeof alias!=='string'||alias.trim().length>24||/[\u0000-\u001f\u007f]/.test(alias))return {ok:false,message:'别名最多 24 个字，不能包含换行'};
    d.alias=alias.trim();return {ok:true};
  }
  setEnergyOutput(id,target){
    target=target?endpointId(this,target):null;
    const peers=devicePeers(this,id),d=peers[0],kind=d&&energySpec(this,d)?.kind;
    if(kind==='boiler')return this.setSteamOutput(id,target);
    if(!['generator','dyson','solar'].includes(kind)&&!isEOH(this,d))return {ok:false,message:'此设备没有电力输出'};
    const source=endpointId(this,id),boxes=target?endpointMembers(this,target):[];
    if(target&&(!boxes.length||boxes.some(b=>energySpec(this,b)?.kind!=='battery'||peers.some(p=>voltage(p)>voltage(b)))))return {ok:false,message:'请选择兼容电压的电池箱或电池组'};
    if(isEOH(this,d)){d.output=target;return {ok:true};}
    for(const b of this.state.devices.filter(b=>energySpec(this,b)?.kind==='battery')){
      if(peers.some(p=>includesEndpoint(this,b.supply.source,p.id)))b.supply.source=null;
    }
    if(target)for(const p of this.state.devices)if(!peers.includes(p)&&boxes.some(b=>includesEndpoint(this,p.output,b.id)))p.output=null;
    for(const p of peers)p.output=target||null;
    for(const b of boxes)b.supply={mode:'direct',source};
    return {ok:true};
  }
  setFluidOutput(id,fluid,target){
    target=target?endpointId(this,target):null;
    const peers=devicePeers(this,id);
    if(!peers.length||!this.fluidOutputTypes(id).includes(fluid))return {ok:false,message:'此设备没有这种流体产物'};
    if(target&&!bindFluid(this,target,fluid))return {ok:false,message:'请选择兼容的输出储罐或储罐组'};
    for(const d of peers){if(target)d.fluidOutputs[fluid]=target;else delete d.fluidOutputs[fluid];}
    return {ok:true};
  }
  fluidOutputTypes(id){
    const d=devicePeers(this,id)[0],m=d&&this.catalog.machines[d.type];
    if(!m||energySpec(this,d)?.kind==='boiler'&&!['exchanger','thermal'].includes(energySpec(this,d)?.cycle))return [];
    const current=this.recipeById.get(d.recipe),fluids=new Set(Object.keys(current?.outputs||{}).filter(id=>isFluid(this.catalog,id)));
    for(const id of purificationOutputs(this,d))fluids.add(id);
    for(const id of exoticOutputFluids(this,d,current))fluids.add(id);
    if(isEOH(this,d))fluids.add('spacetimeMolten');
    if(d.boardBath?.waste)fluids.add(d.boardBath.waste);
    if(d.nuclear?.fluid)fluids.add(NUCLEAR.hot);
    for(const r of this.catalog.recipes)if(machineSupportsRecipe(m,r)){
      for(const fluid of Object.keys(r.outputs))if(isFluid(this.catalog,fluid))fluids.add(fluid);
      if(r.reactorBonus)fluids.add(r.reactorBonus);
      if(r.bath)fluids.add(r.bath.waste);
      for(const fluid of r.energyOutputs??[])fluids.add(fluid);
    }
    return [...fluids];
  }
  setSteamOutput(id,target){
    target=target?endpointId(this,target):null;
    const peers=devicePeers(this,id);
    if(peers.length&&peers.every(d=>['exchanger','thermal'].includes(energySpec(this,d)?.cycle)))return this.setFluidOutput(id,boilerSteam(this,peers[0]),target);
    if(!peers.length||peers.some(d=>energySpec(this,d)?.kind!=='boiler')||(target&&!bindFluid(this,target,boilerSteam(this,peers[0]))))return {ok:false,message:'请选择可接收对应蒸汽的储罐或储罐组'};
    for(const d of peers)d.output=target||null;return {ok:true};
  }
  loadCoal(id,count=1){return this.loadBoilerFuel(id,'coal',count);}
  setBoilerCircuit(id,value){
    const peers=devicePeers(this,id);
    if(!Number.isInteger(value)||value<0||value>25||!peers.length||peers.some(d=>!boilerProfile(this,d).large&&!boilerProfile(this,d).exchanger))return {ok:false,message:'电路范围为 0–25'};
    for(const d of peers)d.boilerCircuit=value;return {ok:true};
  }
  loadBoilerFuel(id,item,count=1){
    const peers=devicePeers(this,id);
    if(!peers.length||![1,16,64].includes(count)||peers.some(d=>!boilerSolidFuels(this,d).includes(item)))return {ok:false,message:'请选择兼容的锅炉燃料'};
    if(peers.some(d=>d.coal>0&&d.solidFuel!==item))return {ok:false,message:'请先用完槽内燃料再更换种类'};
    if(peers.reduce((n,d)=>n+64-d.coal,0)<count)return {ok:false,message:'燃料槽空间不足'};
    if(!this.pay({[item]:count}))return {ok:false,message:'燃料不足'};
    for(const d of peers)d.solidFuel=item;
    for(let n=0;n<count;n++){
      const d=peers.filter(d=>d.coal<64).reduce((a,b)=>a.coal+a.heat/SOLID_FUELS[item].heat<=b.coal+b.heat/SOLID_FUELS[item].heat?a:b);d.coal++;
    }
    return {ok:true};
  }
  setSkyAccess(id,visible){const peers=devicePeers(this,id);if(!peers.length||typeof visible!=='boolean')return {ok:false,message:'设备不存在'};for(const d of peers)d.skyAccess=visible;return {ok:true};}
  changeBattery(id,insert){
    const d=this.state.devices.find(d=>d.id===id);if(!d||energySpec(this,d)?.kind!=='battery')return {ok:false,message:'电池箱不存在'};
    const item=batteryItem(d);
    if(insert){if(d.batteries>=4)return {ok:false,message:'电池槽已满'};if(!this.pay({[item]:1}))return {ok:false,message:'需要同级电池'};d.batteries++;}
    else{
      if(!d.batteries)return {ok:false,message:'没有可取出的电池'};
      const remaining=d.batteries-1,capacity=remaining?remaining*ENERGY.battery.capacity[d.energyTier]+ENERGY.voltage[d.energyTier]*64*4:0;
      if(d.eu>capacity+1e-8)return {ok:false,message:'剩余槽位容纳不了当前电量，请先用掉电量'};
      d.batteries--;this.add({[item]:1},false);
    }
    return {ok:true};
  }
  changeIsotopePellet(id,insert){
    const peers=devicePeers(this,id);
    if(!peers.length||peers.some(d=>energySpec(this,d)?.cycle!=='ic2RTG'))return {ok:false,message:'同位素温差发电机不存在'};
    if(insert){
      const d=peers.filter(d=>d.isotopePellets<RTG.ic2.slots).sort((a,b)=>a.isotopePellets-b.isotopePellets)[0];
      if(!d)return {ok:false,message:'同位素槽位已满'};
      if(!this.pay({[RTG.ic2.pellet]:1}))return {ok:false,message:'需要同位素燃料棒丸'};
      d.isotopePellets++;
    }else{
      const d=peers.filter(d=>d.isotopePellets>0).sort((a,b)=>b.isotopePellets-a.isotopePellets)[0];
      if(!d)return {ok:false,message:'没有可取出的同位素燃料'};
      d.isotopePellets--;this.add({[RTG.ic2.pellet]:1},false);
    }
    return {ok:true};
  }
  recoverEnergy(id){
    const d=this.state.devices.find(d=>d.id===id);
    if(!d||energySpec(this,d)?.kind!=='battery'||!d.batteries)return {ok:false,message:'请先建造电池箱并装入电池'};
    const moved=Math.min(this.state.legacyEnergy||0,Math.max(0,energyCapacity(this,d)-d.eu));
    if(moved<=0)return {ok:false,message:'电池已满或没有待转存电量'};
    this.state.legacyEnergy-=moved;d.eu+=moved;this.state.energy+=moved;return {ok:true};
  }
  emptyDeviceEnergy(id){
    const d=this.state.devices.find(d=>d.id===id);if(!d)return {ok:false,message:'设备不存在'};
    if(d.enabled||d.job)return {ok:false,message:'请先暂停或强制停止设备'};
    if(d.exchanger?.remaining>0)return {ok:false,message:'请先强制停止换热机，释放当前热量周期'};
    if(d.thermalBoiler?.remaining>0||Object.keys(d.thermalBoiler?.outputs??{}).length)return {ok:false,message:'请先完成或强制停止热力锅炉的当前批次'};
    if(d.heat>0||d.temperature>100||d.cycleRemaining>0)return {ok:false,message:'请等待燃烧、余热或当前发电周期结束'};
    const refund={};if(d.steam)refund[boilerSteam(this,d)]=d.steam;
    if(d.boardBath?.amount){const b=d.boardBath;refund[b.waste]=(refund[b.waste]??0)+Math.trunc(b.amount/b.divisor);}
    const spec=energySpec(this,d),fuel=generatorFuel(this,d);if(d.fuel&&(fuel||boilerProfile(this,d).lava)){const id=fuel?.id??'lava';refund[id]=(refund[id]||0)+d.fuel;}
    if(d.water)refund[d.waterFluid]=d.water;
    if(d.nuclear?.cold)refund[NUCLEAR.cold]=(refund[NUCLEAR.cold]??0)+d.nuclear.cold;
    if(d.nuclear?.hot)refund[NUCLEAR.hot]=(refund[NUCLEAR.hot]??0)+d.nuclear.hot;
    if(!this.add(refund,false))return {ok:false,message:'需要兼容的空余储罐退回流体'};
    if(d.eoh){d.eoh.charge='0';d.eoh.returnEU='0';}
    this.state.energy=Math.max(0,this.state.energy-d.eu);d.eu=0;d.steam=0;d.fuel=0;d.water=0;
    delete d.boardBath;
    if(d.nuclear){d.nuclear.cold=0;d.nuclear.hot=0;}
    if(d.smeltery){d.smeltery.useTime=0;d.smeltery.temperature=20;d.smeltery.fuel=null;}
    delete d.exchanger;
    delete d.thermalBoiler;
    if(d.largeBoiler)delete d.largeBoiler;
    return {ok:true,message:'机内流体已退回储罐，剩余电量已散去'};
  }
  upgradeEnergy(id){
    const d=this.state.devices.find(d=>d.id===id),spec=d&&energySpec(this,d);
    if(findGroup(this,id))return {ok:false,message:'请先将设备移出组，再单独升级电压'};
    if(!spec?.maxTier||d.energyTier>=spec.maxTier)return {ok:false,message:'已达到该机型最高电压'};
    const next=d.energyTier+1;
    if(d.job||d.batteries)return {ok:false,message:'请先结束批次并取出电池'};
    const cost=this.energyUpgradeCost(d);
    if(!this.pay(cost))return {ok:false,message:'更换机组的材料不足'};
    d.energyTier=next;return {ok:true};
  }
  energyUpgradeCost(d){
    if(this.catalog.machines[d.type]?.energy?.advancedFeed)return {[LATE.feeds[d.energyTier+1]]:1};
    const metals=['','steel','aluminium','stainless','titanium','tungstensteel','iridium','europium','neutronium','cosmic','catalyst','infinity','spacetime','eternity','eternity'];
    const tier=d.energyTier+1;return {[metals[tier]+'Plate']:8,[tier<=3?'basicCircuit':tier<=6?'advancedCircuit':tier<=9?'quantumCircuit':'exoticCircuit']:2,motor:2};
  }
  installModule(id){const d=this.state.devices.find(d=>d.id===id);if(!d||energySpec(this,d)?.kind!=='dyson'||d.modules>=ENERGY.dyson.maxModules)return {ok:false,message:'无法装入更多戴森模块'};if(!this.pay({dyson:1}))return {ok:false,message:'需要戴森模块'};d.modules++;return {ok:true};}
  add(stacks,track=true,targets={}){
    for(const[id,n]of Object.entries(stacks))if(!Object.hasOwn(this.catalog.items,id)||!finite(n))throw Error('物品数量无效');
    if(Object.keys(stacks).some(id=>isCondensate(this,id)))return false;
    const plan=planFluids(this.catalog,this.state.containers,stacks,{},targets,this.state.groups);if(!plan)return false;
    this.state.containers=plan;
    for(const[id,n]of Object.entries(stacks)){if(!isFluid(this.catalog,id))this.state.inventory[id]=this.quantity(id)+n;if(track)this.state.earned[id]=(this.state.earned[id]||0)+n;}
    return true;
  }
  canPay(stacks){return Object.entries(stacks).every(([id,n])=>!isCondensate(this,id)&&this.quantity(id)+1e-9>=n);}
  pay(stacks){if(!this.canPay(stacks))return false;for(const[id,n]of Object.entries(stacks)){if(isFluid(this.catalog,id))drainFluid(this.state.containers,id,n);else this.state.inventory[id]=Math.max(0,this.quantity(id)-n);}return true;}
  containerCapacity(c){return c.group?c.capacity:containerCapacity(this.catalog,c);}
  acceptsFluid(c,id){return c.group?endpointMembers(this,c.id).every(c=>acceptsFluid(this.catalog,c,id)):acceptsFluid(this.catalog,c,id);}
  fluidRoom(id,target=null){return (target?endpointMembers(this,target):fluidEntries(this)).reduce((n,c)=>n+((!c.fluid||c.fluid===id)&&this.acceptsFluid(c,id)?Math.max(0,this.containerCapacity(c)-c.amount):0),0);}
  canStore(stacks,inputs={},targets={}){return !!planFluids(this.catalog,this.state.containers,stacks,inputs,targets,this.state.groups);}
  placeContainer(type,count=1){
    const spec=this.catalog.containerTypes[type];
    if(!Object.hasOwn(this.catalog.containerTypes,type)||!spec||spec.migrationOnly)return {ok:false,message:'容器不存在或不可放置'};
    if(!Number.isInteger(count)||count<1||count>10000)return {ok:false,message:'放置数量必须为 1–10000 的整数'};
    if(this.state.containers.length+count>10000)return {ok:false,message:'放置后容器总数不能超过 10000'};
    if(!this.pay({[type]:count}))return {ok:false,message:'空容器不足，请先在工作台合成'};
    const containers=Array.from({length:count},()=>({id:'c'+this.state.nextId++,type,fluid:null,amount:0}));
    this.state.containers.push(...containers);return {ok:true,container:containers[0],containers,count};
  }
  reserveContainer(id,fluid){
    const members=endpointMembers(this,endpointId(this,id));
    if(!members.length||members.some(c=>!this.catalog.containerTypes[c.type]||c.amount>0))return {ok:false,message:'只能更改空容器或全空容器组的流体类型'};
    if(fluid&&members.some(c=>!this.acceptsFluid(c,fluid)))return {ok:false,message:'组内存在不能储存这种流体的容器'};
    for(const c of members)c.fluid=fluid||null;return {ok:true};
  }
  removeContainer(id){
    if(findGroup(this,id))return {ok:false,message:'请先将容器移出组或解散分组，再收起空容器'};
    const c=this.state.containers.find(c=>c.id===id);if(!c)return {ok:false,message:'容器不存在'};
    if(c.amount>0)return {ok:false,message:'请先使用或转移容器内的流体'};
    if(c.type!=='legacyTank')this.add({[c.type]:1},false);
    this.state.containers=this.state.containers.filter(x=>x.id!==id);
    for(const d of this.state.devices){if(d.supply.source===id)d.supply.source=null;if(d.output===id)d.output=null;for(const ports of [d.fluidOutputs,d.fluidInputs])for(const [fluid,target]of Object.entries(ports))if(target===id)delete ports[fluid];}
    return {ok:true};
  }
  transferFluid(from,to){
    const entries=fluidEntries(this),src=entries.find(c=>c.id===from),dst=entries.find(c=>c.id===to);
    if(!src||!dst||src===dst||!src.fluid||src.amount<=0)return {ok:false,message:'请选择有流体的来源和另一个容器或组'};
    if(!bindFluid(this,to,src.fluid))return {ok:false,message:'容器类型不兼容，不能混装流体'};
    const amount=Math.min(src.amount,this.containerCapacity(dst)-dst.amount);if(amount<=0)return {ok:false,message:'目标容器已满'};
    const moved=putFluid(this,to,src.fluid,amount);takeFluid(this,from,src.fluid,moved);return {ok:true,amount:moved};
  }
  collectDrops(node,batches=1){
    const drops={},skipped={},totals={},ranges=Object.entries(this.dropRanges(node));
    // Each collector and each completed round rolls independently.
    for(let batch=0;batch<batches;batch++){
      if(node.exclusiveDrops){
        const roll=this.nextDropRandom();let end=0;
        for(const entry of node.exclusiveDrops){end+=entry.chance;if(roll<end){for(const[id,n]of Object.entries(entry.items))totals[id]=(totals[id]??0)+n;break;}}
        continue;
      }
      for(const[id,{min,max}]of ranges){
      const probability=node.dropProbabilities?.[id];
      const amount=probability!==undefined?(this.nextDropRandom()>=1-probability?max:min):min===max?min:min+Math.floor(this.nextDropRandom()*(max-min+1));
      totals[id]=(totals[id]||0)+amount;
      }
    }
    for(const[id,requested]of Object.entries(totals)){const received=isFluid(this.catalog,id)?Math.min(requested,this.fluidRoom(id)):requested;if(received>0){this.add({[id]:received});drops[id]=received;}if(received<requested)skipped[id]=requested-received;}
    return {drops,skipped};
  }
  note(text){this.state.log.unshift({text,at:Date.now()});this.state.log=this.state.log.slice(0,40);}
  get stage(){return this.catalog.stages[this.state.stage];}
  nodeRequirements(node){return [...new Set([node?.requires,...(node?.requiresAll??[]),...(['moon','mars','belt'].includes(node?.id)?[node.id==='belt'?'advancedRocket':'rocket']:[]),...(node?.stage===0&&!['forest','surface','river'].includes(node.id)?['flintPick']:[])].filter(Boolean))];}
  nodeAvailable(node){return !!node&&this.nodeRequirements(node).every(id=>this.owned(id)>0);}
  gatherClicks(node){return Math.max(3,Math.ceil(node.seconds*2));}
  gather(id){
    const node=this.catalog.gatherNodes.find(x=>x.id===id);
    if(!node)return {ok:false,message:'采集地点不存在'};
    if(!this.nodeAvailable(node))return {ok:false,message:'需要：'+this.nodeRequirements(node).filter(id=>!this.owned(id)).map(id=>this.catalog.items[id].name).join('、')};
    if(node.stage===0&&!['forest','surface','river'].includes(id)&&!this.owned('flintPick'))return {ok:false,message:'先在制造页制作燧石镐'};
    if(isFluid(this.catalog,node.output)&&this.fluidRoom(node.output)<=0)return {ok:false,message:'需要可用的桶或储罐，且必须有剩余容量'};
    const required=this.gatherClicks(node),clicks=(this.state.gatherProgress[id]||0)+1;
    const completed=clicks>=required,{drops,skipped}=completed?this.collectDrops(node):{drops:{},skipped:{}};
    this.state.gatherProgress[id]=completed?0:clicks;
    return {ok:true,completed,clicks:completed?0:clicks,required,drops,skipped};
  }
  collectorCost(node){const level=this.state.collectors[node.id]?.count||0;return Object.fromEntries(Object.entries(node.cost).map(([id,n])=>[id,Math.ceil(n*1.5**level)]).filter(([,n])=>n>0));}
  buildCollector(id){const node=this.catalog.gatherNodes.find(n=>n.id===id);if(!node||!this.nodeAvailable(node)||!this.owned('flintPick'))return {ok:false,message:'需要对应的工具或火箭，并制作燧石镐'};const cost=this.collectorCost(node);if(!this.pay(cost))return{ok:false,message:'采集设备建造材料不足'};this.state.collectors[id]??={count:0,elapsed:0,enabled:true,activeCount:0};const c=this.state.collectors[id],allActive=c.activeCount===undefined||c.activeCount===c.count;c.count++;if(allActive)c.activeCount=c.count;this.note('部署自动采集：'+node.name);return {ok:true};}
  toggleCollector(id){
    const c=this.state.collectors[id];if(!c)return {ok:false,message:'尚未部署采集器'};
    c.enabled=c.enabled===false;c.blocked=c.enabled?'运行中':'已停止';return {ok:true};
  }
  setCollectorWorkers(id,count){
    const c=this.state.collectors[id];if(!c)return {ok:false,message:'尚未部署采集器'};
    if(!Number.isInteger(count)||count<1||count>c.count)return {ok:false,message:'工作台数不能超过已部署的采集器数量'};
    c.activeCount=count;return {ok:true};
  }
  availableRecipes(process=null){return this.catalog.recipes.filter(r=>!process||r.process===process);}
  machineRecipes(type){
    const key=type;
    if(!this.recipeOptionsCache.has(key))this.recipeOptionsCache.set(key,this.catalog.recipes.filter(r=>machineSupportsRecipe(this.catalog.machines[type],r)));
    return this.recipeOptionsCache.get(key);
  }
  missing(stacks){return Object.entries(stacks).filter(([id,n])=>this.quantity(id)<n).map(([id,n])=>({id,need:n,have:this.quantity(id)}));}
  canBuild(type){const m=this.catalog.machines[type];return !!m&&this.canPay(m.cost);}
  build(type){const m=this.catalog.machines[type];if(!m)return{ok:false,message:'机器不存在'};if(this.state.devices.length>=500)return{ok:false,message:'设备数量已达上限'};if(!this.pay(m.cost))return{ok:false,message:'建造材料不足'};const device={id:'d'+this.state.nextId++,type,recipe:null,job:null,enabled:true,blocked:'请选择配方'};initializeEnergy(this,device);if(m.energy?.kind==='dyson')device.modules=m.cost.dyson||0;this.state.devices.push(device);this.state.earned[type]=(this.state.earned[type]||0)+1;this.note('建成：'+m.name);return{ok:true,device};}
  assign(deviceId,recipeId){
    const peers=devicePeers(this,deviceId),r=this.recipeById.get(recipeId);
    if(!peers.length)return {ok:false,message:'机器不存在'};
    if(peers.some(d=>d.job||(d.exchanger?.remaining>0||d.turbine?.cycle>0||d.thermalBoiler?.remaining>0||Object.keys(d.thermalBoiler?.outputs??{}).length)&&d.recipe!==recipeId))return {ok:false,message:'请先强制停止或等待组内当前批次完成'};
    if(recipeId!==''&&(!r||peers.some(d=>!machineSupportsRecipe(this.catalog.machines[d.type],r))))return {ok:false,message:'此设备不能执行该配方'};
    if(peers.some(d=>energySpec(this,d)?.kind==='generator'&&d.fuel>0&&generatorFuel(this,d)?.id!==(r?.fuel??energySpec(this,d).fuel))&&recipeId!=='')return {ok:false,message:'请先用完或排空机内燃料，再切换燃料种类'};
    for(const d of peers){interruptPlanTask(this,d);delete d.stopAfterBatch;if(d.recipe!==recipeId)d.ignited=false;d.recipe=recipeId||null;d.blocked=d.enabled?(recipeId?'就绪':'请选择配方'):'已暂停';}
    return {ok:true};
  }
  dispatch(recipeId,deviceId){
    const peers=devicePeers(this,deviceId);
    if(!peers.length)return {ok:false,message:'请选择空闲设备或设备组'};
    if(peers.some(d=>d.job||d.recipe))return {ok:false,message:'设备或组内成员已有任务，请先强制停止'};
    const result=this.assign(deviceId,recipeId);if(!result.ok)return result;
    for(const d of peers){d.enabled=true;d.blocked='就绪';}
    return {ok:true,device:deviceEntries(this).find(d=>d.id===endpointId(this,deviceId))};
  }
  toggle(id){const peers=devicePeers(this,id),enabled=!peers.every(d=>d.enabled);for(const d of peers){d.enabled=enabled;if(!enabled)resetBeamAcceleration(d);}}
  forceStop(id){
    const peers=devicePeers(this,id);if(!peers.length)return {ok:false,message:'机器不存在'};
    for(const d of peers)resetBeamAcceleration(d);
    for(const d of peers)if(d.thermalBoiler)d.thermalBoiler={efficiency:0,remaining:0,steam:d.thermalBoiler.steam,outputs:{}};
    for(const d of peers)if(d.solarTower){d.solarTower.efficiency=0;d.solarTower.remaining=0;}
    for(const d of peers){interruptPlanTask(this,d);delete d.stopAfterBatch;d.job=null;d.recipe=null;d.enabled=false;d.ignited=false;d.reactorWarmup=0;d.reactorTicks=0;if(d.combustion)d.combustion.efficiency=0;if(d.turbine){d.turbine.power=0;d.turbine.efficiency=0;d.turbine.cycle=0;}if(d.exchanger){d.exchanger.remaining=0;d.exchanger.power=0;d.exchanger.efficiency=0;}if(d.largeBoiler)d.largeBoiler.efficiency=0;if(d.becStorage){d.becStorage.contents={};d.becStorage.ready=false;}d.blocked='已停止';if(energySpec(this,d)?.kind==='dyson'){d.cycleRemaining=0;d.cyclePower=0;}}
    return {ok:true};
  }
  dismantle(id){if(findGroup(this,id))return {ok:false,message:'请先将设备移出组或解散分组，再拆除'};const d=this.state.devices.find(x=>x.id===id);if(!d)return{ok:false,message:'机器不存在'};if(this.state.devices.some(m=>m.godforgeHost===id))return{ok:false,message:'请先断开已连接的造物主模块'};if(this.state.devices.some(u=>u.purificationHost===id))return{ok:false,message:'请先断开纯净水处理单元'};if(d.godforge&&(d.godforge.charge||d.godforge.upgrades.length||d.godforge.rings>1))return{ok:false,message:'造物主已点燃或含升级，不能直接拆除'};if(d.nuclear&&(d.nuclear.slots.some(Boolean)||d.nuclear.heat||d.nuclear.cold||d.nuclear.hot))return {ok:false,message:'请先取出堆内组件、排空冷却液并完成散热'};if(this.state.devices.some(x=>x.becHost===id))return {ok:false,message:'请先断开凝聚态网络中的设备'};if(Object.values(d.becStorage?.contents??{}).some(n=>n>0))return {ok:false,message:'请先停止凝聚态磁场'};if(d.eoh&&(BigInt(d.eoh.charge)>0n||BigInt(d.eoh.returnEU)>0n))return {ok:false,message:'请先回充电池箱或排空演化储能'};if(d.job)return{ok:false,message:'请先完成当前批次'};if(d.boardBath?.amount)return{ok:false,message:'请先将浸液排入废液容器'};if(d.turbine?.power>0||d.exchanger?.remaining>0||d.thermalBoiler?.remaining>0||Object.keys(d.thermalBoiler?.outputs??{}).length)return{ok:false,message:'请先完成批次或强制停止设备'};if(d.eu>1e-8||d.batteries||d.isotopePellets||d.fuel>1e-8||d.steam>1e-8||d.heat>0||d.temperature>100||d.cycleRemaining>0)return {ok:false,message:'请先用掉机内能源、取出电池及同位素燃料并等待设备冷却'};const refund={...this.catalog.machines[d.type].cost};for(const [item,n]of Object.entries(beamRefund(d)))refund[item]=(refund[item]??0)+n;for(const [item,n]of Object.entries(foundryRefund(this,d)))refund[item]=(refund[item]??0)+n;if(d.eoh)for(const [item,n]of Object.entries(eohRefund(d)))refund[item]=(refund[item]??0)+n;for(const [item,n]of Object.entries(d.nanites??{}))refund[item]=(refund[item]??0)+n;if(d.bioVat?.culture)refund[d.bioVat.culture]=(refund[d.bioVat.culture]??0)+1;for(const [item,n]of Object.entries(nuclearRefund(d)))refund[item]=(refund[item]??0)+n;if(d.purificationLenses)for(const id of PURIFICATION.lenses)refund[id]=(refund[id]??0)+1;if(d.water)refund[d.waterFluid]=(refund[d.waterFluid]||0)+d.water;if(d.coal)refund[d.solidFuel]=(refund[d.solidFuel]||0)+d.coal;if(d.coil)refund[d.coil]=(refund[d.coil]||0)+16;if(d.type==='dysonGenerator')refund.dyson=d.modules;if(!this.add(refund,false))return {ok:false,message:'退料需要空余流体容器'};for(const c of d.spinRotors??[])this.state.components.push(c);returnComponents(this,d);interruptPlanTask(this,d);this.state.devices=this.state.devices.filter(x=>x!==d);for(const target of this.state.devices){if(target.supply?.source===id)target.supply.source=null;if(target.output===id)target.output=null;if(target.beam?.target===id)target.beam.target=null;}return{ok:true};}
  canCraft(r){return r&&this.canPay(r.inputs)&&this.hasTools(r);}
  craft(id,amount=1){const r=this.recipeById.get(id);if(!r||r.process!=='craft')return{ok:false,message:'需要对应机器执行此配方'};if(this.state.queue.length>=20)return{ok:false,message:'手工队列已满'};if(![1,5,10].includes(amount))return{ok:false,message:'批次数量无效'};const inputs=Object.fromEntries(Object.entries(r.inputs).map(([id,n])=>[id,n*amount]));if(!this.hasTools(r))return{ok:false,message:'缺少可重复使用的工具或桶'};if(!this.pay(inputs))return{ok:false,message:'制作材料不足'};this.state.queue.push({recipe:id,remaining:r.seconds,amount});return{ok:true};}
  cancelQueue(index){const q=this.state.queue[index],r=q&&this.recipeById.get(q.recipe);if(!r)return{ok:false,message:'任务不存在'};const refund=Object.fromEntries(Object.entries(r.inputs).map(([id,n])=>[id,n*q.amount]));if(!this.add(refund,false))return {ok:false,message:'流体退料需要足够容器容量'};interruptPlanTask(this,q);this.state.queue.splice(index,1);return{ok:true};}
  milestone(){return this.catalog.milestones[this.state.stage];}
  milestoneProgress(){return Object.entries(this.milestone()).map(([id,n])=>({id,need:n,have:Math.max(this.state.earned[id]||0,this.owned(id))}));}
  canAdvance(){return !this.state.completed&&this.milestoneProgress().every(x=>x.have>=x.need);}
  advance(){if(!this.canAdvance())return{ok:false,message:'先完成本阶段目标'};if(this.state.stage===this.catalog.stages.length-1){this.state.completed=true;this.note('星门已建成：GregTech-LiteHorizons 完成');return{ok:true,message:'星门已建成！'};}this.state.stage++;this.note('进入 '+this.stage.name+' · '+this.stage.code);return{ok:true,message:'主线推进：'+this.stage.name};}
  drops(node){return node.dropRanges?Object.fromEntries(Object.entries(node.dropRanges).filter(([,r])=>r.max>0).map(([id,r])=>[id,r.max])):this.catalog.nodeDrops[node.id]||{[node.output]:node.amount};}
  dropRanges(node){return node.dropRanges??Object.fromEntries(Object.entries(this.drops(node)).map(([id,n])=>[id,isFluid(this.catalog,id)?{min:n,max:n}:{min:Math.max(id===node.output?1:0,n-1),max:n+1}]));}
  nextDropRandom(){
    // Saved random state keeps future drops consistent after loading and across offline/online steps.
    let value=this.state.lootSeed=(this.state.lootSeed+0x6D2B79F5)>>>0;
    value=Math.imul(value^(value>>>15),value|1);value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  }
  arrangeProduction(recipe,batches=1,choices={},favorites=[]){return startProductionPlan(this,recipe,batches,choices,favorites);}
  pauseProduction(){const p=this.state.productionPlan;if(!p)return {ok:false,message:'没有制作计划'};p.paused=!p.paused;if(p.paused)releaseUnstartedPlanDevices(this);this.planClock=.5;return {ok:true};}
  cancelProduction(){const p=this.state.productionPlan;if(!p)return {ok:false,message:'没有制作计划'};p.cancelled=true;releaseUnstartedPlanDevices(this);p.status='已取消 · 已投料批次完成后停止';return {ok:true};}
  finish(r,d=null){if(d&&r.purification)settlePurification(this,d,r);const outputs=d?.job?.outputs??r.outputs;if(!(r.beamSource?finishBeamSource(this,d,r,outputs):r.process==='condensateGenerate'?finishCondensate(this,d,outputs):this.add(outputs,true,d?.fluidOutputs)))return false;this.state.produced+=Object.entries(outputs).filter(([id])=>this.catalog.items[id]?.kind!=='beam').reduce((a,[,n])=>a+n,0);if(d&&r.dynamic==='godforge'){d.exotic.challenge=null;d.enabled=false;}finishPlanDevice(this,d);if(d?.stopAfterBatch){d.recipe=null;d.enabled=false;delete d.stopAfterBatch;}return true;}
  tick(dt){
    if(!finite(dt,0,1))throw Error('单步时间必须为 0–1 秒');
    this.state.playtime+=dt;
    for(const[id,c]of Object.entries(this.state.collectors)){
      const node=this.catalog.gatherNodes.find(n=>n.id===id);if(!this.nodeAvailable(node))continue;
      if(c.enabled===false){c.blocked='已停止';continue;}
      c.elapsed+=dt;const period=node.seconds*4;
      if(c.elapsed>=period){const batches=Math.floor(c.elapsed/period);c.elapsed%=period;const {skipped}=this.collectDrops(node,(c.activeCount??c.count)*batches);c.blocked=Object.keys(skipped).length?'流体容器不足':'运行中';}
    }
    let budget=dt;
    while(budget>0&&this.state.queue.length){const q=this.state.queue[0],r=this.recipeById.get(q.recipe);const used=Math.min(budget,q.remaining);q.remaining-=used;budget-=used;if(q.remaining<=1e-8){q.remaining=0;if(!this.finish(r))break;completePlanBatch(this,q.planTask);if(--q.amount>0)q.remaining=r.seconds;else this.state.queue.shift();}}
    tickMachines(this,dt);
    tickProductionPlan(this,dt);
  }
  simulate(seconds){const duration=Math.min(OFFLINE_LIMIT,Math.max(0,seconds));let left=duration;const before=this.state.produced;while(left>1e-8){const dt=Math.min(.5,left);this.tick(dt);left-=dt;}return{seconds:duration,produced:this.state.produced-before};}
  snapshot(){this.state.lastSeen=Date.now();return clone(this.state);}
  restore(raw){
    if(!raw||![2,3,SCHEMA].includes(raw.schema))throw Error('存档版本不兼容');
    raw=migrateCatalogIdentities(raw,this.catalog);
    raw=migrateMaterialRecipes(raw,this.catalog);
    raw=migrateIndustry(raw,this.catalog);
    if(!Number.isInteger(raw.stage)||raw.stage<0||raw.stage>=this.catalog.stages.length)throw Error('科技阶段无效');
    const checkStacks=obj=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.entries(obj).every(([id,n])=>Object.hasOwn(this.catalog.items,id)&&finite(n));
    if(!checkStacks(raw.inventory)||!checkStacks(raw.earned)||!Array.isArray(raw.devices)||raw.devices.length>500||!Array.isArray(raw.queue)||raw.queue.length>20)throw Error('存档物品或机器数据无效');
    validateComponents(this,raw.components??[]);
    const ids=new Set();for(const d of raw.devices){
      const m=this.catalog.machines[d.type];
      if(!m||typeof d.id!=='string'||!/^d\d+$/.test(d.id)||ids.has(d.id)||typeof d.enabled!=='boolean')throw Error('存档机器无效');
      ids.add(d.id);const r=d.recipe&&this.recipeById.get(d.recipe);
      if(d.alias!==undefined&&(typeof d.alias!=='string'||d.alias.length>24||/[\u0000-\u001f\u007f]/.test(d.alias)))throw Error('设备别名无效');
      if(d.fluidOutputs!==undefined&&(!d.fluidOutputs||typeof d.fluidOutputs!=='object'||Array.isArray(d.fluidOutputs)||Object.entries(d.fluidOutputs).some(([fluid,target])=>!isFluid(this.catalog,fluid)||typeof target!=='string'||!/^[cg]\d+$/.test(target))))throw Error('流体输出连接无效');
      if(d.fluidInputs!==undefined&&(!d.fluidInputs||typeof d.fluidInputs!=='object'||Array.isArray(d.fluidInputs)||Object.entries(d.fluidInputs).some(([fluid,target])=>!isFluid(this.catalog,fluid)||typeof target!=='string'||!/^[cg]\d+$/.test(target))))throw Error('流体输入连接无效');
      if(d.stopAfterBatch!==undefined&&typeof d.stopAfterBatch!=='boolean')throw Error('批次停止状态无效');
      if(d.looseFit!==undefined&&typeof d.looseFit!=='boolean')throw Error('转子装配方式无效');
      if(d.rotor!==undefined){
        const c=d.rotor,max=componentCapacity(this,c?.item,'rotor');
        if(m.energy?.cycle!=='turbine'||!max||!Number.isInteger(c.life)||!finite(c.life,0,max))throw Error('转子寿命无效');
        if(m.energy.rotorSlots===12?(!Array.isArray(c.lives)||c.lives.length!==12||c.lives.some(n=>!Number.isInteger(n)||!finite(n,0,max))||c.life!==Math.min(...c.lives)):c.lives!==undefined)throw Error('XL 转子槽位无效');
      }
      if(d.turbine!==undefined){
        const s=d.turbine;
        if(m.energy?.cycle!=='turbine'||!s||typeof s!=='object'||Array.isArray(s)||!finite(s.fraction,0,1)||!finite(s.water,0,m.energy.rotorSlots===12?1:159)||m.energy.rotorSlots!==12&&!Number.isInteger(s.water)||Object.entries({power:ENERGY.voltage[d.energyTier]*(m.energy.rotorSlots===12?16:1),efficiency:10000,runtime:1001,cycle:20,flow:2147483646}).some(([k,max])=>!Number.isInteger(s[k])||!finite(s[k],0,max)))throw Error('涡轮运行状态无效');
      }
      if(d.exchanger!==undefined){
        const s=d.exchanger;
        if(m.energy?.cycle!=='exchanger'||!s||typeof s!=='object'||Array.isArray(s)||!finite(s.fraction,0,1)||!['steam','superheatedSteam','supercriticalSteam','denseSupercriticalSteam'].includes(s.steam)||Object.entries({efficiency:10000,remaining:20,power:2147483647,water:159}).some(([k,max])=>!Number.isInteger(s[k])||!finite(s[k],0,max)))throw Error('换热机状态无效');
      }
      if(d.thermalBoiler!==undefined&&(m.energy?.cycle!=='thermal'||!validThermalCycle(this,d,r)))throw Error('热力锅炉批次无效');
      if(!validGodforge(this,d))throw Error('造物主主机或模块数据无效');
      if(!validPurification(this,d,r))throw Error('纯净水处理设置或批次无效');
      if(!validExotic(this,d,r))throw Error('奇异物质配料数据无效');
      if(!validNaquadah(this,d,r))throw Error('液态硅岩反应堆批次无效');
      if(!validSolarTower(this,d))throw Error('太阳能熔盐塔状态无效');
      if(!validNuclear(this,d))throw Error('核反应堆布局或运行状态无效');
      if(!validSmeltery(this,d,r))throw Error('冶炼炉燃料或加热状态无效');
      if(!validEOH(this,d,r))throw Error('和谐之眼预充电或批次状态无效');
      if(!validBeam(this,d,r,raw.devices))throw Error('束流设备连接、缓存或加工进度无效');
      if(!validBEC(this,d,raw.devices)||!validSpin(this,d))throw Error('凝聚态网络或离心设备状态无效');
      if(!validAura(this,d))throw Error('奥术工作台灵气无效');
      if(!validFoundry(this,d)||d.job?.parallel!==undefined&&!m.spinmatron&&!m.foundry)throw Error('铸造模块或并行批次状态无效');
      if(d.incubatorClock!==undefined&&(!m.incubator||!finite(d.incubatorClock,0,.05)||d.job))throw Error('培养箱状态无效');
      if(!validBioVat(this,d,r))throw Error('培养仓菌种或辐射状态无效');
      if(d.thermalFilter!==undefined&&(m.energy?.cycle!=='thermal'||d.thermalFilter?.item!=='lavaFilter'||d.thermalFilter.kind!=='lavaFilter'||!Number.isInteger(d.thermalFilter.life)||!finite(d.thermalFilter.life,0,100)))throw Error('熔岩过滤器寿命无效');
      if(d.coil!==undefined&&d.coil!==null&&(!m.coils||!COILS.some(c=>c.item===d.coil)))throw Error('高炉线圈无效');
      if(d.location!==undefined&&!['ground','orbit'].includes(d.location))throw Error('设备地点无效');
      if(d.fuelType!==undefined&&d.fuelType!==null&&!isFluid(this.catalog,d.fuelType))throw Error('机内燃料类型无效');
      if(d.toolLife!==undefined&&(!d.toolLife||Array.isArray(d.toolLife)||typeof d.toolLife!=='object'||Object.entries(d.toolLife).some(([id,n])=>!this.catalog.recipes.some(r=>r.toolWear?.[id]>=n)||!Number.isInteger(n)||n<0)))throw Error('机内研磨球寿命无效');
      if(d.boardBath!==undefined){
        const b=d.boardBath;
        if(!b||Array.isArray(b)||typeof b!=='object'||!this.catalog.recipes.some(r=>machineSupportsRecipe(m,r)&&r.bath?.fluid===b.fluid&&r.bath.waste===b.waste&&r.bath.divisor===b.divisor)||!finite(b.amount,0,BATH_CAPACITY)||!finite(b.impurity,0,b.amount)||!Number.isInteger(b.processed)||!finite(b.processed,0,999))throw Error('基板浸液状态无效');
      }
      if(!Number.isInteger(d.bathFlushPercent??100)||!finite(d.bathFlushPercent??100,1,100)||!finite(d.bathClock??0,0,1))throw Error('基板浸液设置无效');
      if(d.recipe&&(!r||!machineSupportsRecipe(m,r)))throw Error('存档配方无效');
      if(d.godforgeHost&&!raw.devices.some(h=>h.id===d.godforgeHost&&this.catalog.machines[h.type]?.godforge==='host'))throw Error('造物主模块连接无效');
      if(d.purificationHost&&!raw.devices.some(h=>h.id===d.purificationHost&&this.catalog.machines[h.type]?.purification==='host'))throw Error('纯净水厂连接无效');
      if(d.job&&(!r||!finite(d.job.remaining,0,raw.schema<4?Math.max(20,r.seconds):d.job.duration)||raw.schema===4&&(!finite(d.job.duration,.05,Math.max(r.seconds*2,.05)))))throw Error('存档生产批次无效');
      if(d.job?.outputs!==undefined&&!r?.purification&&!r?.largeNaquadah&&!r?.eoh&&!validBatchOutputs(d.job.parallel?spinRecipe(r,d.job.parallel):r?.process==='bioVat'?bioRecipe(this,d,r):r,d.job.outputs))throw Error('存档批次产物无效');
      if(d.job?.prepaidEU!==undefined&&(m.godforge?(!Number.isSafeInteger(d.job.prepaidEU)||d.job.prepaidEU<1):(!r?.batchEU||d.job.prepaidEU!==r.batchEU)))throw Error('整批预付电量无效');
      if(raw.schema===4){
        const spec=m.energy;
        if(spec?.cycle==='ic2RTG'){
          if(!Number.isInteger(d.isotopePellets)||d.isotopePellets<0||d.isotopePellets>RTG.ic2.slots)throw Error('同位素燃料槽无效');
        }else if(d.isotopePellets!==undefined)throw Error('同位素发电机机型无效');
        if(spec?.rtg){
          const burned=this.recipeById.get(d.rtgFuel);
          // A new pellet can be loaded with energy left from the previous
          // fuel. Its admission threshold used that previous fuel's voltage.
          const admissionReserve=Math.max(...RTG.fuels.map(f=>f.rate))*20+RTG.reserve;
          if(!Number.isInteger(d.rtgVoltage)||!((d.rtgVoltage===0&&!d.rtgFuel&&d.eu===0)||(burned?.rtg&&d.rtgVoltage===burned.outputRate&&d.eu<=burned.fuelEU+admissionReserve)))throw Error('同位素热电机燃料状态无效');
        }else if(d.rtgVoltage!==undefined||d.rtgFuel!==undefined)throw Error('同位素热电机机型无效');
        if(!Number.isInteger(d.energyTier)||d.energyTier<(spec?.tier||0)||d.energyTier>(spec?.maxTier??spec?.tier??0))throw Error('机器电压数据无效');
        if(!Number.isInteger(d.batteries)||!finite(d.batteries,0,spec?.kind==='battery'?4:0))throw Error('电池槽数据无效');
        const B=boilerProfile(this,d);
        if(!Number.isInteger(d.boilerCircuit??0)||!finite(d.boilerCircuit??0,0,25))throw Error('锅炉节流电路无效');
        if(d.largeBoiler!==undefined){
          const s=d.largeBoiler;
          if(!B.large||!s||typeof s!=='object'||Array.isArray(s)||!finite(s.fraction,0,1)||![1,2].includes(s.burnDecrease)||Object.entries({efficiency:12500,solidTicks:Number.MAX_SAFE_INTEGER,fluidTicks:Number.MAX_SAFE_INTEGER,solidCircuit:25,fluidCircuit:25,excessEU:19200,excessWater:479,excessSteam:2,increase:20}).some(([key,max])=>!Number.isInteger(s[key])||!finite(s[key],0,max)))throw Error('大型锅炉状态无效');
          if(!Number.isInteger(s.excessFuel??0)||!finite(s.excessFuel??0,0,79))throw Error('锅炉燃料余数无效');
        }
        if(d.combustion!==undefined){
          const s=d.combustion;
          if(spec?.cycle!=='combustion'||!s||typeof s!=='object'||Array.isArray(s)||typeof s.boosted!=='boolean'||!finite(s.fraction,0,1)||!Number.isInteger(s.efficiency)||!finite(s.efficiency,0,30000)||!Number.isInteger(s.runtime)||!finite(s.runtime,0,1001))throw Error('大型内燃机状态无效');
        }
        if(!finite(d.reactorWarmup??0,0,250)||!finite(d.reactorTicks??0,0,1))throw Error('熔盐反应堆状态无效');
        if(!finite(d.eu,0,energyCapacity(this,d)+1e-6)||!finite(d.steam,0,spec?.kind==='boiler'?B.steamCapacity:spec?.kind==='steam'?32000:0))throw Error('机器储能数据无效');
        if(!d.supply||!['direct','storage'].includes(d.supply.mode)||(d.supply.source!==null&&typeof d.supply.source!=='string')||(d.output!==null&&typeof d.output!=='string'))throw Error('能源连接数据无效');
        for(const [key,max]of Object.entries({temperature:B.maxTemperature+B.heatAmount-1,heat:15000,water:B.waterCapacity,coal:64,thermalTick:23999,thermalFraction:1,waterRemainder:160,generatorClock:.5,fuel:spec?.fuel==='steam'?24000*d.energyTier:spec?.family==='Hot'?5000*d.energyTier:B.lava?B.waterCapacity:16000,modules:10000,cycleRemaining:3600,cyclePower:100000000000,cooldownClock:Math.max(45,B.coolTicks-1),startupTicks:20}))if(!finite(d[key],key==='temperature'?20:0,max))throw Error('机器能源状态无效：'+key);
        if(!Object.hasOwn(SOLID_FUELS,d.solidFuel)||!['water','distilledWater'].includes(d.waterFluid)||typeof d.skyAccess!=='boolean'||!finite(d.calcification,0,2147483647)||!finite(d.cooledLava,0,1002))throw Error('锅炉燃料或水状态无效');
        if(typeof d.ignited!=='boolean'||!['coal','thermalTick','batteries','modules','cooldownClock','startupTicks'].every(key=>Number.isInteger(d[key])))throw Error('机器能源计数无效');
      }
    }
    for(const q of raw.queue){const r=this.recipeById.get(q.recipe);if(!r||r.process!=='craft'||!Number.isInteger(q.amount)||q.amount<1||q.amount>10||!finite(q.remaining,0,r.seconds))throw Error('存档队列无效');}
    validateProductionPlan(this,raw);
    if(!raw.collectors||Object.entries(raw.collectors).some(([id,c])=>!c||!this.catalog.gatherNodes.some(n=>n.id===id)||!Number.isInteger(c.count)||c.count<1||c.count>1000||!finite(c.elapsed,0,100)||(Object.hasOwn(c,'enabled')&&typeof c.enabled!=='boolean')||(Object.hasOwn(c,'activeCount')&&(!Number.isInteger(c.activeCount)||c.activeCount<1||c.activeCount>c.count))))throw Error('自动采集存档无效');
    const gatherProgress=clone(raw.gatherProgress??{});
    if(!gatherProgress||typeof gatherProgress!=='object'||Array.isArray(gatherProgress)||Object.entries(gatherProgress).some(([id,clicks])=>{const n=this.catalog.gatherNodes.find(n=>n.id===id);return !n||!Number.isInteger(clicks)||!finite(clicks,0,this.gatherClicks(n)-1);}))throw Error('采集进度无效');
    // Convert old schema-2 timers to partial click progress without granting drops.
    if(raw.manual){const n=this.catalog.gatherNodes.find(n=>n.id===raw.manual.id);if(!n||!finite(raw.manual.remaining,.000000001,n.seconds))throw Error('采集存档无效');gatherProgress[n.id]??=Math.min(this.gatherClicks(n)-1,Math.floor((1-raw.manual.remaining/n.seconds)*this.gatherClicks(n)));}
    for(const key of ['energy','produced','playtime','lastSeen','nextId'])if(!finite(raw[key]))throw Error('存档数值无效');
    if(Object.hasOwn(raw,'legacyEnergy')&&!finite(raw.legacyEnergy))throw Error('旧版待转存电量无效');
    if(Object.hasOwn(raw,'lootSeed')&&(!Number.isInteger(raw.lootSeed)||!finite(raw.lootSeed,0,4294967295)))throw Error('采集掉落存档无效');
    if(!Array.isArray(raw.log)||raw.log.some(x=>typeof x.text!=='string'||!finite(x.at)))throw Error('存档日志无效');
    const containers=raw.schema===2?[]:clone(raw.containers);
    const fluidTypes=Object.keys(this.catalog.items).filter(id=>isFluid(this.catalog,id));
    if(!Array.isArray(containers)||containers.length>10000+fluidTypes.length||containers.filter(c=>c?.type!=='legacyTank').length>10000)throw Error('流体容器存档无效');
    for(const c of containers){
      if(!c||typeof c.id!=='string'||!/^c\d+$/.test(c.id)||ids.has(c.id)||!Object.hasOwn(this.catalog.containerTypes,c.type)||!finite(c.amount))throw Error('流体容器存档无效');
      ids.add(c.id);
      if(c.type==='legacyTank'&&!finite(c.capacity,1))throw Error('迁移储罐容量无效');
      if(c.amount>this.containerCapacity(c)||(!c.fluid&&c.amount>0)||(c.fluid!==null&&!this.acceptsFluid(c,c.fluid)))throw Error('容器流体或容量无效');
    }
    if(raw.schema>=3&&Object.keys(raw.inventory).some(id=>isFluid(this.catalog,id)||isCondensate(this,id)||this.catalog.items[id]?.kind==='beam'))throw Error('流体、凝聚态和束流必须存放在对应设备中');
    const groups=clone(raw.groups??[]);validateGroups(this.catalog,groups,raw.devices,containers);
    for(const g of groups)ids.add(g.id);
    this.state={...this.state,...clone(raw),schema:SCHEMA,containers,groups,manual:null,gatherProgress,speed:1,log:raw.log.slice(0,40)};
    this.state.nextId=Math.max(1,Math.ceil(this.state.nextId),this.state.productionPlan?Number(this.state.productionPlan.id.slice(1))+1:1,...[...ids].filter(id=>/^[cdg]\d+$/.test(id)).map(id=>Number(id.slice(1))+1));
    const migrateFluid=(fluid,amount)=>{
      if(amount<=0)return;
      const tank=this.state.containers.find(c=>c.type==='legacyTank'&&c.fluid===fluid);
      if(tank){tank.amount+=amount;tank.capacity=Math.max(tank.capacity,tank.amount);}
      else this.state.containers.push({id:'c'+this.state.nextId++,type:'legacyTank',fluid,amount,capacity:Math.max(1000,amount)});
    };
    for(const c of Object.values(this.state.collectors)){c.enabled??=true;c.activeCount??=c.count;}
    for(const d of this.state.devices){
      initializeEnergy(this,d,raw.schema<4);
      if(d.becStorage)d.becStorage.ready=false;
      if(raw.schema<4&&d.job){
        const r=this.recipeById.get(d.recipe),kind=energySpec(this,d)?.kind;
        const oldSeconds=({steam:8,bronzeAlloy:7,waterElectrolysis:8,chlorine:10,fusionFuel:20,steamPower:5,dieselPower:5,plasmaPower:5,stellarPower:5})[r.id]||(r.process==='grind'?5:r.seconds);
        const fraction=Math.min(1,d.job.remaining/oldSeconds);
        if(kind==='boiler'){d.water=1000*fraction;d.heat=160*fraction;d.job=null;}
        else if(kind==='generator'){d.fuel=({steam:3200,diesel:250,plasma:1000}[energySpec(this,d).fuel]||0)*fraction;d.job=null;}
        else if(kind==='dyson'){
          const amount=1000*fraction;
          migrateFluid('hydrogen',amount);
          d.job=null;
        }else if(r.id==='fusionFuel'){
          for(const [fluid,volume]of Object.entries({hydrogen:8000,helium:4000}))migrateFluid(fluid,volume*fraction);
          d.job=null;
        }else{
          if(kind==='steam')d.steam=(r.process==='grind'?400:r.process==='alloy'?800:160)*fraction;
          const duration=this.deviceRuntime(d,r).seconds;d.job={remaining:duration*fraction,duration};
        }
      }
      if(raw.schema<4&&d.type==='dysonGenerator')d.modules=1;
    }
    if(raw.schema===2){
      for(const[id,amount]of Object.entries(this.state.inventory))if(isFluid(this.catalog,id)){
        delete this.state.inventory[id];
        migrateFluid(id,amount);
      }
      if(this.state.containers.length)this.note('旧版散装流体已装入迁移储罐，数量保留。');
    }
    const usedIds=new Set([...ids,...this.state.devices.map(d=>d.id),...this.state.containers.map(c=>c.id)]);
    this.state.nextId=Math.max(1,Math.ceil(this.state.nextId),...[...usedIds].filter(id=>/^[cdg]\d+$/.test(id)).map(id=>Number(id.slice(1))+1));
    const connectedIds=new Set([...this.state.devices,...this.state.containers,...this.state.groups].map(x=>x.id));
    for(const d of this.state.devices){if(!connectedIds.has(d.supply.source))d.supply.source=null;if(!connectedIds.has(d.output))d.output=null;for(const ports of [d.fluidOutputs,d.fluidInputs])for(const [fluid,target]of Object.entries(ports))if(!connectedIds.has(target))delete ports[fluid];}
    if(raw.schema<4){this.state.legacyEnergy=(this.state.legacyEnergy||0)+raw.energy;this.note('能源连接已更新：旧电量保留为待转存电量，请装入电池后转存，并为机器指定供能来源。');}
    this.state.energy=this.state.devices.reduce((n,d)=>n+d.eu,0);
  }
}
