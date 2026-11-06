import {GODFORGE_REFERENCE as R} from '../data/godforge-reference.js';
import {generateExotic} from './exotic.js';

const safe=n=>Number.isSafeInteger(n)&&n>=0;
const upgrade=(s,code)=>s.upgrades.includes(code);
export const godforgeKind=(game,d)=>game.catalog.machines[d?.type]?.godforge;
export function initializeGodforge(d){
  d.godforge??={factor:1,fuel:0,charge:0,capacity:100,charging:false,rings:1,clock:0,upgrades:[],spent:0,totalEU:'0',recipes:0,fuelConsumed:0};
}
export function forgeHost(game,d){return game.state.devices.find(h=>h.id===d.godforgeHost&&godforgeKind(game,h)==='host');}
export function forgeModules(game,h){return game.state.devices.filter(d=>d.godforgeHost===h.id&&godforgeKind(game,d)&&godforgeKind(game,d)!=='host');}
export function forgeMaxFactor(s){
  if(upgrade(s,'TSE'))return s.fuel===0?(upgrade(s,'STEM')?72:70):s.fuel===1?(upgrade(s,'STEM')?184:181):2147483647;
  return Math.max(1,Math.trunc((5+(upgrade(s,'GEM')?s.upgrades.length:0))*(upgrade(s,'CFCE')?1.2:1)));
}
export function forgeHeat(s,kind='smelting'){
  return 12601+Math.trunc(Math.log(s.factor)/Math.log(upgrade(s,'SEFCP')?(kind==='smelting'?1.12:1.18):1.5)*1000);
}
export const forgeEffectiveFactor=s=>s.factor<=43?s.factor:43+Math.floor((s.factor-43)**.4);
export const forgeVoltage=s=>(2e9+(upgrade(s,'GISS')?forgeEffectiveFactor(s)*1e8:0))*(upgrade(s,'NGMS')?4**s.rings:1);
export function forgeMilestones(game,h){
  const s=h.godforge,modules=forgeModules(game,h),unique=new Set(modules.map(d=>godforgeKind(game,d))).size;
  const structure=unique+s.rings-1;
  const eu=BigInt(s.totalEU),base=1000000000000000n;
  const threshold=(n,b,f)=>n<b?0:Math.max(0,Math.floor(Math.log(n/b)/Math.log(f)+1+1e-10));
  const progress=[threshold(Number(eu/base),1,9),threshold(s.recipes,1e7,4),threshold(s.fuelConsumed,10000,3),structure];
  const inversion=progress.every(n=>n>=7);
  if(inversion){
    progress[0]=7+Math.floor(Number(eu)/Number(base*9n**6n)-1);
    progress[1]=7+Math.floor(s.recipes/(1e7*4**6)-1);
    progress[2]=7+Math.floor(s.fuelConsumed/(10000*3**6)-1);
    // Additional module weights after inversion follow composition milestone.
    progress[3]=Math.floor(structure+['smelting','molten','plasma','exotic','magmatter'].reduce((n,k,i)=>n+(modules.filter(d=>godforgeKind(game,d)===k).length-1)*(i+1),0)/5);
  }
  const earned=progress.reduce((n,p)=>{p=Math.max(0,inversion?p:Math.min(7,p));return n+p*(p+1)/2;},0);
  return {progress,inversion,available:Math.max(0,earned-s.spent-(s.shardBalance??0))};
}
export function forgeFuelAmount(s){
  const f=s.factor,rate=s.fuel===0?f*300*1.15**f:s.fuel===1?f*2*1.08**f:Math.fround(f/25);
  return Math.max(1,Math.trunc(rate*(upgrade(s,'STEM')?.8:1)*5*(s.charging?2:1)));
}
export function forgeFailure(game,d,r){
  const h=forgeHost(game,d),kind=godforgeKind(game,d);
  if(!h)return '请连接造物主主机';
  const s=h.godforge;
  if(!h.enabled||!s?.charge||!upgrade(s,'START'))return '造物主主机未点燃或已停止';
  if(forgeModules(game,h).length>8+(upgrade(s,'CD')?4:0)+(upgrade(s,'END')?4:0))return '连接模块数量超过主机上限';
  if(kind==='molten'&&!upgrade(s,'FDIM'))return '主机需要熔融模块升级';
  if(kind==='plasma'&&!upgrade(s,'GPCI'))return '主机需要等离子模块升级';
  if(kind==='exotic'&&!upgrade(s,'QGPIU'))return '主机需要奇异物质模块升级';
  if(kind==='magmatter'&&!upgrade(s,'EE'))return '主机需要磁物质升级';
  if(r?.requirements?.heat>forgeHeat(s,kind))return '主机温度不足，需要 '+r.requirements.heat+' K';
  if((r?.requirements?.plasmaTier??0)>(upgrade(s,'EE')?2:upgrade(s,'SEDS')?1:0))return '主机等离子升级等级不足';
  if(r?.requirements?.multiStepPlasma&&!upgrade(s,'TPTP'))return '主机需要多阶段等离子升级';
  return '';
}
export function forgeRuntime(game,d,r){
  const h=forgeHost(game,d),s=h?.godforge,kind=godforgeKind(game,d);
  if(!s)return {seconds:r.seconds,power:0,steamPerSecond:0,valid:false};
  const effective=forgeEffectiveFactor(s);
  const voltage=forgeVoltage(s);
  const heat=forgeHeat(s,kind),heatOC=upgrade(s,'NDPE')?Math.floor(heat>30000?30000+(heat-30000)**(kind==='smelting'?.85:.8):heat):Math.min(heat,upgrade(s,'CNTI')?30000:15000);
  const exotic=['exotic','magmatter'].includes(kind);
  let discount=1,parallel=kind==='smelting'?1024:exotic?64:512;
  if(upgrade(s,'SA'))parallel*=1+Math.fround(effective/15);
  if(upgrade(s,'SA')&&upgrade(s,'TCT'))parallel*=kind==='molten'||kind==='smelting'&&upgrade(s,'DOP')?3:2;
  if(upgrade(s,'CTCDD'))parallel*=2;
  if(upgrade(s,'EPEC'))parallel*=1+heat/(kind==='molten'||kind==='smelting'&&upgrade(s,'DOP')?15000:25000);
  if(upgrade(s,'POS'))parallel*=1+s.upgrades.length/(kind==='molten'||kind==='smelting'&&upgrade(s,'DOP')?5:8);
  if(upgrade(s,'REC'))discount*=1-(1-1.05**(-.05*s.capacity))/20;
  if(upgrade(s,'IMKG'))discount*=1-((s.charge/s.capacity-.5)**2*(-.6)+.15)*(kind==='plasma'?1:2/3);
  if(exotic)parallel=upgrade(s,'PA')?64*Math.sqrt(parallel/64):64;
  discount=Math.fround(exotic?upgrade(s,'PA')?Math.sqrt(discount):1:discount);
  let seconds=r.seconds*(upgrade(s,'IGCC')?heat**(-.01):1)/(upgrade(s,'DOR')?Math.trunc(parallel)**(kind==='plasma'?.02:.012):1);
  if(exotic)seconds=r.seconds*(upgrade(s,'PA')?Math.sqrt(seconds/r.seconds):1);
  const surplus=kind==='plasma'||exotic?0:Math.max(0,heatOC-(r.requirements?.heat??0));
  let power=(r.power??0)*discount*(upgrade(s,'IMKG')?.92:.95)**Math.floor(surplus/900);
  const level=n=>Math.max(1,Math.ceil(Math.log(Math.max(1,n)/8)/Math.log(4)));
  let oc=Math.max(0,Math.min(Math.floor(Math.log(voltage/Math.max(1,power))/Math.log(4)+1e-10),level(voltage)-level(r.power??0)));
  let perfect=Math.min(oc,Math.floor(surplus/1800));
  let factor=upgrade(s,'GGEBE')?(kind==='plasma'?4-25000/heat:2.15):2;
  if(exotic)factor=upgrade(s,'PA')?2+(factor-2)**2:2;
  power=Math.ceil(power*4**oc);seconds=Math.max(.05,Math.floor(seconds*20/4**perfect/factor**(oc-perfect))/20);
  const batchEU=power*Math.round(seconds*20);
  return {seconds,power:0,steamPerSecond:0,batchEU,valid:(r.power??0)<=voltage&&safe(batchEU)&&batchEU>0};
}
export function tickGodforges(game,dt){
  for(const d of game.state.devices)if(d.exotic)d.exotic.clock=Math.min(60,d.exotic.clock+dt);
  for(const h of game.state.devices.filter(d=>godforgeKind(game,d)==='host')){
    initializeGodforge(h);const s=h.godforge;
    if(!h.enabled){h.blocked='已停止';continue;}
    if(!upgrade(s,'START')){h.blocked='请完成造物主启动升级';continue;}
    s.clock+=dt;
    while(s.clock>=5){
      s.clock-=5;
      if(!s.charge){
        const amount=Math.min(2147483647,Math.trunc(Math.max(1,s.factor*25*1.2**s.factor)));
        if(!game.pay({[R.startup]:amount})){h.blocked='等待点燃材料 ×'+amount;continue;}
        s.charge=Math.min(s.capacity,amount);
      }
      const amount=forgeFuelAmount(s),fluid=R.fuels[s.fuel],available=game.inputQuantity(fluid,h.fluidInputs[fluid]);
      const consumed=Math.min(amount,available);
      if(amount<2147483647&&consumed>0)game.payInputs(h,{[fluid]:consumed});
      if(amount<2147483647&&consumed>=amount){s.fuelConsumed=Math.min(Number.MAX_SAFE_INTEGER,s.fuelConsumed+s.factor);if(s.charging){s.charge=Math.min(s.capacity,s.charge+s.factor);if(s.charge===s.capacity)s.charging=false;}}
      else {s.charge=Math.max(0,s.charge-s.factor);if(s.charge)s.fuelConsumed=Math.min(Number.MAX_SAFE_INTEGER,s.fuelConsumed+s.factor);}
      h.blocked=s.charge?'恒星已点燃':'燃料耗尽';
    }
  }
}
export function forgeUpgradeFailure(game,h,code){
  const s=h.godforge,u=R.upgrades.find(u=>u.code===code);
  if(!u||upgrade(s,code))return '升级已完成或不存在';
  if(u.unresolved.length)return '升级材料尚未完整导入';
  const checks=u.prerequisites.map(k=>upgrade(s,k));
  if(checks.length&&!(u.all?checks.every(Boolean):checks.some(Boolean)))return '需要先完成前置升级';
  if(['SEFCP','TCT','GGEBE'].includes(code)&&['SEFCP','TCT','GGEBE'].filter(k=>upgrade(s,k)).length>=s.rings)return '分支数量受已建环数限制';
  if(forgeMilestones(game,h).available<u.shards)return '引力子碎片不足';
  if(!game.canPay(u.cost))return '升级材料不足';
  return '';
}
export function changeGodforge(game,id,action,value){
  const d=game.state.devices.find(d=>d.id===id),kind=d&&godforgeKind(game,d);
  if(!kind)return {ok:false,message:'请选择造物主设备'};
  if(kind!=='host'){
    if(action==='challenge'&&['exotic','magmatter'].includes(kind)&&!d.job){
      const r=game.recipeById.get(d.recipe);if(!r||r.dynamic!=='godforge')return {ok:false,message:'请先选择加工方式'};
      const failure=forgeFailure(game,d,r);if(failure)return {ok:false,message:failure};
      return generateExotic(game,d,r);
    }
    if(action!=='host'||d.job)return {ok:false,message:'请先结束当前批次'};
    const host=game.state.devices.find(h=>h.id===value&&godforgeKind(game,h)==='host');
    if(value&&!host)return {ok:false,message:'主机不存在'};
    if(host&&forgeModules(game,host).filter(m=>m!==d).length>=8+(upgrade(host.godforge,'CD')?4:0)+(upgrade(host.godforge,'END')?4:0))return {ok:false,message:'主机模块槽已满'};
    d.godforgeHost=value||null;return {ok:true};
  }
  initializeGodforge(d);const s=d.godforge;
  if(forgeModules(game,d).some(m=>m.job))return {ok:false,message:'请先完成连接模块的当前批次'};
  if(action==='factor'){
    if(!Number.isInteger(value)||value<1||value>forgeMaxFactor(s))return {ok:false,message:'燃料系数超过升级上限'};
    s.factor=value;
  }else if(action==='fuel'){
    if(!Number.isInteger(value)||value<0||value>2)return {ok:false,message:'燃料无效'};
    s.fuel=value;s.factor=Math.min(s.factor,forgeMaxFactor(s));
  }else if(action==='charging')s.charging=!s.charging;
  else if(['ejectShards','absorbShards'].includes(action)){
    if(!upgrade(s,'END')||!s.charge)return {ok:false,message:'需要终点升级且恒星已点燃'};
    if(!Number.isSafeInteger(value)||value<1)return {ok:false,message:'碎片数量无效'};
    const direction=action==='ejectShards'?1:-1,balance=(s.shardBalance??0)+direction*value;
    if(!Number.isSafeInteger(balance))return {ok:false,message:'碎片数量超出范围'};
    if(direction>0){
      if(forgeMilestones(game,d).available<value)return {ok:false,message:'可取出的碎片不足'};
      if(!game.add({[R.shard]:value},false))return {ok:false,message:'无法取出碎片'};
    }else if(!game.pay({[R.shard]:value}))return {ok:false,message:'仓库碎片不足'};
    s.shardBalance=balance;
  }
  else if(action==='capacity'){
    if(!safe(value)||value<100||value<s.charge)return {ok:false,message:'燃烧储备上限不能低于现有储备或 100'};
    s.capacity=value;
  }else if(action==='upgrade'){
    const failure=forgeUpgradeFailure(game,d,value);if(failure)return {ok:false,message:failure};
    const u=R.upgrades.find(u=>u.code===value);if(!game.pay(u.cost))return {ok:false,message:'材料不足'};
    s.spent+=u.shards;s.upgrades.push(value);
  }else if(action==='ring'){
    if(s.rings>=3||!upgrade(s,s.rings===1?'CD':'END'))return {ok:false,message:'需要先解锁对应扩展环'};
    if(!game.pay(R.structures[s.rings===1?'SECOND_RING':'THIRD_RING']))return {ok:false,message:'扩展环结构材料不足'};
    s.rings++;
  }else return {ok:false,message:'操作无效'};
  return {ok:true};
}
export function validGodforge(game,d){
  const s=d.godforge;
  if(d.godforgeHost!==undefined&&d.godforgeHost!==null&&(typeof d.godforgeHost!=='string'||!/^d\d+$/.test(d.godforgeHost)))return false;
  if(s===undefined)return true;
  if(godforgeKind(game,d)!=='host'||!s||Array.isArray(s)||typeof s!=='object')return false;
  if(!['factor','fuel','charge','capacity','rings','spent','recipes','fuelConsumed'].every(k=>safe(s[k]))||s.fuel>2||s.capacity<100||s.charge>s.capacity||s.rings<1||s.rings>3||typeof s.charging!=='boolean'||!Number.isFinite(s.clock)||s.clock<0||s.clock>=5)return false;
  if(typeof s.totalEU!=='string'||!/^\d{1,100}$/.test(s.totalEU)||!Array.isArray(s.upgrades)||new Set(s.upgrades).size!==s.upgrades.length)return false;
  if(s.shardBalance!==undefined&&!Number.isSafeInteger(s.shardBalance))return false;
  if(s.upgrades.some(code=>!R.upgrades.some(u=>u.code===code&&!u.unresolved.length))||s.factor<1||s.factor>forgeMaxFactor(s))return false;
  for(const u of R.upgrades.filter(u=>s.upgrades.includes(u.code))){const checks=u.prerequisites.map(k=>s.upgrades.includes(k));if(checks.length&&!(u.all?checks.every(Boolean):checks.some(Boolean)))return false;}
  return s.spent===R.upgrades.filter(u=>s.upgrades.includes(u.code)).reduce((n,u)=>n+u.shards,0)&&(['SEFCP','TCT','GGEBE'].filter(k=>upgrade(s,k)).length<=s.rings)&&(!(s.rings>=2)||upgrade(s,'CD'))&&(!(s.rings===3)||upgrade(s,'END'));
}
