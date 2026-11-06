// Contextual icon cards keep selection visual and usable without dropdown lists.
import {updateText,updateDisabled,updateAttribute} from './live-view.js';
import {items,recipes,STAGES} from './data/catalog.js';
import {planGrid,gridStyle,fitPageLimits} from './layout.js';
import {productName} from './core/recipe-browser.js';
import {recipeEnergyText} from './data/energy-reference.js';
const recipeById=new Map(recipes.map(recipe=>[recipe.id,recipe]));
let nextId=0, source=null, query='', index=0, pageSize=0, rowLimit=Infinity;
let resolveEntity=()=>null;
export function setChoiceResolver(resolve){resolveEntity=resolve;}
const dialog=document.createElement('dialog');
dialog.id='choiceDialog';
dialog.setAttribute('aria-label','选择项目');
document.body.append(dialog);
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=id=>`<img src="assets/gtnh/${escape(items[id]?.icon||id)}.svg" alt="" draggable="false">`;
function details(select,option){
  if(!option.value)return {icon:'ui-inventory',label:option.text,meta:'',recipe:null};
  if(select.dataset.assign){const recipe=recipeById.get(option.value);return {icon:recipe?.fuel||Object.keys(recipe?.outputs||{})[0]||'turbine',label:recipe?productName({items},recipe):option.text,meta:recipe?`解锁 ${STAGES[recipe.stage].code} · 耗能 ${recipeEnergyText(recipe)}`:'',recipe};}
  const entity=resolveEntity(option.value);
  if(entity)return {...entity,recipe:null};
  const container=document.querySelector(`[data-container="${option.value}"]`);
  const device=document.querySelector(`[data-device="${option.value}"]`);
  const icon=option.dataset.icon||(items[option.value]?option.value:container?.querySelector('[data-item]')?.dataset.item||device?.querySelector('[data-item]')?.dataset.item||'ui-inventory');
  return {icon,label:option.text,meta:items[option.value]?.kind==='fluid'?'限定储存此流体':'',recipe:null};
}
function title(select){return select.dataset.assign?'选择生产配方':select.dataset.energySource?'选择供给设备':select.dataset.energyOutput?'选择充电电池箱':select.dataset.fluidOutput?'选择产物储罐':select.dataset.fluidInput?'选择原料容器':select.dataset.steamOutput?'选择蒸汽储罐':select.dataset.containerReserve?'限定储存流体':select.dataset.transferTarget?'转移到容器':select.dataset.dispatchTarget?'选择派工设备':'选择项目';}

export function enhanceChoices(root){
  for(const select of root.querySelectorAll('select:not([data-choice-id])')){
    select.dataset.choiceId=String(++nextId);
    select.hidden=true;
    select.tabIndex=-1;
    const button=document.createElement('button');
    button.type='button';
    button.className='choice-trigger';
    button.dataset.openChoice=select.dataset.choiceId;
    button.setAttribute('aria-haspopup','dialog');
    button.innerHTML='<img alt="" draggable="false"><span class="choice-label"><span data-choice-label></span><small data-choice-meta></small></span><span class="choice-action" aria-hidden="true">更换</span>';
    select.after(button);
  }
  syncChoices(root);
}
export function syncChoices(root=document){
  if(dialog.open&&(!source?.isConnected||source.disabled))closeChoices();
  for(const select of root.querySelectorAll('select[data-choice-id]')){
    const button=select.nextElementSibling;
    if(!button?.hasAttribute('data-open-choice'))continue;
    updateDisabled(button,select.disabled);
    const option=select.selectedOptions[0],detail=option?details(select,option):null,label=detail?.recipe?option.textContent:detail?.label||'选择…';
    updateText(button.querySelector('[data-choice-label]'),label);
    updateText(button.querySelector('[data-choice-meta]'),detail?.recipe?'':detail?.meta||'');
    const icon=detail?.icon||'ui-inventory';
    updateAttribute(button.querySelector('img'),'src',`assets/gtnh/${items[icon]?.icon||icon}.svg`);
    updateAttribute(button,'title',select.title||title(select));
    updateAttribute(button,'aria-label',title(select)+'：'+label+(detail?.meta?'，'+detail.meta:''));
  }
  if(dialog.open&&source)for(const button of dialog.querySelectorAll('[data-choice-option]')){
    const option=source.options[Number(button.dataset.choiceOption)];if(!option)continue;
    const detail=details(source,option);
    if(detail.recipe)continue;
    updateText(button.querySelector('strong'),detail.label);
    updateText(button.querySelector('small'),detail.meta||'');
    updateAttribute(button.querySelector('img'),'src',`assets/gtnh/${items[detail.icon]?.icon||detail.icon}.svg`);
  }
}
export function closeChoices(){if(dialog.open)dialog.close();source=null;}
function draw(anchor){
  const width=Math.min(980,innerWidth-64),plan=planGrid(source.dataset.assign?'recipeChoice':'choice',{width:width-40,height:Math.min(innerHeight-64,860)},204);
  const first=anchor??index*(pageSize||plan.size);
  plan.rows=Math.min(plan.rows,rowLimit);plan.size=plan.rows*plan.columns;
  const size=plan.size;
  const options=[...source.options].map((option,at)=>({option,at})).filter(({option})=>{const d=details(source,option);return !query||(d.label+' '+d.meta).toLowerCase().includes(query.toLowerCase());});
  const count=Math.max(1,Math.ceil(options.length/size));index=Math.max(0,Math.min(Math.floor(first/size),count-1));pageSize=size;
  dialog.innerHTML=`<div class="choice-heading"><h2>${title(source)}</h2><button class="button" data-close-choice aria-label="关闭">×</button></div><input class="search" id="choiceSearch" placeholder="搜索" aria-label="搜索选项" value="${escape(query)}"><div class="choice-options" data-fit-grid="choice-options" style="${gridStyle(plan)}">${options.slice(index*size,(index+1)*size).map(({option,at})=>{
    const d=details(source,option),r=d.recipe;
    return `<button class="choice-option ${option.selected?'selected':''}" data-choice-option="${at}" ${option.disabled?'disabled':''} aria-pressed="${option.selected}"><span class="choice-art">${art(d.icon)}</span><strong>${escape(d.label)}</strong><small>${escape(d.meta||'')}</small>${r?`<span class="choice-recipe" aria-label="投入与产出">${Object.entries(r.inputs).map(([id,n])=>`<span title="${escape(items[id]?.name||id)} ×${n}">${art(id)}<b>${n}</b></span>`).join('')}<i>→</i>${Object.entries(r.outputs).map(([id,n])=>`<span title="${escape(items[id]?.name||id)} ×${n}">${art(id)}<b>${n}</b></span>`).join('')||'EU'}</span>`:''}</button>`;
  }).join('')||'<p class="muted">没有匹配的项目</p>'}</div><nav class="choice-pages" aria-label="选项翻页"><button class="button" data-choice-step="-1" ${index===0?'disabled':''}>上一页</button><span>${index+1} / ${count}</span><button class="button" data-choice-step="1" ${index===count-1?'disabled':''}>下一页</button></nav>`;
  if(dialog.open){
    const limits=new Map();
    if(fitPageLimits(dialog,new Map([['choice-options',plan]]),limits,new Map())){
      rowLimit=limits.get('choice-options');draw(first);
    }
  }
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.openChoice){
    source=document.querySelector(`select[data-choice-id="${button.dataset.openChoice}"]`);
    if(!source||source.disabled)return;
    query='';index=0;pageSize=0;rowLimit=Infinity;draw();dialog.showModal();draw();dialog.querySelector('input').focus();
  }else if(button.hasAttribute('data-close-choice'))closeChoices();
  else if(button.hasAttribute('data-choice-option')){
    const select=source;if(!select?.isConnected||select.disabled)return closeChoices();
    const option=select.options[Number(button.dataset.choiceOption)];if(!option||option.disabled)return;
    select.selectedIndex=Number(button.dataset.choiceOption);closeChoices();syncChoices();
    select.dispatchEvent(new Event('change',{bubbles:true}));
  }else if(button.dataset.choiceStep){index+=Number(button.dataset.choiceStep);draw();}
});
dialog.addEventListener('input',event=>{
  if(event.target.id!=='choiceSearch')return;
  const caret=event.target.selectionStart;query=event.target.value;index=0;pageSize=0;rowLimit=Infinity;draw();
  const input=dialog.querySelector('input');input.focus();input.setSelectionRange(caret,caret);
});
dialog.addEventListener('close',()=>{source=null;});
