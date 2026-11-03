import {parentPort} from 'node:worker_threads';
import {decide} from '../../lib/research-policy.ts';
import {deserialize} from '../../lib/research-network.ts';
let model=null,modelId=null;
parentPort.on('message',({input,seed,network,id})=>{
 try{
  if(id!==modelId){model=network?deserialize(network):null;modelId=id;}
  const result=decide(input,seed,model);
  parentPort.postMessage({result:{...result,modelId}});
 }catch{parentPort.postMessage({error:'search_failed'});}
});
