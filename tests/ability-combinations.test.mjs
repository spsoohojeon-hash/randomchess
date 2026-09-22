import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,movesFor,publicGame,giveMePieceScore,threatened,indexOf as sq} from '../lib/game.ts';

function position(w,b,pieces){
 const g=createGame(w,b);g.board.fill(null);g.phase='play';g.pending=null;
 for(const [at,id] of Object.entries(pieces))g.board[sq(at)]={id:id[0]+at,color:id[0],kind:id[1],moved:false};
 return g;
}
function add(g,s,id,extra={}){
 const a={...createGame(id,'necro').abilities.w,...extra};g.extraAbilities[s].push(a);return a;
}
const use=(g,s,card,from,to)=>applyAction(g,s,{type:'ability',card,from:from?sq(from):undefined,to:to?sq(to):undefined});
const move=(g,from,to)=>applyAction(g,g.turn,{type:'move',from:sq(from),to:sq(to)});
const can=(g,from,to)=>movesFor(g,sq(from)).some(m=>m.to===sq(to));

test('forward army captures for either side, keeps simultaneous blocking, and retains both use costs',()=>{
 for(const s of ['w','b']){
  const foe=s==='w'?'b':'w',start=s==='w'?2:7,next=s==='w'?3:6,third=s==='w'?4:5;
  let g=position(s==='w'?'armyForward':'necro',s==='b'?'armyForward':'necro',{
   a1:'wk',h8:'bk',[`c${start}`]:s+'p',[`c${next}`]:foe+'r',
   [`e${start}`]:s+'p',[`e${next}`]:s+'p',[`g${start}`]:s+'p',b4:s+'r',f4:s+'r'
  });g.turn=s;add(g,s,'forwardPawns',{active:true});
  g=use(g,s,'armyForward');assert.equal(g.board[sq(`c${next}`)].color,s);assert.equal(g.captured[s][0].kind,'r');
  assert(g.board[sq(`e${start}`)]);assert(g.board[sq(`e${third}`)]);assert.equal(g.turn,s);assert.equal(g.ply,0);
  g=use(g,s,'armyForward','b4','f4');assert.equal(g.board[sq('b4')],null);assert.equal(g.board[sq('f4')],null);
  assert.equal(g.turn,foe);assert.equal(g.ply,1);
 }
});

test('army capture uses ordinary capture hooks, promotion and royal victory',()=>{
 let g=position('armyForward','necro',{a1:'wk',h8:'bk',c7:'wp',c8:'br'});
 add(g,'w','forwardPawns',{active:true});add(g,'w','giveMe');add(g,'w','general');
 g=use(g,'w','armyForward');assert.equal(g.board[sq('c8')].kind,'q');assert.equal(g.board[sq('c8')].promoted,true);
 assert.equal(g.giveMe.w.mark.pieceId,'wc7');assert.equal(g.extraAbilities.w.find(a=>a.id==='general').general.kills,1);
 let royal=position('armyForward','necro',{a1:'wk',d5:'bk',d4:'wp'});add(royal,'w','forwardPawns',{active:true});
 assert.equal(use(royal,'w','armyForward').result.winner,'w');
 royal.doubleLeft=2;assert.equal(use(royal,'w','armyForward').result,null);assert.equal(royal.board[sq('d5')].kind,'k');
});

test('wild horse combines with both mounted forms, before or after fusion, including captures',()=>{
 for(const s of ['w','b'])for(const first of [true,false]){
  let g=position(s==='w'?'mounted':'necro',s==='b'?'mounted':'necro',{
   a1:'wk',h8:'bk',b1:s+'n',d4:s+(s==='w'?'r':'k'),f7:(s==='w'?'b':'w')+'r'
  });if(s==='b')g.board[sq('h8')]=null;g.turn=s;
  add(g,s,'wildHorse');if(first)g=use(g,s,'wildHorse');g=use(g,s,'mounted','b1','d4');if(!first)g=use(g,s,'wildHorse');
  assert(can(g,'d4','f7'));assert(!can(g,'d4','f5'));assert(can(g,'d4',s==='w'?'g4':'e4'));
  assert.deepEqual(publicGame(g,s).onlineView.moves[sq('d4')],movesFor(g,sq('d4')));
  g=move(g,'d4','f7');assert.equal(g.board[sq('f7')].color,s);assert.equal(g.board[sq('f7')].wildMoved,true);
  assert.equal(giveMePieceScore(g,g.board[sq('f7')]),s==='w'?14:25);
 }
});

test('black mounted double move uses the upgraded knight step first and king step second',()=>{
 let g=position('necro','mounted',{a1:'wk',h8:'bk',b8:'bn',f5:'wp'});add(g,'b','wildHorse',{active:true});
 g=use(g,'b','mounted','b8','h8');g.turn='b';g=use(g,'b','mounted');
 assert(can(g,'h8','f5'));assert(!can(g,'h8','f7'));assert(!can(g,'h8','g8'));
 g=move(g,'h8','f5');assert.equal(g.turn,'b');assert(!can(g,'f5','d2'));assert(can(g,'f5','e5'));
 g=move(g,'f5','e5');assert.equal(g.turn,'w');assert.equal(g.abilities.b.fusion.doubleUses,1);
});

test('versatile royal rook keeps rook lines, gains other moves, captures, and scores additively',()=>{
 let g=position('reactionary','necro',{d4:'wr',h8:'bk',g7:'bb',d6:'wp'});
 g.abilities.w.active=true;g.abilities.w.rookId='wd4';add(g,'w','versatile');
 for(const to of ['a4','g7','f5','e4'])assert(can(g,'d4',to),to);assert(!can(g,'d4','d7'));
 assert.equal(giveMePieceScore(g,g.board[sq('d4')]),29);
 g=move(g,'d4','g7');assert.equal(g.board[sq('g7')].id,'wd4');assert.equal(g.result,null);
});

test('three-way mounted upgrades accumulate moves and points without double-counting promotion',()=>{
 let g=position('mounted','necro',{a1:'wk',h8:'bk',b1:'wn',d4:'wr'});
 g.board[sq('b1')].promoted=true;g.board[sq('d4')].promoted=true;
 add(g,'w','versatile');add(g,'w','wildHorse',{active:true});g=use(g,'w','mounted','b1','d4');
 for(const to of ['a4','g7','f7','e4'])assert(can(g,'d4',to),to);
 assert(!can(g,'d4','f5'));assert.equal(giveMePieceScore(g,g.board[sq('d4')]),21); // 9 + 6 + 5 + 1
 const n=movesFor(g,sq('d4'));assert.equal(new Set(n.map(m=>m.to)).size,n.length);
});

test('mounted king retains temporary king-return moves and only their points expire',()=>{
 let g=position('necro','mounted',{a1:'wk',d4:'bk',b8:'bn'});g.turn='b';g=use(g,'b','mounted','b8','d4');
 add(g,'b','kingReturn',{active:true,power:{mode:'qn',left:1,score:19}});add(g,'b','wildHorse',{active:true});
 assert(can(g,'d4','f7'));assert(can(g,'d4','h4'));assert(can(g,'d4','g7'));
 g.board[sq('d4')].wildMoved=true;assert.equal(giveMePieceScore(g,g.board[sq('d4')]),55);
 g=move(g,'d4','h4');assert.equal(g.extraAbilities.b.find(a=>a.id==='kingReturn').power,null);
 assert.equal(giveMePieceScore(g,g.board[sq('h4')]),25);assert(!can(g,'h4','d4'));
});

test('composed wild attacks participate in royal threat and double-move capture restrictions',()=>{
 let g=position('mounted','necro',{a1:'wk',f7:'bk',b1:'wn',d4:'wr'});add(g,'w','wildHorse',{active:true});
 g=use(g,'w','mounted','b1','d4');assert.deepEqual(threatened(g,'b'),[sq('f7')]);
 g.doubleLeft=2;assert(!can(g,'d4','f7'));g.doubleLeft=0;assert.equal(move(g,'d4','f7').result.winner,'w');
});

test('Give Me awards the summed mounted score on a real recapture',()=>{
 let g=position('mounted','necro',{a1:'wk',h8:'bk',b1:'wn',d4:'wr',f7:'bp',f8:'br'});
 add(g,'w','wildHorse',{active:true});add(g,'w','giveMe');g.deck=['nothing','burrow','versatile'];
 g=use(g,'w','mounted','b1','d4');g=move(g,'d4','f7');g=move(g,'f8','f7');
 assert.equal(g.giveMe.w.score,4);assert.deepEqual(g.deck,['versatile']);
 assert.deepEqual(g.extraAbilities.w.map(a=>a.id),['wildHorse','giveMe','nothing','burrow']);
});
