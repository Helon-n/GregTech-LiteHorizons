import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CATALOG} from '../src/data/catalog.js';
import {ICON_GAPS} from '../src/data/icon-gaps.js';
import {itemIconPath,itemIconMissing,itemImage} from '../src/item-art.js';
import {auditIcons} from '../scripts/audit-icons.mjs';

const source=JSON.parse(fs.readFileSync(new URL('../src/assets/gtnh/sources.json',import.meta.url)));
test('the entire final catalog has actual vector artwork; placeholders never count as complete',()=>{
  const audit=auditIcons();
  assert.equal(audit.affectedItems,0,'all real item artwork must exist, be vector and drawable');
  assert.deepEqual([...new Set(audit.problems.map(p=>p.icon))].sort(),[...ICON_GAPS].sort(),'refresh the audited gaps only after inspecting their original source');
  const paths=new Set(Object.values(CATALOG.items).map(item=>itemIconPath(item,item.id)));
  for(const path of paths) assert.ok(fs.existsSync(fileURLToPath(new URL('../src/'+decodeURIComponent(path),import.meta.url))),path);
  const report=JSON.parse(fs.readFileSync(new URL('../docs/icon-gaps.json',import.meta.url)));
  assert.deepEqual(report,audit,'the detailed report must describe the actual final catalog, including aliases');
});

test('repaired subtypes retain original texture identities and material colors',()=>{
  const find=(registry,meta)=>Object.values(CATALOG.items).find(item=>item.nativeItem?.registry===registry&&item.nativeItem.meta===meta);
  const check=(registry,meta,texture)=>{
    const item=find(registry,meta);assert.ok(item,registry+'@'+meta);
    assert.equal(itemIconMissing(item,item.id),false,item.id);
    const provenance=source.icons[item.icon||item.id];
    assert.ok(provenance.sources.some(s=>s.texture===texture),item.id+' must use its registered texture');
  };
  check('EnderIO:itemMaterial',5,'assets/enderio/textures/items/pulsatingCrystal.png');
  check('Natura:planks',2,'assets/natura/textures/blocks/ghostwood_planks.png');
  check('Natura:planks',8,'assets/natura/textures/blocks/purpleheart_planks.png');
  check('Botany:insulatedTube',0,'assets/botany/textures/items/insulatedTube.1.png');
  const tubes=[0,1,128].map(meta=>find('Botany:insulatedTube',meta));
  assert.ok(tubes.every(Boolean));
  const artwork=tubes.map(item=>fs.readFileSync(new URL('../src/'+itemIconPath(item,item.id),import.meta.url),'utf8'));
  assert.equal(new Set(artwork).size,3,'copper, tin and insulation types must not collapse into one picture');
  const fluid=CATALOG.items.fluidDye_watermixed_dyeRed;
  assert.equal(itemIconMissing(fluid,fluid.id),false);
  assert.ok(source.icons[fluid.id].sources.some(s=>s.texture.endsWith('/fluid.dyes.png')&&s.tint==='#ff0000'));
});

test('unknown art is visibly identified, aliases use the same status, and tooltip content is escaped',()=>{
  const key='__unavailable_art_fixture__';ICON_GAPS.add(key);
  try {
  assert.equal(itemIconPath({icon:key},'alias'),'assets/ui/item-unavailable.svg');
  assert.match(itemImage({icon:key,name:'铜"<板>'},'alias'),/暂无图标/);
  assert.match(itemImage({icon:key,name:'铜"<板>'},'alias'),/&quot;&lt;板&gt;/);
  assert.doesNotMatch(itemImage(CATALOG.items.wood,'wood'),/暂无图标/);
  }finally{ICON_GAPS.delete(key);}
});

test('runtime art preserves machine metadata, custom renderers and wildcard preview identity',()=>{
  const check=(key,registry,meta)=>{
    const art=source.icons[key];assert.ok(art,key);
    assert.equal(art.registration.registry,registry,key);assert.equal(art.registration.meta,meta,key);
    assert.match(art.note,/No resource pack/);assert.ok(art.sources.every(s=>s.sha256&&s.sha256.length===64));
  };
  check('cyclotron','gregtech:gt.blockmachines',828);
  check('preciseAssembler','gregtech:gt.blockmachines',32018);
  check('godforgePlasma','gregtech:gt.blockmachines',15414);
  check('naquadahReactor4','gregtech:gt.blockmachines',1190);
  check('naquadahReactor8','gregtech:gt.blockmachines',1189);
  check('modItem_BuildCraftRobotics_robot_0','BuildCraft|Robotics:robot',0);
  const wildcard=source.icons.modItem_AppliedEnergistics2_tileBlockSkyChest_32767.registration;
  assert.equal(wildcard.inputMeta,32767);assert.equal(wildcard.meta,0);assert.match(wildcard.preview,/identity unchanged/);
  assert.equal(CATALOG.items.modItem_AppliedEnergistics2_tileBlockSkyChest_32767.nativeItem.meta,32767);
  assert.equal(itemIconPath(CATALOG.items.spaceTime,'spaceTime'),itemIconPath(CATALOG.items.spacetime,'spacetime'));
  assert.equal(itemIconPath(CATALOG.items.titaniumtetrachloride,'titaniumtetrachloride'),itemIconPath(CATALOG.items.titaniumTetrachloride,'titaniumTetrachloride'));
  const variants=[0,16,17].map(meta=>`modItem_ProjectRedTransmission_projectredtransmissionwire_${meta}`);
  const images=variants.map(key=>fs.readFileSync(new URL('../src/assets/gtnh/'+key+'.svg',import.meta.url),'utf8'));
  assert.equal(new Set(images).size,3,'red alloy, insulated and bundled cable retain distinct original artwork');
});
