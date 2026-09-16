import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,movesFor,indexOf as sq,abilityError,abilityTargets,publicGame,generalAssignment,CARDS,threatened} from '../lib/game.ts';

function pos(w,b='necro',pieces={a1:'wk',h8:'bk'}){
 const g=createGame(w,b);g.board.fill(null);g.phase='play';g.pending=null;
 for(const [at,p] of Object.entries(pieces))g.board[sq(at)]={id:p[0]+at,color:p[0],kind:p[1],moved:false};
 return g;
}
const move=(g,from,to,promotion)=>applyAction(g,g.turn,{type:'move',from:sq(from),to:sq(to),promotion});
const use=(g,side,from,to,extra={})=>applyAction(g,side,{type:'ability',...(from?{from:sq(from)}:{}),...(to?{to:sq(to)}:{}),...extra});
const goes=(g,from,to)=>movesFor(g,sq(from)).some(m=>m.to===sq(to));

test('all 26 cards have distinct ids; old saved games need no new fields',()=>{
 assert.equal(CARDS.length,26);assert.equal(new Set(CARDS.map(c=>c.id)).size,26);
 const old=createGame();delete old.glow;delete old.extraMove;
 assert.equal(move(old,'e2','e4').turn,'b');
});

test('burrow is free on either turn, invulnerable and immobile, occupied exit rejected',()=>{
 let g=pos('burrow','necro',{a1:'wk',h8:'bk',d4:'wn',d8:'br'});g.turn='b';
 assert.throws(()=>use(g,'w','a1'));
 g=use(g,'w','d4');assert.equal(g.turn,'b');assert.equal(g.ply,0);assert.equal(g.board[sq('d4')],null);
 assert.deepEqual(movesFor(g,sq('d4')),[]);assert.equal(g.abilities.w.burrow.piece.id,'wd4');
 const enemy=publicGame(g,'b');assert(!JSON.stringify(enemy).includes('burrow'));assert.equal(enemy.log.at(-1).from,undefined);
 assert.equal(publicGame(g,'w').abilities.w.burrow.at,sq('d4'));
 g=move(g,'d8','d4');assert.equal(g.abilities.w.burrow.piece.kind,'n');assert.equal(g.captured.b.length,0);
 assert.throws(()=>use(g,'w'));assert.match(abilityError(g,'w'),/나올 수 없/);
 g=move(g,'a1','b1');g=move(g,'d4','d5');g=use(g,'w');
 assert.equal(g.board[sq('d4')].kind,'n');assert.equal(g.abilities.w.uses,1);assert.equal(g.turn,'w');
 assert.throws(()=>use(g,'w','d4'));
});

test('jump crosses any number of enemies, never allies or occupied landing; three-use limit',()=>{
 let g=pos('shiningKnight','necro',{a1:'wk',h8:'bk',d2:'wp',d3:'bn',d5:'br',f4:'wp',e3:'bb'});
 assert(abilityTargets(g,'w',sq('d2')).includes(sq('d6')));
 assert(!abilityTargets(g,'w',sq('d2')).includes(sq('d5')));
 assert(!abilityTargets(g,'w',sq('d2')).includes(sq('g5')));
 g=use(g,'w','d2','d6');assert.equal(g.board[sq('d3')].kind,'n');assert.equal(g.turn,'b');assert.equal(g.ply,1);
 assert.throws(()=>use(g,'w','d6','d2'));
 g.turn='w';g.abilities.w.uses=3;assert.throws(()=>use(g,'w','d6','d2'));
 let h=pos('shiningKnight','necro',{a1:'wk',h8:'bk',d6:'wp',d7:'bp'});
 h=use(h,'w','d6','d8',{promotion:'n'});assert.equal(h.board[sq('d8')].kind,'n');
});

test('forward pawns activate free and persist, with forward capture and no diagonal or en passant',()=>{
 let g=pos('forwardPawns','necro',{a1:'wk',h8:'bk',d4:'wp',d5:'bp',c5:'bn',e4:'bp'});
 g.ep={target:sq('e5'),pawn:sq('e4'),for:'w'};g=use(g,'w');
 assert.equal(g.ply,0);assert(goes(g,'d4','d5'));assert(!goes(g,'d4','c5'));assert(!goes(g,'d4','e5'));
 assert.deepEqual(threatened(g,'b'),[]);g=move(g,'d4','d5');assert.equal(g.captured.w[0].kind,'p');assert(g.abilities.w.active);
});

test('activated forward pawns capture two squares from their initial rank for either color',()=>{
 for(const [side,enemy,from,to] of [['w','b','d2','d4'],['b','w','d7','d5']]){
  let g=pos('forwardPawns','forwardPawns',{a1:'wk',h8:'bk',[from]:side+'p',[to]:enemy+'r'});g.turn=side;
  assert(!goes(g,from,to));g=use(g,side);assert(goes(g,from,to));
  const after=move(g,from,to);assert.equal(after.board[sq(from)],null);assert.equal(after.board[sq(to)].color,side);
  assert.equal(after.captured[side][0].kind,'r');assert.equal(after.turn,enemy);assert.equal(after.ply,1);
 }
});

test('two-square forward capture respects blockers, allied targets, moved state and home rank',()=>{
 const setup=()=>use(pos('forwardPawns','necro',{a1:'wk',h8:'bk',d2:'wp',d4:'br'}),'w');
 for(const color of ['w','b']){
  const g=setup();g.board[sq('d3')]={id:'block',color,kind:'p',moved:false};
  assert(!goes(g,'d2','d4'));assert.throws(()=>move(g,'d2','d4'));
 }
 const ally=setup();ally.board[sq('d4')].color='w';assert(!goes(ally,'d2','d4'));
 const moved=setup();moved.board[sq('d2')].moved=true;assert(!goes(moved,'d2','d4'));
 const offRank=use(pos('forwardPawns','necro',{a1:'wk',h8:'bk',d3:'wp',d5:'br'}),'w');assert(!goes(offRank,'d3','d5'));
 const empty=setup();empty.board[sq('d4')]=null;assert(goes(empty,'d2','d4'));
});

test('two-square forward royal capture is reflected in threat detection and still obeys double-move restrictions',()=>{
 let g=use(pos('forwardPawns','necro',{a1:'wk',d2:'wp',d4:'bk'}),'w');
 assert.deepEqual(threatened(g,'b'),[sq('d4')]);assert.equal(move(g,'d2','d4').result.winner,'w');
 g.doubleLeft=2;assert(!goes(g,'d2','d4'));assert.throws(()=>move(g,'d2','d4'));
});

test('nothing adds only a public rainbow effect, no move or turn changes',()=>{
 const g=createGame('nothing','necro'),before=movesFor(g,sq('b1'));g.turn='b';
 const h=use(g,'w');assert.deepEqual(h.board,g.board);assert.equal(h.ply,0);assert.equal(h.turn,'b');assert.deepEqual(movesFor(h,sq('b1')),before);
 assert.deepEqual(publicGame(h,'b').glow,['w']);assert.equal(publicGame(h,'b').abilities.w.id,'hidden');assert.throws(()=>use(h,'w'));
});

test('army advance is simultaneous and free initially, second costs two selected rooks and a turn',()=>{
 let g=pos('armyForward','necro',{a1:'wk',h8:'bk',a2:'wp',a3:'wp',c2:'wp',c3:'bn',e7:'wp',b1:'wr',g1:'wr',h1:'wr'});
 g=use(g,'w');assert.equal(g.turn,'w');assert.equal(g.ply,0);assert(g.board[sq('a2')]);assert(g.board[sq('a4')]);assert(g.board[sq('c2')]);assert.equal(g.board[sq('e8')].kind,'q');
 assert.throws(()=>use(g,'w','b1','b1'));
 g=use(g,'w','b1','g1');assert.equal(g.board[sq('b1')],null);assert.equal(g.board[sq('g1')],null);assert(g.board[sq('h1')]);assert(g.board[sq('a3')]);assert(g.board[sq('a5')]);assert.equal(g.turn,'b');assert.equal(g.ply,1);
 assert.throws(()=>use(g,'w'));
});

test('general first capture designates an existing knight and allows just one follower move',()=>{
 let g=pos('general','necro',{a1:'wk',h8:'bk',d4:'wp',e5:'bp',b1:'wn',c3:'bp',c1:'wb'});
 g=move(g,'d4','e5');assert.equal(g.abilities.w.general.kills,1);assert.equal(g.turn,'w');assert.equal(g.extraMove.kind,'general');
 assert.equal(generalAssignment(g,'w'),'n');assert.throws(()=>move(g,'a1','a2'));
 const count=g.board.filter(Boolean).length;g=use(g,'w','b1');assert.equal(g.board.filter(Boolean).length,count);assert.equal(g.abilities.w.general.knightId,'wb1');
 assert.throws(()=>move(g,'e5','e6'));g=move(g,'b1','c3');assert.equal(g.turn,'b');assert.equal(g.extraMove,undefined);assert.equal(g.abilities.w.general.kills,2);assert(goes(g,'e5','d5'));
});

test('general third capture appoints bishop, fourth unlocks position swap without bonus move',()=>{
 let g=pos('general','necro',{a1:'wk',h8:'bk',d4:'wp',e5:'bp',b1:'wn',c1:'wb'});
 g.abilities.w.general={id:'wd4',kills:2,knightId:'wb1'};
 g=move(g,'d4','e5');assert.equal(g.abilities.w.general.kills,3);assert.equal(generalAssignment(g,'w'),'b');
 g=use(g,'w','c1');assert.equal(g.abilities.w.general.bishopId,'wc1');assert(goes(g,'b1','c3'));assert(goes(g,'c1','d2'));
 g=move(g,'c1','d2');assert.equal(g.turn,'b');assert.equal(g.extraMove,undefined);
 g.turn='w';g.abilities.w.general.kills=4;g=use(g,'w','e5','b1');assert.equal(g.board[sq('b1')].id,'wd4');assert.equal(g.board[sq('e5')].id,'wb1');assert.equal(g.turn,'b');assert.equal(g.extraMove,undefined);
});

test('general bonus can be skipped; unavailable or dead followers never lock the turn',()=>{
 let g=pos('general','necro',{a1:'wk',h8:'bk',d4:'wp',e5:'bp',b1:'wn'});g=move(g,'d4','e5');g=applyAction(g,'w',{type:'skipExtra'});assert.equal(g.turn,'b');assert.equal(g.extraMove,undefined);
 let h=pos('general','necro',{a1:'wk',h8:'bk',d4:'wp',e5:'bp'});h=move(h,'d4','e5');assert.equal(h.turn,'b');
});

test('gatling charges from queen pawn captures only; allied non-pawns cannot be taken',()=>{
 let g=pos('gatling','necro',{a1:'wk',h8:'bk',d4:'wq',d5:'wp',f4:'wr',c4:'bp'});
 assert(goes(g,'d4','d5'));assert(!goes(g,'d4','f4'));g=move(g,'d4','d5');assert.equal(g.abilities.w.ammo,1);assert.equal(g.captured.w.length,0);
 g.turn='w';g=move(g,'d5','c4');assert.equal(g.abilities.w.ammo,2);
 assert.equal(publicGame(g,'b').abilities.w.ammo,undefined);
});

test('gatling normal shot costs one round, stops at first piece, and never teamkills',()=>{
 let g=pos('gatling','necro',{a1:'wk',h8:'bk',d4:'wq',d6:'bp',d7:'br',f4:'wp',g4:'bn'});g.abilities.w.ammo=2;
 assert(!abilityTargets(g,'w',sq('d4')).includes(sq('d7')));assert(!abilityTargets(g,'w',sq('d4')).includes(sq('g4')));
 assert.throws(()=>use(g,'w','d4','f4'));g=use(g,'w','d4','d6');assert.equal(g.board[sq('d6')],null);assert(g.board[sq('d7')]);assert(g.board[sq('f4')]);assert.equal(g.board[sq('d4')].kind,'q');assert.equal(g.abilities.w.ammo,1);assert.equal(g.turn,'b');
});

test('full gatling burst uses fixed eight rays and 3x3 impact areas, spares allies, deduplicates victims',()=>{
 let g=pos('gatling','necro',{a1:'wk',h7:'bk',d4:'wq',d6:'bp',c6:'bn',d7:'br',d8:'bq',f4:'bb',g5:'br',e6:'wp',b4:'wp',a4:'br'});g.abilities.w.ammo=8;
 g=use(g,'w','d4',undefined,{mode:'burst'});
 for(const at of ['d6','c6','d7','f4','g5'])assert.equal(g.board[sq(at)],null,at);
 for(const at of ['d8','e6','b4','a4','d4'])assert(g.board[sq(at)],at);
 assert.equal(g.captured.w.length,5);assert.equal(g.abilities.w.ammo,0);assert.equal(g.turn,'b');
});

test('shall not pass clears the whole file, keeps own bishop/allies and enemy king, one use',()=>{
 let g=pos('shallNotPass','necro',{a1:'wk',d8:'bk',d4:'wb',d5:'wp',d6:'br',d2:'bn',e4:'bp'});
 g=use(g,'w','d4');for(const at of ['d6','d2'])assert.equal(g.board[sq(at)],null);for(const at of ['d8','d4','d5','e4'])assert(g.board[sq(at)]);
 assert.equal(g.turn,'b');assert.equal(g.result,null);g.turn='w';assert.throws(()=>use(g,'w','d4'));
});

test('white fusion takes target square, combines knight/rook moves, stays permanent and free',()=>{
 let g=pos('mounted','necro',{a1:'wk',h8:'bk',b1:'wn',d4:'wr',d5:'wp'});g.turn='b';g=use(g,'w','b1','d4');
 assert.equal(g.board[sq('b1')],null);assert.equal(g.board[sq('d4')].form,'prince');assert.equal(g.turn,'b');assert.equal(g.ply,0);
 assert(goes(g,'d4','f5'));assert(goes(g,'d4','g4'));assert(!goes(g,'d4','d6'));assert(!goes(g,'d4','e5'));assert.throws(()=>use(g,'w','b1','d4'));
 assert.equal(publicGame(g,'b').board[sq('d4')].form,undefined);
});

test('black fusion double move requires same king, knight first then king, exactly two activations',()=>{
 let g=pos('necro','mounted',{a1:'wk',e8:'bk',b8:'bn',a8:'br'});g=use(g,'b','b8','e8');assert.equal(g.turn,'w');g.turn='b';g=use(g,'b');
 assert.throws(()=>move(g,'e8','e7'));assert.throws(()=>move(g,'a8','a7'));assert.throws(()=>applyAction(g,'b',{type:'skipExtra'}));
 g=move(g,'e8','f6');assert.equal(g.turn,'b');assert.equal(g.extraMove.kind,'mountedKing');assert.throws(()=>move(g,'f6','g4'));
 g=move(g,'f6','f5');assert.equal(g.turn,'w');assert.equal(g.extraMove,undefined);assert.equal(g.abilities.b.fusion.doubleUses,1);
 g.turn='b';g=use(g,'b');g=move(g,'f5','d4');g=move(g,'d4','d5');g.turn='b';assert.throws(()=>use(g,'b'));
});

test('lone black mounted king loses on fifth received threat, never while another black piece lives',()=>{
 let g=pos('necro','mounted',{a1:'wk',h8:'bk',f6:'bn',h1:'wr',b7:'bp'});g=use(g,'b','f6','h8');
 g=move(g,'a1','b1');assert.equal(g.abilities.b.threats,0);
 g.board[sq('b7')]=null;g.turn='w';
 for(let n=1;n<=5;n++){
   g=move(g,n%2?'b1':'a1',n%2?'a1':'b1');assert.equal(g.abilities.b.threats,n);
   if(n<5){assert.equal(g.result,null);g.turn='w';}
 }
 assert.equal(g.result.winner,'w');
});

test('special extra movement and fusion cannot be inferred from opponent metadata',()=>{
 let g=pos('necro','mounted',{a1:'wk',h8:'bk',b8:'bn'});g=use(g,'b','b8','h8');g.turn='b';g=use(g,'b');
 const visible=publicGame(g,'w');assert(!JSON.stringify(visible).includes('mounted'));assert(!JSON.stringify(visible).includes('emperor'));assert.equal(visible.extraMove,undefined);
 const own=publicGame(g,'b');assert.deepEqual(movesFor(own,sq('h8')),movesFor(g,sq('h8')));
});

test('both choice abilities use identical neutral results with no ability names',()=>{
 for(const id of ['fiveAhead','conscienceTest']){
   const g=createGame(id,'necro');assert.equal(publicGame(g,'b').abilities.w.id,'hidden');
   const h=applyAction(g,'b',{type:'choice',choice:'w'});
   assert.equal(h.result.reason,'승리 색 선택 결과가 적용되었습니다.');
 }
});
