import {CARDS,createGame,applyAction,movesFor,abilityTargets,abilityError,generalAssignment,other,isRoyal,kindName,square,abilityStates,cardInfo,hasAbility} from './game.ts';
import type {Game,Side,CardId,CardPool,Action,Kind,Piece} from './game.ts';
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
 return successors(g,side).map(c=>c.action);
}
// Validate and apply once; search reuses the resulting position.
function successors(g:Game,side:Side,deadline=Infinity):{action:Action;game:Game}[]{
 if(g.phase==='over')return [];
 const list:{action:Action;game:Game}[]=[];
 const add=(action:Action)=>{if(performance.now()>deadline)return;try{list.push({action,game:applyAction(g,side,action)});}catch{}};
 const promote=(a:Action,pawn:boolean)=>{
  if(pawn&&a.to!==undefined&&[0,7].includes(Math.floor(a.to/8)))for(const promotion of ['q','r','b','n'] as Kind[])add({...a,promotion});else add(a);
 };
 if(g.phase==='choice'){if(g.pending?.chooser===side){add({type:'choice',choice:'w'});add({type:'choice',choice:'b'});}return list;}
 if(g.phase==='reaction'){for(const piece of g.pending?.options??[])add({type:'reaction',piece});return list;}
 if(g.phase==='duel'){for(const gesture of ['rock','paper','scissors'] as const)add({type:'duel',gesture});return list;}
 if(g.phase==='rescue'){
  if(g.pending?.chooser===side){for(const card of g.deathRescues?.[side]??[])add({type:'ability',card});add({type:'acceptDefeat'});}
  return list;
 }
 if(g.turn===side)g.board.forEach((p,from)=>{if(p?.color===side)for(const m of movesFor(g,from))promote({type:'move',from,to:m.to},p.kind==='p');});
 if(g.extraMove?.side===side)add({type:'skipExtra'});
 for(const a of abilityStates(g,side)){
  if(a.id==='hidden'||abilityError(g,side,a.id))continue;const id=a.id,starts=abilityTargets(g,side,undefined,id),base={type:'ability' as const,card:id};
  if(id==='necro'){for(let capture=0;capture<g.captured[side].length;capture++)for(const to of starts)promote({...base,capture,to},g.captured[side][capture].kind==='p');}
  else if(['exorcism','shallNotPass'].includes(id)||id==='burrow'&&!a.burrow||id==='general'&&generalAssignment(g,side)){for(const from of starts)add({...base,from});}
  else if(['spaceTravel','equality','shiningKnight','gatling'].includes(id)||id==='mounted'&&!a.fusion||id==='general'||id==='armyForward'&&a.uses===1){
   for(const from of starts){
    for(const to of abilityTargets(g,side,from,id))promote({...base,from,to},['spaceTravel','shiningKnight'].includes(id)&&g.board[from]?.kind==='p');
    if(id==='gatling'&&(a.ammo??0)>=8)add({...base,from,mode:'burst'});
   }
  }else add(base);
 }
 return list;
}
export function actionLabel(a:Action,g?:Game,side?:Side):string {
 if(a.type==='choice')return `${a.choice==='w'?'백':'흑'} 선택`;
 if(a.type==='reaction')return `${square(a.piece!)} 기물 선택`;
 if(a.type==='duel')return {rock:'바위',paper:'보',scissors:'가위'}[a.gesture!];
 if(a.type==='skipExtra')return '추가 이동 건너뛰기';
 if(a.type==='resign')return '기권';
 if(a.type==='acceptDefeat')return '능력 사용 없이 패배 확정';
 const name=a.type==='ability'?(a.mode==='burst'?'8발 모두 사용':a.card?cardInfo(a.card).name:'능력 사용'):g&&a.from!==undefined?kindName[g.board[a.from]?.kind??'p']:'이동';
 const revived=a.capture!==undefined&&g&&side?` · ${kindName[g.captured[side][a.capture]?.kind??'p']} 부활`:'';
 return `${name}${revived}${a.from!==undefined?' · '+square(a.from):''}${a.to!==undefined?' → '+square(a.to):''}${a.promotion?' · '+kindName[a.promotion]+' 승격':''}`;
}
// Observation contains no opponent ability state, previous-state snapshots, log, or private RPS pick.
export type Observation={board:({color:Side;kind:Kind;moved:boolean}|null)[];turn:Side;phase:Game['phase'];doubleLeft:number;glow:Side[];winner:Side|'draw'|null;duel:null|{score:{w:number;b:number};round:number;picked:{w:boolean;b:boolean}};chooser:Side|null};
export function observe(g:Game):Observation{return {board:g.board.map(p=>p?{color:p.color,kind:p.kind,moved:p.moved}:null),turn:g.turn,phase:g.phase,doubleLeft:g.doubleLeft,glow:g.glow??[],winner:g.result?.winner??null,duel:g.duel?{score:g.duel.score,round:g.duel.round,picked:g.duel.picked}:null,chooser:g.pending?.chooser??null};}
export type Knowledge={viewer:Side;pool:CardId[];ownCard:CardId;observations:{position:Observation;step?:Step}[]};
export type AnalysisRequest={id:number;difficulty:Difficulty;mode:EvaluationMode;viewer:Side;actions:Action[];knowledge?:Knowledge;game?:Game;belief?:{worlds:Game[];incomplete:boolean};prior?:Record<string,number>;emergency?:Side;purpose:'analysis'|'move'};
export function makeRequest(frames:Frame[],viewer:Side,pool:CardPool,mode:EvaluationMode,difficulty:Difficulty,purpose:AnalysisRequest['purpose'],id:number):AnalysisRequest {
 const current=frames.at(-1)!.game;
 // Both modes conceal the other player's simultaneous gesture, even from an all-information AI.
 if(mode==='theory'){
  const game=structuredClone(current);if(game.duel)game.duel.picks[other(viewer)]=null;
  return {id,difficulty,mode,viewer,purpose,game,actions:legalActions(current,actor(current,viewer))};
 }
 // The chooser knows its own new cards. Do not require reconstructing the
 // opponent's secret deck to offer an available last-chance action.
 if(current.phase==='rescue'&&current.pending?.chooser===viewer)return {id,difficulty,mode,viewer,purpose,emergency:viewer,actions:legalActions(current,viewer)};
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
// Board strength is separate from Give Me's reward points.
function pieceStrength(g:Game,p:Piece):number {
 const queen=hasAbility(g,p.color,'queenRule')?.active;
 let v=queen&&p.kind==='q'?2:queen&&p.kind==='k'?9:value[p.kind];
 if(p.kind==='r'&&hasAbility(g,p.color,'versatile'))v=6;
 if(p.form)v+=3.2;
 const power=hasAbility(g,p.color,'kingReturn')?.power;
 if(p.kind==='k'&&power&&power.left>0)v+=Math.max(0,(power.mode==='bn'?6:power.mode==='q'?9:12)-v)*Math.min(1,power.left/5);
 if(hasAbility(g,p.color,'wildHorse')?.active&&(p.kind==='n'||p.form||p.kind==='r'&&hasAbility(g,p.color,'versatile')||p.kind==='k'&&power?.mode!=='q'&&power))v+=.6;
 const general=hasAbility(g,p.color,'general')?.general;
 if(general?.id===p.id)v+=Math.min(3,general.kills*.5)+(general.knightId?1:0)+(general.bishopId?1:0);
 return v;
}
// A preference, not a new draw rule. Ability progress distinguishes otherwise
// identical boards, so repeated Equality activations remain valuable.
function positionKey(g:Game|Game['undo'][number]['before']):string {
 return JSON.stringify([g.board,g.turn,g.phase,g.abilities,g.extraAbilities,g.extraMove,g.doubleLeft,g.ban,g.ep,g.giveMe]);
}
export function evaluate(g:Game):number {
 if(g.result)return g.result.winner==='draw'?0:g.result.winner==='w'?10000:-10000;
 const attacks={w:new Set<number>(),b:new Set<number>()};
 const mobility=new Map<number,number>();
 g.board.forEach((p,i)=>{if(p){const moves=movesFor(g,i,true);mobility.set(i,moves.length);for(const m of moves)attacks[p.color].add(m.to);}});
 let score=0;
 for(const s of ['w','b'] as Side[]){let v=0;
  for(let i=0;i<64;i++){const p=g.board[i];if(!p||p.color!==s)continue;
   const advancement=s==='w'?6-Math.floor(i/8):Math.floor(i/8)-1;
   const strength=pieceStrength(g,p);
   v+=strength+(p.kind==='p'?Math.max(0,advancement)**2*.035:p.kind!=='k'?(3.5-Math.abs(i%8-3.5)+3.5-Math.abs(Math.floor(i/8)-3.5))*.035:0);
   v+=(mobility.get(i)??0)*.018;
   if(isRoyal(g,p)){
    // Check is legal, but allowing the opponent to capture a royal is expensive.
    if(attacks[other(s)].has(i))v-=actor(g)===other(s)?32:7;
   }else if(attacks[other(s)].has(i))v-=strength*(actor(g)===other(s)?.24:.08);
  }
  for(const a of abilityStates(g,s)){
   if(a.burrow)v+=pieceStrength(g,a.burrow.piece)*(g.board[a.burrow.at]?.color===other(s)?.45:.85);
   v+=(a.ammo??0)*.3+(a.ammo===8?1.2:0);
   if(a.id==='equality'){
    v+=a.castleCount*.7+a.castleCount**2*.12;
    const ready=abilityTargets(g,s,undefined,'equality').length>0;
    if(ready)v+=.5+a.castleCount*.18;
   }
   if(a.id==='reactionary')v+=a.active?-a.threats*2:a.eligible?.65:0;
   if(a.id==='mounted'&&s==='b'&&a.fusion)v-=a.threats*1.5;
   if(a.id==='giveMe')v+=Math.min(4,g.giveMe?.[s].score??0)*.18;
  }
  score+=s==='w'?v:-v;
 }
 if(g.phase==='play'&&g.undo.some(h=>positionKey(h.before)===positionKey(g)))score+=g.turn==='w'?.9:-.9;
 return score;
}
type Candidate={action:Action;game:Game;score:number};
// Each distinct stacked ability gets a candidate, not just the first two cards.
function beamCandidates<T extends {action:Action}>(ranked:T[],width:number):T[]{
 const selected=ranked.slice(0,width),cards=new Set<string>();
 for(const c of ranked)if(c.action.type==='ability'){
  const id=c.action.card??'primary';
  if(!cards.has(id)){cards.add(id);if(!selected.includes(c))selected.push(c);}
 }
 return selected;
}
function remainingDepth(before:Game,after:Game,side:Side,depth:number,chain:number):number{
 return after.phase==='play'&&actor(after)===side&&before.phase==='play'&&chain<4?depth:depth-1;
}
export type AnalysisResult={id:number;action:Action|null;score:number|null;wdl:{w:number;draw:number;b:number}|null;uncertainty:number;depth:number;nodes:number;candidates:number;incomplete:boolean;line:Step[];unavailable?:boolean};
const settings={easy:{depth:1,nodes:1500,beam:5,worlds:4},normal:{depth:2,nodes:9000,beam:7,worlds:6},hard:{depth:3,nodes:24000,beam:10,worlds:8}};
type Budget={nodes:number;limit:number;deadline:number};
type SearchResult={score:number;line:Step[];depth:number;complete:boolean};
function search(g:Game,depth:number,budget:Budget,beam:number,chain=0,alpha=-Infinity,beta=Infinity,quiet=1):SearchResult{
 const stand=evaluate(g),leaf={score:stand,line:[] as Step[],depth:0,complete:true};
 if(g.result||g.phase==='duel'||depth<=0&&quiet<=0)return g.phase==='duel'?{...leaf,score:0}:leaf;
 if(budget.nodes>=budget.limit||performance.now()>budget.deadline)return {...leaf,complete:false};
 const side=actor(g),sign=side==='w'?1:-1;
 const children=successors(g,side,budget.deadline);budget.nodes+=children.length;
 if(performance.now()>budget.deadline)return {...leaf,complete:false};
 const candidates:Candidate[]=children.map(c=>({...c,score:evaluate(c.game)}));
 // All immediate wins are checked before beam pruning, including hidden wins.
 const win=candidates.find(c=>c.game.result?.winner===side);
 if(win)return {score:win.score,line:[{side,action:win.action}],depth:1,complete:true};
 candidates.sort((a,b)=>sign*(b.score-a.score));
 const tactical=depth<=0;
 const selected=tactical?candidates.filter(c=>c.game.result||c.action.type==='move'&&!!g.board[c.action.to!]||c.action.type==='ability'&&Math.abs(c.score-stand)>1.5).slice(0,4):beamCandidates(candidates,beam);
 let best={...leaf},first=!tactical;
 for(const c of selected){
  const remaining=remainingDepth(g,c.game,side,depth,chain);
  const child=search(c.game,remaining,budget,beam,remaining===depth?chain+1:0,alpha,beta,tactical?quiet-1:quiet);
  if(!child.complete)return {...best,complete:false};
  // Prefer shorter forced wins without changing nonterminal material scores.
  const score=Math.abs(child.score)>9000?child.score-Math.sign(child.score)*.01:child.score;
  if(first||sign*score>sign*best.score){first=false;best={score,line:[{side,action:c.action},...child.line],depth:1+child.depth,complete:true};}
  if(sign===1)alpha=Math.max(alpha,best.score);else beta=Math.min(beta,best.score);
  if(alpha>=beta)break;
 }
 return best;
}
export function winEstimate(score:number):{w:number;draw:number;b:number}{
 const s=Math.max(-20,Math.min(20,score));const draw=Math.round(12*Math.exp(-Math.abs(s)/3));
 const w=Math.round((100-draw)/(1+Math.exp(-s/2.5)));return {w,draw,b:100-w-draw};
}
export function analyze(request:AnalysisRequest):AnalysisResult {
 if(request.emergency===request.viewer){
  const priority=['noThatMove','temusanTimeStone','quickDuel'];
  const action=priority.flatMap(card=>request.actions.filter(a=>a.type==='ability'&&a.card===card))[0]??request.actions.find(a=>a.type==='acceptDefeat')??null;
  return {id:request.id,action,score:null,wdl:null,uncertainty:50,depth:0,nodes:0,candidates:0,incomplete:true,line:action?[{side:request.viewer,action}]:[]};
 }
 const cfg=settings[request.difficulty],start=performance.now();
 const inferred=request.mode==='theory'?{worlds:[request.game!],incomplete:false}:request.belief??inferWorlds(request.knowledge!,start+2500);
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
  if(valid===worlds.length)ranked.push({action,score:sum/valid+sign*(request.prior?.[actionKey(action)]??0),spread:hi-lo,line:[{side,action}],depth:1});
 }
 ranked.sort((a,b)=>sign*(b.score-a.score));
 const finalists=beamCandidates(ranked,cfg.beam);
 let searchedDepth=0,truncated=false;
 for(let iteration=1;iteration<=cfg.depth;iteration++){
  const updates:typeof ranked=[];let completed=true;
  for(const candidate of finalists){
   let sum=0,depth=Infinity,lo=Infinity,hi=-Infinity,line=candidate.line;
   for(const g of worlds){
    const next=applyAction(g,side,candidate.action);
    const remaining=remainingDepth(g,next,side,iteration,0);
    const budget={nodes:0,limit:Math.max(400,Math.floor(cfg.nodes/(Math.max(1,finalists.length)*worlds.length))),deadline};
    const result=search(next,remaining,budget,cfg.beam,remaining===iteration?1:0,-Infinity,Infinity,iteration>1?1:0);
    nodes+=budget.nodes;
    if(!result.complete){completed=false;break;}
    sum+=result.score;lo=Math.min(lo,result.score);hi=Math.max(hi,result.score);depth=Math.min(depth,1+result.depth);
    if(worlds.length===1)line=[{side,action:candidate.action},...result.line];
   }
   if(!completed)break;
   updates.push({...candidate,score:sum/worlds.length+sign*(request.prior?.[actionKey(candidate.action)]??0),spread:hi-lo,depth,line});
  }
  // Never compare a deeply searched early candidate with an unsearched late one.
  if(!completed){truncated=true;break;}
  updates.forEach((u,i)=>Object.assign(finalists[i],u));searchedDepth=iteration;
 }
 finalists.sort((a,b)=>sign*(b.score-a.score));
 const best=finalists[0];const score=best?.score??worlds.reduce((n,g)=>n+evaluate(g),0)/worlds.length;
 let wdl=winEstimate(score);
 if(best){
  const outcomes=worlds.map(g=>applyAction(g,side,best.action).result);
  if(outcomes.every(Boolean)){
   const w=Math.round(100*outcomes.filter(r=>r?.winner==='w').length/outcomes.length);
   const draw=Math.round(100*outcomes.filter(r=>r?.winner==='draw').length/outcomes.length);
   wdl={w,draw,b:100-w-draw};
  }
 }
 return {...empty,action:best?.action??null,score,wdl,uncertainty:Math.min(50,Math.round((best?.spread??0)*3+(all.length>1?12:0)+(inferred.incomplete?15:0))),depth:searchedDepth?best?.depth??0:1,nodes,candidates:all.length,incomplete:truncated||inferred.incomplete||worlds.length<all.length,line:best?.line??[]};
}
