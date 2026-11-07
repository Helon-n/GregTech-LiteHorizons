// Layouts belong to the idle adaptation; they are not original GTNH NEI recipes.
const patterns={
  sticks:[null,null,null,null,'wood',null,null,null,null],
  pick:['flint','flint','flint',null,'stick',null,null,'stick',null],
  hammer:['iron','iron','iron','iron','iron','iron',null,'stick',null],
  'build:workbench':['wood','wood',null,'wood','wood',null,null,null,null],
  'build:furnace':['stone','stone','stone','stone','clay','stone','stone','stone','stone']
};

export function craftingGrid(id,inputs,nativePattern=null){
  const pattern=nativePattern??patterns[id];
  if(pattern){
    const occurrences={};
    for(const item of pattern)if(item)occurrences[item]=(occurrences[item]||0)+1;
    if(Object.keys(inputs).length===Object.keys(occurrences).length&&Object.entries(occurrences).every(([item,n])=>inputs[item]>=n&&Number.isInteger(inputs[item]/n)))
      return pattern.map(item=>item?{id:item,count:inputs[item]/occurrences[item]}:null);
  }
  const entries=Object.entries(inputs).filter(([,count])=>count>0);
  if(entries.length>9)throw Error('工作台配方超过九种原料');
  const slots=Array(9).fill(null);
  const positions=entries.length===1?[4]:entries.length===2?[3,5]:entries.length===3?[3,4,5]:[0,1,2,3,4,5,6,7,8];
  entries.forEach(([id,count],i)=>slots[positions[i]]={id,count});
  return slots;
}

// Structure costs are a bill of materials, not a workbench crafting recipe.
// Preserve every ingredient and split large structures into nine-slot pages.
export function constructionSlots(id,inputs){
  const entries=Object.entries(inputs).filter(([,count])=>count>0);
  if(entries.length<=9)return craftingGrid(id,inputs);
  const slots=entries.map(([id,count])=>({id,count}));
  while(slots.length%9)slots.push(null);
  return slots;
}
