import {pinyin} from '../vendor/pinyin-pro/esm/core/pinyin/index.mjs';
import {customPinyin} from '../vendor/pinyin-pro/esm/core/custom/index.mjs';

const HAN=/\p{Script=Han}/u;
const cache=new Map(),CACHE_LIMIT=32768;
let lexiconReady=false;
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().normalize('NFD').replace(/u\u0308/g,'v').replace(/\p{M}/gu,'');
const compact=value=>value.replace(/[\s'’_-]+/g,'');

function phonetics(text){
  let entry=cache.get(text);
  if(entry)return entry;
  if(!lexiconReady){
    // Build the phrase dictionary only for the first romanized search, not on
    // startup or page switches. Here 镐 is a pickaxe (gǎo), not a place name.
    customPinyin({'镐':'gǎo'});lexiconReady=true;
  }
  // Keep ASCII runs (LV, EU, item IDs) intact in both forms. Only Han
  // characters contribute a single initial; punctuation stays a boundary.
  const parts=pinyin(text,{toneType:'none',type:'all',v:true});
  entry={full:compact(parts.map(p=>p.result).join('')),initials:compact(parts.map(p=>p.isZh?p.result[0]:p.result).join(''))};
  if(cache.size>=CACHE_LIMIT)cache.delete(cache.keys().next().value);
  cache.set(text,entry);
  return entry;
}

// Compile the query once per filter pass. Text/IDs remain searchable as before;
// romanization is computed lazily and reused across queries and live renders.
export function createSearch(query){
  const terms=normalize(query).trim().split(/\s+/u).filter(Boolean).map(raw=>({raw,latin:compact(raw)}));
  if(!terms.length)return ()=>true;
  return (...values)=>{
    const texts=values.filter(value=>value!==null&&value!==undefined).map(normalize);
    return terms.every(({raw,latin})=>texts.some(text=>{
      if(text.includes(raw))return true;
      if(!/^[a-z0-9]+$/.test(latin)||!HAN.test(text))return false;
      const forms=phonetics(text);
      return forms.full.includes(latin)||forms.initials.includes(latin);
    }));
  };
}
