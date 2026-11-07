// Each parallel operation retains its own independent output-slot rolls.
export function parallelRecipe(r,n=1){
  const scaled=field=>Object.fromEntries(Object.entries(field??{}).map(([id,value])=>[id,value*n]));
  return {...r,inputs:scaled(r.inputs),outputs:scaled(r.outputs),outputRolls:Array.from({length:n},()=>r.outputRolls??Object.entries(r.outputs).map(([id,count])=>({id,count,chance:r.outputChances?.[id]??10000}))).flat()};
}
export function parallelCount(game,d,r,limit,power){
  let n=d.planTask?1:limit;
  if(power>0)n=Math.min(n,Math.floor(8*4**d.energyTier*64/power));
  for(const[id,amount]of Object.entries(r.inputs))n=Math.min(n,Math.floor(game.inputQuantity(id,d.fluidInputs?.[id])/amount));
  n=Math.max(0,Math.floor(n));
  // Storage checks only need scaled totals. Avoid building thousands of
  // random-output slots for each candidate or scanning one batch at a time.
  const scaled=k=>({...r,inputs:Object.fromEntries(Object.entries(r.inputs).map(([id,v])=>[id,v*k])),outputs:Object.fromEntries(Object.entries(r.outputs).map(([id,v])=>[id,v*k]))});
  let low=0,high=n;
  while(low<high){const mid=low+Math.ceil((high-low)/2);if(game.canStoreBatch(d,scaled(mid)))low=mid;else high=mid-1;}
  return low;
}
