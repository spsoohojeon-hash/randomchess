import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {defaultHome,rulesHash,unpack} from './collector.mjs';
import {seeded} from '../../lib/research-policy.ts';
import {createNetwork,serialize,deserialize,optimizer,trainBatch,loss,encodePosition,encodeAction} from '../../lib/research-network.ts';
export const splitForGame=id=>{const n=parseInt(createHash('sha256').update(id).digest('hex').slice(0,8),16)%100;return n<80?'train':n<90?'validation':'test';};
export function atomic(path,value){const temp=path+'.tmp-'+process.pid;writeFileSync(temp,JSON.stringify(value),{mode:0o600});renameSync(temp,path);}
const read=(path)=>{try{return JSON.parse(readFileSync(path,'utf8'));}catch{return null;}};
const inflate=packed=>JSON.parse(gunzipSync(packed).toString());
export function example(row){const input=row.observation,index=input.actions.findIndex(a=>JSON.stringify(a)===JSON.stringify(row.action));if(index<0||!input.actions.length)throw Error('invalid_training_action');return {x:encodePosition(input),actions:input.actions.map(a=>encodeAction(a,input.viewer)),target:index,value:row.value};}
export function loadDataset(db,limit=12000){
 const random=seeded(71433),groups={train:[],validation:[],test:[]},seen={train:0,validation:0,test:0},ids={train:new Set(),validation:new Set(),test:new Set()},caps={train:Math.floor(limit*.8),validation:Math.floor(limit*.1),test:Math.floor(limit*.1)};
 let completed=0;db.exec('BEGIN');
 try{
  completed=db.prepare("SELECT COUNT(*) n FROM games WHERE status='finished' AND rules=?").get(rulesHash).n;
  for(const row of db.prepare("SELECT r.payload,g.winner,g.id FROM records r JOIN games g ON g.id=r.game_id WHERE g.status='finished' AND g.rules=? ORDER BY r.rowid").iterate(rulesHash)){
   const event=unpack(row.payload);if(event.type!=='action'||!event.observation?.actions?.length)continue;
   const group=splitForGame(row.id);ids[group].add(row.id);const n=++seen[group],index=n<=caps[group]?n-1:Math.floor(random()*n);
   if(index>=caps[group])continue;
   const observation=structuredClone(event.observation);observation.view.undo=[];observation.view.log=[];delete observation.view.onlineView;
   const sample={gameId:row.id,observation,action:event.action,value:row.winner==='draw'?0:row.winner===event.side?1:-1};
   groups[group][index]=gzipSync(JSON.stringify(sample));
  }
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 const games=Object.fromEntries(Object.entries(groups).map(([key,values])=>[key,new Set(values.map(v=>inflate(v).gameId)).size]));
 const fingerprint=createHash('sha256').update(rulesHash);for(const key of ['train','validation','test'])for(const packed of groups[key])fingerprint.update(packed);
 return {groups,games,seen,completed,fingerprint:fingerprint.digest('hex')};
}
export function metrics(network,rows,mean=0){let policy=0,value=0,correct=0;for(const packed of rows){const row=inflate(packed),e=example(row);if(network){const m=loss(network,e);policy+=m.policy;value+=m.value;correct+=m.correct;}else{policy+=Math.log(e.actions.length);value+=(mean-e.value)**2;}}const n=Math.max(1,rows.length);return {policy:policy/n,value:value/n,total:(policy+.5*value)/n,accuracy:correct/n,positions:rows.length};}
export function eligible(dataset){return dataset.games.train>=20&&dataset.games.validation>=5&&dataset.games.test>=5&&dataset.groups.train.length>=256;}
export function shouldPromote(candidate,baseline,incumbent){return Number.isFinite(candidate.total)&&candidate.total<baseline.total*.99&&candidate.value<=baseline.value+.03&&(!incumbent||candidate.total<incumbent.total*.995);}
export async function train(home=process.env.RESEARCH_HOME??defaultHome){
 process.umask(0o077);mkdirSync(home,{recursive:true,mode:0o700});mkdirSync(join(home,'models'),{recursive:true,mode:0o700});
 const lock=join(home,'training.lock'),identity=JSON.stringify({pid:process.pid,id:randomUUID()});
 if(existsSync(lock)){const previous=readFileSync(lock,'utf8');let running=true;try{process.kill(JSON.parse(previous).pid,0);}catch(e){if(e.code==='ESRCH')running=false;}if(running)throw Error('training_already_running');if(readFileSync(lock,'utf8')===previous)unlinkSync(lock);}
 writeFileSync(lock,identity,{flag:'wx',mode:0o600});
 const statusPath=join(home,'training-status.json'),checkpointPath=join(home,'training-checkpoint.json'),activePath=join(home,'active-model.json');
 const epochs=Math.max(1,Math.min(30,Number(process.env.RESEARCH_TRAIN_EPOCHS)||5)),limit=Math.max(1000,Math.min(50000,Number(process.env.RESEARCH_TRAIN_EXAMPLES)||12000));
 let status={state:'loading',updated:Date.now(),rules:rulesHash,epochs,epoch:0};
 const report=extra=>{status={...status,...extra,updated:Date.now()};atomic(statusPath,status);};
 let db;
 try{
  report({});
  db=new DatabaseSync(join(home,'research.sqlite'),{readOnly:true});
  const dataset=loadDataset(db,limit);db.close();db=null;
  report({completedGames:dataset.completed,trainGames:dataset.games.train,validationGames:dataset.games.validation,testGames:dataset.games.test,examples:dataset.groups.train.length,minimumTrainGames:20,minimumValidationGames:5,minimumTestGames:5,minimumExamples:256});
  if(!eligible(dataset)){report({state:'waiting',reason:'not_enough_completed_games'});return status;}
  const active=read(activePath),incumbent=active?.rules===rulesHash?deserialize(active.network):null;
  const saved=read(checkpointPath),resume=saved?.fingerprint===dataset.fingerprint&&saved?.epochs===epochs&&saved?.rules===rulesHash;
  let network=resume?deserialize(saved.network):incumbent?deserialize(serialize(incumbent)):createNetwork(seeded(8281));
  const opt=optimizer(network);
  if(resume&&saved.optimizer){opt.step=saved.optimizer.step;for(const type of ['m','v'])for(const key of Object.keys(opt[type])){const values=saved.optimizer[type][key];if(values.length!==opt[type][key].length||!values.every(Number.isFinite))throw Error('invalid_optimizer');opt[type][key].set(values);}}
  const mean=dataset.groups.train.reduce((n,p)=>n+inflate(p).value,0)/dataset.groups.train.length;
  const baseline=metrics(null,dataset.groups.validation,mean),incumbentMetrics=incumbent?metrics(incumbent,dataset.groups.validation):null;
  let best=resume?saved.best:serialize(network),bestMetrics=resume?saved.bestMetrics:{total:Infinity,policy:Infinity,value:Infinity,accuracy:0,positions:0};
  const id=resume?saved.id:randomUUID(),random=seeded(3141);
  for(let epoch=resume?saved.epoch:0;epoch<epochs;epoch++){
   report({state:'training',epoch:epoch+1,baselineLoss:baseline.total,activeModel:active?.rules===rulesHash?active.id:null});
   const order=dataset.groups.train.map((_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
   let trainLoss=0,batches=0;
   for(let i=0;i<order.length;i+=32){const batch=order.slice(i,i+32).map(j=>example(inflate(dataset.groups.train[j])));trainLoss+=trainBatch(network,batch,opt);batches++;if(batches%25===0)report({processed:Math.min(i+32,order.length),trainLoss:trainLoss/batches});}
   report({state:'validating',trainLoss:trainLoss/batches});const validation=metrics(network,dataset.groups.validation);
   if(validation.total<bestMetrics.total){best=serialize(network);bestMetrics=validation;}
   const encodedOptimizer={step:opt.step,m:Object.fromEntries(Object.entries(opt.m).map(([k,v])=>[k,Array.from(v)])),v:Object.fromEntries(Object.entries(opt.v).map(([k,v])=>[k,Array.from(v)]))};
   atomic(checkpointPath,{rules:rulesHash,fingerprint:dataset.fingerprint,id,epochs,epoch:epoch+1,network:serialize(network),optimizer:encodedOptimizer,best,bestMetrics});
   report({validationLoss:validation.total,validationValueLoss:validation.value});
  }
  // Test results are reported AFTER model selection and never decide promotion.
  const chosen=deserialize(best),testMetrics=metrics(chosen,dataset.groups.test),accepted=shouldPromote(bestMetrics,baseline,incumbentMetrics);
  const model={schema:1,id,rules:rulesHash,created:Date.now(),dataset:dataset.fingerprint,network:best,validation:bestMetrics,test:testMetrics,baseline,incumbent:incumbentMetrics,accepted};
  atomic(join(home,'models',id+'.json'),model);if(accepted)atomic(activePath,model);
  report({state:accepted?'ready':'rejected',modelId:id,activeModel:accepted?id:active?.rules===rulesHash?active.id:null,validationLoss:bestMetrics.total,baselineLoss:baseline.total,testLoss:testMetrics.total,testValueLoss:testMetrics.value,accepted});return status;
 }catch{report({state:'failed',reason:'training_failed_check_private_storage'});throw Error('training_failed');}finally{db?.close();if(existsSync(lock)&&readFileSync(lock,'utf8')===identity)unlinkSync(lock);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))train().then(()=>console.log('Private training job finished. See the protected research dashboard.')).catch(()=>{console.error('Private training failed. Check private storage and configuration.');process.exitCode=1;});
