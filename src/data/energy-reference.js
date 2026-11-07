// Numeric rules from the installed GTNH 2.9.0 / GT5 5.09.54.265.
// Source paths, configuration overrides and adaptation boundaries: docs/ENERGY.md.
export const ENERGY_REFERENCE=Object.freeze({
  version:'5.09.54.265',ticksPerSecond:20,
  voltage:[8,32,128,512,2048,8192,32768,131072,524288,2097152,8388608,33554432,134217728,536870912,2147483640],
  codes:['ULV','LV','MV','HV','EV','IV','LuV','ZPM','UV','UHV','UEV','UIV','UMV','UXV','MAX'],
  boiler:{steamPerSecond:120,steamCapacity:16000,waterCapacity:16000,steamPerWater:160,ambient:20,boiling:100,maxTemperature:500,heatTicks:12,coolTicks:46,coalHeat:160},
  steamMachine:{steamPerEU:2,durationMultiplier:2,capacity:32000,minimumSteam:2000},
  turbine:{minTier:1,maxTier:3,euPerOperation:3,steamPerOperation:[0,7,8,9]},
  diesel:{minTier:1,maxTier:3,fuelEU:480,efficiency:[0,95,90,85]},
  gas:{minTier:1,maxTier:5,hydrogenEU:20,efficiency:[0,95,90,85,60,50]},
  plasma:{minTier:4,maxTier:8,heliumEU:81920},
  fusion:{baseTier:6,maxTier:8,capacity:160000000,startup:40000000,hydrogenToDeuterium:{input:160,output:40,seconds:8,power:20},deuteriumToTritium:{input:160,output:40,seconds:8,power:80}},
  battery:{slots:4,inputAmpsPerCell:2,outputAmpsPerCell:1,hullTicksPerSlot:64,
    // Lithium cells LV–HV; full batteries EV–UXV, MetaGeneratedItem01.setElectricStats.
    capacity:[0,100000,400000,1600000,6400000,25600000,102400000,409600000,1638400000,6553600000,26214400000,104857600000,419430400000,1677721600000]},
  dyson:{euPerModule:10000000,maxModules:10000,cycleSeconds:3600,coolant:3600000,powerFactor:1,destroyA:.00005,destroyChance:.066},
});

export function recipeEnergyText(r){
  if(r.eoh)return `预充 ${BigInt(r.eoh.inputEU).toLocaleString()} EU / 批 · 供能页设置场发生器与超频`;
  if(r.rtg)return `${r.outputRate} EU/t · 每粒 ${r.fuelEU.toLocaleString()} EU · 按原版内部储能供电`;
  if(r.solarSalt)return '太阳能蓄热 · 冷热熔盐 1∶1 · 每 10 秒按蓄热与容器余量转换';
  if(r.deepHeat)return '480 EU/t · 每游戏刻转换 · 进液需额外保留至少 1 mB';
  if(r.largeNaquadah)return `基础 ${r.generationPower.toLocaleString()} EU/t · ${r.seconds} 秒/份 · 液态空气、冷却与激发液影响实际输出`;
  if(r.fuelFamily==='Magic')return `${r.fuelEU} 基础热值 · ${r.itemFuel?'固体燃料，保留配方返还物':'流体燃料'} · 效率由机组电压决定`;
  if(r.dynamic==='godforge')return '每批随机配料 · 造物主主机与升级 · 开工从实体电池组预付电量';
  if(r.purification)return `${r.power.toLocaleString()} EU/t · 纯净水厂主控供电 · 120 秒/批 · 按处理结果产出`;
  if(r.thermalBoiler)return '热流体供热 · 水耗随升温效率变化 · 可装熔岩过滤器';
  if(r.batchEU)return `开工预付 ${r.batchEU.toLocaleString()} EU / 批 · ${r.seconds} 秒/批 · 不超频`;
  if(r.exchanger)return '按热流体流量换热 · 蒸馏水供汽 · 达到阈值切换高温蒸汽';
  if(r.turbineKind)return '转子决定流量与效率 · 随流量爬升输出 · 转子会磨损';
  if(r.largeBoiler)return r.boilerFuel?`每次投入 1000 mB 燃料 · 按炉型、节流和升温状态产汽`:'固体燃料供热 · 双燃料同时运行提高热效率';
  if(r.generationPower)return `发电 ${r.generationPower.toLocaleString()} EU/t · ${r.seconds} 秒/批 · 需预热`;
  const E=ENERGY_REFERENCE;
  if(r.process==='build')return '不耗能';
  if(r.smeltery)return `液体燃料供热 · 熔点 ${r.smeltery.temperature} °C · 工时随燃料温度变化`;
  if(['tableCast','basinCast'].includes(r.process))return `浇铸冷却 · ${r.seconds} 秒/批`;
  if(r.process==='craft')return `不耗能 · ${r.seconds} 秒/批`;
  if(r.process==='boil')return '额定 120 mB/s · 1 mB 水 → 160 mB 蒸汽 · 需要煤炭与升温';
  if(r.process.startsWith('boilSmart'))return `额定 ${750*Number(r.process.slice(-1))} mB/s · 低温时补燃料 · 1 mB 水 → 160 mB 蒸汽`;
  if(r.process==='generateSteam')return 'LV：7 mB 蒸汽 → 3 EU · 额定 32 EU/t';
  if(r.process.startsWith('generateNaquadah'))return `每份燃料 ${r.fuelEU.toLocaleString()} EU · 含机组效率`;
  if(r.fuel)return `燃料热值 ${r.fuelEU} EU/mB · 输出与效率由机组等级决定`;
  if(r.process==='generateSolar')return '晴天、露天时发电 · 夜间停机 · 输出由机组电压决定';
  if(r.process==='boilSteel')return '额定 300 mB/s · 1 mB 水 → 160 mB 蒸汽 · 固体燃料';
  if(r.process==='boilLava')return '额定 600 mB/s · 1 mB 水 → 160 mB 蒸汽 · 熔岩供热';
  if(r.process==='boilSolar')return '额定 120 mB/s · 日照供热 · 普通水会结垢';
  if(r.process==='boilSolarSteel')return '额定 360 mB/s · 日照供热 · 普通水会结垢';
  if(r.process==='generateDiesel')return '柴油热值 480 EU/mB · 输出与效率由机组等级决定';
  if(r.process==='generateGas')return '氢气热值 20 EU/mB · 输出与效率由机组等级决定';
  if(r.process==='generatePlasma')return '氦等离子体热值 81920 EU/mB · 输出与效率由机组等级决定';
  if(r.process==='generateStellar')return '每模块 10000000 EU/t · 冷却液按小时消耗';
  if(['grind','alloy','compress','forgeHammer'].includes(r.process))return `基准 ${r.power} EU/t · ${r.seconds} 秒/批`+(r.power<=32?` · 蒸汽机 ${r.seconds*E.steamMachine.durationMultiplier} 秒/批，${r.power*20*E.steamMachine.steamPerEU} mB/s`:'');
  const tier=r.power?E.codes[E.voltage.findIndex(v=>v>=r.power)]:'';
  return (r.power?`${r.power} EU/t · 最低 ${tier} · `:'不耗电 · ')+(r.seconds?`${r.seconds} 秒/批`:'')+(r.startup?` · 启动 ${r.startup} EU`:'');
}
