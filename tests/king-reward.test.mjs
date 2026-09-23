import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,indexOf as sq,abilityStates,publicGame,abilityError} from '../lib/game.ts';
import {legalActions,makeRequest,analyze} from '../lib/practice-ai.ts';
const piece=(id,color,kind)=>({id,color,kind,moved:false});
function setup(deck){
 const g=createGame('giveMe','necro','all',false);g.board.fill(null);
 for(const [at,id,color,kind] of [['e1','we1','w','k'],['d1','wq','w','q'],['a1','wa1','w','r'],['h1','wh1','w','r'],['e8','bk','b','k'],['e4','br','b','r']])g.board[sq(at)]=piece(id,color,kind);
 g.turn='b';g.deck=deck;return g;
}
const capture=g=>applyAction(g,'b',{type:'move',from:sq('e4'),to:sq('e1')});
test('an unmarked king draws all fifteen points before royal-system rescue',()=>{
 for(const card of ['queenRule','reactionary']){
  const g=capture(setup([card,'nothing','wildHorse']));
  assert.equal(g.result,null);assert.equal(g.kingRewards,undefined);
  assert.deepEqual(abilityStates(g,'w').map(a=>a.id),['giveMe',card,'nothing','wildHorse']);
  assert.equal(g.giveMe.w.score,0);assert.equal(g.deck.length,0);
  if(card==='queenRule')assert(g.extraAbilities.w[0].active);
  else {assert.equal(g.phase,'reaction');const after=applyAction(g,'w',{type:'reaction',piece:sq('a1')});assert.equal(after.result,null);}
 }
});
test('a marked king is rewarded once and a regular unmarked piece receives nothing',()=>{
 const g=setup(['queenRule','nothing','wildHorse','versatile']);g.giveMe.w.mark={pieceId:'we1',reply:'b'};
 const after=capture(g);assert.equal(after.extraAbilities.w.length,3);assert.deepEqual(after.deck,['versatile']);
 const ordinary=setup(['queenRule']);ordinary.board[sq('e1')]=piece('wn','w','n');ordinary.board[sq('f1')]=piece('wk','w','k');
 const next=capture(ordinary);assert.equal(next.extraAbilities.w.length,0);assert.equal(next.giveMe.w.score,0);
});
test('new rewind can rescue a king while retaining cards and turn restrictions',()=>{
 const g=capture(setup(['noThatMove','nothing','wildHorse']));
 assert.equal(g.phase,'rescue');assert.equal(g.result,null);assert.equal(abilityError(g,'w','noThatMove'),null);
 assert.throws(()=>applyAction(g,'b',{type:'acceptDefeat'}));
 assert.throws(()=>applyAction(g,'w',{type:'move',from:sq('a1'),to:sq('a2')}));
 assert.throws(()=>applyAction(g,'w',{type:'ability',card:'nothing'}));
 const after=applyAction(g,'w',{type:'ability',card:'noThatMove'});
 assert.equal(after.phase,'play');assert.equal(after.result,null);assert.equal(after.board[sq('e1')].id,'we1');
 assert.equal(after.board[sq('e4')].id,'br');assert.equal(after.extraAbilities.w.length,3);assert.equal(after.extraAbilities.w[0].uses,1);
 assert.equal(after.deck.length,0);assert.equal(after.turn,'b');assert.throws(()=>capture(after));
 const declined=applyAction(g,'w',{type:'acceptDefeat'});assert.equal(declined.result.winner,'b');
});
test('a newly drawn duel starts before royal defeat and finishes by duel rules',()=>{
 let g=capture(setup(['quickDuel','nothing','wildHorse']));assert.equal(g.phase,'rescue');
 g=applyAction(g,'w',{type:'ability',card:'quickDuel'});assert.equal(g.phase,'duel');assert.equal(g.result,null);
 for(let i=0;i<2;i++){g=applyAction(g,'w',{type:'duel',gesture:'rock'});g=applyAction(g,'b',{type:'duel',gesture:'scissors'});}
 assert.equal(g.result.winner,'w');
});
test('rebuilt starting position is applied after the capturing piece lands',()=>{
 const g=capture(setup(['extremeEfficiency','nothing','wildHorse']));
 assert.equal(g.result,null);assert.equal(g.board[sq('e1')].color,'w');assert.equal(g.board[sq('e1')].kind,'k');
 assert.equal(g.board.filter(p=>p?.color==='w'&&p.kind==='q').length,3);
});
test('king draws still resolve simultaneous ending cards, a choice, or an unavoidable defeat',()=>{
 const win=capture(setup(['quickDuel','fiveAhead','nothing']));assert.equal(win.result.winner,'w');
 const choose=capture(setup(['conscienceTest','nothing','wildHorse']));assert.equal(choose.phase,'choice');assert.equal(choose.result,null);
 const lost=capture(setup(['nothing','wildHorse','spaceTravel']));assert.equal(lost.result.winner,'b');assert.equal(lost.extraAbilities.w.length,3);
 const short=capture(setup(['nothing']));assert.equal(short.result.winner,'b');assert.equal(short.giveMe.w.score,10);
});
test('private rescue cards are visible to their owner only; both AI modes can use rescue',()=>{
 const before=setup(['noThatMove','nothing','wildHorse']),g=capture(before);
 const own=publicGame(g,'w'),opponent=publicGame(g,'b');
 assert.deepEqual(own.deathRescues.w,['noThatMove']);assert.equal(opponent.deathRescues.w,undefined);
 assert.equal(opponent.extraAbilities.w[0].id,'hidden');assert.equal(opponent.kingRewards,undefined);
 assert(legalActions(g,'w').some(a=>a.card==='noThatMove'));assert.equal(legalActions(g,'b').length,0);
 for(const mode of ['theory','practical']){
  const req=makeRequest([{game:before},{game:g,by:'b',action:{type:'move',from:sq('e4'),to:sq('e1')}}],'w','all',mode,'normal','move',1);
  const r=analyze(req);assert.equal(r.action.card,'noThatMove');
  if(mode==='practical'){assert.equal(req.game,undefined);assert.equal(req.knowledge,undefined);assert.equal(r.wdl,null);}
 }
});

test('time stone restores a pre-death turn and ability captures cannot use move-only rescue',()=>{
 let g=setup(['temusanTimeStone','nothing','wildHorse']);g.turn='w';g.board[sq('a2')]=piece('wp','w','p');
 g=applyAction(g,'w',{type:'move',from:sq('a2'),to:sq('a3')});g=capture(g);
 assert.equal(g.phase,'rescue');g=applyAction(g,'w',{type:'ability',card:'temusanTimeStone'});
 assert.equal(g.board[sq('e1')].kind,'k');assert.equal(g.board[sq('a2')].kind,'p');assert.equal(g.result,null);
 let blast=setup(['noThatMove','quickDuel','nothing']);blast.abilities.b=createGame('necro','exorcism').abilities.b;
 blast.board[sq('e2')]=piece('bb','b','b');blast=applyAction(blast,'b',{type:'ability',card:'exorcism',from:sq('e2')});
 assert.equal(blast.phase,'rescue');assert.deepEqual(blast.deathRescues.w,['quickDuel']);
});

test('a transformed king uses its configured reward and still draws the full batch',()=>{
 let g=createGame('necro','giveMe','all',false);g.board.fill(null);
 g.board[sq('a1')]=piece('wk','w','k');g.board[sq('e4')]=piece('wr','w','r');
 g.board[sq('e8')]={...piece('bk','b','k'),form:'emperor'};
 g.deck=['quickDuel','fiveAhead','nothing','wildHorse','burrow'];
 g=applyAction(g,'w',{type:'move',from:sq('e4'),to:sq('e8')});
 assert.equal(g.result.winner,'b');assert.equal(g.extraAbilities.b.length,4);assert.deepEqual(g.deck,['burrow']);
});

test('declining rescue preserves a captured royal queen even if another queen survives',()=>{
 let g=setup(['quickDuel','nothing','wildHorse']);
 const queen=createGame('queenRule','necro').abilities.w;queen.active=true;queen.uses=1;g.extraAbilities.w.push(queen);
 g.abilities.b=createGame('necro','exorcism').abilities.b;g.board[sq('d2')]=piece('bb','b','b');g.board[sq('h3')]=piece('wq2','w','q');
 g=applyAction(g,'b',{type:'ability',card:'exorcism',from:sq('d2')});
 assert.equal(g.phase,'rescue');assert(g.board[sq('h3')]);
 g=applyAction(g,'w',{type:'acceptDefeat'});assert.equal(g.result.winner,'b');
});
