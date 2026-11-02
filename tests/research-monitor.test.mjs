import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {assess,checkResearch,deliver} from '../lib/research-monitor.ts';
function database(){
 const sql=new DatabaseSync(':memory:');
 return {sql,prepare(query){let args=[];return {bind(...a){args=a;return this;},async first(){return sql.prepare(query).get(...args)??null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}};},query,args:()=>args};},async batch(items){sql.exec('BEGIN');try{const result=items.map(s=>{const q=sql.prepare(s.query);if(/RETURNING/.test(s.query))return {results:q.all(...s.args())};const r=q.run(...s.args());return {results:[],meta:{changes:Number(r.changes)}};});sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}

const now=10*3600_000;
const healthy={enabled:true,heartbeat:now,lastEvent:now,blocked:0,training:null};
test('monitor distinguishes offline, stalled, paused and slow training without a move timer',()=>{
 assert.deepEqual(assess(healthy,now,null).issues,[]);
 assert.deepEqual(assess({...healthy,heartbeat:now-600001},now,null).issues,['runner_offline']);
 assert.deepEqual(assess({...healthy,enabled:false,heartbeat:null,lastEvent:null},now,null).issues,[]);
 assert.deepEqual(assess({...healthy,lastEvent:now-3600001},now,{checked:now-3600000,blocked:0}).issues,['no_progress']);
 assert.deepEqual(assess({...healthy,lastEvent:now-3600001},now,{checked:now-3600000,blocked:0,state:'paused'}).issues,[]);
 assert.deepEqual(assess({...healthy,training:{state:'training',updated:now-7200001}},now,null).issues,['training_stale']);
});
function fixture(){const DB=database();DB.sql.exec("CREATE TABLE research_control(id INTEGER,enabled INTEGER,heartbeat INTEGER); INSERT INTO research_control VALUES(1,1,0); CREATE TABLE research_games(updated INTEGER,status TEXT); CREATE TABLE research_training(id INTEGER,status TEXT); INSERT INTO research_training VALUES(1,NULL)");return {DB,DISCORD_WEBHOOK_URL:'https://discord.com/api/webhooks/123/test-token'};}
test('hourly checks deduplicate outage, retry failed notification and send recovery without secret game data',async()=>{
 const env=fixture(),sent=[];let fail=true;
 const send=async(url,options)=>{sent.push(JSON.parse(options.body));return new Response(null,{status:fail?500:204});};
 await assert.rejects(checkResearch(env,now,send));
 assert.equal(JSON.parse(env.DB.sql.prepare('SELECT status FROM research_monitor').get().status).notification,'failed');
 fail=false;await checkResearch(env,now+3600000,send);assert.equal(sent.length,2);
 await checkResearch(env,now+7200000,send);assert.equal(sent.length,2);
 env.DB.sql.prepare('UPDATE research_control SET heartbeat=?').run(now+10800000);
 env.DB.sql.prepare('INSERT INTO research_games VALUES(?,?)').run(now+10800000,'running');
 await checkResearch(env,now+10800000,send);assert.equal(sent.length,3);assert.match(sent[2].content,/해제/);
 for(const message of sent){assert.deepEqual(message.allowed_mentions,{parse:[]});assert(!/password|token|white_card|black_card/.test(message.content));}
 env.DB.sql.close();
});
test('missing notification destination is explicit and arbitrary webhook hosts rejected',async()=>{
 const env=fixture();delete env.DISCORD_WEBHOOK_URL;let called=false;
 const result=await checkResearch(env,now,async()=>{called=true;throw Error('unexpected');});
 assert.equal(result.notification,'not_configured');assert.equal(called,false);
 await assert.rejects(deliver({...env,DISCORD_WEBHOOK_URL:'https://evil.test/api/webhooks/123/token'},'test',async()=>{called=true;}));assert.equal(called,false);env.DB.sql.close();
});
