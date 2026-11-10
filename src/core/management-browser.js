import {createSearch} from './search.js';

export const compareNames=(a,b)=>String(a??'').localeCompare(String(b??''),'zh-CN',{numeric:true});
export const deviceHasTask=d=>Boolean(d.hasTask||d.recipe||d.job);

export function deviceMatches(game,d,query){
  const matches=typeof query==='function'?query:createSearch(query);
  const members=d.group?game.members(d.id):[d];
  return members.some(member=>{
    const recipe=game.recipeById.get(member.recipe);
    return matches(game.catalog.machines[member.type]?.name,member.alias,d.alias,d.group?.name,member.id,d.id,
      ...Object.keys(recipe?.outputs??{}).map(id=>game.catalog.items[id]?.name));
  });
}

export function compareDevices(game,a,b,organized=true){
  return (organized?Number(deviceHasTask(b))-Number(deviceHasTask(a)):0)||
    compareNames(a.alias||game.catalog.machines[a.type]?.name,b.alias||game.catalog.machines[b.type]?.name)||compareNames(a.id,b.id);
}
