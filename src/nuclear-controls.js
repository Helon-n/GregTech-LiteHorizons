import {NUCLEAR_REFERENCE as N} from './data/nuclear-reference.js';
import {componentCount} from './core/components.js';

const views=new Map();
export function setNuclearView(id,key,value){const v=views.get(id)??{slot:0,category:'fuel',page:0};v[key]=value;if(key==='category')v.page=0;if(key==='slot')v.panel='parts';views.set(id,v);}
export function nuclearControls({game,d,icon,name,num,e,fluidInputControls}){
  const s=d.nuclear,v=views.get(d.id)??{slot:0,category:'fuel',page:0},width=N.baseColumns+s.chambers;
  const selected=s.slots[v.slot];
  const action=(action,label,disabled=false)=>`<button class="button" data-nuclear-action="${action}" data-index="${v.slot}" data-nuclear-device="${d.id}" ${disabled?'disabled':''}>${label}</button>`;
  const detail=part=>{
    const q=N.parts[part.item];
    if(q.kind==='fuel')return `剩余 ${num(q.capacity-part.damage)} 秒`;
    if(q.kind==='breeder')return `增殖 ${num(part.damage)} / ${num(q.capacity)} 脉冲`;
    if(q.capacity)return `${q.kind==='reflector'?'磨损':'蓄热'} ${num(part.damage)} / ${num(q.capacity)}`;
    return q.kind==='spent'?'可取出处理':'无耐久消耗';
  };
  const pool=Object.entries(N.parts).filter(([id,p])=>{
    const kind=p.kind==='fuel'?'fuel':p.kind==='breeder'?'breeder':p.kind==='plating'||p.kind==='reflector'?'protection':p.kind==='spent'?'spent':'cooling';
    return kind===v.category&&(game.quantity(id)>0||componentCount(game,id)>0);
  }),pages=Math.max(1,Math.ceil(pool.length/6)),page=Math.min(v.page,pages-1);
  const viewButton=(key,label)=>`<button class="filter ${(v.panel??'layout')===key?'active':''}" data-nuclear-view="panel" data-nuclear-device="${d.id}" data-value="${key}" aria-pressed="${(v.panel??'layout')===key}">${label}</button>`;
  const layout=`<div class="nuclear-layout" role="group" aria-label="反应堆 ${width} 列六行布局">${s.slots.map((part,i)=>`<button class="nuclear-slot ${v.slot===i?'active':''}" data-nuclear-view="slot" data-nuclear-device="${d.id}" data-value="${i}" aria-label="第 ${Math.floor(i/9)+1} 行第 ${i%9+1} 列${part?'，'+e(name(part.item))+'，'+detail(part):'，空槽'}" aria-pressed="${v.slot===i}" ${i%9>=width?'disabled':''} title="${part?e(name(part.item)+' · '+detail(part)):'空槽'}">${part?icon(part.item):''}${part?.damage?`<span class="nuclear-wear" style="--remaining:${Math.max(0,1-part.damage/powerCapacity(part))*100}%"></span>`:''}</button>`).join('')}</div><p class="small muted">点击槽位更换组件。燃料、散热和反射按相邻槽位作用。</p>`;
  const repair=selected&&N.repairs[selected.item]?action('repair','修复冷凝器',d.enabled||!selected.damage)+'<span class="small muted">'+Object.entries(N.repairs[selected.item]).map(([id,n])=>e(name(id))+' ×'+n).join('、')+'</span>':'';
  const picker=`<p class="small muted">第 ${Math.floor(v.slot/9)+1} 行第 ${v.slot%9+1} 列 · ${selected?e(name(selected.item))+' · '+detail(selected):'空槽'}</p><div class="energy-actions">${action('remove','取出选中组件',d.enabled||!selected)}${repair}</div><div class="energy-modes" role="group" aria-label="反应堆组件分类">${[['fuel','燃料'],['cooling','散热'],['protection','防护'],['breeder','增殖'],['spent','乏燃料']].map(([key,label])=>`<button class="filter ${v.category===key?'active':''}" data-nuclear-view="category" data-nuclear-device="${d.id}" data-value="${key}" aria-pressed="${v.category===key}">${label}</button>`).join('')}</div><div class="nuclear-parts">${pool.slice(page*6,page*6+6).map(([id,q])=>`<button class="button" data-nuclear-part="${id}" data-nuclear-device="${d.id}" data-index="${v.slot}" ${d.enabled?'disabled':''} title="${e(name(id))}">${icon(id)}<span>${e(name(id))}<small>新品 ${num(game.quantity(id))} · 已用 ${componentCount(game,id)}</small></span></button>`).join('')||'<p class="small muted">仓库中暂无此类组件</p>'}</div>${pages>1?`<div class="energy-actions"><button class="button" data-nuclear-view="page" data-nuclear-device="${d.id}" data-value="${page-1}" ${page<=0?'disabled':''}>上一页</button><span>${page+1} / ${pages}</span><button class="button" data-nuclear-view="page" data-nuclear-device="${d.id}" data-value="${page+1}" ${page+1>=pages?'disabled':''}>下一页</button></div>`:''}`;
  const structure=`<p class="small muted">反应堆仓 ${s.chambers} / 6 · ${width} 列六行。</p>${action('chamber','添加反应堆仓',d.enabled||s.chambers>=6)}${s.fluid?'<p class="small muted">压力容器模式 · 散热转化为热冷却液，不直接输出电力。</p>'+fluidInputControls(d):action('fluid','改造为流体反应堆',d.enabled||s.chambers!==6)}<button class="button" data-empty-energy="${d.id}" ${d.enabled?'disabled':''}>退回机内流体并排空电量</button>${!s.fluid?`<div class="small muted">压力容器材料：${Object.entries(N.fluidStructure).map(([id,n])=>e(name(id))+' ×'+n).join('、')}。改造前清空并冷却堆芯。</div>`:''}`;
  return `<div class="nuclear-panel"><div class="energy-modes" role="group" aria-label="反应堆配置">${viewButton('layout','布局')}${viewButton('parts','组件')}${viewButton('structure','结构与冷却')}</div>${v.panel==='parts'?picker:v.panel==='structure'?structure:layout}${s.tripped?action('reset','过热保护复位',d.enabled||s.heat>=s.maxHeat):''}<p class="small muted">${s.fluid?'需要冷却液输入和热冷却液输出容器。':'EU 模式 · EV 输出 · '+N.euMultiplier+' EU/脉冲。'} 过热触发保护；停止后散热组件继续工作。</p></div>`;
}
const powerCapacity=part=>N.parts[part.item]?.capacity??1;
