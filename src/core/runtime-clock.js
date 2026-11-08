// Running desktop windows keep producing; Android background time is discarded.
export function createRuntimeClock({pauseInBackground=false,now=0}={}){
  let last=now,paused=false;
  return {
    step(now){const elapsed=paused?0:Math.max(0,Math.min(60,(now-last)/1000));last=now;return elapsed;},
    visibility(hidden,now){
      if(pauseInBackground){paused=hidden;last=now;return 0;}
      if(hidden)return 0;
      const gap=Math.max(0,(now-last)/1000);last=now;return gap>1?gap:0;
    },
    get paused(){return paused;}
  };
}
