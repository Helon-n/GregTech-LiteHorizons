import {Game} from './core/engine.js';
import {createProductionPreview} from './core/production-plan.js';

self.onmessage=({data})=>{
  try{
    const game=new Game(data.state);
    self.postMessage({id:data.id,preview:createProductionPreview(game,data.root,data.batches,data.choices,data.favorites)});
  }catch(error){self.postMessage({id:data.id,error:error.message});}
};
