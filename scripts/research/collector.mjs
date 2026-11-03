import {snapshot} from './snapshot.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,chmodSync,existsSync,writeFileSync,unlinkSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomInt,randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {CARDS,createGame,applyAction} from '../../lib/game.ts';
import {actor} from '../../lib/practice-ai.ts';
import {SearchPool} from './search-pool.mjs';
import {serialize} from '../../lib/research-network.ts';
import {TrainingRuntime} from './training-runtime.mjs';
import {policyInput,decide,POLICY_VERSION} from '../../lib/research-policy.ts';

export const MAX_RESEARCH_ACTIONS=600;
export const defaultHome=join(homedir(),'.randomchess-research');
export const rulesHash=createHash('sha256').update(['../../lib/game.ts','../../lib/practice-ai.ts','../../lib/research-policy.ts','../../lib/research-network.ts'].map(p=>readFileSync(new URL(p,import.meta.url))).join('\n')).digest('hex');
export function openStore(directory){
 mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
 const file=join(directory,'research.sqlite');const db=new DatabaseSync(file);chmodSync(file,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS lanes(lane INTEGER PRIMARY KEY, game_id TEXT NOT NULL, state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY, white_card TEXT, black_card TEXT, started INTEGER, status TEXT, winner TEXT, rules TEXT);
 CREATE TABLE IF NOT EXISTS records(game_id TEXT, seq INTEGER, payload BLOB NOT NULL, summary TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(game_id,seq));
 CREATE INDEX IF NOT EXISTS records_pending ON records(sent,game_id,seq);`);
 return db;
}
function summary(state){return {id:state.id,white:state.white,black:state.black,started:state.started,status:state.status,winner:state.game.result?.winner??null,reason:state.reason??state.game.result?.reason??'',rules:state.rules,board:state.game.board.map(p=>p?{color:p.color,kind:p.kind}:null),ply:state.game.ply,approximate:true};}
export function persist(db,lane,state,record){
 const packed=gzipSync(JSON.stringify(record)),meta=summary(state);
 if(packed.length>220000)throw Error('record_too_large');
 db.exec('BEGIN IMMEDIATE');try{
  db.prepare('INSERT INTO records(game_id,seq,payload,summary) VALUES(?,?,?,?)').run(state.id,state.seq,packed,JSON.stringify(meta));
  db.prepare('INSERT INTO games(id,white_card,black_card,started,status,winner,rules) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,winner=excluded.winner').run(state.id,state.white,state.black,state.started,state.status,meta.winner,state.rules);
  db.prepare('INSERT INTO lanes(lane,game_id,state) VALUES(?,?,?) ON CONFLICT(lane) DO UPDATE SET game_id=excluded.game_id,state=excluded.state').run(lane,state.id,JSON.stringify(state));
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function newGame(db,lane){
 const pool=CARDS.map(c=>c.id),i=randomInt(pool.length),white=pool.splice(i,1)[0],black=pool[randomInt(pool.length)];
 const game=createGame(white,black,'all',true);
 const state={id:randomUUID(),white,black,started:Date.now(),seq:0,status:game.result?'finished':'running',game,rules:rulesHash,policy:POLICY_VERSION};
 persist(db,lane,state,{schema:1,type:'start',gameId:state.id,seq:0,at:Date.now(),rules:rulesHash,policy:POLICY_VERSION,settings:{difficulty:'hard',information:'private',maxActions:MAX_RESEARCH_ACTIONS,repeatLimit:null,adjudication:"action-limit-v1"},initialCards:{w:white,b:black},referee:game});
 return state;
}
// Research-only termination; ordinary matches retain their original rules.
function limitedDraw(game){
 const next=structuredClone(game);next.phase="over";next.result={winner:"draw",reason:"자동대국 600행동 제한 무승부"};next.pending=null;next.duel=null;next.drawOffer=null;delete next.extraMove;return next;
}
export function finishLimitedDraw(db,lane,state){
 if(state.game.result||state.seq<MAX_RESEARCH_ACTIONS)return state;
 const updated={...state,seq:state.seq+1,game:limitedDraw(state.game),status:"finished"};
 persist(db,lane,updated,{schema:1,type:"adjudication",gameId:state.id,seq:updated.seq,at:Date.now(),reason:"action-limit-v1",referee:updated.game});return updated;
}
export function step(db,lane,state,choose=decide,decisionSeed){
 if(state.seq>=MAX_RESEARCH_ACTIONS)return finishLimitedDraw(db,lane,state);
 const side=actor(state.game),input=policyInput(state.game,side),seed=decisionSeed??randomInt(0x100000000);
 const before=state.game,analysis=choose(input,seed);
 if(!analysis.action)throw Error('no_policy_action');
 let next=applyAction(before,side,analysis.action);
 const adjudicated=!next.result&&state.seq+1>=MAX_RESEARCH_ACTIONS;
 if(adjudicated)next=limitedDraw(next);
 const updated={...state,seq:state.seq+1,game:next,status:next.result?'finished':'running'};
 persist(db,lane,updated,{schema:1,type:'action',gameId:state.id,seq:updated.seq,at:Date.now(),rules:rulesHash,policy:POLICY_VERSION,adjudication:adjudicated?'action-limit-v1':undefined,side,policySeed:seed,observation:input,action:analysis.action,analysis:{...analysis,line:undefined},beliefApproximate:true,referee:next});
 return updated;
}
export function block(db,lane,state,code){
 const updated={...state,seq:state.seq+1,status:'blocked',reason:code};
 persist(db,lane,updated,{schema:1,type:'blocked',gameId:state.id,seq:updated.seq,at:Date.now(),reason:code,referee:state.game});return updated;
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function main(){
 process.umask(0o077);
 const home=process.env.RESEARCH_HOME??defaultHome;
 const configPath=process.env.RESEARCH_CONFIG??join(home,'config.json');
 if(!existsSync(configPath))throw Error('configuration_required');
 const config=JSON.parse(readFileSync(configPath,'utf8'));
 if(!/^https:\/\//.test(config.url)||typeof config.token!=='string'||config.token.length<32)throw Error('invalid_configuration');
 const endpoint=new URL('/api/research/',config.url).href,db=openStore(home);
 const lock=join(home,'collector.lock'),identity=JSON.stringify({pid:process.pid,id:randomUUID()});
 if(existsSync(lock)){
  const previous=readFileSync(lock,'utf8');let running=true;
  try{process.kill(JSON.parse(previous).pid,0);}catch(e){if(e.code==='ESRCH')running=false;}
  if(running){db.close();throw Error('collector_already_running');}
  if(readFileSync(lock,'utf8')===previous)unlinkSync(lock);
 }
 try{writeFileSync(lock,identity,{flag:'wx',mode:0o600});}catch(e){db.close();throw e;}
 const training=new TrainingRuntime(home,config,rulesHash);
 const lanes=Math.max(1,Math.min(8,Math.floor(Number(config.lanes)||4)));
 const pool=new SearchPool(lanes),pending=new Set();
 let modelId=null,network=null;
 let stopping=false,enabled=false,lastHeartbeat=0,lane=0,syncPromise=null;
 process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
 const request=async(path,body)=>{
  const response=await fetch(endpoint+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw Error('remote_'+response.status);return response.json();
 };
 async function synchronize(){
  try{
   const data=snapshot(db,{...training.status(),workers:lanes,busyWorkers:pool.busy});
   const c=await request('runner/snapshot',data);
   if(stopping)return;
   enabled=!!c.enabled;training.manage(c,db);
  }catch{console.error('Summary sync unavailable. Local games continue; dashboard may be stale.');}
 }
 try{while(!stopping){
  try{
   if(!syncPromise&&Date.now()-lastHeartbeat>=60000){lastHeartbeat=Date.now();syncPromise=synchronize().finally(()=>{syncPromise=null;});}
   if(!enabled){await delay(1000);continue;}
   let found=false;for(let i=0;i<lanes;i++){lane=(lane+1)%lanes;if(!pending.has(lane)){found=true;break;}}
   if(!found){await delay(50);continue;}
   const row=db.prepare('SELECT state FROM lanes WHERE lane=?').get(lane);
   let state=row?JSON.parse(row.state):null;
   if(!state||state.status!=='running')state=newGame(db,lane);
   else if(state.seq>=MAX_RESEARCH_ACTIONS)finishLimitedDraw(db,lane,state);
   else if(state.rules!==rulesHash)block(db,lane,state,'rules_version_changed');
   else {
    const slot=lane,current=state,side=actor(current.game);
    const input=policyInput(current.game,side),seed=randomInt(0x100000000);
    if(modelId!==(training.active?.id??null)){modelId=training.active?.id??null;network=training.active?serialize(training.active.network):null;}
    pending.add(slot);
    pool.run({input,seed,network,id:modelId}).then(analysis=>{
     if(stopping)return;
     // The main thread alone validates and commits one decision per lane.
     step(db,slot,current,()=>analysis,seed);
    }).catch(()=>{
     if(stopping)return;
     try{block(db,slot,current,'parallel_search_or_commit_failed');}catch{enabled=false;}
    }).finally(()=>pending.delete(slot));
   }
   lane=(lane+1)%lanes;
  }catch{
   // Keep credentials, cards, outcomes and stack traces out of service logs.
   console.error('Collector paused: check private dashboard, credentials, network or storage.');
   enabled=false;lastHeartbeat=0;await delay(30000);
  }
 }
 if(syncPromise)await syncPromise;
 }finally{stopping=true;if(syncPromise)await syncPromise;await pool.stop();training.stop();db.close();if(existsSync(lock)&&readFileSync(lock,'utf8')===identity)unlinkSync(lock);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Collector could not start. Run research:setup and check private storage permissions.');process.exitCode=1;});
export const unpack=payload=>JSON.parse(gunzipSync(payload).toString());

