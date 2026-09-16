import {analyze} from '../lib/practice-ai.ts';
import type {AnalysisRequest} from '../lib/practice-ai.ts';
self.onmessage=(event:MessageEvent<AnalysisRequest>)=>{
 try{self.postMessage({ok:true,result:analyze(event.data)});}catch{self.postMessage({ok:false,id:event.data.id});}
};
