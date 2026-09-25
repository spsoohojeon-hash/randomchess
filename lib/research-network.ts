import {CARDS} from './game.ts';
import type {Action} from './game.ts';
import type {PolicyInput} from './research-policy.ts';
export const ENCODER='private-observation-v1';
const kinds=['p','n','b','r','q','k'],phases=['play','reaction','choice','duel','rescue','over'];
const types=['move','ability','reaction','choice','duel','resign','acceptDefeat','draw','acceptDraw','declineDraw','skipExtra'];
const cardIds=CARDS.map(c=>c.id);
export const INPUTS=64*14+2*cardIds.length*7+2+phases.length+4+12;
export const ACTIONS=types.length+cardIds.length+64*3+5+3+2+2+1;
export type Shape={input:number;h1:number;h2:number;output:number};
export type Weights={w1:Float32Array;b1:Float32Array;w2:Float32Array;b2:Float32Array;wp:Float32Array;bp:Float32Array;wv:Float32Array;bv:Float32Array};
export type Network={encoder:string;shape:Shape;weights:Weights};
export type Example={x:Float32Array;actions:Float32Array[];target:number;value:number};
const keys=['w1','b1','w2','b2','wp','bp','wv','bv'] as const;
const bound=(v:number,max:number)=>Math.max(-1,Math.min(1,(Number.isFinite(v)?v:0)/max));
export function encodePosition(input:PolicyInput):Float32Array{
 const {view:g,viewer}=input,x=new Float32Array(INPUTS);let offset=0;
 for(let at=0;at<64;at++){
  const p=g.board[at];if(!p)continue;const square=viewer==='w'?at:at^56,base=square*14;
  x[base+(p.color===viewer?0:6)+kinds.indexOf(p.kind)]=1;x[base+12]=p.moved?1:0;x[base+13]=p.form?1:0;
 }
 offset=64*14;
 for(const side of [viewer,viewer==='w'?'b':'w'] as const){
  for(const a of [g.abilities[side],...(g.extraAbilities?.[side]??[])]){
   const index=cardIds.indexOf(a.id as typeof cardIds[number]);if(index<0)continue;const base=offset+index*7;
   x[base]=1;x[base+1]=a.active?1:0;x[base+2]=bound(a.uses,10);x[base+3]=bound(a.threats,5);x[base+4]=bound(a.castleCount,7);x[base+5]=bound(a.ammo??0,8);x[base+6]=bound(a.power?.left??0,15);
  }offset+=cardIds.length*7;
 }
 x[offset++]=g.abilities[viewer].id==='hidden'?1:0;x[offset++]=g.abilities[viewer==='w'?'b':'w'].id==='hidden'?1:0;
 x[offset+phases.indexOf(g.phase)]=1;offset+=phases.length;
 x[offset++]=g.turn===viewer?1:-1;x[offset++]=bound(g.doubleLeft,2);x[offset++]=bound(g.giveMe?.[viewer].score??0,5);x[offset++]=bound(Math.log1p(g.ply),8);
 for(const side of [viewer,viewer==='w'?'b':'w'] as const){for(const p of g.captured[side])x[offset+kinds.indexOf(p.kind)]+=1/16;offset+=6;}
 return x;
}
export function encodeAction(action:Action,viewer:'w'|'b'):Float32Array{
 const x=new Float32Array(ACTIONS);let offset=0;
 const type=types.indexOf(action.type);if(type>=0)x[type]=1;offset+=types.length;
 const card=cardIds.indexOf(action.card!);if(card>=0)x[offset+card]=1;offset+=cardIds.length;
 for(const at of [action.from,action.to,action.piece]){if(at!==undefined&&at>=0&&at<64)x[offset+(viewer==='w'?at:at^56)]=1;offset+=64;}
 const promotion=['q','r','b','n','k'].indexOf(action.promotion!);if(promotion>=0)x[offset+promotion]=1;offset+=5;
 const gesture=['rock','paper','scissors'].indexOf(action.gesture!);if(gesture>=0)x[offset+gesture]=1;offset+=3;
 if(action.choice)x[offset+(action.choice===viewer?0:1)]=1;offset+=2;
 if(action.mode)x[offset+(action.mode==='burst'?1:0)]=1;offset+=2;
 if(action.capture!==undefined)x[offset]=bound(action.capture+1,32);
 return x;
}
export function createNetwork(random:()=>number=Math.random,h1=64,h2=32):Network{
 const shape={input:INPUTS,h1,h2,output:ACTIONS};
 const weights:Weights={w1:new Float32Array(INPUTS*h1),b1:new Float32Array(h1),w2:new Float32Array(h1*h2),b2:new Float32Array(h2),wp:new Float32Array(h2*ACTIONS),bp:new Float32Array(ACTIONS),wv:new Float32Array(h2),bv:new Float32Array(1)};
 for(const [key,fan] of [['w1',INPUTS],['w2',h1],['wp',h2],['wv',h2]] as const)for(let i=0;i<weights[key].length;i++)weights[key][i]=(random()*2-1)*Math.sqrt(6/fan);
 return {encoder:ENCODER,shape,weights};
}
function dense(input:Float32Array,weights:Float32Array,bias:Float32Array,relu=false){
 const out=new Float32Array(bias);for(let j=0;j<out.length;j++){let value=out[j],base=j*input.length;for(let i=0;i<input.length;i++)value+=weights[base+i]*input[i];out[j]=relu?Math.max(0,value):value;}return out;
}
export function forward(network:Network,x:Float32Array,actions:Float32Array[]){
 const w=network.weights,h1=dense(x,w.w1,w.b1,true),h2=dense(h1,w.w2,w.b2,true),policy=dense(h2,w.wp,w.bp);
 const logits=actions.map(a=>{let score=0;for(let i=0;i<a.length;i++)score+=a[i]*policy[i];return score;});
 const max=logits.length?Math.max(...logits):0,exps=logits.map(l=>Math.exp(l-max)),sum=exps.reduce((a,b)=>a+b,0)||1;
 let value=w.bv[0];for(let i=0;i<h2.length;i++)value+=h2[i]*w.wv[i];
 return {h1,h2,policy,probabilities:exps.map(p=>p/sum),value:Math.tanh(value)};
}
export function predict(network:Network,input:PolicyInput){return forward(network,encodePosition(input),input.actions.map(a=>encodeAction(a,input.viewer)));}
export function loss(network:Network,e:Example){const p=forward(network,e.x,e.actions);return {policy:-Math.log(Math.max(1e-9,p.probabilities[e.target])),value:(p.value-e.value)**2,correct:p.probabilities.indexOf(Math.max(...p.probabilities))===e.target?1:0};}
function zeros(network:Network):Weights{return Object.fromEntries(keys.map(k=>[k,new Float32Array(network.weights[k].length)])) as Weights;}
export type Optimizer={step:number;m:Weights;v:Weights};
export function optimizer(network:Network):Optimizer{return {step:0,m:zeros(network),v:zeros(network)};}
export function trainBatch(network:Network,examples:Example[],opt:Optimizer,rate=.001){
 const w=network.weights,gradient=zeros(network);let total=0;
 for(const e of examples){
  const p=forward(network,e.x,e.actions),dp=new Float32Array(ACTIONS),dh2=new Float32Array(network.shape.h2),dh1=new Float32Array(network.shape.h1);
  total+=-Math.log(Math.max(1e-9,p.probabilities[e.target]))+.5*(p.value-e.value)**2;
  for(let a=0;a<e.actions.length;a++){const delta=p.probabilities[a]-(a===e.target?1:0);for(let i=0;i<ACTIONS;i++)dp[i]+=delta*e.actions[a][i];}
  for(let j=0;j<ACTIONS;j++){gradient.bp[j]+=dp[j];for(let i=0;i<dh2.length;i++){gradient.wp[j*dh2.length+i]+=dp[j]*p.h2[i];dh2[i]+=dp[j]*w.wp[j*dh2.length+i];}}
  const dv=(p.value-e.value)*(1-p.value*p.value);gradient.bv[0]+=dv;
  for(let i=0;i<dh2.length;i++){gradient.wv[i]+=dv*p.h2[i];dh2[i]+=dv*w.wv[i];}
  for(let j=0;j<dh2.length;j++){const delta=p.h2[j]>0?dh2[j]:0;gradient.b2[j]+=delta;for(let i=0;i<dh1.length;i++){gradient.w2[j*dh1.length+i]+=delta*p.h1[i];dh1[i]+=delta*w.w2[j*dh1.length+i];}}
  for(let j=0;j<dh1.length;j++){const delta=p.h1[j]>0?dh1[j]:0;gradient.b1[j]+=delta;for(let i=0;i<e.x.length;i++)gradient.w1[j*e.x.length+i]+=delta*e.x[i];}
 }
 let norm=0;for(const key of keys)for(const g of gradient[key])norm+=(g/Math.max(1,examples.length))**2;
 const scale=Math.min(1,5/Math.max(1e-9,Math.sqrt(norm)))/Math.max(1,examples.length);opt.step++;
 const correction1=1-.9**opt.step,correction2=1-.999**opt.step;
 for(const key of keys)for(let i=0;i<w[key].length;i++){const g=gradient[key][i]*scale;opt.m[key][i]=.9*opt.m[key][i]+.1*g;opt.v[key][i]=.999*opt.v[key][i]+.001*g*g;w[key][i]-=rate*(opt.m[key][i]/correction1)/(Math.sqrt(opt.v[key][i]/correction2)+1e-8);}
 return total/Math.max(1,examples.length);
}
export function serialize(network:Network){return {encoder:network.encoder,shape:network.shape,weights:Object.fromEntries(keys.map(k=>[k,Array.from(network.weights[k])]))};}
export function deserialize(data:ReturnType<typeof serialize>):Network{
 if(data?.encoder!==ENCODER||data.shape?.input!==INPUTS||data.shape?.output!==ACTIONS||![data.shape.h1,data.shape.h2].every(n=>Number.isInteger(n)&&n>0&&n<=256))throw Error('incompatible_model');
 const network=createNetwork(()=>.5,data.shape.h1,data.shape.h2);
 for(const key of keys){const values=data.weights[key];if(!Array.isArray(values)||values.length!==network.weights[key].length||!values.every(Number.isFinite))throw Error('invalid_weights');network.weights[key].set(values);}
 return network;
}
