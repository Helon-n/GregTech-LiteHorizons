import {GODFORGE_REFERENCE as R} from './data/godforge-reference.js';
import {godforgeKind,forgeHost,forgeHeat,forgeMaxFactor,forgeMilestones,forgeFuelAmount,forgeUpgradeFailure} from './core/godforge.js';
const views={};
export function setForgeView(id,value){if(['fuel','upgrades','structure'].includes(value))views[id]=value;}
export function godforgeControls({game,d,icon,name,num,e,listPage,stacks,fluidInputControls,deviceName}){
  if(d.group)return '<p class="muted small">展开成员，逐台连接主机和设置升级。</p>';
  const button=(action,value,label,extra='')=>`<button class="button" data-forge-action="${action}" data-forge-device="${d.id}" data-value="${e(value)}" ${extra}>${label}</button>`;
  if(godforgeKind(game,d)!=='host'){
    const host=forgeHost(game,d),hosts=game.state.devices.filter(h=>godforgeKind(game,h)==='host');
    const list=listPage('forge-hosts:'+d.id,hosts,2);
    let extra='';
    if(['exotic','magmatter'].includes(godforgeKind(game,d))){
      const recipe=game.deviceRecipe(d),inputs=listPage('forge-exotic-input:'+d.id,Object.entries(recipe?.inputs??{}),3);
      extra=`${button('challenge','',d.exotic?.challenge?'更换本批配料':'生成本批配料',d.job||d.exotic?.challenge&&d.exotic.clock<60?'disabled':'')}<p class="small muted">按本批配料收集等离子体。电池储能充足后提供对应样品，样品需另行加工；每批一次结算，每 60 秒可更换配料。</p>${stacks(Object.fromEntries(inputs.entries))}${inputs.controls}`;
    }
    return `<p class="muted small">${host?'已连接 '+e(deviceName(host))+' · '+num(forgeHeat(host.godforge,godforgeKind(game,d)))+' K':'请选择造物主主机'}。开工从选定实体电池组预付整批电量。</p><div class="energy-actions">${list.entries.map(h=>button('host',h.id,icon(h.type)+e(deviceName(h))+' #'+h.id.slice(1),`aria-pressed="${host===h}"`)).join('')}${button('host','','断开主机')}</div>${list.controls}${extra}`;
  }
  const s=d.godforge,mode=views[d.id]??'fuel',milestones=forgeMilestones(game,d);
  const tabs=`<div class="energy-modes">${[['fuel','燃料'],['upgrades','升级'],['structure','结构']].map(([v,label])=>`<button class="filter ${mode===v?'active':''}" data-forge-view="${d.id}" data-value="${v}" aria-pressed="${mode===v}">${label}</button>`).join('')}</div>`;
  if(mode==='upgrades'){
    const list=listPage('forge-upgrades:'+d.id,R.upgrades,1);
    return tabs+`<p class="small">可用引力子碎片 ${num(milestones.available)} · 里程碑 ${milestones.progress.map(n=>num(n)).join(' / ')}</p>${s.upgrades.includes('END')?`<div class="energy-actions">${button('ejectShards',1,'取出 ×1')}${button('ejectShards',64,'取出 ×64')}${button('absorbShards',1,'存入 ×1')}${button('absorbShards',64,'存入 ×64')}</div>`:''}`+list.entries.map(u=>{
      const failure=forgeUpgradeFailure(game,d,u.code),active=s.upgrades.includes(u.code);
      const text=listPage('forge-upgrade-description:'+d.id+':'+u.code,Array.from(u.description).join('').match(/[\s\S]{1,100}/gu)??[''],1),cost=listPage('forge-upgrade-materials:'+d.id+':'+u.code,Object.entries(u.cost),3);
      return `<h3>${e(u.name)}</h3><p class="small muted">${text.entries.map(e).join('')}</p>${text.controls}<p class="small">碎片 ×${u.shards}${u.prerequisites.length?' · 前置：'+u.prerequisites.map(code=>e(R.upgrades.find(u=>u.code===code).name)).join(u.all?' ＋ ':' / '):''}</p>${stacks(Object.fromEntries(cost.entries))}${cost.controls}${button('upgrade',u.code,active?'已完成':failure?e(failure):'完成升级',failure?'disabled':'')}`;
    }).join('')+list.controls;
  }
  if(mode==='structure'){
    const pieces=s.rings<3?Object.entries(R.structures[s.rings===1?'SECOND_RING':'THIRD_RING']):[];
    const list=listPage('forge-ring-cost:'+d.id,pieces,4);
    return tabs+`<p>已建 ${s.rings} 环 · 模块槽 ${8+(s.upgrades.includes('CD')?4:0)+(s.upgrades.includes('END')?4:0)}</p>${stacks(Object.fromEntries(list.entries))}${list.controls}${s.rings<3?button('ring','','建造第 '+(s.rings+1)+' 环'):''}<p class="small muted">环结构按原版方块数量折算为一次投入，模块单独建造和连接。</p>`;
  }
  return tabs+`<p>熔炼温度 ${num(forgeHeat(s))} K · 燃烧储备 ${num(s.charge)} / ${num(s.capacity)}</p><div class="energy-actions">${R.fuels.map((id,i)=>button('fuel',i,icon(id)+e(name(id)),`aria-pressed="${s.fuel===i}"`)).join('')}</div><div class="energy-actions">${button('factor',Math.max(1,s.factor-1),'−')}<span>燃料系数 ${num(s.factor)} / ${num(forgeMaxFactor(s))}</span>${button('factor',Math.min(forgeMaxFactor(s),s.factor+1),'＋')}</div><p class="small muted">每 5 秒消耗 ${num(forgeFuelAmount(s))} mB 燃料；首次点燃消耗 ${e(name(R.startup))}。燃烧储备维持恒星，模块加工另外消耗电池中的 EU。</p>${fluidInputControls(d)}${button('charging','',s.charging?'停止补充燃烧储备':'双倍燃料补充储备',`aria-pressed="${s.charging}"`)}<div class="energy-actions">${button('capacity',Math.max(100,s.charge,Math.floor(s.capacity/10)),'−')}<span>储备上限 ${num(s.capacity)}</span>${button('capacity',Math.min(Number.MAX_SAFE_INTEGER,s.capacity*10),'＋')}</div>`;
}
