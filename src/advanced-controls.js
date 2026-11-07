import {LATE_MACHINES_REFERENCE as L} from './data/late-machines-reference.js';
import {BEAMLINE_REFERENCE as BEAM} from './data/beamline-reference.js';
import {beamKind} from './core/beamline.js';
import {isEOH,eohChance,eohCost} from './core/eoh.js';
import {EOH_REFERENCE as H} from './data/eoh-reference.js';
import {BEC_REFERENCE as B} from './data/bec-reference.js';
import {becKind,becHost,naniteInfo,becStep} from './core/bec.js';
import {spinTier,spinParallel,spinCarrier,spinMode,spinDose} from './core/spinmatron.js';
import {FOUNDRY_REFERENCE as F} from './data/foundry-reference.js';
import {foundryTier,foundryStats,foundryModuleCost} from './core/foundry.js';

export function advancedControls({game,d,icon,name,num,e,listPage,deviceName,view='network'}){
  const button=(action,value,label)=>`<button class="button" data-advanced-action="${action}" data-device-id="${d.id}" data-value="${e(value)}" data-view="${e(view)}">${label}</button>`;
  if(beamKind(game,d)){
    const s=d.beam,kind=beamKind(game,d),target=game.state.devices.find(t=>t.id===s.target);
    const targets=listPage('beam-targets:'+d.id,game.state.devices.filter(t=>t.id!==d.id&&['crafter','collider'].includes(beamKind(game,t))),4);
    const tabs=kind==='collider'?[['network','连接'],['accelerator','加速'],['detectors','探测与筛选']]:[];
    let body=`<h2>${e(deviceName(d))}</h2><div class="energy-modes">${tabs.map(([key,label])=>`<button class="filter ${view===key?'active':''}" data-advanced-open="${d.id}" data-view="${key}" aria-pressed="${view===key}">${label}</button>`).join('')}</div>`;
    if(kind!=='crafter'&&view==='network')body+=`<p>束流输出：${target?e(deviceName(target)):'未连接'}</p><div class="energy-actions">${targets.entries.map(t=>button('beam-target',t.id,icon(t.type)+e(deviceName(t))+' #'+t.id.slice(1))).join('')}${button('beam-target','','断开')}</div>${targets.controls}`;
    if(kind==='crafter'){
      const buffers=listPage('beam-buffer:'+d.id,Object.entries(s.buffer).filter(([,n])=>n>0),6);
      body+=`<p>机内束流缓存</p><div class="energy-actions">${buffers.entries.map(([k,n])=>`<span class="tag">${e(name(BEAM.particles[k].id))} ${num(n)}</span>`).join('')||'<span class="muted">等待粒子源连接</span>'}</div>${buffers.controls}${button('beam-clear','','清空缓存')}<p class="small muted">粒子按配方所需数量推进加工；同类粒子的两个槽共用缓存。暂停保留本批进度；强制停止损失本批原料。</p>`;
    }
    if(kind==='collider'&&view==='accelerator'){
      body+=`<p>目标束能 ${num(s.targetEnergy)} keV · 加速周期 ${s.cycles}</p><p>${s.cached?e(name(BEAM.particles[s.cached.particle].id))+' · '+num(s.cached.energy)+' keV · '+num(s.cached.rate)+' 粒子/秒':'等待可加速的粒子源'}</p><div class="energy-actions">${button('beam-energy',Math.max(1,s.targetEnergy/10),'束能 ÷10')}${button('beam-energy',Math.min(1e9,s.targetEnergy*10),'束能 ×10')}${button('beam-cycles',Math.max(0,s.cycles-1),'周期 −')}${button('beam-cycles',Math.min(256,s.cycles+1),'周期 ＋')}</div><div class="energy-actions">${[[0,'不助推'],[1,'夸克胶子等离子体'],[2,'磁物质']].map(([v,label])=>button('beam-boost',v,e(label)+(s.boost===v?' ✓':''))).join('')}</div><p class="small muted">加速耗电随周期平方增长；助推消耗与粒子数相同的流体。暂停会清除加速状态，调整参数前请暂停。</p>`;
    }
    if(kind==='collider'&&view==='detectors'){
      const filters=listPage('beam-filter:'+d.id,[...new Set(s.modules.flatMap(k=>BEAM.modules[k].particles))],6);
      body+=`<div class="energy-actions">${Object.entries(BEAM.modules).map(([k,m])=>button('beam-module',k,icon(m.casing)+k+(s.modules.includes(k)?' · 已安装':' · 安装'))).join('')}</div><p>输出筛选：${s.filter?e(name(BEAM.particles[s.filter].id)):'全部'}</p><div class="energy-actions">${button('beam-filter','','全部')}${filters.entries.map(k=>button('beam-filter',k,e(name(BEAM.particles[k].id)))).join('')}</div>${filters.controls}<p class="small muted">模块收取对应探测器外壳。筛掉的结果丢弃，不重新抽取。安装或拆下模块前请暂停。</p>`;
    }
    return body+'<p class="small muted">束流沿指定连接传输；未连接或目标暂停时粒子包丢失。仓库和储罐不能储存束流。</p>';
  }
  if(foundryTier(game,d)){
    const tier=foundryTier(game,d),stats=foundryStats(d),page=listPage('foundry-modules:'+d.id,F.modules,1);
    return `<h2>${e(deviceName(d))}</h2><p>并行上限 ${stats.parallel} · 速度 ×${stats.speed.toFixed(2)} · 耗电 ${(stats.eu*100).toFixed(1)}%</p><div class="energy-actions">${Array.from({length:tier+1},(_,i)=>{const m=F.modules.find(m=>m.code===d.foundryModules?.[i]);return button('foundry',i+'|',`槽 ${i+1}：${m?icon(m.icon)+e(m.name)+' · 拆下':'空'}`);}).join('')}</div>${page.entries.map(m=>`<h3>${icon(m.icon)}${e(m.name)}</h3><div class="energy-actions">${Object.entries(foundryModuleCost(tier,m)).map(([id,n])=>`<span title="${e(name(id))}">${icon(id)} ${num(n)}</span>`).join('')}</div><div class="energy-actions">${Array.from({length:tier+1},(_,i)=>button('foundry',i+'|'+m.code,'安装到槽 '+(i+1))).join('')}</div>`).join('')}${page.controls}<p class="small muted">安装支付整套结构材料，拆下退回材料。超级冷却器每秒消耗超冷却液 100 mB、时空 50 mB 或永恒 25 mB；永恒需搭配通用坍缩器。在供能页选择输入容器。三个以上日铸模块每批随机获得额外增益。变更模块前需暂停并结束批次。</p>`;
  }
  if(isEOH(game,d)){
    const s=d.eoh,r=game.recipeById.get(d.recipe);
    return `<h2>${e(deviceName(d))}</h2><p>已预充 ${BigInt(s.charge).toLocaleString()} EU</p><p>待回充 ${BigInt(s.returnEU).toLocaleString()} EU</p>${r?`<p>本批需要 ${eohCost(d,r).toLocaleString()} EU · 成功率 ${(eohChance(d,r)*100).toFixed(2)}%</p>`:''}${Object.entries(H.fields).map(([key,f])=>`<div class="settings-row"><span>${{time:'时间加速',space:'空间压缩',stability:'稳定场'}[key]} · ${s[key]+1} 级</span><div class="energy-actions">${button('eoh-'+key,Math.max(0,s[key]-1),'−')}${icon(f.items[s[key]])}${button('eoh-'+key,Math.min(8,s[key]+1),'＋')}</div></div>`).join('')}<div class="energy-actions"><span>超频电路 ${s.circuit}</span>${button('eoh-circuit',Math.max(0,s.circuit-1),'−')}${button('eoh-circuit',Math.min(24,s.circuit+1),'＋')}</div><p class="small muted">时间加速每级减半时长、降低 9.25% 成功率；稳定场每级增加 5% 成功率、减少 5% 物品产量。每级电路超频耗电 ×4、时长 ÷2。更换场发生器需要整套方块，旧方块退回仓库。返还电量在输出页连接电池箱。</p>`;
  }
  if(spinTier(game,d)){
    const rotors=listPage('spin-rotors:'+d.id,Object.keys(game.catalog.items).filter(id=>game.catalog.items[id].rotor&&(game.quantity(id)>0||game.state.components.some(c=>c.item===id&&c.life>0))),4),r=game.recipeById.get(d.recipe);
    return `<h2>${e(deviceName(d))}</h2><div class="energy-modes">${[['light','轻型'],['standard','标准'],['heavy','重型']].map(([key,label])=>button('rotor',key,label+(spinMode(d,r)===key?' ✓':''))).join('')}</div><div class="energy-modes">${[L.fluid,L.kerosene].map(id=>button('rotor',id,icon(id)+e(name(id))+(spinCarrier(d)===id?' ✓':''))).join('')}</div><p>转子 ${d.spinRotors?.length??0} / ${spinTier(game,d)*2} · 结构并行上限 ${spinParallel(game,d,r)}</p><div class="energy-actions">${(d.spinRotors??[]).map(c=>icon(c.item)).join('')}${button('rotor-out','','取出末位转子')}</div><div class="energy-actions">${rotors.entries.map(id=>button('rotor',id,icon(id)+e(name(id)))).join('')}</div>${rotors.controls}<p class="small muted">${e(name(spinCarrier(d)))}：${r?spinDose(r)+' mB / 秒，开工检查五秒储备':'按配方电压，每级 10 mB / 秒'}。在供能页指定输入容器。根据转子、可用原料和容器空间决定实际并行。重型模式必须使用生物催化推进液；轻型模式需高于配方三级电压。切换前请暂停并结束批次。</p>`;
  }
  const kind=becKind(game,d);if(!kind)return '';
  const tabs=`<div class="energy-modes">${[['network','网络'],['contents','存量'],...(kind==='assembler'?[['nanites','纳米蜂群']]:[])].map(([key,label])=>`<button class="filter ${view===key?'active':''}" data-advanced-open="${d.id}" data-view="${key}" aria-pressed="${view===key}">${label}</button>`).join('')}</div>`;
  let body='';
  if(view==='nanites'){
    const info=naniteInfo(d),r=game.recipeById.get(d.recipe),slot=r&&becStep(d,r),page=listPage('bec-nanites:'+d.id,B.nanites,3);
    body+=`<p>已安装 ${num(info.count)} / 30,720${info.count?' · 最低 '+info.tier+' 级':''}</p>${slot?`<p>当前第 ${slot.index+1} 槽：${icon(slot.nanite)}${e(name(slot.nanite))}</p>`:''}`;
    body+=page.entries.map(n=>`<div class="settings-row"><div>${icon(n.item)}${e(name(n.item))}<small>已装 ${num(d.nanites?.[n.item]??0)} · 库存 ${num(game.quantity(n.item))}</small></div><div class="energy-actions">${button('nanite',n.item+'|1','装入 1')}${button('nanite',n.item+'|64','装入 64')}${button('nanite',n.item+'|-'+(d.nanites?.[n.item]??0),'取回')}</div></div>`).join('')+page.controls;
    body+='<p class="small muted">各输入槽依次加工。高一级蜂群加工低一级槽位时速度减半；混装以最低等级为准，可运行中更换。</p>';
  }else if(view==='contents'){
    const s=kind==='storage'?d:becHost(game,d),list=listPage('bec-contents:'+d.id,Object.entries(s?.becStorage?.contents??{}),4);
    body+=list.entries.map(([id,n])=>`<div class="settings-row">${icon(id)}<span>${e(name(id))}</span><strong>${num(n)} mB</strong></div>`).join('')||'<p class="muted">暂无凝聚态</p>';body+=list.controls;
  }else if(kind==='storage'){
    const strength=d.becStorage.strength;
    body+=`<p>场强 ${num(strength)} · 容量 ${num(strength)} mB · ${num(strength)} EU/t</p><div class="energy-actions">${button('strength',Math.max(1,Math.floor(strength/10)),'÷10')}${button('strength',Math.min(Math.floor(Number.MAX_SAFE_INTEGER/20),strength*10),'×10')}${button('strength',Math.max(1,Object.values(d.becStorage.contents).reduce((n,v)=>n+v,0)),'匹配存量')}</div><p class="small muted">超容量时所有凝聚态每秒衰减 10%。停止或缺电会散失全部存量。无关凝聚态会拖慢组装，超过三种时堵塞。</p>`;
  }else{
    const hosts=listPage('bec-hosts:'+d.id,game.state.devices.filter(h=>becKind(game,h)==='storage'),4),h=becHost(game,d);
    body+=`<p>${h?'已连接：'+e(deviceName(h))+' #'+h.id.slice(1):'请选择凝聚态存储器'}</p><div class="energy-actions">${hosts.entries.map(x=>button('host',x.id,icon(x.type)+e(deviceName(x))+' #'+x.id.slice(1))).join('')}${button('host','','断开')}</div>${hosts.controls}<p class="small muted">发生器和组装器通过选定存储器交换凝聚态；普通储罐不能储存。组装器随设备包含一个独立 I/O 节点。</p>`;
  }
  return `<h2>${e(deviceName(d))}</h2>${tabs}${body}`;
}
