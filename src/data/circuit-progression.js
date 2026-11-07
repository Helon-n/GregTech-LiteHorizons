// Replace the idle game's old circuit ladder with registered GTNH circuits.
// These aliases migrate saves; original imported GT recipes keep their IDs.
export const CIRCUIT_MIGRATIONS=Object.freeze({
  exoticCircuit:'gtItem_Circuit_OpticalComputer',
  cosmicCircuit:'gtItem_Circuit_OpticalMainframe',
  transcendentCircuit:'nhItem_PikoCircuit',
  spacetimeCircuit:'nhItem_QuantumCircuit',
  ultimateCircuit:'nhItem_PlanckCircuit',
});

export function applyCircuitProgression({items,machines,recipes,milestones}){
  const remap=cost=>Object.entries(cost??{}).reduce((result,[id,n])=>{
    const key=CIRCUIT_MIGRATIONS[id]??id;
    result[key]=(result[key]??0)+n;return result;
  },{});
  for(const m of Object.values(machines))m.cost=remap(m.cost);
  for(const r of recipes)if(r.source==='adapted'){
    r.inputs=remap(r.inputs);
    if(r.tools)r.tools=remap(r.tools);
  }
  for(let index=0;index<milestones.length;index++)milestones[index]=remap(milestones[index]);
  // Core's BioCPU requires UHV/2 EU/t, beyond UV's single-amp recipes.
  // UV completes the wetware ladder with its UHV-rated mainframe instead.
  if(milestones[9]?.biowareCircuit){
    milestones[9].gtItem_Circuit_Wetwaremainframe=milestones[9].biowareCircuit;
    delete milestones[9].biowareCircuit;
  }
  // Optical assemblies need UEV mutated living solder. UHV first completes
  // the BioCPU route registered at RECIPE_UHV / 2 in Core.
  if(milestones[10]?.opticalCircuit){
    milestones[10].biowareCircuit=milestones[10].opticalCircuit;
    delete milestones[10].opticalCircuit;
  }
  const names={gtItem_Circuit_OpticalAssembly:'光学处理器集群',gtItem_Circuit_OpticalComputer:'光学计算机',
    gtItem_Circuit_OpticalMainframe:'光学主机',nhItem_PikoCircuit:'皮米电路',
    nhItem_QuantumCircuit:'量子电路',nhItem_PlanckCircuit:'普朗克电路'};
  for(const[id,name]of Object.entries(names))if(items[id])items[id].name=name;
}
