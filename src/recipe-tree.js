import {outputRolls} from './core/recipe-yields.js';
import {planRecipe,planRoutes,planGatherNodes,planSupplyMachines,recipeMachines,planInFlight} from './core/production-plan.js';
import {machineSupportsRecipe} from './core/technology.js';

// Preview calculations run in a worker after explicit actions, never on the UI clock.
// The active plan refreshes text/progress in place without rebuilding the tree.
export function createRecipeTreeView(h){
  const {e,icon,name,num,listPage,rows,processName}=h;
  let rootId='',targetItem='',batches=1,choices={},preview=null,error='',view='tree',routeItem='',collapsed=new Set(),previewGame=null,previewStage=-1;
  let worker=null,request=0,loading=false,deadline=null;
  const game=()=>h.getGame();
  const method=r=>r.process==='craft'?'手工合成':r.process==='build'?'机器建造':processName(r.process);
  const unit=id=>game().catalog.items[id]?.kind==='fluid'?' mB':'';
  const busy=()=>{const p=game().state.productionPlan;return !!(p&&!p.cancelled&&p.steps.some(s=>s.done<s.batches)||planInFlight(game()));};
  const cannotStart=()=>loading||!preview||preview.incomplete||busy();
  const summary=()=>loading?'正在整理材料…':preview?`${preview.incomplete?'部分材料预览':'库存快照'} · 缺料 ${preview.missing.length} 项 · 工序 ${preview.steps.length} 道`:'';
  function updatePreview(){
    const panel=document.querySelector('.recipe-tree');
    if(!panel||panel.dataset.treeRoot!==rootId||panel.dataset.treeTarget!==targetItem)return;
    const body=panel.querySelector('[data-tree-content]');if(body)body.innerHTML=content();
    h.updateText(panel.querySelector('[data-tree-preview-summary]'),summary());
    h.updateDisabled(panel.querySelector('[data-tree-action="start"]'),cannotStart());
    h.refit();
  }
  function stopWorker(){if(worker){worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();worker=null;}clearTimeout(deadline);}
  function fail(message){
    stopWorker();loading=false;preview=null;error=message;updatePreview();
  }
  function calculate(){
    collapsed.clear();error='';preview=null;previewGame=game();previewStage=game().state.stage;
    if(loading)stopWorker();clearTimeout(deadline);
    const id=++request;loading=!!rootId;if(!rootId)return;
    try{
      if(!worker){
        worker=new Worker(new URL('./recipe-tree-worker.js',import.meta.url),{type:'module'});
        worker.onmessage=({data})=>{
          if(data.id!==request)return;
          clearTimeout(deadline);loading=false;preview=data.preview||null;error=data.error||'';updatePreview();
        };
        worker.onerror=event=>{event.preventDefault();fail('材料预览暂时无法计算，请点击「按当前库存重算」重试。');};
        worker.onmessageerror=()=>fail('材料预览读取失败，请重试。');
      }
      worker.postMessage({id,root:rootId,batches,choices,favorites:h.favorites(),state:game().state});
      deadline=setTimeout(()=>{if(id===request&&loading)fail('配方计算时间过长，请减少批数或更换路线后重试。');},15000);
    }catch{fail('材料预览暂时无法计算，请点击「按当前库存重算」重试。');}
  }
  function sourceCard(id,{node,machine},selectable=false){
    if(machine)return `<div class="tree-row"><span class="tree-item">${icon(machine.id)}<span><strong>${e(machine.name)}</strong><small>在工厂配置原料、供能和输出容器</small></span></span><button class="text-link" data-page="factory">前往工厂 →</button></div>`;
    const access=game().nodeAccess(node);
    return `<div class="tree-row"><span class="tree-item">${icon(id)}<span><strong>${e(node.name)}</strong><small>${e(access.available?'可以采集':'需要：'+access.missing.join('、'))}</small></span></span><div class="tree-route">${selectable&&access.available?`<button class="text-link" data-tree-choice="gather" data-tree-choice-item="${e(id)}" aria-pressed="${choices[id]==='gather'}">采用采集</button>`:''}<button class="text-link" data-resource-source="${e(node.id)}">查看采集地点 →</button></div></div>`;
  }
  function sourceRows(id){
    const entries=[...planGatherNodes(game(),id,false).map(node=>({node})),...planSupplyMachines(game(),id).map(machine=>({machine}))];
    const list=listPage('tree-sources',entries,rows(350,92));
    return `<div class="tree-rows" data-fit-list="tree-sources">${list.entries.map(entry=>sourceCard(id,entry)).join('')||'<p class="muted">没有收录此物品的制造或采集来源。可返回配方查看用途，或选择其他获取路线。</p>'}${list.controls}</div>`;
  }
  const tabs=()=>`<div class="subtabs tree-tabs">${[['tree','材料依赖'],['missing','底层缺料'],['steps','制作顺序'],['plan','当前计划']].map(([id,label])=>`<button class="filter ${view===id?'active':''}" data-tree-view="${id}" aria-pressed="${view===id}">${label}</button>`).join('')}</div>`;
  function activeHeader(){
    const p=game().state.productionPlan;if(!p)return '';
    const r=planRecipe(game(),p.root),total=p.steps.reduce((n,s)=>n+s.batches,0),done=p.steps.reduce((n,s)=>n+s.done,0),ended=p.cancelled||done===total;
    const controls=view==='plan'?`${!ended?`<button class="button" data-tree-action="pause">${p.paused?'继续计划':'暂停计划'}</button><button class="button" data-tree-action="cancel">取消计划</button>`:''}<button class="text-link" data-page="factory">工厂 →</button>`:'<button class="text-link" data-tree-view="plan">管理计划 →</button>';
    return `<div class="tree-plan-summary"><div><strong>${e(r?.name||'制作计划')} · ${p.batches} 批</strong><small data-plan-status role="status" aria-live="polite">${e(p.status)}</small></div><span data-plan-progress>${num(done)} / ${num(total)} 批</span><div class="tree-actions">${controls}</div></div>`;
  }
  function treeRows(){
    if(!preview)return '';
    const hasChild=new Set(preview.nodes.filter(n=>n.parent!==null).map(n=>n.parent)),hidden=new Set();
    const visible=preview.nodes.filter(n=>{if(n.parent!==null&&(hidden.has(n.parent)||collapsed.has(n.parent))){hidden.add(n.key);return false;}return true;});
    const list=listPage('recipe-tree',visible,rows(350,78));
    return `<div class="tree-rows" data-fit-list="recipe-tree" role="group" aria-label="配方材料依赖">${list.entries.map(n=>{
      const r=n.recipe&&planRecipe(game(),n.recipe),routes=planRoutes(game(),n.item),gathers=planGatherNodes(game(),n.item,false),supply=planSupplyMachines(game(),n.item);
      const routeCount=routes.length+(gathers.length?1:0),label=r?`${method(r)} · ${num(n.batches)} 批`:n.shortage>0?n.reason:'已有材料';
      const needs=r&&r.process!=='craft'&&r.process!=='build'&&!game().state.devices.some(d=>machineSupportsRecipe(game().catalog.machines[d.type],r));
      return `<div class="tree-row ${n.shortage>0&&!r?'tree-shortage':''}" style="--tree-depth:${Math.min(4,n.depth)}"><button class="tree-fold" data-tree-fold="${n.key}" aria-label="${collapsed.has(n.key)?'展开':'收起'}${e(name(n.item))}的材料" aria-expanded="${!collapsed.has(n.key)}" ${!hasChild.has(n.key)?'disabled':''}>${hasChild.has(n.key)?collapsed.has(n.key)?'＋':'−':'·'}</button><button class="tree-item" data-tree-open="${e(r?.id||'')}" data-tree-item="${e(n.item)}" title="查看${e(name(n.item))}配方 · 第 ${n.depth+1} 层">${icon(n.item)}<span><strong>${e(name(n.item))}${n.tool?' · 工具保留':''}</strong><small>${n.depth?'需求 '+num(n.amount)+unit(n.item)+' · 已有 '+num(n.have):preview.directOnly?'配方产出 · '+(n.amount?num(n.amount)+unit(n.item):'连续运行'):'本次制作 '+num(n.amount)+unit(n.item)}${n.shortage>0?' · 补足 '+num(n.shortage):''}</small></span></button><div class="tree-route"><span>${e(label)}</span>${needs?'<small>需要部署加工机器</small>':''}${n.depth&&n.shortage>0&&routeCount>1?`<button class="text-link" data-tree-routes="${e(n.item)}">更换路线 (${routeCount})</button>`:''}${gathers.length&&!r&&n.shortage>0?`<button class="text-link" data-tree-routes="${e(n.item)}">查看采集条件 →</button>`:''}${supply.length&&!r&&n.shortage>0?'<button class="text-link" data-page="factory">配置产能 →</button>':''}</div></div>`;
    }).join('')}${list.controls}</div>`;
  }
  function missingRows(){
    const list=listPage('tree-missing',preview?.missing||[],rows(350,78));
    return `<div class="tree-rows" data-fit-list="tree-missing">${list.entries.map(n=>{
      const gathers=planGatherNodes(game(),n.item,false),supply=planSupplyMachines(game(),n.item),source=gathers.length?gathers:supply;
      const action=supply.length&&!gathers.length?'data-page="factory"':`data-tree-routes="${e(n.item)}"`;
      return `<div class="tree-row"><button class="tree-item" data-tree-item="${e(n.item)}">${icon(n.item)}<span><strong>${e(name(n.item))}</strong><small>${e(n.reason)}${source.length?' · '+e(source.map(x=>x.name).join('、')):''}</small></span></button><b>缺 ${num(n.amount)}${unit(n.item)}</b><button class="text-link" ${action}>${gathers.length?'查看来源':supply.length?'配置产能':'选择路线'}</button></div>`;
    }).join('')||`<p class="muted">${preview.incomplete?'当前预览尚未展开全部材料，请先处理上方提示。':'底层原料已齐备，后续仍需工具、机器、供能和容器。'}</p>`}${list.controls}</div>`;
  }
  function stepRows(active=false){
    const p=game().state.productionPlan,steps=active?p?.steps:preview?.steps;
    if(!steps?.length)return `<p class="muted">${!active&&preview?.incomplete?'此配方暂不能生成完整制作顺序，请查看材料依赖和上方说明。':'还没有制作计划。在材料依赖中选择目标，点击「安排制作」。'}</p>`;
    const key=active?'tree-plan':'tree-steps',list=listPage(key,steps.map((s,index)=>({s,index})),rows(active?300:350,78));
    return `<div class="tree-rows" data-fit-list="${key}">${list.entries.map(({s,index})=>{
      const r=planRecipe(game(),s.recipe),item=Object.keys(r.outputs)[0],types=r.process==='craft'||r.process==='build'?[]:recipeMachines(game(),r);
      return `<div class="tree-row" ${active?`data-plan-step="${index}"`:''}><span class="tree-order">${index+1}</span><button class="tree-item" data-tree-open="${e(r.id)}" data-tree-item="${e(item)}">${icon(item)}<span><strong>${e(r.name)}</strong><small>${e(method(r))} · ${num(s.batches)} 批${types.length?' · '+e(types.map(m=>m.name).join(' / ')):''}</small></span></button><span ${active?'data-plan-step-count':''}>${active?num(s.done)+' / ':''}${num(s.batches)} 批</span>${active?`<span class="tree-step-state" data-plan-step-state>${s.done===s.batches?'完成':'待制作'}</span>`:''}</div>`;
    }).join('')}${list.controls}</div>`;
  }
  function routeRows(){
    const entries=[...planRoutes(game(),routeItem).map(recipe=>({recipe})),...planGatherNodes(game(),routeItem,false).map(node=>({node})),...planSupplyMachines(game(),routeItem).map(machine=>({machine}))];
    const list=listPage('tree-routes',entries,rows(450,92));
    return `<div class="tree-route-heading"><button class="button" data-tree-view="tree">‹ 返回材料树</button><strong>${icon(routeItem)}${e(name(routeItem))}的获取方式</strong></div><div class="tree-rows" data-fit-list="tree-routes">${list.entries.map(entry=>{
      const r=entry.recipe;if(!r)return sourceCard(routeItem,entry,true);
      return `<button class="tree-route-card ${choices[routeItem]===r.id?'active':''}" data-tree-choice="${e(r.id)}" data-tree-choice-item="${e(routeItem)}" aria-pressed="${choices[routeItem]===r.id}">${icon(routeItem)}<span><strong>${e(r.name)}</strong><small>${e(method(r))} · 每批 ${num(r.outputs[routeItem])}${unit(routeItem)} · ${e(Object.entries(r.inputs).map(([id,n])=>name(id)+' ×'+num(n)).join('、'))}</small></span></button>`;
    }).join('')||'<p class="muted">没有收录可用的加工、采集或产能设备来源。</p>'}${list.controls}</div>`;
  }
  function content(){
    if(view==='plan')return stepRows(true);
    if(view==='routes')return routeRows();
    if(!rootId)return sourceRows(targetItem);
    if(loading)return '<p class="muted" role="status" aria-live="polite">正在整理材料依赖，可随时切换页面或目标…</p>';
    if(!preview)return `<p class="notice" role="status">${e(error||'没有可显示的配方信息，请重新选择目标。')}</p>`;
    const notice=preview.incomplete?`<p class="notice" role="status">${e(preview.blockedReason)}${preview.directOnly?'。下方保留本配方的直接材料需求。':'。下方保留已展开的材料，尚不能安排完整计划。'} <button class="text-link" data-page="factory">前往工厂 →</button></p>`:'';
    return notice+(view==='missing'?missingRows():view==='steps'?stepRows():treeRows());
  }
  function render(r,item=''){
    if((r?.id||'')!==rootId||item!==targetItem||game()!==previewGame){rootId=r?.id||'';targetItem=item;batches=1;choices={};view='tree';calculate();}
    else if(previewStage!==game().state.stage)calculate();
    const header=r?`<div class="tree-target"><div>${icon(Object.keys(r.outputs)[0]||'workbench')}<span><h2>${e(r.name)}</h2><small>${outputRolls(r).some(s=>s.chance<10000)?'按批次制作，概率产物数量不保证。':'制作指定批次；原料扣除库存，工具不消耗。'}</small></span></div><div class="tree-quantity"><button class="button" data-tree-quantity="-1" aria-label="减少一批" ${batches<=1?'disabled':''}>−</button><label><input type="number" min="1" max="999" step="1" value="${batches}" data-tree-amount aria-label="目标制作批数"> 批</label><button class="button" data-tree-quantity="1" aria-label="增加一批" ${batches>=999?'disabled':''}>＋</button></div></div>`:`<div class="tree-target"><div>${icon(targetItem)}<span><h2>${e(name(targetItem))}</h2><small>获取来源与所需条件</small></span></div></div>`;
    const action=`<div class="tree-actions"><button class="button" data-tree-action="refresh" ${!r?'disabled':''}>按当前库存重算</button><button class="button primary" data-tree-action="start" ${cannotStart()?'disabled':''}>安排制作</button><small data-tree-preview-summary>${summary()}</small></div>`;
    return `<section class="surface recipe-tree" data-tree-root="${e(rootId)}" data-tree-target="${e(targetItem)}">${activeHeader()}${view==='plan'?'':header+action}${tabs()}<div data-tree-content>${content()}</div><p class="tree-note">缺料时等待，机器沿用现有供能与容器。暂停或取消后，已投料的当前批次继续完成。</p></section>`;
  }
  function refresh(){
    const p=game().state.productionPlan;if(!p||!document.querySelector('.recipe-tree'))return;
    h.updateText(document.querySelector('[data-plan-status]'),p.status);
    h.updateText(document.querySelector('[data-plan-progress]'),`${num(p.steps.reduce((n,s)=>n+s.done,0))} / ${num(p.steps.reduce((n,s)=>n+s.batches,0))} 批`);
    const first=p.steps.findIndex(s=>s.done<s.batches);
    document.querySelectorAll('[data-plan-step]').forEach(row=>{
      const at=Number(row.dataset.planStep),s=p.steps[at];if(!s)return;
      h.updateText(row.querySelector('[data-plan-step-count]'),`${num(s.done)} / ${num(s.batches)} 批`);
      h.updateText(row.querySelector('[data-plan-step-state]'),s.done===s.batches?'完成':at===first?p.cancelled?'已取消':p.paused?'暂停':'当前':'待制作');
    });
    const done=p.steps.every(s=>s.done===s.batches)||p.cancelled,start=document.querySelector('[data-tree-action="start"]');
    if(start)h.updateDisabled(start,cannotStart());
    for(const action of ['pause','cancel']){const button=document.querySelector(`[data-tree-action="${action}"]`);h.updateDisabled(button,done);if(button&&action==='pause')h.updateText(button,p.paused?'继续计划':'暂停计划');}
  }
  function click(t){
    if(t.dataset.treeView){view=t.dataset.treeView;h.render();return true;}
    if(t.dataset.treeFold){const k=t.dataset.treeFold;collapsed.has(k)?collapsed.delete(k):collapsed.add(k);h.render();return true;}
    if(t.dataset.treeQuantity){batches=Math.max(1,Math.min(999,batches+Number(t.dataset.treeQuantity)));calculate();h.render();return true;}
    if(t.dataset.treeRoutes){routeItem=t.dataset.treeRoutes;view='routes';h.render();return true;}
    if(t.dataset.treeChoice){choices[t.dataset.treeChoiceItem]=t.dataset.treeChoice;calculate();view='tree';h.render();return true;}
    if(t.dataset.treeItem){h.open(t.dataset.treeItem,t.dataset.treeOpen);return true;}
    if(t.dataset.treeAction){
      const action=t.dataset.treeAction;
      if(action==='refresh'){calculate();h.render();}
      if(action==='start'){
        if(cannotStart())return true;
        const out=game().arrangeProduction(rootId,batches,choices,h.favorites());
        if(out.ok)view='plan';h.result(out,out.ok?'已安排制作，缺料时会等待':'');
      }
      if(action==='pause')h.result(game().pauseProduction());
      if(action==='cancel')h.result(game().cancelProduction(),'已取消后续工序，当前已投料批次继续完成');
      return true;
    }
    return false;
  }
  function change(t){
    if(!t.hasAttribute('data-tree-amount'))return false;
    const n=Number(t.value);
    if(!Number.isInteger(n)||n<1||n>999){h.notify('请输入 1–999 的整数批数');t.value=batches;return true;}
    batches=n;calculate();
    // Keep the target controls mounted when an input loses focus to a button,
    // so that the user's first click on Arrange / Refresh is not discarded.
    h.updateDisabled(document.querySelector('[data-tree-quantity="-1"]'),batches<=1);
    h.updateDisabled(document.querySelector('[data-tree-quantity="1"]'),batches>=999);
    updatePreview();return true;
  }
  return {render,refresh,click,change};
}
