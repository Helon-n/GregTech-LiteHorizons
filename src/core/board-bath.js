export const BATH_CAPACITY=1000000;
export function tickBoardBath(game,d,r,dt){
  if(!r?.bath)return;
  d.bathClock=(d.bathClock??0)+dt;
  if(d.bathClock<1)return;d.bathClock%=1;
  if(d.boardBath?.amount&&d.boardBath.impurity/d.boardBath.amount*100>=(d.bathFlushPercent??100)){
    if(!flushBoardBath(game,d).ok){d.blocked='等待废液输出容器';return;}
  }
  prepareBoardBath(game,d,r,true);
}
export function flushBoardBath(game,d){
  const bath=d.boardBath;if(!bath?.amount)return {ok:true};
  const waste=Math.trunc(bath.amount/bath.divisor);
  if(!game.add({[bath.waste]:waste},true,d.fluidOutputs))return {ok:false,message:'排液需要兼容的输出容器'};
  delete d.boardBath;return {ok:true};
}
export function prepareBoardBath(game,d,r,refill=false){
  if(!r.bath)return '';
  if(d.boardBath?.amount&&d.boardBath.fluid!==r.bath.fluid)return '请先排出原有浸液';
  if(d.boardBath?.amount&&d.boardBath.impurity/d.boardBath.amount*100>=(d.bathFlushPercent??100)){
    if(!flushBoardBath(game,d).ok)return '浸液已失效，等待排液容器';
  }
  const bath=d.boardBath??={...r.bath,amount:0,impurity:0,processed:0};
  const amount=refill||!bath.amount?Math.min(BATH_CAPACITY-bath.amount,game.inputQuantity(bath.fluid,d.fluidInputs[bath.fluid])):0;
  if(amount>0&&game.payInputs(d,{[bath.fluid]:amount}))bath.amount+=amount;
  return bath.amount<BATH_CAPACITY*.5?'浸液不足，需要至少 500,000 mB':bath.impurity>=bath.amount?'浸液已失效':'';
}
export function boardBathDuration(d){
  const bath=d.boardBath;if(!bath?.amount)return 1;
  const impurity=bath.impurity/bath.amount;
  return impurity<=.15?.7+impurity*2:impurity>=.65?1+2*(impurity-.65):1;
}
export function soilBoardBath(d,r){
  if(!r.bath||!d.boardBath)return;
  const bath=d.boardBath;bath.processed+=Object.values(r.outputs).reduce((a,n)=>a+n,0);
  while(bath.processed>=1000){
    bath.processed-=1000;
    bath.impurity+=Math.trunc(Math.min(100/(bath.amount/BATH_CAPACITY)**1.5,bath.amount-bath.impurity));
  }
}
