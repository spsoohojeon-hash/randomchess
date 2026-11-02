import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function runPython(python,args){
 return new Promise((resolve,reject)=>{
  const child=spawn(python,[fileURLToPath(new URL('./gpu-train.py',import.meta.url)),...args],{stdio:'ignore',windowsHide:true});
  const stop=()=>child.kill();process.once('SIGTERM',stop);process.once('SIGINT',stop);
  const cleanup=()=>{process.off('SIGTERM',stop);process.off('SIGINT',stop);};
  child.once('error',()=>{cleanup();reject(Error('gpu_unavailable'));});
  child.once('exit',code=>{cleanup();code===0?resolve():reject(Error('gpu_training_failed'));});
 });
}
export const sparse=values=>Array.from(values,(v,i)=>[i,v]).filter(([,v])=>v!==0);
