// One predicate shared by the simulation, production planner and source audits.
export function nodeRequirements(node) {
  return [...new Set([node?.requires, ...(node?.requiresAll ?? [])].filter(Boolean))];
}

export function gatheringAccess(catalog, node, has) {
  if (!node) return {available:false, missing:['采集地点不存在'], regions:[], level:0};
  const owns=id=>has(id)||(id==='rocket'&&has('advancedRocket'));
  const rules=catalog.mining, missing=nodeRequirements(node).filter(id=>!owns(id)).map(id=>catalog.items[id]?.name??id);
  const level=rules?Math.max(0,...Object.entries(rules.tools).filter(([id])=>has(id)).map(([,tool])=>tool.level)):0;
  if(node.miningLevel!==undefined&&(!rules||!Object.keys(rules.tools).some(id=>has(id))||level<node.miningLevel)) {
    const suitable=Object.entries(rules?.tools??{}).find(([,tool])=>tool.level>=node.miningLevel);
    missing.push(`采掘等级 ${node.miningLevel}+ 的镐${suitable?'（'+catalog.items[suitable[0]].name+'或更高）':''}`);
  }
  const regions=(node.regions??[]).map(id=>({id,...rules?.regions[id],available:!!rules?.regions[id]&&rules.regions[id].requires.every(owns)}));
  if(regions.length&&!regions.some(region=>region.available)) {
    const alternatives=[...new Set(regions.map(region=>(region.requires??[]).filter(id=>!owns(id)).map(id=>catalog.items[id]?.name??id).join('＋')||'未知地区'))];
    missing.push('地区入口：'+alternatives.join(' / '));
  }
  return {available:missing.length===0,missing,regions,level};
}
