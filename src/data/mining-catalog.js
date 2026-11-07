import {MINING_REFERENCE as reference} from './mining-reference.js';
import {INDUSTRY_IMPORT as industry} from './industry-import.js';
import {TECHNOLOGY_IMPORT as technology} from './technology-import.js';

const normalize=id=>({ASTEROIDS:'Asteroids',KUIPERBELT:'KuiperBelt'}[id.replace(/^DimensionDef\./,'')]??id.replace(/^DimensionDef\./,''));
export function applyMiningCatalog({items,machines,recipes,gatherNodes}) {
  const tools={flintPick:{level:reference.materials.Flint.level}};
  for(const [id,material,input,name,stage] of [
    ['ironPick','Iron','iron','铁镐',0],['bronzePick','Bronze','bronze','青铜镐',1],
    ['steelPick','Steel','steel','钢镐',1],['diamondPick','Diamond','diamond','钻石镐',2],
    ['stainlessPick','StainlessSteel','stainless','不锈钢镐',4],
    ['tungstensteelPick','TungstenSteel','tungstensteel','钨钢镐',6],
    ['manyullynPick','Manyullyn','manyullyn','玛玉灵镐',4],['neutroniumPick','Neutronium','neutronium','中子素镐',9],
    ['duraniumPick','Duranium','duranium','铿铀镐',8],['infinityPick','Infinity','infinity','无尽镐',12],
  ]) {
    tools[id]={level:reference.materials[material].level};
    items[id]={id,name,category:'工具',kind:'item',icon:id};
    const powered=stage>=4;
    recipes.push({id:'mining:'+id,name,process:powered?'assemble':'craft',stage,inputs:{[input]:3,stick:2},outputs:{[id]:1},
      seconds:powered?8:4,power:powered?Math.max(30,reference.materials[material].processingEU):0,
      ...(!powered?{grid:[input,input,input,null,'stick',null,null,'stick',null],gridWidth:3}:{}),source:'idle-mining-adaptation'});
  }
  // Physical constructions represent discovering and activating world entrances.
  // Quantities are idle adaptations; no chapter grants world access.
  const portals=[
    ['netherPortal','下界传送门',1,{obsidianBlock:10,flint:1,iron:1},'obsidianBlock'],
    ['twilightPortal','暮色森林传送门',2,{diamond:1,water:1000,dirt:12,red_flower:12},'diamond'],
    ['endPortal','末地传送门',3,{enderEyeGem:12},'enderEyeGem'],
    ['evergladesPortal','永恒沼泽入口',4,{steelPlate:8,enderEyeGem:2},'grass'],
  ];
  for(const [id,name,stage,cost,icon] of portals) {
    items[id]={id,name,category:'机器',kind:'item',icon};
    machines[id]={id,name,stage,cost,processes:[],power:0,facility:true,description:'建成后允许前往对应地区采集'};
  }
  recipes.push({id:'mining:quenchObsidian',name:'浇筑黑曜石',process:'craft',stage:1,inputs:{lava:1000,water:1000},
    outputs:{obsidianBlock:1},seconds:5,power:0,source:'idle-mining-adaptation'});
  const regions={
    OW:{name:'主世界',requires:[]},NETHER:{name:'下界',requires:['netherPortal']},
    TWILIGHT_FOREST:{name:'暮色森林',requires:['twilightPortal']},THE_END:{name:'末地',requires:['endPortal']},
    EVERGLADES:{name:'永恒沼泽',requires:['evergladesPortal']},
  };
  const near=new Set(['Moon','Mars']);
  for(const dim of new Set([...industry.oreMaterials,...technology.oreMaterials].flatMap(ore=>(ore.dimensions??[]).map(normalize))))
    regions[dim]??={name:({Moon:'月球',Mars:'火星',Asteroids:'小行星带',EndAsteroids:'末地小行星',KuiperBelt:'柯伊伯带'}[dim]??dim),requires:[near.has(dim)?'rocket':'advancedRocket']};
  const ores=new Map();
  for(const ore of [...industry.oreMaterials,...technology.oreMaterials]) {
    const entry=ores.get(ore.id)??{dimensions:[]};
    entry.dimensions=[...new Set([...entry.dimensions,...(ore.dimensions??[]).map(normalize)])];ores.set(ore.id,entry);
  }
  const base={copperVein:'Copper',tinVein:'Tin',ironVein:'Iron',coalVein:'Coal',bauxiteVein:'Bauxite',saltVein:'Salt',
    sulfurVein:'Sulfur',rareVein:'RareEarth',rutileVein:'Rutile',redstoneVein:'Redstone',diamondVein:'Diamond'};
  for(const node of gatherNodes) {
    const material=base[node.id]??(node.id.startsWith('ore:')?node.id.slice(4):null);
    if(!material)continue;
    if(!reference.materials[material])throw Error('Unresolved mining level: '+material);
    node.miningLevel=reference.materials[material].oreLevel;
    node.regions=ores.get(material)?.dimensions.length?ores.get(material).dimensions:['OW'];
    delete node.requires; // Replaced with the real set of alternative ore dimensions.
    node.description='开采'+items[node.output].name;
  }
  // Small ores are one harvest level easier. Keep their crushed/impure drops
  // distinct from ordinary ore blocks so the bootstrap does not lower veins.
  for(const [material,id,name] of [['Iron','iron','铁'],['Tin','tin','锡']]) {
    const crushed=id+'Crushed',impure=id+'ImpureDust';
    gatherNodes.splice(3,0,{id:'smallOre:'+material,name:'贫'+name+'矿',output:crushed,stage:0,amount:1,seconds:4,
      miningLevel:Math.max(0,reference.materials[material].level-1),smallOre:true,regions:['OW'],
      description:'小型矿点，掉落粉碎矿或含杂粉',cost:{ironPlate:6},
      dropRanges:{[crushed]:{min:0,max:1},[impure]:{min:0,max:1}},
      exclusiveDrops:[{chance:.5,items:{[crushed]:1}},{chance:.5,items:{[impure]:1}}]});
    for(const input of [crushed,impure])recipes.push({id:'mining:smelt:'+input,name:'熔炼'+items[input].name,
      process:'smelt',stage:0,inputs:{[input]:1,coal:1},outputs:{[id]:1},seconds:8,power:0,source:'idle-mining-adaptation'});
  }
  const fixed={
    moon:['Moon'],mars:['Mars'],belt:['Asteroids'],oilWell:['OW'],lavaPool:['OW'],
    blazeHunt:['NETHER'],netherShardHunt:['NETHER'],ancientDebrisMine:['NETHER'],netherAtmosphere:['NETHER'],
    netherSoulSand:['NETHER'],netherSinExpedition:['NETHER'],
    boarHunt:['TWILIGHT_FOREST'],hydraExpedition:['TWILIGHT_FOREST'],twilightLibrary:['TWILIGHT_FOREST'],
    endShardHunt:['THE_END'],endstoneQuarry:['THE_END'],dragonExpedition:['THE_END'],
    lunarCheeseOre:['Moon'],fayaliteMine:['Mars'],tcetiSeaweed:['TcetiE'],barnardaForest:['BarnardC'],
  };
  for(const node of gatherNodes) {
    node.regions??=fixed[node.id]??(node.requires==='advancedRocket'?['Asteroids']:['OW']);
    if(['moon','mars','belt','lunarCheeseOre','endShardHunt','endstoneQuarry','dragonExpedition'].includes(node.id)) {
      delete node.requires;node.requiresAll=(node.requiresAll??[]).filter(id=>!['rocket','advancedRocket'].includes(id));
    }
    if(['moon','mars','belt','lunarCheeseOre','endstoneQuarry','ancientDebrisMine','fayaliteMine','orderShardMine'].includes(node.id)) {
      node.miningLevel??=node.id==='ancientDebrisMine'?4:node.id==='belt'?4:1;
      if(node.requires==='flintPick')delete node.requires;
    }
    if(node.id.startsWith('worldSample_')) {
      const native=items[node.output].nativeItem?.registry??'';
      const found=Object.keys(regions).find(id=>native.toLowerCase().includes(id.toLowerCase())&&id.length>3);
      if(found)node.regions=[found];
    }
  }
  // Keep the recommended tool in ascending capability order in access hints.
  return {tools:Object.fromEntries(Object.entries(tools).sort((a,b)=>a[1].level-b[1].level)),regions};
}
