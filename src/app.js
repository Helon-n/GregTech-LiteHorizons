import {beamKind} from './core/beamline.js';
import {itemImage} from './item-art.js';
import {isEOH} from './core/eoh.js';
import {advancedControls} from './advanced-controls.js';
import {becKind} from './core/bec.js';
import {spinTier,spinCarrier} from './core/spinmatron.js';
import {foundryTier,foundryStats} from './core/foundry.js';
import {FOUNDRY_REFERENCE as FOUNDRY} from './data/foundry-reference.js';
import {COILS} from './data/technology-catalog.js';
import {machineHeat,requirementLabels,machineSupportsRecipe} from './core/technology.js';
import {GODFORGE_REFERENCE as GODFORGE} from './data/godforge-reference.js';
import {godforgeKind} from './core/godforge.js';
import {godforgeControls,setForgeView} from './godforge-controls.js';
import {purificationTier,purificationFluids} from './core/purification.js';
import {purificationControls,setPurificationView} from './purification-controls.js';
import {naquadahFluids} from './core/naquadah.js';
import {smelteryFluids} from './core/smeltery.js';
import {configureGroupEditor,openGroupEditor} from './group-editor.js';
import {enhanceChoices,syncChoices,closeChoices,setChoiceResolver} from './choices.js';
import {applyTier,tierFor,readAppearance,saveAppearance} from './tier-theme.js';
import {appearanceMarkup,mountAppearance} from './tier-appearance.js';
import {updateText,updateDisabled,updateAttribute,updatePercent} from './live-view.js';
import {deviceReadout,updateDeviceReadout} from './device-readout.js';
import {Game} from './core/engine.js';
import {migrateRecipeFavorites} from './core/identity-migration.js';
import {energySpec,energyCapacity,voltage,generatorFuel,carrier,batteryItem,boilerProfile,boilerSteam,boilerSolidFuels,daylight} from './core/energy.js';
import {ENERGY_REFERENCE as ENERGY,recipeEnergyText} from './data/energy-reference.js';
import {loadWorld,saveWorld,exportWorld,replaceWorld} from './core/storage.js';
import {CATALOG,STAGES,items,recipes,machines,gatherNodes,containerTypes} from './data/catalog.js';
import {yieldLabel} from './core/recipe-yields.js';
import {craftingGrid,constructionSlots} from './core/workbench.js';
import {recipeEntries,recipesForItem,productName} from './core/recipe-browser.js';
import {createSearch} from './core/search.js';
import {createRecipeTreeView} from './recipe-tree.js';
import {nuclearControls,setNuclearView} from './nuclear-controls.js';
import {NUCLEAR_REFERENCE as NUCLEAR} from './data/nuclear-reference.js';
import {LAYOUT,fitRows,planGrid,gridStyle,fitPageLimits,factoryContentWidth} from './layout.js';

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
const FAVORITES_KEY='gtnh-recipe-favorites-v1';
let recipeFavorites=(()=>{try{return migrateRecipeFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]'),CATALOG);}catch{return [];}})();
let bookView='items';
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
let factorySelectorScroll=0,factorySelectorType='',focusFactorySelector=false;
const selectedRecipes={craft:'sticks',machines:'build:workbench',recipes:'bricks'};
let filledRecipe='',lastDrops=null,recipeMode='recipes',hoveredItem='',containerSignature='';
const selectedItems={craft:'stick',machines:'workbench',recipes:'brick'};
const allRecipeEntries=recipeEntries(CATALOG,STAGES.length-1);
const recipeName=r=>productName(CATALOG,r);
const favoriteKey=r=>r?.id||'';
const icon=(id,large=false)=>`<span data-item="${id}" class="item-art ${large?'large':''}">${itemImage(items[id],id)}</span>`;
const qty=id=>`<span data-qty="${id}">${num(game.quantity(id))}</span>`;
const heading=(title,action='')=>`<div class="heading"><h1>${title}</h1>${action?`<div class="heading-actions">${action}</div>`:''}</div>`;
const panel=(title,sub,body,cls='')=>`<section class="surface section ${cls}"><div class="section-head"><h3>${title}</h3><span>${sub}</span></div>${body}</section>`;
const stacks=(obj,live=true,labels=null,recipe=null)=>`<div class="stacks">${Object.entries(obj).filter(([,n])=>n>0).map(([id,n])=>`<span class="ingredient ${(recipe?game.toolQuantity(id,recipe):game.quantity(id))>=n?'enough':''}" ${live?`data-ingredient="${id}" data-need="${n}" ${recipe?`data-tool-recipe="${recipe.id}"`:''}`:''} title="${e(name(id))}">${icon(id)}<span>${e(name(id))}</span><b>${labels?e(labels(id)):num(n)}${items[id]?.kind==='fluid'?' mB':''}</b></span>`).join('')||'<span class="muted">向连接设备供能</span>'}</div>`;
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
function gatherVerb(n){return n.id.endsWith('Hunt')?'狩猎':n.id==='forest'?'砍伐':n.id==='river'?'收集':'开采';}
function dropRanges(node){return '<div class="stacks">'+Object.entries(game.dropRanges(node)).map(([id,{min,max}])=>`<span class="ingredient" title="${e(name(id))}">${icon(id)}<span>${e(name(id))}</span><b>${min===max?num(min):num(min)+'–'+num(max)}${items[id].kind==='fluid'?' mB':''}</b></span>`).join('')+'</div>';}
function collectorControls(n){
  const c=game.state.collectors[n.id];if(!c)return '';
  const workers=c.activeCount??c.count;
  return `<div class="collector-controls"><div class="worker-control"><span>同时工作 <small>/ 共 ${c.count} 台</small></span><div class="worker-stepper"><button class="button" data-worker-node="${n.id}" data-worker-count="${workers-1}" aria-label="减少工作台数" ${workers<=1?'disabled':''}>−</button><strong>${workers} 台</strong><button class="button" data-worker-node="${n.id}" data-worker-count="${workers+1}" aria-label="增加工作台数" ${workers>=c.count?'disabled':''}>＋</button><button class="button" data-worker-node="${n.id}" data-worker-count="${c.count}" ${workers===c.count?'disabled':''}>全部</button></div></div><div class="progress-label"><span>每台 ${n.seconds*4} 秒 / 轮</span><span data-auto="${n.id}"></span></div>${progress(c.elapsed/(n.seconds*4)*100,`data-collector-progress="${n.id}"`)}<button class="button full" data-toggle-collector="${n.id}">${c.enabled===false?'恢复采集':'停止采集'}</button></div>`;
}
function gatherPageNodes(key){return gatherNodes.filter(n=>key==='resources'?n.stage<5:n.stage>=5);}
function nodeAccessText(n){
  const access=game.nodeAccess(n),available=access.regions.filter(region=>region.available),region=available[0]??access.regions[0];
  const place='地区：'+(region?.name??'未知')+(access.regions.length>1?` 等 ${access.regions.length} 处`:'');
  return place+(n.miningLevel!==undefined?` · 采掘 ${n.miningLevel}+ / 当前 ${access.level}`:'')+
    (game.nodeRequirements(n).length?' · 需要 '+game.nodeRequirements(n).map(name).join('、'):'');
}
function nodeAccessTitle(n){const access=game.nodeAccess(n);return '分布：'+access.regions.map(region=>region.name).join('、')+(access.available?'':'；缺少：'+access.missing.join('、'));}
function nodeCard(n){
  const allowed=game.nodeAvailable(n),auto=game.state.collectors[n.id]?.count||0,clicks=game.state.gatherProgress[n.id]||0,total=game.gatherClicks(n),automatic=nodeViews[n.id]==='auto';
  return `<article class="surface resource-card ${automatic?'automatic':''} ${allowed?'':'locked'}" data-node="${n.id}"><div class="pool-top"><h3>${n.name}</h3><span class="pill" data-collector-badge="${n.id}">${auto?'自动 ×'+(game.state.collectors[n.id].enabled===false||!allowed?0:game.state.collectors[n.id].activeCount??auto):STAGES[n.stage].code}</span></div><div class="subtabs resource-tabs"><button class="filter ${automatic?'':'active'}" data-node-view="manual" data-node-id="${n.id}">手动采集</button><button class="filter ${automatic?'active':''}" data-node-view="auto" data-node-id="${n.id}">自动采集</button></div>${automatic?'':`<div class="gather-scene"><button class="resource-scene gather-target" data-gather-hit="${n.id}" aria-label="${gatherVerb(n)}${n.name}" ${!allowed?'disabled':''}>${resourceArt(n)}<span class="scene-grid"></span><span class="scene-hint">点击${gatherVerb(n)}</span></button><div class="drop-layer" data-drop-layer="${n.id}" aria-hidden="true"></div></div>`}<div class="pool-body"><div class="resource-title"><span>${e(n.description)}</span><strong>${qty(n.output)}${items[n.output].kind==='fluid'?'<small> mB</small>':''}</strong></div>${automatic?`${collectorControls(n)||'<p class="muted">尚未部署采集器</p>'}<div class="collector-deploy"><div class="collector-cost">部署消耗 ${stacks(game.collectorCost(n))}</div><button class="button" data-collector="${n.id}" ${!allowed?'disabled':''}>部署 +</button></div>`:`${progress(clicks/total*100,`data-gather-progress="${n.id}"`)}<div class="progress-label"><span data-click-progress="${n.id}">${clicks} / ${total} 次点击</span></div><button class="button primary full" data-gather="${n.id}" ${!allowed?'disabled':''}>${gatherVerb(n)} · +${Math.round(100/total)}%</button>`}<p class="small muted node-access" data-node-access="${n.id}" title="${e(nodeAccessTitle(n))}">${e(nodeAccessText(n))}</p><div class="node-drops"><small>每轮掉落范围</small>${dropRanges(n)}</div></div></article>`;
}

function dropSummary(){return lastDrops?`<p class="small muted">${gatherNodes.find(n=>n.id===lastDrops.id).name} · 物品入库，流体装入容器</p>${Object.keys(lastDrops.drops).length?stacks(lastDrops.drops,false):'<p class="small muted">本轮未收集到物品</p>'}${Object.keys(lastDrops.skipped||{}).length?'<p class="small storage-warning">未收集：'+Object.keys(lastDrops.skipped).map(name).join('、')+'，需要兼容的空桶或储罐容量。</p>':''}`:'<p class="small muted">暂无掉落</p>';}
function listPage(key,list,size){
  size=Math.max(1,Math.min(size,listSizeLimits.get(key)??Infinity));
  const previous=listSizes.get(key);
  if(previous&&previous!==size)listPages[key]=Math.floor((listAnchors.get(key)??(listPages[key]||0)*previous)/size);
  listSizes.set(key,size);
  const compact=['book','goals','recipe-favorites'].includes(key);
  const count=Math.max(1,Math.ceil(list.length/size));
  const index=listPages[key]=Math.max(0,Math.min(listPages[key]||0,count-1));
  const button=(target,label,disabled=false)=>`<button class="button ${target===index?'current':''}" data-list-page="${key}" data-list-index="${target}" ${disabled?'disabled':''} ${target===index?'aria-current="page"':''}>${label}</button>`;
  const indexes=[...new Set([0,...Array.from({length:5},(_,i)=>index+i-2).filter(i=>i>=0&&i<count),count-1])].sort((a,b)=>a-b);
  const numbers=compact?'':indexes.map((i,at)=>(at&&i-indexes[at-1]>1?'<span class="page-gap">…</span>':'')+button(i,i+1)).join('');
  const controls=count<2?'':`<nav class="list-pagination ${compact?'compact':''}" data-pagination="${key}" aria-label="${key==='book'?'物品列表':key==='goals'?'主线目标':'列表'}翻页">${button(index-1,compact?'‹':'上一页',index===0)}${numbers}<span class="page-count">${index+1} / ${count}</span>${button(index+1,compact?'›':'下一页',index===count-1)}</nav>`;
  return {entries:list.slice(index*size,(index+1)*size),controls};
}
function resourcesPage(){const plan=gridPlan('resources'),list=listPage('resources',gatherPageNodes('resources'),plan.size);return heading('资源采集','<button class="button" data-show-drops>最近掉落</button>')+`<div class="resource-cards fitted-cards" ${gridAttrs('resources')}>${list.entries.map(nodeCard).join('')}</div>${list.controls}`;}

function processName(p){return p==='stationResearch'?'科研站研究':Object.values(machines).find(m=>m.processes.includes(p))?.name||p;}
function workshopEntries(){
  const all=recipeEntries(CATALOG,game.state.stage);
  return workshopTab==='machines'?all.filter(r=>r.process==='build'):workshopTab==='craft'?all.filter(r=>r.process==='craft'):all;
}
function currentRecipes(){return recipesForItem(workshopEntries(),selectedItems[workshopTab],recipeMode,CATALOG);}
function selectedEntry(){return currentRecipes().find(r=>r.id===selectedRecipes[workshopTab])||currentRecipes()[0];}
function lookupItem(id,mode='recipes'){
  if(!items[id])return;
  benchView='recipe';workshopTab='recipes';recipeMode=mode;selectedItems.recipes=id;selectedRecipes.recipes='';filledRecipe='';filter='';
  page='workshop';listPages.book=0;render();
}
function saveRecipeFavorites(){
  try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(recipeFavorites));}
  catch{notify('收藏已更新，但无法写入本机设置');}
}
function toggleRecipeFavorite(){
  const r=selectedEntry();if(!r)return;
  const key=favoriteKey(r),index=recipeFavorites.findIndex(f=>f.key===key);
  if(index>=0)recipeFavorites.splice(index,1);
  else{
    recipeFavorites.unshift({key,recipeId:r.id,itemId:selectedItems[workshopTab],tab:workshopTab,mode:recipeMode});
    bookView='favorites';listPages['recipe-favorites']=0;
  }
  saveRecipeFavorites();render();$('[data-favorite-toggle]')?.focus({preventScroll:true});
}
function removeRecipeFavorite(key){
  recipeFavorites=recipeFavorites.filter(f=>f.key!==key);saveRecipeFavorites();render();
  $('[data-book-view="favorites"]')?.focus({preventScroll:true});
}
function openRecipeFavorite(key){
  const favorite=recipeFavorites.find(f=>f.key===key),r=allRecipeEntries.find(x=>x.id===favorite?.recipeId);
  if(!favorite||!r)return;
  workshopTab=favorite.tab;recipeMode=favorite.mode;selectedItems[workshopTab]=favorite.itemId;selectedRecipes[workshopTab]=r.id;
  bookView='favorites';benchView='recipe';filledRecipe='';filter='';listPages.book=0;render();
  $('[data-favorite-toggle]')?.focus({preventScroll:true});
}
function recipeTile(id){return `<button class="book-item ${id===selectedItems[workshopTab]?'selected':''}" data-book-item="${id}" aria-pressed="${id===selectedItems[workshopTab]}" title="${e(name(id))} · R 配方 / U 用途">${icon(id)}<span>${e(name(id))}</span></button>`;}
function benchSlot(id,count,output=false,label=null){
  const unit=items[id]?.kind==='fluid'?' mB':'';
  return `<button class="bench-slot ${output?'output-slot':''} ${items[id]?.kind==='fluid'?'fluid-slot':''}" data-lookup-item="${id}" aria-label="${e(name(id))} × ${count}${unit}" ${!output?`data-slot-item="${id}" data-slot-total="${selectedEntry().inputs[id]}"`:''} title="${e(name(id))} × ${count}${unit} · 点击查看配方，右键查看用途">${icon(id)}<b>${label?e(label):num(count)}${unit}</b></button>`;
}
function dispatchControls(r){
  const types=Object.values(machines).filter(m=>machineSupportsRecipe(m,r));
  const free=game.deviceEntries().filter(d=>!d.recipe&&!d.job&&!d.hasTask&&types.some(m=>m.id===d.type));
  return `<div class="dispatch-panel"><h3>工厂派工</h3>${free.length?`<label class="select-label">空闲设备<select data-dispatch-target="${r.id}">${free.map(d=>`<option value="${d.id}" data-icon="${d.type}">${e(deviceName(d))} #${d.id.slice(1)}</option>`).join('')}</select></label><button class="button primary" data-dispatch="${r.id}">派工到工厂</button>`:types.length?`<p class="muted small">没有空闲的${types.map(m=>m.name).join('、')}。</p><button class="button" data-build-for="${types[0].id}">建造${types[0].name}</button>`:'<p class="muted small">没有可执行此配方的设备。</p>'}<button class="text-link" data-page="factory">查看工厂 →</button></div>`;
}
function workbench(r){
  if(!r){const id=selectedItems[workshopTab],nodes=gatherNodes.filter(n=>Object.hasOwn(game.drops(n),id));return `<section class="surface workbench"><h2>${e(name(id))}</h2>${empty(recipeMode==='uses'?'没有收录的用途。':nodes.length?'获取地点：'+nodes.map(n=>n.name).join('、'):'没有收录的配方。',nodes.map(n=>`<button class="button" data-resource-source="${n.id}">${e(n.name)} →</button>`).join(''))}</section>`;}
  const manual=r.process==='craft',build=r.process==='build',filled=filledRecipe===r.id,alternatives=currentRecipes(),index=alternatives.findIndex(x=>x.id===r.id);
  const favoriteActive=recipeFavorites.some(f=>f.key===favoriteKey(r));
  const outputPage=listPage('bench-outputs:'+r.id,Object.entries(r.outputs),4);
  const extreme=r.gridWidth===9;
  let inputSlots=build?constructionSlots(r.id,r.inputs):manual?craftingGrid(r.id,r.inputs,r.grid):Object.entries(r.inputs).map(([id,count])=>({id,count})),inputControls='';
  if(build&&inputSlots.length>9){
    const page=listPage('bench-structure:'+r.id,inputSlots,9);
    inputSlots=page.entries;
    inputControls=`<p class="small muted">建造材料 · 共 ${Object.keys(r.inputs).length} 种</p>${page.controls}`;
  }
  if(manual&&r.gridTools)inputSlots=inputSlots.map((slot,index)=>r.gridTools[index]?{id:r.gridTools[index],count:1}:slot);
  if(extreme){
    const rows=Array.from({length:9},(_,index)=>({index,slots:inputSlots.slice(index*9,index*9+9)}));
    const page=listPage('bench-grid:'+r.id,rows,3);
    inputSlots=page.entries.flatMap(row=>row.slots);
    inputControls=`<p class="small muted">终极工作台 9 × 9 · 第 ${page.entries[0].index+1}–${page.entries.at(-1).index+1} 行，点击格子查看材料</p>${page.controls}`;
  }
  return `<section class="surface workbench ${extreme?'extreme-bench':''}" data-bench-recipe="${r.id}"><div class="nei-recipe-nav"><button class="button" data-recipe-step="-1" ${alternatives.length<2?'disabled':''} aria-label="上一配方">‹</button><span>${recipeMode==='uses'?'用途':'配方'} ${index+1} / ${alternatives.length}</span><button class="button" data-recipe-step="1" ${alternatives.length<2?'disabled':''} aria-label="下一配方">›</button><button class="button recipe-favorite-toggle ${favoriteActive?'active':''}" data-favorite-toggle aria-pressed="${favoriteActive}" aria-label="${favoriteActive?'取消收藏':'收藏'}当前配方" title="${favoriteActive?'取消收藏':'收藏当前配方'}">${favoriteActive?'★':'☆'}</button></div><div class="bench-heading"><div><h2>${e(recipeName(r))}</h2></div><span class="pill">${manual?'工作台':build?'机器建造':processName(r.process)}</span></div><div class="bench-meta recipe-facts"><span><b>主线参考</b><strong>${STAGES[r.stage].code}</strong></span><span><b>加工方式</b><strong>${manual?'工作台手工':build?'机器建造':e(processName(r.process))}</strong></span><span><b>耗能</b><strong>${e(recipeEnergyText(r))}</strong></span>${requirementLabels(game,r).map(label=>`<span><b>加工条件</b><strong>${e(label)}</strong></span>`).join('')}${r.circuit?`<span><b>设备设定</b><strong>编程电路 ${r.circuit} · 不消耗</strong></span>`:''}</div><div class="bench-layout ${filled?'filled':'ghost'}" style="--input-columns:${Math.max(1,Math.min(3,Object.keys(r.inputs).length))};--output-columns:${Math.max(1,Math.min(2,Object.keys(r.outputs).length))}"><div class="${manual||build?'bench-grid':'process-slots'}" role="group" aria-label="${extreme?'终极工作台原料配方':manual||build?'九宫格原料配方':'机器投入原料'}">${inputSlots.map(slot=>slot?benchSlot(slot.id,slot.count):'<div class="bench-slot vacant" aria-hidden="true"></div>').join('')}</div><span class="bench-arrow" aria-hidden="true">➜</span><div class="bench-outputs" aria-label="产物">${outputPage.entries.map(([id,count])=>benchSlot(id,count,true,yieldLabel(r,id))).join('')||`<div class="bench-slot output-slot">${icon('turbine')}<span>向连接设备供能</span></div>`}</div></div>${inputControls}${outputPage.controls}${r.tools?`<div class="bench-tools"><span>工具 · 保留</span>${stacks(r.tools,true,null,r)}</div>`:''}<p class="bench-status" data-bench-status role="status"></p><div class="bench-actions">${manual||build?`<button class="button" data-fill="${r.id}">${filled?'重新放入材料':'放入材料'}</button>${manual?`<button class="button" data-craft="${r.id}" data-count="5">合成 ×5 批</button><button class="button primary" data-craft="${r.id}" data-count="1">合成</button>`:`<button class="button primary" data-build="${r.machine}">建造</button>`}`:''}</div></section>`;
}
function roomyWorkbench(){return viewport.width>=1350&&viewport.height>=900;}
function recipeMaterials(r){
  const list=listPage('recipe-materials',Object.entries(r.inputs),3);
  return panel('每批原料','库存 / 需求',`<div class="recipe-materials">${list.entries.map(([id,count])=>`<button class="recipe-material" data-lookup-item="${id}" data-slot-item="${id}" data-slot-total="${count}" title="${e(name(id))} · 查看配方">${icon(id)}<span><strong>${e(name(id))}</strong><small>${qty(id)} / ${num(count)}${items[id]?.kind==='fluid'?' mB':''}</small></span></button>`).join('')}</div>${list.controls}`,'recipe-material-panel');
}
const recipeTree=createRecipeTreeView({
  getGame:()=>game,e,icon,name,num,listPage,rows,processName,updateText,updateDisabled,notify,render,result,
  refit:()=>{if(fitPageLimits($('#page'),gridPlans,gridRowLimits,listSizeLimits))render();},
  favorites:()=>recipeFavorites.map(f=>f.recipeId),
  open:(id,recipe)=>{
    workshopTab='recipes';recipeMode='recipes';selectedItems.recipes=id;
    selectedRecipes.recipes=recipe||'';benchView='recipe';filledRecipe='';filter='';render();
  }
});
function workshop(){
  const all=workshopEntries(),query=filter.trim(),matches=createSearch(query),ids=[...new Set(all.flatMap(r=>Object.keys(recipeMode==='uses'?{...r.inputs,...r.tools}:r.outputs)))];
  if(!selectedItems[workshopTab])selectedItems[workshopTab]=ids[0];
  const selected=selectedEntry();if(selected)selectedRecipes[workshopTab]=selected.id;
  const canDispatch=!!selected&&selected.process!=='build';
  if(benchView==='dispatch'&&!canDispatch)benchView='recipe';
  const bookWidth=Math.min(410,Math.max(262,viewport.width*.24)),bookPlan=gridPlan('book',270,bookWidth-26);
  const visible=ids.filter(id=>matches(name(id),id)),list=listPage('book',visible,bookPlan.size);
  const favoriteEntries=recipeFavorites.map(f=>({favorite:f,recipe:allRecipeEntries.find(r=>r.id===f.recipeId)})).filter(x=>x.recipe&&matches(x.recipe.name,recipeName(x.recipe),x.recipe.id));
  const favoriteList=listPage('recipe-favorites',favoriteEntries,Math.max(1,Math.floor((viewport.height-270)/63)));
  const switches=`<div class="subtabs bench-switch">${[['recipe','配方'],['tree','配方树'],...(canDispatch?[['dispatch','工厂派工']]:[]),['queue',`手工队列 <span data-queue-count>${game.state.queue.length}</span>`]].map(([id,label])=>`<button class="filter ${benchView===id?'active':''}" data-bench-view="${id}">${label}</button>`).join('')}</div>`;
  const roomy=roomyWorkbench()&&benchView==='recipe'&&selected;
  const recipeDetail=roomy?`<div class="bench-content"><div class="bench-primary">${workbench(selected)}${panel('手工队列','',`<div id="queuePanel">${queuePanel()}</div>`)}</div><aside class="bench-rail">${recipeMaterials(selected)}${canDispatch?`<section class="surface section">${dispatchControls(selected)}</section>`:''}</aside></div>`:workbench(selected);
  const detail=benchView==='tree'?recipeTree.render(selected,selectedItems[workshopTab]):benchView==='queue'?panel('手工队列','',`<div id="queuePanel">${queuePanel()}</div>`):benchView==='dispatch'&&canDispatch?`<section class="surface workbench"><h2>${e(recipeName(selected))}</h2>${dispatchControls(selected)}</section>`:recipeDetail;
  const bookContent=bookView==='items'?`<div class="book-items" ${gridAttrs('book')}>${list.entries.map(recipeTile).join('')||'<p class="muted small">没有匹配的物品。</p>'}</div>${list.controls}`:`<div class="recipe-favorite-list" data-fit-list="recipe-favorites">${favoriteList.entries.map(({favorite,recipe})=>{
    const active=selected?.id===recipe.id;
    return `<div class="recipe-favorite-card"><button class="recipe-favorite ${active?'active':''}" data-favorite-open="${e(favorite.key)}" ${active?'aria-current="true"':''} title="${e(recipe.name)} · ${e(recipe.process==='craft'?'工作台':recipe.process==='build'?'机器建造':processName(recipe.process))}">${icon(Object.keys(recipe.outputs)[0]||favorite.itemId)}<span><strong>${e(recipe.name)}</strong><small>${e(recipe.process==='craft'?'工作台':recipe.process==='build'?'机器建造':processName(recipe.process))}</small></span></button><button class="favorite-remove" data-favorite-remove="${e(favorite.key)}" aria-label="取消收藏${e(recipe.name)}" title="取消收藏">×</button></div>`;
  }).join('')||(query?'<p class="muted small">没有匹配的收藏。</p>':'<p class="muted small">点击配方上方的 ☆ 收藏。</p>')}</div>${favoriteList.controls}`;
  return heading('配方与工作台',`<input class="search" id="search" placeholder="物品 / 拼音 / 首字母" value="${e(filter)}">`)+`<div class="subtabs workshop-tabs">${[['craft','工作台'],['machines','机器建造'],['recipes','全部配方']].map(([id,label])=>`<button class="filter ${workshopTab===id?'active':''}" data-tab="${id}">${label}</button>`).join('')}<span class="nei-tab-spacer"></span><button class="filter ${recipeMode==='recipes'?'active':''}" data-recipe-mode="recipes">获取配方 R</button><button class="filter ${recipeMode==='uses'?'active':''}" data-recipe-mode="uses">用途 U</button></div><div class="workshop-layout" style="--book-width:${bookWidth}px"><section class="surface recipe-book"><div class="section-head"><h3>${bookView==='items'?'配方图鉴':'收藏'}</h3><span>${bookView==='items'?visible.length+' 项':recipeFavorites.length+' 条'}</span></div><div class="subtabs recipe-book-switch"><button class="filter ${bookView==='items'?'active':''}" data-book-view="items" aria-pressed="${bookView==='items'}">图鉴</button><button class="filter ${bookView==='favorites'?'active':''}" data-book-view="favorites" aria-pressed="${bookView==='favorites'}">收藏 ${recipeFavorites.length}</button></div>${bookContent}</section><div class="bench-column">${switches}${detail}</div></div>`;
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
function deviceStacks(d,r,direction){
  const page=listPage('device-'+direction+':'+d.id,Object.entries(r[direction]),3);
  return stacks(Object.fromEntries(page.entries),direction==='inputs',direction==='outputs'?id=>yieldLabel(r,id):null)+page.controls;
}
function fluidInputControls(d){
  const r=game.deviceRecipe(d),spec=energySpec(game,d),fluids=Object.keys(r?.inputs||{}).filter(id=>items[id]?.kind==='fluid'&&!(spec?.cycle==='turbine'&&id===r.turbineFuel)&&!(spec?.cycle==='thermal'&&['water','distilledWater'].includes(id)));
  if(energySpec(game,d)?.kind==='boiler'&&boilerProfile(game,d).lava)fluids.push('lava');
  if(energySpec(game,d)?.cycle==='combustion')fluids.push('lubricant','oxygen');
  if(spinTier(game,d))fluids.push(spinCarrier(d));
  if(foundryTier(game,d)&&foundryStats(d).coolant)fluids.push(...FOUNDRY.coolants.map(c=>c.item));
  if(r?.incubation)fluids.push(r.incubation.seedFluid);
  if(r?.bath)fluids.push(r.bath.fluid);
  if(godforgeKind(game,d)==='host')fluids.push(GODFORGE.fuels[d.godforge?.fuel??0]);
  fluids.push(...purificationFluids(game,d));
  fluids.push(...naquadahFluids(game,d));
  fluids.push(...smelteryFluids(game,d));
  if(d.nuclear?.fluid)fluids.push(NUCLEAR.cold);
  if(!fluids.length)return '';
  const list=listPage('fluid-inputs:'+d.id,[...new Set(fluids)],1);
  return list.entries.map(fluid=>{
    const tanks=game.containerEntries().filter(c=>game.acceptsFluid(c,fluid)&&(!c.fluid||c.fluid===fluid)||c.id===d.fluidInputs[fluid]);
    return `<label class="select-label">${e(name(fluid))} ← 输入容器<select data-fluid-input="${d.id}" data-fluid="${fluid}"><option value="">${fluid==='lava'?'选择熔岩容器':'自动从兼容容器取用'}</option>${tanks.map(c=>`<option value="${c.id}" data-icon="${c.type}" ${d.fluidInputs[fluid]===c.id?'selected':''}>${e(c.group?c.name:name(c.type))} #${c.id.slice(1)}</option>`).join('')}</select></label>`;
  }).join('')+list.controls;
}
function outputControls(d){
  const kind=energySpec(game,d)?.kind;
  if(kind==='boiler'&&(boilerProfile(game,d).exchanger||boilerProfile(game,d).thermal))return deviceReadout(game,d)+fluidOutputControls(d);
  let body=energySpec(game,d)?deviceReadout(game,d):'';
  if(kind==='boiler'){
    const steam=boilerSteam(game,d);
    const tanks=game.containerEntries().filter(c=>(game.acceptsFluid(c,steam)&&(!c.fluid||c.fluid===steam))||c.id===d.output);
    return body+`<label class="select-label">余汽送入储罐<select data-steam-output="${d.id}"><option value="">保留在锅炉</option>${tanks.map(c=>`<option value="${c.id}" data-icon="${c.type}" ${d.output===c.id?'selected':''}>${e(name(c.type))} #${c.id.slice(1)}</option>`).join('')}</select></label><p class="muted small">直连设备先取汽，剩余蒸汽存入指定储罐。</p>`;
  }
  if(['generator','dyson','solar'].includes(kind)||isEOH(game,d)){
    const boxes=game.deviceEntries().filter(b=>(energySpec(game,b)?.kind==='battery'&&voltage(d)<=voltage(b))||b.id===d.output);
    body+=`<label class="select-label">电力输出到<select data-energy-output="${d.id}"><option value="">按电池箱连接充电</option>${boxes.map(b=>`<option value="${b.id}" data-icon="${b.type}" ${d.output===b.id?'selected':''}>${e(deviceName(b))} #${b.id.slice(1)}</option>`).join('')}</select></label><p class="muted small">直连设备先用电，剩余电力为指定电池箱充电。电池箱需要装入电池。</p>`;
  }
  return body+fluidOutputControls(d);
}
function energyControls(d){
  const spec=energySpec(game,d),type=carrier(game,d),mode=d.supply.mode,options=type?game.supplyOptions(d):[],fuel=generatorFuel(game,d);
  let body=deviceReadout(game,d,{compact:true});
  if(beamKind(game,d)||becKind(game,d)||spinTier(game,d)||isEOH(game,d)||foundryTier(game,d))body+=`<button class="button" data-advanced-open="${d.id}">${beamKind(game,d)?'粒子束流连接与设置':foundryTier(game,d)?'铸造模块与冷却':becKind(game,d)?'凝聚态网络与蜂群':isEOH(game,d)?'演化场与预充电':'离心转子与助剂'}</button>`;
  if(spec.cycle==='smeltery')return body+fluidInputControls(d)+'<p class="muted small">熔岩、热冷却液或玄武岩熔岩供热；按燃料温度加热，达到熔点后输出。燃烧储备由整炉共用，暂停仍会消耗已点燃燃料。</p>'+(d.group?'':`<button class="text-link" data-empty-energy="${d.id}">散去剩余燃烧储备</button>`);
  if(spec.cycle==='nuclear')return body+nuclearControls({game,d,icon,name,num,e,fluidInputControls});
  if(purificationTier(game,d)&&purificationTier(game,d)!=='host')return body+purificationControls({game,d,icon,name,num,e,listPage,fluidInputControls,deviceName});
  if(spec.cycle==='solarTower')return body+fluidInputControls(d)+`<p class="muted small">${daylight(game)?'白天':'夜间'} · 每 10 秒蓄热，热量达到 30,000 且启动完成后，将冷太阳盐等量转为热太阳盐。</p><button class="button" data-sky-access="${d.id}" data-visible="${!d.skyAccess}">${d.skyAccess?'露天运行':'上方遮挡'}</button>`;
  if(spec.cycle==='ic2RTG')return body+`<p class="muted small">六个同位素槽，每槽放入一枚燃料。按每台已装入槽位数发电：1、2、4、8、16、32 EU/t；燃料不消耗。</p><div class="energy-actions"><button class="button" data-isotope-in="${d.id}">装入一枚</button><button class="button" data-isotope-out="${d.id}">取出一枚</button>${d.group?'':`<button class="text-link" data-empty-energy="${d.id}">排空机内电量</button>`}</div>`;
  if(godforgeKind(game,d)){
    const controls=godforgeControls({game,d,icon,name,num,e,listPage,stacks,fluidInputControls,deviceName});
    if(godforgeKind(game,d)==='host')return controls;
    body+=controls;
  }
  if(machines[d.type].coils)body+=`<p class="muted small">线圈：${d.coil?e(name(d.coil)):'未安装'} · ${num(machineHeat(game,d))} K</p><button class="button" data-coil-open="${d.id}">更换线圈</button>`;
  if(spec.kind==='consumer')body+=`<div class="energy-modes" role="group" aria-label="设备地点">${[['ground','地面'],['orbit','轨道']].map(([value,label])=>`<button class="filter ${d.location===value?'active':''}" data-machine-location="${d.id}" data-location="${value}" aria-pressed="${d.location===value}">${label}</button>`).join('')}</div>`;
  if(spec.kind==='boiler'){
    const B=boilerProfile(game,d),count=d.group?.members.length||1;
    if(B.thermal)return body+`<label class="select-label">进水来源<select data-energy-source="${d.id}"><option value="">自动从兼容容器取水</option>${options.map(c=>`<option value="${c.id}" ${d.supply.source===c.id?'selected':''}>${e(c.group?c.name:name(c.type))}</option>`).join('')}</select></label>${fluidInputControls(d)}<p class="muted small">用热流体产汽，持续运行后达到额定效率。仓库中的熔岩过滤器会自动装入；有过滤器时可回收金属副产物。</p>`;
    if(B.exchanger)return body+`<label class="select-label">蒸馏水来源<select data-energy-source="${d.id}"><option value="">自动从兼容容器取水</option>${options.map(c=>`<option value="${c.id}" data-icon="${c.type}" ${d.supply.source===c.id?'selected':''}>${e(c.group?c.name:name(c.type))}</option>`).join('')}</select></label>${fluidInputControls(d)}<div class="energy-actions"><button class="button" data-boiler-circuit="${d.id}" data-value="${Math.max(0,d.boilerCircuit-1)}" ${d.boilerCircuit===0?'disabled':''}>−</button><span>换热电路 ${d.boilerCircuit}</span><button class="button" data-boiler-circuit="${d.id}" data-value="${Math.min(25,d.boilerCircuit+1)}" ${d.boilerCircuit===25?'disabled':''}>＋</button></div><p class="muted small">流量达到阈值后改产高温蒸汽。电路 2–25 降低切换阈值，每级损失 1.5% 换热效率；冷却液与两种蒸汽可分别设置输出容器。</p>${d.group?'':`<button class="text-link" data-empty-energy="${d.id}">排空机内能源</button>`}`;
    if(B.large){
      const solid=boilerSolidFuels(game,d).length?`<label class="select-label">固体燃料<select id="boiler-fuel-${d.id}">${boilerSolidFuels(game,d).map(id=>`<option value="${id}" ${d.solidFuel===id?'selected':''}>${e(name(id))}</option>`).join('')}</select></label><div class="energy-actions">${[1,16,64].map(n=>`<button class="button" data-load-boiler-fuel="${d.id}" data-count="${n}">${d.group?'全组投入':'投入'} ×${n}</button>`).join('')}</div>`:'';
      return body+`<label class="select-label">进水来源<select data-energy-source="${d.id}"><option value="">自动从兼容容器取水</option>${options.map(c=>`<option value="${c.id}" ${d.supply.source===c.id?'selected':''}>${e(c.group?c.name:name(c.type))}</option>`).join('')}</select></label><p class="muted small">额定 ${num(B.steamPerSecond*count)} mB/s ${name(B.steam)}。${B.steam==='steam'?'固体与液体可同时供热。':'需使用适用的高热值燃料。'}</p>${solid}${fluidInputControls(d)}<div class="energy-actions"><button class="button" data-boiler-circuit="${d.id}" data-value="${Math.max(0,d.boilerCircuit-1)}" ${d.boilerCircuit===0?'disabled':''}>−</button><span>节流电路 ${d.boilerCircuit}</span><button class="button" data-boiler-circuit="${d.id}" data-value="${Math.min(25,d.boilerCircuit+1)}" ${d.boilerCircuit===25?'disabled':''}>＋</button></div><p class="muted small">节流在下一次装入燃料时生效；降低产汽速度，延长燃烧时间。</p>${d.group?'':`<button class="text-link" data-empty-energy="${d.id}">排空机内能源</button>`}`;
    }
    const fuelControls=B.solar?`<p class="muted small">${daylight(game)?'白天':'夜间'} · 结垢运行 ${num(d.calcification/20)} 秒；使用蒸馏水可避免继续结垢。</p><button class="button" data-sky-access="${d.id}" data-visible="${!d.skyAccess}">${d.skyAccess?'露天运行':'上方遮挡'}</button>`:B.lava?fluidInputControls(d):`<label class="select-label">投入燃料<select id="boiler-fuel-${d.id}">${boilerSolidFuels(game,d).map(id=>`<option value="${id}" ${d.solidFuel===id?'selected':''}>${e(name(id))}</option>`).join('')}</select></label><div class="energy-actions">${[1,16,64].map(n=>`<button class="button" data-load-boiler-fuel="${d.id}" data-count="${n}">${d.group?'全组投入':'投入'} ×${n}</button>`).join('')}</div>${d.group?'<p class="muted small">投入数量为全组总量；优先补给余量少的锅炉，各炉共用组内存煤。</p>':''}`;
    return body+`<label class="select-label">进水来源<select data-energy-source="${d.id}"><option value="">自动从兼容容器取${name(d.waterFluid)}</option>${options.map(c=>`<option value="${c.id}" ${d.supply.source===c.id?'selected':''}>${e(c.group?c.name:name(c.type))}</option>`).join('')}</select></label><p class="muted small">高于 100 °C 产汽，额定 ${B.steamPerSecond*count} mB/s；1 mB 水 → 160 mB 蒸汽。</p>${fuelControls}${d.group?'':`<button class="text-link" data-empty-energy="${d.id}">排空机内能源</button>`}`;
  }
  if(type){
    if(spec.kind!=='battery'&&!spec.prepaid&&(type==='electric'||['steam','superheatedSteam','supercriticalSteam','denseSteam','denseSuperheatedSteam','denseSupercriticalSteam'].includes(type)))body+=`<div class="energy-modes" role="group" aria-label="供能方式">${[['direct','直连产能设备'],['storage',type==='electric'?'从电池箱取电':'从储罐取汽']].map(([value,label])=>`<button class="filter ${mode===value?'active':''}" data-energy-mode="${d.id}" data-mode="${value}" aria-pressed="${mode===value}">${label}</button>`).join('')}</div>`;
    body+=`<label class="select-label">${spec.kind==='battery'?'充电来源':['generator','dyson','solar'].includes(spec.kind)?'燃料 / 冷却液来源':'供能来源'}<select data-energy-source="${d.id}"><option value="">${spec.kind==='dyson'?'自动从兼容容器取冷却液':'选择'+(mode==='direct'?'产能设备':type==='electric'?'电池箱':'储罐')}</option>${options.map(s=>`<option value="${s.id}" data-icon="${s.type}" ${d.supply.source===s.id?'selected':''}>${name(s.type)} #${s.id.slice(1)}${s.energyTier?' · '+ENERGY.codes[s.energyTier]:''}</option>`).join('')}</select></label>`;
  }
  body+=fluidInputControls(d);
  if(spec.prepaid&&!godforgeKind(game,d))body+='<p class="muted small">开工时从选定的实体电池组一次扣除整批电量，不超频。暂停保留已付批次；强制停止会损失本批投入。</p>';
  if(spec.cycle==='turbine'){
    if(d.group)body+='<p class="muted small">展开成员，逐台装入转子。转子决定最大流量和效率，排气与冷凝水需要输出容器。</p>';
    else body+=`<label class="select-label">涡轮转子<select data-rotor-change="${d.id}"><option value="">${d.rotor?'取出当前转子':'选择转子'}</option>${d.rotor?'<option value="current" selected disabled>已装入 '+e(name(d.rotor.item))+'</option>':''}${Object.values(items).filter(i=>i.rotor&&game.quantity(i.id)>0).map(i=>`<option value="${i.id}" data-icon="${i.id}">${e(i.name)} · 新品 ×${num(game.quantity(i.id))}</option>`).join('')}${game.state.components.map((c,i)=>c.kind==='rotor'?`<option value="used:${i}" data-icon="${c.item}">${e(name(c.item))} · 剩余 ${num(c.life)} / ${num(items[c.item].rotor.durability)}</option>`:'').join('')}</select></label><p class="muted small">${spec.rotorSlots===12?'需要 12 个相同材质和尺寸的转子。':''}${d.rotor?e(name(d.rotor.item))+' · '+(d.rotor.lives?'可用 '+d.rotor.lives.filter(n=>n>0).length+'/12 · ':'')+'最小剩余耐久 '+num(d.rotor.life):'尚未装入转子'}。更换前请强制停止。</p>`;
    body+=`<div class="energy-modes" role="group" aria-label="转子装配">${[[false,'紧密装配'],[true,'宽松装配']].map(([loose,label])=>`<button class="filter ${!!d.looseFit===loose?'active':''}" data-turbine-fit="${d.id}" data-loose="${loose}" aria-pressed="${!!d.looseFit===loose}">${label}</button>`).join('')}</div>`;
  }
  if(d.type==='nanochipBoardProcessor')body+=`<div class="energy-actions"><button class="button" data-bath-threshold="${d.id}" data-value="${Math.max(1,(d.bathFlushPercent??100)-5)}">−</button><span>杂质 ${d.bathFlushPercent??100}% 自动排液</span><button class="button" data-bath-threshold="${d.id}" data-value="${Math.min(100,(d.bathFlushPercent??100)+5)}">＋</button></div>`+'<p class="muted small">浸液容量 1,000,000 mB，至少半满才能加工。洁净度影响速度；排液会将整槽转换为废液。</p>'+`<button class="button" data-board-flush="${d.id}">排出浸液</button>`;
  if(spec.cycle==='combustion')body+='<p class="muted small">额定 2048 EU/t；持续供氧后最高 6144 EU/t。需要润滑油，启动阶段消耗燃料，达到启动效率后开始输出。</p>';
  if(spec.cycle==='naquadah')body+='<p class="muted small">每秒使用液态空气；冷却液提高效率，激发液提高批次燃料量与输出。按原版优先级自动取用已连接容器的流体，逐秒消耗；缺液会降低或停止发电，乏燃料需要输出容器。输出仓为 64 A，可升级电压。</p>';
  if(spec.kind==='solar')body+=`<p class="muted small">${daylight(game)?'白天':'夜间'} · 露天、晴天输出电力。</p><button class="button" data-sky-access="${d.id}" data-visible="${!d.skyAccess}">${d.skyAccess?'露天运行':'上方遮挡'}</button>`;
  if(fuel)body+=`<p class="muted small">${fuel.amount} ${fuel.solid?'个':'mB'} ${name(fuel.id)} → ${num(fuel.eu)} EU${fuel.efficiency?' · 效率 '+fuel.efficiency+'%':''} · 输出 ${d.group?.members.length||1} A</p>`;
  if(spec.kind==='battery'&&!d.group)body+=`<div class="battery-slots" aria-label="电池槽">${Array.from({length:4},(_,i)=>`<span class="battery-slot ${i<d.batteries?'occupied':''}">${i<d.batteries?icon(batteryItem(d)):'＋'}</span>`).join('')}</div><div class="energy-actions"><button class="button" data-battery-in="${d.id}" ${d.batteries>=4?'disabled':''}>装入电池</button><button class="button" data-battery-out="${d.id}" ${!d.batteries?'disabled':''}>取出一节</button>${game.state.legacyEnergy?`<button class="button" data-recover-energy="${d.id}">转存旧版电量</button>`:''}</div>`;
  if(spec.kind==='dyson'&&!d.group)body+=`<p class="muted small">每模块 ${num(ENERGY.dyson.euPerModule)} EU/t；每小时消耗 ${num(ENERGY.dyson.coolant)} mB 极寒之凛冰，模块会损耗。</p><button class="button" data-module-in="${d.id}">装入戴森模块</button>`;
  if(!d.group&&spec.maxTier&&d.energyTier<spec.maxTier)body+=`<button class="text-link" data-upgrade-energy-open="${d.id}">升级到 ${ENERGY.codes[d.energyTier+1]}</button>`;
  if(!d.group)body+=`<button class="text-link" data-empty-energy="${d.id}" title="暂停后可退回机内流体；剩余电量会散去">排空机内能源</button>`;
  return body;
}
function deviceCard(d){
  if(d.group)d.blocked=deviceStackStatus(game.members(d.id));
  const m=machines[d.type],spec=energySpec(game,d),current=game.deviceRecipe(d),options=game.machineRecipes(d.type);
  const hasFluidOutputs=game.fluidOutputTypes(d.id).length>0,hasOutputs=['boiler','generator','dyson','solar'].includes(spec?.kind)||isEOH(game,d)||hasFluidOutputs;
  const outputView=hasOutputs&&deviceViews[d.id]==='output',energyView=!!spec&&(spec.kind==='battery'||deviceViews[d.id]==='energy'),run=game.deviceRuntime(d,current);
  const production=beamKind(game,d)==='collider'?`${deviceReadout(game,d,{compact:true})}<p class="muted small">${d.beam.modules.length} 个探测模块 · 加速 ${d.beam.step} / ${d.beam.cycles}</p><button class="button" data-advanced-open="${d.id}">粒子束流连接与设置</button>`:becKind(game,d)==='storage'?`<button class="button" data-advanced-open="${d.id}">磁场与网络存量</button>`:['ic2RTG','nuclear'].includes(spec?.cycle)?energyControls(d):purificationTier(game,d)==='host'?purificationControls({game,d,icon,name,num,e,listPage,fluidInputControls,deviceName}):godforgeKind(game,d)==='host'?godforgeControls({game,d,icon,name,num,e,listPage,stacks,fluidInputControls,deviceName}):`<label class="select-label">运行配方<select data-assign="${d.id}" ${d.job?'disabled':''} title="${d.job?'切换配方前请先强制停止，或等待本批完成':'选择生产配方'}"><option value="">选择配方…</option>${options.map(r=>`<option value="${r.id}" ${d.recipe===r.id?'selected':''}>${e(recipeName(r))}</option>`).join('')}</select></label>${spec?deviceReadout(game,d,{compact:spec.kind!=='boiler'}):''}${spec?.kind==='boiler'?'':`<div class="device-io">${current?`<div>${deviceStacks(d,current,'inputs')}</div><span>→</span><div>${deviceStacks(d,current,'outputs')}</div>`:'<p class="muted small">尚未选择配方</p>'}</div>`}${hasFluidOutputs?fluidOutputSummary(d):''}${progress(d.job?(1-d.job.remaining/(d.job.duration||run.seconds))*100:0,`data-device-bar="${d.id}"`)}`;
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
    const plan=gridPlan('stack',194,factoryContentWidth(viewport.width)),list=listPage('stack:'+key,game.members(d.id),plan.size);
    return `<article class="device-stack expanded" data-device-stack="${key}"><div class="stack-footer"><h3>${e(d.alias)} · ${d.group.members.length} 台</h3><button class="button" data-edit-group="${d.id}">管理组</button><button class="button" data-expand-stack="${key}">收起成员</button></div><p class="small muted">成员共用组的输入输出设置；电池和机内物料逐台管理。</p><div class="device-grid stack-devices" ${gridAttrs('stack')}>${list.entries.map(deviceCard).join('')}</div>${list.controls}</article>`;
  }
  if(devices.length===1&&!expandedDeviceStacks.has(key))return deviceCard(devices[0]);
  const d=devices[0],r=game.recipeById.get(d.recipe),expanded=expandedDeviceStacks.has(key),contentId=`stack-${key}`;
  if(expanded){const plan=gridPlan('stack',194,factoryContentWidth(viewport.width)),list=listPage('stack:'+key,devices,plan.size);return `<article class="device-stack expanded" data-device-stack="${key}"><div class="stack-footer"><h3>${e(recipeName(r))} · ${devices.length} 台</h3><button class="button" data-expand-stack="${key}" aria-expanded="true" aria-controls="${contentId}">收起设备</button></div><div id="${contentId}" class="device-grid stack-devices" ${gridAttrs('stack')}>${list.entries.map(deviceCard).join('')}</div>${list.controls}</article>`;}
  return `<article class="surface device-stack" data-device-stack="${key}"><div class="card-top">${icon(d.type)}<div><h3>${e(recipeName(r))}</h3><p>${machines[d.type].name}</p></div><span class="pill">×${devices.length} 台</span></div><div class="stack-recipe"><small>每台每批 · ${["generator","boiler","dyson"].includes(energySpec(game,d)?.kind)?e(recipeEnergyText(r)):game.deviceRuntime(d,r).seconds+" 秒 · "+(d.energyTier?ENERGY.codes[d.energyTier]:"蒸汽")}</small><div class="device-io"><div>${deviceStacks(d,r,'inputs')}</div><span>→</span><div>${deviceStacks(d,r,'outputs')}</div></div></div><div class="stack-footer"><span class="device-status" data-stack-status="${devices.map(d=>d.id).join(',')}">${e(deviceStackStatus(devices))}</span>${game.fluidOutputTypes(d.id).length?`<button class="button" data-expand-stack="${key}" data-stack-output="${devices.map(d=>d.id).join(',')}">输出容器</button>`:''}<button class="button" data-expand-stack="${key}" aria-expanded="false" aria-controls="${contentId}">展开设备</button></div></article>`;
}

function factory(){
  const endpoints=game.deviceEntries();
  const groups=Object.keys(machines).map(type=>({type,devices:endpoints.filter(d=>d.type===type)})).filter(group=>group.devices.length);
  if(!groups.some(group=>group.type===factoryType)){factoryType=groups[0]?.type||'';listPages.factory=0;expandedDeviceStacks.clear();}
  const matching=groups.filter(group=>group.type===factoryType);
  const sections=[true,false].flatMap(task=>matching.map(group=>{
    const devices=group.devices.filter(d=>task===null||Boolean(d.hasTask||d.recipe||d.job)===task),entries=[];
    const stacksByRecipe=new Map();
    for(const d of devices){
      const fluidPorts=Object.entries(d.fluidOutputs).sort(([a],[b])=>a.localeCompare(b)).map(([fluid,target])=>fluid+'_'+target).join('_');
      const inputPorts=Object.entries(d.fluidInputs).sort(([a],[b])=>a.localeCompare(b)).map(([fluid,target])=>fluid+'_'+target).join('_');
      const key=[group.type,d.recipe,d.energyTier,d.supply.mode,d.supply.source||'none',d.output||'none',fluidPorts,inputPorts,d.solidFuel,d.waterFluid,d.fuelType,d.skyAccess,d.coil,d.location].join('-');
      if(game.recipeById.has(d.recipe)&&!d.alias&&!machines[d.type].godforge&&!machines[d.type].purification&&energySpec(game,d)?.cycle!=='naquadah'){
        if(!stacksByRecipe.has(key)){const entry={key,devices:[]};stacksByRecipe.set(key,entry);entries.push(entry);}
        stacksByRecipe.get(key).devices.push(d);
      }else entries.push({key:d.id,devices:[d]});
    }
    return {...group,devices,entries,task};
  }).filter(group=>group.devices.length));
  const entries=sections.flatMap(group=>group.entries);
  for(const key of expandedDeviceStacks)if(!entries.some(entry=>entry.key===key))expandedDeviceStacks.delete(key);
  const plan=gridPlan('factory',124,factoryContentWidth(viewport.width));
  const list=expandedDeviceStacks.size?{entries:entries.filter(entry=>expandedDeviceStacks.has(entry.key)),controls:''}:listPage('factory',entries,plan.size),shown=sections.map(group=>({...group,visible:group.entries.filter(entry=>list.entries.includes(entry))})).filter(group=>group.visible.length);
  const rail=LAYOUT.factorySidebar,railWidth=viewport.width<rail.compactAt?rail.compactWidth:rail.width;
  const typeButton=g=>{
    const count=g.devices.reduce((n,d)=>n+(d.group?.members.length||1),0),active=g.type===factoryType;
    return `<button class="filter machine-type ${active?'active':''}" data-factory-type="${g.type}" aria-pressed="${active}" aria-controls="factoryDevices">${icon(g.type)}<span>${e(machines[g.type].name)}</span><b>${count}</b></button>`;
  };
  return heading('生产工厂','<button class="button" data-create-group="device">创建设备组</button><button class="button primary" data-workshop="machines">＋ 建造设备</button>')+`<div class="factory-toolbar"><span class="muted">运行 <b data-running>0</b> · 待料 / 待电 <b data-waiting>0</b> · ${game.state.devices.length} 台设备</span><span class="stat-eu">${icon('turbine')}<strong data-energy>${num(game.state.energy)}</strong> EU</span></div><div class="factory-layout" style="--factory-rail-width:${railWidth}px;--factory-gap:${rail.gap}px"><aside class="surface factory-machine-picker" aria-label="选择机器"><h3>机器分类 <small>${groups.length} 类</small></h3><div class="machine-categories" role="group" aria-label="机器分类" data-factory-selector>${groups.map(typeButton).join('')||'<p class="muted small">尚未建造机器</p>'}</div></aside><div class="factory-content" id="factoryDevices" role="region" aria-label="${e(machines[factoryType]?.name||'生产设备')}"><div class="factory-groups ${expandedDeviceStacks.size?'has-expanded':''}" ${gridAttrs('factory')}>${shown.flatMap(group=>group.visible.map(entry=>`<section class="factory-entry" data-machine-group="${group.type}">${deviceStackCard(entry)}</section>`)).join('')||empty('暂无生产设备')}</div>${list.controls}</div></div>`;

}
function inventory(){
  const tabs=`<div class="subtabs inventory-tabs" role="group" aria-label="仓库分类">${[['items','物品'],['containers','桶与储罐'],['components','已用耗材']].map(([id,label])=>`<button class="filter ${inventoryTab===id?'active':''}" data-inventory-tab="${id}" aria-pressed="${inventoryTab===id}">${label}</button>`).join('')}</div>`;
  if(inventoryTab==='components'){
    const plan=gridPlan('inventory',150),list=listPage('components',game.state.components,plan.size);
    return heading('物品仓库')+tabs+`<div class="inventory-grid" ${gridAttrs('inventory')}>${list.entries.map(c=>`<article class="surface inventory-item">${icon(c.item)}<div><strong>${e(name(c.item))}</strong><small>${c.kind==='nuclear'?'组件已用 '+num((NUCLEAR.parts[c.item]?.capacity??0)+1-c.life):'剩余 '+num(c.life)+(c.kind==='mill'?' 批':' 点耐久')} · 装入设备后继续使用</small></div></article>`).join('')||empty('暂无已用耗材')}</div>${list.controls}`;
  }
  const plan=gridPlan('inventory',150),matches=createSearch(filter),all=Object.values(items).filter(x=>x.kind!=='fluid'&&game.quantity(x.id)>0&&matches(x.name,x.id)),list=listPage('inventory',all,plan.size);
  return heading('物品仓库',inventoryTab==='items'?`<input class="search" id="search" placeholder="物品 / 拼音 / 首字母" value="${e(filter)}">`:'')+tabs+(inventoryTab==='containers'?fluids():`<div data-list-start="inventory"><div class="inventory-grid" ${gridAttrs('inventory')}>${list.entries.map(x=>`<article class="surface inventory-item" data-inventory-item="${x.id}">${icon(x.id)}<div><strong>${x.name}</strong><small>${x.category}</small></div><b>${qty(x.id)}</b></article>`).join('')||empty('仓库为空')}</div>${list.controls}</div>`);
}
function containerCards(){
  const plan=gridPlan('fluids',200),list=listPage('fluids',game.containerEntries(),plan.size);
  return list.entries.map(c=>`<article class="surface fluid-container" data-container="${c.id}"><div class="card-top">${icon(c.type)}<div><h3>${e(c.group?c.name:name(c.type))} <small>${c.group?c.group.members.length+' 个容器':'#'+e(c.id)}</small></h3><p>${c.type==='legacyTank'?'密封储存液体与气体':c.type==='woodBucket'?'仅装水':c.type==='ironBucket'?'装水、杂酚油、原油或柴油':'密封储存液体与气体'}</p></div></div><div class="tank-readout"><div class="tank-vessel"><div data-container-level="${c.id}" style="height:${c.amount/game.containerCapacity(c)*100}%;--fluid-color:${items[c.fluid]?.color||'var(--dim)'}"></div></div><div><strong data-container-fluid="${c.id}">${c.fluid?name(c.fluid):'空容器'}</strong><p><b data-container-amount="${c.id}">${num(c.amount)}</b> / ${num(game.containerCapacity(c))} mB</p></div></div><label class="select-label">限定流体<select data-container-reserve="${c.id}" ${c.amount>0?'disabled':''}><option value="">自动接收兼容流体</option>${Object.values(items).filter(x=>x.kind==='fluid'&&game.acceptsFluid(c,x.id)).map(x=>`<option value="${x.id}" ${c.fluid===x.id?'selected':''}>${x.name}</option>`).join('')}</select></label><div class="fluid-transfer"><select data-transfer-target="${c.id}" aria-label="转移目标"><option value="">选择目标容器</option>${game.containerEntries().filter(t=>t.id!==c.id).map(t=>`<option value="${t.id}" data-icon="${t.type}">${name(t.type)} #${e(t.id)}</option>`).join('')}</select><button class="button" data-transfer="${c.id}" ${c.amount<=0?'disabled':''}>转移流体</button></div>${c.group?`<button class="text-link" data-edit-group="${c.id}">管理分组</button>`:`<button class="text-link" data-remove-container="${c.id}" ${c.amount>0?'disabled':''}>${c.type==='legacyTank'?'移除空罐':'收起空容器'}</button>`}</article>`).join('')+list.controls||empty('暂无已放置的容器');
}
function fluids(){
  const available=Object.entries(containerTypes).filter(([,c])=>!c.migrationOnly);
  const switcher=`<div class="subtabs container-tabs"><button class="filter ${containerView==='placed'?'active':''}" data-container-view="placed">已放置 · ${game.state.containers.length}</button><button class="filter ${containerView==='catalog'?'active':''}" data-container-view="catalog">放置容器</button><button class="button" data-create-group="fluid">创建容器组</button></div>`;
  const cards=containerView==='placed'?containerCards():'';
  const plan=gridPlan('containers',200),catalog=listPage('container-catalog',available,plan.size);
  return switcher+(containerView==='catalog'?`<div class="container-toolbar" ${gridAttrs('containers')}>${catalog.entries.map(([id,spec])=>`<article class="surface container-option">${icon(id)}<div><strong>${spec.name}</strong><small>${num(spec.capacity)} mB · 空容器 ${qty(id)}</small></div><button class="button" data-recipe-item="${id}">配方</button><div class="container-placement"><div class="worker-stepper" role="group" aria-label="${e(spec.name)}放置数量"><button class="button" data-container-place-step="${id}" data-step="-1" aria-label="减少放置数量" ${containerPlaceCount(id)<=1?'disabled':''}>−</button><strong data-container-place-count="${id}">${containerPlaceCount(id)} 个</strong><button class="button" data-container-place-step="${id}" data-step="1" aria-label="增加放置数量" ${containerPlaceCount(id)>=containerPlaceLimit(id)?'disabled':''}>＋</button><button class="button" data-container-place-all="${id}" ${containerPlaceCount(id)>=containerPlaceLimit(id)?'disabled':''}>全部</button></div><button class="button primary" data-place-container="${id}" ${containerPlaceLimit(id)<1?'disabled':''}>放置 ×${containerPlaceCount(id)}</button></div></article>`).join('')}</div>${catalog.controls}`:`<div id="containerList" class="container-grid" ${gridAttrs('fluids')} data-list-start="fluids">${cards}</div>`);
}

function research(){const plan=gridPlan('research',100,Math.max(0,viewport.width-298)),list=listPage('research',STAGES,plan.size);return heading('科技主线')+`<div class="page-grid"><div class="page-main"><div class="era-grid" ${gridAttrs('research')}>${list.entries.map(t=>{const active=t.index===game.state.stage,complete=t.index<game.state.stage;return `<article class="surface era-card ${active?'current':''} "><span class="era-index">${String(t.index+1).padStart(2,'0')}</span><div><span class="eyebrow">${t.code}</span><h3>${t.name}</h3><p>${t.description}</p><small>${complete?'✓ 已完成':active?'● 正在推进':'待完成'}</small></div><span class="era-voltage">${t.voltage?num(t.voltage)+' V':'—'}</span></article>`;}).join('')}</div>${list.controls}</div><aside class="page-rail">${mainlinePanel()}</aside></div>`;}

function space(){const plan=gridPlan('space'),list=listPage('space',gatherPageNodes('space'),plan.size);return heading('星际远征')+`<div class="resource-cards fitted-cards" ${gridAttrs('space')}>${list.entries.map(nodeCard).join('')}</div>${list.controls}`;}

function settings(){if(appearanceOpen)return appearance();return heading('存档与设置','<button class="button" data-appearance-open>电压外观</button>')+`<div class="page-grid"><div class="page-main">${panel('世界存档','',`<div class="settings-row"><div><h3>导出存档</h3><p>备份当前世界，或迁移到另一台电脑。</p></div><button class="button primary" data-action="export">导出存档</button></div><div class="settings-row"><div><h3>导入存档</h3><p>载入存档，替换当前世界。</p></div><button class="button" data-action="import">导入存档</button></div><div class="settings-row"><div><h3>重置世界</h3><p>重新开始，重置前会导出当前存档。</p></div><button class="button danger" data-action="reset">重置</button></div>`)}</div><aside class="page-rail">${panel('运行规则','','<p class="muted">采集、生产和手工队列仅在程序运行时推进。</p><p class="muted">关闭程序后暂停，重新打开时从保存的进度继续。</p>')}${panel('世界统计','',`<div class="goal-row"><span>当前章节</span><strong>${game.stage.code}</strong></div><div class="goal-row"><span>运行时间</span><strong data-playtime>${time(game.state.playtime)}</strong></div><div class="goal-row"><span>累计产出</span><strong data-produced>${num(game.state.produced)}</strong></div><div class="goal-row"><span>自动采集点</span><strong>${Object.keys(game.state.collectors).length}</strong></div>`)}</aside></div>`;}
const pages={overview,resources:resourcesPage,workshop,factory,inventory,research,space,settings};
function queueStateSignature(){return JSON.stringify(game.state.queue.map(q=>[q.recipe,q.amount]));}
function containerStateSignature(){return JSON.stringify(game.state.containers.map(c=>[c.id,c.type,c.fluid]));}
function render(){
  syncChoiceEntities();
  syncTheme();hoveredItem='';
  const previousSelector=$('[data-factory-selector]');
  if(previousSelector)factorySelectorScroll=previousSelector.scrollTop;
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
  const selector=$('[data-factory-selector]');
  if(selector){
    selector.scrollTop=factorySelectorScroll;
    const selected=selector.querySelector('[aria-pressed="true"]');
    if(selected&&(factorySelectorType!==factoryType||focusFactorySelector)){
      const box=selector.getBoundingClientRect(),button=selected.getBoundingClientRect();
      if(button.top<box.top)selector.scrollTop-=box.top-button.top;
      else if(button.bottom>box.bottom)selector.scrollTop+=button.bottom-box.bottom;
    }
    if(focusFactorySelector)selected?.focus({preventScroll:true});
    factorySelectorScroll=selector.scrollTop;factorySelectorType=factoryType;
  }
  focusFactorySelector=false;
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
  $$('[data-ingredient]').forEach(el=>el.classList.toggle('enough',(el.dataset.toolRecipe?game.toolQuantity(el.dataset.ingredient,game.recipeById.get(el.dataset.toolRecipe)):game.quantity(el.dataset.ingredient))>=Number(el.dataset.need)));
  $$('[data-gather],[data-gather-hit]').forEach(el=>{const n=gatherNodes.find(n=>n.id===(el.dataset.gather||el.dataset.gatherHit));const allowed=game.nodeAvailable(n);updateDisabled(el,!allowed);updateAttribute(el,'title',allowed?'点击采集':'需要：'+game.nodeAccess(n).missing.join('、'));if(el.dataset.gather)updateText(el,allowed?`${gatherVerb(n)} · +${Math.round(100/game.gatherClicks(n))}%`:'需要：'+game.nodeAccess(n).missing.join('、'));});
  $$('[data-node-access]').forEach(el=>{const n=gatherNodes.find(n=>n.id===el.dataset.nodeAccess);updateText(el,nodeAccessText(n));updateAttribute(el,'title',nodeAccessTitle(n));el.closest('[data-node]').classList.toggle('locked',!game.nodeAvailable(n));});
  $$('[data-collector]').forEach(el=>{const n=gatherNodes.find(n=>n.id===el.dataset.collector);updateDisabled(el,!game.nodeAvailable(n));updateAttribute(el,'title',game.nodeAccess(n).missing.join('、'));});
  $$('[data-gather-progress]').forEach(el=>{const n=gatherNodes.find(n=>n.id===el.dataset.gatherProgress);updatePercent(el,'width',(game.state.gatherProgress[n.id]||0)/game.gatherClicks(n)*100);});
  $$('[data-click-progress]').forEach(el=>{const n=gatherNodes.find(n=>n.id===el.dataset.clickProgress);updateText(el,`${game.state.gatherProgress[n.id]||0} / ${game.gatherClicks(n)} 次点击`);});
  $$('[data-craft]').forEach(el=>{const r=game.recipeById.get(el.dataset.craft),count=Number(el.dataset.count)||1;updateDisabled(el,!r||filledRecipe!==r.id||!game.canCraft(r)||!game.canPay(Object.fromEntries(Object.entries(r.inputs).map(([id,n])=>[id,n*count])))||game.state.queue.length>=20);});
  $$('[data-build]').forEach(el=>updateDisabled(el,filledRecipe!=='build:'+el.dataset.build||!game.canBuild(el.dataset.build)));
  $$('[data-slot-item]').forEach(el=>el.classList.toggle('missing',game.quantity(el.dataset.slotItem)<Number(el.dataset.slotTotal)));
  $$('[data-fill]').forEach(el=>{const r=selectedEntry();updateDisabled(el,!r||!game.canPay(r.inputs)||!game.hasTools(r));});
  if($('[data-bench-status]')){const r=selectedEntry(),missing=[...game.missing(r.inputs),...game.missingTools(r)];updateText($('[data-bench-status]'),missing.length?'还缺：'+missing.map(x=>name(x.id)+' ×'+num(x.need-x.have)).join('、'):r.process==='craft'&&game.state.queue.length>=20?'手工队列已满，请等待或取消已有任务。':r.process==='craft'||r.process==='build'?filledRecipe===r.id?'材料已放入':'材料齐全':'需使用'+processName(r.process));$('[data-bench-status]').classList.toggle('ready',!missing.length);}
  const goals=$$('[data-goal]'),goalBars=$$('[data-goal-bar]'),goalLabels=$$('[data-goal-pct]'),advance=$$('[data-action="advance"]');
  if(goals.length||goalBars.length||goalLabels.length||advance.length){
    const entries=game.milestoneProgress(),byId=new Map(entries.map(x=>[x.id,x]));
    const pct=entries.reduce((n,x)=>n+Math.min(1,x.have/x.need),0)/entries.length*100;
    goals.forEach(el=>{const have=byId.get(el.dataset.goal)?.have||0;updateText(el,num(Math.min(have,Number(el.dataset.need)))+' / '+num(Number(el.dataset.need)));el.classList.toggle('complete',have>=Number(el.dataset.need));});
    goalBars.forEach(el=>updatePercent(el,'width',pct));goalLabels.forEach(el=>updateText(el,Math.floor(pct)+'%'));
    advance.forEach(el=>updateDisabled(el,game.state.completed||!entries.every(x=>x.have>=x.need)));
  }
  $$('[data-auto]').forEach(el=>{const n=gatherNodes.find(n=>n.id===el.dataset.auto),c=game.state.collectors[n.id];updateText(el,c.enabled===false?'已停止':!game.nodeAvailable(n)?'需要：'+game.nodeAccess(n).missing.join('、'):c.blocked==='流体容器不足'?'流体容器不足':time(n.seconds*4-c.elapsed)+' 后掉落');});
  $$('[data-collector-badge]').forEach(el=>{const n=gatherNodes.find(n=>n.id===el.dataset.collectorBadge),c=game.state.collectors[n.id];updateText(el,c?'自动 ×'+(c.enabled===false||!game.nodeAvailable(n)?0:c.activeCount??c.count):STAGES[n.stage].code);});
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
  recipeTree.refresh();
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
document.addEventListener('click',ev=>{const t=ev.target.closest('[data-resource-source]');if(!t)return;const n=gatherNodes.find(n=>n.id===t.dataset.resourceSource);if(!n)return;const key=n.stage<5?'resources':'space';navigate(key);listPages[key]=Math.floor(gatherPageNodes(key).indexOf(n)/(listSizes.get(key)||1));render();$('[data-gather="'+n.id+'"]')?.focus({preventScroll:true});});

document.addEventListener('click',ev=>{const t=ev.target.closest('button');if(!t)return;if(t.hasAttribute('data-appearance-open')){appearanceOpen=true;appearanceCode=appearanceMode||tierFor(game.stage.code).code;appearanceEraPage=tierFor(appearanceCode).era;page='settings';render();$('[data-tier-step]:not(:disabled)')?.focus({preventScroll:true});}else if(t.hasAttribute('data-appearance-close')){appearanceOpen=false;render();$('#page [data-appearance-open]')?.focus({preventScroll:true});}});
document.addEventListener('click',ev=>{const t=ev.target.closest('button');if(!t||t.disabled)return;if(recipeTree.click(t))return;if(t.dataset.bookView){bookView=t.dataset.bookView;return render();}if(t.hasAttribute('data-favorite-toggle'))return toggleRecipeFavorite();if(t.dataset.favoriteOpen)return openRecipeFavorite(t.dataset.favoriteOpen);if(t.dataset.favoriteRemove)return removeRecipeFavorite(t.dataset.favoriteRemove);if(t.dataset.listPage){listPages[t.dataset.listPage]=Number(t.dataset.listIndex);if(t.dataset.listPage.startsWith('bec-')||t.dataset.listPage.startsWith('spin-')||t.dataset.listPage.startsWith('foundry-')||t.dataset.listPage.startsWith('beam-')){const id=t.dataset.listPage.split(':')[1],d=game.state.devices.find(d=>d.id===id);return showModal(advancedControls({game,d,icon,name,num,e,listPage,deviceName,view:t.dataset.listPage.startsWith('bec-nanites')?'nanites':t.dataset.listPage.startsWith('bec-contents')?'contents':t.dataset.listPage.startsWith('beam-filter')?'detectors':'network'}));}render();return;}if(t.hasAttribute('data-show-drops'))return showModal('<h2>最近掉落</h2><div data-last-drops role="status" aria-live="polite">'+dropSummary()+'</div>');if(t.dataset.overviewTab){overviewTab=t.dataset.overviewTab;return render();}if(t.dataset.benchView){benchView=t.dataset.benchView;return render();}if(t.dataset.nodeView){nodeViews[t.dataset.nodeId]=t.dataset.nodeView;return render();}if(t.dataset.containerView){containerView=t.dataset.containerView;return render();}if(t.dataset.expandStack){const key=t.dataset.expandStack;if(t.dataset.stackOutput){for(const id of t.dataset.stackOutput.split(','))deviceViews[id]='output';expandedDeviceStacks.clear();expandedDeviceStacks.add(key);}else if(expandedDeviceStacks.has(key))expandedDeviceStacks.delete(key);else{expandedDeviceStacks.clear();expandedDeviceStacks.add(key);}render();return;}if(t.dataset.inventoryTab){inventoryTab=t.dataset.inventoryTab;filter='';render();return;}if(t.dataset.workerNode)return result(game.setCollectorWorkers(t.dataset.workerNode,Number(t.dataset.workerCount)));if(t.dataset.toggleCollector)return result(game.toggleCollector(t.dataset.toggleCollector));if(t.dataset.dispatch){const target=$('[data-dispatch-target="'+t.dataset.dispatch+'"]').value;const outcome=game.dispatch(t.dataset.dispatch,target);if(outcome.ok){factoryType=outcome.device.type;listPages.factory=0;}return result(outcome,outcome.ok?'已派工至'+deviceName(outcome.device)+' #'+target.slice(1):'');}if(t.dataset.buildFor){workshopTab='machines';selectedItems.machines=t.dataset.buildFor;selectedRecipes.machines='build:'+t.dataset.buildFor;filledRecipe='';listPages.book=0;return navigate('workshop');}if(t.dataset.page)return navigate(t.dataset.page);if(t.dataset.factoryType){focusFactorySelector=true;factoryType=t.dataset.factoryType;listPages.factory=0;expandedDeviceStacks.clear();render();return;}if(t.dataset.workshop){workshopTab=t.dataset.workshop;return navigate('workshop');}if(t.dataset.tab){benchView='recipe';listPages.book=0;workshopTab=t.dataset.tab;recipeMode='recipes';filter='';filledRecipe='';return render();}if(t.dataset.bookItem){benchView='recipe';selectedItems[workshopTab]=t.dataset.bookItem;selectedRecipes[workshopTab]='';filledRecipe='';return render();}if(t.dataset.lookupItem||t.dataset.recipeItem)return lookupItem(t.dataset.lookupItem||t.dataset.recipeItem);if(t.dataset.recipeMode){listPages.book=0;recipeMode=t.dataset.recipeMode;selectedRecipes[workshopTab]='';filledRecipe='';return render();}if(t.dataset.recipeStep){const list=currentRecipes(),at=list.findIndex(r=>r.id===selectedEntry()?.id);selectedRecipes[workshopTab]=list[(at+Number(t.dataset.recipeStep)+list.length)%list.length]?.id;filledRecipe='';return render();}if(t.dataset.placeContainer){const count=containerPlaceCount(t.dataset.placeContainer),outcome=game.placeContainer(t.dataset.placeContainer,count);return result(outcome,`已放置 ${count} 个${name(t.dataset.placeContainer)}`);}if(t.dataset.removeContainer)return result(game.removeContainer(t.dataset.removeContainer),'空容器已收起');if(t.dataset.transfer){const target=$(`[data-transfer-target="${t.dataset.transfer}"]`).value;return result(game.transferFluid(t.dataset.transfer,target),'流体已转移');}if(t.dataset.selectRecipe){selectedRecipes[workshopTab]=t.dataset.selectRecipe;filledRecipe='';return render();}if(t.dataset.fill){const r=selectedEntry();if(r&&r.id===t.dataset.fill&&game.canPay(r.inputs)&&game.hasTools(r)){filledRecipe=r.id;render();}return;}if(t.dataset.gather||t.dataset.gatherHit)return gatherAction(t.dataset.gather||t.dataset.gatherHit);if(t.dataset.collector)return result(game.buildCollector(t.dataset.collector),'已部署自动采集器');if(t.dataset.craft){filledRecipe='';return result(game.craft(t.dataset.craft,Number(t.dataset.count)||1),'已加入手工队列');}if(t.dataset.build){filledRecipe='';return result(game.build(t.dataset.build),'设备已建成');}if(t.dataset.toggle){game.toggle(t.dataset.toggle);persist();return render();}if(t.dataset.forceStop)return result(game.forceStop(t.dataset.forceStop),'已强制停止，可选择新配方后启动');if(t.dataset.remove)return result(game.dismantle(t.dataset.remove),'已拆除并退还原料');if(t.dataset.cancel)return result(game.cancelQueue(Number(t.dataset.cancel)),'已退还未完成批次材料');const action=t.dataset.action;if(action==='advance')result(game.advance());if(action==='export')download(exportWorld(game),'GregTech-LiteHorizons-'+new Date().toISOString().slice(0,10)+'.json');if(action==='import')$('#importFile').click();if(action==='close-modal')$('#modal').close();if(action==='reset')showModal('<h2>重新开始这个世界？</h2><p class="muted">当前存档会先下载为备份，之后创建空白世界。</p><button class="button danger" data-action="confirm-reset">备份并重置世界</button>');if(action==='confirm-reset'){download(exportWorld(game),'GregTech-LiteHorizons-before-reset.json');game=new Game();persist();$('#modal').close();render();notify('新的世界已建立');}});
document.addEventListener('click',ev=>{
  const t=ev.target.closest('button');if(!t||t.disabled)return;
  if(t.dataset.advancedOpen){const d=game.state.devices.find(d=>d.id===t.dataset.advancedOpen);if(d)return showModal(advancedControls({game,d,icon,name,num,e,listPage,deviceName,view:t.dataset.view}));}
  if(t.dataset.advancedAction){
    const id=t.dataset.deviceId,action=t.dataset.advancedAction,value=t.dataset.value;
    const outcome=action.startsWith('beam-')?game.changeBeam(id,action.slice(5),['beam-cycles','beam-energy','beam-boost'].includes(action)?Number(value):value):action==='foundry'?game.changeFoundry(id,Number(value.split('|')[0]),value.split('|')[1]):action.startsWith('eoh-')?game.changeEOH(id,action.slice(4),Number(value)):action==='rotor'||action==='rotor-out'?game.changeSpin(id,value,action==='rotor-out'):game.changeBEC(id,action,action==='strength'?Number(value):action==='nanite'?{item:value.split('|')[0],count:Number(value.split('|')[1])}:value);
    result(outcome);if(outcome.ok){const d=game.state.devices.find(d=>d.id===id);showModal(advancedControls({game,d,icon,name,num,e,listPage,deviceName,view:t.dataset.view??(action==='nanite'?'nanites':'network')}));}return;
  }
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
  if(t.dataset.forgeView){setForgeView(t.dataset.forgeView,t.dataset.value);render();return;}
  if(t.dataset.purificationView){setPurificationView(t.dataset.purificationView,t.dataset.value);return render();}
  if(t.dataset.purificationAction){const action=t.dataset.purificationAction,value=['dose','superconductor','catalyst'].includes(action)?Number(t.dataset.value):t.dataset.value;return result(game.changePurification(t.dataset.purificationDevice,action,value));}
  if(t.dataset.forgeAction){const action=t.dataset.forgeAction,value=['fuel','factor','capacity'].includes(action)?Number(t.dataset.value):t.dataset.value;return result(game.changeGodforge(t.dataset.forgeDevice,action,value));}
  if(t.dataset.energyMode)return result(game.setSupply(t.dataset.energyMode,t.dataset.mode,null));
  if(t.dataset.skyAccess)return result(game.setSkyAccess(t.dataset.skyAccess,t.dataset.visible==='true'));
  if(t.dataset.loadBoilerFuel)return result(game.loadBoilerFuel(t.dataset.loadBoilerFuel,$('#boiler-fuel-'+t.dataset.loadBoilerFuel).value,Number(t.dataset.count)));
  if(t.dataset.boilerCircuit)return result(game.setBoilerCircuit(t.dataset.boilerCircuit,Number(t.dataset.value)));
  if(t.dataset.turbineFit)return result(game.setTurbineFit(t.dataset.turbineFit,t.dataset.loose==='true'));
  if(t.dataset.bathThreshold)return result(game.setBathFlush(t.dataset.bathThreshold,Number(t.dataset.value)));
  if(t.dataset.boardFlush)return result(game.flushBoardBath(t.dataset.boardFlush));
  if(t.dataset.loadCoal)return result(game.loadCoal(t.dataset.loadCoal,Number(t.dataset.count)));
  if(t.dataset.batteryIn)return result(game.changeBattery(t.dataset.batteryIn,true));
  if(t.dataset.isotopeIn)return result(game.changeIsotopePellet(t.dataset.isotopeIn,true));
  if(t.dataset.isotopeOut)return result(game.changeIsotopePellet(t.dataset.isotopeOut,false));
  if(t.dataset.nuclearView){const key=t.dataset.nuclearView;setNuclearView(t.dataset.nuclearDevice,key,['slot','page'].includes(key)?Number(t.dataset.value):t.dataset.value);return render();}
  if(t.dataset.nuclearPart){const out=game.changeNuclear(t.dataset.nuclearDevice,'slot',{index:Number(t.dataset.index),item:t.dataset.nuclearPart});if(out.ok)setNuclearView(t.dataset.nuclearDevice,'panel','layout');return result(out);}
  if(t.dataset.nuclearAction){const action=t.dataset.nuclearAction,value=action==='remove'?{index:Number(t.dataset.index),item:null}:action==='repair'?Number(t.dataset.index):undefined;return result(game.changeNuclear(t.dataset.nuclearDevice,action==='remove'?'slot':action,value));}
  if(t.dataset.batteryOut)return result(game.changeBattery(t.dataset.batteryOut,false));
  if(t.dataset.recoverEnergy)return result(game.recoverEnergy(t.dataset.recoverEnergy));
  if(t.dataset.moduleIn)return result(game.installModule(t.dataset.moduleIn));
  if(t.dataset.emptyEnergy)return result(game.emptyDeviceEnergy(t.dataset.emptyEnergy));
  if(t.dataset.machineLocation)return result(game.setMachineLocation(t.dataset.machineLocation,t.dataset.location));
  if(t.dataset.coilOpen){const id=t.dataset.coilOpen;return showModal(`<h2>更换高炉线圈</h2><p class="muted">每台安装 16 个线圈方块，旧线圈退回仓库。请先完成批次并暂停设备。</p><div class="energy-actions">${COILS.filter(c=>items[c.item]).map(c=>`<button class="button" data-install-coil="${id}" data-item="${c.item}">${icon(c.item)}${e(c.name)} · ${c.heat} K</button>`).join('')}</div>`);}
  if(t.dataset.installCoil){const out=game.installCoil(t.dataset.installCoil,t.dataset.item);if(out.ok)$('#modal').close();return result(out);}
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
document.addEventListener('change',ev=>{const t=ev.target;if(t.dataset.rotorChange)return result(game.setRotor(t.dataset.rotorChange,t.value));if(t.dataset.fluidInput)return result(game.setFluidInput(t.dataset.fluidInput,t.dataset.fluid,t.value));if(t.dataset.energySource){const d=game.deviceEntries().find(d=>d.id===t.dataset.energySource)||game.state.devices.find(d=>d.id===t.dataset.energySource);if(d)return result(game.setSupply(d.id,d.supply.mode,t.value));}if(t.dataset.steamOutput)return result(game.setSteamOutput(t.dataset.steamOutput,t.value));if(t.dataset.containerReserve)return result(game.reserveContainer(t.dataset.containerReserve,t.value));if(t.dataset.assign)result(game.assign(t.dataset.assign,t.value));});
document.addEventListener('pointerover',ev=>{const target=ev.target.closest('[data-item],[data-book-item],[data-lookup-item]');hoveredItem=target?.dataset.item||target?.dataset.bookItem||target?.dataset.lookupItem||'';});
document.addEventListener('keydown',ev=>{
  const button=ev.target.closest('[data-factory-selector] [data-factory-type]');
  if(!button||!['ArrowUp','ArrowDown','Home','End'].includes(ev.key))return;
  ev.preventDefault();
  const buttons=[...button.closest('[data-factory-selector]').querySelectorAll('[data-factory-type]')],index=buttons.indexOf(button);
  const next=ev.key==='Home'?0:ev.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(ev.key==='ArrowDown'?1:-1)));
  buttons[next]?.focus();
});
document.addEventListener('keydown',ev=>{if(ev.ctrlKey||ev.altKey||ev.metaKey||ev.target.closest('input,select,textarea')||$('#modal').open||$('#choiceDialog')?.open||$('#groupDialog')?.open)return;const key=ev.key.toLowerCase();if(hoveredItem&&['r','u'].includes(key)){ev.preventDefault();lookupItem(hoveredItem,key==='u'?'uses':'recipes');}});
document.addEventListener('contextmenu',ev=>{const target=ev.target.closest('[data-item],[data-book-item],[data-lookup-item]');const id=target?.dataset.item||target?.dataset.bookItem||target?.dataset.lookupItem;if(id){ev.preventDefault();lookupItem(id,'uses');}});
let searchTimer;document.addEventListener('input',ev=>{if(ev.target.id!=='search')return;const start=ev.target.selectionStart;filter=ev.target.value;listPages[page==='workshop'?'book':page]=0;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{render();const input=$('#search');if(input){input.focus({preventScroll:true});input.setSelectionRange(start,start);}},180);});
$('#importFile').addEventListener('change',async ev=>{const file=ev.target.files[0];if(!file)return;try{if(file.size>5e6)throw Error('存档文件过大');const raw=JSON.parse(await file.text());new Game(raw);download(exportWorld(game),'GregTech-LiteHorizons-before-import.json');game=replaceWorld(raw);notify('存档导入成功');render();}catch(error){notify('导入失败：'+error.message);}ev.target.value='';});
let last=performance.now(),lastPaint=0;setInterval(()=>{const now=performance.now(),elapsed=Math.min(60,(now-last)/1000);last=now;let remaining=elapsed;while(remaining>1e-8){const dt=Math.min(.5,remaining);game.tick(dt);remaining-=dt;}if(now-lastPaint>180){refresh();lastPaint=now;}},100);
setInterval(persist,10000);window.addEventListener('beforeunload',persist);
document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();else{const gap=(performance.now()-last)/1000;if(gap>1)game.simulate(gap);last=performance.now();refresh();}});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{closeChoices();render();},120);});
render();
// Resume the saved state directly; time spent with the application closed does not advance the world.
if(recovered)notify('主存档不可用，已从上一份有效备份恢复。');persist();

// Quantity edits update only the recipe-tree preview after the edit commits.
document.addEventListener('change',ev=>recipeTree.change(ev.target));
