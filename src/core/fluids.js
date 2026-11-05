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
export function planFluids(catalog,containers,stacks,inputs={},targets={},groups=[]){
  const draft=containers.map(c=>({...c}));
  const byId=new Map(draft.map(c=>[c.id,c])),targetGroups=new Map(),memberGroups=new Map();
  for(const g of groups.filter(g=>g.kind==='fluid')){const members=g.members.map(id=>byId.get(id)).filter(Boolean);targetGroups.set(g.id,members);for(const c of members)memberGroups.set(c.id,members);}
  for(const[id,n]of Object.entries(inputs))if(isFluid(catalog,id))drainFluid(draft,id,n);
  // Explicit destinations claim their space before automatically routed products.
  for(const[id,n]of Object.entries(stacks).sort(([a],[b])=>Number(!!targets[b])-Number(!!targets[a]))){
    if(!isFluid(catalog,id)||!n)continue;
    let left=n;
    const candidates=targets[id]?(targetGroups.get(targets[id])||draft.filter(c=>c.id===targets[id])).filter(c=>!c.fluid||c.fluid===id):[...draft.filter(c=>c.fluid===id),...draft.filter(c=>!c.fluid)];
    for(const c of candidates){
      if(!acceptsFluid(catalog,c,id))continue;
      const members=memberGroups.get(c.id)||[c];
      if(members.some(c=>!acceptsFluid(catalog,c,id)||(c.fluid&&c.fluid!==id)))continue;
      const added=Math.min(left,Math.max(0,containerCapacity(catalog,c)-c.amount));
      if(added<=0)continue;
      for(const member of members)member.fluid=id;
      c.amount+=added;left-=added;
      if(left<1e-8)break;
    }
    if(left>1e-8)return null;
  }
  return draft;
}
