import {items,machines} from './data/catalog.js';
import {ENERGY_REFERENCE as ENERGY} from './data/energy-reference.js';
import {planGrid,gridStyle,fitPageLimits} from './layout.js';
import {createSearch} from './core/search.js';

const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dialog=document.createElement('dialog');dialog.id='groupDialog';dialog.className='group-editor';document.body.append(dialog);
let getGame,onSaved,notify,kind,groupId,type='',selected=new Set(),groupName='',query='',page=0,rowLimit=Infinity;
export function configureGroupEditor(options){getGame=options.getGame;onSaved=options.onSaved;notify=options.notify;}
export function openGroupEditor(groupKind,id=null,machineType=''){
  const g=getGame().state.groups.find(g=>g.id===id);kind=g?.kind||groupKind;groupId=g?.id||null;type=machineType;
  selected=new Set(g?.members||[]);groupName=g?.name||'';query='';page=0;rowLimit=Infinity;
  draw();dialog.showModal();draw();dialog.querySelector('[name="groupName"]').focus();
}
function candidates(){
  const game=getGame();return (kind==='fluid'?game.state.containers:game.state.devices).filter(x=>{
    const g=game.groupFor(x.id);return (!g||g.id===groupId)&&(kind!=='device'||!type||x.type===type);
  });
}
function compatible(x,chosen){
  if(selected.has(x.id)||!chosen.length)return true;
  if(kind==='device')return x.type===chosen[0].type&&x.energyTier===chosen[0].energyTier;
  const game=getGame(),fluid=chosen.find(c=>c.fluid)?.fluid||x.fluid;
  return !fluid||(!x.fluid||x.fluid===fluid)&&game.acceptsFluid(x,fluid)&&chosen.every(c=>(!c.fluid||c.fluid===fluid)&&game.acceptsFluid(c,fluid));
}
function draw(){
  const all=candidates(),chosen=[...new Map(all.filter(x=>selected.has(x.id)).map(x=>[`${x.type}/${x.fluid}/${x.energyTier}`,x])).values()];
  const label=x=>kind==='fluid'?`${items[x.type].name} #${x.id.slice(1)} · ${items[x.fluid]?.name||'空容器'}`:`${x.alias||machines[x.type].name} #${x.id.slice(1)}`;
  const matches=createSearch(query),visible=all.filter(x=>matches(label(x)));
  const plan=planGrid('choice',{width:Math.min(980,innerWidth-48)-40,height:innerHeight-48},310);
  plan.rows=Math.min(plan.rows,rowLimit);plan.size=plan.rows*plan.columns;
  const count=Math.max(1,Math.ceil(visible.length/plan.size));page=Math.max(0,Math.min(page,count-1));
  dialog.setAttribute('aria-label',groupId?'管理分组':'创建分组');
  dialog.innerHTML=`<form data-group-form><div class="choice-heading"><h2>${groupId?'管理':'创建'}${kind==='fluid'?'容器组':'设备组'}</h2><button type="button" class="button" data-group-close aria-label="关闭">×</button></div><label class="select-label">组名<input class="search" name="groupName" maxlength="24" required value="${e(groupName)}" placeholder="例如：蒸汽储备 / 一号锅炉组"></label><p class="small muted">${kind==='fluid'?'同组容器共存一种流体，容量合计。':'同机型、同电压；保存后统一采用首台设备的输入输出设置。'}</p><div class="group-pick-tools"><input class="search" data-group-query aria-label="搜索成员" placeholder="成员 / 拼音 / 首字母" value="${e(query)}"><button type="button" class="button" data-group-pick-all>全部兼容</button><span>已选 ${selected.size}</span></div><div class="choice-options" data-fit-grid="group-members" style="${gridStyle(plan)}">${visible.slice(page*plan.size,(page+1)*plan.size).map(x=>`<button type="button" class="choice-option ${selected.has(x.id)?'selected':''}" data-group-member="${x.id}" aria-pressed="${selected.has(x.id)}" ${compatible(x,chosen)?'':'disabled'}><span class="choice-art"><img src="assets/gtnh/${items[x.fluid||x.type]?.icon||x.fluid||x.type}.svg" alt="" draggable="false"></span><strong>${e(label(x))}</strong><small>${kind==='fluid'?`${Math.floor(x.amount).toLocaleString()} / ${getGame().containerCapacity(x).toLocaleString()} mB`:ENERGY.codes[x.energyTier]}</small></button>`).join('')||'<p class="muted">暂无可加入的成员</p>'}</div><nav class="choice-pages" aria-label="成员翻页"><button type="button" class="button" data-group-step="-1" ${page===0?'disabled':''}>上一页</button><span>${page+1} / ${count}</span><button type="button" class="button" data-group-step="1" ${page===count-1?'disabled':''}>下一页</button></nav><div class="group-editor-actions">${groupId?'<button type="button" class="button danger" data-group-dissolve>解散组</button>':''}<button class="button primary" type="submit" ${selected.size<2?'disabled':''}>保存分组</button></div></form>`;
  if(dialog.open){const limits=new Map();if(fitPageLimits(dialog,new Map([['group-members',plan]]),limits,new Map())){rowLimit=limits.get('group-members');draw();}}
}
dialog.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-group-close'))return dialog.close();
  if(b.dataset.groupMember){const id=b.dataset.groupMember;if(selected.has(id))selected.delete(id);else selected.add(id);draw();dialog.querySelector(`[data-group-member="${id}"]`)?.focus();}
  if(b.dataset.groupStep){page+=Number(b.dataset.groupStep);draw();}
  if(b.hasAttribute('data-group-pick-all')){
    const all=candidates(),chosen=new Map(all.filter(x=>selected.has(x.id)).map(x=>[`${x.type}/${x.fluid}/${x.energyTier}`,x]));
    for(const x of all)if(compatible(x,[...chosen.values()])){selected.add(x.id);chosen.set(`${x.type}/${x.fluid}/${x.energyTier}`,x);}
    draw();
  }
  if(b.hasAttribute('data-group-dissolve')){const result=getGame().dissolveGroup(groupId);if(result.ok){dialog.close();onSaved(result);}else notify(result.message);}
});
dialog.addEventListener('input',event=>{
  if(event.target.name==='groupName')groupName=event.target.value;
  if(event.target.hasAttribute('data-group-query')){query=event.target.value;page=0;draw();const input=dialog.querySelector('[data-group-query]');input.focus();input.setSelectionRange(query.length,query.length);}
});
dialog.addEventListener('submit',event=>{
  event.preventDefault();const result=getGame().saveGroup(kind,groupName,[...selected],groupId);
  if(result.ok){dialog.close();onSaved(result);}else notify(result.message);
});
window.addEventListener('resize',()=>{if(dialog.open){rowLimit=Infinity;draw();}});
