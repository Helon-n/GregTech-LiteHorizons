import {android} from './platform.js';

let source;
const urls=new WeakMap();

export async function createRecipeWorker(){
  const packagedAndroid=android&&globalThis.location?.hostname==='appassets.androidplatform.net';
  if(!packagedAndroid)return new Worker(new URL('./recipe-tree-worker.js',import.meta.url),{type:'module'});
  // WebView's asset interceptor does not serve module-worker requests. Fetch a
  // bundled script through the page, then run it in a dedicated local worker.
  source??=fetch(new URL('./recipe-tree-worker.android.js',import.meta.url))
    .then(response=>{if(!response.ok)throw Error('无法加载配方计算');return response.text();})
    .catch(error=>{source=null;throw error;});
  const text=await source;
  const url=URL.createObjectURL(new Blob([text],{type:'text/javascript'}));
  try{const worker=new Worker(url);urls.set(worker,url);return worker;}
  catch(error){URL.revokeObjectURL(url);throw error;}
}

export function destroyRecipeWorker(worker){
  worker.terminate();
  const url=urls.get(worker);
  if(url){URL.revokeObjectURL(url);urls.delete(worker);}
}
