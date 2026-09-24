'use client';
import {useCallback,useEffect,useState,useRef} from 'react';
import {CARDS} from '@/lib/game';
import './research.css';
type Row={id:string;white_card:string;black_card:string;started:number;updated:number;seq:number;status:string;winner:string|null;reason:string;rules:string;board:string;ply:number;approximate:number};
type Data={control:{enabled:number;heartbeat:number|null};totals:Record<string,number>;ranking:{card:string;games:number;wins:number;draws:number}[];matchups:{white_card:string;black_card:string;games:number;white_wins:number;black_wins:number;draws:number}[];games:Row[];now:number};
const name=(id:string)=>CARDS.find(c=>c.id===id)?.name??id;
const pieces:Record<string,string>={wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'};
export default function ResearchDashboard(){
 const [data,setData]=useState<Data|null>(null),[logged,setLogged]=useState(false),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState<string|null>(null),[download,setDownload]=useState(false);
 const generation=useRef(0);
 const api=useCallback(async<T,>(path:string,body?:unknown)=>{
  const r=await fetch('/api/research/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const p=await r.json() as T & {error?:string};if(!r.ok){if(r.status===401){setLogged(false);setData(null);}throw Error(p.error??'요청 실패');}return p;
 },[]);
 const refresh=useCallback(async()=>{const version=generation.current;try{const result=await api<Data>('stats');if(version!==generation.current)return;setData(result);setLogged(true);setError('');}catch(e){if(version===generation.current)setError((e as Error).message);}},[api]);
 useEffect(()=>{api('session').then(()=>{setLogged(true);void refresh();}).catch(()=>{});},[api,refresh]);
 useEffect(()=>{if(!logged)return;const id=setInterval(()=>void refresh(),5000);return()=>clearInterval(id);},[logged,refresh]);
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);try{await api('login',{password});setPassword('');setLogged(true);await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function control(enabled:boolean){setBusy(true);try{await api('control',{enabled});await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function exportGame(id:string){setDownload(true);try{let after=-1;const parts:BlobPart[]=[];while(true){const p=await api<{events:{seq:number;payload:string}[]}>(`events?id=${encodeURIComponent(id)}&after=${after}`);if(!p.events.length)break;for(const event of p.events){const bytes=Uint8Array.from(atob(event.payload),(c:string)=>c.charCodeAt(0));const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();parts.push(raw+'\n');after=event.seq;}}
  const url=URL.createObjectURL(new Blob(parts,{type:'application/x-ndjson'}));const a=document.createElement('a');a.href=url;a.download=`research-${id}.jsonl`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(e){setError((e as Error).message);}finally{setDownload(false);}}
 const live=data?.games.find(g=>g.id===selected)??data?.games[0];
 const connected=!!data?.control.heartbeat&&Date.now()-data.control.heartbeat<90000;
 return <main className="research"><header><div><span className="research-eyebrow">PRIVATE · RANDOM CHESS</span><h1>AI 연구실</h1></div>{logged&&<button onClick={async()=>{generation.current++;setData(null);setLogged(false);try{await api('logout',{});}catch{setError('로그아웃 요청에 실패했습니다. 브라우저를 닫아 주세요.');}}}>잠그기</button>}</header>
 {!logged?<form className="research-login" onSubmit={login}><span className="research-lock">▣</span><h2>개인 데이터 저장소</h2><p>비밀번호를 입력해 주세요.</p><label htmlFor="research-password">관리자 비밀번호</label><input id="research-password" type="password" autoComplete="current-password" required minLength={16} value={password} onChange={e=>setPassword(e.target.value)}/><button className="research-primary" disabled={busy}>{busy?'확인 중…':'열기'}</button>{error&&<p role="alert">{error}</p>}</form>:<>
 <section className="research-toolbar"><div><span className={'research-dot '+(connected?'on':'')}/>{connected?(data?.control.enabled?'수집 중':'일시정지'):'실행기 연결 대기'}<small>어려움 · 상대 능력 비공개 · 수 제한 없음</small></div><button disabled={busy} onClick={()=>void control(!data?.control.enabled)}>{data?.control.enabled?'수집 일시정지':'수집 시작'}</button></section>
 {error&&<p className="research-error" role="alert">{error}</p>}
 {!connected&&<p className="research-notice">상시 실행기가 연결되어야 대국이 진행됩니다. 이 페이지를 닫아도 실행기가 켜져 있으면 수집은 계속됩니다.</p>}
 <section className="research-metrics">{[['finished','완료 대국'],['running','진행 중'],['actions','기록된 행동'],['blocked','확인 필요']].map(([key,label])=><article key={key}><small>{label}</small><strong>{(data?.totals[key]??0).toLocaleString()}</strong></article>)}</section>
 <div className="research-columns"><section className="research-panel"><div className="research-heading"><h2>현재 대국</h2><span>5초마다 갱신</span></div>{live?<><div className="research-players"><span>백 · {name(live.white_card)}</span><span>흑 · {name(live.black_card)}</span></div><div className="research-board" aria-label="현재 대국 체스판">{(JSON.parse(live.board) as ({color:string;kind:string}|null)[]).map((p,i)=><div key={i} className={(Math.floor(i/8)+i%8)%2?'dark':'light'}>{p&&<span className={p.color==='w'?'white-piece':'black-piece'}>{pieces[p.color+p.kind]}</span>}</div>)}</div><div className="research-game-meta"><strong>{live.ply} 반수 · {live.seq} 행동</strong><span>{live.status==='finished'?(live.winner==='draw'?'무승부':live.winner==='w'?'백 승리':'흑 승리'):live.status==='blocked'?'확인 필요':'진행 중'}</span></div>{live.reason&&<p>{live.reason}</p>}<button disabled={download} onClick={()=>void exportGame(live.id)}>{download?'기록 준비 중…':'이 대국 JSONL 받기'}</button><p className="research-muted">실제 상태는 심판·학습 라벨용으로만 저장됩니다. AI는 자기 관측 정보로 판단합니다.</p></>:<p>첫 대국을 기다리는 중입니다.</p>}</section>
 <section className="research-panel"><h2>능력별 성적</h2><p className="research-muted">완료 대국만 집계합니다. 표본이 적은 성적은 확정 순위가 아닙니다.</p><div className="research-table"><table><thead><tr><th>능력</th><th>판수</th><th>승률</th></tr></thead><tbody>{data?.ranking.map(r=><tr key={r.card}><td>{name(r.card)}</td><td>{r.games}</td><td>{(100*r.wins/r.games).toFixed(1)}%</td></tr>)}</tbody></table></div>{!data?.ranking.length&&<p>완료된 대국이 없습니다.</p>}</section></div>
 <section className="research-panel"><h2>최근 대국</h2><div className="research-table"><table><thead><tr><th>백 / 흑</th><th>행동</th><th>상태</th><th>보기</th></tr></thead><tbody>{data?.games.map(g=><tr key={g.id}><td>{name(g.white_card)} / {name(g.black_card)}</td><td>{g.seq}</td><td>{g.status==='finished'?'완료':g.status==='blocked'?'확인 필요':'진행'}</td><td><button onClick={()=>setSelected(g.id)}>열기</button></td></tr>)}</tbody></table></div></section>
 <section className="research-panel"><h2>능력 상성</h2><div className="research-table"><table><thead><tr><th>백</th><th>흑</th><th>판수</th><th>백승 / 흑승 / 무</th></tr></thead><tbody>{data?.matchups.map(r=><tr key={r.white_card+r.black_card}><td>{name(r.white_card)}</td><td>{name(r.black_card)}</td><td>{r.games}</td><td>{r.white_wins} / {r.black_wins} / {r.draws}</td></tr>)}</tbody></table></div></section>
 <footer>수집된 기보는 학습 자료입니다. 대국 수집 자체가 딥러닝 학습을 실행하지는 않습니다. 비공개 정보 추정·탐색 제한 여부는 각 기록에 포함됩니다.</footer>
 </>}
 </main>;
}
