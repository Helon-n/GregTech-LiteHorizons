import {RENEWABLES_REFERENCE as R} from '../data/renewables-reference.js';

const S=R.solar;
export function runSolarTower(game,d,dt){
  const spec=game.catalog.machines[d.type].energy,r=game.recipeById.get(d.recipe);
  d.solarTower??={heat:0,efficiency:0,remaining:0};
  const state=d.solarTower;
  if(!d.enabled||!r){d.blocked=d.enabled?'请选择熔盐配方':'已停止';return;}
  const [reflectors,tier]=S.rings[spec.ring-1];
  let left=dt;
  while(left>1e-8){
    if(state.remaining<=1e-8){
      const efficiency=(S.coefficient-Math.abs(state.heat-S.center)**S.exponent)/S.coefficient;
      if(game.state.playtime%1200<600&&d.skyAccess)state.heat+=Math.trunc(reflectors*efficiency*(S.loss+tier));
      if(state.heat>0)state.heat=state.heat>S.capacity?S.capacity:Math.max(0,state.heat-S.loss);
      if(state.efficiency===10000&&state.heat>=S.threshold){
        const amount=Math.floor(Math.min(game.inputQuantity(S.cold,d.fluidInputs[S.cold]),state.heat,game.fluidRoom(S.hot,d.fluidOutputs[S.hot])));
        // Route to the selected physical tank. A blocked output retains heat
        // and cold salt, rather than creating an unbounded virtual reservoir.
        if(amount>0&&game.add({[S.hot]:amount},true,d.fluidOutputs)){
          game.payInputs(d,{[S.cold]:amount});state.heat-=amount;game.state.produced+=amount;
        }
      }
      state.remaining=S.ticks/20;
    }
    const used=Math.min(left,state.remaining);state.remaining=Math.max(0,state.remaining-used);left-=used;
    if(state.remaining<=1e-8)state.efficiency=Math.min(10000,state.efficiency+100);
  }
  d.blocked=state.efficiency<10000?'启动升温中':state.heat<S.threshold?'积蓄太阳热量':!game.inputQuantity(S.cold,d.fluidInputs[S.cold])?'等待冷太阳盐':game.fluidRoom(S.hot,d.fluidOutputs[S.hot])<1?'热太阳盐输出容器已满':'运行中';
}

export function validSolarTower(game,d){
  const s=d.solarTower;if(s===undefined)return true;
  return game.catalog.machines[d.type]?.energy?.cycle==='solarTower'&&s&&Object.entries({heat:S.capacity,efficiency:10000,remaining:S.ticks/20}).every(([k,max])=>typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>=0&&s[k]<=max)&&(Number.isInteger(s.heat)&&Number.isInteger(s.efficiency)&&s.efficiency%100===0);
}
