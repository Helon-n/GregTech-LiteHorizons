// Compare with the immutable release catalog. Retain only semantically
// equivalent renamed recipes; fail if an old recipe disappeared unexpectedly.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {TECHNOLOGY_IMPORT as next} from '../src/data/technology-import.js';
const baseline=process.argv[2]??'v0.1.12';
const source=execFileSync('git',['show',`${baseline}:src/data/technology-import.js`],{encoding:'utf8',maxBuffer:150e6});
const old=JSON.parse(source.slice(source.indexOf('=')+1).trim().replace(/;$/,''));
const aliases={gTPP_Water:'water',borosilicateGlassBlock:'modItem_BartWorks_BWTieredGlass_0',blaze_rod:'blazeRod',blaze_powder:'blazeDust',modItem_IndustrialCraft2_itemBatREDischarged_0:'ic2_reBattery'};
for(const suffix of ['Dust','DustSmall','DustTiny'])aliases['werkstoffLoader_Calcium'+suffix]='calcium'+suffix;
// BartWorks enforces ore-dictionary unification for these solid dust forms.
// Keep GT++ fluid identities: they have different registrations and properties.
for(const material of ['Rhodium','Ruthenium'])for(const form of ['Dust','DustSmall','DustTiny','Block','Plate','Foil','Rod','LongRod','Gear','SmallGear','FineWire','Bolt','Screw','Ring','Rotor','Nugget',''])aliases[`gTPP_${material}${form}`]=`werkstoffLoader_${material}${form}`;
// Old GT++ ingots collided with their fluid IDs. Tanks retain fluid identity;
// corrected recipes use an explicit Ingot suffix. Match the old recipe only
// when all quantities, tools, energy, conditions and source agree.
const splitIds={};
for(const [id,item]of Object.entries(old.items))if(item.native?.material?.startsWith('GTPP_')&&['fluid','ingot'].includes(item.native.prefix)){
  if(next.items[id+'Ingot']){splitIds[id]=id;splitIds[id+'Ingot']=id;}
  if(item.kind==='item'&&item.native.prefix==='ingot'&&next.items[id+'Ingot'])aliases[id]=id+'Ingot';
  if(item.kind==='fluid'&&!next.items[id]&&next.items[id+'Molten']){
    aliases[id]=id+'Molten';splitIds[id+'Molten']=id;
  }
}
const norm=x=>{
  if(Array.isArray(x))return x.map(norm);
  if(!x||typeof x!=='object')return Object.hasOwn(aliases,x)?aliases[x]:x;
  const result={};
  for(const [key,value]of Object.entries(x)){
    const id=Object.hasOwn(aliases,key)?aliases[key]:key,v=norm(value);
    // Multiple old names may have referred to one real material stack.
    result[id]=Object.hasOwn(result,id)&&typeof v==='number'?result[id]+v:v;
  }
  return Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
};
const signature=r=>JSON.stringify(norm(Object.fromEntries(['process','inputs','outputs','tools','seconds','power','rolls','requirements','circuit','grid','gridTools','craftingSource'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]]))));
const ids=new Set(next.recipes.map(r=>r.id)),bySignature=new Map(next.recipes.map(r=>[signature(r),r.id]));
const splitNorm=value=>{
  if(Array.isArray(value))return value.map(splitNorm);
  if(!value||typeof value!=='object')return splitIds[value]??value;
  const result={};for(const [key,v]of Object.entries(value))result[splitIds[key]??key]=splitNorm(v);
  return Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
};
const splitSignature=r=>JSON.stringify(splitNorm(JSON.parse(signature(r))));
const splitCandidates=new Map();for(const r of next.recipes){const key=splitSignature(r);const list=splitCandidates.get(key)??[];list.push(r);splitCandidates.set(key,list);}
const correctedMolten=r=>{
  if(r.process!=='godforgeMolten')return null;
  const outputs={...r.outputs};let changed=false;
  for(const [id,n]of Object.entries(outputs))if(aliases[id]?.endsWith('Molten')&&old.items[id]?.native?.material?.startsWith('GTPP_')&&n%1000===0){outputs[id]=n/1000*144;changed=true;}
  return changed?{...r,outputs}:null;
};
const migrations={},outputMigrations={},outputFactors={},unmatched=[];
for(const r of old.recipes)if(!ids.has(r.id)){
  let id=bySignature.get(signature(r));
  if(!id){
    const corrected=correctedMolten(r);
    const candidates=(splitCandidates.get(splitSignature(r))??(corrected?splitCandidates.get(splitSignature(corrected)):[])??[]).filter(n=>n.origin?.file===r.origin?.file&&n.origin?.line===r.origin?.line);
    if(candidates.length===1)id=candidates[0].id;
  }
  if(id){
    migrations[r.id]=id;const replacement=next.recipes.find(n=>n.id===id),outputs={},factors={};
    for(const key of Object.keys(r.outputs)){
      const matches=Object.keys(replacement.outputs).filter(n=>(splitIds[aliases[n]??n]??(aliases[n]??n))===(splitIds[aliases[key]??key]??(aliases[key]??key)));
      if(matches.length===1){
        if(matches[0]!==key)outputs[key]=matches[0];
        if(replacement.outputs[matches[0]]!==r.outputs[key])factors[key]=replacement.outputs[matches[0]]/r.outputs[key];
      }
    }
    if(Object.keys(outputs).length)outputMigrations[r.id]=outputs;
    if(Object.keys(factors).length)outputFactors[r.id]=factors;
  }else unmatched.push(r);
}
fs.writeFileSync('.local/unmatched-recipes.json',JSON.stringify(unmatched,null,2));
if(unmatched.length)throw Error(`${unmatched.length} old recipes lack an equivalent replacement; see .local/unmatched-recipes.json`);
fs.writeFileSync('src/data/catalog-identities.js',`// Generated by scripts/migrate-catalog-identities.mjs from ${baseline}.\n// Keep stored amounts, energy and paid batch progress. OUTPUT_FACTORS correct\n// the old Godforge 1000 mB/unit bug to the source's 144 mB/unit in pending jobs.\nexport const ITEM_IDENTITIES=Object.freeze(${JSON.stringify(aliases,null,2)});\nexport const RECIPE_IDENTITIES=Object.freeze(${JSON.stringify(migrations,null,2)});\nexport const RECIPE_OUTPUT_IDENTITIES=Object.freeze(${JSON.stringify(outputMigrations,null,2)});\nexport const RECIPE_OUTPUT_FACTORS=Object.freeze(${JSON.stringify(outputFactors,null,2)});\n`);
console.log(JSON.stringify({baseline,old:old.recipes.length,current:next.recipes.length,renamed:Object.keys(migrations).length,missing:0}));
