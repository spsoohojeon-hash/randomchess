import {CARDS,createGame,applyAction,movesFor,abilityTargets,abilityError,generalAssignment,other,isRoyal,kindName,square} from './game.ts';
import type {Game,Side,CardId,CardPool,Action,Kind} from './game.ts';
export type EvaluationMode='practical'|'theory';
export type Difficulty='easy'|'normal'|'hard';
export type Frame={game:Game;by?:Side;action?:Action};
export type Step={side:Side;action:Action};
const value:Record<Kind,number>={p:1,n:3.2,b:3.3,r:5,q:9,k:0};
export const actionKey=(a:Action)=>JSON.stringify(a);
export function actor(g:Game,preferred:Side=g.turn):Side {
 if(g.pending)return g.pending.chooser;
 if(g.phase==='duel')return !g.duel?.picked[preferred]?preferred:other(preferred);
 return g.turn;
}
// Enumerate actions through the same validator used by the actual game, including free abilities.
export function legalActions(g:Game,side:Side=actor(g)):Action[]{
 if(g.phase==='over')return [];
 const list:Action[]=[];
 const add=(a:Action)=>{try{applyAction(g,side,a);list.push(a);}catch{}};
 const promote=(a:Action,pawn:boolean)=>{
  if(pawn&&a.to!==undefined&&[0,7].includes(Math.floor(a.to/8)))for(const promotion of ['q','r','b','n'] as Kind[])add({...a,promotion});else add(a);
 };
 if(g.phase==='choice'){if(g.pending?.chooser===side){add({type:'choice',choice:'w'});add({type:'choice',choice:'b'});}return list;}
 if(g.phase==='reaction'){for(const piece of g.pending?.options??[])add({type:'reaction',piece});return list;}
 if(g.phase==='duel'){for(const gesture of ['rock','paper','scissors'] as const)add({type:'duel',gesture});return list;}
 if(g.turn===side)g.board.forEach((p,from)=>{if(p?.color===side)for(const m of movesFor(g,from))promote({type:'move',from,to:m.to},p.kind==='p');});
 if(g.extraMove?.side===side)add({type:'skipExtra'});
 if(abilityError(g,side))return list;
 const a=g.abilities[side],id=a.id,starts=abilityTargets(g,side);
 if(id==='necro'){for(let capture=0;capture<g.captured[side].length;capture++)for(const to of starts)promote({type:'ability',capture,to},g.captured[side][capture].kind==='p');}
 else if(['exorcism','shallNotPass'].includes(id)||id==='burrow'&&!a.burrow||id==='general'&&generalAssignment(g,side)){for(const from of starts)add({type:'ability',from});}
 else if(['spaceTravel','equality','shiningKnight','gatling'].includes(id)||id==='mounted'&&!a.fusion||id==='general'||id==='armyForward'&&a.uses===1){
  for(const from of starts){
   for(const to of abilityTargets(g,side,from))promote({type:'ability',from,to},['spaceTravel','shiningKnight'].includes(id)&&g.board[from]?.kind==='p');
   if(id==='gatling'&&(a.ammo??0)>=8)add({type:'ability',from,mode:'burst'});
  }
 }else add({type:'ability'});
 return list;
}
export function actionLabel(a:Action,g?:Game,side?:Side):string {
 if(a.type==='choice')return `${a.choice==='w'?'백':'흑'} 선택`;
 if(a.type==='reaction')return `${square(a.piece!)} 기물 선택`;
 if(a.type==='duel')return {rock:'바위',paper:'보',scissors:'가위'}[a.gesture!];
 if(a.type==='skipExtra')return '추가 이동 건너뛰기';
 if(a.type==='resign')return '기권';
 const name=a.type==='ability'?(a.mode==='burst'?'8발 모두 사용':'능력 사용'):g&&a.from!==undefined?kindName[g.board[a.from]?.kind??'p']:'이동';
 const revived=a.capture!==undefined&&g&&side?` · ${kindName[g.captured[side][a.capture]?.kind??'p']} 부활`:'';
 return `${name}${revived}${a.from!==undefined?' · '+square(a.from):''}${a.to!==undefined?' → '+square(a.to):''}${a.promotion?' · '+kindName[a.promotion]+' 승격':''}`;
}
// Observation contains no opponent ability state, previous-state snapshots, log, or private RPS pick.
export type Observation={board:({color:Side;kind:Kind;moved:boolean}|null)[];turn:Side;phase:Game['phase'];doubleLeft:number;glow:Side[];winner:Side|'draw'|null;duel:null|{score:{w:number;b:number};round:number;picked:{w:boolean;b:boolean}};chooser:Side|null};
export function observe(g:Game):Observation{return {board:g.board.map(p=>p?{color:p.color,kind:p.kind,moved:p.moved}:null),turn:g.turn,phase:g.phase,doubleLeft:g.doubleLeft,glow:g.glow??[],winner:g.result?.winner??null,duel:g.duel?{score:g.duel.score,round:g.duel.round,picked:g.duel.picked}:null,chooser:g.pending?.chooser??null};}
export type Knowledge={viewer:Side;pool:CardId[];ownCard:CardId;observations:{position:Observation;step?:Step}[]};
export type AnalysisRequest={id:number;difficulty:Difficulty;mode:EvaluationMode;viewer:Side;actions:Action[];knowledge?:Knowledge;game?:Game;purpose:'analysis'|'move'};
export function makeRequest(frames:Frame[],viewer:Side,pool:CardPool,mode:EvaluationMode,difficulty:Difficulty,purpose:AnalysisRequest['purpose'],id:number):AnalysisRequest {
 const current=frames.at(-1)!.game;
 // Both modes conceal the other player's simultaneous gesture, even from an all-information AI.
 if(mode==='theory'){
  const game=structuredClone(current);if(game.duel)game.duel.picks[other(viewer)]=null;
  return {id,difficulty,mode,viewer,purpose,game,actions:legalActions(current,actor(current,viewer))};
 }
 const ownCard=frames[0].game.abilities[viewer].id as CardId;
 const ids=pool==='all'?CARDS.map(c=>c.id):pool;
 const knowledge:Knowledge={viewer,ownCard,pool:ids.length>1?ids.filter(c=>c!==ownCard):ids,observations:frames.map(f=>{
  // Opponent ability inputs (revival index, hidden targets, modes) are not observations.
  const action=f.action;
  const step=f.by&&action?{side:f.by,action:f.by===viewer?action:action.type==='move'?{type:'move' as const,from:action.from,to:action.to,...(action.promotion?{promotion:action.promotion}:{})}:{type:action.type}}:undefined;
  return {position:observe(f.game),...(step?{step}:{})};
 })};
 return {id,difficulty,mode,viewer,purpose,knowledge,actions:actor(current,viewer)===viewer?legalActions(current,viewer):[]};
}
const sameObservation=(a:Observation,b:Observation)=>JSON.stringify(a)===JSON.stringify(b);
export function inferWorlds(k:Knowledge,deadline=Infinity):{worlds:Game[];incomplete:boolean} {
 let worlds=k.pool.map(id=>createGame(k.viewer==='w'?k.ownCard:id,k.viewer==='b'?k.ownCard:id)).filter(g=>sameObservation(observe(g),k.observations[0].position));
 let incomplete=false;
 for(const event of k.observations.slice(1)){
  if(!event.step)continue;
  const next:Game[]=[];
  for(const g of worlds){
   if(performance.now()>deadline)return {worlds:[],incomplete:true};
   const {side,action}=event.step;
   const choices=side===k.viewer||action.type==='move'?[action]:action.type==='resign'?[{type:'resign'} as Action]:legalActions(g,side).filter(a=>a.type===action.type);
   let matched=0;
   for(const choice of choices){try{
    const after=applyAction(g,side,choice);
    if(sameObservation(observe(after),event.position)){next.push(after);if(++matched>=3){incomplete=true;break;}}
   }catch{}}
  }
  const seen=new Set<string>();worlds=next.filter(g=>{const key=JSON.stringify([g.board,g.abilities,g.turn,g.phase,g.duel]);if(seen.has(key))return false;seen.add(key);return true;});
  if(worlds.length>78){worlds=worlds.slice(0,78);incomplete=true;}
  if(!worlds.length)break;
 }
 return {worlds,incomplete};
}
export function evaluate(g:Game):number {
 if(g.result)return g.result.winner==='draw'?0:g.result.winner==='w'?10000:-10000;
 let score=0;
 for(const s of ['w','b'] as Side[]){let v=0;const a=g.abilities[s];
  for(let i=0;i<64;i++){const p=g.board[i];if(!p||p.color!==s)continue;
   const advancement=s==='w'?6-Math.floor(i/8):Math.floor(i/8)-1;
   v+=value[p.kind]+(p.kind==='p'?Math.max(0,advancement)*.1: p.kind!=='k'?(3.5-Math.abs(i%8-3.5)+3.5-Math.abs(Math.floor(i/8)-3.5))*.025:0);
   if(p.form)v+=3;if(isRoyal(g,p))v+=.01;
  }
  if(a.burrow)v+=value[a.burrow.piece.kind]*.7;
  v+=(a.ammo??0)*.22+(a.power?.left??0)*.055+(a.general?.kills??0)*.28;
  if(a.id==='equality')v+=a.castleCount*.3+(a.castleCount>=6?2:0);
  if(a.id==='reactionary'&&a.active)v-=a.threats*.8;
  if(a.id==='mounted'&&s==='b'&&a.fusion)v-=a.threats*.5;
  score+=s==='w'?v:-v;
 }
 return score;
}
type Candidate={action:Action;game:Game;score:number};
export type AnalysisResult={id:number;action:Action|null;score:number|null;wdl:{w:number;draw:number;b:number}|null;uncertainty:number;depth:number;nodes:number;candidates:number;incomplete:boolean;line:Step[];unavailable?:boolean};
const settings={easy:{depth:1,nodes:240,beam:5,worlds:4},normal:{depth:2,nodes:750,beam:7,worlds:6},hard:{depth:3,nodes:1800,beam:9,worlds:8}};
function search(g:Game,depth:number,budget:{nodes:number;limit:number;deadline:number},beam:number):{score:number;line:Step[];depth:number}{
 if(g.result||depth===0||budget.nodes>=budget.limit||performance.now()>budget.deadline)return {score:evaluate(g),line:[],depth:0};
 // Simultaneous moves are not treated as an opponent's visible, exploitable commitment.
 if(g.phase==='duel')return {score:0,line:[],depth:0};
 const side=actor(g),sign=side==='w'?1:-1;
 const candidates:Candidate[]=[];
 for(const action of legalActions(g,side)){
  if(budget.nodes++>=budget.limit||performance.now()>budget.deadline)break;
  const next=applyAction(g,side,action);candidates.push({action,game:next,score:evaluate(next)});
 }
 candidates.sort((a,b)=>sign*(b.score-a.score));
 let best={score:evaluate(g),line:[] as Step[],depth:0},first=true;
 for(const c of candidates.slice(0,beam)){
  const child=search(c.game,depth-1,budget,beam);
  if(first||sign*child.score>sign*best.score){first=false;best={score:child.score,line:[{side,action:c.action},...child.line],depth:1+child.depth};}
 }
 return best;
}
export function winEstimate(score:number):{w:number;draw:number;b:number}{
 const s=Math.max(-20,Math.min(20,score));const draw=Math.round(12*Math.exp(-Math.abs(s)/3));
 const w=Math.round((100-draw)/(1+Math.exp(-s/2.5)));return {w,draw,b:100-w-draw};
}
export function analyze(request:AnalysisRequest):AnalysisResult {
 const cfg=settings[request.difficulty],start=performance.now();
 const inferred=request.mode==='theory'?{worlds:[request.game!],incomplete:false}:inferWorlds(request.knowledge!,start+2500);
 const all=inferred.worlds;
 const empty:AnalysisResult={id:request.id,action:null,score:null,wdl:null,uncertainty:0,depth:0,nodes:0,candidates:all.length,incomplete:inferred.incomplete,line:[]};
 if(!all.length)return {...empty,unavailable:true};
 const count=Math.min(cfg.worlds,all.length),worlds=Array.from({length:count},(_,i)=>all[Math.floor(i*all.length/count)]);
 const first=worlds[0],side=actor(first,request.viewer),sign=side==='w'?1:-1;
 if(first.result){const winner=first.result.winner;return {...empty,score:evaluate(first),wdl:{w:winner==='w'?100:0,draw:winner==='draw'?100:0,b:winner==='b'?100:0}};}
 if(first.phase==='duel'){
  const choices=request.actions.filter(a=>a.type==='duel');const random=new Uint32Array(1);crypto.getRandomValues(random);
  return {...empty,action:choices.length?choices[random[0]%choices.length]:null,score:0,wdl:winEstimate(0),uncertainty:50};
 }
 const ranked:{action:Action;score:number;spread:number;line:Step[];depth:number}[]=[];
 let nodes=0;
 const deadline=start+5500;
 // Root is evaluated for every action so rare winning abilities cannot be dropped by an early cutoff.
 const roots=request.mode==='practical'&&side!==request.viewer?[...new Map(worlds.flatMap(g=>legalActions(g,side)).map(a=>[actionKey(a),a])).values()]:request.actions;
 for(const action of roots){
  let sum=0,lo=Infinity,hi=-Infinity,valid=0;
  for(const g of worlds){try{const next=applyAction(g,side,action),v=evaluate(next);sum+=v;lo=Math.min(lo,v);hi=Math.max(hi,v);valid++;}catch{}}
  if(valid===worlds.length)ranked.push({action,score:sum/valid,spread:hi-lo,line:[{side,action}],depth:1});
 }
 ranked.sort((a,b)=>sign*(b.score-a.score));
 const finalists=ranked.slice(0,cfg.beam);
 for(const candidate of finalists){
  let sum=0,depth=cfg.depth,lo=Infinity,hi=-Infinity;
  for(const g of worlds){
   const budget={nodes:0,limit:Math.max(15,Math.floor(cfg.nodes/(Math.max(1,finalists.length)*worlds.length))),deadline};
   const result=search(applyAction(g,side,candidate.action),cfg.depth-1,budget,cfg.beam);
   nodes+=budget.nodes;sum+=result.score;lo=Math.min(lo,result.score);hi=Math.max(hi,result.score);depth=Math.min(depth,1+result.depth);
   if(worlds.length===1)candidate.line=[{side,action:candidate.action},...result.line];
  }
  candidate.score=sum/worlds.length;candidate.spread=hi-lo;candidate.depth=depth;
 }
 finalists.sort((a,b)=>sign*(b.score-a.score));
 const best=finalists[0];const score=best?.score??worlds.reduce((n,g)=>n+evaluate(g),0)/worlds.length;
 return {...empty,action:best?.action??null,score,wdl:winEstimate(score),uncertainty:Math.min(50,Math.round((best?.spread??0)*3+(all.length>1?12:0)+(inferred.incomplete?15:0))),depth:best?.depth??0,nodes,candidates:all.length,incomplete:inferred.incomplete||worlds.length<all.length,line:best?.line??[]};
}
