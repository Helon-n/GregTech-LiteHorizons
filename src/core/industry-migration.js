// Never finish a paid legacy batch with changed ingredients or yields.
export function migrateIndustry(saved,catalog){
  if(!catalog.industryRulesVersion||(saved.industryRulesVersion??0)>=catalog.industryRulesVersion)return saved;
  const raw=JSON.parse(JSON.stringify(saved));
  if(!raw.inventory||!Array.isArray(raw.devices)||!Array.isArray(raw.queue))return raw;
  const old=catalog.industryLegacyRecipes??{},current=new Set(catalog.recipes.map(r=>r.id));
  raw.containers??=[];
  raw.nextId=Math.max(1,raw.nextId||1,...[...raw.devices,...raw.containers,...(raw.groups??[])].map(x=>Number(x.id?.slice(1))+1||1));
  let refunded=0;
  const refund=(r,count)=>{
    for(const[id,n]of Object.entries(r.inputs)){
      if(!Number.isInteger(count)||count<1||!Number.isFinite(n)||n<0)throw Error('旧版批次数据无效');
      if(catalog.items[id]?.kind==='fluid'&&raw.schema!==2){
        let tank=raw.containers.find(c=>c.type==='legacyTank'&&c.fluid===id);
        if(!tank){tank={id:'c'+raw.nextId++,type:'legacyTank',fluid:id,amount:0,capacity:1000};raw.containers.push(tank);}
        tank.amount+=n*count;tank.capacity=Math.max(tank.capacity,tank.amount);
      }else raw.inventory[id]=(raw.inventory[id]||0)+n*count;
    }
    refunded++;
  };
  raw.queue=raw.queue.filter(q=>{const r=old[q.recipe];if(!r)return true;refund(r,q.amount);return false;});
  for(const d of raw.devices){
    d.fluidInputs??={};d.solidFuel??='coal';d.waterFluid??='water';d.calcification??=0;d.cooledLava??=0;d.skyAccess??=true;d.fuelType??=catalog.machines[d.type]?.energy?.fuel??null;
    const r=old[d.recipe];if(!r)continue;
    if(d.job){if(!Number.isFinite(d.job.remaining)||d.job.remaining<0||raw.schema===4&&(!Number.isFinite(d.job.duration)||d.job.duration<=0||d.job.remaining>d.job.duration))throw Error('旧版批次数据无效');refund(r,1);}
    d.job=null;d.recipe=null;d.enabled=false;d.blocked='配方已更新，请重新派工';
  }
  if(raw.productionPlan?.steps?.some(s=>!current.has(s.recipe)&&!s.recipe.startsWith('build:'))){
    delete raw.productionPlan;
    for(const entity of [...raw.devices,...raw.queue])if(entity.planTask){
      delete entity.planTask;
      if(entity.id&&entity.job)entity.stopAfterBatch=true;
      else if(entity.id){entity.recipe=null;entity.enabled=false;}
    }
  }
  // Retired paid batches are refunded before transferring their old circuits.
  // Preserve both stock and earned milestone credit without duplicating either.
  for(const field of ['inventory','earned'])if(raw[field]){
    for(const [oldId,newId]of Object.entries(catalog.itemMigrations??{})){
      if(raw[field][oldId]===undefined)continue;
      const amount=raw[field][oldId];
      if(!Number.isFinite(amount)||amount<0||!Number.isFinite((raw[field][newId]??0)+amount))throw Error('旧版电路数量无效');
      raw[field][newId]=(raw[field][newId]??0)+amount;
      delete raw[field][oldId];
    }
  }
  raw.industryRulesVersion=catalog.industryRulesVersion;
  if(Array.isArray(raw.log))raw.log.unshift({at:raw.playtime,text:'工业配方已更新。'+(refunded?'旧配方的在制原料已退回仓库与迁移储罐，请重新安排。':'')});
  return raw;
}
