import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,CARDS,indexOf as sq} from '../lib/game.ts';
import {legalActions,makeRequest,inferWorlds,analyze,evaluate,actor,actionLabel,winEstimate} from '../lib/practice-ai.ts';
function pos(w,b='necro',pieces={a1:'wk',h8:'bk'}){
 const g=createGame(w,b);g.board.fill(null);g.phase='play';g.pending=null;
 for(const [at,p] of Object.entries(pieces))g.board[sq(at)]={id:p[0]+at,color:p[0],kind:p[1],moved:false};return g;
}
const request=(g,side='w',mode='theory')=>makeRequest([{game:g}],side,'all',mode,'normal','move',1);
test('every initial ability yields only rules-valid actions without mutating source',()=>{
 for(const c of CARDS){const g=createGame(c.id,'necro'),before=JSON.stringify(g),side=actor(g);const moves=legalActions(g,side);assert(moves.length,c.id);for(const action of moves)assert.doesNotThrow(()=>applyAction(g,side,action));assert.equal(JSON.stringify(g),before);}
});
test('search finds king capture and a hidden equality win; UI labels omit the cause',()=>{
 const g=pos('equality','necro',{a1:'wk',h8:'bk',b4:'wr',e4:'wn'});g.abilities.w.castleCount=6;
 const r=analyze(request(g));assert.equal(r.action.type,'ability');assert.equal(applyAction(g,'w',r.action).result.winner,'w');assert(!/히든|7|승리/.test(actionLabel(r.action,g,'w')));
 const h=pos('necro','necro',{a1:'wk',h8:'bk',h7:'wr'});const s=analyze(request(h));assert.equal(applyAction(h,'w',s.action).result.winner,'w');
});
test('burst, revival, promotion and compound ability parameters are enumerated',()=>{
 const g=pos('gatling','necro',{a1:'wk',h8:'bk',d4:'wq',d6:'bp'});g.abilities.w.ammo=8;
 assert(legalActions(g).some(a=>a.mode==='burst'));
 const n=pos('necro','necro',{a1:'wk',h8:'bk',b7:'wp'});n.captured.w=[{id:'dead',kind:'q',color:'b',moved:true}];
 assert(legalActions(n).some(a=>a.capture===0));assert.equal(legalActions(n).filter(a=>a.from===sq('b7')&&a.to===sq('b8')).length,4);
 const m=pos('mounted','necro',{a1:'wk',h8:'bk',b1:'wn',c1:'wr'});assert(legalActions(m).some(a=>a.type==='ability'&&a.from===sq('b1')&&a.to===sq('c1')));
});
test('private request does not depend on the actual unrevealed opponent card or state',()=>{
 const a=createGame('nothing','burrow'),b=createGame('nothing','gatling');
 b.abilities.b.ammo=7;b.abilities.b.threats=4;
 const ra=request(a,'w','practical'),rb=request(b,'w','practical');
 assert.deepEqual(ra,rb);assert(!ra.game);assert(!JSON.stringify(ra).includes('threats'));
 const aa=analyze(ra),ab=analyze(rb);assert.deepEqual(aa,ab);
 a.turn='b';b.turn='b';assert.deepEqual(request(a,'w','practical'),request(b,'w','practical'));assert.deepEqual(request(a,'w','practical').actions,[]);
});
test('belief replay infers visible actions without reading hidden ability inputs',()=>{
 let g=createGame('nothing','burrow');const frames=[{game:g}];
 g=applyAction(g,'w',{type:'move',from:sq('e2'),to:sq('e4')});frames.push({game:g,by:'w',action:{type:'move',from:sq('e2'),to:sq('e4')}});
 g=applyAction(g,'b',{type:'ability',from:sq('b8')});frames.push({game:g,by:'b',action:{type:'ability',from:sq('b8')}});
 const r=makeRequest(frames,'w','all','practical','easy','analysis',2);
 assert.deepEqual(r.knowledge.observations[2].step.action,{type:'ability'});
 const worlds=inferWorlds(r.knowledge).worlds;assert(worlds.length);assert(worlds.every(g=>g.abilities.b.id==='burrow'));
});
test('AI perspective knows its own card and not the human card',()=>{
 const a=createGame('burrow','gatling'),b=createGame('nothing','gatling');
 a.turn='b';b.turn='b';const ra=request(a,'b','practical'),rb=request(b,'b','practical');assert.deepEqual(ra,rb);assert.equal(ra.knowledge.ownCard,'gatling');
});
test('RPS input hides committed opponent gesture in both information modes',()=>{
 let g=createGame('quickDuel','necro');g=applyAction(g,'w',{type:'ability'});const frames=[{game:createGame('quickDuel','necro')},{game:g,by:'w',action:{type:'ability'}}];
 const a=applyAction(g,'w',{type:'duel',gesture:'rock'}),b=applyAction(g,'w',{type:'duel',gesture:'scissors'});
 for(const mode of ['practical','theory']){const r1=makeRequest([...frames,{game:a,by:'w',action:{type:'duel',gesture:'rock'}}],'b','all',mode,'hard','move',1),r2=makeRequest([...frames,{game:b,by:'w',action:{type:'duel',gesture:'scissors'}}],'b','all',mode,'hard','move',1);assert.deepEqual(r1,r2);assert.equal(analyze(r1).action.type,'duel');}
});
test('choice and reaction phases are controlled by chooser, not ordinary turn',()=>{
 const g=createGame('fiveAhead','necro');assert.equal(actor(g),'b');assert.equal(legalActions(g,'w').length,0);assert.equal(legalActions(g,'b').length,2);
 const r=analyze(request(g,'b'));assert.equal(applyAction(g,'b',r.action).result.winner,'b');
});
test('probability estimates sum to 100, terminal outcomes are exact, unknown states refuse certainty',()=>{
 for(const n of [-10000,-20,-1,0,1,20,10000]){const p=winEstimate(n);assert.equal(p.w+p.draw+p.b,100);assert(Object.values(p).every(v=>v>=0&&v<=100));}
 const g=applyAction(createGame(),'b',{type:'resign'});assert.equal(evaluate(g),10000);assert.deepEqual(analyze(request(g)).wdl,{w:100,draw:0,b:0});
 const r=request(createGame(),'w','practical');r.knowledge.observations[0].position.board.fill(null);assert.equal(analyze(r).unavailable,true);
});

test('unknown choice identities do not create an impossible draw probability',()=>{
 const g=createGame('necro','fiveAhead');const r=analyze(request(g,'w','practical'));assert.equal(r.wdl.draw,0);assert.equal(r.wdl.w,50);assert.equal(r.wdl.b,50);
});

test('practical opponent activates a free ability and then completes its ordinary move',()=>{
 for(const id of ['wildHorse','armyForward']){
  let g=createGame('necro',id);const frames=[{game:g}];
  const move={type:'move',from:sq('e2'),to:sq('e4')};g=applyAction(g,'w',move);frames.push({game:g,by:'w',action:move});
  const decide=()=>analyze(makeRequest(frames,'b','all','practical','normal','move',1));
  const ability=decide().action;assert.equal(ability?.type,'ability',id);
  g=applyAction(g,'b',ability);assert.equal(g.turn,'b',id);frames.push({game:g,by:'b',action:ability});
  let moved=false;
  for(let i=0;i<6&&g.turn==='b';i++){
   const follow=decide().action;assert(follow,id);moved ||= follow.type==='move';
   g=applyAction(g,'b',follow);frames.push({game:g,by:'b',action:follow});
  }
  assert(moved,id);assert.equal(g.turn,'w',id);
 }
});

test('AI uses offensive, revival and double-move abilities when their follow-up is stronger',()=>{
 const g=pos('necro','wildHorse',{a1:'wk',h8:'bk',b8:'bn',e6:'wq'});g.turn='b';
 for(const difficulty of ['easy','normal','hard']){
  const r=analyze({...request(g,'b'),difficulty});assert.equal(r.action?.type,'ability',difficulty);
  const after=applyAction(g,'b',r.action);const follow=analyze({...request(after,'b'),difficulty});
  assert.equal(follow.action?.to,sq('e6'),difficulty);
 }
 const shot=pos('necro','gatling',{a1:'wk',h8:'bk',d5:'bq',d3:'wq',c3:'wr',e3:'wr'});shot.turn='b';shot.abilities.b.ammo=8;
 assert.equal(analyze(request(shot,'b')).action?.mode,'burst');
 const revive=pos('necro','necro');revive.turn='b';revive.captured.b=[{id:'dead',color:'w',kind:'q',moved:true}];
 const revival=analyze(request(revive,'b'));
 assert(revival.line.some(s=>s.side==='b'&&s.action.type==='ability'&&s.action.capture===0),'AI revives the queen immediately or after improving its placement');
 const twice=pos('necro','doubleMove',{a1:'wk',h8:'bk',d8:'br',d6:'wq',f6:'wq'});twice.turn='b';
 const first=analyze(request(twice,'b')).action;assert.equal(first?.type,'ability');
 const active=applyAction(twice,'b',first);const next=analyze(request(active,'b')).action;
 assert.equal(next?.to,sq('d6'));assert.equal(applyAction(active,'b',next).turn,'b');
});

test('AI prefers an immediate king capture to spending an ability',()=>{
 const g=pos('necro','kingReturn',{a1:'wk',h8:'bk',a8:'br'});g.turn='b';
 const r=analyze(request(g,'b'));assert.equal(r.action?.type,'move');assert.equal(applyAction(g,'b',r.action).result?.winner,'b');
});


test('AI avoids an immediate royal loss while a material grab is available',()=>{
 const g=pos('nothing','nothing',{e1:'wk',a1:'wr',e8:'br',h8:'bk',a7:'bq'});
 const r=analyze(request(g));assert(r.action);
 const after=applyAction(g,'w',r.action);
 if(actor(after)==='b')assert(!legalActions(after,'b').some(a=>applyAction(after,'b',a).result?.winner==='b'));
});

test('AI sees a hidden victory on an extra card and evaluates compound movement',()=>{
 const g=pos('nothing','necro',{a1:'wk',h8:'bk',b4:'wr',e4:'wn'});
 g.extraAbilities.w=[{...createGame('equality','necro').abilities.w,castleCount:6}];
 const r=analyze(request(g));assert.equal(r.action.card,'equality');assert.equal(applyAction(g,'w',r.action).result.winner,'w');
 const plain=pos('nothing','necro',{a1:'wk',h8:'bk',d4:'wr'}),fused=structuredClone(plain);
 fused.board[sq('d4')].form='prince';fused.extraAbilities.w=[{...createGame('wildHorse','necro').abilities.w,active:true}];
 assert(evaluate(fused)>evaluate(plain)+3);
});

test('forward pawn free activation is followed by a winning capture',()=>{
 const g=pos('forwardPawns','nothing',{a1:'wk',e3:'bk',e2:'wp'});
 const r=analyze(request(g));assert.equal(r.action.card,'forwardPawns');
 const after=applyAction(g,'w',r.action),next=analyze(request(after));
 assert.equal(applyAction(after,'w',next.action).result.winner,'w');
});

test('AI turns a losing board into a fair duel and keeps opponent gesture private',()=>{
 const g=pos('quickDuel','nothing',{a1:'wk',h8:'bk',b3:'bq',h1:'br'});
 const r=analyze(request(g));assert.equal(r.action.card,'quickDuel');
});

test('repeated positions are discouraged without penalizing ability progress',()=>{
 const g=pos('equality','nothing',{a1:'wk',h8:'bk',b4:'wr',e4:'wn'}),repeat=structuredClone(g);
 const {undo,revision,...before}=structuredClone(g);
 repeat.undo=[{by:'b',move:{from:0,to:1},before}];
 assert(evaluate(repeat)>evaluate(g),'discourage the black move that returned to this position');
 repeat.abilities.w.castleCount=1;
 const progress=structuredClone(repeat);progress.undo=[];
 assert.equal(evaluate(repeat),evaluate(progress));
});
