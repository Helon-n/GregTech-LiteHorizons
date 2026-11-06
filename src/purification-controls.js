import {PURIFICATION_REFERENCE as R} from './data/purification-reference.js';
import {purificationTier,purificationHost} from './core/purification.js';
const views={};
export function setPurificationView(id,view){if(['connection','process','inputs'].includes(view))views[id]=view;}
export function purificationControls({game,d,icon,name,num,e,listPage,fluidInputControls,deviceName}){
  if(d.group)return '<p class="small muted">展开成员，分别连接纯净水厂主控并设置处理方式。</p>';
  const tier=purificationTier(game,d),button=(action,value,label,extra='')=>`<button class="button" data-purification-action="${action}" data-purification-device="${d.id}" data-value="${e(value)}" ${extra}>${label}</button>`;
  if(tier==='host'){
    const units=game.state.devices.filter(u=>u.purificationHost===d.id),active=units.filter(u=>u.enabled&&u.recipe);
    return `<p>已连接 ${units.length} 个处理单元 · ${active.length} 个已启动</p><p class="small muted">主控统一供电。处理单元独立完成 120 秒批次，进料、处理助剂和产物通过各自指定的容器传输。</p>`;
  }
  const view=views[d.id]??'connection',tabs=`<div class="energy-modes">${[['connection','连接'],['process','处理'],['inputs','进料']].map(([v,label])=>`<button class="filter ${view===v?'active':''}" data-purification-view="${d.id}" data-value="${v}" aria-pressed="${view===v}">${label}</button>`).join('')}</div>`;
  if(view==='inputs')return tabs+fluidInputControls(d)+'<p class="small muted">本级净水 90 mB 可增加 15% 基础成功率；缺少时正常启动。失败可能回收较低等级的水。</p>';
  const h=purificationHost(game,d),hosts=listPage('water-hosts:'+d.id,game.state.devices.filter(h=>purificationTier(game,h)==='host'),2);
  let body=`<p class="small">${h?'主控：'+e(deviceName(h))+' #'+h.id.slice(1):'请选择纯净水厂主控'}</p><div class="energy-actions">${hosts.entries.map(x=>button('host',x.id,icon(x.type)+e(deviceName(x)),`aria-pressed="${h===x}"`)).join('')}${button('host','','断开主控')}</div>${hosts.controls}`;
  if(view==='connection')return tabs+body;
  body='';
  if(tier===1)body+='<p class="small muted">每批需一张活性炭滤网，有 20% 概率损坏。基础成功率 70%。</p>';
  if(tier===2)body+='<p class="small muted">臭氧用量由所选配方决定，基础成功率 20%–80%。</p>';
  if(tier===3){const dose=d.purificationDose??900000;body+=`<div class="energy-actions">${button('dose',Math.max(0,dose-100000),'−')}<span>每批絮凝剂 ${num(dose)} mB</span>${button('dose',Math.min(1000000,dose+100000),'＋')}</div><p class="small muted">每 100,000 mB 增加 10% 成功率；不足整数剂量会降低成功率。处理后返还相应废液。</p>`;}
  if(tier===4)body+='<p class="small muted">按传感器读数自动定量投放氢氧化钠或盐酸，将 pH 调节至 7.00。缺少调节剂会影响本批结果。</p>';
  if(tier===5)body+='<p class="small muted">自动切换加热与冷却：每秒最多 10 mB 氦等离子体或 100 mB 超级冷却液。完整升温至 10,000 K 并冷却至 0 K，增加 33% 成功率。</p>';
  if(tier===6){const lenses=listPage('water-lenses:'+d.id,R.lenses,3);body+=`<div class="energy-actions">${lenses.entries.map(id=>`<span title="${e(name(id))}">${icon(id)}${e(name(id))}</span>`).join('')}</div>${lenses.controls}${button('lenses','',d.purificationLenses?'取回九片透镜':'装入九片处理透镜')}<p class="small muted">透镜按顺序自动轮换，每次正确轮换增加 10% 成功率，透镜保留在设备中。</p>`;}
  if(tier===7){const list=listPage('water-superconductor:'+d.id,R.superconductors,2);body+=`<div class="energy-actions">${list.entries.map(([id,amount,multiplier])=>button('superconductor',R.superconductors.findIndex(a=>a[0]===id),icon(id)+e(name(id))+' ×'+multiplier,`aria-pressed="${R.superconductors[d.purificationSuperconductor??0][0]===id}"`)).join('')}</div>${list.controls}<p class="small muted">根据信号定量注入惰性气体、熔融超导体或中子素；要求不投料时关闭阀门。较高级超导体可增加净水产量。</p>`;}
  if(tier===8){
    const sequence=d.purificationSequence??[0,1,2,3,4,5],types=listPage('water-catalysts:'+d.id,R.catalysts,3),slots=listPage('water-sequence:'+d.id,sequence.map((n,i)=>({n,i})),6);
    body+=`<p class="small">催化剂序列 · ${sequence.length} / 32</p><div class="energy-actions">${slots.entries.map(({n,i})=>`<span title="${e(name(R.catalysts[n]))}">${i+1}${icon(R.catalysts[n])}</span>`).join('')}</div>${slots.controls}<div class="energy-actions">${types.entries.map(id=>button('catalyst',R.catalysts.indexOf(id),icon(id)+e(name(id)))).join('')}</div>${types.controls}<div class="energy-actions">${button('undo','','撤回末位')}${button('clear','','清空序列')}</div><p class="small muted">每批随机选择两种夸克催化剂。按设定顺序逐个投放，直到找到相邻匹配。每次消耗熔融无尽 144 mB，同种重复投入时费用翻倍；未匹配的催化剂在批末退回。</p>`;
  }
  return tabs+body;
}
