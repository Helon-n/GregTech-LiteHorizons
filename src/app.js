import {configureGroupEditor,openGroupEditor} from './group-editor.js';
import {enhanceChoices,syncChoices,closeChoices,setChoiceResolver} from './choices.js';
import {applyTier,tierFor,readAppearance,saveAppearance} from './tier-theme.js';
import {appearanceMarkup,mountAppearance} from './tier-appearance.js';
import {updateText,updateDisabled,updateAttribute,updatePercent} from './live-view.js';
import {deviceReadout,updateDeviceReadout} from './device-readout.js';
import {Game,OFFLINE_LIMIT} from './core/engine.js';
import {energySpec,energyCapacity,voltage,generatorFuel,carrier,batteryItem} from './core/energy.js';
import {ENERGY_REFERENCE as ENERGY,recipeEnergyText} from './data/energy-reference.js';
import {loadWorld,saveWorld,exportWorld,replaceWorld} from './core/storage.js';
import {CATALOG,STAGES,items,recipes,machines,gatherNodes,containerTypes} from './data/catalog.js';
import {craftingGrid} from './core/workbench.js';
import {recipeEntries,recipesForItem,productName} from './core/recipe-browser.js';
import {fitRows,planGrid,gridStyle,fitPageLimits} from './layout.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>{n=Math.floor(n||0);return n>=1e12?(n/1e12).toFixed(1)+'T':n>=1e9?(n/1e9).toFixed(1)+'G':n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(1)+'k':n.toLocaleString('zh-CN');};
const time=s=>s<60?Math.ceil(s)+' 秒':s<3600?Math.floor(s/60)+' 分 '+Math.floor(s%60)+' 秒':(s/3600).toFixed(1)+' 小时';
const name=id=>items[id]?.name||id;
const titleMap={overview:'基地总览',resources:'资源采集',workshop:'配方与工作台',factory:'生产工厂',inventory:'物品仓库',research:'科技主线',space:'星际远征',settings:'存档与设置'};
let {game,recovered}=loadWorld();
const deviceName=d=>d.alias||machines[d.type].name;
let choiceEntities=new Map(),choiceDevices=null,choiceContainers=null,choiceGroups=null,choiceDeviceCount=-1,choiceContainerCount=-1;
function syncChoiceEntities(){
  const {devices,containers,groups}=game.state;
  if(!groups.length&&choiceGroups===groups&&choiceDevices===devices&&choiceContainers===containers&&choiceDeviceCount===devices.length&&choiceContainerCount===containers.length)return;
  choiceDevices=devices;choiceContainers=containers;choiceGroups=groups;choiceDeviceCount=devices.length;choiceContainerCount=containers.length;
  choiceEntities=new Map([...devices,...containers,...game.deviceEntries().filter(d=>d.group),...game.containerEntries().filter(c=>c.group)].map(x=>[x.id,x]));
}
setChoiceResolver(id=>{
  const entity=choiceEntities.get(id);if(!entity)return null;
  if(containerTypes[entity.type])return {icon:entity.fluid||entity.type,label:`${entity.group?entity.name+'（'+entity.group.members.length+' 个容器）':name(entity.type)+' #'+id.slice(1)} · ${entity.fluid?name(entity.fluid):'空容器'}`,meta:`${num(entity.amount)} / ${num(game.containerCapacity(entity))} mB${entity.fluid&&!entity.amount?' · 已限定流体':''}`};
  return {icon:entity.type,label:`${deviceName(entity)}${entity.group?'（'+entity.group.members.length+' 台）':' #'+id.slice(1)}`,meta:`${entity.alias?machines[entity.type].name+' · ':''}${ENERGY.codes[entity.energyTier]}${energySpec(game,entity)?.kind==='battery'?` · ${num(entity.eu)} / ${num(energyCapacity(game,entity))} EU · ${entity.batteries}/${4*(entity.group?.members.length||1)} 节电池`:''}`};
});
configureGroupEditor({getGame:()=>game,onSaved:r=>result(r,'分组设置已保存'),notify});
let page='overview',workshopTab='craft',filter='',queueSignature='',factoryType='',inventoryTab='items';
const listPages={},nodeViews={},deviceViews={};
const containerPlaceCounts={};
const containerPlaceLimit=id=>Math.max(0,Math.min(Math.floor(game.quantity(id)),10000-game.state.containers.length));
const containerPlaceCount=id=>Math.max(1,Math.min(containerPlaceCounts[id]||1,containerPlaceLimit(id)));
let overviewTab='main',benchView='recipe',containerView='placed';
let appearanceOpen=false,appearanceCode='',appearanceView='ladder',appearanceEraPage=0;
let appearanceMode=readAppearance(localStorage);
function syncTheme(){const tier=applyTier(document.documentElement,appearanceMode||game.stage.code);updateAttribute($('meta[name="theme-color"]'),'content',tier.background);}
function appearance(){
  const preview=`<div data-preview-part="energy">${energyPanel()}</div><div data-preview-part="production">${panel('生产现场',`${game.state.devices.length} 台机器`,deviceSummary())}</div>`;
  return heading('电压外观','<button class="button" data-appearance-close>返回设置</button>')+appearanceMarkup(preview);
}
function initAppearance(){
  mountAppearance($('#tierAppearance'),{selected:appearanceCode||appearanceMode||tierFor(game.stage.code).code,mode:appearanceMode,
    view:appearanceView,eraPage:appearanceEraPage,onView:value=>appearanceView=value,onEraPage:value=>appearanceEraPage=value,
    onSelect:code=>appearanceCode=code,onUse:code=>setAppearance(code),onAuto:()=>setAppearance(null)});
}
function setAppearance(code){
  appearanceMode=code;
  if(!code){appearanceCode=tierFor(game.stage.code).code;appearanceEraPage=tierFor(appearanceCode).era;}
  const saved=saveAppearance(localStorage,code);syncTheme();
  const focused=document.activeElement?.hasAttribute('data-tier-auto')?'[data-tier-auto]':'[data-tier-use]';
  render();$(focused)?.focus({preventScroll:true});
  notify((code?'已使用 '+code+' 外观':'外观将随科技阶段变化')+(saved?'':'；本次有效，设置未能保存'));
}
let viewport={width:0,height:0};
const gridPlans=new Map();
const gridRowLimits=new Map(),listSizeLimits=new Map(),listSizes=new Map();
let listAnchors=new Map(),layoutContext='';
function rows(reserved,height){return fitRows(viewport.height,reserved,height);}
function gridPlan(key,reserved=100,width=viewport.width){
  const plan=planGrid(key,{width,height:viewport.height},reserved);
  plan.rows=Math.min(plan.rows,gridRowLimits.get(key)??Infinity);plan.size=plan.columns*plan.rows;
  gridPlans.set(key,plan);return plan;
}
function gridAttrs(key){return `data-fit-grid="${key}" style="${gridStyle(gridPlans.get(key))}"`;}
const expandedDeviceStacks=new Set();
const selectedRecipes={craft:'sticks',machines:'build:workbench',recipes:'bricks'};
let filledRecipe='',lastDrops=null,recipeMode='recipes',hoveredItem='',containerSignature='';
const selectedItems={craft:'stick',machines:'workbench',recipes:'brick'};
const recipeName=r=>productName(CATALOG,r);
const icon=(id,large=false)=>`<span data-item="${id}" class="item-art ${large?'large':''}"><img src="assets/gtnh/${items[id]?.icon||id}.svg" alt="" draggable="false"></span>`;
const qty=id=>`<span data-qty="${id}">${num(game.quantity(id))}</span>`;
const heading=(title,action='')=>`<div class="heading"><h1>${title}</h1>${action?`<div class="heading-actions">${action}</div>`:''}</div>`;
const panel=(title,sub,body,cls='')=>`<section class="surface section ${cls}"><div class="section-head"><h3>${title}</h3><span>${sub}</span></div>${body}</section>`;
const stacks=(obj,live=true)=>`<div class="stacks">${Object.entries(obj).filter(([,n])=>n>0).map(([id,n])=>`<span class="ingredient ${game.quantity(id)>=n?'enough':''}" ${live?`data-ingredient="${id}" data-need="${n}"`:''} title="${e(name(id))}">${icon(id)}<span>${e(name(id))}</span><b>${num(n)}${items[id]?.kind==='fluid'?' mB':''}</b></span>`).join('')||'<span class="muted">向连接设备供能</span>'}</div>`;
const progress=(value,attrs='')=>`<div class="progress"><div ${attrs} style="width:${Math.min(100,Math.max(0,value))}%"></div></div>`;
const empty=(text,action='')=>`<div class="empty"><div class="empty-symbol">${icon('ui-inventory')}</div><p>${text}</p>${action}</div>`;
function notify(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('visible'),2800);}
function result(r,success=''){if(!r.ok)notify(r.message);else if(r.message||success)notify(r.message||success);persist();render();}
function persist(){const ok=saveWorld(game);$('#saveStatus').textContent='v'+$('#saveStatus').dataset.version+' · '+(ok?'已保存 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'保存失败 · 请导出备份');$('.save-dot').classList.toggle('failed',!ok);}
function goalRows(limit=viewport.height<750?3:5){const list=listPage('goals',game.milestoneProgress(),limit);return '<div data-fit-list="goals">'+list.entries.map(x=>`<div class="goal-row"><span>${icon(x.id)}${e(name(x.id))}</span><strong data-goal="${x.id}" data-need="${x.need}">${num(Math.min(x.have,x.need))} / ${num(x.need)}</strong></div>`).join('')+list.controls+'</div>';}

function energyPanel(){return panel('设备总电量','EU',`<div class="energy-total"><strong data-energy>${num(game.state.energy)}</strong><small>/ ${num(game.capacity())} EU</small></div>${progress(game.capacity()?game.state.energy/game.capacity()*100:0,'data-energy-bar')}<p class="muted small">电量保存在发电机、机器与已装电池的电池箱中。${game.state.legacyEnergy?'旧版待转存 '+num(game.state.legacyEnergy)+' EU；可在电池箱中转存。':''}</p>`);}
function mainlinePanel(limit){return panel('主线目标',game.stage.code,`<div class="current-goal"><h3>${game.state.completed?'星门已建成':game.stage.name}</h3><p>累计获得即可完成，无需上交。</p></div>${goalRows(limit)}${progress(goalPct(),'data-goal-bar')}<div class="progress-label"><span>章节进度</span><span data-goal-pct>${Math.floor(goalPct())}%</span></div><button class="button primary full" data-action="advance" ${game.canAdvance()?'':'disabled'}>${game.state.stage===15?'完成星门工程':'进入下一章节'} →</button>`);}
function warehouseOverview(limit=8){
  const stock=Object.values(items).filter(x=>x.kind!=='fluid'&&game.quantity(x.id)>0);
  const ids=stock.length?stock.slice(0,limit).map(x=>x.id):['wood','stone','clay','coal'];
  return panel('仓库速览',`${stock.length} 种物品`,`<div class="dashboard-stock">${ids.map(id=>`<button class="stock-tile" data-lookup-item="${id}" title="${e(name(id))} · 查看配方">${icon(id)}<span>${e(name(id))}</span><strong>${qty(id)}</strong></button>`).join('')}</div><button class="text-link" data-page="inventory">查看全部物品 →</button>`,'warehouse-overview');
}
function productionOverview(limit=3){return panel('生产现场',`${game.state.devices.length} 台机器`,deviceSummary(limit,'dashboard-production'),'production-overview');}
function overview(){
  const stage=game.stage,total=game.state.devices.length;
  const roomy=viewport.width>=1000&&viewport.height>=900,wide=roomy&&viewport.width>=1700;
  if(roomy&&overviewTab==='storage')overviewTab='main';
  const tabs=`<div class="subtabs screen-tabs">${(roomy?[['main','基地看板'],['log','工业日志']]:[['main','主线总览'],['storage','仓库与生产'],['log','工业日志']]).map(([id,label])=>`<button class="filter ${overviewTab===id?'active':''}" data-overview-tab="${id}">${label}</button>`).join('')}</div>`;
  let content;
  if(overviewTab==='main'){
    const productionLimit=wide?Math.min(8,Math.max(3,Math.floor((viewport.height-480)/58))):3;
    const summary=`<div class="dashboard-summary"><section class="surface hero"><div class="hero-copy"><div class="eyebrow">第 ${game.state.stage+1} / 16 章</div><h2>${e(stage.name)} <span>${stage.code}</span></h2><p>${e(stage.description)}</p></div><div class="factory-illustration" aria-hidden="true"><i class="tower t1"></i><i class="tower t2"></i><i class="tower t3"></i><i class="plant"></i><i class="pipe"></i></div></section><div class="metric-grid"><div class="surface metric"><span>已建设备</span><strong data-device-count>${total}<small> 台</small></strong></div><div class="surface metric"><span>累计产出</span><strong data-produced>${num(game.state.produced)}</strong></div><div class="surface metric"><span>世界运行时间</span><strong data-playtime>${time(game.state.playtime)}</strong></div></div>${energyPanel()}</div>`;
    const recent=game.state.log.slice(0,viewport.height>=1050?6:3);
    const activity=panel('工业日志','最近动态',`<div class="dashboard-events">${recent.map(x=>`<p>${e(x.text)}</p>`).join('')||'<p class="muted">暂无记录</p>'}</div><button class="text-link" data-overview-tab="log">查看全部记录 →</button>`,'dashboard-activity');
    content=`<div class="base-dashboard ${wide?'wide':''}"><div class="dashboard-top">${summary}${mainlinePanel(wide?5:3)}${wide?productionOverview(productionLimit):''}</div>${roomy?`<div class="dashboard-bottom">${warehouseOverview(wide?viewport.height>=1050?18:12:6)}${wide?activity:productionOverview(productionLimit)}</div>`:''}</div>`;
  }
  else if(overviewTab==='storage')content=`<div class="overview-grid">${warehouseOverview()}${productionOverview()}</div>`;
  else{const list=listPage('log',game.state.log,rows(150,62));content=`<section class="surface section log-panel"><div class="activity-log" data-fit-list="log">${list.entries.map(x=>`<div><i></i><span>${e(x.text)}</span></div>`).join('')||'<p class="muted">暂无记录</p>'}</div>${list.controls}</section>`;}
  return heading('基地总览')+tabs+content;
}

function goalPct(){const a=game.milestoneProgress();return a.reduce((v,x)=>v+Math.min(1,x.have/x.need),0)/a.length*100;}
function resourceArt(n){return icon(n.output,true);}
function gatherVerb(n){return n.id==='forest'?'砍伐':n.id==='river'?'收集':'开采';}
function dropRanges(node){return '<div class="stacks">'+Object.entries(game.dropRanges(node)).map(([id,{min,max}])=>`<span class="ingredient" title="${e(name(id))}">${icon(id)}<span>${e(name(id))}</span><b>${min===max?num(min):num(min)+'–'+num(max)}${items[id].kind==='fluid'?' mB':''}</b></span>`).join('')+'</div>';}
function collectorControls(n){
  const c=game.state.collectors[n.id];if(!c)return '';
  const workers=c.activeCount??c.count;
  return `<div class="collector-controls"><div class="worker-control"><span>同时工作 <small>/ 共 ${c.count} 台</small></span><div class="worker-stepper"><button class="button" data-worker-node="${n.id}" data-worker-count="${workers-1}" aria-label="减少工作台数" ${workers<=1?'disabled':''}>−</button><strong>${workers} 台</strong><button class="button" data-worker-node="${n.id}" data-worker-count="${workers+1}" aria-label="增加工作台数" ${workers>=c.count?'disabled':''}>＋</button><button class="button" data-worker-node="${n.id}" data-worker-count="${c.count}" ${workers===c.count?'disabled':''}>全部</button></div></div><div class="progress-label"><span>每台 ${n.seconds*4} 秒 / 轮</span><span data-auto="${n.id}"></span></div>${progress(c.elapsed/(n.seconds*4)*100,`data-collector-progress="${n.id}"`)}<button class="button full" data-toggle-collector="${n.id}">${c.enabled===false?'恢复采集':'停止采集'}</button></div>`;
}
function nodeCard(n){
  const allowed=game.nodeAvailable(n),auto=game.state.collectors[n.id]?.count||0,clicks=game.state.gatherProgress[n.id]||0,total=game.gatherClicks(n),automatic=nodeViews[n.id]==='auto';
  return `<article class="surface resource-card ${automatic?'automatic':''} ${allowed?'':'locked'}" data-node="${n.id}"><div class="pool-top"><h3>${n.name}</h3><span class="pill" data-collector-badge="${n.id}">${auto?'自动 ×'+(game.state.collectors[n.id].enabled===false?0:game.state.collectors[n.id].activeCount??auto):STAGES[n.stage].code}</span></div><div class="subtabs resource-tabs"><button class="filter ${automatic?'':'active'}" data-node-view="manual" data-node-id="${n.id}">手动采集</button><button class="filter ${automatic?'active':''}" data-node-view="auto" data-node-id="${n.id}">自动采集</button></div>${automatic?'':`<div class="gather-scene"><button class="resource-scene gather-target" data-gather-hit="${n.id}" aria-label="${gatherVerb(n)}${n.name}" ${!allowed?'disabled':''}>${resourceArt(n)}<span class="scene-grid"></span><span class="scene-hint">点击${gatherVerb(n)}</span></button><div class="drop-layer" data-drop-layer="${n.id}" aria-hidden="true"></div></div>`}<div class="pool-body"><div class="resource-title"><span>${e(n.description)}</span><strong>${qty(n.output)}${items[n.output].kind==='fluid'?'<small> mB</small>':''}</strong></div>${automatic?`${collectorControls(n)||'<p class="muted">尚未部署采集器</p>'}<div class="collector-deploy"><div class="collector-cost">部署消耗 ${stacks(game.collectorCost(n))}</div><button class="button" data-collector="${n.id}" ${!allowed?'disabled':''}>部署 +</button></div>`:`${progress(clicks/total*100,`data-gather-progress="${n.id}"`)}<div class="progress-label"><span data-click-progress="${n.id}">${clicks} / ${total} 次点击</span></div><button class="button primary full" data-gather="${n.id}" ${!allowed?'disabled':''}>${gatherVerb(n)} · +${Math.round(100/total)}%</button>`}<div class="node-drops"><small>每轮掉落范围</small>${dropRanges(n)}</div></div></article>`;
}

function dropSummary(){return lastDrops?`<p class="small muted">${gatherNodes.find(n=>n.id===lastDrops.id).name} · 物品入库，流体装入容器</p>${Object.keys(lastDrops.drops).length?stacks(lastDrops.drops,false):'<p class="small muted">本轮未收集到物品</p>'}${Object.keys(lastDrops.skipped||{}).length?'<p class="small storage-warning">未收集：'+Object.keys(lastDrops.skipped).map(name).join('、')+'，需要兼容的空桶或储罐容量。</p>':''}`:'<p class="small muted">暂无掉落</p>';}
function listPage(key,list,size){
  size=Math.max(1,Math.min(size,listSizeLimits.get(key)??Infinity));
  const previous=listSizes.get(key);
  if(previous&&previous!==size)listPages[key]=Math.floor((listAnchors.get(key)??(listPages[key]||0)*previous)/size);
  listSizes.set(key,size);
  const compact=['book','goals'].includes(key);
  const count=Math.max(1,Math.ceil(list.length/size));
  const index=listPages[key]=Math.max(0,Math.min(listPages[key]||0,count-1));
  const button=(target,label,disabled=false)=>`<button class="button ${target===index?'current':''}" data-list-page="${key}" data-list-index="${target}" ${disabled?'disabled':''} ${target===index?'aria-current="page"':''}>${label}</button>`;
  const indexes=[...new Set([0,...Array.from({length:5},(_,i)=>index+i-2).filter(i=>i>=0&&i<count),count-1])].sort((a,b)=>a-b);
  const numbers=compact?'':indexes.map((i,at)=>(at&&i-indexes[at-1]>1?'<span class="page-gap">…</span>':'')+button(i,i+1)).join('');
  const controls=count<2?'':`<nav class="list-pagination ${compact?'compact':''}" data-pagination="${key}" aria-label="${key==='book'?'物品列表':key==='goals'?'主线目标':'列表'}翻页">${button(index-1,compact?'‹':'上一页',index===0)}${numbers}<span class="page-count">${index+1} / ${count}</span>${button(index+1,compact?'›':'下一页',index===count-1)}</nav>`;
  return {entries:list.slice(index*size,(index+1)*size),controls};
}
function resourcesPage(){const plan=gridPlan('resources'),list=listPage('resources',gatherNodes.filter(n=>n.stage<5&&n.stage<=game.state.stage+1),plan.size);return heading('资源采集','<button class="button" data-show-drops>最近掉落</button>')+`<div class="resource-cards fitted-cards" ${gridAttrs('resources')}>${list.entries.map(nodeCard).join('')}</div>${list.controls}`;}

function processName(p){return Object.values(machines).find(m=>m.processes.includes(p))?.name||p;}
function workshopEntries(){
  const all=recipeEntries(CATALOG,game.state.stage);
  return workshopTab==='machines'?all.filter(r=>r.process==='build'):workshopTab==='craft'?all.filter(r=>r.process==='craft'):all;
}
function currentRecipes(){return recipesForItem(workshopEntries(),selectedItems[workshopTab],recipeMode);}
function selectedEntry(){return currentRecipes().find(r=>r.id===selectedRecipes[workshopTab])||currentRecipes()[0];}
function lookupItem(id,mode='recipes'){
  if(!items[id])return;
  benchView='recipe';workshopTab='recipes';recipeMode=mode;selectedItems.recipes=id;selectedRecipes.recipes='';filledRecipe='';filter='';
  page='workshop';listPages.book=0;render();
}
function recipeTile(id){return `<button class="book-item ${id===selectedItems[workshopTab]?'selected':''}" data-book-item="${id}" aria-pressed="${id===selectedItems[workshopTab]}" title="${e(name(id))} · R 配方 / U 用途">${icon(id)}<span>${e(name(id))}</span></button>`;}
function benchSlot(id,count,output=false){
  const unit=items[id]?.kind==='fluid'?' mB':'';
  return `<button class="bench-slot ${output?'output-slot':''} ${items[id]?.kind==='fluid'?'fluid-slot':''}" data-lookup-item="${id}" aria-label="${e(name(id))} × ${count}${unit}" ${!output?`data-slot-item="${id}" data-slot-total="${selectedEntry().inputs[id]}"`:''} title="${e(name(id))} × ${count}${unit} · 点击查看配方，右键查看用途">${icon(id)}<b>${num(count)}${unit}</b></button>`;
}
function dispatchControls(r){
  const types=Object.values(machines).filter(m=>m.stage<=game.state.stage&&m.processes.includes(r.process));
  const free=game.deviceEntries().filter(d=>!d.recipe&&!d.job&&!d.hasTask&&types.some(m=>m.id===d.type));
  return `<div class="dispatch-panel"><h3>工厂派工</h3>${free.length?`<label class="select-label">空闲设备<select data-dispatch-target="${r.id}">${free.map(d=>`<option value="${d.id}" data-icon="${d.type}">${e(deviceName(d))} #${d.id.slice(1)}</option>`).join('')}</select></label><button class="button primary" data-dispatch="${r.id}">派工到工厂</button>`:types.length?`<p class="muted small">没有空闲的${types.map(m=>m.name).join('、')}。</p><button class="button" data-build-for="${types[0].id}">建造${types[0].name}</button>`:'<p class="muted small">当前阶段没有可执行此配方的设备。</p>'}<button class="text-link" data-page="factory">查看工厂 →</button></div>`;
}
function workbench(r){
  if(!r){const id=selectedItems[workshopTab],nodes=gatherNodes.filter(n=>game.nodeAvailable(n)&&Object.hasOwn(game.drops(n),id));return `<section class="surface workbench"><h2>${e(name(id))}</h2>${empty(recipeMode==='uses'?'当前阶段没有已解锁的用途。':nodes.length?'获取地点：'+nodes.map(n=>n.name).join('、'):'当前阶段没有已解锁的配方。',nodes.length?'<button class="button" data-page="resources">前往采集 →</button>':'')}</section>`;}
  const manual=r.process==='craft',build=r.process==='build',filled=filledRecipe===r.id,alternatives=currentRecipes(),index=alternatives.findIndex(x=>x.id===r.id);
  return `<section class="surface workbench" data-bench-recipe="${r.id}"><div class="nei-recipe-nav"><button class="button" data-recipe-step="-1" ${alternatives.length<2?'disabled':''} aria-label="上一配方">‹</button><span>${recipeMode==='uses'?'用途':'配方'} ${index+1} / ${alternatives.length}</span><button class="button" data-recipe-step="1" ${alternatives.length<2?'disabled':''} aria-label="下一配方">›</button></div><div class="bench-heading"><div><h2>${e(recipeName(r))}</h2></div><span class="pill">${manual?'工作台':build?'机器建造':processName(r.process)}</span></div><div class="bench-meta recipe-facts"><span><b>解锁阶段</b><strong>${STAGES[r.stage].code}</strong></span><span><b>加工方式</b><strong>${manual?'工作台手工':build?'机器建造':e(processName(r.process))}</strong></span><span><b>耗能</b><strong>${e(recipeEnergyText(r))}</strong></span>${r.circuit?`<span><b>设备设定</b><strong>编程电路 ${r.circuit} · 不消耗</strong></span>`:''}</div><div class="bench-layout ${filled?'filled':'ghost'}" style="--input-columns:${Math.max(1,Math.min(3,Object.keys(r.inputs).length))};--output-columns:${Math.max(1,Math.min(2,Object.keys(r.outputs).length))}"><div class="${manual||build?'bench-grid':'process-slots'}" role="group" aria-label="${manual||build?'九宫格原料配方':'机器投入原料'}">${(manual||build?craftingGrid(r.id,r.inputs):Object.entries(r.inputs).map(([id,count])=>({id,count}))).map(slot=>slot?benchSlot(slot.id,slot.count):'<div class="bench-slot vacant" aria-hidden="true"></div>').join('')}</div><span class="bench-arrow" aria-hidden="true">➜</span><div class="bench-outputs" aria-label="产物">${Object.entries(r.outputs).map(([id,count])=>benchSlot(id,count,true)).join('')||`<div class="bench-slot output-slot">${icon('turbine')}<span>向连接设备供能</span></div>`}</div></div>${r.tools?`<div class="bench-tools"><span>工具 · 保留</span>${stacks(r.tools)}</div>`:''}<p class="bench-status" data-bench-status role="status"></p><div class="bench-actions">${manual||build?`<button class="button" data-fill="${r.id}">${filled?'重新放入材料':'放入材料'}</button>${manual?`<button class="button" data-craft="${r.id}" data-count="5">合成 ×5 批</button><button class="button primary" data-craft="${r.id}" data-count="1">合成</button>`:`<button class="button primary" data-build="${r.machine}">建造</button>`}`:''}</div></section>`;
}
function roomyWorkbench(){return viewport.width>=1350&&viewport.height>=900;}
function recipeMaterials(r){
  const list=listPage('recipe-materials',Object.entries(r.inputs),3);
  return panel('每批原料','库存 / 需求',`<div class="recipe-materials">${list.entries.map(([id,count])=>`<button class="recipe-material" data-lookup-item="${id}" data-slot-item="${id}" data-slot-total="${count}" title="${e(name(id))} · 查看配方">${icon(id)}<span><strong>${e(name(id))}</strong><small>${qty(id)} / ${num(count)}${items[id]?.kind==='fluid'?' mB':''}</small></span></button>`).join('')}</div>${list.controls}`,'recipe-material-panel');
}
function workshop(){
  const all=workshopEntries(),query=filter.toLowerCase(),ids=[...new Set(all.flatMap(r=>Object.keys(recipeMode==='uses'?{...r.inputs,...r.tools}:r.outputs)))];
  if(!selectedItems[workshopTab])selectedItems[workshopTab]=ids[0];
  const selected=selectedEntry();if(selected)selectedRecipes[workshopTab]=selected.id;
  const canDispatch=!!selected&&selected.process!=='build';
  if(benchView==='dispatch'&&!canDispatch)benchView='recipe';
  const bookWidth=Math.min(410,Math.max(262,viewport.width*.24)),bookPlan=gridPlan('book',220,bookWidth-26);
  const visible=ids.filter(id=>!query||(name(id)+' '+id).toLowerCase().includes(query)),list=listPage('book',visible,bookPlan.size);
  const switches=`<div class="subtabs bench-switch">${[['recipe','配方'],...(canDispatch?[['dispatch','工厂派工']]:[]),['queue',`手工队列 <span data-queue-count>${game.state.queue.length}</span>`]].map(([id,label])=>`<button class="filter ${benchView===id?'active':''}" data-bench-view="${id}">${label}</button>`).join('')}</div>`;
  const roomy=roomyWorkbench()&&benchView==='recipe'&&selected;
  const recipeDetail=roomy?`<div class="bench-content"><div class="bench-primary">${workbench(selected)}${panel('手工队列','',`<div id="queuePanel">${queuePanel()}</div>`)}</div><aside class="bench-rail">${recipeMaterials(selected)}${canDispatch?`<section class="surface section">${dispatchControls(selected)}</section>`:''}</aside></div>`:workbench(selected);
  const detail=benchView==='queue'?panel('手工队列','',`<div id="queuePanel">${queuePanel()}</div>`):benchView==='dispatch'&&canDispatch?`<section class="surface workbench"><h2>${e(recipeName(selected))}</h2>${dispatchControls(selected)}</section>`:recipeDetail;
  return heading('配方与工作台',`<input class="search" id="search" placeholder="搜索物品" value="${e(filter)}">`)+`<div class="subtabs workshop-tabs">${[['craft','工作台'],['machines','机器建造'],['recipes','全部配方']].map(([id,label])=>`<button class="filter ${workshopTab===id?'active':''}" data-tab="${id}">${label}</button>`).join('')}<span class="nei-tab-spacer"></span><button class="filter ${recipeMode==='recipes'?'active':''}" data-recipe-mode="recipes">获取配方 R</button><button class="filter ${recipeMode==='uses'?'active':''}" data-recipe-mode="uses">用途 U</button></div><div class="workshop-layout" style="--book-width:${bookWidth}px"><section class="surface recipe-book"><div class="section-head"><h3>配方图鉴</h3><span>${visible.length} 项</span></div><div class="book-items" ${gridAttrs('book')}>${list.entries.map(recipeTile).join('')||'<p class="muted small">没有匹配的物品。</p>'}</div>${list.controls}</section><div class="bench-column">${switches}${detail}</div></div>`;
}

function queuePanel(){const size=page==='workshop'&&benchView==='recipe'&&roomyWorkbench()?(viewport.height>=1100?2:1):rows(260,100);const list=listPage('queue',game.state.queue.map((q,index)=>({q,index})),size);return '<div data-fit-list="queue">'+(list.entries.map(({q,index:i})=>{const r=game.recipeById.get(q.recipe);return `<div class="queue-row"><div>${icon(Object.keys(r.outputs)[0])}<span><b>${e(recipeName(r))}</b><small data-queue-time="${i}">${time(q.remaining)} · 剩余 ${q.amount} 批</small></span><button class="text-button" data-cancel="${i}">取消</button></div>${progress((1-q.remaining/r.seconds)*100,`data-queue-bar="${i}"`)}</div>`;}).join('')+list.controls||empty('队列为空'))+'</div>';}

function fluidOutputSummary(d){
  const fluids=game.fluidOutputTypes(d.id);if(!fluids.length)return '';
  const fluid=fluids[0],target=game.containerEntries().find(c=>c.id===d.fluidOutputs[fluid]);
  const label=fluids.length>1?'配置流体输出容器':`${name(fluid)} → ${target?(target.group?target.name:name(target.type)+' #'+target.id.slice(1)):'自动存入兼容容器'}`;
  return `<button class="text-link" data-device-view="${d.id}" data-view="output">${e(label)}</button>`;
}
function fluidOutputControls(d){
  const fluids=game.fluidOutputTypes(d.id);if(!fluids.length)return '';
  const list=listPage('fluid-outputs:'+d.id,fluids,1);
  return list.entries.map(fluid=>{
    const tanks=game.containerEntries().filter(c=>game.acceptsFluid(c,fluid)&&(!c.fluid||c.fluid===fluid)||c.id===d.fluidOutputs[fluid]);
    return `<label class="select-label">${e(name(fluid))} → 输出容器<select data-fluid-output="${d.id}" data-fluid="${fluid}"><option value="">自动存入兼容容器</option>${tanks.map(c=>`<option value="${c.id}" data-icon="${c.type}" ${d.fluidOutputs[fluid]===c.id?'selected':''}>${e(c.group?c.name:name(c.type))} #${c.id.slice(1)}</option>`).join('')}</select></label>${tanks.length?'':'<p class="small muted">暂无兼容容器，请先在仓库放置。</p>'}`;
  }).join('')+list.controls+'<p class="small muted">指定容器或容器组装满后暂停生产。固体产物存入物品仓库。</p>';
}
function outputControls(d){
  const kind=energySpec(game,d)?.kind;
  let body=energySpec(game,d)?deviceReadout(game,d):'';
  if(kind==='boiler'){
    const tanks=game.containerEntries().filter(c=>(game.acceptsFluid(c,'steam')&&(!c.fluid||c.fluid==='steam'))||c.id===d.output);
    return body+`<label class="select-label">余汽送入储罐<select data-steam-output="${d.id}"><option value="">保留在锅炉</option>${tanks.map(c=>`<option value="${c.id}" data-icon="${c.type}" ${d.output===c.id?'selected':''}>${e(name(c.type))} #${c.id.slice(1)}</option>`).join('')}</select></label><p class="muted small">直连设备先取汽，剩余蒸汽存入指定储罐。</p>`;
  }
  if(['generator','dyson'].includes(kind)){
    const boxes=game.deviceEntries().filter(b=>(energySpec(game,b)?.kind==='battery'&&voltage(d)<=voltage(b))||b.id===d.output);
    body+=`<label class="select-label">电力输出到<select data-energy-output="${d.id}"><option value="">按电池箱连接充电</option>${boxes.map(b=>`<option value="${b.id}" data-icon="${b.type}" ${d.output===b.id?'selected':''}>${e(deviceName(b))} #${b.id.slice(1)}</option>`).join('')}</select></label><p class="muted small">直连设备先用电，剩余电力为指定电池箱充电。电池箱需要装入电池。</p>`;
  }
  return body+fluidOutputControls(d);
}
function energyControls(d){
  const spec=energySpec(game,d),type=carrier(game,d),mode=d.supply.mode,options=type?game.supplyOptions(d):[],fuel=generatorFuel(game,d);
  let body=deviceReadout(game,d);
  if(spec.kind==='boiler'){
    return body+`<label class="select-label">进水来源<select data-energy-source="${d.id}"><option value="">自动从兼容容器取水</option>${options.map(c=>`<option value="${c.id}" ${d.supply.source===c.id?'selected':''}>${e(c.group?c.name:name(c.type))}</option>`).join('')}</select></label><p class="muted small">高于 100 °C 产汽：${120*(d.group?.members.length||1)} mB/s；1 mB 水 → 160 mB 蒸汽。关机后仍会消耗余热。</p><div class="energy-actions"><button class="button" data-load-coal="${d.id}" data-count="1">${d.group?'每台装煤':'装煤'} ×1</button><button class="button" data-load-coal="${d.id}" data-count="16">${d.group?'每台装煤':'装煤'} ×16</button></div>${d.group?'':`<button class="text-link" data-empty-energy="${d.id}">排空机内能源</button>`}`;
  }
  if(type){
    if(spec.kind!=='battery'&&(type==='electric'||type==='steam'))body+=`<div class="energy-modes" role="group" aria-label="供能方式">${[['direct','直连产能设备'],['storage',type==='electric'?'从电池箱取电':'从储罐取汽']].map(([value,label])=>`<button class="filter ${mode===value?'active':''}" data-energy-mode="${d.id}" data-mode="${value}" aria-pressed="${mode===value}">${label}</button>`).join('')}</div>`;
    body+=`<label class="select-label">${spec.kind==='battery'?'充电来源':['generator','dyson'].includes(spec.kind)?'燃料 / 冷却液来源':'供能来源'}<select data-energy-source="${d.id}"><option value="">${spec.kind==='dyson'?'自动从兼容容器取冷却液':'选择'+(mode==='direct'?'产能设备':type==='electric'?'电池箱':'储罐')}</option>${options.map(s=>`<option value="${s.id}" data-icon="${s.type}" ${d.supply.source===s.id?'selected':''}>${name(s.type)} #${s.id.slice(1)}${s.energyTier?' · '+ENERGY.codes[s.energyTier]:''}</option>`).join('')}</select></label>`;
  }
  if(fuel)body+=`<p class="muted small">${fuel.amount} mB ${name(fuel.id)} → ${num(fuel.eu)} EU${fuel.efficiency?' · 效率 '+fuel.efficiency+'%':''} · 输出 ${d.group?.members.length||1} A</p>`;
  if(spec.kind==='battery'&&!d.group)body+=`<div class="battery-slots" aria-label="电池槽">${Array.from({length:4},(_,i)=>`<span class="battery-slot ${i<d.batteries?'occupied':''}">${i<d.batteries?icon(batteryItem(d)):'＋'}</span>`).join('')}</div><div class="energy-actions"><button class="button" data-battery-in="${d.id}" ${d.batteries>=4?'disabled':''}>装入电池</button><button class="button" data-battery-out="${d.id}" ${!d.batteries?'disabled':''}>取出一节</button>${game.state.legacyEnergy?`<button class="button" data-recover-energy="${d.id}">转存旧版电量</button>`:''}</div>`;
  if(spec.kind==='dyson'&&!d.group)body+=`<p class="muted small">每模块 ${num(ENERGY.dyson.euPerModule)} EU/t；每小时消耗 ${num(ENERGY.dyson.coolant)} mB 极寒之凛冰，模块会损耗。</p><button class="button" data-module-in="${d.id}">装入戴森模块</button>`;
  if(!d.group&&spec.maxTier&&d.energyTier<spec.maxTier)body+=`<button class="text-link" data-upgrade-energy-open="${d.id}" ${d.energyTier+2>game.state.stage?'disabled':''}>升级到 ${ENERGY.codes[d.energyTier+1]}</button>`;
  if(!d.group)body+=`<button class="text-link" data-empty-energy="${d.id}" title="暂停后可退回机内流体；剩余电量会散去">排空机内能源</button>`;
  return body;
}
function deviceCard(d){
  if(d.group)d.blocked=deviceStackStatus(game.members(d.id));
  const m=machines[d.type],spec=energySpec(game,d),current=game.recipeById.get(d.recipe),options=game.availableRecipes().filter(r=>m.processes.includes(r.process));
  const hasFluidOutputs=game.fluidOutputTypes(d.id).length>0,hasOutputs=['boiler','generator','dyson'].includes(spec?.kind)||hasFluidOutputs;
  const outputView=hasOutputs&&deviceViews[d.id]==='output',energyView=!!spec&&(spec.kind==='battery'||deviceViews[d.id]==='energy'),run=game.deviceRuntime(d,current);
  const production=`<label class="select-label">运行配方<select data-assign="${d.id}" ${d.job?'disabled':''} title="${d.job?'切换配方前请先强制停止，或等待本批完成':'选择生产配方'}"><option value="">选择配方…</option>${options.map(r=>`<option value="${r.id}" ${d.recipe===r.id?'selected':''}>${e(recipeName(r))}</option>`).join('')}</select></label>${spec?deviceReadout(game,d,{compact:spec.kind!=='boiler'}):''}${spec?.kind==='boiler'?'':`<div class="device-io">${current?`<div>${stacks(current.inputs)}</div><span>→</span><div>${stacks(current.outputs,false)}</div>`:'<p class="muted small">尚未选择配方</p>'}</div>`}${hasFluidOutputs?fluidOutputSummary(d):''}${progress(d.job?(1-d.job.remaining/(d.job.duration||run.seconds))*100:0,`data-device-bar="${d.id}"`)}`;
  return `<article class="surface device-card" data-device="${d.id}"><div class="card-top">${icon(d.type)}<div><h3>${e(deviceName(d))}<small>${d.group?' · '+d.group.members.length+' 台':' #'+d.id.slice(1)}</small></h3><p>${d.energyTier?ENERGY.codes[d.energyTier]:STAGES[m.stage].code} · ${e(d.alias?m.name:m.description||'')}${!d.group&&game.groupFor(d.id)?' · '+e(game.groupFor(d.id).name):''}</p></div><span class="device-light ${d.blocked==='运行中'?'running':''}" data-light="${d.id}"></span></div>${(spec&&spec.kind!=='battery')||hasOutputs?`<div class="device-tabs" role="group" aria-label="设备面板"><button class="filter ${!energyView&&!outputView?'active':''}" data-device-view="${d.id}" data-view="production" aria-pressed="${!energyView&&!outputView}">生产</button>${spec?`<button class="filter ${energyView?'active':''}" data-device-view="${d.id}" data-view="energy" aria-pressed="${energyView}">供能</button>`:''}${hasOutputs?`<button class="filter ${outputView?'active':''}" data-device-view="${d.id}" data-view="output" aria-pressed="${outputView}">输出</button>`:''}</div>`:''}${outputView?`<div class="device-energy">${outputControls(d)}</div>`:energyView?`<div class="device-energy">${energyControls(d)}</div>`:production}<div class="card-footer"><span class="device-status" data-device-state="${d.id}">${e(d.blocked)}</span><div><button class="button" data-toggle="${d.id}">${d.group?(d.enabled?'暂停全组':'启动全组'):d.enabled?'暂停':d.recipe||spec?.kind==='battery'?'恢复':'启动'}</button>${spec?.kind==='battery'?'':`<button class="button danger" data-force-stop="${d.id}" ${(d.group?game.members(d.id).every(d=>!d.enabled&&!d.job&&!d.recipe):!d.enabled&&!d.job&&!d.recipe)?'disabled':''} title="取消当前批次，已投入原料不返还；机内能源保留">强制停止</button>`}${d.group?`<button class="button plain" data-edit-group="${d.id}">管理组</button><button class="button plain" data-expand-stack="${d.id}">成员</button>`:`<button class="button plain" data-rename-device="${d.id}" aria-label="修改${e(deviceName(d))}的别名">别名</button><button class="button plain" data-remove="${d.id}" title="需先完成批次并用完机内能源">拆除</button>`}</div></div></article>`;
}
function deviceSummary(limit=3,fitKey=''){const count=Math.min(limit,fitKey?listSizeLimits.get(fitKey)??Infinity:Infinity);return game.state.devices.length?(fitKey?`<div data-fit-list="${fitKey}">`:'')+[...game.state.devices].sort((a,b)=>Number(!!(b.recipe||b.job))-Number(!!(a.recipe||a.job))).slice(0,count).map(d=>`<div class="machine-row">${icon(d.type)}<div><strong>${e(deviceName(d))}</strong><small>${(game.recipeById.has(d.recipe)?recipeName(game.recipeById.get(d.recipe)):null)||'未选择配方'}</small></div><span class="machine-output" data-device-state="${d.id}">${d.blocked}</span></div>`).join('')+(fitKey?'</div>':'')+`<button class="text-link" data-page="factory">查看工厂 →</button>`:empty('暂无生产设备');}
function deviceStackStatus(devices){
  const counts=new Map();
  for(const d of devices){const status=!d.enabled?'已暂停':d.blocked;counts.set(status,(counts.get(status)||0)+1);}
  return [...counts].map(([status,count])=>`${status} ${count} 台`).join(' · ');
}
function deviceStackCard(entry){
  const {key,devices}=entry;
  if(devices[0]?.group){
    const d=devices[0];if(!expandedDeviceStacks.has(key))return deviceCard(d);
    const plan=gridPlan('stack',238),list=listPage('stack:'+key,game.members(d.id),plan.size);
    return `<article class="device-stack expanded" data-device-stack="${key}"><div class="stack-footer"><h3>${e(d.alias)} · ${d.group.members.length} 台</h3><button class="button" data-edit-group="${d.id}">管理组</button><button class="button" data-expand-stack="${key}">收起成员</button></div><p class="small muted">成员共用组的输入输出设置；电池和机内物料逐台管理。</p><div class="device-grid stack-devices" ${gridAttrs('stack')}>${list.entries.map(deviceCard).join('')}</div>${list.controls}</article>`;
  }
  if(devices.length===1&&!expandedDeviceStacks.has(key))return deviceCard(devices[0]);
  const d=devices[0],r=game.recipeById.get(d.recipe),expanded=expandedDeviceStacks.has(key),contentId=`stack-${key}`;
  if(expanded){const plan=gridPlan('stack',238),list=listPage('stack:'+key,devices,plan.size);return `<article class="device-stack expanded" data-device-stack="${key}"><div class="stack-footer"><h3>${e(recipeName(r))} · ${devices.length} 台</h3><button class="button" data-expand-stack="${key}" aria-expanded="true" aria-controls="${contentId}">收起设备</button></div><div id="${contentId}" class="device-grid stack-devices" ${gridAttrs('stack')}>${list.entries.map(deviceCard).join('')}</div>${list.controls}</article>`;}
  return `<article class="surface device-stack" data-device-stack="${key}"><div class="card-top">${icon(d.type)}<div><h3>${e(recipeName(r))}</h3><p>${machines[d.type].name}</p></div><span class="pill">×${devices.length} 台</span></div><div class="stack-recipe"><small>每台每批 · ${["generator","boiler","dyson"].includes(energySpec(game,d)?.kind)?e(recipeEnergyText(r)):game.deviceRuntime(d,r).seconds+" 秒 · "+(d.energyTier?ENERGY.codes[d.energyTier]:"蒸汽")}</small><div class="device-io"><div>${stacks(r.inputs)}</div><span>→</span><div>${stacks(r.outputs,false)}</div></div></div><div class="stack-footer"><span class="device-status" data-stack-status="${devices.map(d=>d.id).join(',')}">${e(deviceStackStatus(devices))}</span>${game.fluidOutputTypes(d.id).length?`<button class="button" data-expand-stack="${key}" data-stack-output="${devices.map(d=>d.id).join(',')}">输出容器</button>`:''}<button class="button" data-expand-stack="${key}" aria-expanded="false" aria-controls="${contentId}">展开设备</button></div></article>`;
}

function factory(){
  const endpoints=game.deviceEntries();
  const groups=Object.keys(machines).map(type=>({type,devices:endpoints.filter(d=>d.type===type)})).filter(group=>group.devices.length);
  if(!groups.some(group=>group.type===factoryType)){factoryType=groups[0]?.type||'';listPages.factory=0;listPages['machine-types']=0;expandedDeviceStacks.clear();}
  const matching=groups.filter(group=>group.type===factoryType);
  const sections=[true,false].flatMap(task=>matching.map(group=>{
    const devices=group.devices.filter(d=>task===null||Boolean(d.hasTask||d.recipe||d.job)===task),entries=[];
    const stacksByRecipe=new Map();
    for(const d of devices){
      const fluidPorts=Object.entries(d.fluidOutputs).sort(([a],[b])=>a.localeCompare(b)).map(([fluid,target])=>fluid+'_'+target).join('_');
      const key=[group.type,d.recipe,d.energyTier,d.supply.mode,d.supply.source||'none',d.output||'none',fluidPorts].join('-');
      if(game.recipeById.has(d.recipe)&&!d.alias){
        if(!stacksByRecipe.has(key)){const entry={key,devices:[]};stacksByRecipe.set(key,entry);entries.push(entry);}
        stacksByRecipe.get(key).devices.push(d);
      }else entries.push({key:d.id,devices:[d]});
    }
    return {...group,devices,entries,task};
  }).filter(group=>group.devices.length));
  const entries=sections.flatMap(group=>group.entries);
  for(const key of expandedDeviceStacks)if(!entries.some(entry=>entry.key===key))expandedDeviceStacks.delete(key);
  const plan=gridPlan('factory',180);
  const list=expandedDeviceStacks.size?{entries:entries.filter(entry=>expandedDeviceStacks.has(entry.key)),controls:''}:listPage('factory',entries,plan.size),shown=sections.map(group=>({...group,visible:group.entries.filter(entry=>list.entries.includes(entry))})).filter(group=>group.visible.length);
  const typePlan=gridPlan('categories',180,viewport.width-90),types=listPage('machine-types',groups,typePlan.columns);
  const typeButton=(type,label,count)=>`<button class="filter machine-type ${factoryType===type?'active':''}" data-factory-type="${type}" aria-pressed="${factoryType===type}">${icon(type)}<span>${label}</span><b>${count}</b></button>`;

  return heading('生产工厂','<button class="button" data-create-group="device">创建设备组</button><button class="button primary" data-workshop="machines">＋ 建造设备</button>')+`<div class="factory-toolbar"><span class="muted">运行 <b data-running>0</b> · 待料 / 待电 <b data-waiting>0</b> · ${game.state.devices.length} 台设备</span><span class="stat-eu">${icon('turbine')}<strong data-energy>${num(game.state.energy)}</strong> EU</span></div><div class="machine-categories" role="group" aria-label="机器分类"><div class="machine-type-buttons" style="--category-width:${typePlan.width}px">${types.entries.map(g=>typeButton(g.type,machines[g.type].name,g.devices.reduce((n,d)=>n+(d.group?.members.length||1),0))).join('')}</div>${types.controls}</div><div class="factory-groups ${expandedDeviceStacks.size?'has-expanded':''}" ${gridAttrs('factory')}>${shown.flatMap(group=>group.visible.map(entry=>`<section class="factory-entry" data-machine-group="${group.type}">${deviceStackCard(entry)}</section>`)).join('')||empty('暂无生产设备')}</div>${list.controls}`;

}
function inventory(){
  const tabs=`<div class="subtabs inventory-tabs" role="group" aria-label="仓库分类"><button class="filter ${inventoryTab==='items'?'active':''}" data-inventory-tab="items" aria-pressed="${inventoryTab==='items'}">物品</button><button class="filter ${inventoryTab==='containers'?'active':''}" data-inventory-tab="containers" aria-pressed="${inventoryTab==='containers'}">桶与储罐</button></div>`;
  const plan=gridPlan('inventory',150),all=Object.values(items).filter(x=>x.kind!=='fluid'&&game.quantity(x.id)>0&&(!filter||x.name.toLowerCase().includes(filter.toLowerCase()))),list=listPage('inventory',all,plan.size);
  return heading('物品仓库',inventoryTab==='items'?`<input class="search" id="search" placeholder="搜索物品" value="${e(filter)}">`:'')+tabs+(inventoryTab==='containers'?fluids():`<div data-list-start="inventory"><div class="inventory-grid" ${gridAttrs('inventory')}>${list.entries.map(x=>`<article class="surface inventory-item" data-inventory-item="${x.id}">${icon(x.id)}<div><strong>${x.name}</strong><small>${x.category}</small></div><b>${qty(x.id)}</b></article>`).join('')||empty('仓库为空')}</div>${list.controls}</div>`);
}
function containerCards(){
  const plan=gridPlan('fluids',200),list=listPage('fluids',game.containerEntries(),plan.size);
  return list.entries.map(c=>`<article class="surface fluid-container" data-container="${c.id}"><div class="card-top">${icon(c.type)}<div><h3>${e(c.group?c.name:name(c.type))} <small>${c.group?c.group.members.length+' 个容器':'#'+e(c.id)}</small></h3><p>${c.type==='legacyTank'?'密封储存液体与气体':c.type==='woodBucket'?'仅装水':c.type==='ironBucket'?'装水、杂酚油、原油或柴油':'密封储存液体与气体'}</p></div></div><div class="tank-readout"><div class="tank-vessel"><div data-container-level="${c.id}" style="height:${c.amount/game.containerCapacity(c)*100}%;--fluid-color:${items[c.fluid]?.color||'var(--dim)'}"></div></div><div><strong data-container-fluid="${c.id}">${c.fluid?name(c.fluid):'空容器'}</strong><p><b data-container-amount="${c.id}">${num(c.amount)}</b> / ${num(game.containerCapacity(c))} mB</p></div></div><label class="select-label">限定流体<select data-container-reserve="${c.id}" ${c.amount>0?'disabled':''}><option value="">自动接收兼容流体</option>${Object.values(items).filter(x=>x.kind==='fluid'&&game.acceptsFluid(c,x.id)).map(x=>`<option value="${x.id}" ${c.fluid===x.id?'selected':''}>${x.name}</option>`).join('')}</select></label><div class="fluid-transfer"><select data-transfer-target="${c.id}" aria-label="转移目标"><option value="">选择目标容器</option>${game.containerEntries().filter(t=>t.id!==c.id).map(t=>`<option value="${t.id}" data-icon="${t.type}">${name(t.type)} #${e(t.id)}</option>`).join('')}</select><button class="button" data-transfer="${c.id}" ${c.amount<=0?'disabled':''}>转移流体</button></div>${c.group?`<button class="text-link" data-edit-group="${c.id}">管理分组</button>`:`<button class="text-link" data-remove-container="${c.id}" ${c.amount>0?'disabled':''}>${c.type==='legacyTank'?'移除空罐':'收起空容器'}</button>`}</article>`).join('')+list.controls||empty('暂无已放置的容器');
}
function fluids(){
  const available=Object.entries(containerTypes).filter(([,c])=>!c.migrationOnly&&c.stage<=game.state.stage);
  const switcher=`<div class="subtabs container-tabs"><button class="filter ${containerView==='placed'?'active':''}" data-container-view="placed">已放置 · ${game.state.containers.length}</button><button class="filter ${containerView==='catalog'?'active':''}" data-container-view="catalog">放置容器</button><button class="button" data-create-group="fluid">创建容器组</button></div>`;
  const cards=containerView==='placed'?containerCards():'';
  const plan=gridPlan('containers',200),catalog=listPage('container-catalog',available,plan.size);
  return switcher+(containerView==='catalog'?`<div class="container-toolbar" ${gridAttrs('containers')}>${catalog.entries.map(([id,spec])=>`<article class="surface container-option">${icon(id)}<div><strong>${spec.name}</strong><small>${num(spec.capacity)} mB · 空容器 ${qty(id)}</small></div><button class="button" data-recipe-item="${id}">配方</button><div class="container-placement"><div class="worker-stepper" role="group" aria-label="${e(spec.name)}放置数量"><button class="button" data-container-place-step="${id}" data-step="-1" aria-label="减少放置数量" ${containerPlaceCount(id)<=1?'disabled':''}>−</button><strong data-container-place-count="${id}">${containerPlaceCount(id)} 个</strong><button class="button" data-container-place-step="${id}" data-step="1" aria-label="增加放置数量" ${containerPlaceCount(id)>=containerPlaceLimit(id)?'disabled':''}>＋</button><button class="button" data-container-place-all="${id}" ${containerPlaceCount(id)>=containerPlaceLimit(id)?'disabled':''}>全部</button></div><button class="button primary" data-place-container="${id}" ${containerPlaceLimit(id)<1?'disabled':''}>放置 ×${containerPlaceCount(id)}</button></div></article>`).join('')}</div>${catalog.controls}`:`<div id="containerList" class="container-grid" ${gridAttrs('fluids')} data-list-start="fluids">${cards}</div>`);
}

function research(){const plan=gridPlan('research',100,Math.max(0,viewport.width-298)),list=listPage('research',STAGES,plan.size);return heading('科技主线')+`<div class="page-grid"><div class="page-main"><div class="era-grid" ${gridAttrs('research')}>${list.entries.map(t=>{const active=t.index===game.state.stage,complete=t.index<game.state.stage;return `<article class="surface era-card ${active?'current':''} ${t.index>game.state.stage?'locked':''}"><span class="era-index">${String(t.index+1).padStart(2,'0')}</span><div><span class="eyebrow">${t.code}</span><h3>${t.name}</h3><p>${t.description}</p><small>${complete?'✓ 已完成':active?'● 正在推进':'尚未解锁'}</small></div><span class="era-voltage">${t.voltage?num(t.voltage)+' V':'—'}</span></article>`;}).join('')}</div>${list.controls}</div><aside class="page-rail">${mainlinePanel()}</aside></div>`;}

function space(){const plan=gridPlan('space'),list=listPage('space',gatherNodes.filter(n=>['moon','mars','belt'].includes(n.id)),plan.size);return heading('星际远征')+`<div class="resource-cards fitted-cards" ${gridAttrs('space')}>${list.entries.map(nodeCard).join('')}</div>${list.controls}`;}

function settings(){if(appearanceOpen)return appearance();return heading('存档与设置','<button class="button" data-appearance-open>电压外观</button>')+`<div class="page-grid"><div class="page-main">${panel('世界存档','',`<div class="settings-row"><div><h3>导出存档</h3><p>备份当前世界，或迁移到另一台电脑。</p></div><button class="button primary" data-action="export">导出存档</button></div><div class="settings-row"><div><h3>导入存档</h3><p>载入存档，替换当前世界。</p></div><button class="button" data-action="import">导入存档</button></div><div class="settings-row"><div><h3>重置世界</h3><p>重新开始，重置前会导出当前存档。</p></div><button class="button danger" data-action="reset">重置</button></div>`)}</div><aside class="page-rail">${panel('离线收益','','<p class="muted">离开后，自动采集和产线继续结算，最多 12 小时。</p><p class="muted">缺少原料、电力或流体容量时，相关产出暂停。</p>')}${panel('世界统计','',`<div class="goal-row"><span>当前章节</span><strong>${game.stage.code}</strong></div><div class="goal-row"><span>运行时间</span><strong data-playtime>${time(game.state.playtime)}</strong></div><div class="goal-row"><span>累计产出</span><strong data-produced>${num(game.state.produced)}</strong></div><div class="goal-row"><span>自动采集点</span><strong>${Object.keys(game.state.collectors).length}</strong></div>`)}</aside></div>`;}
const pages={overview,resources:resourcesPage,workshop,factory,inventory,research,space,settings};
function queueStateSignature(){return JSON.stringify(game.state.queue.map(q=>[q.recipe,q.amount]));}
function containerStateSignature(){return JSON.stringify(game.state.containers.map(c=>[c.id,c.type,c.fluid]));}
function render(){
  syncChoiceEntities();
  syncTheme();hoveredItem='';
  const root=$('#page'),style=getComputedStyle(root);
  viewport={width:root.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height:root.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)};
  listAnchors=new Map(Object.entries(listPages).map(([key,index])=>[key,index*(listSizes.get(key)||1)]));
  const context=JSON.stringify([viewport,page,overviewTab,workshopTab,benchView,inventoryTab,containerView,factoryType,filter,appearanceOpen,appearanceMode,game.stage.code,nodeViews,deviceViews,[...expandedDeviceStacks]]);
  if(context!==layoutContext){gridRowLimits.clear();listSizeLimits.clear();layoutContext=context;}
  root.dataset.page=page;
  let needsFit;
  do{
    gridPlans.clear();root.innerHTML=pages[page]();
    queueSignature=$('#queuePanel')?queueStateSignature():'';containerSignature=$('#containerList')?containerStateSignature():'';
    initAppearance();enhanceChoices(root);refresh();
    needsFit=fitPageLimits(root,gridPlans,gridRowLimits,listSizeLimits);
  }while(needsFit);
  updateText($('#pageName'),titleMap[page]);updateText($('#headerStage'),game.stage.code);
  $$('.nav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
}

function navigate(next){if(!pages[next])return;closeChoices();appearanceOpen=false;page=next;filter='';render();}

function refresh(){
  syncChoiceEntities();
  $$('[data-qty]').forEach(el=>updateText(el,num(game.quantity(el.dataset.qty))));
  if($('#containerList')){
    const signature=containerStateSignature();
    if(signature!==containerSignature){$('#containerList').innerHTML=containerCards();containerSignature=signature;enhanceChoices($('#containerList'));}
    const containers=new Map(game.containerEntries().map(c=>[c.id,c]));
    $$('[data-container]').forEach(card=>{
      const c=containers.get(card.dataset.container);if(!c)return;
      updateText(card.querySelector('[data-container-amount]'),num(c.amount));
      updatePercent(card.querySelector('[data-container-level]'),'height',c.amount/game.containerCapacity(c)*100);
      updateDisabled(card.querySelector('[data-container-reserve]'),c.amount>0);
      updateDisabled(card.querySelector('[data-remove-container]'),c.amount>0);
      updateDisabled(card.querySelector('[data-transfer]'),c.amount<=0);
    });
  }
  $$('[data-container-place-count]').forEach(el=>updateText(el,containerPlaceCount(el.dataset.containerPlaceCount)+' 个'));
  $$('[data-container-place-step]').forEach(el=>{const id=el.dataset.containerPlaceStep;updateDisabled(el,Number(el.dataset.step)<0?containerPlaceCount(id)<=1:containerPlaceCount(id)>=containerPlaceLimit(id));});
  $$('[data-container-place-all]').forEach(el=>updateDisabled(el,containerPlaceCount(el.dataset.containerPlaceAll)>=containerPlaceLimit(el.dataset.containerPlaceAll)));
  $$('[data-place-container]').forEach(el=>{const id=el.dataset.placeContainer;updateDisabled(el,containerPlaceLimit(id)<1);updateText(el,'放置 ×'+containerPlaceCount(id));});
  $$('[data-energy]').forEach(el=>updateText(el,num(game.state.energy)));updateText($('#headerEu'),num(game.state.energy)+' EU');
  $$('[data-energy-bar]').forEach(el=>updatePercent(el,'width',game.capacity()?game.state.energy/game.capacity()*100:0));
  $$('[data-produced]').forEach(el=>updateText(el,num(game.state.produced)));$$('[data-playtime]').forEach(el=>updateText(el,time(game.state.playtime)));
  $$('[data-ingredient]').forEach(el=>el.classList.toggle('enough',game.quantity(el.dataset.ingredient)>=Number(el.dataset.need)));
  $$('[data-gather],[data-gather-hit]').forEach(el=>{const n=gatherNodes.find(n=>n.id===(el.dataset.gather||el.dataset.gatherHit));const allowed=game.nodeAvailable(n);updateDisabled(el,!allowed);if(el.dataset.gather)updateText(el,allowed?`${gatherVerb(n)} · +${Math.round(100/game.gatherClicks(n))}%`:'尚未解锁');});
  $$('[data-gather-progress]').forEach(el=>{const n=gatherNodes.find(n=>n.id===el.dataset.gatherProgress);updatePercent(el,'width',(game.state.gatherProgress[n.id]||0)/game.gatherClicks(n)*100);});
  $$('[data-click-progress]').forEach(el=>{const n=gatherNodes.find(n=>n.id===el.dataset.clickProgress);updateText(el,`${game.state.gatherProgress[n.id]||0} / ${game.gatherClicks(n)} 次点击`);});
  $$('[data-craft]').forEach(el=>{const r=game.recipeById.get(el.dataset.craft),count=Number(el.dataset.count)||1;updateDisabled(el,!r||filledRecipe!==r.id||!game.canCraft(r)||!game.canPay(Object.fromEntries(Object.entries(r.inputs).map(([id,n])=>[id,n*count])))||game.state.queue.length>=20);});
  $$('[data-build]').forEach(el=>updateDisabled(el,filledRecipe!=='build:'+el.dataset.build||!game.canBuild(el.dataset.build)));
  $$('[data-slot-item]').forEach(el=>el.classList.toggle('missing',game.quantity(el.dataset.slotItem)<Number(el.dataset.slotTotal)));
  $$('[data-fill]').forEach(el=>{const r=selectedEntry();updateDisabled(el,!r||!game.canPay(r.inputs)||!game.canPay(r.tools||{}));});
  if($('[data-bench-status]')){const r=selectedEntry(),missing=[...game.missing(r.inputs),...game.missing(r.tools||{})];updateText($('[data-bench-status]'),missing.length?'还缺：'+missing.map(x=>name(x.id)+' ×'+num(x.need-x.have)).join('、'):r.process==='craft'&&game.state.queue.length>=20?'手工队列已满，请等待或取消已有任务。':r.process==='craft'||r.process==='build'?filledRecipe===r.id?'材料已放入':'材料齐全':'需使用'+processName(r.process));$('[data-bench-status]').classList.toggle('ready',!missing.length);}
  const goals=$$('[data-goal]'),goalBars=$$('[data-goal-bar]'),goalLabels=$$('[data-goal-pct]'),advance=$$('[data-action="advance"]');
  if(goals.length||goalBars.length||goalLabels.length||advance.length){
    const entries=game.milestoneProgress(),byId=new Map(entries.map(x=>[x.id,x]));
    const pct=entries.reduce((n,x)=>n+Math.min(1,x.have/x.need),0)/entries.length*100;
    goals.forEach(el=>{const have=byId.get(el.dataset.goal)?.have||0;updateText(el,num(Math.min(have,Number(el.dataset.need)))+' / '+num(Number(el.dataset.need)));el.classList.toggle('complete',have>=Number(el.dataset.need));});
    goalBars.forEach(el=>updatePercent(el,'width',pct));goalLabels.forEach(el=>updateText(el,Math.floor(pct)+'%'));
    advance.forEach(el=>updateDisabled(el,game.state.completed||!entries.every(x=>x.have>=x.need)));
  }
  $$('[data-auto]').forEach(el=>{const n=gatherNodes.find(n=>n.id===el.dataset.auto),c=game.state.collectors[n.id];updateText(el,c.enabled===false?'已停止':c.blocked==='流体容器不足'?'流体容器不足':time(n.seconds*4-c.elapsed)+' 后掉落');});
  $$('[data-collector-badge]').forEach(el=>{const n=gatherNodes.find(n=>n.id===el.dataset.collectorBadge),c=game.state.collectors[n.id];updateText(el,c?'自动 ×'+(c.enabled===false?0:c.activeCount??c.count):STAGES[n.stage].code);});
  $$('[data-collector-progress]').forEach(el=>{const n=gatherNodes.find(n=>n.id===el.dataset.collectorProgress);updatePercent(el,'width',game.state.collectors[n.id].elapsed/(n.seconds*4)*100);});
  const states=$$('[data-device-state]'),cards=$$('[data-device]'),stacks=$$('[data-stack-status]');
  if(states.length||cards.length||stacks.length){
    const byId=new Map([...game.state.devices,...game.deviceEntries().filter(d=>d.group)].map(d=>[d.id,d]));
    states.forEach(el=>{const d=byId.get(el.dataset.deviceState);if(d)updateText(el,d.group?deviceStackStatus(game.members(d.id)):d.blocked);});
    cards.forEach(card=>{
      const d=byId.get(card.dataset.device);if(!d)return;const r=game.recipeById.get(d.recipe);
      updatePercent(card.querySelector('[data-device-bar]'),'width',d.job&&r?(1-d.job.remaining/(d.job.duration||game.deviceRuntime(d,r).seconds))*100:0);
      updateDeviceReadout(card,game,d);
      card.querySelector('[data-light]')?.classList.toggle('running',d.group?game.members(d.id).some(d=>d.blocked==='运行中'):d.blocked==='运行中');
      const select=card.querySelector('[data-assign]');updateDisabled(select,!!d.job);updateAttribute(select,'title',d.job?'切换配方前请先强制停止，或等待本批完成':'选择生产配方');
      updateDisabled(card.querySelector('[data-force-stop]'),d.group?game.members(d.id).every(d=>!d.enabled&&!d.job&&!d.recipe):!d.enabled&&!d.job&&!d.recipe);
    });
    stacks.forEach(el=>updateText(el,deviceStackStatus(el.dataset.stackStatus.split(',').map(id=>byId.get(id)).filter(Boolean))));
  }
  if($('[data-running]'))updateText($('[data-running]'),game.state.devices.filter(d=>d.blocked==='运行中').length);
  if($('[data-waiting]'))updateText($('[data-waiting]'),game.state.devices.filter(d=>['缺少原料','电力不足','蒸汽不足','机内蒸汽不足','请选择供能来源','请选择燃料来源','燃料不足','机器电压等级不足','流体输出空间不足'].includes(d.blocked)).length);
  $$('[data-queue-count]').forEach(el=>updateText(el,game.state.queue.length));
  if($('#queuePanel')){const sig=queueStateSignature();if(sig!==queueSignature){$('#queuePanel').innerHTML=queuePanel();queueSignature=sig;}game.state.queue.forEach((q,i)=>{updateText($(`[data-queue-time="${i}"]`),time(q.remaining)+' · 剩余 '+q.amount+' 批');updatePercent($(`[data-queue-bar="${i}"]`),'width',(1-q.remaining/game.recipeById.get(q.recipe).seconds)*100);});}
  syncChoices($('#page'));
}
function download(text,filename){const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showModal(html){$('#modalContent').innerHTML=`<button class="modal-close" data-action="close-modal" aria-label="关闭">×</button>${html}`;$('#modal').showModal();}

function gatherAction(id){
  const outcome=game.gather(id);
  if(!outcome.ok){notify(outcome.message);return;}
  const scene=$(`[data-gather-hit="${id}"]`),ring=document.createElement('span');
  ring.className='hit-ring';scene?.append(ring);setTimeout(()=>ring.remove(),450);
  if(outcome.completed){
    lastDrops={id,drops:outcome.drops,skipped:outcome.skipped};
    const layer=$(`[data-drop-layer="${id}"]`);
    Object.entries(outcome.drops).forEach(([item,count],i)=>{
      const drop=document.createElement('span');drop.className='floating-drop';drop.style.setProperty('--drop-index',i);
      drop.innerHTML=`${icon(item)}<span>${e(name(item))} <b>+${num(count)}${items[item].kind==='fluid'?' mB':''}</b></span>`;
      layer?.append(drop);setTimeout(()=>drop.remove(),1900);
    });
    if($('[data-last-drops]'))$('[data-last-drops]').innerHTML=dropSummary();
    notify((Object.keys(outcome.drops).length?'获得 '+Object.entries(outcome.drops).map(([item,count])=>name(item)+' +'+num(count)+(items[item].kind==='fluid'?' mB':'')).join('、'):'本轮未收集到物品')+(Object.keys(outcome.skipped).length?'；'+Object.keys(outcome.skipped).map(name).join('、')+'未收集，缺少容器容量':''));
    persist();
  }
  refresh();
}
document.addEventListener('click',ev=>{const t=ev.target.closest('button');if(!t)return;if(t.hasAttribute('data-appearance-open')){appearanceOpen=true;appearanceCode=appearanceMode||tierFor(game.stage.code).code;appearanceEraPage=tierFor(appearanceCode).era;page='settings';render();$('[data-tier-step]:not(:disabled)')?.focus({preventScroll:true});}else if(t.hasAttribute('data-appearance-close')){appearanceOpen=false;render();$('#page [data-appearance-open]')?.focus({preventScroll:true});}});
document.addEventListener('click',ev=>{const t=ev.target.closest('button');if(!t||t.disabled)return;if(t.dataset.listPage){listPages[t.dataset.listPage]=Number(t.dataset.listIndex);render();return;}if(t.hasAttribute('data-show-drops'))return showModal('<h2>最近掉落</h2><div data-last-drops role="status" aria-live="polite">'+dropSummary()+'</div>');if(t.dataset.overviewTab){overviewTab=t.dataset.overviewTab;return render();}if(t.dataset.benchView){benchView=t.dataset.benchView;return render();}if(t.dataset.nodeView){nodeViews[t.dataset.nodeId]=t.dataset.nodeView;return render();}if(t.dataset.containerView){containerView=t.dataset.containerView;return render();}if(t.dataset.expandStack){const key=t.dataset.expandStack;if(t.dataset.stackOutput){for(const id of t.dataset.stackOutput.split(','))deviceViews[id]='output';expandedDeviceStacks.clear();expandedDeviceStacks.add(key);}else if(expandedDeviceStacks.has(key))expandedDeviceStacks.delete(key);else{expandedDeviceStacks.clear();expandedDeviceStacks.add(key);}render();return;}if(t.dataset.inventoryTab){inventoryTab=t.dataset.inventoryTab;filter='';render();return;}if(t.dataset.workerNode)return result(game.setCollectorWorkers(t.dataset.workerNode,Number(t.dataset.workerCount)));if(t.dataset.toggleCollector)return result(game.toggleCollector(t.dataset.toggleCollector));if(t.dataset.dispatch){const target=$('[data-dispatch-target="'+t.dataset.dispatch+'"]').value;const outcome=game.dispatch(t.dataset.dispatch,target);if(outcome.ok){factoryType=outcome.device.type;listPages.factory=0;}return result(outcome,outcome.ok?'已派工至'+deviceName(outcome.device)+' #'+target.slice(1):'');}if(t.dataset.buildFor){workshopTab='machines';selectedItems.machines=t.dataset.buildFor;selectedRecipes.machines='build:'+t.dataset.buildFor;filledRecipe='';listPages.book=0;return navigate('workshop');}if(t.dataset.page)return navigate(t.dataset.page);if(t.dataset.factoryType){factoryType=t.dataset.factoryType;listPages.factory=0;expandedDeviceStacks.clear();render();return;}if(t.dataset.workshop){workshopTab=t.dataset.workshop;return navigate('workshop');}if(t.dataset.tab){benchView='recipe';listPages.book=0;workshopTab=t.dataset.tab;recipeMode='recipes';filter='';filledRecipe='';return render();}if(t.dataset.bookItem){benchView='recipe';selectedItems[workshopTab]=t.dataset.bookItem;selectedRecipes[workshopTab]='';filledRecipe='';return render();}if(t.dataset.lookupItem||t.dataset.recipeItem)return lookupItem(t.dataset.lookupItem||t.dataset.recipeItem);if(t.dataset.recipeMode){listPages.book=0;recipeMode=t.dataset.recipeMode;selectedRecipes[workshopTab]='';filledRecipe='';return render();}if(t.dataset.recipeStep){const list=currentRecipes(),at=list.findIndex(r=>r.id===selectedEntry()?.id);selectedRecipes[workshopTab]=list[(at+Number(t.dataset.recipeStep)+list.length)%list.length]?.id;filledRecipe='';return render();}if(t.dataset.placeContainer){const count=containerPlaceCount(t.dataset.placeContainer),outcome=game.placeContainer(t.dataset.placeContainer,count);return result(outcome,`已放置 ${count} 个${name(t.dataset.placeContainer)}`);}if(t.dataset.removeContainer)return result(game.removeContainer(t.dataset.removeContainer),'空容器已收起');if(t.dataset.transfer){const target=$(`[data-transfer-target="${t.dataset.transfer}"]`).value;return result(game.transferFluid(t.dataset.transfer,target),'流体已转移');}if(t.dataset.selectRecipe){selectedRecipes[workshopTab]=t.dataset.selectRecipe;filledRecipe='';return render();}if(t.dataset.fill){const r=selectedEntry();if(r&&r.id===t.dataset.fill&&game.canPay(r.inputs)&&game.canPay(r.tools||{})){filledRecipe=r.id;render();}return;}if(t.dataset.gather||t.dataset.gatherHit)return gatherAction(t.dataset.gather||t.dataset.gatherHit);if(t.dataset.collector)return result(game.buildCollector(t.dataset.collector),'已部署自动采集器');if(t.dataset.craft){filledRecipe='';return result(game.craft(t.dataset.craft,Number(t.dataset.count)||1),'已加入手工队列');}if(t.dataset.build){filledRecipe='';return result(game.build(t.dataset.build),'设备已建成');}if(t.dataset.toggle){game.toggle(t.dataset.toggle);persist();return render();}if(t.dataset.forceStop)return result(game.forceStop(t.dataset.forceStop),'已强制停止，可选择新配方后启动');if(t.dataset.remove)return result(game.dismantle(t.dataset.remove),'已拆除并退还原料');if(t.dataset.cancel)return result(game.cancelQueue(Number(t.dataset.cancel)),'已退还未完成批次材料');const action=t.dataset.action;if(action==='advance')result(game.advance());if(action==='export')download(exportWorld(game),'GregTech-LiteHorizons-'+new Date().toISOString().slice(0,10)+'.json');if(action==='import')$('#importFile').click();if(action==='close-modal')$('#modal').close();if(action==='reset')showModal('<h2>重新开始这个世界？</h2><p class="muted">当前存档会先下载为备份，之后创建空白世界。</p><button class="button danger" data-action="confirm-reset">备份并重置世界</button>');if(action==='confirm-reset'){download(exportWorld(game),'GregTech-LiteHorizons-before-reset.json');game=new Game();persist();$('#modal').close();render();notify('新的世界已建立');}});
document.addEventListener('click',ev=>{
  const t=ev.target.closest('button');if(!t||t.disabled)return;
  if(t.dataset.createGroup)return openGroupEditor(t.dataset.createGroup,null,t.dataset.createGroup==='device'?factoryType:'');
  if(t.dataset.editGroup){const g=game.state.groups.find(g=>g.id===t.dataset.editGroup);if(g)return openGroupEditor(g.kind,g.id,g.kind==='device'?game.members(g.id)[0]?.type:'');}
  if(t.dataset.containerPlaceStep){const id=t.dataset.containerPlaceStep;containerPlaceCounts[id]=Math.max(1,Math.min(containerPlaceLimit(id),containerPlaceCount(id)+Number(t.dataset.step)));refresh();return;}
  if(t.dataset.containerPlaceAll){const id=t.dataset.containerPlaceAll;containerPlaceCounts[id]=Math.max(1,containerPlaceLimit(id));refresh();return;}
  if(t.dataset.renameDevice){
    const d=game.state.devices.find(d=>d.id===t.dataset.renameDevice);if(!d)return;
    showModal(`<form data-rename-form="${d.id}"><h2>设备别名</h2><p class="muted">${e(machines[d.type].name)} #${d.id.slice(1)} · 留空恢复默认名称</p><label class="select-label" for="deviceAlias">别名<input class="search" id="deviceAlias" name="alias" maxlength="24" value="${e(d.alias)}" autocomplete="off"></label><div class="energy-actions"><button class="button" type="button" data-clear-alias="${d.id}">恢复默认</button><button class="button primary" type="submit">保存</button></div></form>`);
    $('#deviceAlias').focus();$('#deviceAlias').select();return;
  }
  if(t.dataset.clearAlias){const outcome=game.renameDevice(t.dataset.clearAlias,'');if(outcome.ok)$('#modal').close();return result(outcome,'已恢复默认名称');}
  if(t.dataset.deviceView){deviceViews[t.dataset.deviceView]=t.dataset.view;render();return;}
  if(t.dataset.energyMode)return result(game.setSupply(t.dataset.energyMode,t.dataset.mode,null));
  if(t.dataset.loadCoal)return result(game.loadCoal(t.dataset.loadCoal,Number(t.dataset.count)));
  if(t.dataset.batteryIn)return result(game.changeBattery(t.dataset.batteryIn,true));
  if(t.dataset.batteryOut)return result(game.changeBattery(t.dataset.batteryOut,false));
  if(t.dataset.recoverEnergy)return result(game.recoverEnergy(t.dataset.recoverEnergy));
  if(t.dataset.moduleIn)return result(game.installModule(t.dataset.moduleIn));
  if(t.dataset.emptyEnergy)return result(game.emptyDeviceEnergy(t.dataset.emptyEnergy));
  if(t.dataset.upgradeEnergyOpen){
    const d=game.state.devices.find(d=>d.id===t.dataset.upgradeEnergyOpen);if(!d)return;
    return showModal(`<h2>升级到 ${ENERGY.codes[d.energyTier+1]}</h2><p class="muted">更换机组需要以下材料，请先结束批次；电池箱需要先取出电池。</p>${stacks(game.energyUpgradeCost(d))}<button class="button primary" data-upgrade-energy="${d.id}">更换机组</button>`);
  }
  if(t.dataset.upgradeEnergy){const outcome=game.upgradeEnergy(t.dataset.upgradeEnergy);if(outcome.ok)$('#modal').close();return result(outcome,'机组已更换');}
});
document.addEventListener('submit',ev=>{
  const form=ev.target.closest('[data-rename-form]');if(!form)return;
  ev.preventDefault();const outcome=game.renameDevice(form.dataset.renameForm,form.elements.alias.value);
  if(outcome.ok)$('#modal').close();result(outcome,'设备别名已保存');
});
document.addEventListener('change',ev=>{
  const t=ev.target;
  if(t.dataset.energyOutput)return result(game.setEnergyOutput(t.dataset.energyOutput,t.value));
  if(t.dataset.fluidOutput)return result(game.setFluidOutput(t.dataset.fluidOutput,t.dataset.fluid,t.value));
});
document.addEventListener('change',ev=>{const t=ev.target;if(t.dataset.energySource){const d=game.deviceEntries().find(d=>d.id===t.dataset.energySource)||game.state.devices.find(d=>d.id===t.dataset.energySource);if(d)return result(game.setSupply(d.id,d.supply.mode,t.value));}if(t.dataset.steamOutput)return result(game.setSteamOutput(t.dataset.steamOutput,t.value));if(t.dataset.containerReserve)return result(game.reserveContainer(t.dataset.containerReserve,t.value));if(t.dataset.assign)result(game.assign(t.dataset.assign,t.value));});
document.addEventListener('pointerover',ev=>{const target=ev.target.closest('[data-item],[data-book-item],[data-lookup-item]');hoveredItem=target?.dataset.item||target?.dataset.bookItem||target?.dataset.lookupItem||'';});
document.addEventListener('keydown',ev=>{if(ev.ctrlKey||ev.altKey||ev.metaKey||ev.target.closest('input,select,textarea')||$('#modal').open||$('#choiceDialog')?.open||$('#groupDialog')?.open)return;const key=ev.key.toLowerCase();if(hoveredItem&&['r','u'].includes(key)){ev.preventDefault();lookupItem(hoveredItem,key==='u'?'uses':'recipes');}});
document.addEventListener('contextmenu',ev=>{const target=ev.target.closest('[data-item],[data-book-item],[data-lookup-item]');const id=target?.dataset.item||target?.dataset.bookItem||target?.dataset.lookupItem;if(id){ev.preventDefault();lookupItem(id,'uses');}});
let searchTimer;document.addEventListener('input',ev=>{if(ev.target.id!=='search')return;const start=ev.target.selectionStart;filter=ev.target.value;listPages[page==='workshop'?'book':page]=0;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{render();const input=$('#search');if(input){input.focus({preventScroll:true});input.setSelectionRange(start,start);}},180);});
$('#importFile').addEventListener('change',async ev=>{const file=ev.target.files[0];if(!file)return;try{if(file.size>5e6)throw Error('存档文件过大');const raw=JSON.parse(await file.text());new Game(raw);download(exportWorld(game),'GregTech-LiteHorizons-before-import.json');game=replaceWorld(raw);notify('存档导入成功');render();}catch(error){notify('导入失败：'+error.message);}ev.target.value='';});
let last=performance.now(),lastPaint=0;setInterval(()=>{const now=performance.now(),elapsed=Math.min(60,(now-last)/1000);last=now;let remaining=elapsed;while(remaining>1e-8){const dt=Math.min(.5,remaining);game.tick(dt);remaining-=dt;}if(now-lastPaint>180){refresh();lastPaint=now;}},100);
setInterval(persist,10000);window.addEventListener('beforeunload',persist);
document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();else{const gap=(performance.now()-last)/1000;if(gap>1)game.simulate(gap);last=performance.now();refresh();}});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{closeChoices();render();},120);});
render();
const offline=Math.min(OFFLINE_LIMIT,Math.max(0,(Date.now()-game.state.lastSeen)/1000));if(offline>30){const summary=game.simulate(offline);render();notify(`离线结算 ${time(summary.seconds)} · 产出 ${num(summary.produced)}`);}if(recovered)notify('主存档不可用，已从上一份有效备份恢复。');persist();
