// GT output chances are independent rolls in ten-thousandths, not expected yields.
export const outputChance=(r,id)=>r.outputChances?.[id]??10000;
export const outputRolls=r=>r.outputRolls??Object.entries(r.outputs).map(([id,count])=>({id,count,chance:outputChance(r,id)}));
export function guaranteedOutputs(r){
  if(r.purification||r.dynamic||r.dynamicAmount)return {};
  if(r.sparging){
    const {gas,amount,maximum,byproducts}=r.sparging,outputs={...r.outputs};
    for(const id of byproducts)outputs[id]=1;
    outputs[gas]=Math.max(1,amount-byproducts.length*maximum);return outputs;
  }
  const outputs={};for(const slot of outputRolls(r))if(slot.chance===10000)outputs[slot.id]=(outputs[slot.id]||0)+slot.count;return outputs;
}
export function yieldLabel(r,id){
  if(r.solarSalt)return '1∶1（转换量随蓄热变化）';
  if(r.purification)return `${r.outputs[id]}（处理成功后产出）`;
  if(r.sparging){
    const {gas,amount,maximum,byproducts}=r.sparging;
    if(id===gas)return `${Math.max(1,amount-byproducts.length*maximum)}–${amount-byproducts.length}（返还）`;
    if(byproducts.includes(id))return `1–${Math.min(maximum,amount-1)}（随机）`;
  }
  return outputRolls(r).filter(s=>s.id===id).map(s=>`${s.count}${s.chance<10000?'（'+s.chance/100+'%）':''}`).join(' + ');
}
export function rollOutputs(game,r){
  if(r.sparging){
    const {gas,amount,maximum,byproducts}=r.sparging,outputs={...r.outputs};let left=amount;
    for(const id of byproducts){const n=1+Math.floor(game.nextDropRandom()*Math.min(maximum,left-1));outputs[id]=n;left-=n;}
    outputs[gas]=left;return outputs;
  }
  const outputs={};
  for(const {id,count,chance}of outputRolls(r))if(chance>=10000||chance>0&&game.nextDropRandom()*10000<chance)outputs[id]=(outputs[id]||0)+count;
  return outputs;
}
export function validBatchOutputs(r,outputs){
  if(!outputs||typeof outputs!=='object'||Array.isArray(outputs)||Object.keys(outputs).some(id=>!Object.hasOwn(r.outputs,id)))return false;
  if(r.sparging){
    const {gas,amount,maximum,byproducts}=r.sparging;let left=amount;
    for(const id of byproducts){const n=outputs[id];if(!Number.isInteger(n)||n<1||n>Math.min(maximum,left-1))return false;left-=n;}
    if(outputs[gas]!==left)return false;
    return Object.entries(r.outputs).every(([id,n])=>id===gas||byproducts.includes(id)||outputs[id]===n);
  }
  for(const id of Object.keys(r.outputs)){
    let counts=new Set([0]);
    for(const s of outputRolls(r).filter(s=>s.id===id))counts=new Set([...counts].flatMap(n=>s.chance===10000?[n+s.count]:s.chance===0?[n]:[n,n+s.count]));
    if(!counts.has(outputs[id]??0))return false;
  }
  return true;
}
