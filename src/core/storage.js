import { Game } from './engine.js';
const KEY='gtnh-long-road-v2', BACKUP=KEY+'-backup';
export function loadWorld(){
  for(const key of [KEY,BACKUP]){try{const text=localStorage.getItem(key);if(!text)continue;const g=new Game(JSON.parse(text));return{game:g,recovered:key===BACKUP};}catch(error){console.warn('Save rejected',key,error.message);}}
  return{game:new Game(),recovered:false};
}
export function saveWorld(game){try{const next=JSON.stringify(game.snapshot());new Game(JSON.parse(next));const previous=localStorage.getItem(KEY);if(previous){try{new Game(JSON.parse(previous));localStorage.setItem(BACKUP,previous);}catch(error){console.warn('Ignoring invalid previous save',error.message);}}localStorage.setItem(KEY,next);return true;}catch(error){console.error(error);return false;}}
export function replaceWorld(raw){const g=new Game(raw);if(!saveWorld(g))throw Error('无法保存存档，请检查磁盘空间');return g;}
export function exportWorld(game){return JSON.stringify(game.snapshot(),null,2);}
