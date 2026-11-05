import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from '@playwright/test';

// The NSIS launcher does not forward Electron's inspector stderr to Playwright.
// Launch the real single-file artifact and connect to its Chromium debug port.
export async function launchPortable(executablePath,env){
  const listener=net.createServer();
  await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve);});
  const port=listener.address().port;
  await new Promise((resolve,reject)=>listener.close(error=>error?reject(error):resolve()));
  const child=spawn(executablePath,[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1'],{env,windowsHide:true,stdio:'ignore'});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  let browser,window;
  const exited=new Promise(resolve=>child.once('exit',resolve));
  async function close(){
    if(window&&!window.isClosed())await window.close().catch(()=>{});
    if(browser)await browser.close().catch(()=>{});
    if(child.exitCode===null){await Promise.race([exited,delay(10000)]);if(child.exitCode===null)child.kill();}
  }
  try{
    const endpoint=`http://127.0.0.1:${port}`;
    const deadline=Date.now()+60000;
    let ready=false;
    while(Date.now()<deadline){
      if(child.exitCode!==null)throw Error('Portable launcher exited before the app became ready: '+child.exitCode);
      try{const response=await fetch(endpoint+'/json/version',{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}catch{}
      await delay(250);
    }
    if(!ready)throw Error('Portable app did not expose its test connection within 60 seconds');
    browser=await chromium.connectOverCDP(endpoint);
    const context=browser.contexts()[0];
    window=context.pages()[0]||await context.waitForEvent('page',{timeout:30000});
    return {firstWindow:async()=>window,close};
  }catch(error){await close();throw error;}
}
