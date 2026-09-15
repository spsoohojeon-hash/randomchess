import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {roomApi} from '../lib/room-service.ts';
import {createGame,indexOf as sq} from '../lib/game.ts';

function database(){const sql=new DatabaseSync(':memory:');for(const name of readdirSync(new URL('../drizzle',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));return {sql,prepare(query){let args=[];return {bind(...v){args=v;return this;},async first(){return sql.prepare(query).get(...args)||null;},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}};}};}};}
const request=(path,token,payload)=>new Request('https://chess.test'+path,{method:payload?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(payload?{'Content-Type':'application/json',Origin:'https://chess.test'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
async function call(db,code,token,payload){const res=await roomApi(db,request(code?'/api/rooms/'+code:'/api/rooms',token,payload),code);return {status:res.status,...await res.json()};}
async function started(db){const w=await call(db,null,null,{pool:'classic'});const b=await call(db,w.code,null,{type:'join'});return {w,b};}
test('room creation, parallel join, third-player rejection, authenticated reconnect',async()=>{
 const db=database();const w=await call(db,null,null,{pool:'classic'});assert.equal(w.status,201);assert.equal(w.waiting,true);assert.equal(w.side,'w');assert.equal(w.code.length,6);
 const joins=await Promise.all([call(db,w.code,null,{type:'join'}),call(db,w.code,null,{type:'join'})]);assert.deepEqual(joins.map(j=>j.status).sort(),[200,409]);const b=joins.find(j=>j.status===200);assert.equal(b.side,'b');
 const resumed=await call(db,w.code,w.token);assert.equal(resumed.waiting,false);assert.equal(resumed.side,'w');assert.equal(resumed.version,1);
 assert.equal((await call(db,w.code,null)).status,401);assert.equal((await call(db,w.code,'x'.repeat(64))).status,403);
 assert.equal((await call(db,w.code,null,{type:'join'})).status,409);db.sql.close();
});
test('server owns turn and move validation, stale version rejected, replay idempotent',async()=>{
 const db=database();const {w,b}=await started(db);
 const move={type:'action',action:{type:'move',from:sq('e2'),to:sq('e4')},version:1,requestId:'firstmove0001'};
 assert.equal((await call(db,w.code,b.token,move)).status,400);
 const first=await call(db,w.code,w.token,move);assert.equal(first.status,200);assert.equal(first.version,2);assert.equal(first.game.turn,'b');
 const replay=await call(db,w.code,w.token,move);assert.equal(replay.status,200);assert.equal(replay.version,2);
 const stale=await call(db,w.code,b.token,{...move,requestId:'othermove001'});assert.equal(stale.status,409);assert.equal(stale.version,2);
 const invalid=await call(db,w.code,b.token,{...move,version:2,requestId:'badmove00001',action:{type:'move',from:sq('e7'),to:sq('e4')}});assert.equal(invalid.status,400);
 const next=await call(db,w.code,b.token,{...move,version:2,requestId:'blackmove001',action:{type:'move',from:sq('e7'),to:sq('e5')}});assert.equal(next.game.board[sq('e5')].color,'b');assert.equal(next.game.undo[0].before,null);db.sql.close();
});
test('simultaneous white moves produce one winner and one conflict',async()=>{
 const db=database();const {w}=await started(db);
 const responses=await Promise.all(['e','d'].map(f=>call(db,w.code,w.token,{type:'action',version:1,requestId:'parallelmove'+f,action:{type:'move',from:sq(f+'2'),to:sq(f+'4')}})));
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);const final=await call(db,w.code,w.token);assert.equal(final.game.ply,1);assert.equal(final.version,2);db.sql.close();
});
test('two users see the same state, duel selection remains hidden, rematch requires both',async()=>{
 const db=database();const {w,b}=await started(db);const g=createGame('quickDuel','necro');db.sql.prepare('UPDATE chess_rooms SET game = ? WHERE code = ?').run(JSON.stringify(g),w.code);
 const action=async(token,version,move,id)=>call(db,w.code,token,{type:'action',action:move,version,requestId:id});
 let r=await action(w.token,1,{type:'ability'},'activateDuel');r=await action(w.token,r.version,{type:'duel',gesture:'rock'},'whiteChoice1');
 const opposite=await call(db,w.code,b.token);assert.equal(opposite.game.duel.picks.w,null);assert.equal(opposite.game.duel.picked.w,true);
 r=await action(b.token,r.version,{type:'resign'},'blackResign');assert.equal(r.game.result.winner,'w');
 const ask=await call(db,w.code,w.token,{type:'rematch',version:r.version,requestId:'rematchWhite'});assert.equal(ask.game.phase,'over');assert.deepEqual(ask.rematch,['w']);
 const accept=await call(db,w.code,b.token,{type:'rematch',version:ask.version,requestId:'rematchBlack'});assert.equal(accept.game.phase,'play');assert.equal(accept.game.ply,0);assert.equal(accept.game.board.filter(Boolean).length,32);
 const same=await call(db,w.code,w.token);assert.deepEqual(same.game.board,accept.game.board);assert.equal(same.game.abilities.b.id,"hidden");assert.equal(accept.game.abilities.w.id,"hidden");db.sql.close();
});
test('expired rooms and cross-origin mutation fail without changing state',async()=>{
 const db=database();const {w}=await started(db);
 const cross=new Request('https://chess.test/api/rooms/'+w.code,{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify({type:'join'})});assert.equal((await roomApi(db,cross,w.code)).status,403);
 db.sql.prepare('UPDATE chess_rooms SET expires_at = 0 WHERE code = ?').run(w.code);assert.equal((await call(db,w.code,w.token)).status,410);db.sql.close();
});
test('online responses keep opponent cards secret across create, join, reconnect, conflict, action and replay',async()=>{
 const db=database();const {w,b}=await started(db);
 assert.equal(w.game.abilities.b.id,'hidden');assert.equal(b.game.abilities.w.id,'hidden');
 const g=createGame('wildHorse','kingReturn');db.sql.prepare('UPDATE chess_rooms SET game = ? WHERE code = ?').run(JSON.stringify(g),w.code);
 const check=(r,side)=>{assert.equal(r.game.abilities[side==='w'?'b':'w'].id,'hidden');assert.equal(r.game.abilities[side].id,side==='w'?'wildHorse':'kingReturn');assert(r.game.undo.every(h=>h.before===null));};
 check(await call(db,w.code,w.token),'w');check(await call(db,w.code,b.token),'b');
 const payload={type:'action',action:{type:'ability'},version:1,requestId:'privateAbility'};
 check(await call(db,w.code,w.token,payload),'w');check(await call(db,w.code,w.token,payload),'w');
 const conflict=await call(db,w.code,b.token,{...payload,requestId:'privateConflict'});assert.equal(conflict.status,409);check(conflict,'b');assert(!JSON.stringify(conflict.game).includes('wildHorse'));assert(!JSON.stringify(conflict.game).includes('존나 야생마'));
 const stored=JSON.parse(db.sql.prepare('SELECT game FROM chess_rooms WHERE code = ?').get(w.code).game);assert.equal(stored.abilities.w.id,'wildHorse');assert.equal(stored.abilities.w.active,true);db.sql.close();
});

test('burrow stays secret through HTTP actions, reconnect and occupied-square rejection',async()=>{
 const db=database();const {w,b}=await started(db);const g=createGame('burrow','gatling');
 db.sql.prepare('UPDATE chess_rooms SET game = ? WHERE code = ?').run(JSON.stringify(g),w.code);
 const payload={type:'action',version:1,requestId:'burrowHide001',action:{type:'ability',from:sq('b1')}};
 const hidden=await call(db,w.code,w.token,payload);assert.equal(hidden.status,200);assert.equal(hidden.game.abilities.w.burrow.at,sq('b1'));assert.equal(hidden.game.turn,'w');
 const opposite=await call(db,w.code,b.token);assert.equal(opposite.game.board[sq('b1')],null);assert.equal(opposite.game.abilities.w.id,'hidden');assert(!JSON.stringify(opposite.game).includes('burrow'));
 assert.equal((await call(db,w.code,w.token,payload)).version,hidden.version);
 const stored=JSON.parse(db.sql.prepare('SELECT game FROM chess_rooms WHERE code = ?').get(w.code).game);stored.board[sq('b1')]={id:'blocker',color:'b',kind:'r',moved:true};
 db.sql.prepare('UPDATE chess_rooms SET game = ? WHERE code = ?').run(JSON.stringify(stored),w.code);
 const rejected=await call(db,w.code,w.token,{type:'action',version:hidden.version,requestId:'burrowExit001',action:{type:'ability'}});assert.equal(rejected.status,400);
 assert.equal((await call(db,w.code,w.token)).game.abilities.w.burrow.piece.kind,'n');db.sql.close();
});

test('gatling burst consumes server ammo once, hides it from opponent and persists reconnect',async()=>{
 const db=database();const {w,b}=await started(db);const g=createGame('gatling','necro');g.board.fill(null);
 for(const [at,p] of Object.entries({a1:'wk',h7:'bk',d4:'wq',d6:'bn',e6:'br'}))g.board[sq(at)]={id:p[0]+at,color:p[0],kind:p[1],moved:true};
 g.abilities.w.ammo=8;db.sql.prepare('UPDATE chess_rooms SET game = ? WHERE code = ?').run(JSON.stringify(g),w.code);
 const payload={type:'action',version:1,requestId:'gatlingBurst01',action:{type:'ability',from:sq('d4'),mode:'burst'}};
 const fired=await call(db,w.code,w.token,payload);assert.equal(fired.status,200);assert.equal(fired.game.abilities.w.ammo,0);assert.equal(fired.game.board[sq('e6')],null);
 const replay=await call(db,w.code,w.token,payload);assert.equal(replay.version,fired.version);assert.equal(replay.game.captured.w.length,2);
 const enemy=await call(db,w.code,b.token);assert(!JSON.stringify(enemy.game).includes('gatling'));assert(!JSON.stringify(enemy.game).includes('ammo'));assert.deepEqual(enemy.game.board,fired.game.board);db.sql.close();
});
