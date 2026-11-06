export function recipeEntries(catalog,stage){
  return [
    ...catalog.recipes,
    ...Object.values(catalog.machines).map(m=>({...m,id:'build:'+m.id,machine:m.id,inputs:m.cost,outputs:{[m.id]:1},seconds:0,process:'build'}))
  ].filter(r=>r.stage<=stage);
}
export function recipesForItem(entries,id,mode='recipes',catalog=null){
  if(mode==='uses'&&catalog?.machines[id]){
    const processes=new Set(catalog.machines[id].processes);
    return entries.filter(r=>processes.has(r.process)||(r.alsoProcesses??[]).some(process=>processes.has(process)));
  }
  return entries.filter(r=>mode==='uses'?Object.hasOwn(r.inputs,id)||Object.hasOwn(r.tools||{},id):Object.hasOwn(r.outputs,id)||(r.energyOutputs??[]).includes(id));
}
export function productName(catalog,r){return r.exchanger?catalog.items[r.exchanger.hot].name+'换热':r.turbineKind?catalog.items[r.turbineFuel].name+'发电':r.boilerFuel?catalog.items[r.boilerFuel].name+'供热':r.largeBoiler?r.name:r.process==='generateLFTR'?'熔盐反应堆发电':r.fuel?(catalog.items[r.fuel]?.name||r.fuel)+'发电':r.process==='generateSolar'?'太阳能发电':Object.keys(r.outputs).map(id=>catalog.items[id].name).join(' + ')||'电能';}
