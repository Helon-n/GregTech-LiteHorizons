// Only the packaged Android host supplies this bridge. Browser previews use touch detection.
export const android=typeof globalThis.GTLHAndroid?.request==='function';
export const mobile=android||(!/Electron\//.test(globalThis.navigator?.userAgent||'')&&Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches));
if(mobile&&globalThis.document)document.documentElement.dataset.mobile='true';

let next=0;
const pending=new Map();
globalThis.gtlhNativeResult=(id,result)=>{
  const job=pending.get(id);if(!job)return;
  pending.delete(id);
  if(result.error)job.reject(new Error(result.error));else job.resolve(result);
};
export function nativeRequest(action,payload={}){
  if(!android)return Promise.reject(new Error('此功能需要安卓应用'));
  const id=String(++next);
  return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject});
    try{globalThis.GTLHAndroid.request(JSON.stringify({id,action,...payload}));}
    catch(error){pending.delete(id);reject(error);}
  });
}
export async function exportFile(text,filename){
  if(android){const result=await nativeRequest('export',{text,filename});return !result.cancelled;}
  const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
}
