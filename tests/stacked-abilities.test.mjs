import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,indexOf as sq,abilityStates,abilityError,giveMePieceScore,publicGame} from '../lib/game.ts';

const piece=(id,color,kind,extra={})=>({id,color,kind,moved:false,...extra});
const state=id=>structuredClone(createGame(id,'necro').abilities.w);
function drawFromRecapture(deck,black='necro'){
 let g=empty('giveMe',black);
 g.board[sq('a1')]=piece('wr','w','r');g.board[sq('a2')]=piece('bp','b','p');
 g.board[sq('b3')]=piece('bb','b','b');g.board[sq('b1')]=piece('bb2','b','b');
 g.deck=deck;g.giveMe.w.score=2;
 g=applyAction(g,'w',{type:'move',from:sq('a1'),to:sq('a2')});
 return applyAction(g,'b',{type:'move',from:sq('b3'),to:sq('a2')});
}
function empty(w='giveMe',b='necro'){
 const g=createGame(w,b);g.board.fill(null);g.phase='play';g.pending=null;
 g.board[sq('e1')]=piece('wk','w','k');g.board[sq('e8')]=piece('bk','b','k');return g;
}

test('metamon reveals and copies the opponent, and beats both hidden ending cards',()=>{
 const g=createGame('metamon','wildHorse');
 assert.equal(g.abilities.w.id,'wildHorse');assert.equal(g.abilities.w.source,'metamon');assert.equal(g.abilities.b.revealed,true);
 for(const id of ['fiveAhead','conscienceTest']){
  const ended=createGame('metamon',id);assert.equal(ended.result.winner,'w');assert.equal(ended.phase,'over');
 }
});

test('give-me marks only the immediate reply and draws a unique stacked ability per five points',()=>{
 let g=empty();g.board[sq('a1')]=piece('wr','w','r');g.board[sq('a2')]=piece('bp','b','p');g.board[sq('b3')]=piece('bb','b','b');g.deck=['nothing','wildHorse'];
 g=applyAction(g,'w',{type:'move',from:sq('a1'),to:sq('a2')});
 assert.deepEqual(g.giveMe.w.mark,{pieceId:'wr',reply:'b'});
 g=applyAction(g,'b',{type:'move',from:sq('b3'),to:sq('a2')});
 assert.equal(g.giveMe.w.score,0);assert.deepEqual(abilityStates(g,'w').map(a=>a.id),['giveMe','nothing']);

 let expired=empty();expired.board[sq('a1')]=piece('wr','w','r');expired.board[sq('a2')]=piece('bp','b','p');expired.board[sq('b2')]=piece('bb','b','b');expired.deck=['nothing'];
 expired=applyAction(expired,'w',{type:'move',from:sq('a1'),to:sq('a2')});
 expired=applyAction(expired,'b',{type:'move',from:sq('b2'),to:sq('c1')});
 assert.equal(expired.giveMe.w.mark,null);assert.equal(expired.giveMe.w.score,0);
});

test('internal give-me score covers promoted and transformed pieces without exposing it in the card',()=>{
 const g=createGame('giveMe','necro');
 assert.equal(giveMePieceScore(g,piece('p','w','p')),1);
 assert.equal(giveMePieceScore(g,piece('q','w','q',{promoted:true})),10);
 g.extraAbilities.w.push(state('versatile'));assert.equal(giveMePieceScore(g,piece('r','w','r',{promoted:true})),7);
 const wild=state('wildHorse');wild.active=true;g.extraAbilities.w.push(wild);assert.equal(giveMePieceScore(g,piece('n','w','n',{wildMoved:true,promoted:true})),6);
 const reaction=state('reactionary');reaction.active=true;reaction.rookId='rr';g.extraAbilities.w.push(reaction);assert.equal(giveMePieceScore(g,piece('rr','w','r',{promoted:true})),24);
 const general=state('general');general.general={id:'gp',kills:4,knightId:'fn'};g.extraAbilities.w.push(general);
 assert.equal(giveMePieceScore(g,piece('gp','w','p',{promoted:true})),21);assert.equal(giveMePieceScore(g,piece('fn','w','n')),0);
});

test('two ending cards in one reward win immediately, while a single choice card starts its flow',()=>{
 const setup=deck=>{let g=empty();g.board[sq('e1')]=null;g.board[sq('e2')]=piece('wk','w','k');g.board[sq('e3')]=piece('bp','b','p');g.board[sq('e4')]=piece('br','b','r');g.deck=deck;return g;};
 let g=setup(['quickDuel','fiveAhead','nothing']);g=applyAction(g,'w',{type:'move',from:sq('e2'),to:sq('e3')});g=applyAction(g,'b',{type:'move',from:sq('e4'),to:sq('e3')});
 assert.equal(g.result.winner,'w');assert.match(g.result.reason,/동시에/);
 let one=setup(['fiveAhead','nothing','wildHorse']);one=applyAction(one,'w',{type:'move',from:sq('e2'),to:sq('e3')});one=applyAction(one,'b',{type:'move',from:sq('e4'),to:sq('e3')});
 assert.equal(one.phase,'choice');assert.equal(one.pending.chooser,'b');assert.equal(one.result,null);
});

test('king death is resolved after reward cards can change the royal system',()=>{
 const setup=deck=>{let g=empty();g.board[sq('e1')]=null;g.board[sq('e2')]=piece('wk','w','k');g.board[sq('d1')]=piece('wq','w','q');g.board[sq('a1')]=piece('wa1','w','r');g.board[sq('h1')]=piece('wh1','w','r');g.board[sq('e3')]=piece('bp','b','p');g.board[sq('e4')]=piece('br','b','r');g.deck=deck;return g;};
 let queen=setup(['queenRule','nothing','wildHorse']);queen=applyAction(queen,'w',{type:'move',from:sq('e2'),to:sq('e3')});queen=applyAction(queen,'b',{type:'move',from:sq('e4'),to:sq('e3')});
 assert.equal(queen.result,null);assert.equal(abilityStates(queen,'w').find(a=>a.id==='queenRule').active,true);
 let reaction=setup(['reactionary','nothing','wildHorse']);reaction=applyAction(reaction,'w',{type:'move',from:sq('e2'),to:sq('e3')});reaction=applyAction(reaction,'b',{type:'move',from:sq('e4'),to:sq('e3')});
 assert.equal(reaction.phase,'reaction');assert.deepEqual(reaction.pending.options,[sq('a1'),sq('h1')]);
});

test('online view sends question cards for unrevealed extras and reveals a used one',()=>{
 const g=createGame('giveMe','necro');const extra=state('nothing');g.extraAbilities.w.push(extra);
 assert.equal(publicGame(g,'b').extraAbilities.w[0].id,'hidden');
 const used=applyAction(g,'w',{type:'ability',card:'nothing'});
 assert.equal(publicGame(used,'b').extraAbilities.w[0].id,'nothing');
 assert.equal(publicGame(used,'b').deck,undefined);
});

test('newly drawn no-that-move survives its own rewind without returning to the deck or refunding uses',()=>{
 const drawn=drawFromRecapture(['noThatMove','nothing','wildHorse']);
 let g=applyAction(drawn,'w',{type:'ability',card:'noThatMove'});
 assert.deepEqual(abilityStates(g,'w').map(a=>a.id),['giveMe','noThatMove']);
 assert.equal(g.extraAbilities.w[0].uses,1);assert.equal(g.abilities.w.uses,0);
 assert.equal(g.giveMe.w.score,2);assert.deepEqual(g.deck,['nothing','wildHorse']);
 assert.equal(g.board[sq('a2')].id,'wr');assert.equal(g.board[sq('b3')].id,'bb');assert.equal(g.turn,'b');
 assert.throws(()=>applyAction(g,'b',{type:'move',from:sq('b3'),to:sq('a2')}));
 assert.equal(publicGame(g,'b').extraAbilities.w[0].id,'noThatMove');
 assert.equal(drawn.extraAbilities.w[0].uses,0);
 // A different legal recapture draws the next card, never the rewind card again.
 g=applyAction(g,'b',{type:'move',from:sq('b1'),to:sq('a2')});
 assert.deepEqual(abilityStates(g,'w').map(a=>a.id),['giveMe','noThatMove','nothing']);
 g=applyAction(g,'w',{type:'ability',card:'noThatMove'});
 assert.equal(g.extraAbilities.w[0].uses,2);assert.equal(g.giveMe.w.score,2);
 assert.deepEqual(g.deck,['wildHorse']);assert.match(abilityError(g,'w','noThatMove'),/모두 사용/);
});

test('newly drawn time stone keeps acquired cards, score, and deck across a two-move rewind',()=>{
 let g=drawFromRecapture(['temusanTimeStone','nothing']);
 g=applyAction(g,'w',{type:'ability',card:'temusanTimeStone'});
 assert.equal(g.board[sq('a1')].id,'wr');assert.equal(g.board[sq('a2')].id,'bp');assert.equal(g.board[sq('b3')].id,'bb');
 assert.equal(g.turn,'w');assert.equal(g.extraAbilities.w[0].id,'temusanTimeStone');
 assert.equal(g.extraAbilities.w[0].uses,1);assert.equal(g.giveMe.w.score,2);assert.deepEqual(g.deck,['nothing']);
});

test('a drawn Metamon copying no-that-move keeps its card origin and independent usage after rewind',()=>{
 let g=drawFromRecapture(['metamon','nothing'],'noThatMove');
 g=applyAction(g,'w',{type:'ability',card:'noThatMove'});
 assert.equal(g.extraAbilities.w[0].id,'noThatMove');assert.equal(g.extraAbilities.w[0].source,'metamon');
 assert.equal(g.extraAbilities.w[0].uses,1);assert.equal(g.abilities.b.uses,0);assert.deepEqual(g.deck,['nothing']);
 assert.equal(publicGame(g,'b').extraAbilities.w[0].id,'noThatMove');
});
