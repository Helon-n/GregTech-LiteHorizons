import {ENERGY_REFERENCE as E} from './energy-reference.js';

// Construction/material recipes remain this game's adaptation; conversion rules do not.
export function applyEnergyCatalog({items,machines,recipes}){
  const edit=(id,data)=>Object.assign(recipes.find(r=>r.id===id),data);
  for(const m of Object.values(machines))if(m.power>0)m.energy={kind:'consumer',tier:Math.max(1,m.stage-1),maxTier:14};
  machines.fusion.energy={kind:'consumer',tier:6,maxTier:8,fusion:true};
  machines.boiler.energy={kind:'boiler'};
  for(const id of ['steamMacerator','alloySmelter','compressor','forgeHammer'])machines[id].energy={kind:'steam'};
  machines.turbine.energy={kind:'generator',fuel:'steam',tier:1,maxTier:3};
  machines.dieselGenerator.energy={kind:'generator',fuel:'diesel',tier:2,maxTier:3};
  machines.dieselGenerator.power=-128;
  machines.fusionGenerator.energy={kind:'generator',fuel:'plasma',tier:6,maxTier:8};
  machines.fusionGenerator.name='等离子发电机';
  machines.fusionGenerator.power=-32768;
  machines.dysonGenerator.energy={kind:'dyson',tier:11,maxTier:14};
  machines.dysonGenerator.description='戴森模块与极寒之凛冰；主世界日照';
  const addItem=(id,name,category='元件',kind='item',icon=id)=>items[id]={id,name,category,kind,icon};
  const addRecipe=(id,name,process,stage,inputs,outputs,seconds,power=0)=>recipes.push({id,name,process,stage,inputs,outputs,seconds,power,source:'adapted'});
  machines.gasTurbine={id:'gasTurbine',name:'燃气轮机',stage:2,processes:['generateGas'],cost:{steelPlate:6,basicCircuit:1,motor:2},power:-32,description:'氢气等燃气发电',energy:{kind:'generator',fuel:'hydrogen',tier:1,maxTier:5}};
  addItem('gasTurbine','燃气轮机','机器');
  machines.centrifuge={id:'centrifuge',name:'离心机',stage:2,processes:['centrifuge'],cost:{steelPlate:6,basicCircuit:2,motor:2},power:20,description:'氢同位素分离',energy:{kind:'consumer',tier:1,maxTier:8}};
  addItem('centrifuge','离心机','机器');
  addItem('deuterium','氘','流体','fluid');addItem('tritium','氚','流体','fluid');
  addRecipe('deuterium','氢同位素分离','centrifuge',2,{hydrogen:160},{deuterium:40},8,20);
  addRecipe('tritium','氘同位素分离','centrifuge',3,{deuterium:160},{tritium:40},8,80);
  edit('waterElectrolysis',{seconds:100,power:30,energySource:'ElectrolyzerRecipes'});
  edit('chlorine',{seconds:36,power:30,outputs:{chlorine:1000,hydrogen:1000},energySource:'ElectrolyzerRecipes (saltwater equivalent; material inputs adapted)'});
  edit('fusionFuel',{inputs:{deuterium:125,tritium:125},outputs:{plasma:125},seconds:.8,power:3840,startup:E.fusion.startup,energySource:'FusionReactorRecipes'});
  machines.batteryBuffer={id:'batteryBuffer',name:'四格电池箱',stage:2,processes:[],cost:{steelPlate:4,tinWire:4,wood:2},power:0,description:'装入同级电池后储电、供电',energy:{kind:'battery',tier:1,maxTier:13}};
  addItem('batteryBuffer','四格电池箱','机器');
  addItem('lithiumDust','锂粉','材料');
  addRecipe('lithiumDust','盐水提锂','electrolyze',2,{salt:4,water:1000},{lithiumDust:1,chlorine:1000},12,16);
  const metals=['','steel','aluminium','stainless','titanium','tungstensteel','iridium','europium','neutronium','cosmic','catalyst','infinity','spacetime','eternity'];
  for(let tier=1;tier<E.battery.capacity.length;tier++){
    const id='battery'+E.codes[tier];
    addItem(id,E.codes[tier]+(tier<=3?' 锂电池':' 充电电池'),'电池');
    items[id].battery={tier,capacity:E.battery.capacity[tier]};
    const circuit=tier<=3?'basicCircuit':tier<=6?'advancedCircuit':tier<=9?'quantumCircuit':'exoticCircuit';
    addRecipe(id,items[id].name,'craft',tier+1,{[metals[tier]+'Plate']:2,lithiumDust:2,[circuit]:1},{[id]:1},8);
  }
  addItem('cryotheum','极寒之凛冰','流体','fluid');
  addRecipe('cryotheum','极寒冷却液','freeze',9,{water:1000,redstone:4,sulfur:4},{cryotheum:1000},20,131072);
  for(const r of recipes){
    if(['grind','alloy','compress'].includes(r.process)){
      delete r.inputs.steam;r.power=r.process==='alloy'?15:2;
      // Ore maceration base duration: ProcessingOre, 400 ticks, 2 EU/t.
      if(r.process==='grind')r.seconds=20;
    }
  }
  edit('bronzeAlloy',{seconds:10,power:15,energySource:'AlloySmelterRecipes'});
  edit('steam',{inputs:{water:1},outputs:{steam:160},seconds:160/120,energySource:'MTEBoilerBronze'});
  edit('steamPower',{inputs:{steam:7},seconds:.5,generation:3,energySource:'MTESteamTurbine'});
  edit('dieselPower',{inputs:{diesel:1},seconds:.5,generation:432,energySource:'MaterialsInit / MTEDieselGenerator'});
  edit('plasmaPower',{inputs:{plasma:1},seconds:.5,generation:Math.floor(81920*.7),energySource:'ProcessingCell / MTEPlasmaGenerator'});
  edit('stellarPower',{inputs:{cryotheum:E.dyson.coolant},seconds:3600,generation:0,energySource:'TileEntityDysonSwarm / gtnhintergalactic.cfg'});
  addRecipe('gasPower','氢气发电','generateGas',2,{hydrogen:1},{},.5);
  Object.assign(recipes.at(-1),{generation:19,energySource:'MaterialsInit / MTEGasTurbine'});
}
