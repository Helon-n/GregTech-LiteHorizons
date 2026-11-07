// A compact aura connection replaces spatial nodes/wands in the idle station.
// This value is the minimum charge of all six equally charged primal aspects.
export function initializeAura(game,d){
  if(game.catalog.machines[d.type]?.aura)d.vis??=0;
  if(game.catalog.machines[d.type]?.mana){d.mana??=0;d.manaFuel??=0;}
}
export function rechargeAura(game,d,dt){
  const aura=game.catalog.machines[d.type]?.aura;
  if(aura&&d.enabled)d.vis=Math.min(aura.capacity,(d.vis??0)+aura.recharge*dt);
  const mana=game.catalog.machines[d.type]?.mana;
  if(mana&&d.enabled){
    let left=dt;
    while(left>1e-9){
      if(d.manaFuel<=1e-9){if(d.mana>=mana.capacity||!game.pay({coal:1}))break;d.manaFuel=mana.coalSeconds;}
      // An already burning Endoflame keeps consuming its fuel at a full pool.
      const used=Math.min(left,d.manaFuel);
      d.mana=Math.min(mana.capacity,d.mana+used*mana.rate);d.manaFuel=Math.max(0,d.manaFuel-used);left-=used;
    }
  }
}
export function auraFailure(game,d,r){
  const cost=r?.requirements?.vis;
  const mana=r?.requirements?.mana;
  if(mana&&(!game.catalog.machines[d.type]?.mana||(!d.job&&(d.mana??0)+1e-9<mana)))return '魔力不足：需要 '+mana.toLocaleString()+' mana';
  return cost&&(!game.catalog.machines[d.type]?.aura||(!d.job&&(d.vis??0)+1e-9<cost))?'灵气不足：六种原始要素各需 '+cost+' vis':'';
}
export function spendAura(d,r){if(r.requirements?.vis)d.vis-=r.requirements.vis;if(r.requirements?.mana)d.mana-=r.requirements.mana;}
export function validAura(game,d){
  const mana=game.catalog.machines[d.type]?.mana;
  if(d.mana!==undefined||d.manaFuel!==undefined){
    if(!mana||![d.mana,d.manaFuel].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)||d.mana>mana.capacity||d.manaFuel>mana.coalSeconds)return false;
  }
  if(d.vis===undefined)return true;
  const aura=game.catalog.machines[d.type]?.aura;
  return !!aura&&typeof d.vis==='number'&&Number.isFinite(d.vis)&&d.vis>=0&&d.vis<=aura.capacity;
}
