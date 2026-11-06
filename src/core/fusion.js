// FusionSpecialValueFormatter and (Advanced)FusionOverclockDescriber, GT 5.09.54.265.
export const FUSION_STARTUP=[160000000,320000000,640000000,5120000000,20480000000];
export function fusionTier(startup,power){
  const byStartup=FUSION_STARTUP.findIndex(n=>startup<=n);
  const byVoltage=power<=32768?1:power<=131072?2:power<=524288?3:power<=2097152?4:5;
  return Math.max(byStartup<0?6:byStartup+1,byVoltage);
}
export function fusionCapacity(spec,tier){return spec.startupCapacity??FUSION_STARTUP[tier-6]??0;}
export function fusionOverclock(spec,tier,r){
  return {count:Math.max(0,tier-5-fusionTier(r.startup??0,r.power??0)),factor:spec.advancedFusion?4:2};
}
