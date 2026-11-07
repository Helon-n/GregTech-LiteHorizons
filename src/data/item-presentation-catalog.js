import {ITEM_PRESENTATIONS} from './item-presentations.js';

// Resolve once during catalog assembly, not on each render or tree expansion.
// Keys include the damage value: sibling subtypes must retain distinct identities.
export function applyItemPresentations({items,recipes},presentations=ITEM_PRESENTATIONS){
  const previousNames=new Map();
  for(const item of Object.values(items)){
    const native=item.nativeItem;
    if(!native)continue;
    const presentation=presentations[`${native.registry}@${native.meta??0}`];
    if(!presentation)continue;
    if(item.name!==presentation.name)previousNames.set(item.id,item.name);
    item.name=presentation.name;
    item.nativeItem={...native,...presentation.nativeItem,name:presentation.name};
  }
  for(const recipe of recipes){
    if(recipe.randomChoice)continue;
    const outputs=Object.keys(recipe.outputs);
    if(!outputs.some(id=>previousNames.has(id)))continue;
    const oldTitle=outputs.map(id=>previousNames.get(id)??items[id].name).join(' + ');
    // Keep authored process/route titles. Only replace labels derived from outputs.
    if(recipe.name===oldTitle)recipe.name=outputs.map(id=>items[id].name).join(' + ');
  }
}
