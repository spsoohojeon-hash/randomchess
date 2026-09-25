import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createGame} from '../lib/game.ts';
import {policyInput,seeded,decide} from '../lib/research-policy.ts';
import {createNetwork,serialize,deserialize,optimizer,trainBatch,loss,predict,encodePosition,encodeAction,INPUTS,ACTIONS} from '../lib/research-network.ts';
import {openStore,rulesHash} from '../scripts/research/collector.mjs';
import {splitForGame,loadDataset,eligible,shouldPromote,train} from '../scripts/research/train.mjs';
import {TrainingRuntime} from '../scripts/research/training-runtime.mjs';
function position(){const g=createGame('nothing','burrow');g.board.fill(null);g.board[56]={id:'wk',color:'w',kind:'k',moved:false};g.board[7]={id:'bk',color:'b',kind:'k',moved:false};g.board[15]={id:'wr',color:'w',kind:'r',moved:false};return g;}
function example(){const input=policyInput(position(),'w'),action=input.actions.findIndex(a=>a.type==='move'&&a.to===7);return {input,e:{x:encodePosition(input),actions:input.actions.map(a=>encodeAction(a,'w')),target:action,value:1}};}

test('neural features cannot distinguish actual hidden cards, counters, deck or opponent history',()=>{
 const a=createGame('wildHorse','burrow'),b=createGame('wildHorse','gatling');b.abilities.b.ammo=8;b.deck.reverse();
 assert.deepEqual(encodePosition(policyInput(a,'w')),encodePosition(policyInput(b,'w')));assert.equal(encodePosition(policyInput(a,'w')).length,INPUTS);
 for(const action of policyInput(a,'w').actions)assert.equal(encodeAction(action,'w').length,ACTIONS);
});
test('backpropagation and Adam reduce policy and outcome loss; restored weights predict identically',()=>{
 const {input,e}=example(),network=createNetwork(seeded(123),16,8),opt=optimizer(network),before=loss(network,e);
 for(let i=0;i<60;i++)trainBatch(network,[e,e],opt,.005);
 const after=loss(network,e);assert(after.policy<before.policy*.5,JSON.stringify({before,after}));assert(after.value<before.value*.2);
 const restored=deserialize(JSON.parse(JSON.stringify(serialize(network))));assert.deepEqual(predict(network,input),predict(restored,input));
 const broken=serialize(network);broken.weights.w1[0]=null;assert.throws(()=>deserialize(broken),/invalid_weights/);
 assert.equal(decide(input,123,restored).action.to,7);
});
test('promotion uses validation gates, rejects non-finite losses and protects incumbent',()=>{
 assert(shouldPromote({total:.7,value:.1},{total:1,value:.2},null));
 assert(!shouldPromote({total:1,value:.1},{total:1,value:.2},null));
 assert(!shouldPromote({total:.7,value:.4},{total:1,value:.2},null));
 assert(!shouldPromote({total:.7,value:.1},{total:1,value:.2},{total:.6}));
 assert(!shouldPromote({total:NaN,value:0},{total:1,value:.2},null));
});
test('finished-only dataset, game-level splits, trained model checkpoints and private runtime loading',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'research-learning-')),db=openStore(dir);
 try{
  const groups={train:[],validation:[],test:[]};for(let i=0;Object.values(groups).some((a,j)=>a.length<(j===0?20:5));i++){const id='learning-game-'+i,group=splitForGame(id),cap=group==='train'?20:5;if(groups[group].length<cap)groups[group].push(id);}
  const {input,e}=example();
  const insertGame=db.prepare('INSERT INTO games(id,white_card,black_card,started,status,winner,rules) VALUES(?,?,?,?,?,?,?)');
  const insertRecord=db.prepare('INSERT INTO records(game_id,seq,payload,summary) VALUES(?,?,?,?)');
  for(const ids of Object.values(groups))for(const id of ids){insertGame.run(id,'nothing','burrow',1,'finished','w',rulesHash);for(let seq=1;seq<=16;seq++)insertRecord.run(id,seq,gzipSync(JSON.stringify({type:'action',side:'w',observation:input,action:input.actions[e.target]})),'{}');}
  for(const [id,status,version] of [['exclude-running','running',rulesHash],['exclude-blocked','blocked',rulesHash],['exclude-version','finished','other-version']]){insertGame.run(id,'nothing','burrow',1,status,'w',version);insertRecord.run(id,1,gzipSync(JSON.stringify({type:'action',side:'w',observation:input,action:input.actions[e.target]})),'{}');}
  const dataset=loadDataset(db);assert(eligible(dataset));assert.equal(dataset.completed,30);assert.deepEqual(dataset.games,{train:20,validation:5,test:5});assert.equal(dataset.groups.train.length,320);
  const previousEpochs=process.env.RESEARCH_TRAIN_EPOCHS;process.env.RESEARCH_TRAIN_EPOCHS='20';
  const status=await train(dir);assert.equal(status.state,'ready',JSON.stringify(status));assert(status.validationLoss<status.baselineLoss);assert(existsSync(join(dir,'training-checkpoint.json')));
  const model=JSON.parse(readFileSync(join(dir,'active-model.json'),'utf8'));assert(model.accepted);assert.equal(model.rules,rulesHash);assert(model.test.positions>0);
  const runtime=new TrainingRuntime(dir,{},rulesHash);runtime.refresh();assert.equal(runtime.active.id,model.id);assert.equal(runtime.choose(input,5).modelId,model.id);
  const old=runtime.active.id;writeFileSync(join(dir,'active-model.json'),JSON.stringify({...model,rules:'old-version'}));runtime.refresh();assert.equal(runtime.active,null);
  writeFileSync(join(dir,'active-model.json'),JSON.stringify(model));const again=await train(dir);assert.equal(again.state,'rejected');assert.equal(JSON.parse(readFileSync(join(dir,'active-model.json'),'utf8')).id,old);
  if(previousEpochs===undefined)delete process.env.RESEARCH_TRAIN_EPOCHS;else process.env.RESEARCH_TRAIN_EPOCHS=previousEpochs;
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('insufficient data never creates an untrained active model',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'research-empty-')),db=openStore(dir);db.close();
 try{const result=await train(dir);assert.equal(result.state,'waiting');assert.equal(existsSync(join(dir,'active-model.json')),false);}finally{rmSync(dir,{recursive:true,force:true});}
});
