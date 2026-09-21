"use client";
import practiceWorkerUrl from "../workers/practice.worker.ts?worker&url";
import {useEffect,useMemo,useRef,useState} from 'react';
import {ChessKing,ChessQueen,ChessRook,ChessBishop,ChessKnight,ChessPawn,ArrowLeft,RotateCw,ChevronLeft,ChevronRight,Lightbulb,Play,Pause,FlaskConical,LoaderCircle} from 'lucide-react';
import {CARDS,createGame,drawCards,applyAction,other,sideName,handbookDescription,cardInfo,square,kindName,abilityStates} from '@/lib/game';
import type {Game,Side,CardId,CardPool,Action} from '@/lib/game';
import {legalActions,actionLabel,actionKey,actor,makeRequest} from '@/lib/practice-ai';
import type {Frame,Difficulty,EvaluationMode,AnalysisResult} from '@/lib/practice-ai';
type SavedPractice={session:Config;frames:Frame[];cursor:number};
type Config={type:'ai'|'free';mode:EvaluationMode;side:Side;difficulty:Difficulty;pool:CardPool;cards:{w:CardId|'random';b:CardId|'random'}};
const initialConfig:Config={type:'ai',mode:'practical',side:'w',difficulty:'normal',pool:'all',cards:{w:'random',b:'random'}};
const icons={k:ChessKing,q:ChessQueen,r:ChessRook,b:ChessBishop,n:ChessKnight,p:ChessPawn};
const secret=(id:string)=>['fiveAhead','conscienceTest'].includes(id);
export default function Practice({onExit}:{onExit:()=>void}){
 const [saved,setSaved]=useState<SavedPractice|null>(null);
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem('randomchess.practice.v1')||'null');if(value?.session&&['ai','free'].includes(value.session.type)&&['practical','theory'].includes(value.session.mode)&&['w','b'].includes(value.session.side)&&['easy','normal','hard'].includes(value.session.difficulty)&&Array.isArray(value.frames)&&value.frames.length&&value.frames.every((f:Frame)=>f.game?.board?.length===64&&f.game.abilities?.w&&f.game.abilities?.b)&&Number.isInteger(value.cursor)&&value.cursor>=0&&value.cursor<value.frames.length)setSaved(value);}catch{}},[]);
 const [config,setConfig]=useState<Config>(initialConfig),[session,setSession]=useState<Config|null>(null);
 const [frames,setFrames]=useState<Frame[]>([]),[cursor,setCursor]=useState(0),[selected,setSelected]=useState<number|null>(null);
 const [ability,setAbility]=useState(''),[promotion,setPromotion]=useState<Action[]|null>(null),[showAnalysis,setShowAnalysis]=useState(true),[showHint,setShowHint]=useState(false);
 const [paused,setPaused]=useState(false),[result,setResult]=useState<AnalysisResult|null>(null),[thinking,setThinking]=useState(false),[analyzing,setAnalyzing]=useState(false),[error,setError]=useState('');
 const [savedNotice,setSavedNotice]=useState(false);
 const [flip,setFlip]=useState(false),[manualSide,setManualSide]=useState<Side|null>(null),[confirmed,setConfirmed]=useState<Action|null>(null);
 const requestId=useRef(0),frameRef=useRef(frames),cursorRef=useRef(cursor),sessionRef=useRef(session);
 frameRef.current=frames;cursorRef.current=cursor;sessionRef.current=session;
 const game=frames[cursor]?.game;
 const turn=game?actor(game,session?.side):'w';
 const controller=game?(session?.type==='ai'?session.side:manualSide??turn):'w';
 const history=useMemo(()=>frames.slice(0,cursor+1),[frames,cursor]);
 const actions=useMemo(()=>game?legalActions(game,controller):[],[game,controller]);
 const abilities=session?.mode==='practical'&&controller!==session.side?[]:actions.filter(a=>a.type==='ability'||a.type==='skipExtra');
 const reviewing=cursor<frames.length-1;
 const aiSide=session?other(session.side):'b';
 const aiTurn=!!game&&session?.type==='ai'&&game.phase!=='over'&&(game.phase==='duel'?!game.duel?.picked[aiSide]:turn===aiSide);
 const blocked=thinking||!!session&&session.type==='ai'&&game?.phase!=='duel'&&turn!==session.side;
 const clearSelection=()=>{setSelected(null);setAbility('');setPromotion(null);setConfirmed(null);setManualSide(null);setShowHint(false);};
 const commit=(action:Action,by:Side,source:Game)=>{
  if(frameRef.current[cursorRef.current]?.game!==source)return;
  try{
   const next=applyAction(source,by,action),updated=[...frameRef.current.slice(0,cursorRef.current+1),{game:next,by,action}];
   setSavedNotice(false);setFrames(updated);frameRef.current=updated;setCursor(updated.length-1);cursorRef.current=updated.length-1;clearSelection();setError('');
  }catch{setError('현재 상태에서 사용할 수 없는 행동입니다. 다른 수를 선택하세요.');setPaused(true);}
 };
 const savePractice=()=>{if(!session)return;try{const data={session,frames,cursor};localStorage.setItem('randomchess.practice.v1',JSON.stringify(data));setSaved(data);setSavedNotice(true);}catch{setError('저장 공간이 부족해 연습을 저장하지 못했습니다.');}};
 const start=(c:Config)=>{
  try{
   const requested={...c.cards};if(c.mode==='practical')requested[other(c.side)]='random';
   const g=createGame(...drawCards(c.pool,requested),c.pool);
   setSavedNotice(false);setSession(structuredClone(c));setFrames([{game:g}]);setCursor(0);setResult(null);setPaused(false);setFlip(c.side==='b');clearSelection();setError('');
  }catch{setError('능력 묶음과 지정 능력을 확인하세요. 능력을 하나 이상 선택해야 합니다.');}
 };
 // Separate workers keep evaluation and opponent decisions on their own information sets.
 useEffect(()=>{
  if(!game||!session||!aiTurn||paused||reviewing)return;
  let cancelled=false,worker:Worker;const source=game,id=++requestId.current;
  setThinking(true);
  try{worker=new Worker(practiceWorkerUrl,{type:'module'});}catch{setThinking(false);setPaused(true);setError('AI를 불러오지 못했습니다. 다시 시도해 주세요.');return;}
  const timeout=setTimeout(()=>{if(cancelled)return;worker.terminate();setThinking(false);setPaused(true);setError('AI 계산이 길어졌습니다. 난이도를 낮추거나 다시 진행하세요.');},12000);
  worker.onmessage=e=>{
   if(cancelled)return;clearTimeout(timeout);setThinking(false);
   if(!e.data.ok||!e.data.result.action){setPaused(true);setError('AI가 다음 행동을 결정하지 못했습니다. 무르거나 자유 분석으로 이어갈 수 있습니다.');return;}
   commit(e.data.result.action,aiSide,source);
  };
  worker.onerror=()=>{if(cancelled)return;clearTimeout(timeout);setThinking(false);setPaused(true);setError('AI 계산을 다시 시도해 주세요.');};
  worker.postMessage(makeRequest(history,aiSide,session.pool,session.mode,session.difficulty,'move',id));
  return()=>{cancelled=true;clearTimeout(timeout);worker.terminate();setThinking(false);};
 // A changed frame always cancels pending computation, including undo/restart/exit.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[game,session,aiTurn,paused,reviewing,history]);
 useEffect(()=>{
  setResult(null);if(!game||!session||!showAnalysis&&!showHint)return;
  let cancelled=false,worker:Worker;const id=++requestId.current;setAnalyzing(true);
  const failed=()=>setResult({id,action:null,score:null,wdl:null,uncertainty:0,depth:0,nodes:0,candidates:0,incomplete:true,line:[],unavailable:true});
  try{worker=new Worker(practiceWorkerUrl,{type:'module'});}catch{setAnalyzing(false);failed();return;}
  const timeout=setTimeout(()=>{if(cancelled)return;worker.terminate();setAnalyzing(false);setResult({id,action:null,score:null,wdl:null,uncertainty:0,depth:0,nodes:0,candidates:0,incomplete:true,line:[],unavailable:true});},12000);
  worker.onmessage=e=>{if(cancelled)return;clearTimeout(timeout);setAnalyzing(false);if(e.data.ok)setResult(e.data.result);else failed();};
  worker.onerror=()=>{if(!cancelled){clearTimeout(timeout);setAnalyzing(false);failed();}};
  worker.postMessage(makeRequest(history,session.side,session.pool,session.mode,session.difficulty,'analysis',id));
  return()=>{cancelled=true;clearTimeout(timeout);worker.terminate();setAnalyzing(false);};
 },[game,session,history,showAnalysis,showHint]);
 const seek=(at:number)=>{setPaused(true);setCursor(at);clearSelection();setResult(null);};
 const undo=()=>{
  if(!game)return;
  let at=cursor-1;
  if(session?.type==='ai')while(at>0&&actor(frames[at].game,session.side)!==session.side)at--;
  seek(Math.max(0,at));
 };
 const chooseMove=(to:number)=>{
  if(!game||blocked)return;
  const matches=actions.filter(a=>a.type==='move'&&a.from===selected&&a.to===to);
  if(matches.length>1){setPromotion(matches);return;}
  if(matches.length){commit(matches[0],controller,game);return;}
  setSelected(game.board[to]?.color===controller?to:null);
 };
 const playAction=(a:Action)=>{if(!game||blocked)return;if(a.type==='ability')setConfirmed(a);else commit(a,controller,game);};
 const visibleName=(s:Side)=>{
  if(!game||!session)return '?';const id=game.abilities[s].id;
  if(secret(id)||session.mode==='practical'&&s!==session.side)return '?';
  return cardInfo(id).name;
 };
 const hasPool=config.pool==='all'||config.pool.length>0;
 const poolCards=CARDS.filter(c=>config.pool==='all'||config.pool.includes(c.id));
 const score=result?.score;
 const scoreText=score===null||score===undefined?'—':Math.abs(score)>=10000?(score>0?'백 우세':'흑 우세'):`${score>=0?'+':''}${score.toFixed(1)}`;
 const probabilities=!analyzing?result?.wdl:null;
 const barLabel=probabilities?`예상 승률: 백 ${probabilities.w}%, 무승부 ${probabilities.draw}%, 흑 ${probabilities.b}%`:analyzing?'승률 분석 중':'승률 정보 없음';
 return <div className="app-shell practice-shell">
  <header className="topbar"><button className="quiet-button" onClick={onExit}><ArrowLeft size={19}/>실제 대국으로</button><h1><FlaskConical size={21}/>연습</h1>{session&&<button className="quiet-button" onClick={()=>{setSession(null);setFrames([]);setCursor(0);setPaused(true);setError('');}}>새 연습</button>}</header>
  {error&&<div className="error-banner" role="alert">{error}<button onClick={()=>setError('')} aria-label="닫기">×</button></div>}
  {!session||!game?<section className="setup-panel practice-setup">
   <h2>연습 설정</h2>{saved&&<button className="resume-button" onClick={()=>{setSession(saved.session);setConfig(saved.session);setFrames(saved.frames);setCursor(saved.cursor);setPaused(true);setFlip(saved.session.side==='b');clearSelection();setError('');}}>저장한 연습 계속하기</button>}<div className="practice-fields">
    <label>연습 방식<select value={config.type} onChange={e=>setConfig({...config,type:e.target.value as Config['type']})}><option value="ai">AI 대국</option><option value="free">자유 분석</option></select></label>
    <label>평가 방식<select value={config.mode} onChange={e=>setConfig({...config,mode:e.target.value as EvaluationMode})}><option value="practical">실전평가</option><option value="theory">이론평가 · 전체 공개</option></select></label>
    <label>{config.type==='ai'?'내 색':'분석 관점'}<select value={config.side} onChange={e=>setConfig({...config,side:e.target.value as Side})}><option value="w">백</option><option value="b">흑</option></select></label>
    <label>AI 난이도<select value={config.difficulty} onChange={e=>setConfig({...config,difficulty:e.target.value as Difficulty})}><option value="easy">쉬움</option><option value="normal">보통</option><option value="hard">어려움</option></select></label>
    <label>능력 묶음<select value={config.pool==='all'?'all':'selected'} onChange={e=>setConfig({...config,pool:e.target.value==='all'?'all':CARDS.map(c=>c.id)})}><option value="all">전체능력묶음</option><option value="selected">선택능력묶음</option></select></label>
   </div>
   {config.pool!=='all'&&<fieldset className="pool-picker"><legend>선택 능력 · {config.pool.length}</legend><div className="pool-picker-actions"><button onClick={()=>setConfig({...config,pool:CARDS.map(c=>c.id)})}>전체 선택</button><button onClick={()=>setConfig({...config,pool:[]})}>전체 해제</button></div><div className="pool-options">{CARDS.map(c=><label className="pool-option" key={c.id}><input type="checkbox" checked={config.pool.includes(c.id)} onChange={e=>{const checked=e.target.checked;setConfig(previous=>({...previous,pool:checked?[...(previous.pool as CardId[]),c.id]:(previous.pool as CardId[]).filter(id=>id!==c.id)}));}}/>{c.name}</label>)}</div></fieldset>}
   <div className="practice-fields">{(['w','b'] as Side[]).map(s=><label key={s}>{sideName(s)} 능력<select disabled={config.mode==='practical'&&s!==config.side} value={config.mode==='practical'&&s!==config.side?'random':config.cards[s]} onChange={e=>setConfig({...config,cards:{...config.cards,[s]:e.target.value as CardId|'random'}})}><option value="random">{config.mode==='practical'&&s!==config.side?'랜덤 · 비공개':'랜덤'}</option>{poolCards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}</div>
   <p className="field-help">{config.mode==='practical'?'내 정보와 공개된 행동으로 추정합니다.':'양쪽 능력을 알고 분석합니다.'}</p>
   <button className="primary-button" disabled={!hasPool} onClick={()=>start(config)}><Play size={18}/>연습 시작</button>
  </section>:<main className="game-layout practice-layout">
   <section className="board-section">
    <div className="board-heading"><h2>{session.type==='ai'?'AI 대국':'자유 분석'}</h2><span className="round-badge">{session.mode==='practical'?'실전평가':'이론평가'}</span></div>
    <div className="practice-player"><strong>{sideName(flip?'w':'b')}{session.type==='ai'&&(flip?'w':'b')===aiSide?' · AI':''}</strong><span>{visibleName(flip?'w':'b')}</span></div>
    <div className="practice-board-row">
     {showAnalysis&&<div className="evaluation-rail" role="img" aria-label={barLabel} title={barLabel}>
      <div className={`evaluation-bar ${probabilities?'':'evaluation-pending'}`} aria-hidden="true">
       {probabilities?(flip?(['w','draw','b'] as const):(['b','draw','w'] as const)).map(side=><div key={side} className={`evaluation-segment evaluation-${side}`} style={{flexGrow:probabilities[side]}}/>):<span className="evaluation-placeholder">{analyzing?'…':'—'}</span>}
       <i className="evaluation-midpoint"/>
      </div>
      <span className={`evaluation-end evaluation-top ${flip?'is-white':'is-black'}`} aria-hidden="true">{flip?'백':'흑'}<b>{probabilities?`${probabilities[flip?'w':'b']}%`:'—'}</b></span>
      <span className={`evaluation-end evaluation-bottom ${flip?'is-black':'is-white'}`} aria-hidden="true">{flip?'흑':'백'}<b>{probabilities?`${probabilities[flip?'b':'w']}%`:'—'}</b></span>
     </div>}
     <div className="board-frame"><div className="chessboard" role="group" aria-label="연습 체스판">
      {Array.from({length:64},(_,n)=>flip?63-n:n).map(i=>{const p=game.board[i],Icon=p?icons[p.kind]:null;const target=selected!==null&&actions.some(a=>a.type==='move'&&a.from===selected&&a.to===i);return <button key={i} className={`cell ${(Math.floor(i/8)+i%8)%2===0?'light':'dark'} ${selected===i?'selected':''} ${target?'legal':''}`} aria-label={`${square(i)}${p?' '+sideName(p.color)+' '+kindName[p.kind]:''}`} aria-pressed={selected===i} onClick={()=>chooseMove(i)} disabled={blocked||game.phase!=='play'}>{Icon&&p&&<Icon className={`piece piece-${p.color} ${game.glow?.includes(p.color)?'practice-glow':''}`} strokeWidth={1.8}/>}<small className="practice-coordinate">{square(i)}</small>{target&&<i className="practice-target"/>}</button>;})}
     </div></div>
    </div>
    <div className="practice-player"><strong>{sideName(flip?'b':'w')}{session.type==='ai'&&(flip?'b':'w')===session.side?' · 나':''}</strong><span>{visibleName(flip?'b':'w')}</span></div>
    <div className="practice-toolbar"><button className="secondary-button" disabled={!cursor} onClick={undo}><RotateCw size={16}/>무르기</button><button className="quiet-button" onClick={()=>setFlip(!flip)}>판 뒤집기</button><button className="quiet-button" onClick={()=>start(session)}>같은 설정 새 대국</button><button className="quiet-button" onClick={savePractice}>연습 저장</button>{savedNotice&&<span role="status" className="field-help">저장 완료</span>}</div>
    <div className="practice-timeline"><button aria-label="이전 행동" disabled={!cursor} onClick={()=>seek(cursor-1)}><ChevronLeft/></button><input aria-label="복기 위치" type="range" min={0} max={frames.length-1} value={cursor} onChange={e=>seek(Number(e.target.value))}/><span>{cursor} / {frames.length-1}</span><button aria-label="다음 행동" disabled={cursor===frames.length-1} onClick={()=>seek(cursor+1)}><ChevronRight/></button></div>
    {reviewing&&<p className="field-help">이 장면에서 다른 수를 두면 새로운 진행으로 이어집니다.</p>}
    <div className="practice-history">{frames.slice(1).map((f,i)=><button key={i} className={cursor===i+1?'current':''} onClick={()=>seek(i+1)}>{i+1}. {sideName(f.by!)} · {actionLabel(f.action!,undefined)}</button>)}</div>
   </section>
   <aside className="control-column">
    <section className="match-status"><span className="eyebrow">PRACTICE</span><h2 aria-live="polite">{game.result?game.result.winner==='draw'?'무승부':`${sideName(game.result.winner)} 승리`:thinking?'AI 생각 중':game.phase==='choice'?'승리 색 선택':game.phase==='reaction'?'기물 선택':game.phase==='duel'?'가위바위보':`${sideName(game.turn)}의 차례`}</h2>{thinking&&<LoaderCircle className="spin" size={18}/>}
     {session.type==='ai'&&game.phase!=='over'&&<div className="practice-toolbar"><button className="quiet-button" onClick={()=>{if(reviewing){setFrames(frames.slice(0,cursor+1));}setPaused(!paused);}}>{paused?<Play size={16}/>:<Pause size={16}/>} {paused?'이 장면에서 계속':'AI 일시정지'}</button><button className="quiet-button" onClick={()=>{setSession({...session,type:'free'});setPaused(true);}}>자유 분석으로</button></div>}
    </section>
    <section className="practice-analysis ability-card"><div className="card-top"><strong>{session.mode==='practical'?'실전평가':'이론평가'}</strong><label><input type="checkbox" checked={showAnalysis} onChange={e=>setShowAnalysis(e.target.checked)}/> 실시간</label></div>
     {showAnalysis&&<>{analyzing?<p>분석 중…</p>:result?.wdl?<><div className="evaluation-score">{scoreText}<small>백 기준</small></div><div className="wdl"><span>백 승 <b>{result.wdl.w}%</b></span><span>무승부 <b>{result.wdl.draw}%</b></span><span>흑 승 <b>{result.wdl.b}%</b></span></div><p className="field-help">예상치 · 통계 보정 전{result.uncertainty>0?` · 불확실성 ${result.uncertainty>=25?'높음':'있음'}`:''}</p><p className="field-help">최대 {result.depth}행동 탐색{session.mode==='practical'?` · 가설 ${result.candidates}개`:''}{result.incomplete?' · 일부 표본 분석':''}</p></>:<p className="field-help">{result?.unavailable?"현재 정보로 평가를 계산하지 못했습니다.":"분석 준비 중…"}</p>}</>}
     <button className="secondary-button" onClick={()=>setShowHint(!showHint)}><Lightbulb size={17}/>{showHint?'추천 수 숨기기':'추천 수 보기'}</button>
     {showHint&&(analyzing?<p>추천 수 분석 중…</p>:result?.action?<div className="practice-hint"><strong>{sideName(turn)} · {actionLabel(result.action,game,turn)}</strong>{result.line.length>1&&<p>{result.line.slice(1).map((s,i)=><span key={i}>{sideName(s.side)} {actionLabel(s.action)}{i<result.line.length-2?' → ':''}</span>)}</p>}{!blocked&&turn===controller&&<button className="quiet-button" onClick={()=>playAction(result.action!)}>추천 수 두기</button>}</div>:<p className="field-help">추천할 수 있는 행동이 없습니다.</p>)}
    </section>
    {session.type==='free'&&game.phase==='play'&&<div className="pool-picker-actions">{(['w','b'] as Side[]).map(s=><button key={s} aria-pressed={controller===s} onClick={()=>{setManualSide(s);setSelected(null);setAbility('');}}>{sideName(s)} 조작{controller===s?' ✓':''}</button>)}</div>}
    <section className="ability-card"><div className="card-top"><strong>{sideName(controller)}의 능력</strong></div>{visibleName(controller)==='?'?<h3>?</h3>:abilityStates(game,controller).map((a,i)=>a.id==='hidden'?<h3 key={i}>?</h3>:<div key={`${a.id}-${i}`}><h3>{cardInfo(a.id).name}</h3><p className="card-description">{handbookDescription(a.id)}</p></div>)}
     {abilities.length>0&&<><label className="input-label" htmlFor="practice-ability">사용할 행동</label><select id="practice-ability" value={ability} disabled={blocked} onChange={e=>setAbility(e.target.value)}><option value="">선택하세요</option>{abilities.map((a,i)=><option key={actionKey(a)} value={i}>{actionLabel(a,game,controller)}</option>)}</select><button className="primary-button" disabled={blocked||ability===''||!abilities[Number(ability)]} onClick={()=>playAction(abilities[Number(ability)])}>능력 발동</button></>}
     {!abilities.length&&game.phase==='play'&&<p className="field-help">지금 사용할 수 있는 능력 행동이 없습니다.</p>}
     {['choice','reaction','duel'].includes(game.phase)&&<div className="practice-special">{actions.filter(a=>['choice','reaction','duel'].includes(a.type)).map(a=><button className="secondary-button" key={actionKey(a)} disabled={thinking&&game.phase!=='duel'} onClick={()=>commit(a,controller,game)}>{actionLabel(a)}</button>)}{!actions.length&&<p>상대의 선택을 기다리는 중</p>}</div>}
    </section>
    <div className="practice-toolbar"><label>난이도<select value={session.difficulty} onChange={e=>setSession({...session,difficulty:e.target.value as Difficulty})}><option value="easy">쉬움</option><option value="normal">보통</option><option value="hard">어려움</option></select></label>{!game.result&&<button className="quiet-button" onClick={()=>setConfirmed({type:'resign'})}>기권</button>}</div>
   </aside>
  </main>}
  {(promotion||confirmed)&&<div className="practice-modal-backdrop"><section className="practice-modal" role="dialog" aria-modal="true" aria-label={promotion?'승격 선택':'행동 확인'}><h2>{promotion?'승격 기물 선택':confirmed?.type==='resign'?'기권할까요?':'능력을 사용할까요?'}</h2>{promotion?<div className="practice-special">{promotion.map(a=><button className="secondary-button" key={a.promotion} onClick={()=>game&&commit(a,controller,game)}>{kindName[a.promotion!]}</button>)}</div>:<button className="primary-button" onClick={()=>game&&confirmed&&commit(confirmed,controller,game)}>확인</button>}<button className="quiet-button" onClick={()=>{setPromotion(null);setConfirmed(null);}}>취소</button></section></div>}
 </div>;
}
