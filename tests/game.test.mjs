import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,movesFor,indexOf as sq,abilityError,abilityTargets,publicGame,drawCards} from '../lib/game.ts';
const step=(g,from,to,promotion)=>applyAction(g,g.turn,{type:'move',from:sq(from),to:sq(to),promotion});
function pos(w='necro',b='necro',pieces={e1:'wk',e8:'bk'}){const g=createGame(w,b);g.board.fill(null);g.phase='play';g.pending=null;for(const [s,p] of Object.entries(pieces))g.board[sq(s)]={id:p[0]+s,color:p[0],kind:p[1],moved:false};return g;}
test('standard opening, rejected turns and invalid moves leave source unchanged',()=>{
 const g=createGame();assert.equal(g.board.filter(Boolean).length,32);assert.equal(g.board.flatMap((p,i)=>p?.color==='w'?movesFor(g,i):[]).length,20);
 assert.throws(()=>applyAction(g,'b',{type:'move',from:sq('e7'),to:sq('e5')}));assert.throws(()=>step(g,'e2','e5'));assert.equal(g.revision,0);
 const h=step(g,'e2','e4');assert.equal(h.turn,'b');assert.equal(h.board[sq('e4')].kind,'p');assert(g.board[sq('e2')]);
});
test('castling moves both pieces, never through an attacked square',()=>{
 let g=pos('necro','necro',{e1:'wk',h1:'wr',e8:'bk'});g=step(g,'e1','g1');assert.equal(g.board[sq('f1')].kind,'r');assert.equal(g.board[sq('g1')].kind,'k');assert.equal(g.board[sq('h1')],null);
 const h=pos('necro','necro',{e1:'wk',h1:'wr',e8:'bk',f8:'br'});assert(!movesFor(h,sq('e1')).some(m=>m.to===sq('g1')));
});
test('en passant removes adjacent pawn and expires after the reply',()=>{
 let g=createGame();for(const [a,b]of[['e2','e4'],['a7','a6'],['e4','e5'],['d7','d5']])g=step(g,a,b);
 const expired=step(step(g,'a2','a3'),'a6','a5');assert(!movesFor(expired,sq('e5')).some(m=>m.special==='ep'));
 g=step(g,'e5','d6');assert.equal(g.board[sq('d5')],null);assert.equal(g.board[sq('d6')].color,'w');assert.equal(g.captured.w.length,1);
});
test('promotion is explicit and may underpromote',()=>{
 const g=pos('necro','necro',{e1:'wk',e8:'bk',a7:'wp'});assert.throws(()=>step(g,'a7','a8'));assert(g.board[sq('a7')]);
 const h=step(g,'a7','a8','n');assert.equal(h.board[sq('a8')].kind,'n');
});
test('capture king wins, further actions are rejected',()=>{
 let g=pos('necro','necro',{e1:'wk',e8:'bk',e7:'wr'});g=step(g,'e7','e8');assert.equal(g.result.winner,'w');assert.throws(()=>applyAction(g,'b',{type:'resign'}));
});
test('wild horse is owner-only, replacement 3×2 jump',()=>{
 let g=pos('wildHorse','necro',{a1:'wk',h8:'bk',d4:'wn',f6:'bn',d5:'wp'});g=applyAction(g,'w',{type:'ability'});
 assert(movesFor(g,sq('d4')).some(m=>m.to===sq('f7')));assert(!movesFor(g,sq('d4')).some(m=>m.to===sq('e6')));
 assert(movesFor(g,sq('f6')).some(m=>m.to===sq('g4')));assert.equal(g.turn,'w');assert.throws(()=>applyAction(g,'w',{type:'ability'}));
});
test('double move keeps the turn twice and forbids royal capture on both moves',()=>{
 let g=pos('doubleMove','necro',{a1:'wk',h8:'bk',h6:'wr'});g=applyAction(g,'w',{type:'ability'});assert.throws(()=>step(g,'h6','h8'));
 g=step(g,'h6','h7');assert.equal(g.turn,'w');assert.equal(g.doubleLeft,1);assert.throws(()=>step(g,'h7','h8'));
 g=step(g,'h7','g7');assert.equal(g.turn,'b');assert.equal(g.doubleLeft,0);
});
test('equality uses inner squares, preserves identities and wins at ten',()=>{
 let g=pos('equality','necro',{a1:'wk',h8:'bk',b4:'wn',e4:'wr'});g.abilities.w.castleCount=9;
 g=applyAction(g,'w',{type:'ability',from:sq('b4'),to:sq('e4')});assert.equal(g.board[sq('d4')].kind,'n');assert.equal(g.board[sq('c4')].kind,'r');assert.equal(g.result.winner,'w');
});
test('necro only revives captured enemy near king, with one-time usage',()=>{
 let g=pos();g.captured.w=[{id:'bn',color:'b',kind:'n',moved:true}];assert.throws(()=>applyAction(g,'w',{type:'ability',capture:0,to:sq('a4')}));
 g=applyAction(g,'w',{type:'ability',capture:0,to:sq('d2')});assert.equal(g.board[sq('d2')].color,'w');assert.equal(g.captured.w.length,0);assert.equal(g.turn,'b');
});
test('space travel only from far corners, capture allowed except royal',()=>{
 let g=pos('spaceTravel','necro',{a1:'wk',e8:'bk',a8:'wr',d4:'bn'});assert.throws(()=>applyAction(g,'w',{type:'ability',from:sq('a8'),to:sq('e8')}));
 g=applyAction(g,'w',{type:'ability',from:sq('a8'),to:sq('d4')});assert.equal(g.board[sq('d4')].kind,'r');assert.equal(g.captured.w[0].kind,'n');assert.equal(g.turn,'b');
});
test('exorcism destroys front three cells including allies and can end in a draw',()=>{
 let g=pos('exorcism','necro',{c5:'wk',e5:'bk',d5:'wr',d4:'wb'});g=applyAction(g,'w',{type:'ability',from:sq('d4')});assert.equal(g.result.winner,'draw');assert(g.board[sq('d4')]);
});
test('king return thresholds, sacrifice, and expiration on king moves only',()=>{
 let g=pos('kingReturn','necro',{a1:'wk',h8:'bk',a2:'wp',d4:'wb'});g=applyAction(g,'w',{type:'ability'});assert.equal(g.abilities.w.power.mode,'bn');assert.equal(g.abilities.w.power.left,15);assert.equal(g.board[sq('d4')],null);
 g=step(g,'a2','a3');assert.equal(g.abilities.w.power.left,15);g=step(g,'h8','h7');g=step(g,'a1','b3');assert.equal(g.abilities.w.power.left,14);
 const over=applyAction(createGame('kingReturn','necro'),'w',{type:'ability'});assert.equal(over.result.winner,'b');
});
test('reactionary requires original unmoved king and rooks; selection retains next turn',()=>{
 let g=pos('reactionary','necro',{e1:'wk',a1:'wr',h1:'wr',e8:'bk',e2:'br'});g.turn='b';g=step(g,'e2','e1');assert.equal(g.phase,'reaction');assert.equal(g.pending.chooser,'w');
 g=applyAction(g,'w',{type:'reaction',piece:sq('a1')});assert.equal(g.phase,'play');assert.equal(g.turn,'w');assert.equal(g.abilities.w.rookId,'wa1');
 let h=pos('reactionary','necro',{e1:'wk',a1:'wr',h1:'wr',e8:'bk',e2:'br'});h.abilities.w.eligible=false;h.turn='b';h=step(h,'e2','e1');assert.equal(h.result.winner,'b');
});
test('reactionary threat count ends at three and follows rook movement',()=>{
 let g=pos('reactionary','necro',{a1:'wr',h8:'bk',a8:'br'});g.abilities.w.active=true;g.abilities.w.rookId='wa1';g.abilities.w.threats=2;g.turn='b';g=step(g,'h8','g8');assert.equal(g.abilities.w.threats,3);assert.equal(g.result.winner,'b');
});
test('bomb triggers once on either side of capture and spares kings',()=>{
 let g=pos('necro','bombLauncher',{c3:'wk',h8:'bk',d3:'wr',d4:'bn',e4:'bp'});g=step(g,'d3','d4');assert.equal(g.board[sq('d4')],null);assert.equal(g.board[sq('e4')],null);assert.equal(g.board[sq('c3')].kind,'k');assert.equal(g.abilities.b.uses,1);
});
test('space travel capture also triggers defending bomb',()=>{
 let g=pos('spaceTravel','bombLauncher',{a1:'wk',h8:'bk',a8:'wr',d4:'bn'});g=applyAction(g,'w',{type:'ability',from:sq('a8'),to:sq('d4')});assert.equal(g.board[sq('d4')],null);assert.equal(g.abilities.b.uses,1);
});
test('no-that-move restores board, bans move and never refunds its uses',()=>{
 let g=createGame('noThatMove','necro');g=step(g,'e2','e4');g=step(g,'e7','e5');g=applyAction(g,'w',{type:'ability'});assert.equal(g.turn,'b');assert.equal(g.abilities.w.uses,1);assert.throws(()=>step(g,'e7','e5'));
 g=step(g,'d7','d5');g=applyAction(g,'w',{type:'ability'});assert.equal(g.abilities.w.uses,2);g=step(g,'c7','c5');assert(abilityError(g,'w'));
});
test('time stone restores own prior move and opponent response; budget survives rewind',()=>{
 let g=createGame('temusanTimeStone','necro');g=step(g,'e2','e4');g=step(g,'e7','e5');g=applyAction(g,'w',{type:'ability'});assert(g.board[sq('e2')]);assert(g.board[sq('e7')]);assert.equal(g.abilities.w.uses,1);
 g=step(g,'d2','d4');g=applyAction(g,'w',{type:'ability'});assert.equal(g.abilities.w.uses,2);assert.equal(g.turn,'w');
});
test('extreme efficiency and versatile only affect their owners',()=>{
 const g=createGame('extremeEfficiency','versatile');assert.equal(g.board.filter(p=>p?.color==='w').length,4);assert.equal(g.board.filter(p=>p?.color==='b').length,16);
 const h=pos('versatile','necro',{a1:'wk',h8:'bk',d4:'wr'});assert(movesFor(h,sq('d4')).some(m=>m.to===sq('f5')));assert(movesFor(h,sq('d4')).some(m=>m.to===sq('g7')));assert(!movesFor(h,sq('d4')).some(m=>m.to===sq('d7')));
});
test('queen rule changes only owner, queen capture ends game even with another queen',()=>{
 let g=pos('queenRule','necro',{a1:'wk',h8:'bk',d4:'wq',a4:'wq',d8:'br'});g=applyAction(g,'w',{type:'ability'});assert(movesFor(g,sq('a1')).some(m=>m.to===sq('f1')));assert(!movesFor(g,sq('d4')).some(m=>m.to===sq('d7')));g.turn='b';g=step(g,'d8','d4');assert.equal(g.result.winner,'b');
});
test('quick duel keeps first choice secret, rejects duplicate picks, resolves 2 wins',()=>{
 let g=applyAction(createGame('quickDuel','necro'),'w',{type:'ability'});g=applyAction(g,'w',{type:'duel',gesture:'rock'});assert.equal(publicGame(g).duel.picks.w,null);assert.equal(publicGame(g).duel.picked.w,true);assert.throws(()=>applyAction(g,'w',{type:'duel',gesture:'paper'}));
 g=applyAction(g,'b',{type:'duel',gesture:'scissors'});assert.equal(g.duel.score.w,1);g=applyAction(g,'b',{type:'duel',gesture:'scissors'});g=applyAction(g,'w',{type:'duel',gesture:'rock'});assert.equal(g.result.winner,'w');
});
test('initial choice cards reverse or preserve chosen winner; only chooser can act',()=>{
 for(const [id,win]of[['fiveAhead','b'],['conscienceTest','w']]){let g=createGame(id,'necro');assert.equal(g.phase,'choice');assert.throws(()=>applyAction(g,'w',{type:'choice',choice:'w'}));g=applyAction(g,'b',{type:'choice',choice:'w'});assert.equal(g.result.winner,win);}
});
test('draw requires opponent agreement, resignation uses actual actor',()=>{
 let g=createGame();g=applyAction(g,'w',{type:'draw'});assert.throws(()=>applyAction(g,'w',{type:'acceptDraw'}));g=applyAction(g,'b',{type:'acceptDraw'});assert.equal(g.result.winner,'draw');
 assert.equal(applyAction(createGame(),'b',{type:'resign'}).result.winner,'w');
});
test('random cards distinct and invalid chosen abilities rejected',()=>{for(let i=0;i<25;i++){const [a,b]=drawCards('classic');assert.notEqual(a,b);}assert.throws(()=>drawCards('classic',{w:'fiveAhead'}));});
