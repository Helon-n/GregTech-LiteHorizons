// GT5-Unofficial 5.09.54.265, MTELargeBoilerBase and its four subclasses.
// Internal fluid buffers and construction costs belong to the idle adaptation.
export const LARGE_BOILERS=Object.freeze({
  largeBronze:{name:'大型青铜锅炉',stage:2,eut:480,increase:16,boost:[2,1],steam:'steam',material:'bronzePlate'},
  largeSteel:{name:'大型钢锅炉',stage:3,eut:1200,increase:12,boost:[1,1],steam:'steam',material:'steelPlate'},
  largeTitanium:{name:'大型钛锅炉',stage:5,eut:4800,increase:8,boost:[3,10],steam:'superheatedSteam',material:'titaniumPlate'},
  largeTungstenSteel:{name:'大型钨钢锅炉',stage:6,eut:19200,increase:4,boost:[15,100],steam:'superheatedSteam',material:'tungstensteelPlate'},
});
export const LARGE_BOILER_FLUIDS=Object.freeze(['ether','gasoline','nitrofuel','ethanol gasoline','jet fuel no.3','jet fuel a','highoctanegasoline']);
export const COMBUSTION=Object.freeze({nominal:2048,boostFactor:2,efficiencyIncrease:15,minimumEfficiency:2000,normalEfficiency:10000,boostEfficiency:30000,lubricantPeriod:72,oxygenPerTick:2});

// LargeBoilerFuelBackend rounds the logarithmic bonus in seconds to two
// decimal places (HALF_UP), then truncates the resulting tick count.
export function largeBoilerBurnTicks(baseSeconds){
  return Math.trunc(Math.floor(baseSeconds*Math.max(1,1+Math.log(baseSeconds/10)*.025)*100+.5)/100*20);
}
