import {mobile} from './platform.js';
const MOBILE_GRIDS={
  resources:{width:300,rowHeight:230},space:{width:300,rowHeight:230},
  factory:{width:350,rowHeight:230},stack:{width:350,rowHeight:230},
  fluids:{width:320,rowHeight:230},inventory:{width:230,rowHeight:68},
  research:{width:320,rowHeight:148},book:{width:96,rowHeight:100,gap:6},
  containers:{width:370,rowHeight:140},categories:{width:150,rowHeight:44},
  choice:{width:180,rowHeight:86},recipeChoice:{width:220,rowHeight:130}
};
// Shared dimensions are budgets for pagination, not forced panel heights.
export const LAYOUT=Object.freeze({
  gap:14,
  factorySidebar:Object.freeze({width:210,compactWidth:180,compactAt:950,gap:14}),
  grids:Object.freeze({
    resources:{width:360,rowHeight:360},
    space:{width:360,rowHeight:360},
    factory:{width:370,rowHeight:300},
    stack:{width:370,rowHeight:300},
    fluids:{width:360,rowHeight:340},
    inventory:{width:260,rowHeight:82,gap:10},
    research:{width:370,rowHeight:160,gap:12},
    book:{width:112,rowHeight:128,gap:6},
    containers:{width:520,rowHeight:156,gap:12},
    categories:{width:170,rowHeight:44,gap:8},
    choice:{width:205,rowHeight:140,gap:10},
    recipeChoice:{width:205,rowHeight:220,gap:10}
  })
});

export function factoryContentWidth(width){
  if(mobile)return Math.max(0,width-132);
  const rail=LAYOUT.factorySidebar;
  return Math.max(0,width-(width<rail.compactAt?rail.compactWidth:rail.width)-rail.gap);
}

export function fitRows(height,reserved,rowHeight,gap=LAYOUT.gap){
  return Math.max(1,Math.floor((Math.max(0,height-reserved)+gap)/(rowHeight+gap)));
}

export function planGrid(key,{width,height},reserved=100){
  const spec=mobile?MOBILE_GRIDS[key]:LAYOUT.grids[key],gap=spec.gap??(mobile?8:LAYOUT.gap);
  const columns=Math.max(1,Math.floor((Math.max(0,width)+gap)/(spec.width+gap)));
  const rows=fitRows(height,reserved,spec.rowHeight,gap);
  return {columns,rows,size:columns*rows,width:spec.width,gap,rowHeight:spec.rowHeight};
}

export function gridStyle(plan){
  return `--columns:${plan.columns};--tile-width:${plan.width}px;--tile-min-height:${plan.rowHeight}px;--grid-gap:${plan.gap}px`;
}

// Reserve following controls whether they sit inside or after a grid.
export function contentBottom(root,element){
  const boundary=root.getBoundingClientRect().bottom-(parseFloat(getComputedStyle(root).paddingBottom)||0);
  let total=0;
  for(let node=element;node.parentElement&&node!==root;node=node.parentElement){
    const box=node.getBoundingClientRect();let bottom=box.bottom;
    for(let next=node.nextElementSibling;next;next=next.nextElementSibling){
      const rect=next.getBoundingClientRect();
      if(rect.height&&rect.top>=box.bottom-1)bottom=Math.max(bottom,rect.bottom);
    }
    total+=bottom-box.bottom;
    if(node.parentElement!==root)total+=parseFloat(getComputedStyle(node.parentElement).paddingBottom)||0;
  }
  return boundary-total;
}

// Fit natural rows on page changes/resizes, never on the refresh timer.
export function fitPageLimits(root,plans,gridLimits,listLimits){
  let changed=false;
  for(const grid of root.querySelectorAll('[data-fit-grid],[data-fit-list]')){
    if(grid.classList.contains('has-expanded'))continue;
    const entries=[...grid.children].filter(node=>node.tagName!=='NAV'&&!node.classList.contains('empty'));
    if(!entries.length)continue;
    const controls=grid.querySelector(':scope > nav');
    const controlHeight=controls?controls.getBoundingClientRect().height+(parseFloat(getComputedStyle(grid).rowGap)||8):0;
    const limit=contentBottom(root,grid)-controlHeight,tracks=[];
    for(const entry of entries){
      const rect=entry.getBoundingClientRect();
      if(!rect.height)continue;
      const last=tracks.at(-1);
      if(last&&Math.abs(last.top-rect.top)<2)last.bottom=Math.max(last.bottom,rect.bottom);
      else tracks.push({top:rect.top,bottom:rect.bottom});
    }
    if(!tracks.some(row=>row.bottom>limit+1))continue;
    const count=Math.max(1,tracks.findIndex(row=>row.bottom>limit+1));
    const key=grid.dataset.fitGrid||grid.dataset.fitList;
    const limits=grid.hasAttribute('data-fit-grid')?gridLimits:listLimits;
    const current=grid.hasAttribute('data-fit-grid')?plans.get(key)?.rows:entries.length;
    if(current&&count<current&&count<(limits.get(key)??Infinity)){
      limits.set(key,count);changed=true;
    }
  }
  return changed;
}
