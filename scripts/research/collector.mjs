import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,chmodSync,existsSync,writeFileSync,unlinkSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomInt,randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {CARDS,createGame,applyAction} from '../../lib/game.ts';
import {actor} from '../../lib/practice-ai.ts';
import {TrainingRuntime} from './training-runtime.mjs';
import {policyInput,decide,POLICY_VERSION} from '../../lib/research-policy.ts';

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
 persist(db,lane,state,{schema:1,type:'start',gameId:state.id,seq:0,at:Date.now(),rules:rulesHash,policy:POLICY_VERSION,settings:{difficulty:'hard',information:'private',maxActions:null,repeatLimit:null},initialCards:{w:white,b:black},referee:game});
 return state;
}
// One transaction per action, no move/repetition cut-off. Memory usage does not
// grow with game length; records stream to SQLite and the private API.
export function step(db,lane,state,choose=decide){
 const side=actor(state.game),input=policyInput(state.game,side),seed=randomInt(0x100000000);
 const before=state.game,analysis=choose(input,seed);
 if(!analysis.action)throw Error('no_policy_action');
 const next=applyAction(before,side,analysis.action);
 const updated={...state,seq:state.seq+1,game:next,status:next.result?'finished':'running'};
 persist(db,lane,updated,{schema:1,type:'action',gameId:state.id,seq:updated.seq,at:Date.now(),rules:rulesHash,policy:POLICY_VERSION,side,policySeed:seed,observation:input,action:analysis.action,analysis:{...analysis,line:undefined},beliefApproximate:true,referee:next});
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
 const lanes=Math.max(1,Math.min(8,Number(config.lanes)||2));
 let stopping=false,enabled=false,lastHeartbeat=0,lane=0;
 process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
 const request=async(path,body)=>{
  const response=await fetch(endpoint+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw Error('remote_'+response.status);return response.json();
 };
 async function flush(){
  // Unacknowledged events survive process restarts. No public artifacts/logs.
  for(const row of db.prepare('SELECT * FROM records WHERE sent=0 ORDER BY rowid LIMIT 100').all()){
   await request('runner/event',{game:JSON.parse(row.summary),seq:row.seq,payload:Buffer.from(row.payload).toString('base64')});
   db.prepare('UPDATE records SET sent=1 WHERE game_id=? AND seq=?').run(row.game_id,row.seq);
  }
 }
 try{while(!stopping){
  try{
   if(Date.now()-lastHeartbeat>20000){const c=await request('runner/control',{runner:config.name??'research-collector',training:training.status()});enabled=!!c.enabled;lastHeartbeat=Date.now();training.manage(c,db);}
   await flush();
   if(!enabled){await delay(5000);continue;}
   if(db.prepare('SELECT COUNT(*) n FROM records WHERE sent=0').get().n)continue;
   const row=db.prepare('SELECT state FROM lanes WHERE lane=?').get(lane);
   let state=row?JSON.parse(row.state):null;
   if(!state||state.status!=='running')state=newGame(db,lane);
   else if(state.rules!==rulesHash)block(db,lane,state,'rules_version_changed');
   else {try{step(db,lane,state,(input,seed)=>training.choose(input,seed));}catch(e){
    // Stop and label an invalid policy game; never invent a move/result.
    if(e.message==='record_too_large')throw e;
    block(db,lane,state,'policy_or_rules_error: '+String(e.message??'unknown').slice(0,180));
   }}
   lane=(lane+1)%lanes;
  }catch{
   // Keep credentials, cards, outcomes and stack traces out of service logs.
   console.error('Collector paused: check private dashboard, credentials, network or storage.');
   enabled=false;lastHeartbeat=0;await delay(30000);
  }
 }
 await flush();
 }finally{training.stop();db.close();if(existsSync(lock)&&readFileSync(lock,'utf8')===identity)unlinkSync(lock);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Collector could not start. Run research:setup and check private storage permissions.');process.exitCode=1;});
export const unpack=payload=>JSON.parse(gunzipSync(payload).toString());
