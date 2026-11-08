import fs from 'node:fs';
import {CATALOG} from '../src/data/catalog.js';
import {auditIcons} from './audit-icons.mjs';

const bindings=JSON.parse(fs.readFileSync(new URL('./data/runtime-icon-bindings.json',import.meta.url)));
const seen=new Set(),tasks=[];
for(const problem of auditIcons().problems){
  const {id,icon:key}=problem;if(seen.has(key))continue;seen.add(key);
  const item=CATALOG.items[id],native=item.nativeItem;
  let row=native?{registry:native.registry,meta:native.meta||0}:item.nativeVanilla?{registry:'minecraft:'+item.nativeVanilla,meta:0}:null;
  if(bindings.machines[key]!=null)row={registry:bindings.machineRegistry,meta:bindings.machines[key]};
  if(bindings.blockFields[key])row={registry:'kekztech:'+key,meta:0,fieldClass:bindings.blockFields[key][0],fieldName:bindings.blockFields[key][1]};
  if(row&&bindings.railcraftTracks[row.registry])row.trackEnum=bindings.railcraftTracks[row.registry];
  if(bindings.previewMetadata[key]!=null)row.previewMeta=bindings.previewMetadata[key];
  if(!row)throw Error('No reviewed runtime binding: '+id);
  tasks.push({key,id,...row});
}
fs.mkdirSync(new URL('../.local/icon-client/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../.local/icon-client/icon-tasks.json',import.meta.url),JSON.stringify(tasks,null,2)+'\n');
console.log(`Prepared ${tasks.length} distinct original-icon requests.`);
