// Vanilla 1.7.10: one smelt takes 200 ticks; coal and charcoal burn 1600.
// Use eight-item batches to keep inventory/fuel quantities integral without
// inventing a free electric recipe or changing the existing brick furnace.
export const FURNACE_REFERENCE=Object.freeze({
  ticksPerItem:200,fuelTicks:1600,batch:8,
  source:'https://raw.githubusercontent.com/eldariamc/client/c01d23eb05ed83abb4fee00f9bf603b6bc3e2e27/src/main/java/net/minecraft/tileentity/TileEntityFurnace.java',
  sha256:'70c3ae83350bca59e21f22c7982959d54ab214f291f6c2b3f9856ed84f9b3571'
});

export function applyFurnaceCatalog({items,recipes}){
  const {batch,ticksPerItem}=FURNACE_REFERENCE,existing=new Set(recipes.map(r=>r.id));
  // Only explicit ordinary-furnace registrations qualify. An electric furnace
  // process by itself is not evidence that a primitive furnace may use it.
  const registered=recipes.filter(r=>r.furnaceRegistry&&r.process==='electricSmelt');
  for(const r of registered){
    const inputs=Object.entries(r.inputs),outputs=Object.entries(r.outputs);
    if(inputs.length!==1||inputs[0][1]!==1||outputs.length!==1||r.requirements||r.tools||
      items[inputs[0][0]]?.kind!=='item'||items[outputs[0][0]]?.kind!=='item')continue;
    for(const fuel of ['coal','charcoal']){
      const id=`furnace:${r.id}:${fuel}`;
      if(existing.has(id))continue;
      recipes.push({
        id,name:items[outputs[0][0]].name,process:'smelt',stage:r.stage,
        inputs:{[inputs[0][0]]:batch,[fuel]:1},outputs:{[outputs[0][0]]:outputs[0][1]*batch},
        seconds:ticksPerItem*batch/20,power:0,source:'GTNH2.9',origin:r.origin,
        furnaceRegistry:true,furnaceBatch:{recipe:r.id,fuel,items:batch,fuelTicks:FURNACE_REFERENCE.fuelTicks},
        batchAdapted:true
      });
      existing.add(id);
    }
  }
}
