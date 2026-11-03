import {Worker} from 'node:worker_threads';
// Only redacted PolicyInput crosses this boundary. No DB, tokens or referee game.
export class SearchPool{
 constructor(size,url=new URL('./search-worker.mjs',import.meta.url)){
  this.url=url;this.closed=false;this.slots=Array.from({length:size},()=>this.create());
 }
 create(){
  const slot={worker:new Worker(this.url),pending:null};
  slot.worker.on('message',message=>{const p=slot.pending;slot.pending=null;if(!p)return;message.error?p.reject(Error(message.error)):p.resolve(message.result);});
  slot.worker.on('error',()=>{slot.pending?.reject(Error('search_worker_failed'));slot.pending=null;});
  slot.worker.on('exit',()=>{slot.pending?.reject(Error('search_worker_exited'));slot.pending=null;slot.dead=true;});
  return slot;
 }
 get busy(){return this.slots.filter(s=>s.pending).length;}
 run(payload){
  if(this.closed)return Promise.reject(Error('pool_closed'));
  const i=this.slots.findIndex(s=>!s.pending);if(i<0)return Promise.reject(Error('pool_busy'));
  if(this.slots[i].dead)this.slots[i]=this.create();
  const slot=this.slots[i];return new Promise((resolve,reject)=>{slot.pending={resolve,reject};try{slot.worker.postMessage(payload);}catch(e){slot.pending=null;reject(e);}});
 }
 async stop(){this.closed=true;await Promise.all(this.slots.map(s=>s.worker.terminate()));}
}
