import {contentBottom} from './layout.js';
// Explicit pages for long panels; editable controls stay mounted.
const positions=new Map(),mounted=new WeakMap();
const selectors='.workbench,.device-card,.device-stack:not(.expanded),.section,.recipe-tree,.fluid-container,.resource-card.automatic,.mobile-dialog-body,.mobile-dialog-body>form,.nuclear-panel';
export function fitMobilePanels(root){
  for(const panel of [...root.querySelectorAll(selectors)].reverse()){
    const previous=mounted.get(panel);
    if(previous){for(const part of previous.parts)delete part.dataset.mobileHidden;previous.nav.remove();mounted.delete(panel);}
    if(panel.closest('[hidden]')||!panel.getClientRects().length)continue;
    const bottom=contentBottom(root,panel),rect=panel.getBoundingClientRect();
    if(rect.bottom<=bottom)continue;
    const children=[...panel.children].filter(el=>el.getClientRects().length&&!el.hidden);
    const fixed=children.filter(el=>el.matches('.card-top,.device-tabs,.pool-top,.resource-tabs,.section-head'));
    const heightOf=el=>{const c=getComputedStyle(el);return el.getBoundingClientRect().height+(parseFloat(c.marginTop)||0)+(parseFloat(c.marginBottom)||0)+4;};
    const budget=Math.max(64,bottom-rect.top-64-fixed.reduce((n,e)=>n+heightOf(e),0));
    const units=[];
    function collect(el){
      const parts=[...el.children].filter(c=>c.getClientRects().length&&!c.hidden);
      if(heightOf(el)>budget&&parts.length&&!el.matches('button,label,.collector-controls,.bench-layout,.bench-grid,.nuclear-layout,.choice-options,.tank-readout,.device-io,.machine-gauge')){
        for(const child of parts)collect(child);
      }else units.push(el);
    }
    for(const el of children)if(!fixed.includes(el))collect(el);
    const rows=[];
    for(const el of units){
      const last=rows.at(-1),peer=last?.at(-1),box=el.getBoundingClientRect(),other=peer?.getBoundingClientRect();
      if(panel.matches('.resource-card')&&peer?.parentElement===el.parentElement&&box.top<other.bottom-1&&box.bottom>other.top+1)last.push(el);
      else rows.push([el]);
    }
    const groups=[];let group=[],height=0;
    for(const row of rows){const h=Math.max(...row.map(heightOf));if(group.length&&height+h>budget){groups.push(group);group=[];height=0;}group.push(...row);height+=h;}
    if(group.length)groups.push(group);if(groups.length<2)continue;
    const key=[root.dataset.page,panel.dataset.device||panel.dataset.container||panel.dataset.benchRecipe||panel.className,panel.querySelector('h2,h3')?.textContent,panel.querySelector('.device-tabs .active')?.textContent].join(':');
    const nav=document.createElement('nav');nav.className='mobile-panel-pages';nav.setAttribute('aria-label','面板内容翻页');
    nav.innerHTML='<button class="button" data-mobile-panel-step="-1" aria-label="上一部分">‹</button><span aria-live="polite"></span><button class="button" data-mobile-panel-step="1" aria-label="下一部分">›</button>';
    panel.append(nav);let index=Math.min(positions.get(key)||0,groups.length-1);mounted.set(panel,{parts:units,nav});
    const draw=()=>{
      for(const [i,parts] of groups.entries())for(const part of parts){if(i!==index)part.dataset.mobileHidden='true';else delete part.dataset.mobileHidden;}
      nav.querySelector('span').textContent=`内容 ${index+1} / ${groups.length}`;
      nav.firstElementChild.disabled=index===0;nav.lastElementChild.disabled=index===groups.length-1;positions.set(key,index);
    };
    nav.addEventListener('click',event=>{const step=Number(event.target.closest('button')?.dataset.mobilePanelStep);if(step){index=Math.max(0,Math.min(groups.length-1,index+step));draw();}});draw();
  }
}
