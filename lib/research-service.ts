// This API deliberately fails closed until BOTH Cloudflare secrets are set.
export type ResearchEnv={DB:D1Database;RESEARCH_PASSWORD?:string;RESEARCH_RUNNER_TOKEN?:string};
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie, Authorization'};
const json=(value:unknown,status=200,extra:Record<string,string>={})=>Response.json(value,{status,headers:{...headers,...extra}});
const encode=new TextEncoder();
async function digest(s:string){return new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(s)));}
async function equal(a:string,b:string){const x=await digest(a),y=await digest(b);let n=0;for(let i=0;i<x.length;i++)n|=x[i]^y[i];return n===0;}
async function sign(value:string,secret:string){const key=await crypto.subtle.importKey('raw',encode.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encode.encode(value))),n=>n.toString(16).padStart(2,'0')).join('');}
const schema=[
 'CREATE TABLE IF NOT EXISTS research_control (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0, heartbeat INTEGER, runner TEXT)',
 'INSERT OR IGNORE INTO research_control(id) VALUES(1)',
 'CREATE TABLE IF NOT EXISTS research_games (id TEXT PRIMARY KEY, white_card TEXT NOT NULL, black_card TEXT NOT NULL, started INTEGER NOT NULL, updated INTEGER NOT NULL, seq INTEGER NOT NULL DEFAULT -1, status TEXT NOT NULL, winner TEXT, reason TEXT, rules TEXT NOT NULL, board TEXT NOT NULL, ply INTEGER NOT NULL DEFAULT 0, approximate INTEGER NOT NULL DEFAULT 0)',
 'CREATE INDEX IF NOT EXISTS research_games_updated ON research_games(updated DESC)',
 'CREATE TABLE IF NOT EXISTS research_events (game_id TEXT NOT NULL, seq INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(game_id,seq))',
 'CREATE TABLE IF NOT EXISTS research_login_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS research_training (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 1, requested INTEGER NOT NULL DEFAULT 0, status TEXT, updated INTEGER)',
 'INSERT OR IGNORE INTO research_training(id) VALUES(1)',
];
async function init(db:D1Database){await db.batch(schema.map(s=>db.prepare(s)));}
async function read(req:Request,max=350_000){if(Number(req.headers.get('Content-Length'))>max)throw Error('size');const reader=req.body?.getReader();let size=0,text='';const decoder=new TextDecoder();if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>max){await reader.cancel();throw Error('size');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();return JSON.parse(text||'{}');}
const cookie=(value:string,age:number)=>`__Host-research=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
export async function researchApi(env:ResearchEnv,req:Request,path:string):Promise<Response>{
 const password=env.RESEARCH_PASSWORD??'',token=env.RESEARCH_RUNNER_TOKEN??'';
 if(password.length<16||token.length<32)return json({error:'관리자 비밀번호와 수집기 비밀키 설정이 필요합니다.',setup:true},503);
 const url=new URL(req.url),origin=req.headers.get('Origin');
 if(req.method!=='GET'&&origin&&origin!==url.origin)return json({error:'허용되지 않은 출처입니다.'},403);
 try{
  if(path==='login'&&req.method==='POST'){
   const input=await read(req,2000);await init(env.DB);
   const now=Date.now(),window=Math.floor(now/900000),ip=req.headers.get('CF-Connecting-IP')??'unknown';
   // Atomic per-IP and global counters avoid unlimited distributed guesses.
   const buckets=[`ip:${await sign(ip,token)}:${window}`,`all:${window}`];
   const counts=await env.DB.batch(buckets.map(bucket=>env.DB.prepare('INSERT INTO research_login_limits(bucket,attempts,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(bucket,now+1800000)));
   if((counts[0].results[0] as {attempts:number}).attempts>10||(counts[1].results[0] as {attempts:number}).attempts>100)return json({error:'로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.'},429,{'Retry-After':'900'});
   await env.DB.prepare('DELETE FROM research_login_limits WHERE expires < ?').bind(now).run();
   if(typeof input.password!=='string'||!await equal(input.password,password))return json({error:'비밀번호가 맞지 않습니다.'},401);
   const expires=String(now+12*3600000),signature=await sign(expires,password+token);
   return json({ok:true},200,{'Set-Cookie':cookie(expires+'.'+signature,43200)});
  }
  const auth=req.headers.get('Authorization')??'';
  const runner=auth.startsWith('Bearer ')&&await equal(auth.slice(7),token);
  const value=req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-research='))?.slice(16)??'';
  const [expires,signature]=value.split('.');
  const owner=!!expires&&Number(expires)>Date.now()&&Number(expires)<=Date.now()+12*3600000&&!!signature&&await equal(signature,await sign(expires,password+token));
  const runnerPath=path.startsWith('runner/');
  if(runnerPath?!runner:!owner)return json({error:'로그인이 필요합니다.'},401);
  await init(env.DB);
  if(path==='logout'&&req.method==='POST')return json({ok:true},200,{'Set-Cookie':cookie('',0)});
  if(path==='session'&&req.method==='GET')return json({ok:true});
  if(path==='control'&&req.method==='POST'){
   const input=await read(req,1000);if(typeof input.enabled!=='boolean')return json({error:'잘못된 설정입니다.'},400);
   await env.DB.prepare('UPDATE research_control SET enabled=? WHERE id=1').bind(input.enabled?1:0).run();return json({ok:true});
  }
  if(path==='runner/control'&&req.method==='POST'){
   const input=await read(req,5000);await env.DB.prepare('UPDATE research_control SET heartbeat=?,runner=? WHERE id=1').bind(Date.now(),String(input.runner??'collector').slice(0,80)).run();
   if(input.training&&typeof input.training==='object'){
    const source=input.training,report:Record<string,unknown>={};
    if(!['waiting','loading','training','validating','ready','rejected','failed'].includes(source.state))return json({error:'잘못된 학습 상태입니다.'},400);
    report.state=source.state;
    for(const key of ['completedGames','trainGames','validationGames','testGames','examples','epoch','epochs','validationLoss','baselineLoss','testLoss','testValueLoss','trainLoss','processed','updated'])if(typeof source[key]==='number'&&Number.isFinite(source[key]))report[key]=source[key];
    for(const key of ['activeModel','modelId','rules','reason'])if(typeof source[key]==='string')report[key]=source[key].slice(0,160);
    await env.DB.prepare('UPDATE research_training SET status=?,updated=? WHERE id=1').bind(JSON.stringify(report),Date.now()).run();
   }
   const control=await env.DB.prepare('SELECT enabled FROM research_control WHERE id=1').first();
   const training=await env.DB.prepare('SELECT enabled training_enabled, requested training_request FROM research_training WHERE id=1').first();
   return json({...control,...training});
  }
  if(path==='training/control'&&req.method==='POST'){
   const input=await read(req,1000);
   if(typeof input.enabled==='boolean')await env.DB.prepare('UPDATE research_training SET enabled=? WHERE id=1').bind(input.enabled?1:0).run();
   else if(input.trainNow===true)await env.DB.prepare('UPDATE research_training SET requested=requested+1 WHERE id=1').run();
   else return json({error:'잘못된 학습 설정입니다.'},400);
   return json({ok:true});
  }
  if(path==='runner/event'&&req.method==='POST'){
   const p=await read(req),g=p.game;
   if(!g||!/^[-a-zA-Z0-9]{8,80}$/.test(g.id)||!Number.isSafeInteger(p.seq)||p.seq<0||typeof p.payload!=='string'||p.payload.length>300000||!/^[-a-zA-Z0-9+/=]+$/.test(p.payload)||!['running','finished','blocked'].includes(g.status)||!Array.isArray(g.board)||g.board.length!==64||!Number.isSafeInteger(g.ply)||typeof g.rules!=='string'||g.rules.length>128||typeof g.white!=='string'||g.white.length>40||typeof g.black!=='string'||g.black.length>40||!Number.isSafeInteger(g.started)||![null,'w','b','draw'].includes(g.winner??null))return json({error:'잘못된 기록입니다.'},400);
   // A duplicate is harmless after a lost HTTP response; a sequence gap is not.
   const row=await env.DB.prepare('SELECT seq FROM research_games WHERE id=?').bind(g.id).first<{seq:number}>();
   if(row&&p.seq<=row.seq)return json({ok:true,duplicate:true});
   if(p.seq!==(row?row.seq+1:0))return json({error:'sequence',expected:row?row.seq+1:0},409);
   await env.DB.batch([
    env.DB.prepare('INSERT INTO research_events(game_id,seq,payload) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(g.id,p.seq,p.payload),
    env.DB.prepare('INSERT INTO research_games(id,white_card,black_card,started,updated,seq,status,winner,reason,rules,board,ply,approximate) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,seq=excluded.seq,status=excluded.status,winner=excluded.winner,reason=excluded.reason,board=excluded.board,ply=excluded.ply,approximate=excluded.approximate WHERE excluded.seq=research_games.seq+1').bind(g.id,g.white,g.black,g.started,Date.now(),p.seq,g.status,g.winner??null,String(g.reason??'').slice(0,300),g.rules,JSON.stringify(g.board),g.ply,g.approximate?1:0),
   ]);return json({ok:true});
  }
  if(path==='stats'&&req.method==='GET'){
   const control=await env.DB.prepare('SELECT * FROM research_control WHERE id=1').first();
   const totals=await env.DB.prepare("SELECT COUNT(*) games, SUM(status='finished') finished, SUM(status='running') running, SUM(status='blocked') blocked, SUM(CASE WHEN seq>0 THEN seq ELSE 0 END) actions, SUM(status='finished' AND winner='w') white_wins, SUM(status='finished' AND winner='b') black_wins, SUM(status='finished' AND winner='draw') draws FROM research_games").first();
   const ranking=await env.DB.prepare("SELECT card,COUNT(*) games,SUM(win) wins,SUM(draw) draws FROM (SELECT white_card card,winner='w' win,winner='draw' draw FROM research_games WHERE status='finished' UNION ALL SELECT black_card card,winner='b' win,winner='draw' draw FROM research_games WHERE status='finished') GROUP BY card ORDER BY wins*1.0/COUNT(*) DESC").all();
   const matchups=await env.DB.prepare("SELECT white_card,black_card,COUNT(*) games,SUM(winner='w') white_wins,SUM(winner='b') black_wins,SUM(winner='draw') draws FROM research_games WHERE status='finished' GROUP BY white_card,black_card ORDER BY games DESC LIMIT 100").all();
   const games=await env.DB.prepare('SELECT * FROM research_games ORDER BY updated DESC LIMIT 30').all();
   const training=await env.DB.prepare('SELECT * FROM research_training WHERE id=1').first<{enabled:number;requested:number;status:string|null;updated:number|null}>();
   return json({control,totals,ranking:ranking.results,matchups:matchups.results,games:games.results,training:{...training,status:training?.status?JSON.parse(training.status):null},now:Date.now()});
  }
  if(path==='games'&&req.method==='GET'){
   const before=Number(url.searchParams.get('before')??Number.MAX_SAFE_INTEGER);
   const rows=await env.DB.prepare('SELECT id,white_card,black_card,started,updated,seq,status,winner,rules FROM research_games WHERE rowid < ? ORDER BY rowid DESC LIMIT 100').bind(before).all();
   const ids=await env.DB.prepare('SELECT MIN(rowid) cursor FROM (SELECT rowid FROM research_games WHERE rowid < ? ORDER BY rowid DESC LIMIT 100)').bind(before).first();
   return json({games:rows.results,...ids});
  }
  if(path==='events'&&req.method==='GET'){
   const id=url.searchParams.get('id')??'',after=Number(url.searchParams.get('after')??-1);
   const records=await env.DB.prepare('SELECT seq,payload FROM research_events WHERE game_id=? AND seq>? ORDER BY seq LIMIT 25').bind(id,after).all();
   return json({events:records.results});
  }
  return json({error:'찾을 수 없습니다.'},404);
 }catch{return json({error:'저장소 요청을 처리하지 못했습니다. 저장 공간과 설정을 확인해 주세요.'},503);}
}
