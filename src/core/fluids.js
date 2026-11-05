export const isFluid=(catalog,id)=>catalog.items[id]?.kind==='fluid';
export const containerCapacity=(catalog,c)=>c.type==='legacyTank'?c.capacity:catalog.containerTypes[c.type].capacity;
export const acceptsFluid=(catalog,c,id)=>isFluid(catalog,id)&&(!catalog.containerTypes[c.type].accepts||catalog.containerTypes[c.type].accepts.includes(id));

export function drainFluid(containers,id,amount){
  for(const c of containers){
    if(c.fluid!==id)continue;
    const used=Math.min(c.amount,amount);c.amount-=used;amount-=used;
    if(c.amount<1e-8)c.amount=0;
    if(amount<1e-8)break;
  }
}

// Simulate the entire batch before mutating; two products cannot claim one empty tank.
export function planFluids(catalog,containers,stacks,inputs={}){
  const draft=containers.map(c=>({...c}));
  for(const[id,n]of Object.entries(inputs))if(isFluid(catalog,id))drainFluid(draft,id,n);
  for(const[id,n]of Object.entries(stacks)){
    if(!isFluid(catalog,id)||!n)continue;
    let left=n;
    for(const c of [...draft.filter(c=>c.fluid===id),...draft.filter(c=>!c.fluid)]){
      if(!acceptsFluid(catalog,c,id))continue;
      const added=Math.min(left,Math.max(0,containerCapacity(catalog,c)-c.amount));
      if(added<=0)continue;
      c.fluid=id;c.amount+=added;left-=added;
      if(left<1e-8)break;
    }
    if(left>1e-8)return null;
  }
  return draft;
}
