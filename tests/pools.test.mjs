import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,drawCards,normalizeCardPool,handbookDescription,cardInfo,createGame,applyAction,visibleAbilityId,publicGame} from '../lib/game.ts';

test('selected pools only draw included abilities and preserve distinct draws when possible',()=>{
 const pool=['burrow','gatling','general'];
 for(let i=0;i<60;i++){const [w,b]=drawCards(pool);assert(pool.includes(w));assert(pool.includes(b));assert.notEqual(w,b);}
 assert.deepEqual(drawCards(['nothing']),['nothing','nothing']);
 assert.throws(()=>drawCards(pool,{w:'necro'}));
});
test('pool validation rejects empty, invalid, duplicate and malformed choices',()=>{
 for(const pool of [[],['burrow','burrow'],['not-a-card'],['necro',null],null,{},'selected',3])assert.throws(()=>normalizeCardPool(pool));
 assert.equal(normalizeCardPool('all'),'all');
 assert.deepEqual(normalizeCardPool(['gatling','burrow']),['burrow','gatling']);
 assert.deepEqual(normalizeCardPool('classic'),CARDS.filter(c=>c.classic).map(c=>c.id));
});
test('handbook omits special victory reveals while game card instructions remain available',()=>{
 for(const c of CARDS.filter(c=>!['metamon','giveMe'].includes(c.id)))assert(!/승리|승자|패배|히든|특수승|위협.*누적/.test(handbookDescription(c.id)),c.name);
 assert.match(handbookDescription('giveMe'),/즉시 승리/);
 assert.equal(handbookDescription('fiveAhead'),handbookDescription('conscienceTest'));
 assert(!/23|체크|왕룩 포획/.test(handbookDescription('kingReturn')));
 assert(!/체크|5회/.test(handbookDescription('mounted')));
 assert.match(cardInfo('mounted').description,/5번/);
});
test('local opponents stay unknown before use, including abilities active from setup',()=>{
 for(const card of CARDS){
 const g=createGame('necro',card.id);
  assert.equal(visibleAbilityId(g,'b','w'),card.id==='metamon'?'necro':'hidden',card.id);
 }
 const g=applyAction(createGame('nothing','necro'),'w',{type:'ability'});
 assert.equal(visibleAbilityId(g,'w','b'),'nothing');
 assert.equal(visibleAbilityId(publicGame(g,'b'),'w','b'),'nothing');
});
test('choice identities stay hidden from both sides before and after the outcome',()=>{
 for(const card of ['fiveAhead','conscienceTest']){
  const g=createGame(card,'equality');
  for(const viewer of ['w','b'])assert.equal(visibleAbilityId(g,'w',viewer),'hidden');
  const ended=applyAction(g,'b',{type:'choice',choice:'b'});
  for(const viewer of ['w','b'])assert.equal(visibleAbilityId(ended,'w',viewer),'hidden');
 }
});
test('assigned starts honor both choices, a single choice, duplicates, and pool membership',()=>{
 assert.deepEqual(drawCards('all',{w:'burrow',b:'mounted'}),['burrow','mounted']);
 assert.deepEqual(drawCards('all',{w:'nothing',b:'nothing'}),['nothing','nothing']);
 assert.deepEqual(drawCards(['burrow','mounted'],{w:'random',b:'mounted'}),['burrow','mounted']);
 assert.deepEqual(drawCards(['burrow','mounted'],{w:'burrow',b:'random'}),['burrow','mounted']);
 assert.throws(()=>drawCards(['burrow'],{w:'mounted',b:'random'}));
});
