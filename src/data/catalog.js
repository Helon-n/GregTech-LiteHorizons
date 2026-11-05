// Gameplay adaptation of GTNH progression. Exact original recipes come from the
// optional runtime exporter; these authored recipes are deliberately labelled.
export const STAGES = [
  ['stone','石器时代','STONE','从燧石工具到第一座砖炉'],
  ['steam','蒸汽时代','STEAM','青铜、蒸汽与批量加工'],
  ['lv','低压电力','LV','钢材、橡胶与第一块基础电路'],
  ['mv','中压电力','MV','电力高炉、铝与自动化'],
  ['hv','高压电力','HV','不锈钢、石油与化学工业'],
  ['ev','超高压电力','EV','钛与月面远征'],
  ['iv','极高压电力','IV','钨钢、洁净室与装配线'],
  ['luv','超立方电力','LuV','铂族、铱与初代聚变'],
  ['zpm','零点模块','ZPM','铕、湿件电路与太空工厂'],
  ['uv','终极电力','UV','中子素、超导体与大规模生产'],
  ['uhv','极端高压','UHV','宇宙中子素与高能制造'],
  ['uev','极端电压','UEV','无尽催化与精密装配'],
  ['uiv','极端无尽电压','UIV','无尽锭与超维工程'],
  ['umv','极端巨量电压','UMV','时空材料与天体工程'],
  ['uxv','极端超量电压','UXV','奇点与终极计算'],
  ['max','终局工程','MAX','星门：工业链的终点']
].map(([id,name,code,description],index)=>({id,name,code,description,index,voltage:index<2?0:8*4**(index-1)}));

export const items = {};
const item=(id,name,category='材料',color='#bdc7b0',kind='item')=>(items[id]={id,name,category,color,kind});
[
 ['wood','原木','资源','#9b825c'],['stick','木棍','资源','#ad8754'],['stone','圆石','资源','#949b92'],['gravel','沙砾','资源','#9f9c8e'],['flint','燧石','资源','#9ca5a7'],['clay','黏土','资源','#b7c0cc'],['sand','沙子','资源','#d9c598'],['coal','煤炭','燃料','#757b80'],['resin','黏性树脂','资源','#d9ae60'],['brick','红砖','材料','#c98465'],['glass','玻璃','材料','#a4d7da'],['coke','焦煤','燃料','#6f7380'],['rubber','橡胶','材料','#8e8389'],['silicon','硅片','元件','#91b5c3'],['redstone','红石','资源','#cb6266'],['diamond','钻石','资源','#80d8d8'],['sulfur','硫粉','材料','#d6c66a'],['salt','盐','材料','#d8d8c8'],['bauxite','铝土矿','资源','#b77964'],['rutile','金红石','资源','#b98a6a'],['tungstate','钨矿石','资源','#a2a5ab'],['platinumOre','铂族矿石','资源','#c7c3ac'],['rareEarth','稀土矿','资源','#b9af87'],['naquadahOre','硅岩矿石','资源','#80aa92'],['moonRock','月岩','太空','#babdb5'],['marsRock','火星岩','太空','#c37c63'],['asteroid','小行星矿石','太空','#a3a3b2'],['spaceTime','时空','终局','#a998d4'],['singularity','奇点','终局','#9a83d8'],['stargate','星门','终局','#dab779']
].forEach(x=>item(...x));
export const MATERIALS = [
 ['copper','铜',0,'#d69b72'],['tin','锡',0,'#c0d2d6'],['iron','铁',0,'#bac2ba'],['bronze','青铜',1,'#c3a06a'],['steel','钢',2,'#a1afb7'],['aluminium','铝',3,'#c8dce4'],['stainless','不锈钢',4,'#acbfc5'],['titanium','钛',5,'#bfabd4'],['tungstensteel','钨钢',6,'#94a3b2'],['iridium','铱',7,'#d5d5e5'],['europium','铕',8,'#be9bc6'],['neutronium','中子素',9,'#a6b9c8'],['cosmic','宇宙中子素',10,'#a9a1d0'],['catalyst','无尽催化剂',11,'#d6b687'],['infinity','无尽',12,'#cc9ecf'],['spacetime','时空',13,'#a093d4'],['eternity','永恒',14,'#e2bd7d']
];
for(const [id,name,stage,color] of MATERIALS){
  item(id,name+(id==='catalyst'?'':'锭'),'金属',color);
  for(const [suffix,title]of [['Plate','板'],['Dust','粉'],['Rod','杆'],['Wire','导线']])item(id+suffix,name+title,'加工材料',color);
  if(stage===0)item(id+'Ore',name+'矿石','资源',color);
}
for(const [id,name,color]of [['chrome','铬','#c1c7c7'],['nickel','镍','#c8bd92'],['platinum','铂','#d0d2ba']])item(id,name+'锭','金属',color);
for(const [id,name,color]of [['water','水','#75a5d0'],['steam','蒸汽','#b1c8c9'],['creosote','杂酚油','#ac895e'],['oxygen','氧气','#95d7e0'],['hydrogen','氢气','#d3c6df'],['oil','原油','#8a8677'],['diesel','柴油','#d9bb63'],['sulfuricAcid','硫酸','#d6d784'],['chlorine','氯气','#a4bd79'],['titaniumTetrachloride','四氯化钛','#cabcd8'],['helium','氦气','#ddca9f'],['plasma','等离子体','#b3a3ea']])item(id,name,'流体',color,'fluid');
for(const [id,name]of [['flintPick','燧石镐'],['hammer','锻造锤'],['wrench','扳手'],['saw','锯']])item(id,name,'工具');
export const containerTypes={
  woodBucket:{name:'木桶',capacity:1000,accepts:['water'],stage:0},
  ironBucket:{name:'铁桶',capacity:1000,accepts:['water','creosote','oil','diesel'],stage:0},
  fluidTank:{name:'密封储罐',capacity:64000,accepts:null,stage:1},
  largeTank:{name:'大型储罐',capacity:1024000,accepts:null,stage:2},
  legacyTank:{name:'迁移储罐',capacity:0,accepts:null,stage:0,migrationOnly:true}
};
for(const[id,c]of Object.entries(containerTypes))item(id,c.name,'流体容器','#a8b7ac');
for(const [id,name]of [['vacuumTube','真空管'],['resistor','电阻'],['coatedBoard','覆膜电路板'],['basicCircuit','基础电路'],['goodCircuit','进阶电路'],['advancedCircuit','高级电路'],['processor','处理器'],['nanoCircuit','纳米电路'],['quantumCircuit','量子电路'],['crystalCircuit','晶体电路'],['wetwareCircuit','湿件电路'],['biowareCircuit','生物电路'],['opticalCircuit','光学电路'],['exoticCircuit','异域电路'],['cosmicCircuit','宇宙电路'],['transcendentCircuit','超越电路'],['spacetimeCircuit','时空电路'],['ultimateCircuit','终极电路'],['motor','电动马达'],['pump','电动泵'],['rocket','一级火箭'],['advancedRocket','深空火箭'],['fusionCore','聚变核心'],['dyson','戴森集群'],['starCore','恒星核心'],['fieldGenerator','力场发生器']])item(id,name,'元件');

export const machines = {};
const machine=(id,name,stage,processes,cost,power=0,description='')=>{
  machines[id]={id,name,stage,processes,cost,power,description};item(id,name,'机器','#adbda5');
};
machine('workbench','工作台',0,['craft'],{wood:4});
machine('furnace','砖炉',0,['smelt'],{stone:8,clay:4});
machine('cokeOven','焦炉',1,['coke'],{brick:24,clay:12});
machine('boiler','小型燃煤锅炉',1,['boil'],{bronzePlate:6,brick:6},0,'煤炭与水制取蒸汽');
machine('steamMacerator','蒸汽研磨机',1,['grind'],{bronzePlate:8,iron:4},0,'蒸汽供能，矿物粉碎');
machine('alloySmelter','蒸汽合金炉',1,['alloy'],{bronzePlate:6,brick:8});
machine('compressor','蒸汽压缩机',1,['compress'],{bronzePlate:6,ironPlate:4});
machine('bbf','砖高炉',1,['blast'],{brick:32,ironPlate:8},0,'焦煤还原，制取钢');
machine('turbine','基础蒸汽轮机',2,['generateSteam'],{steelPlate:6,basicCircuit:1,motor:1},-32);
machine('assembler','基础装配机',2,['assemble','circuit'],{steelPlate:6,basicCircuit:1,motor:2},8);
machine('wiremill','线材轧机',2,['wire'],{steelPlate:5,basicCircuit:1,motor:2},8);
machine('electrolyzer','电解机',2,['electrolyze'],{steelPlate:6,basicCircuit:2,pump:1},16);
machine('ebf','电力高炉',3,['electricBlast'],{steelPlate:24,goodCircuit:4,motor:4},64);
machine('chemical','化学反应釜',3,['chemistry'],{aluminiumPlate:8,goodCircuit:2,pump:2},32);
machine('distiller','蒸馏塔',4,['distill'],{stainlessPlate:16,advancedCircuit:4,pump:4},128);
machine('dieselGenerator','柴油发电机',3,['generateDiesel'],{aluminiumPlate:6,goodCircuit:2,motor:4},-256);
machine('cleanroom','洁净室装配机',5,['cleanroom','circuit'],{titaniumPlate:16,processor:4,motor:6},512);
machine('vacuumFreezer','真空冷冻机',6,['freeze'],{tungstensteelPlate:12,nanoCircuit:4,pump:4},2048);
machine('assemblyLine','装配线',6,['assemblyLine'],{tungstensteelPlate:32,nanoCircuit:8,motor:12},2048);
machine('fusion','聚变反应堆',7,['fusion'],{iridiumPlate:24,quantumCircuit:8,fieldGenerator:4},8192);
machine('fusionGenerator','聚变等离子发电机',7,['generatePlasma'],{iridiumPlate:16,quantumCircuit:4,motor:8},-131072);
machine('stellarForge','恒星熔炉',9,['stellar'],{neutroniumPlate:24,wetwareCircuit:8,fusionCore:4},32768);
machine('spaceElevator','太空电梯',10,['orbital'],{cosmicPlate:32,biowareCircuit:12,advancedRocket:2},131072);
machine('precisionAssembler','精密装配机',11,['precision'],{catalystPlate:24,opticalCircuit:8,fieldGenerator:8},524288);
machine('dimensionFactory','超维工厂',12,['dimension'],{infinityPlate:32,exoticCircuit:12,starCore:2},2097152);
machine('dysonGenerator','戴森能量站',12,['generateStellar'],{infinityPlate:16,dyson:1},-134217728);
machine('cosmicFabricator','宇宙制造机',14,['cosmic'],{eternityPlate:24,spacetimeCircuit:8,singularity:8},33554432);

export const recipes=[];
const recipe=(id,name,process,stage,inputs,outputs,seconds=5,extra={})=>recipes.push({id,name,process,stage,inputs,outputs,seconds,power:0,source:'adapted',...extra});
recipe('sticks','拆分木棍','craft',0,{wood:1},{stick:4},1);
recipe('pick','制作燧石镐','craft',0,{flint:3,stick:2},{flintPick:1},3);
recipe('hammer','制作锻造锤','craft',0,{iron:6,stick:1},{hammer:1},5);
recipe('woodBucket','木桶','craft',0,{wood:3},{woodBucket:1},2);
recipe('ironBucket','铁桶','craft',0,{iron:3},{ironBucket:1},3);
recipe('fluidTank','密封储罐','craft',1,{bronzePlate:6,glass:2},{fluidTank:1},5);
recipe('largeTank','大型储罐','craft',2,{steelPlate:12,glass:4},{largeTank:1},8);
recipe('bricks','烧制红砖','smelt',0,{clay:1,coal:1},{brick:4},5);
recipe('charcoal','烧制木炭','smelt',0,{wood:4},{coal:3},6);
recipe('glass','熔炼玻璃','smelt',0,{sand:4,coal:1},{glass:4},6);
recipe('bronzeHand','手工混合青铜粉','craft',0,{copperDust:3,tinDust:1},{bronzeDust:4},4,{tools:{flintPick:1}});
recipe('bronzeSmelt','冶炼青铜','smelt',0,{bronzeDust:4,coal:1},{bronze:4},10);
recipe('coke','焦煤与杂酚油','coke',1,{coal:4},{coke:4,creosote:1000},15);
recipe('steam','生产蒸汽','boil',1,{water:1000,coal:1},{steam:16000},8);
recipe('steel','砖高炉炼钢','blast',1,{iron:4,coke:2},{steel:4},20);
recipe('rubber','熔炼橡胶','smelt',1,{resin:3,coal:1},{rubber:3},8);
recipe('vacuumTube','真空管','craft',1,{glass:2,copperWire:2,steelRod:1},{vacuumTube:2},8);
recipe('resistor','电阻','craft',1,{coal:1,copperWire:2},{resistor:2},5);
recipe('board','覆膜电路板','craft',1,{wood:2,resin:2,copperPlate:1},{coatedBoard:1},8);
recipe('basicCircuit','基础电路','craft',1,{vacuumTube:2,resistor:2,coatedBoard:1,copperWire:2},{basicCircuit:1},12);
recipe('motor','电动马达','craft',1,{steelRod:2,copperWire:4,tinWire:2},{motor:1},10);
recipe('steelRodEarly','手工锻造钢杆','craft',1,{steel:1},{steelRod:1},6,{tools:{hammer:1}});
recipe('pump','电动泵','craft',1,{motor:1,rubber:2,ironPlate:2},{pump:1},10);
for(const[id,name,stage]of MATERIALS){
  recipe(id+'PlateHand','锻造'+name+'板','craft',stage,{[id]:2},{[id+'Plate']:1},4,{tools:{hammer:1}});
  recipe(id+'RodHand','锻造'+name+'杆','craft',stage,{[id]:1},{[id+'Rod']:1},4,{tools:{hammer:1}});
  recipe(id+'WireHand','剪制'+name+'导线','craft',stage,{[id+'Plate']:1},{[id+'Wire']:2},4,{tools:{hammer:1}});
  recipe(id+'Plate','压制'+name+'板','compress',Math.max(1,stage),{[id]:1,steam:160},{[id+'Plate']:1},3);
  recipe(id+'Wire','轧制'+name+'导线','wire',Math.max(2,stage),{[id]:1},{[id+'Wire']:2},3,{power:8});
  if(stage===0){
    recipe(id+'Dust','研磨'+name+'矿石','craft',0,{[id+'Ore']:1},{[id+'Dust']:1},4,{tools:{flintPick:1}});
    recipe(id+'Smelt','冶炼'+name,'smelt',0,{[id+'Dust']:2,coal:1},{[id]:2},8);
    recipe(id+'Grind','粉碎'+name+'矿石','grind',1,{[id+'Ore']:1,steam:400},{[id+'Dust']:2},5);
  }
}
recipe('bronzeAlloy','合金炉制青铜','alloy',1,{copper:3,tin:1,steam:800},{bronze:4},7);
recipe('steamPower','蒸汽发电','generateSteam',2,{steam:3200},{},5,{generation:3200});
recipe('waterElectrolysis','水电解','electrolyze',2,{water:1000},{hydrogen:2000,oxygen:1000},8,{power:16});
recipe('bauxiteElectrolysis','铝土矿电解','electrolyze',2,{bauxite:4},{aluminiumDust:4,oxygen:2000},12,{power:16});
recipe('aluminium','高炉炼铝','electricBlast',3,{aluminiumDust:4,oxygen:500},{aluminium:4},14,{power:64});
recipe('goodCircuit','进阶电路','circuit',2,{basicCircuit:2,silicon:2,copperWire:4},{goodCircuit:1},12,{power:8});
recipe('silicon','硅片制取','electrolyze',2,{sand:4},{silicon:2},10,{power:16});
recipe('chrome','稀土电解铬','electrolyze',3,{rareEarth:4},{chrome:2,nickel:2},14,{power:32});
recipe('stainless','不锈钢合金','electricBlast',4,{steel:6,chrome:1,nickel:1,oxygen:1000},{stainless:8},18,{power:128});
recipe('acid','硫酸合成','chemistry',3,{sulfur:2,oxygen:2000,water:1000},{sulfuricAcid:1000},8,{power:32});
recipe('chlorine','盐水电解','electrolyze',3,{salt:2,water:1000},{chlorine:2000,hydrogen:1000},10,{power:32});
recipe('diesel','原油蒸馏','distill',4,{oil:1000},{diesel:1500,sulfur:1},12,{power:128});
recipe('dieselPower','柴油发电','generateDiesel',3,{diesel:250},{},5,{generation:25600});
recipe('ticl','四氯化钛','chemistry',4,{rutile:4,chlorine:2000,coal:1},{titaniumTetrachloride:2000},15,{power:128});
recipe('titanium','高炉炼钛','electricBlast',5,{titaniumTetrachloride:1000,hydrogen:1000},{titanium:4},20,{power:512});
recipe('rocket','一级火箭','cleanroom',5,{titaniumPlate:16,aluminiumPlate:32,advancedCircuit:8,motor:12,diesel:2000},{rocket:1},60,{power:512});
recipe('advancedCircuit','高级电路','circuit',4,{goodCircuit:2,silicon:4,aluminiumWire:4,rubber:2},{advancedCircuit:1},16,{power:128});
recipe('processor','处理器','circuit',5,{advancedCircuit:2,silicon:6,titaniumWire:4},{processor:1},18,{power:512});
recipe('tungstenDust','钨矿化学处理','chemistry',5,{tungstate:4,sulfuricAcid:1000},{tungstensteelDust:4},18,{power:512});
recipe('tungstensteel','钨钢合金','electricBlast',6,{tungstensteelDust:4,steel:4},{tungstensteel:8},24,{power:2048});
recipe('nanoCircuit','纳米电路','cleanroom',6,{processor:2,silicon:8,tungstensteelWire:4},{nanoCircuit:1},22,{power:2048});
recipe('platinum','铂族精炼','chemistry',6,{platinumOre:4,sulfuricAcid:2000},{platinum:3,iridiumDust:1},24,{power:2048});
recipe('iridium','高炉炼铱','electricBlast',7,{iridiumDust:4,hydrogen:2000},{iridium:4},30,{power:8192});
recipe('quantumCircuit','量子电路','cleanroom',7,{nanoCircuit:2,platinum:4,iridiumWire:4},{quantumCircuit:1},24,{power:8192});
recipe('fieldGenerator','力场发生器','assemblyLine',6,{nanoCircuit:2,tungstensteelPlate:4,motor:2},{fieldGenerator:1},22,{power:2048});
recipe('fusionCore','聚变核心','assemblyLine',7,{iridiumPlate:8,quantumCircuit:4,fieldGenerator:2},{fusionCore:1},40,{power:8192});
recipe('fusionFuel','氦等离子体聚变','fusion',7,{hydrogen:8000,helium:4000},{plasma:2000},20,{power:8192});
recipe('plasmaPower','等离子发电','generatePlasma',7,{plasma:1000},{},5,{generation:13107200});
recipe('europium','聚变制铕','fusion',8,{rareEarth:8,plasma:1000},{europium:8},25,{power:32768});
recipe('wetwareCircuit','湿件电路','assemblyLine',8,{quantumCircuit:2,europiumWire:4,water:2000},{wetwareCircuit:1},28,{power:32768});
recipe('advancedRocket','深空火箭','assemblyLine',7,{tungstensteelPlate:32,quantumCircuit:8,motor:24,fieldGenerator:4},{advancedRocket:1},75,{power:8192});
recipe('neutronium','中子素凝聚','fusion',9,{europium:8,asteroid:8,plasma:2000},{neutronium:8},35,{power:131072});
recipe('biowareCircuit','生物电路','assemblyLine',9,{wetwareCircuit:2,neutroniumWire:4,helium:2000},{biowareCircuit:1},30,{power:131072});
recipe('cosmic','宇宙中子素合成','stellar',10,{neutronium:8,naquadahOre:16,plasma:4000},{cosmic:8},40,{power:524288});
recipe('opticalCircuit','光学电路','stellar',10,{biowareCircuit:2,cosmicWire:4,diamond:8},{opticalCircuit:1},35,{power:524288});
recipe('catalyst','无尽催化剂','orbital',11,{cosmic:8,iridium:8,europium:8,naquadahOre:16},{catalyst:8},45,{power:2097152});
recipe('exoticCircuit','异域电路','precision',11,{opticalCircuit:2,catalystWire:4,fieldGenerator:2},{exoticCircuit:1},38,{power:2097152});
recipe('infinity','无尽锭','precision',12,{catalyst:8,cosmic:8,plasma:8000},{infinity:8},50,{power:8388608});
recipe('cosmicCircuit','宇宙电路','precision',12,{exoticCircuit:2,infinityWire:4,fieldGenerator:4},{cosmicCircuit:1},40,{power:8388608});
recipe('starCore','恒星核心','precision',11,{cosmicPlate:16,fusionCore:4,plasma:4000},{starCore:1},60,{power:2097152});
recipe('dyson','戴森集群','precision',12,{infinityPlate:24,exoticCircuit:8,starCore:2},{dyson:1},90,{power:8388608});
recipe('stellarPower','恒星能量采集','generateStellar',12,{hydrogen:1000},{},5,{generation:13421772800});
recipe('spacetime','时空锭','dimension',13,{infinity:8,starCore:1,plasma:8000},{spacetime:8},60,{power:33554432});
recipe('transcendentCircuit','超越电路','dimension',13,{cosmicCircuit:2,spacetimeWire:4,fieldGenerator:4},{transcendentCircuit:1},45,{power:33554432});
recipe('singularity','奇点压缩','dimension',13,{infinity:32,neutronium:32,diamond:32},{singularity:4},60,{power:33554432});
recipe('eternity','永恒锭','dimension',14,{spacetime:8,singularity:2,cosmic:8},{eternity:8},65,{power:134217728});
recipe('spacetimeCircuit','时空电路','dimension',14,{transcendentCircuit:2,eternityWire:4,singularity:2},{spacetimeCircuit:1},50,{power:134217728});
recipe('ultimateCircuit','终极电路','cosmic',15,{spacetimeCircuit:2,eternityWire:8,singularity:4},{ultimateCircuit:1},60,{power:536870912});
recipe('stargate','星门','cosmic',15,{ultimateCircuit:8,eternityPlate:64,singularity:32,starCore:8,dyson:2},{stargate:1},180,{power:536870912});

export const gatherNodes=[
 ['forest','林地','wood',0,2,2,'采伐原木，收集树脂'],['surface','地表石层','stone',0,2,2,'收集圆石与燧石'],['river','河岸','clay',0,2,2,'收集黏土、沙子和水'],
 ['copperVein','铜矿脉','copperOre',0,1,3,'燧石镐开采'],['tinVein','锡矿脉','tinOre',0,1,3,'燧石镐开采'],['ironVein','铁矿脉','ironOre',0,1,3,'燧石镐开采'],['coalVein','煤层','coal',0,2,3,'初期冶炼燃料'],
 ['bauxiteVein','铝土矿脉','bauxite',2,2,4,'电解提取铝粉'],['saltVein','盐矿','salt',2,2,3,'化工原料'],['sulfurVein','硫矿','sulfur',2,2,3,'硫酸产业链'],['rareVein','稀土矿脉','rareEarth',3,2,4,'合金与聚变原料'],
 ['oilWell','油田','oil',4,1000,4,'蒸馏与柴油发电'],['rutileVein','金红石矿脉','rutile',4,2,4,'四氯化钛路线'],['redstoneVein','红石矿脉','redstone',2,2,3,'电路材料'],['diamondVein','钻石矿脉','diamond',4,1,5,'光学与终局材料'],
 ['moon','月球','moonRock',5,4,5,'火箭解锁 · 含钨矿与氦气'],['mars','火星','marsRock',6,4,5,'一级火箭解锁 · 含铂族矿'],['belt','小行星带','asteroid',7,4,6,'深空火箭解锁 · 铱与硅岩']
].map(([id,name,output,stage,amount,seconds,description])=>({id,name,output,stage,amount,seconds,description,cost:{ironPlate:stage<2?6:12,motor:stage<2?0:2}}));
export const nodeDrops={forest:{wood:2,resin:1},surface:{stone:2,flint:1,gravel:1},river:{clay:2,sand:2,water:1000},moon:{moonRock:4,tungstate:2,helium:1000},mars:{marsRock:4,platinumOre:3},belt:{asteroid:4,iridiumDust:2,naquadahOre:4}};
export const milestones=[
 {flintPick:1,brick:8},{steel:4,basicCircuit:1,motor:1},{goodCircuit:2,electrolyzer:1},{aluminium:4,chemical:1},{stainless:4,advancedCircuit:2},{titanium:4,processor:2,rocket:1,moonRock:4},{tungstensteel:4,nanoCircuit:2},{iridium:4,quantumCircuit:2},{europium:4,wetwareCircuit:2},{neutronium:4,biowareCircuit:2},{cosmic:4,opticalCircuit:2},{catalyst:4,exoticCircuit:2},{infinity:4,cosmicCircuit:2},{spacetime:4,transcendentCircuit:2},{eternity:4,spacetimeCircuit:2},{stargate:1}
];
export const CATALOG={version:3,items,recipes,machines,containerTypes,stages:STAGES,gatherNodes,nodeDrops,milestones};
