import {GODFORGE_REFERENCE as R} from '../data/godforge-reference.js';
import {endpointMembers} from './groups.js';

const X=R.exotic,integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const random=(game,n)=>Math.floor(game.nextDropRandom()*n);
const pool=(kind)=>X[kind];
const field=r=>r.requirements?.exoticTier?'magmatter':'quark';
function choose(game,kind,count){
  const candidates=pool(kind).map((_,index)=>index),chosen=[];
  while(chosen.length<count){
    const total=candidates.reduce((n,i)=>n+pool(kind)[i].weight,0);let roll=1+random(game,total-1),at=0;
    for(;at<candidates.length-1;at++){roll-=pool(kind)[candidates[at]].weight;if(roll<=0)break;}
    const index=candidates.splice(at,1)[0];chosen.push({kind,index,count:kind==='items'?1+random(game,6):kind==='fluids'?1+random(game,63):1});
  }
  return chosen;
}
export function generateExotic(game,d,r){
  if(!X||X.unresolved.length)return {ok:false,message:'配料材料尚不齐全'};
  d.exotic??={clock:60,challenge:null};
  if(d.exotic.challenge&&d.exotic.clock<60)return {ok:false,message:'配料更换间隔为 60 秒'};
  const mode=field(r);let entries,time=0,space=0;
  if(mode==='quark'){const fluids=random(game,7);entries=[...choose(game,'items',7-fluids),...choose(game,'fluids',fluids)];}
  else {entries=choose(game,'magmatter',1);time=1+random(game,49);space=51+random(game,49);}
  d.exotic.challenge={mode,entries,time,space,issued:false};d.exotic.clock=0;return {ok:true};
}
export function exoticRecipe(game,d,r){
  if(r?.dynamic!=='godforge')return r;
  const c=d.exotic?.challenge;if(!c||c.mode!==field(r))return r;
  const inputs={},samples={};
  for(const {kind,index,count}of c.entries){
    const row=pool(kind)[index],amount=count*(kind==='fluids'?1000:144*(c.mode==='quark'?9:c.space-c.time));
    inputs[row.plasma]=(inputs[row.plasma]??0)+amount;samples[row.sample]=(samples[row.sample]??0)+count;
  }
  if(c.mode==='magmatter'){inputs[X.time]=c.time;inputs[X.space]=c.space;samples[X.time]=c.time;samples[X.space]=c.space;}
  return {...r,inputs,samples};
}
export function exoticOutputFluids(game,d,r){
  return Object.keys(exoticRecipe(game,d,r)?.samples??{}).filter(id=>game.catalog.items[id]?.kind==='fluid');
}
export function issueExoticSamples(game,d,r,batchEU){
  const c=d.exotic?.challenge;
  if(!c||c.mode!==field(r))return '请先生成本批配料';
  if(c.issued)return '';
  if(d.supply.mode!=='storage')return '请选择实体电池组';
  const power=endpointMembers(game,d.supply.source).filter(s=>s.enabled&&s.batteries>0&&game.catalog.machines[s.type]?.energy?.kind==='battery').reduce((n,s)=>n+s.eu,0);
  if(!Number.isSafeInteger(batchEU)||batchEU<1||power<batchEU)return '配料前需要电池组储备整批电量';
  if(!game.add(r.samples,false,d.fluidOutputs))return '配料样品需要空余输出容器';
  c.issued=true;return '';
}
export function validExotic(game,d,r){
  const s=d.exotic;if(s===undefined)return !d.job||r?.dynamic!=='godforge';
  if(!['exotic','magmatter'].includes(game.catalog.machines[d.type]?.godforge)||!s||Array.isArray(s)||!Number.isFinite(s.clock)||s.clock<0||s.clock>60)return false;
  const c=s.challenge;if(c===null)return !d.job;
  if(!c||!['quark','magmatter'].includes(c.mode)||typeof c.issued!=='boolean'||!Array.isArray(c.entries))return false;
  if(c.mode==='quark'?c.entries.length!==7||c.time!==0||c.space!==0:c.entries.length!==1||!integer(c.time,1,49)||!integer(c.space,51,99))return false;
  const keys=new Set();
  for(const {kind,index,count}of c.entries){
    if(c.mode==='quark'?!['items','fluids'].includes(kind):kind!=='magmatter')return false;
    if(!integer(index,0,pool(kind).length-1)||!integer(count,1,kind==='fluids'?63:kind==='items'?6:1)||keys.has(kind+index))return false;
    keys.add(kind+index);
  }
  return !d.job||c.issued&&r?.dynamic==='godforge'&&c.mode===field(r);
}
