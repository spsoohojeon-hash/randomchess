// This worker reads only aggregate operational status, never private game payloads.
export const monitorSchema=[
 'CREATE TABLE IF NOT EXISTS research_monitor (id INTEGER PRIMARY KEY CHECK(id=1), checked INTEGER, status TEXT, delivered TEXT)',
 'INSERT OR IGNORE INTO research_monitor(id) VALUES(1)',
];
export type MonitorEnv={DB:D1Database;DISCORD_WEBHOOK_URL?:string;TELEGRAM_BOT_TOKEN?:string;TELEGRAM_CHAT_ID?:string};
type Observation={enabled:boolean;heartbeat:number|null;lastEvent:number|null;blocked:number;training:{state?:string;updated?:number}|null};
export function assess(o:Observation,now:number,previous:{checked:number|null;blocked:number;state?:string;notification?:string;issues?:string[]}|null){
 const issues:string[]=[];
 if(o.enabled){
  if(!o.heartbeat||now-o.heartbeat>10*60_000)issues.push('runner_offline');
  else if(previous?.state!=='paused'&&previous?.checked&&now-previous.checked>=55*60_000&&(!o.lastEvent||o.lastEvent<=previous.checked)&&now-(o.lastEvent??previous.checked)>=60*60_000)issues.push('no_progress');
  if(previous&&(o.blocked>previous.blocked||(previous.notification==='failed'&&previous.issues?.includes('games_blocked'))))issues.push('games_blocked');
 }
 if(o.training?.state==='failed')issues.push('training_failed');
 if(['loading','training','validating'].includes(o.training?.state??'')&&o.training?.updated&&now-o.training.updated>2*3600_000)issues.push('training_stale');
 return {checked:now,state:issues.length?'attention':o.enabled?'healthy':'paused',issues,blocked:o.blocked,heartbeat:o.heartbeat,lastEvent:o.lastEvent};
}
const labels:Record<string,string>={runner_offline:'PC 실행기 접속이 10분 이상 끊겼습니다.',no_progress:'1시간 이상 새 대국 행동이 보고되지 않았습니다. 계산 또는 업로드 상태를 확인하세요.',games_blocked:'새로운 대국 오류가 기록됐습니다.',training_failed:'AI 학습 오류가 보고됐습니다.',training_stale:'학습 진행 보고가 2시간 이상 갱신되지 않았습니다.'};
export async function deliver(env:MonitorEnv,text:string,send:typeof fetch=fetch){
 if(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID){
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN))throw Error('notification_configuration');
  const r=await send('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text,disable_notification:false})});
  if(!r.ok||(await r.json() as {ok?:boolean}).ok!==true)throw Error('notification_failed');
  return true;
 }
 if(env.DISCORD_WEBHOOK_URL){
  const url=new URL(env.DISCORD_WEBHOOK_URL);
  if(url.protocol!=='https:'||url.hostname!=='discord.com'||!/^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname)||url.username||url.password||url.search||url.hash)throw Error('notification_configuration');
  const r=await send(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:JSON.stringify({content:text,allowed_mentions:{parse:[]}})});
  if(!r.ok)throw Error('notification_failed');return true;
 }
 return false;
}
export async function checkResearch(env:MonitorEnv,now=Date.now(),send:typeof fetch=fetch){
 await env.DB.batch(monitorSchema.map(s=>env.DB.prepare(s)));
 const previous=await env.DB.prepare('SELECT * FROM research_monitor WHERE id=1').first<{checked:number|null;status:string|null;delivered:string|null}>();
 // A missing research schema is a deployment error; fail visibly in cron logs.
 const control=await env.DB.prepare('SELECT enabled,heartbeat FROM research_control WHERE id=1').first<{enabled:number;heartbeat:number|null}>();
 if(!control)throw Error('research_not_initialized');
 const totals=await env.DB.prepare("SELECT MAX(updated) lastEvent,COALESCE(SUM(status='blocked'),0) blocked FROM research_games").first<{lastEvent:number|null;blocked:number}>();
 const training=await env.DB.prepare('SELECT status FROM research_training WHERE id=1').first<{status:string|null}>();
 const old=previous?.status?JSON.parse(previous.status):null;
 const report=assess({enabled:!!control.enabled,heartbeat:control.heartbeat,lastEvent:totals?.lastEvent??null,blocked:totals?.blocked??0,training:training?.status?JSON.parse(training.status):null},now,old);
 // Include the blocked total only while it is an issue. Identical outages notify once.
 const key=report.issues.length?report.issues.map(i=>i==='games_blocked'?i+':'+report.blocked:i).join(','):report.state;
 let delivered=previous?.delivered??null;
 const shouldSend=report.issues.length>0||!!delivered&&!['healthy','paused'].includes(delivered);
 const changed=key!==delivered;
 let notification='not_configured';
 if(env.DISCORD_WEBHOOK_URL||(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID)){
  notification='unchanged';
  if(changed&&shouldSend){
   const text='랜능체 연구실 점검\n'+(report.issues.length?report.issues.map(i=>labels[i]).join('\n'):report.state==='paused'?'수집이 일시정지 상태입니다. 기존 경고를 해제합니다.':'이전 경고가 해제됐습니다. 대국 진행과 학습 상태를 연구실에서 확인하세요.');
   try{await deliver(env,text,send);delivered=key;notification='sent';}catch{notification='failed';}
  }else if(!shouldSend)delivered=key;
 }
 await env.DB.prepare('UPDATE research_monitor SET checked=?,status=?,delivered=? WHERE id=1').bind(now,JSON.stringify({...report,notification}),delivered).run();
 if(notification==='failed')throw Error('research_notification_failed');
 return {...report,notification};
}
