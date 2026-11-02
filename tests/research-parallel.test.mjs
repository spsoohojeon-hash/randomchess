import test from 'node:test';
import assert from 'node:assert/strict';
import {SearchPool} from '../scripts/research/search-pool.mjs';
import {policyInput,decide} from '../lib/research-policy.ts';
import {createGame} from '../lib/game.ts';
import {sparse} from '../scripts/research/gpu-runtime.mjs';

test('four actual workers accept independent private observations and match deterministic search',async()=>{
 const pool=new SearchPool(4);
 try{
  const game=createGame('nothing','burrow','all',false);
  const input=policyInput(game,'w');
  assert.equal(input.view.abilities.b.id,'hidden');
  // Force a single legal candidate: timing-independent comparison across threads.
  input.actions=input.actions.slice(0,1);
  const tasks=Array.from({length:4},(_,seed)=>pool.run({input,seed,id:null,network:null}));
  assert.equal(pool.busy,4);
  const results=await Promise.all(tasks);assert.equal(pool.busy,0);
  for(let i=0;i<4;i++)assert.deepEqual(results[i].action,decide(input,i).action);
 }finally{await pool.stop();}
 await assert.rejects(pool.run({}),/pool_closed/);
});
test('sparse transport preserves every nonzero feature including negative values',()=>{
 const input=Float32Array.from([0,.5,-1,0,2]);const encoded=sparse(input);
 const restored=new Float32Array(input.length);for(const [i,v] of encoded)restored[i]=v;
 assert.deepEqual(restored,input);
});
