// Browse the actual world distribution, independently of chapter progression.
const localRegions=new Set(['OW','NETHER','TWILIGHT_FOREST','THE_END','EVERGLADES']);
export const gatheringPage=id=>localRegions.has(id)?'resources':'space';

export function gatheringRegions(catalog,key){
  const preferred=key==='resources'?[...localRegions]:['Moon','Mars','Asteroids'];
  return Object.entries(catalog.mining.regions)
    .filter(([id])=>gatheringPage(id)===key)
    .map(([id,region])=>({id,...region,nodes:catalog.gatherNodes.filter(node=>node.regions?.includes(id))}))
    .filter(region=>region.nodes.length)
    .sort((a,b)=>(preferred.indexOf(a.id)<0?999:preferred.indexOf(a.id))-(preferred.indexOf(b.id)<0?999:preferred.indexOf(b.id)));
}

export function gatheringDestination(catalog,node,has){
  const ids=[...(node.regions??[])].sort((a,b)=>Number(!localRegions.has(a))-Number(!localRegions.has(b))),owns=id=>has(id)||(id==='rocket'&&has('advancedRocket'));
  const id=ids.find(id=>catalog.mining.regions[id]?.requires.every(owns))??ids[0];
  return {page:gatheringPage(id),region:id};
}
