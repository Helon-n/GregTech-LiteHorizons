import {VOLTAGE_TIERS} from './data/voltage-tiers.js';

// Non-material UI colors from applyTier() in the visual source of truth.
const NEUTRALS={
  dark:{ink:'#dde5e0',dim:'#aab5ae',line:'rgba(255,255,255,0.09)',inset:'#070a0b',danger:'#e89f8b',warning:'#d8b77b'},
  light:{ink:'#26231d',dim:'#6b665a',line:'rgba(0,0,0,0.16)',inset:'#cdc7b8',danger:'#983b2f',warning:'#765414'}
};
const COMMON={highlight:'#ffffff',shadow:'#000000',
  spectrum:'conic-gradient(from 0deg, #ff6b6b, #ffd76a, #6be08a, #5fd9ff, #b58cff, #ff6bd0, #ff6b6b)',
  'spectrum-wash':'conic-gradient(from 200deg, rgba(255,0,0,.09), rgba(255,200,0,.09), rgba(0,255,120,.09), rgba(0,200,255,.09), rgba(160,0,255,.09), rgba(255,0,120,.09), rgba(255,0,0,.09))'
};
const KEY='glh-voltage-appearance';
const appliedTiers=new WeakMap();
export function tierFor(code){return VOLTAGE_TIERS.find(t=>t.code.toUpperCase()===String(code).toUpperCase())||VOLTAGE_TIERS[0];}
export function tierTokens(code){
  const t=tierFor(code),n=NEUTRALS[t.light?'light':'dark'];
  const [a,a2]=t.palette.accent,[c1,c2,c3]=t.palette.casing,[p1,p2]=t.palette.panel;
  return {...COMMON,...n,'readable-dim':t.light?'#625d51':n.dim,a,a2,'a-ink':t.light?'#7a5418':a,c1,c2,c3,p1,p2,bg:t.background,
    'lcd-bg':t.lcdBackground,'lcd-tx':a,'on-accent':'#070a0b',
    glow:`color-mix(in srgb, ${a} 36%, transparent)`,wash:`color-mix(in srgb, ${a} 10%, transparent)`};
}
export function applyTier(element,code){
  const tier=tierFor(code);
  if(appliedTiers.get(element)===tier.code)return tier;
  element.classList.add('tier-skin');
  Object.assign(element.dataset,{tier:tier.code,era:String(tier.era),tex:tier.texture,detail:tier.detail,light:String(tier.light)});
  for(const [key,value] of Object.entries(tierTokens(tier.code)))element.style.setProperty('--'+key,value);
  appliedTiers.set(element,tier.code);
  return tier;
}
export function readAppearance(storage){
  try{const code=storage.getItem(KEY);return VOLTAGE_TIERS.some(t=>t.code===code)?code:null;}catch{return null;}
}
export function saveAppearance(storage,code){
  try{if(code)storage.setItem(KEY,tierFor(code).code);else storage.removeItem(KEY);return true;}catch{return false;}
}
