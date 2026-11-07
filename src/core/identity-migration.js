// Registry aliases retain stored quantities and paid progress. Only pending
// Godforge outputs correct the former 1000/144 fluid conversion mistake.
// Run on every load so already current-version saves are covered as well.
export function migrateCatalogIdentities(saved,catalog){
  const items=catalog.itemIdentityMigrations??{},recipes=catalog.recipeIdentityMigrations??{};
  if(!Object.keys(items).length&&!Object.keys(recipes).length)return saved;
  const raw=structuredClone(saved),item=id=>Object.hasOwn(items,id)?items[id]:id,recipe=id=>Object.hasOwn(recipes,id)?recipes[id]:id;
  const stacks=(value,overrides={},factors={})=>{
    if(!value||typeof value!=='object'||Array.isArray(value))return value;
    const result={};
    for(const [id,n]of Object.entries(value)){
      const key=Object.hasOwn(overrides,id)?overrides[id]:item(id);
      if(Object.hasOwn(items,id)&&(!Number.isFinite(n)||n<0||Object.hasOwn(result,key)&&!Number.isFinite(result[key])))throw Error('旧版物品数量无效');
      const amount=n*(factors[id]??1);
      result[key]=Object.hasOwn(result,key)?result[key]+amount:amount;
    }
    return result;
  };
  for(const key of ['inventory','earned'])if(raw[key])raw[key]=stacks(raw[key]);
  for(const c of Array.isArray(raw.containers)?raw.containers:[])if(c)c.fluid=item(c.fluid);
  for(const d of Array.isArray(raw.devices)?raw.devices:[]){
    if(!d)continue;
    const outputs=catalog.recipeOutputIdentityMigrations?.[d.recipe];
    const factors=catalog.recipeOutputFactors?.[d.recipe];
    d.recipe=recipe(d.recipe);
    if(d.job?.outputs)d.job.outputs=stacks(d.job.outputs,outputs,factors);
    for(const key of ['fluidInputs','fluidOutputs'])if(d[key])d[key]=Object.fromEntries(Object.entries(d[key]).map(([id,target])=>[item(id),target]));
    for(const key of ['waterFluid','fuelType'])if(d[key])d[key]=item(d[key]);
  }
  for(const q of Array.isArray(raw.queue)?raw.queue:[])if(q)q.recipe=recipe(q.recipe);
  const p=raw.productionPlan;
  if(p){p.root=recipe(p.root);for(const step of Array.isArray(p.steps)?p.steps:[])if(step)step.recipe=recipe(step.recipe);}
  return raw;
}

export function migrateRecipeFavorites(value,catalog){
  if(!Array.isArray(value))return [];
  const items=catalog.itemIdentityMigrations??{},recipes=catalog.recipeIdentityMigrations??{},seen=new Set();
  return value.filter(x=>x&&typeof x.key==='string'&&typeof x.recipeId==='string'&&typeof x.itemId==='string'&&['craft','machines','recipes'].includes(x.tab)&&['uses','recipes'].includes(x.mode)).map(x=>({
    ...x,key:Object.hasOwn(recipes,x.key)?recipes[x.key]:x.key,
    recipeId:Object.hasOwn(recipes,x.recipeId)?recipes[x.recipeId]:x.recipeId,
    itemId:catalog.recipeOutputIdentityMigrations?.[x.recipeId]?.[x.itemId]??(Object.hasOwn(items,x.itemId)?items[x.itemId]:x.itemId),
  })).filter(x=>!seen.has(x.key)&&seen.add(x.key));
}
