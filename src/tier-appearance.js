import {VOLTAGE_TIERS,VOLTAGE_ERAS} from './data/voltage-tiers.js';
import {applyTier,tierFor} from './tier-theme.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function appearanceMarkup(preview){
  return `<section id="tierAppearance" class="tier-appearance" aria-label="电压外观">
    <div class="tier-controls"><div class="tier-steps"><button class="button" data-tier-step="-1">← 上一级</button><strong data-tier-title aria-live="polite"></strong><button class="button" data-tier-step="1">下一级 →</button></div><div class="tier-actions"><button class="button primary" data-tier-use>使用此外观</button><button class="button" data-tier-auto>随科技阶段</button><span class="muted" data-tier-mode></span></div></div>
    <nav class="tier-view-tabs" aria-label="外观内容">${[['ladder','电压阶梯'],['preview','基地预览'],['dna','STYLE DNA']].map(([id,text])=>`<button class="filter" data-tier-view="${id}" aria-pressed="false">${text}</button>`).join('')}</nav>
    <div class="tier-ladder" role="group" aria-label="15 级电压阶梯">${VOLTAGE_ERAS.map((era,index)=>`<section class="tier-era" data-era-group="${index}"><h3><span>${era.name}</span><small>${era.range}</small></h3><div class="tier-era-grid" style="--tier-count:${VOLTAGE_TIERS.filter(t=>t.era===index).length}">${VOLTAGE_TIERS.filter(t=>t.era===index).map(t=>`<button class="tier-tile" data-select-tier="${t.code}" aria-pressed="false" aria-label="${esc(t.code+' '+t.name+'，'+t.voltage)}"><strong>${t.code}</strong><small>${t.voltageShort}</small><i aria-hidden="true"></i><span>${t.material}</span></button>`).join('')}</div></section>`).join('')}</div>
    <nav class="tier-era-pages" aria-label="阶段分页"><button class="button" data-era-step="-1">上一组</button><span data-era-count></span><button class="button" data-era-step="1">下一组</button></nav>
    <div class="tier-inspector tier-skin"><section class="tier-preview"><h2>基地预览 <small>当前世界</small></h2><nav class="tier-preview-pages" aria-label="基地预览内容"><button class="filter" data-preview-view="energy" aria-pressed="true">设备电量</button><button class="filter" data-preview-view="production" aria-pressed="false">生产现场</button></nav>${preview}</section><section class="tier-dna surface section" aria-label="STYLE DNA"><div class="tier-dna-head"><div><div class="eyebrow">STYLE DNA <span data-dna-index></span></div><h2><span data-dna-code></span> · <span data-dna-name></span></h2><small data-dna-full></small></div><div class="tier-detail" aria-hidden="true"></div></div><nav class="tier-dna-pages" aria-label="风格详情"><button class="filter" data-dna-view="spec" aria-pressed="true">材质与工艺</button><button class="filter" data-dna-view="palette" aria-pressed="false">配色与说明</button></nav><p data-dna-description></p><dl>${[['voltage','额定电压'],['material','外壳材质'],['texture','表面工艺'],['glow','照明'],['progress','进度形态']].map(([key,label])=>`<div><dt>${label}</dt><dd data-dna-${key}></dd></div>`).join('')}</dl><div class="tier-palette">${[['a','强调'],['a2','次色'],['c1','机壳'],['p1','面板']].map(([key,label])=>`<div><i class="swatch-${key}"></i><span>${label}</span><code data-swatch="${key}"></code></div>`).join('')}</div><p class="tier-tags" data-dna-tags></p></section></div>
  </section>`;
}

// This controller owns selection and focus only. Its preview is rendered by the
// game using the same production/energy components and live world as gameplay.
export function mountAppearance(root,{selected,mode,onSelect,onUse,onAuto,view='ladder',eraPage=0,onView,onEraPage}){
  if(!root)return;
  let current=tierFor(selected),currentView=view,currentEra=eraPage,dnaPage='spec',previewPage='energy';
  const find=s=>root.querySelector(s),all=s=>[...root.querySelectorAll(s)];
  function layout(){
    // Measure natural content, including the real world's device names, before
    // choosing pages. Hiding overflow alone would make controls unreachable.
    root.dataset.compact='false';root.dataset.eraPaged='false';root.dataset.dnaPaged='false';root.dataset.previewPaged='false';root.dataset.view=currentView;
    all('[data-era-group]').forEach(el=>el.hidden=false);
    const bottom=innerHeight-16;
    const compact=root.getBoundingClientRect().bottom>bottom;
    root.dataset.compact=String(compact);
    const paged=compact&&innerWidth<=760&&(find('.tier-ladder').getBoundingClientRect().bottom>bottom||innerHeight<1000);
    root.dataset.eraPaged=String(paged);root.dataset.eraPage=String(currentEra);
    all('[data-era-group]').forEach(el=>el.hidden=paged&&Number(el.dataset.eraGroup)!==currentEra);
    root.dataset.dnaPage=dnaPage;
    if(compact&&currentView==='dna'&&find('.tier-dna').getBoundingClientRect().bottom>bottom)root.dataset.dnaPaged='true';
    root.dataset.previewPage=previewPage;
    if(compact&&currentView==='preview'&&find('.tier-preview').getBoundingClientRect().bottom>bottom)root.dataset.previewPaged='true';
    all('[data-preview-view]').forEach(el=>{el.classList.toggle('active',el.dataset.previewView===previewPage);el.setAttribute('aria-pressed',String(el.dataset.previewView===previewPage));});
    all('[data-dna-view]').forEach(el=>{el.classList.toggle('active',el.dataset.dnaView===dnaPage);el.setAttribute('aria-pressed',String(el.dataset.dnaView===dnaPage));});
    all('[data-tier-view]').forEach(el=>{const active=el.dataset.tierView===currentView;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
    find('[data-era-count]').textContent=`${currentEra+1} / 4 · ${VOLTAGE_ERAS[currentEra].name}`;
    all('[data-era-step]').forEach(b=>b.disabled=Number(b.dataset.eraStep)<0?currentEra===0:currentEra===3);
  }
  function update(code,focus=false){
    current=tierFor(code);applyTier(find('.tier-inspector'),current.code);
    find('.tier-detail').dataset.detail=current.detail;
    const text=(key,value)=>{find(`[data-${key}]`).textContent=value;};
    text('tier-title',`${current.code} · ${current.name}`);
    text('tier-mode',mode?`已固定 ${mode}`:'跟随科技');
    text('dna-index',`${String(current.index+1).padStart(2,'0')} / 15`);
    for(const [key,value] of Object.entries({code:current.code,name:current.name,full:current.fullName,description:current.description,voltage:current.voltage,material:`${current.material} / ${current.materialEn}`,texture:current.spec.texture,glow:current.spec.glow,progress:current.spec.progress,tags:current.tags.join(' · ')}))text('dna-'+key,value);
    const colors={a:current.palette.accent[0],a2:current.palette.accent[1],c1:current.palette.casing[0],p1:current.palette.panel[0]};
    all('[data-swatch]').forEach(el=>el.textContent=colors[el.dataset.swatch].toUpperCase());
    all('[data-select-tier]').forEach(el=>{applyTier(el,el.dataset.selectTier);const active=el.dataset.selectTier===current.code;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));el.tabIndex=active?0:-1;});
    all('[data-tier-step]').forEach(el=>el.disabled=Number(el.dataset.tierStep)<0?current.index===0:current.index===14);
    if(focus||root.dataset.eraPaged==='true'){currentEra=current.era;onEraPage(currentEra);}
    layout();onSelect(current.code);
    if(focus)find(`[data-select-tier="${current.code}"]`).focus({preventScroll:true});
  }
  root.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.selectTier)update(b.dataset.selectTier);
    else if(b.dataset.tierStep)update(VOLTAGE_TIERS[current.index+Number(b.dataset.tierStep)].code);
    else if(b.dataset.tierView){currentView=b.dataset.tierView;onView(currentView);layout();}
    else if(b.dataset.dnaView){dnaPage=b.dataset.dnaView;layout();}
    else if(b.dataset.previewView){previewPage=b.dataset.previewView;layout();}
    else if(b.dataset.eraStep){currentEra+=Number(b.dataset.eraStep);onEraPage(currentEra);layout();}
    else if(b.hasAttribute('data-tier-use'))onUse(current.code);
    else if(b.hasAttribute('data-tier-auto'))onAuto();
  });
  root.addEventListener('keydown',ev=>{
    const tile=ev.target.closest('[data-select-tier]');if(!tile||ev.altKey||ev.ctrlKey||ev.metaKey)return;
    let index=tierFor(tile.dataset.selectTier).index;
    if(['ArrowRight','ArrowDown'].includes(ev.key))index++;
    else if(['ArrowLeft','ArrowUp'].includes(ev.key))index--;
    else if(ev.key==='Home')index=0;
    else if(ev.key==='End')index=14;
    else return;
    ev.preventDefault();update(VOLTAGE_TIERS[Math.max(0,Math.min(14,index))].code,true);
  });
  // Paginating to another era must leave a Tab stop in the visible ladder.
  root.addEventListener('focusin',()=>{
    if(root.dataset.eraPaged!=='true')return;
    const visible=all('[data-era-group]:not([hidden]) [data-select-tier]');
    if(!visible.some(el=>el.tabIndex===0)&&visible[0])visible[0].tabIndex=0;
  });
  update(current.code);
}
