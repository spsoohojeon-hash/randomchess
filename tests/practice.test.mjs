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
