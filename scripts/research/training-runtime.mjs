import {readFileSync,existsSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {deserialize} from '../../lib/research-network.ts';
import {decide} from '../../lib/research-policy.ts';
const read=path=>{try{return JSON.parse(readFileSync(path,'utf8'));}catch{return null;}};
export class TrainingRuntime{
 constructor(home,config,rules){this.home=home;this.config=config;this.rules=rules;this.child=null;this.active=null;this.control=read(join(home,'training-control.json'))??{request:0};}
 status(){this.refresh();const status=read(join(this.home,'training-status.json'));return {...(status?.rules===this.rules?status:{state:'waiting',rules:this.rules,completedGames:0,epoch:0,epochs:5,reason:'not_enough_completed_games'}),activeModel:this.active?.id??null};}
 refresh(){const value=read(join(this.home,'active-model.json'));if(value?.rules!==this.rules){this.active=null;return;}if(value.id===this.active?.id)return;try{this.active={id:value.id,network:deserialize(value.network)};}catch{this.active=null;}}
 choose(input,seed){const result=decide(input,seed,this.active?.network);return {...result,modelId:this.active?.id??null};}
 manage(server,db){
  this.refresh();if(this.child)return;
  const count=db.prepare("SELECT COUNT(*) n FROM games WHERE status='finished' AND rules=?").get(this.rules).n;
  const status=this.status(),requested=Number(server.training_request??0)>this.control.request;
  const automatic=!!server.training_enabled;
  const every=Math.max(10,Number(this.config.trainingEveryGames)||100);
  const interrupted=['loading','training','validating'].includes(status.state);
  const due=count>=(status.rules===this.rules?status.completedGames??0:0)+every;
  if(!requested&&!(automatic&&(due||interrupted)))return;
  this.control.request=Number(server.training_request??0);
  const path=join(this.home,'training-control.json'),temp=path+'.tmp';writeFileSync(temp,JSON.stringify(this.control),{mode:0o600});renameSync(temp,path);
  const command=fileURLToPath(new URL('./train.mjs',import.meta.url));
  this.child=spawn(process.execPath,[command],{env:{...process.env,RESEARCH_HOME:this.home,RESEARCH_TRAIN_EPOCHS:String(this.config.trainingEpochs??5),RESEARCH_TRAIN_EXAMPLES:String(this.config.trainingMaxExamples??12000)},stdio:'ignore'});
  const finish=()=>{this.child=null;this.refresh();};this.child.once('error',finish);this.child.once('exit',finish);
 }
 stop(){this.child?.kill('SIGTERM');}
}
