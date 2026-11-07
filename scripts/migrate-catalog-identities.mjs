// Compare with the immutable release catalog. Retain only semantically
// equivalent renamed recipes; fail if an old recipe disappeared unexpectedly.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {TECHNOLOGY_IMPORT as next} from '../src/data/technology-import.js';
const baseline=process.argv[2]??'v0.1.12';
const source=execFileSync('git',['show',`${baseline}:src/data/technology-import.js`],{encoding:'utf8',maxBuffer:150e6});
const old=JSON.parse(source.slice(source.indexOf('=')+1).trim().replace(/;$/,''));
// Keep v0.1.12 as the immutable identity-split baseline. Also cover recipes
// first added after it so existing v0.1.13–15 jobs remain loadable.
const history=[...old.recipes],historicalIds=new Set(history.map(r=>r.id));
const additionalBaselines=baseline==='v0.1.12'?['v0.1.15']:[];
for(const ref of additionalBaselines){
  const text=execFileSync('git',['show',`${ref}:src/data/technology-import.js`],{encoding:'utf8',maxBuffer:150e6});
  const previous=JSON.parse(text.slice(text.indexOf('=')+1).trim().replace(/;$/,''));
  for(const r of previous.recipes)if(!historicalIds.has(r.id)){history.push(r);historicalIds.add(r.id);}
}
const aliases={gTPP_Water:'water',borosilicateGlassBlock:'modItem_BartWorks_BWTieredGlass_0',blaze_rod:'blazeRod',blaze_powder:'blazeDust',modItem_IndustrialCraft2_itemBatREDischarged_0:'ic2_reBattery',modItem_IndustrialCraft2_itemAdvBat_0:'ic2_advBattery'};
// Minecraft lapis is dye metadata 4; GT unifies it as gemLapis.
aliases.vanillaDye4='lapisGem';
aliases.reinforcedGlassLens='nhItem_ReinforcedGlassLense';
aliases.reinforcedGlassPlate='nhItem_ReinforcedGlassPlate';
for(const material of ['Steel','Aluminium','StainlessSteel','Titanium','TungstenSteel','Chrome','Iridium','Osmium','Neutronium'])aliases[`modItem_NewHorizonsCoreMod_${material}Bars_0`]=`nhBlock_${material}Bars`;
for(const [material,owner]of [['Zirconium','werkstoffLoader'],['Thorium232','werkstoffLoader'],['Hafnium','werkstoffMaterialPool'],['Iodine','werkstoffMaterialPool']])for(const form of ['Dust','DustSmall','DustTiny'])aliases[`gTPP_${material}${form}`]=`${owner}_${material}${form}`;
// Explicit metadata-zero crystals are identical to the default IC2 stacks.
for(const name of ['energyCrystal','lapotronCrystal'])aliases[`ic2_${name}Meta0`]=`ic2_${name}`;
for(const suffix of ['Dust','DustSmall','DustTiny'])aliases['werkstoffLoader_Calcium'+suffix]='calcium'+suffix;
for(const suffix of ['Dust','DustSmall','DustTiny'])aliases['gTPP_Dysprosium'+suffix]='dysprosium'+suffix;
// These physical dusts share GT++'s registered dustAmmoniumNitrate ore keys.
// The Lanthanides ammonium-nitrate fluid remains a separate registration.
for(const [form,field]of [['Dust','AmmoniumNitrateDust'],['DustSmall','SmallAmmoniumNitrateDust'],['DustTiny','TinyAmmoniumNitrateDust']])aliases['botWerkstoffMaterialPool_AmmoniumNitrate'+form]='gtppItem_'+field;
// BartWorks enforces ore-dictionary unification for these solid dust forms.
// Keep GT++ fluid identities: they have different registrations and properties.
for(const material of ['Rhodium','Ruthenium'])for(const form of ['Dust','DustSmall','DustTiny','Block','Plate','Foil','Rod','LongRod','Gear','SmallGear','FineWire','Bolt','Screw','Ring','Rotor','Nugget',''])aliases[`gTPP_${material}${form}`]=`werkstoffLoader_${material}${form}`;
// Old GT++ ingots collided with their fluid IDs. Tanks retain fluid identity;
// corrected recipes use an explicit Ingot suffix. Match the old recipe only
// when all quantities, tools, energy, conditions and source agree.
const splitIds={};
// Fiery Blood (Material.getFluid) and Fiery Steel ingots also collided.
// Keep existing solid stock; identify the fluid correction per recipe source.
splitIds.fieryBlood='fierySteel';
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
const signature=r=>{
  const requirements=r.requirements?.researchItem?{researchCount:1,...r.requirements}:r.requirements;
  return JSON.stringify(norm(Object.fromEntries(['process','inputs','outputs','tools','seconds','power','rolls','requirements','circuit','grid','gridTools','craftingSource'].filter(k=>r[k]!==undefined).map(k=>[k,k==='requirements'?requirements:r[k]]))));
};
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
// These three historical recipes fabricated a powder form that ReinforcedGlass
// never registers. They must be retired and refunded, not matched to a recipe
// with different yields or retained as craftable legacy shortcuts.
const retiredIds=new Set(['tech29:16eec1be37062206','tech29:48f707bcc3d46278','tech29:2c70b667a8bdfdb7']);
const retired={},retiredItems={};
const migrations={},outputMigrations={},outputFactors={},unmatched=[];
for(const r of history)if(!ids.has(r.id)){
  if(retiredIds.has(r.id)){
    if(r.origin?.file!=='gregtech/loaders/oreprocessing/ProcessingLens.java'&&r.origin?.file!=='gregtech/common/GTProxy.java')throw Error('Unexpected retired glass recipe source');
    retired[r.id]=norm(r);
    for(const id of Object.keys({...r.inputs,...r.outputs}))if(!next.items[id]&&!aliases[id])retiredItems[id]={...old.items[id],name:'旧版'+old.items[id].name,migrationOnly:true};
    continue;
  }
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
fs.writeFileSync('src/data/catalog-identities.js',`// Generated by scripts/migrate-catalog-identities.mjs from ${baseline}.\n// Keep stored amounts, energy and paid batch progress. OUTPUT_FACTORS correct\n// the old Godforge 1000 mB/unit bug to the source's 144 mB/unit in pending jobs.\nexport const ITEM_IDENTITIES=Object.freeze(${JSON.stringify(aliases,null,2)});\nexport const RECIPE_IDENTITIES=Object.freeze(${JSON.stringify(migrations,null,2)});\nexport const RECIPE_OUTPUT_IDENTITIES=Object.freeze(${JSON.stringify(outputMigrations,null,2)});\nexport const RECIPE_OUTPUT_FACTORS=Object.freeze(${JSON.stringify(outputFactors,null,2)});\nexport const RETIRED_TECHNOLOGY_RECIPES=Object.freeze(${JSON.stringify(retired,null,2)});\nexport const RETIRED_CATALOG_ITEMS=Object.freeze(${JSON.stringify(retiredItems,null,2)});\n`);
console.log(JSON.stringify({baseline,additionalBaselines,old:old.recipes.length,compared:history.length,current:next.recipes.length,renamed:Object.keys(migrations).length,retired:Object.keys(retired).length,missing:0}));
