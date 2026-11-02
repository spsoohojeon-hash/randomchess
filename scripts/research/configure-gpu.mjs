import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const home=process.env.RESEARCH_HOME??join(homedir(),'.randomchess-research');
const file=process.env.RESEARCH_CONFIG??join(home,'config.json');
const config=JSON.parse(readFileSync(file,'utf8'));
const cpu=process.argv.includes('--cpu');
if(!cpu){
 const python=resolve(process.argv[2]??'.venv/Scripts/python.exe');
 const r=spawnSync(python,[fileURLToPath(new URL('./gpu-train.py',import.meta.url)),'--check'],{encoding:'utf8',windowsHide:true});
 if(r.status!==0){console.error('CUDA 확인 실패. Python 가상환경, CUDA용 PyTorch, NVIDIA 드라이버를 확인하세요. 기존 설정은 유지됩니다.');process.exit(1);}
 const details=JSON.parse(r.stdout);console.log('GPU 확인: '+details.device);
 config.python=python;config.trainingBackend='cuda';
}else config.trainingBackend='cpu';
config.lanes=4;
const temp=file+'.tmp';writeFileSync(temp,JSON.stringify(config,null,2),{mode:0o600});renameSync(temp,file);
console.log('4판 병렬 / '+config.trainingBackend+' 학습으로 설정했습니다. 수집기를 다시 시작하세요.');
