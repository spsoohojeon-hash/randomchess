// Stream supervised-learning rows. No referee truth is copied into features.
import {DatabaseSync} from 'node:sqlite';
import {createWriteStream} from 'node:fs';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {defaultHome,unpack} from './collector.mjs';
process.umask(0o077);
const home=process.env.RESEARCH_HOME??defaultHome;
const db=new DatabaseSync(join(home,'research.sqlite'),{readOnly:true});
const path=resolve(process.argv[2]??join(home,'training.jsonl'));
const output=createWriteStream(path,{mode:0o600,flags:'wx'});
let count=0;
try{
 for(const row of db.prepare("SELECT r.payload,g.winner,g.id,g.rules FROM records r JOIN games g ON g.id=r.game_id WHERE g.status='finished' ORDER BY r.game_id,r.seq").iterate()){
  const event=unpack(row.payload);if(event.type!=='action')continue;
  const splitCode=parseInt(createHash('sha256').update(row.id).digest('hex').slice(0,8),16)%100;
  const sample={schema:1,gameId:row.id,step:event.seq,rules:row.rules,policy:event.policy,split:splitCode<80?'train':splitCode<90?'validation':'test',features:event.observation,action:event.action,value:row.winner==='draw'?0:row.winner===event.side?1:-1,searchScore:event.analysis.score,searchIncomplete:event.analysis.incomplete,beliefApproximate:event.beliefApproximate};
  if(!output.write(JSON.stringify(sample)+'\n'))await once(output,'drain');count++;
 }
 output.end();await once(output,'finish');console.log(`Exported ${count} private training rows to ${path}`);
}finally{db.close();}
