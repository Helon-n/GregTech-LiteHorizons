// Paginated choices keep long machine, recipe and container lists off scrollbars.
let nextId=0, source=null, query='', index=0;
const dialog=document.createElement('dialog');
dialog.id='choiceDialog';
dialog.setAttribute('aria-label','选择项目');
document.body.append(dialog);
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
    select.after(button);
  }
  syncChoices(root);
}
export function syncChoices(root=document){
  if(dialog.open&&(!source?.isConnected||source.disabled))closeChoices();
  for(const select of root.querySelectorAll('select[data-choice-id]')){
    const button=select.nextElementSibling;
    if(!button?.hasAttribute('data-open-choice'))continue;
    button.disabled=select.disabled;
    button.textContent=select.selectedOptions[0]?.textContent||'选择…';
    button.title=select.title||button.textContent;
    button.setAttribute('aria-label',(select.getAttribute('aria-label')||select.closest('label')?.firstChild?.textContent||'选择')+'：'+button.textContent);
  }
}
export function closeChoices(){if(dialog.open)dialog.close();source=null;}
function draw(){
  const size=Math.max(3,Math.min(10,Math.floor((innerHeight-260)/49)));
  const options=[...source.options].map((option,at)=>({option,at})).filter(({option})=>!query||option.text.toLowerCase().includes(query.toLowerCase()));
  const count=Math.max(1,Math.ceil(options.length/size));index=Math.max(0,Math.min(index,count-1));
  dialog.innerHTML=`<div class="choice-heading"><h2>选择项目</h2><button class="button" data-close-choice aria-label="关闭">×</button></div><input class="search" id="choiceSearch" placeholder="搜索" aria-label="搜索选项" value="${escape(query)}"><div class="choice-options">${options.slice(index*size,(index+1)*size).map(({option,at})=>`<button class="choice-option ${option.selected?'selected':''}" data-choice-option="${at}" ${option.disabled?'disabled':''} aria-pressed="${option.selected}">${escape(option.text)}</button>`).join('')||'<p class="muted">没有匹配的项目</p>'}</div><nav class="choice-pages" aria-label="选项翻页"><button class="button" data-choice-step="-1" ${index===0?'disabled':''}>上一页</button><span>${index+1} / ${count}</span><button class="button" data-choice-step="1" ${index===count-1?'disabled':''}>下一页</button></nav>`;
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.openChoice){
    source=document.querySelector(`select[data-choice-id="${button.dataset.openChoice}"]`);
    if(!source||source.disabled)return;
    query='';index=0;draw();dialog.showModal();dialog.querySelector('input').focus();
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
  const caret=event.target.selectionStart;query=event.target.value;index=0;draw();
  const input=dialog.querySelector('input');input.focus();input.setSelectionRange(caret,caret);
});
dialog.addEventListener('close',()=>{source=null;});
