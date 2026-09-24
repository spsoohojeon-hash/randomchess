import {CARDS,createGame,publicGame,abilityStates,other} from './game.ts';
import type {Game,Core,Side,Action,CardId} from './game.ts';
import {legalActions,analyze} from './practice-ai.ts';
export const POLICY_VERSION='private-sampled-hard-v1';
export type PolicyInput={viewer:Side;view:Game;actions:Action[]};
// This is the sole referee -> player boundary. Historical states are separately
// redacted; a rewind never hands either player an opponent's private snapshot.
export function policyInput(game:Game,viewer:Side):PolicyInput{
 const view=publicGame(game,viewer);view.log=[];
 view.undo=game.undo.map(h=>{
  const past=publicGame({...h.before,revision:0,undo:[]},viewer);past.log=[];
  const {undo,revision,...before}=past;void undo;void revision;
  return {by:h.by,move:h.move,before};
 });
 return {viewer,view,actions:legalActions(game,viewer)};
}
export function seeded(seed:number){let state=seed>>>0;return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function shuffle<T>(values:T[],random:()=>number){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
// Current-position determinization avoids replaying an ever-growing game on
// every move. Unknown cards/deck are independent hypotheses, never the referee
// truth. Hidden counters and compound states are approximate, explicitly tagged.
export function sampleWorlds(input:PolicyInput,seed:number):Game[]{
 const {view,viewer}=input,opponent=other(viewer),random=seeded(seed);
 const own=new Set(abilityStates(view,viewer).filter(a=>!a.source).map(a=>a.id));
 const pool=CARDS.map(c=>c.id).filter(id=>!own.has(id));
 let hypotheses=view.abilities[opponent].id==='hidden'?shuffle(pool,random):[view.abilities[opponent].id as CardId];
 if(view.phase==='choice'&&view.pending?.owner===opponent)hypotheses=['fiveAhead','conscienceTest'];
 const worlds:Game[]=[];
 for(let i=0;i<8;i++){
  const card=hypotheses[i%hypotheses.length],extras=new Map<number,CardId>();
  const fill=(source:Core):Core=>{
   const out=structuredClone(source);delete out.onlineView;
   if(out.abilities[opponent].id==='hidden')out.abilities[opponent]=structuredClone(createGame('nothing',card,'all',false).abilities.b);
   if(out.extraAbilities)out.extraAbilities[opponent]=out.extraAbilities[opponent].map((a,j)=>{
    if(a.id!=='hidden')return a;
    if(!extras.has(j))extras.set(j,shuffle(pool.filter(id=>id!==card&&id!=='giveMe'&&![...extras.values()].includes(id)),random)[0]??'nothing');
    return structuredClone(createGame('nothing',extras.get(j)!,'all',false).abilities.b);
   });
   const owned=new Set([...abilityStates(out,'w'),...abilityStates(out,'b')].map(a=>a.id));
   out.deck=shuffle(CARDS.map(c=>c.id).filter(id=>id!=='giveMe'&&!owned.has(id)),random);
   if(out.duel)out.duel.picks={w:null,b:null};
   if(out.pending&&!out.pending.card)out.pending.card=out.abilities[out.pending.owner].id as CardId;
   return out;
  };
  const {undo,revision,...core}=view;
  const world:Game={...fill(core),revision,undo:undo.map(h=>({...h,before:fill(h.before)}))};
  worlds.push(world);
 }
 return worlds;
}
export function decide(input:PolicyInput,seed:number){
 const view=input.view,emergency=view.phase==='rescue'&&view.pending?.chooser===input.viewer?input.viewer:undefined;
 return analyze({id:view.revision,difficulty:'hard',mode:'practical',viewer:input.viewer,purpose:'move',actions:input.actions,emergency,belief:{worlds:sampleWorlds(input,seed),incomplete:true}});
}
