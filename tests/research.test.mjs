import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {researchApi} from '../lib/research-service.ts';
import {createGame,applyAction,indexOf} from '../lib/game.ts';
import {policyInput,sampleWorlds,decide} from '../lib/research-policy.ts';
import {openStore,newGame,persist,step,block,unpack,rulesHash} from '../scripts/research/collector.mjs';
function database(){
 const sql=new DatabaseSync(':memory:');
 return {sql,prepare(query){let args=[];return {bind(...a){args=a;return this;},async first(){return sql.prepare(query).get(...args)??null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}};},query,args:()=>args};},async batch(items){sql.exec('BEGIN');try{const result=items.map(s=>{const q=sql.prepare(s.query);if(/RETURNING/.test(s.query))return {results:q.all(...s.args())};const r=q.run(...s.args());return {results:[],meta:{changes:Number(r.changes)}};});sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
const password='test-only-password-123456789',token='test-only-runner-token-12345678901234567890';
const environment=()=>({DB:database(),RESEARCH_PASSWORD:password,RESEARCH_RUNNER_TOKEN:token});
function request(path,{body,cookie,bearer,origin='https://chess.test'}={}){return new Request('https://chess.test/api/research/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:origin}),...(cookie?{Cookie:cookie}:{}),...(bearer?{Authorization:'Bearer '+bearer}:{}),'CF-Connecting-IP':'192.0.2.1'},body:body===undefined?undefined:JSON.stringify(body)});}
async function call(e,p,o){return researchApi(e,request(p,o),p.split('?')[0]);}
async function login(e){const r=await call(e,'login',{body:{password}});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
function event(id='test-game-0001',seq=0){return {seq,payload:gzipSync(JSON.stringify({private:true})).toString('base64'),game:{id,white:'burrow',black:'gatling',started:1000,status:'running',winner:null,rules:'test-rules',board:Array(64).fill(null),ply:seq,approximate:true}};}

test('research fails closed before secrets and never exposes data to anonymous users or runner tokens',async()=>{
 const e=environment();assert.equal((await call({...e,RESEARCH_PASSWORD:undefined},'stats')).status,503);
 for(const path of ['stats','games','events?id=test-game-0001','session']){
  assert.equal((await call(e,path)).status,401);assert.equal((await call(e,path,{bearer:token})).status,401);
 }
 assert.equal((await call(e,'runner/control',{body:{},bearer:'wrong'})).status,401);e.DB.sql.close();
});
test('login uses secure expiring cookies; forged session, changed password and cross-site writes are rejected',async()=>{
 const e=environment();const r=await call(e,'login',{body:{password}}),header=r.headers.get('set-cookie');
 for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert(header.includes(flag));
 const cookie=header.split(';')[0];assert.equal((await call(e,'stats',{cookie})).status,200);
 assert.equal((await call(e,'stats',{cookie:cookie+'x'})).status,401);
 assert.equal((await call({...e,RESEARCH_PASSWORD:password+'changed'},'stats',{cookie})).status,401);
 assert.equal((await call(e,'control',{cookie,body:{enabled:true},origin:'https://evil.test'})).status,403);
 const status=await call(e,'stats',{cookie});assert.match(status.headers.get('Cache-Control'),/no-store/);
 const logout=await call(e,'logout',{cookie,body:{}});assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);e.DB.sql.close();
});
test('password guessing is rate limited',async()=>{
 const e=environment();for(let i=0;i<10;i++)assert.equal((await call(e,'login',{body:{password:'wrong'}})).status,401);
 assert.equal((await call(e,'login',{body:{password}})).status,429);e.DB.sql.close();
});
test('owner-selected short passwords authenticate exactly while missing or too-short secrets fail closed',async()=>{
 const e=environment();e.RESEARCH_PASSWORD='demo12~ab';
 assert.equal((await call(e,'login',{body:{password:'demo12~ab'}})).status,200);
 assert.equal((await call(e,'login',{body:{password:'demo12~ab '}})).status,401);
 assert.equal((await call({...e,RESEARCH_PASSWORD:'1234567'},'stats')).status,503);
 assert.equal((await call({...e,RESEARCH_RUNNER_TOKEN:'short'},'stats')).status,503);
 e.DB.sql.close();
});
test('runner uploads are durable, ordered, idempotent and inaccessible with owner cookie',async()=>{
 const e=environment(),cookie=await login(e);
 assert.equal((await call(e,'runner/event',{cookie,body:event()})).status,401);
 assert.equal((await call(e,'runner/event',{bearer:token,body:event()})).status,200);
 assert.equal((await call(e,'runner/event',{bearer:token,body:event()})).status,200);
 assert.equal((await call(e,'runner/event',{bearer:token,body:event('test-game-0001',2)})).status,409);
 const next=event('test-game-0001',1);next.game.status='finished';next.game.winner='b';
 assert.equal((await call(e,'runner/event',{bearer:token,body:next})).status,200);
 assert.equal(e.DB.sql.prepare('SELECT COUNT(*) n FROM research_events').get().n,2);
 const stats=await (await call(e,'stats',{cookie})).json();assert.equal(stats.totals.finished,1);assert.equal(stats.ranking.find(r=>r.card==='gatling').wins,1);
 const records=await (await call(e,'events?id=test-game-0001&after=0',{cookie})).json();assert.equal(records.events.length,1);assert.equal(records.events[0].seq,1);
 assert.equal((await (await call(e,'runner/control',{bearer:token,body:{}})).json()).enabled,0);
 await call(e,'control',{cookie,body:{enabled:true}});assert.equal((await (await call(e,'runner/control',{bearer:token,body:{}})).json()).enabled,1);e.DB.sql.close();
});
test('policy boundary cannot distinguish unrevealed opponent identities, counters, deck or RPS picks',()=>{
 const a=createGame('wildHorse','burrow'),b=createGame('wildHorse','gatling');b.abilities.b.ammo=8;b.abilities.b.threats=4;b.deck.reverse();
 assert.deepEqual(policyInput(a,'w'),policyInput(b,'w'));assert.deepEqual(sampleWorlds(policyInput(a,'w'),123),sampleWorlds(policyInput(b,'w'),123));
 const d=applyAction(createGame('quickDuel','necro'),'w',{type:'ability'});
 const x=applyAction(d,'w',{type:'duel',gesture:'rock'}),y=applyAction(d,'w',{type:'duel',gesture:'scissors'});
 assert.deepEqual(policyInput(x,'b'),policyInput(y,'b'));
 const world=sampleWorlds(policyInput(a,'w'),1)[0];assert.equal(world.abilities.w.id,'wildHorse');assert.notEqual(world.deck,a.deck);
});
test('historical observation snapshots also hide opponent secret state',()=>{
 const a=applyAction(createGame('nothing','burrow'),'w',{type:'move',from:indexOf('e2'),to:indexOf('e4')});
 const b=structuredClone(a);b.abilities.b.id='gatling';b.undo[0].before.abilities.b.id='gatling';b.undo[0].before.abilities.b.ammo=8;
 assert.deepEqual(policyInput(a,'w'),policyInput(b,'w'));
 assert.equal(policyInput(a,'w').view.undo[0].before.abilities.b.id,'hidden');
});
test('hard private search can activate its own ability and chooses only actual available actions',()=>{
 const g=createGame('wildHorse','nothing'),input=policyInput(g,'w');const result=decide(input,1234);
 assert(result.action);assert(input.actions.some(a=>JSON.stringify(a)===JSON.stringify(result.action)));assert.doesNotThrow(()=>applyAction(g,'w',result.action));assert.equal(result.incomplete,true);
});
test('collector checkpoints and raw events replay, finished-only export never includes referee truth',()=>{
 const dir=mkdtempSync(join(tmpdir(),'research-test-'));let db=openStore(dir);
 try{
  const g=createGame('nothing','burrow');g.board.fill(null);g.board[56]={id:'wk',color:'w',kind:'k',moved:false};g.board[7]={id:'bk',color:'b',kind:'k',moved:false};g.board[15]={id:'wr',color:'w',kind:'r',moved:false};
  let state={id:'test-complete',white:'nothing',black:'burrow',started:Date.now(),seq:0,status:'running',game:g,rules:rulesHash};
  persist(db,0,state,{type:'start',referee:g});
  const choose=()=>({action:{type:'move',from:15,to:7},score:10000,incomplete:true});
  state=step(db,0,state,choose);assert.equal(state.status,'finished');
  const raw=unpack(db.prepare('SELECT payload FROM records WHERE game_id=? AND seq=1').get(state.id).payload);
  assert.deepEqual(raw.referee,JSON.parse(JSON.stringify(applyAction(g,'w',raw.action))));assert.equal(raw.observation.view.abilities.b.id,'hidden');
  newGame(db,1);db.close();db=openStore(dir);assert.equal(JSON.parse(db.prepare('SELECT state FROM lanes WHERE lane=0').get().state).game.result.winner,'w');
  const result=spawnSync(process.execPath,['scripts/research/export.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,RESEARCH_HOME:dir},encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const lines=readFileSync(join(dir,'training.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.equal(lines.length,1);assert.equal(lines[0].value,1);assert(!('referee' in lines[0]));assert.equal(lines[0].features.view.abilities.b.id,'hidden');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('large action counts do not force termination and blocked games are distinct from losses',()=>{
 const dir=mkdtempSync(join(tmpdir(),'research-test-')),db=openStore(dir);
 try{let state=newGame(db,0);state.game=createGame('nothing','burrow');state.seq=50000;
  state=step(db,0,state,()=>({action:{type:'move',from:indexOf('e2'),to:indexOf('e4')},score:0,incomplete:true}));assert.equal(state.seq,50001);assert.equal(state.status,'running');
  state=block(db,0,state,'test_policy_error');assert.equal(state.status,'blocked');assert.equal(state.game.result,null);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});


test('training controls are owner-only and runner reports expose no arbitrary payload fields',async()=>{
 const e=environment(),cookie=await login(e);
 assert.equal((await call(e,'training/control',{body:{trainNow:true}})).status,401);
 assert.equal((await call(e,'training/control',{bearer:token,body:{trainNow:true}})).status,401);
 assert.equal((await call(e,'training/control',{cookie,body:{trainNow:true}})).status,200);
 await call(e,'training/control',{cookie,body:{enabled:false}});
 const control=await (await call(e,'runner/control',{bearer:token,body:{training:{state:'training',epoch:2,validationLoss:'bad',weights:[1,2],secret:'ignored'}}})).json();
 assert.equal(control.training_request,1);assert.equal(control.training_enabled,0);
 const stats=await (await call(e,'stats',{cookie})).json();assert.equal(stats.training.status.epoch,2);assert.equal(stats.training.status.validationLoss,undefined);assert.equal(stats.training.status.weights,undefined);assert.equal(stats.training.status.secret,undefined);e.DB.sql.close();
});
