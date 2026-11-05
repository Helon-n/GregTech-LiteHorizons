export function recipeEntries(catalog,stage){
  return [
    ...catalog.recipes,
    ...Object.values(catalog.machines).map(m=>({...m,id:'build:'+m.id,machine:m.id,inputs:m.cost,outputs:{[m.id]:1},seconds:0,process:'build'}))
  ].filter(r=>r.stage<=stage);
}
export function recipesForItem(entries,id,mode='recipes'){
  return entries.filter(r=>mode==='uses'?Object.hasOwn(r.inputs,id)||Object.hasOwn(r.tools||{},id):Object.hasOwn(r.outputs,id));
}
export function productName(catalog,r){return Object.keys(r.outputs).map(id=>catalog.items[id].name).join(' + ')||'电能';}
