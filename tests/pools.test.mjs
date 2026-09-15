import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,drawCards,normalizeCardPool,handbookDescription,cardInfo} from '../lib/game.ts';

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
 for(const c of CARDS)assert(!/승리|승자|패배|히든|특수승|위협.*누적/.test(handbookDescription(c.id)),c.name);
 assert.equal(handbookDescription('fiveAhead'),handbookDescription('conscienceTest'));
 assert(!/23|체크|왕룩 포획/.test(handbookDescription('kingReturn')));
 assert(!/체크|5회/.test(handbookDescription('mounted')));
 assert.match(cardInfo('mounted').description,/5번/);
});
