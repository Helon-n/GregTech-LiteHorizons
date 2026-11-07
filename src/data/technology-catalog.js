import {TECHNOLOGY_IMPORT as T} from './technology-import.js';
import {ENERGY_REFERENCE as E} from './energy-reference.js';
import {GODFORGE_REFERENCE as G} from './godforge-reference.js';
import {PURIFICATION_REFERENCE as W} from './purification-reference.js';
import {NAQUADAH_REFERENCE as N} from './naquadah-reference.js';
import {RENEWABLES_REFERENCE as R} from './renewables-reference.js';
import {RTG_REFERENCE as RTG} from './rtg-reference.js';
import {NUCLEAR_REFERENCE as NUCLEAR} from './nuclear-reference.js';
import {FUEL_GENERATORS_REFERENCE as FUEL_GENERATORS} from './fuel-generators-reference.js';
import {CASTING_REFERENCE as CASTING} from './casting-reference.js';
import {SMELTERY_REFERENCE as SMELTERY} from './smeltery-reference.js';
import {MATTER_REFERENCE as MATTER} from './matter-reference.js';
import {REPLICATION_REFERENCE as REPLICATION} from './replication-reference.js';
import {BIOCHEMISTRY_REFERENCE as BIOCHEMISTRY} from './biochemistry-reference.js';
import {CIRCUIT_MIGRATIONS} from './circuit-progression.js';

export const COILS=Object.freeze([
  ['Cupronickel','白铜',1801],['Kanthal','坎塔尔合金',2701],['Nichrome','镍铬合金',3601],
  ['TungstenSteel','钨钯钒合金',4501],['HSSG','高速钢 G',5401],['HSSS','高速钢 S',6301],
  ['Naquadah','硅岩',7201],['NaquadahAlloy','硅岩合金',8101],['Trinium','凯金',9001],
  ['ElectrumFlux','通量琥珀金',9901],['AwakenedDraconium','觉醒龙',10801],
  ['Infinity','无尽',11701],['Hypogen','海珀珍',12601],['Eternal','永恒',13501],
].map(([key,name,heat])=>({item:'gtItem_Casing_Coil_'+key,name,heat})));

// Only original recipes with a replacement output are retired. The remaining
// idle construction/space progression is explicitly tracked in the coverage file.
export function applyTechnologyCatalog({items,machines,recipes,legacy,gatherNodes}){
  for(const[id,item]of Object.entries(T.items)){
    if(items[id])Object.assign(items[id],{native:item.native??items[id].native,nativeItem:item.nativeItem??items[id].nativeItem});
    else items[id]={...item};
  }
  for(const ore of T.oreMaterials??[]){
    const dims=ore.dimensions.map(d=>d.replace(/^DimensionDef\./,'')).map(d=>({ASTEROIDS:'Asteroids',KUIPERBELT:'KuiperBelt'}[d]??d));
    const region=dims.some(d=>['OW','NETHER','TWILIGHT_FOREST','THE_END','EVERGLADES'].includes(d))?'surface':dims.includes('Moon')?'moon':dims.includes('Mars')?'mars':dims.some(d=>['Asteroids','EndAsteroids'].includes(d))?'belt':dims.length?'deepSpace':null;
    if(!region)continue;
    // The technology import includes small deposits as well as large veins.
    // Update an existing planetary entry when the same ore also occurs early.
    const existing=gatherNodes.find(n=>n.output===ore.item),earlyDeepSpace=dims.some(d=>['BarnardC','BarnardE','BarnardF','Haumea','Horus','MakeMake','Proteus','TcetiE','Triton','VegaB'].includes(d));
    const stage=region==='surface'?2:region==='moon'?5:region==='mars'||region==='deepSpace'&&earlyDeepSpace?6:7;
    const requires=region==='surface'?null:region==='belt'||region==='deepSpace'&&!earlyDeepSpace?'advancedRocket':'rocket';
    const description=region==='surface'?'开采矿石':region==='moon'?'月球矿脉':region==='mars'?'火星矿脉':region==='deepSpace'?'深空矿脉':'小行星矿脉';
    if(existing){
      if(stage<existing.stage)Object.assign(existing,{stage,requires,description});
      continue;
    }
    gatherNodes.push({id:'ore:'+ore.id,name:ore.name+'矿脉',output:ore.item,stage,requires,amount:1,seconds:6,description,cost:{ironPlate:12,motor:2}});
  }
  const machine=(id,name,stage,processes,extra={})=>{
    machines[id]={id,name,stage,processes,cost:{[stage>=4?'stainlessPlate':'steelPlate']:8,basicCircuit:2,motor:2},power:E.voltage[Math.max(1,stage-1)],energy:{kind:'consumer',tier:Math.max(1,stage-1),maxTier:14},...extra};
    items[id]??={id,name,kind:'item',category:'机器'};
  };
  for(const row of [
    ['arcFurnace','电弧炉',2,['arcFurnace','plasmaArc']],['autoclave','高压釜',2,['autoclave']],
    ['extruder','挤压机',2,['extrude']],['cuttingMachine','切割机',2,['cut']],
    ['laserEngraver','激光刻蚀机',2,['laser']],['formingPress','成型机',2,['press']],
    ['fluidSolidifier','流体固化机',2,['solidify']],['fluidExtractor','流体提取机',2,['melt']],
    ['electricCompressor','电动压缩机',2,['electricCompress']],['electricAlloySmelter','电动合金炉',2,['alloy']],
    ['electricForgeHammer','电动锻造锤',2,['forgeHammer']],['implosionCompressor','聚爆压缩机',3,['implode']],
    ['fermenter','发酵机',2,['ferment']],['brewery','酿造机',2,['brew']],['polarizer','磁化机',2,['polarize']],
    ['circuitAssembler','电路组装机',2,['circuit']],['scanner','扫描仪',5,['research']],
    ['plasmaForge','等离子锻炉',10,['plasmaForge']],['plasmaMixer','超越等离子混合器',12,['plasmaMix']],
    ['chemicalDehydrator','化学脱水机',3,['dehydrate']],['alloyBlastSmelter','合金高炉',4,['alloyBlast']],
    ['molecularTransformer','分子重组仪',5,['molecularTransform']],['cyclotron','回旋加速器',5,['cyclotron']],
    ['digester','加压反应釜',4,['digest']],['neutroniumCompressor','中子素压缩机',6,['neutronCompress','electricCompress']],
    ['canner','装罐机',2,['canner']],['pyrolyseOven','热解炉',3,['pyrolyse','industrialCoke']],
    ['quantumForceTransformer','量子力场变换器',11,['quantumTransform']],
    ['pcbFactory','印刷电路板工厂',9,['pcbFactory']],['industrialPackager','工业打包机',3,['unpack']],
    ['algaePond','藻类池',3,['algaePond']],['neutronActivator','中子活化器',7,['neutronActivate']],
    ['nanoForge','纳米锻炉',10,['nanoForge']],['godforgePlasma','造物主等离子模块',13,['godforgePlasma']],
    ['dissolutionTank','溶解罐',7,['dissolve']],['naquadahFuelRefinery','硅岩燃料精炼厂',9,['naquadahRefine']],
    ['nuclearProcessingUnit','核燃料处理单元',6,['nuclearProcess']],
    ['industrialRockBreaker','工业圆石机',4,['rockBreak']],
    ['nanochipEncasement','纳米芯片封装器',11,['nanochipEncasement']],
    ['nanochipProcessor','纳米芯片处理器',12,['nanochipProcess']],
    ['vacuumFurnace','真空炉',4,['vacuumFurnace']],['electricImplosionCompressor','电动聚爆压缩机',8,['electricImplode']],
    ['fissionFuelProcessor','裂变燃料处理机',5,['fissionFuel']],['coldTrap','冷阱',5,['coldTrap']],
    ['spargeTower','气体喷射塔',5,['sparge']],['massAmplifier','UU 物质增幅器',3,['amplify']],
    ['simpleWasher','简易洗矿厂',2,['simpleWash']],
    ['nanochipAssemblyMatrix','纳米芯片装配矩阵',12,['nanochipAssemble']],
    ['nanochipBoardProcessor','纳米芯片基板处理器',12,['nanochipBoard']],
    ['nanochipEtchingArray','纳米芯片蚀刻阵列',12,['nanochipEtch']],
    ['nanochipCuttingChamber','纳米芯片切割室',12,['nanochipCut']],
    ['nanochipWireTracer','纳米芯片布线机',12,['nanochipWire']],
    ['nanochipSuperconductorSplitter','纳米芯片超导分离机',12,['nanochipSplit']],
    ['nanochipOpticalOrganizer','纳米芯片光学整理器',12,['nanochipOptical']],
    ['nanochipBiologicalCoordinator','纳米芯片生物协调器',12,['nanochipBio']],
    ['nanochipConverter','纳米芯片转换器',12,['nanochipConvert']],
    ['industrialCentrifuge','工业离心机 · 重型模式',6,['centrifuge']],
    ['flotationCell','泡沫浮选机',5,['flotation']],['isamill','艾萨研磨机',5,['mill']],['printer','打印机',2,['print']],
  ])machine(...row);
  machines.industrialPackager.processes.push('pack');
  for(const row of BIOCHEMISTRY.controllers){
    const id='bioLab'+row.code;
    machine(id,row.code+' 生物实验室',row.tier+1,['bioLab'],{cost:{[row.item]:1},icon:row.item,
      energy:{kind:'consumer',tier:row.tier,maxTier:row.tier},description:'培养、分离菌种；概率产物按每次实验独立计算'});
    items[id].icon=row.item;
  }
  for(const glass of BIOCHEMISTRY.vat.glasses){
    const id='bioVat'+glass.code,v=BIOCHEMISTRY.vat;
    machine(id,'细菌培养仓 · '+glass.code+' 玻璃',Math.max(4,glass.tier+1),['bioVat'],{
      cost:{[v.controller]:1,[v.hatch]:1,[v.casing]:19,[glass.item]:v.glassCount},icon:v.controller,bioVat:true,
      capabilities:{bioGlass:glass.tier},energy:{kind:'consumer',tier:3,maxTier:14},
      description:'按配方安装培养皿、从仓库装入辐射棒；辐射棒持续衰减，输出容器的存量影响培养倍率'});
    items[id].icon=v.controller;
  }
  for(const row of MATTER.controllers){
    const id='massFabricator'+row.code;
    machine(id,row.code+' 物质制造机',Math.max(4,row.tier+1),['massFabricate'],{cost:{[row.item]:1},icon:row.item,power:MATTER.power,energy:{kind:'consumer',tier:row.tier,maxTier:row.tier,massFabricator:true,inputAmps:MATTER.inputAmps,recipeAmps:MATTER.recipeAmps,bufferTicks:MATTER.bufferTicks},description:'消耗电力制造 UU 物质，可供给增幅剂加速；产物需要实体容器'});
    items[id].icon=row.item;
    // HV field generators require IV circuits (Core crafting loader:384).
    if(row.code==='HV')machines[id].stage=5;
  }
  for(const row of REPLICATION.controllers){
    const id=row.kind+row.code,scan=row.kind==='scanner';
    machine(id,row.code+(scan?' 元素扫描仪':' 复制机'),scan?row.tier+1:Math.max(4,row.tier+1),[scan?'elementScan':'replicate'],{cost:{[row.item]:1},icon:row.item,energy:{kind:'consumer',tier:row.tier,maxTier:row.tier},description:scan?'消耗样品和空白数据球记录元素数据':'保留元素数据球，消耗 UU 物质复制对应元素；流体产物需要容器'});
    items[id].icon=row.item;
    if(!scan&&row.code==='HV')machines[id].stage=5;
  }
  // These EV controllers need byproducts from GTNH's deep-space ore mixes.
  for(const id of ['massFabricatorEV','replicatorEV','rocketGenerator4'])if(machines[id])machines[id].stage=6;
  // UHV field generators use UEV circuits; these controllers cannot be built
  // until mutated living solder and the UEV circuit chain are available.
  for(const id of ['massFabricatorUHV','scannerUHV','replicatorUHV'])machines[id].stage=11;
  machines.compressor.processes=['electricCompress'];
  // MTENanoForge uses getMaxInputEu as the processing voltage. Bundle a
  // 64A port; it still draws every EU of the original high-power recipes.
  Object.assign(machines.nanoForge.energy,{inputAmps:64,recipeAmps:64,bufferTicks:4096,combinedInput:true});
  // MTEPlasmaForge.java:735 enables unlimited tier skips. Unlike a basic
  // single-block machine, its 64A feed can run recipes above hatch voltage.
  // This idle construction bundles that feed; actual EU/t is still consumed.
  for(const id of ['plasmaForge','stellarForge'])Object.assign(machines[id].energy,{inputAmps:64,recipeAmps:64,bufferTicks:4096,amperageOC:true,unlimitedTierSkips:true});
  // A dedicated complex/feed is bundled with each idle module. Shared NAC
  // power allocation and calibration bonuses are not granted for free.
  for(const id of ['nanochipAssemblyMatrix','nanochipBoardProcessor','nanochipEtchingArray','nanochipCuttingChamber','nanochipWireTracer','nanochipSuperconductorSplitter','nanochipOpticalOrganizer','nanochipBiologicalCoordinator','nanochipEncasement','nanochipProcessor']){
    Object.assign(machines[id].energy,{inputAmps:64,recipeAmps:64,bufferTicks:4096,nanochip:true});
  }
  machines.isamill.perfectOverclock=true;
  // Full 32-hatch canonical capacity is bundled in these idle construction costs.
  // Recipe voltage and startup gates remain separate, as in LargeFusionComputer.
  for(const [mark,tier,startupCapacity]of [[1,6,160000000],[2,7,320000000],[3,8,640000000],[4,9,5120000000],[5,10,20480000000]]){
    const id='largeFusionMk'+mark;
    machine(id,'大型聚变反应堆 Mk '+mark,tier+1,['fusion'],{icon:'fusion',cost:{[tier>=9?'cosmicPlate':'iridiumPlate']:64,quantumCircuit:16,fieldGenerator:16},energy:{kind:'consumer',tier,maxTier:tier,fusion:true,startupCapacity,advancedFusion:mark>=4}});
    items[id].icon='fusion';
  }
  machines.plasmaMixer.energy={kind:'consumer',tier:11,maxTier:11,prepaid:true};
  // Preserve the old controller's identity and paid construction materials.
  // Its retired placeholder recipes now use the real plasma-forge map/coils.
  machines.stellarForge.processes=['plasmaForge'];machines.stellarForge.coils=true;
  machines.industrialCentrifuge.capabilities={heavyCentrifuge:true};
  machine('cleanroomFacility','洁净室',2,[],{cost:{steelPlate:32,glass:16,basicCircuit:4,pump:4},energy:{kind:'consumer',tier:1,maxTier:1},power:4,facility:'cleanroom'});
  machines.neutroniumCompressor.capabilities={compressionTier:2};
  for(const [id,name,stage,process,key,levels,offset]of [
    ['chemicalPlant','化工厂',4,'chemicalPlant','chemicalCasing',8,0],
    ['preciseAssembler','精密组装机',6,'preciseAssemble','preciseCasing',5,0],
    ['componentAssemblyLine','部件装配线',5,'componentAssembly','componentCasing',13,1],
    ['spaceAssembler','轨道组装模块',10,'spaceAssemble','spaceModule',3,1],
  ])for(let n=0;n<levels;n++){
    const level=n+offset,type=id+(n?'Tier'+level:'');
    machine(type,name+' · '+level+' 级',Math.min(15,stage+n),[process],{capabilities:{[key]:level},icon:id,
      cost:{[stage+n>=7?'tungstensteelPlate':stage+n>=4?'stainlessPlate':'steelPlate']:16,basicCircuit:4,motor:4},
      ...(id==='spaceAssembler'?{orbital:true}:{})});
    items[type].icon=id;
  }
  machines.assembler.processes=machines.assembler.processes.filter(p=>p!=='circuit');
  machines.vacuumFreezer.stage=3;machines.vacuumFreezer.energy.tier=2;
  machines.vacuumFreezer.cost={steelPlate:16,goodCircuit:4,pump:4};
  machines.ebf.coils=true;machines.plasmaForge.coils=true;machines.digester.coils=true;machines.vacuumFurnace.coils=true;
  // The EBF controller uses LV circuits (MTERecipeLoader); two 2A LV
  // energy hatches can supply the 120 EU/t bootstrap smelts.
  machines.ebf.stage=2;machines.ebf.cost={steelPlate:24,basicCircuit:4,motor:4};
  machines.ebf.energy={kind:'consumer',tier:1,maxTier:14,inputAmps:4,recipeAmps:4};
  // GTNH multiblocks gate otherwise valid recipes on installed structure tiers.
  // Keep each capability combination explicit so dispatch cannot bypass a requirement.
  const gated=[
    ['pcbFactory','印刷电路板工厂','pcbFactory',['pcbTier','bioUpgrade']],
    ['quantumForceTransformer','量子力场变换器','quantumTransform',['qftTier','qftFocus']],
    ['algaePond','藻类池','algaePond',['algaeTier']],
    ['nanoForge','纳米锻炉','nanoForge',['nanoForgeTier']],
    ['naquadahFuelRefinery','硅岩燃料精炼厂','naquadahRefine',['refineryCoil']],
    ['godforgePlasma','造物主等离子模块','godforgePlasma',['plasmaTier','exoticTier','multiStepPlasma']],
    ['nanochipAssemblyMatrix','纳米芯片装配矩阵','nanochipAssemble',['nanochipTier']],
    ['neutronActivator','中子活化器','neutronActivate',['nkeRange']],
  ];
  for(const [baseId,name,process,keys] of gated){
    const source=machines[baseId];
    const requirements=[...recipes,...T.recipes].filter(r=>r.process===process||r.alsoProcesses?.includes(process))
      .map(r=>r.requirements??{}).filter(req=>keys.some(key=>req[key]!==undefined));
    const signatures=new Set();
    for(const req of requirements){
      const capabilities={};
      for(const key of keys)if(req[key]!==undefined)capabilities[key]=req[key];
      const signature=JSON.stringify(capabilities);
      if(signatures.has(signature))continue;signatures.add(signature);
      const titles={pcbTier:'结构',qftTier:'转换',qftFocus:'聚焦',algaeTier:'培养',nanoForgeTier:'锻炉',refineryCoil:'线圈',plasmaTier:'等离子',exoticTier:'奇异物质',nanochipTier:'矩阵'};
      const calibrations={NONE:'无',PRIMITIVE:'基础电路',CRYSTAL:'晶体电路',WETWARE:'湿件电路',BIO:'生物电路',OPTICAL:'光学电路',EXOTIC:'奇异电路',COSMIC:'宇宙电路',TEMPORAL:'时空电路',SPECIAL:'特殊电路'};
      const label=Object.entries(capabilities).map(([key,value])=>key==='nkeRange'?`${value.min}–${value.max} keV`:key==='bioUpgrade'?'生物升级':key==='multiStepPlasma'?'多阶段等离子':key==='nanochipCalibration'?(calibrations[value]??value)+'校准':`${titles[key]} ${value} 级`).join(' · ');
      // IDs depend on the actual settings, never on recipe enumeration order.
      const id=baseId+'_'+keys.map(key=>key+(key==='nkeRange'?`${req[key]?.min??0}to${req[key]?.max??0}`:req[key]??0)).join('_');
      const stage=baseId==='algaePond'?Math.max(1,Math.min(15,req.algaeTier+1)):source.stage;
      machine(id,name+' · '+label,stage,source.processes,{icon:baseId,capabilities,
        cost:structuredClone(source.cost),power:source.power,energy:{...source.energy,...(baseId==='algaePond'?{tier:Math.min(14,req.algaeTier),maxTier:Math.min(14,req.algaeTier)}:{})}});
      items[id].icon=baseId;
    }
    if(baseId==='algaePond')source.capabilities={algaeTier:source.energy.tier};
    else if(baseId==='pcbFactory')source.capabilities={pcbTier:1};
    else if(baseId==='quantumForceTransformer')source.capabilities={qftTier:1,qftFocus:1};
    else if(baseId==='nanoForge')source.capabilities={nanoForgeTier:1};
    else if(baseId==='naquadahFuelRefinery')source.capabilities={refineryCoil:1};
    else if(baseId==='godforgePlasma')source.capabilities={plasmaTier:0,exoticTier:0};
  }
  for(let tier=4;tier<=8;tier++)machine('naquadahReactor'+tier,['小型','大型','巨型','极限','超巨型'][tier-4]+'硅岩反应堆',tier+1,['generateNaquadah'+tier],{energy:{kind:'generator',tier,family:'Naquadah'+tier,solid:true},power:-E.voltage[tier]});
  machine('largeNaquadahReactor','大型液态硅岩反应堆',9,['generateLargeNaquadah'],{cost:{[N.controller]:1},icon:N.controller,power:0,energy:{kind:'generator',tier:7,maxTier:14,cycle:'naquadah',outputAmps:64}});
  items.largeNaquadahReactor.icon=N.controller;
  for(let ring=1;ring<=R.solar.rings.length;ring++){
    const id='solarSaltTower'+ring,reflectors=R.solar.rings[ring-1][0];
    machine(id,'太阳能熔盐塔 · '+reflectors+' 面反射镜',5,['solarSalt'],{cost:{[R.solar.controller]:1,...R.solar.structure,[R.solar.reflector]:reflectors},icon:'solarSaltTower',power:0,energy:{kind:'thermal',tier:0,maxTier:0,cycle:'solarTower',ring}});
    items[id].icon='solarSaltTower';
  }
  // The idle world uses a prepared 64-block borehole instead of spatial world
  // drilling. The physical column and complete minimum structure are paid at
  // construction; no pipes are conjured by choosing a recipe.
  machine('deepEarthHeatingPump','深井地热泵',6,['deepHeat'],{cost:{[R.pump.controller]:1,...R.pump.structure,[R.pump.pipe]:64},icon:R.pump.controller,energy:{kind:'consumer',tier:3,maxTier:3},deepHeat:true});
  items.deepEarthHeatingPump.icon=R.pump.controller;
  for(let tier=1;tier<=3;tier++)machine('magicConverter'+tier,'魔力能源转换器 · '+E.codes[tier],tier+1,['generateMagic'],{energy:{kind:'generator',tier,family:'Magic'},power:0});
  machine('rtg','放射性同位素热电机',6,['generateRTG'],{cost:{[RTG.controller]:1},icon:'rtg',energy:{kind:'generator',tier:3,maxTier:3,family:'RTG',solid:true,rtg:true},power:0});
  machine('ic2RTG','同位素温差发电机',5,[],{cost:{[RTG.ic2.controller]:1},icon:RTG.ic2.controller,facility:'isotope',energy:{kind:'generator',tier:1,maxTier:1,cycle:'ic2RTG',reserve:0},power:0});
  items.ic2RTG.icon=RTG.ic2.controller;
  machine('nuclearReactor','核反应堆',5,[],{cost:{[NUCLEAR.controller]:1},icon:NUCLEAR.controller,facility:'nuclear',energy:{kind:'generator',tier:4,maxTier:4,cycle:'nuclear',reserve:0},power:0});
  items.nuclearReactor.icon=NUCLEAR.controller;
  for(const g of FUEL_GENERATORS.machines){
    machine(g.id,g.name+' · '+E.codes[g.tier],g.tier+1,['generate'+g.family],{cost:{[g.item]:1},icon:g.item,power:0,energy:{kind:'generator',tier:g.tier,maxTier:g.tier,family:g.family,efficiency:g.efficiency}});
    items[g.id].icon=g.item;
  }
  for(const [kind,name,process]of [['table','浇铸台','tableCast'],['basin','浇铸盆','basinCast']]){
    const item=CASTING.devices[kind],id='casting'+kind;
    machine(id,name,1,[process],{cost:{[item]:1},icon:item,power:0,energy:null});
    items[id].icon=item;
  }
  machine('smeltery','匠魂冶炼炉',1,['smelteryMelt'],{cost:{[SMELTERY.devices.controller]:1,[SMELTERY.devices.drain]:1,[SMELTERY.devices.tank]:1,[SMELTERY.devices.brick]:2},icon:SMELTERY.devices.controller,power:0,energy:{kind:'thermal',tier:0,maxTier:0,cycle:'smeltery'},description:'液体燃料加热金属，熔融产物输出到容器'});
  items.smeltery.icon=SMELTERY.devices.controller;
  machine('lftr','液态氟化钍反应堆',6,['generateLFTR'],{energy:{kind:'generator',tier:4,maxTier:6,cycle:'lftr'},icon:'lftr',description:'熔盐燃料发电，预热后输出电力与后处理产物'});
  const hostCost={ttItem_Machine_Multi_ForgeOfGods:1};
  for(const piece of ['BEAM_SHAFT','FIRST_RING'])for(const[id,n]of Object.entries(G.structures[piece]))hostCost[id]=(hostCost[id]??0)+n;
  machine('godforge','造物主熔炉',13,[],{godforge:'host',facility:'godforge',cost:hostCost,power:0,energy:{kind:'consumer',tier:12,maxTier:12},icon:'ttItem_Machine_Multi_ForgeOfGods'});
  for(const[kind,id,name,controller,processes]of [
    ['smelting','godforgeSmelting','造物主熔炼模块','Smelting',['electricBlast','smelt']],
    ['molten','godforgeMolten','造物主熔融模块','Molten',['godforgeMolten']],
    ['plasma','godforgePlasma','造物主等离子模块','Plasma',['godforgePlasma']],
  ]){
    machine(id,name,13,processes,{godforge:kind,cost:{['ttItem_Machine_Multi_'+controller+'Module']:1},power:0,energy:{kind:'consumer',tier:12,maxTier:12,prepaid:true},icon:'ttItem_Machine_Multi_'+controller+'Module'});
    items[id].icon=machines[id].icon;
  }
  items.godforge.icon=machines.godforge.icon;
  for(const[kind,id,title,process,fluid,amount,exoticTier]of [
    ['exotic','godforgeExotic','造物主奇异物质模块','godforgeExotic',G.exotic.quark,1000,0],
    ['magmatter','godforgeMagmatter','造物主奇异物质模块 · 磁物质','godforgeMagmatter',G.exotic.mag,576,1],
  ]){
    machine(id,title,13,[process],{godforge:kind,cost:{[G.exotic.controller]:1},icon:G.exotic.controller,power:0,energy:{kind:'consumer',tier:12,maxTier:12,prepaid:true}});
    items[id].icon=G.exotic.controller;
    recipes.push({id:'godforgeDynamic:'+kind,name:items[fluid].name,process,stage:13,inputs:{},outputs:{[fluid]:amount},seconds:10,power:2013265920,dynamic:'godforge',requirements:{exoticTier},source:'GTNH2.9',origin:{file:'tectech/thing/metaTileEntity/multi/godforge/MTEExoticModule.java',line:kind==='exotic'?204:239}});
  }
  const waterNames=['纯净水厂主控','澄清过滤单元','臭氧净化单元','絮凝净化单元','pH 中和单元','极端温变净化单元','高能激光净化单元','残留污染物脱气单元','绝对重子完美净化单元'];
  const waterTiers=[6,6,6,7,7,8,8,9,10];
  for(let n=0;n<=8;n++){
    const id=n?'purification'+n:'purificationPlant',controller=W.controllers[n],tier=waterTiers[n];
    // The degasser runs at UHV but its controller is assembled at UEV.
    machine(id,waterNames[n],n>=7?tier+2:tier+1,n?['purify'+n]:[],{purification:n||'host',cost:{[controller]:1},icon:controller,power:n?T.recipes.find(r=>r.process==='purify'+n)?.power??0:0,energy:{kind:'consumer',tier,maxTier:n?tier:10},...(n?{}:{facility:'purification'})});
    items[id].icon=controller;
  }
  // Previously generated capability variants retain their IDs for old saves.
  // Actual upgrades now come from the connected host, never free variants.
  for(const m of Object.values(machines))if(m.id.startsWith('godforgePlasma_'))Object.assign(m,{godforge:'plasma',cost:{ttItem_Machine_Multi_PlasmaModule:1},energy:{kind:'consumer',tier:12,maxTier:12,prepaid:true}});
  const replacements=new Set(T.recipes.flatMap(r=>Object.keys(r.outputs)));
  const retire=new Set(['board','basicCircuit','ironBucket','motor','pump','silicon','aluminium','stainless','titanium','tungstensteel','goodCircuit','advancedCircuit','processor','nanoCircuit','quantumCircuit','crystalCircuit','wetwareCircuit','biowareCircuit','opticalCircuit','exoticCircuit','cosmicCircuit','transcendentCircuit','resistor','vacuumTube','coatedBoard','europium','neutronium','cosmic','catalyst','infinity','spacetime','eternity']);
  for(let index=recipes.length-1;index>=0;index--){
    const r=recipes[index];
    if(CIRCUIT_MIGRATIONS[r.id]||retire.has(r.id)&&Object.keys(r.outputs).every(id=>replacements.has(id))){legacy[r.id]=structuredClone(r);recipes.splice(index,1);}
  }
  recipes.push(...T.recipes.map(r=>({...r})));
  // Scanner jobs retain their prototype; TecTech station jobs consume it.
  // Every assembly-line batch requires the corresponding recorded data.
  const scans=new Map();
  for(const r of recipes){
    const req=r.requirements;if(!req?.researchItem)continue;
    const station=!!req.researchComputation;
    const key=[req.researchItem,req.scanTicks,req.scanEUt,...(station?[req.researchComputation,req.researchAmperage,req.researchVoltage,req.researchCount??1]:[])].join('_');
    const data='researchData_'+key;
    items[data]??={id:data,name:(items[req.researchItem]?.name??'装配线')+'研究数据',kind:'item',category:'研究',icon:'gtItem_Tool_DataStick'};
    req.researchData=data;
    if(scans.has(key))continue;scans.set(key,true);
    const scanTier=E.voltage.findIndex(v=>v>=(station?req.researchVoltage:req.scanEUt));
    recipes.push({id:'research:'+key,name:items[data].name,process:station?'stationResearch':'research',stage:Math.max(station?9:machines.scanner.stage,scanTier+1),
      inputs:station?{[req.researchItem]:req.researchCount??1,gtItem_Tool_DataStick:1}:{},tools:station?{}:{[req.researchItem]:1},outputs:{[data]:1},
      seconds:req.scanTicks/20,power:req.scanEUt,...(station?{fixedRuntime:true,requirements:{computation:req.researchComputation,researchVoltage:req.researchVoltage,researchAmperage:req.researchAmperage}}:{}),source:'GTNH2.9',origin:r.origin});
  }
  const computations=[...new Set(recipes.filter(r=>r.process==='stationResearch').map(r=>r.requirements.computation))];
  for(const cps of computations){
    const amperage=Math.max(...recipes.filter(r=>r.process==='stationResearch'&&r.requirements.computation===cps).map(r=>r.requirements.researchAmperage));
    const id='researchStationCps'+cps;
    machine(id,'科研站 · '+cps+' 算力',9,['stationResearch'],{cost:{stainlessPlate:32,quantumCircuit:8,[T.researchHardware.cpu]:Math.ceil(cps/T.researchHardware.nominalCPU)},
      icon:'scanner',capabilities:{computation:cps},energy:{kind:'consumer',tier:8,maxTier:14,inputAmps:amperage,recipeAmps:amperage,bufferTicks:64*amperage},
      description:'消耗样品与数据存储器完成研究；计算机算力按建造时装入的处理器配置'});
    items[id].icon='scanner';
  }
  return {recipes:T.recipes.length};
}
