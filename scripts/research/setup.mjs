import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
process.umask(0o077);
if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Run setup in your private interactive terminal.');
const home=process.env.RESEARCH_HOME??join(homedir(),'.randomchess-research');
mkdirSync(home,{recursive:true,mode:0o700});
const file=join(home,'config.json');
const prompt=createInterface({input:process.stdin,output:process.stdout});
try{
 console.log('개인 AI 연구실 최초 설정. 이 터미널 화면을 공개하지 마세요.');
 const previous=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null;
 const url=await prompt.question('사이트 주소 [https://randomchess.sp-soohojeon.workers.dev]: ')||previous?.url||'https://randomchess.sp-soohojeon.workers.dev';
 if(!/^https:\/\//.test(url))throw Error('HTTPS address required');
 const worker=await prompt.question('Cloudflare Worker 이름 [randomchess]: ')||'randomchess';
 if(!/^[a-zA-Z0-9_-]+$/.test(worker))throw Error('Invalid worker name');
 const config=previous??{token:randomBytes(32).toString('hex'),password:randomBytes(18).toString('base64url'),lanes:2,trainingEveryGames:100,trainingEpochs:5,trainingMaxExamples:12000};
 if(process.env.RESEARCH_PASSWORD_FILE){
  const selected=readFileSync(process.env.RESEARCH_PASSWORD_FILE,'utf8').replace(/\r?\n$/,'');
  if(selected.length<8)throw Error('연구실 비밀번호는 8자 이상이어야 합니다.');
  config.password=selected;
 }
 if(typeof config.password!=='string'||config.password.length<8||typeof config.token!=='string'||config.token.length<32)throw Error('저장된 연구실 인증 설정이 올바르지 않습니다.');
 config.url=new URL(url).origin;
 writeFileSync(file,JSON.stringify(config,null,2),{mode:0o600});
 const root=fileURLToPath(new URL('../../',import.meta.url));
 console.log('최신 사이트를 빌드하고 선택한 Cloudflare Worker에 배포합니다.');
 const build=spawnSync('pnpm',['run','build'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 if(build.status!==0)throw Error('사이트 빌드에 실패했습니다. pnpm build 결과를 확인한 뒤 다시 실행하세요.');
 const deploy=spawnSync('pnpm',['exec','wrangler','deploy','--config','dist/server/wrangler.json','--name',worker],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 if(deploy.status!==0)throw Error('Cloudflare 배포에 실패했습니다. pnpm exec wrangler login 후 다시 실행하세요.');
 console.log('Cloudflare에 두 비밀값을 등록합니다.');
 const result=spawnSync('pnpm',['exec','wrangler','secret','bulk','--name',worker,'--config','wrangler.jsonc'],{cwd:root,input:JSON.stringify({RESEARCH_PASSWORD:config.password,RESEARCH_RUNNER_TOKEN:config.token}),encoding:'utf8',stdio:['pipe','pipe','pipe']});
 if(result.status!==0){console.error('비밀값 등록을 완료하지 못했습니다. Cloudflare 로그인 후 이 설정 명령을 다시 실행하세요. 생성된 설정은 비공개 폴더에 보관되어 있습니다.');process.exitCode=1;}
 else{
  console.log('\n연구실: '+config.url+'/research');
  console.log('비밀번호는 비공개 설정 파일에 저장되었습니다: '+file);
  console.log('수집기: pnpm research:run');
  console.log('연구실에 로그인한 다음 “수집 시작”을 누르세요.');
 }
 if(process.platform==='linux'){
  const systemd=join(homedir(),'.config/systemd/user');mkdirSync(systemd,{recursive:true});
  const quote=s=>'"'+s.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('%','%%')+'"';
  const unit=`[Unit]\nDescription=Private RandomChess research collector\nAfter=network-online.target\n\n[Service]\nType=simple\nWorkingDirectory=${quote(resolve(root))}\nEnvironment=${quote('RESEARCH_HOME='+home)}\nExecStart=${quote(process.execPath)} ${quote(join(root,'scripts/research/collector.mjs'))}\nRestart=on-failure\nRestartSec=30\nUMask=0077\nNoNewPrivileges=true\n\n[Install]\nWantedBy=default.target\n`;
  writeFileSync(join(systemd,'randomchess-research.service'),unit,{mode:0o600});
  console.log('\n항상 켜진 Linux 서버에서 자동 재시작 등록:');
  console.log('systemctl --user daemon-reload');
  console.log('systemctl --user enable --now randomchess-research');
  console.log('로그아웃 후에도 실행하려면 서버 관리자가 해당 사용자의 loginctl enable-linger 를 설정해야 합니다.');
 }
}finally{prompt.close();}
