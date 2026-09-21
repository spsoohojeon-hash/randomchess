"use client";

import Practice from "@/components/practice";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChessKing, ChessQueen, ChessRook, ChessBishop, ChessKnight, ChessPawn, Dices, ArrowUpRight, RotateCw, BookOpen, Users, Globe2, Copy, Check, Flag, Handshake, Zap, Orbit, Skull, Equal, Cross, Crown, Bomb, Ban, Rewind, Triangle, Hand, Shuffle, Eye, Heart, X, LoaderCircle, Volume2, VolumeX, ChevronRight, ArrowLeftRight, WifiOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CARDS, cardInfo, createGame, drawCards, applyAction, movesFor, abilityTargets, abilityError, exorcismTargets, kingScore, sideName, other, kindName, square, isRoyal, generalAssignment, gatlingImpacts, blastArea, normalizeCardPool, handbookDescription, visibleAbilityId, abilityStates, abilityState, hasAbility } from "@/lib/game";
import type { Game, Piece, Side, Kind, CardId, Action, Gesture, CardPool } from "@/lib/game";

type Session={code:string;token:string;side:Side};
type Room={code:string;side:Side;game:Game;version:number;waiting:boolean;pool:CardPool;rematch:Side[];expiresAt:number};
type Stage={side:Side;card:CardId;from?:number;capture?:number;mode?:"burst"};
type Confirm={title:string;description:string;label:string;run:()=>void;danger?:boolean};
const pieces={k:ChessKing,q:ChessQueen,r:ChessRook,b:ChessBishop,n:ChessKnight,p:ChessPawn};
const icons={skull:Skull,horse:ChessKnight,orbit:Orbit,zap:Zap,equal:Equal,flag:Flag,cross:Cross,crown:Crown,bomb:Bomb,ban:Ban,rewind:Rewind,triangle:Triangle,hand:Hand,queen:ChessQueen,shuffle:Shuffle,eye:Eye,heart:Heart};
const modeLabels={passive:"자동 발동",once:"1회 사용",repeat:"반복 사용",twice:"2회 사용",thrice:"3회 사용"};
function PieceIcon({piece,small=false,rainbow=false}:{piece:Pick<Piece,"kind"|"color">;small?:boolean;rainbow?:boolean}){
  const Icon=pieces[piece.kind],gradient=useId();
  return <Icon aria-hidden="true" className={`piece piece-${piece.color} ${small?"piece-small":""} ${rainbow?"rainbow-piece":""}`} strokeWidth={1.8} style={rainbow?{stroke:`url(#${gradient})`}:undefined}>
    {rainbow&&<defs><linearGradient id={gradient} x1="0%" y1="0%" x2="100%" y2="100%">{["#ff5277","#ffac42","#f3ef59","#59eb93","#53d6ff","#aa87ff","#ff6ada"].map((color,i)=><stop key={color} offset={`${i/6*100}%`} stopColor={color}/>)}</linearGradient></defs>}
  </Icon>;
}
function AbilityIcon({id}:{id:CardId}){const Icon=icons[cardInfo(id).icon as keyof typeof icons];return <Icon aria-hidden="true"/>;}
const initial=createGame();

export default function ChessGame(){
  const [practice,setPractice]=useState(false);
  const [game,setGame]=useState<Game>(initial),[active,setActive]=useState(false),[loaded,setLoaded]=useState(false);
  const [setupMode,setSetupMode]=useState("local"),[pool,setPool]=useState<"all"|"selected">("all");
  const [selectedCards,setSelectedCards]=useState<CardId[]>(CARDS.map(c=>c.id));
  const [chosen,setChosen]=useState<Record<Side,CardId|"random">>({w:"random",b:"random"});
  const [localStart,setLocalStart]=useState<"random"|"assigned">("random");
  const [localViewer,setLocalViewer]=useState<Side|null>(null);
  const activePool:CardPool=pool==="all"?"all":selectedCards;
  const availableCards=CARDS.filter(c=>activePool==="all"||activePool.includes(c.id));
  const validChosen=Object.values(chosen).every(id=>id==="random"||availableCards.some(c=>c.id===id));
  const poolEmpty=pool==="selected"&&selectedCards.length===0;
  const [session,setSession]=useState<Session|null>(null),[room,setRoom]=useState<Room|null>(null),[joinCode,setJoinCode]=useState("");
  const [savedSession,setSavedSession]=useState<Session|null>(null),[selected,setSelected]=useState<number|null>(null),[stage,setStage]=useState<Stage|null>(null);
  const [focusSquare,setFocusSquare]=useState(52),[flip,setFlip]=useState(false),[rules,setRules]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[connection,setConnection]=useState(true),[copied,setCopied]=useState(false),[sound,setSound]=useState(false);
  const [confirm,setConfirm]=useState<Confirm|null>(null),[promotion,setPromotion]=useState<{side:Side;action:Action}|null>(null),[necro,setNecro]=useState<{side:Side;card:CardId}|null>(null);
  const [duelReady,setDuelReady]=useState<Side|null>(null),[resultHidden,setResultHidden]=useState(false);
  const gameRef=useRef(game),roomRef=useRef(room),sessionRef=useRef(session),busyRef=useRef(false),boardRef=useRef<HTMLDivElement>(null);
  const sendRef=useRef<(action:Action,side?:Side)=>Promise<void>>(async()=>{});
  gameRef.current=game;roomRef.current=room;sessionRef.current=session;
  const online=!!session,waiting=online&&!!room?.waiting,mySide=session?.side??localViewer??game.pending?.chooser??game.turn;
  const setCurrent=useCallback((g:Game)=>{gameRef.current=g;setGame(g);setLocalViewer(null);setSelected(null);setStage(null);setPromotion(null);setNecro(null);setResultHidden(false);setDuelReady(null);},[]);
  const receive=useCallback((r:Room)=>{
    if(roomRef.current?.code===r.code&&r.version<roomRef.current.version)return;
    const changed=roomRef.current?.code!==r.code||r.version!==roomRef.current?.version;
    roomRef.current=r;setRoom(r);if(changed)setCurrent(r.game);setConnection(true);
  },[setCurrent]);
  useEffect(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem("randomchess.local.v2")||"null");
      if(saved?.format===2&&saved.game?.board?.length===64&&saved.game?.abilities?.w&&saved.game?.abilities?.b&&Array.isArray(saved.game.undo)) {setCurrent(saved.game);setActive(true);const previousPool=normalizeCardPool(saved.pool??"all");setPool(previousPool==="all"?"all":"selected");if(Array.isArray(previousPool))setSelectedCards(previousPool);}
      const assignment=saved?.assignment;
      if(assignment&&["w","b"].every(side=>assignment[side]==="random"||CARDS.some(c=>c.id===assignment[side]))){setChosen(assignment);setLocalStart(saved.startMode==="assigned"?"assigned":"random");}
      const pref=JSON.parse(localStorage.getItem("randomchess.pool.v1")||"null");
      if(pref&&["all","selected"].includes(pref.mode)&&Array.isArray(pref.cards)){
        const cards=pref.cards.length?normalizeCardPool(pref.cards):[];
        if(Array.isArray(cards)){setPool(pref.mode);setSelectedCards(cards);}
      }
      const s=JSON.parse(sessionStorage.getItem("randomchess.room.v2")||localStorage.getItem("randomchess.room.v2")||"null");if(s?.code&&s?.token&&["w","b"].includes(s.side))setSavedSession(s);
      const invite=new URLSearchParams(location.search).get("room");if(invite&&/^[A-Z2-9]{6}$/.test(invite)){setJoinCode(invite);setSetupMode("online");setActive(false);}
      setSound(localStorage.getItem("randomchess.sound")==="yes");
    }catch{}setLoaded(true);
  },[setCurrent]);
  useEffect(()=>{if(loaded&&active&&!online)try{localStorage.setItem("randomchess.local.v2",JSON.stringify({format:2,game,pool:activePool,assignment:chosen,startMode:localStart}));}catch{}},[game,active,online,loaded,activePool,chosen,localStart]);
  useEffect(()=>{if(loaded)try{localStorage.setItem("randomchess.pool.v1",JSON.stringify({mode:pool,cards:selectedCards}));}catch{}},[loaded,pool,selectedCards]);
  useEffect(()=>{
    if(!session||!active)return;let stop=false,timer:ReturnType<typeof setTimeout>;let controller:AbortController|null=null;
    const poll=async()=>{
      if(stop)return;
      if(document.hidden){timer=setTimeout(poll,2500);return;}
      controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),10000);
      try{
        const r=await fetch(`/api/rooms/${session.code}`,{headers:{Authorization:`Bearer ${session.token}`},cache:"no-store",signal:controller.signal});
        const data=await r.json() as Room & {error?:string;token:string};if(!r.ok)throw new Error(data.error||"연결을 확인하고 있습니다.");
        if(!stop)receive(data);
      }catch{if(!stop)setConnection(false);}finally{clearTimeout(timeout);if(!stop)timer=setTimeout(poll,1200);}
    };
    void poll();return()=>{stop=true;clearTimeout(timer);controller?.abort();};
  },[session,active,receive]);
  useEffect(()=>{if("serviceWorker" in navigator){void navigator.serviceWorker.register("/sw.js").then(()=>navigator.serviceWorker.ready).then(reg=>reg.active?.postMessage({type:"CACHE_SHELL",assets:performance.getEntriesByType("resource").map(entry=>entry.name).filter(name=>{const u=new URL(name);return u.origin===location.origin&&/\.(js|css|woff2?)(\?|$)/.test(u.pathname);})})).catch(()=>{});}},[]);
  const playSound=useCallback(()=>{if(!sound)return;try{const Audio=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;const ctx=new Audio();const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="sine";osc.frequency.setValueAtTime(620,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(280,ctx.currentTime+.09);gain.gain.setValueAtTime(.055,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.13);osc.onended=()=>void ctx.close();}catch{}},[sound]);
  const send=useCallback(async(action:Action,side?:Side)=>{
    if(busyRef.current)return;setError("");
    const s=sessionRef.current;
    try{
      if(s){
        if(roomRef.current?.waiting)throw new Error("상대의 참가를 기다려 주세요.");
        busyRef.current=true;setBusy(true);
        const res=await fetch(`/api/rooms/${s.code}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${s.token}`},body:JSON.stringify({type:"action",action,version:roomRef.current?.version,requestId:crypto.randomUUID()}),signal:AbortSignal.timeout(12000)});
        const data=await res.json() as Room & {error?:string;token:string};if(data.game)receive(data);if(!res.ok)throw new Error(data.error||"수를 전송하지 못했습니다.");
      }else setCurrent(applyAction(gameRef.current,side??gameRef.current.turn,action));
      playSound();
    }catch(e){setError(e instanceof Error?e.message:"다시 시도해 주세요.");}finally{busyRef.current=false;setBusy(false);}
  },[receive,setCurrent,playSound]);sendRef.current=send;
  useEffect(()=>{
    if(practice)return;
    type Context={registerTool:(tool:Record<string,unknown>,options:{signal:AbortSignal})=>unknown};
    const ctx=(document as unknown as {modelContext?:Context}).modelContext;if(!ctx?.registerTool)return;
    const lifecycle=new AbortController();
    const tool={name:"read_randomchess_position",title:"대국 상태 읽기",description:"현재 판, 차례, 능력, 가능한 이동을 읽습니다.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>{const g=gameRef.current;return {turn:g.turn,phase:g.phase,result:g.result,abilities:Object.fromEntries((["w","b"] as Side[]).map(side=>[side,visibleAbilityId(g,side,sessionRef.current?.side??g.pending?.chooser??g.turn)==="hidden"?{id:"hidden"}:g.abilities[side]])),pieces:g.board.flatMap((p,i)=>p?[{square:square(i),color:p.color,kind:p.kind,moves:movesFor(g,i).map(m=>square(m.to))}]:[])};}};
    try{void Promise.resolve(ctx.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
    return()=>lifecycle.abort();
  },[practice]);
  const startLocal=(mode:"random"|"assigned"=localStart)=>{try{setCurrent(createGame(...drawCards(activePool,mode==="assigned"?chosen:undefined),activePool));setLocalStart(mode);setSession(null);sessionRef.current=null;setRoom(null);roomRef.current=null;setActive(true);setFlip(false);setError("");}catch(e){setError((e as Error).message);}};
  const connectRoom=async(type:"create"|"join"|"resume")=>{
    if(busyRef.current)return;busyRef.current=true;setBusy(true);setError("");
    try{
      const saved=type==="resume"?savedSession:null;
      const code=type==="resume"?saved?.code:joinCode.trim().toUpperCase();
      if(type!=="create"&&!/^[A-Z2-9]{6}$/.test(code||""))throw new Error("방 코드 6자리를 입력해 주세요.");
      const res=await fetch(type==="create"?"/api/rooms":`/api/rooms/${code}`,{method:type==="resume"?"GET":"POST",headers:{"Content-Type":"application/json",...(saved?{Authorization:`Bearer ${saved.token}`}:{})},...(type==="resume"?{}:{body:JSON.stringify(type==="create"?{pool:activePool}:{type:"join"})}),signal:AbortSignal.timeout(15000)});
      const data=await res.json() as Room & {error?:string;token:string};if(!res.ok)throw new Error(data.error||"방에 연결하지 못했습니다.");
      const s:Session={code:data.code,side:data.side,token:saved?.token??data.token};
      roomRef.current=null;setSession(s);sessionRef.current=s;setSavedSession(s);setActive(true);setFlip(s.side==="b");receive(data);
      try{localStorage.setItem("randomchess.room.v2",JSON.stringify(s));sessionStorage.setItem("randomchess.room.v2",JSON.stringify(s));}catch{}
    }catch(e){setError(e instanceof Error?e.message:"방에 연결하지 못했습니다.");}finally{busyRef.current=false;setBusy(false);}
  };
  const rematch=async()=>{
    if(!session||busyRef.current)return;busyRef.current=true;setBusy(true);setError("");
    try{const res=await fetch(`/api/rooms/${session.code}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.token}`},body:JSON.stringify({type:"rematch",version:roomRef.current?.version,requestId:crypto.randomUUID()}),signal:AbortSignal.timeout(12000)});const data=await res.json() as Room & {error?:string;token:string};if(data.game)receive(data);if(!res.ok)throw new Error(data.error);}catch(e){setError((e as Error).message);}finally{busyRef.current=false;setBusy(false);}
  };
  const leave=()=>{setActive(false);setSession(null);sessionRef.current=null;setRoom(null);roomRef.current=null;setStage(null);setSelected(null);setError("");};
  const requestNew=()=>{if(active&&game.phase!=="over")setConfirm({title:online?"대전 화면을 나갈까?":"새 대국을 시작할까?",description:online?"참가 정보가 남아 있어 나중에 같은 방으로 돌아올 수 있어요. 상대가 기다리고 있다면 먼저 기권해 주세요.":"현재 로컬 대국을 마치고 대국 설정으로 돌아갑니다.",label:"대국 설정으로",run:leave});else leave();};
  const submitWithPromotion=(action:Action,side:Side,p:Piece|null)=>{
    const army=hasAbility(game,side,"general")?.general;
    if(p&&army?.id===p.id&&army.kills>=2){void send(action,side);return;}
    if(p?.kind==="p"&&action.to!==undefined&&[0,7].includes(Math.floor(action.to/8))){setPromotion({action,side});return;}void send(action,side);
  };
  const activateAbility=(side:Side,card:CardId)=>{
    const msg=abilityError(game,side,card);if(msg){setError(msg);return;}setError("");setSelected(null);
    const id=card,a=abilityState(game,side,card);
    if(id==="burrow"&&a.burrow){void send({type:"ability",card},side);return;}
    if(id==="mounted"&&a.fusion){void send({type:"ability",card},side);return;}
    if(id==="armyForward"&&a.uses===0){void send({type:"ability",card},side);return;}
    if(id==="necro"){setNecro({side,card});return;}
    if(["exorcism","spaceTravel","equality","burrow","shiningKnight","armyForward","general","gatling","shallNotPass","mounted"].includes(id)){setStage({side,card});return;}
    if(id==="kingReturn"){
      const score=kingScore(game,side);setConfirm({title:`왕의 귀환 · ${score}점`,description:score>=23?"현재 기물을 희생하면 23점 이상이므로 즉시 패배합니다. 그래도 발동할까요?":`킹과 폰을 제외한 내 기물을 모두 희생합니다. ${score<3?"강화가 적용되지 않습니다.":"강화 횟수는 킹을 움직일 때만 감소합니다."}`,label:score>=23?"패배를 감수하고 발동":"희생하고 발동",danger:true,run:()=>void send({type:"ability",card},side)});return;
    }
    if(["noThatMove","temusanTimeStone","quickDuel"].includes(id)){setConfirm({title:cardInfo(id).name,description:cardInfo(id).description,label:"능력 사용",run:()=>void send({type:"ability",card},side)});return;}
    void send({type:"ability",card},side);
  };
  const confirmBurst=(side:Side,from:number,card:CardId="gatling")=>{
    const count=[...new Set(gatlingImpacts(game,from).flatMap(blastArea))].filter(i=>game.board[i]?.color===other(side)).length;
    setConfirm({title:"8발 모두 사용",description:`${count}개의 상대 기물이 범위 안에 있습니다. 탄약 8발과 한 턴을 사용합니다.`,label:"8발 모두 사용",danger:true,run:()=>void send({type:"ability",card,from,mode:"burst"},side)});
  };
  const beginBurst=(side:Side,card:CardId="gatling")=>{
    const why=abilityError(game,side,card);if(why){setError(why);return;}const gatling=abilityState(game,side,card);
    if((gatling.ammo??0)<8){setError("범위 사격에는 8발이 필요합니다.");return;}
    setError("");setSelected(null);
    const queens=abilityTargets(game,side,undefined,card);
    const from=stage?.side===side&&stage.from!==undefined&&queens.includes(stage.from)?stage.from:queens.length===1?queens[0]:undefined;
    setStage({side,card,from,mode:"burst"});
    if(from!==undefined)confirmBurst(side,from,card);
  };
  const legal=useMemo(()=>{
    if(!active||waiting||busy)return [];
    if(game.phase==="reaction")return (!online||mySide===game.pending?.chooser)?game.pending?.options??[]:[];
    if(game.phase!=="play")return [];
    if(stage)return stage.mode==="burst"&&stage.from!==undefined?[]:abilityTargets(game,stage.side,stage.from,stage.card);
    return selected===null?[]:movesFor(game,selected).map(m=>m.to);
  },[game,active,waiting,busy,stage,selected,online,mySide]);
  const clickSquare=(i:number)=>{
    setFocusSquare(i);if(!active||waiting||busy||game.phase==="over")return;setError("");
    if(game.phase==="reaction"){if(legal.includes(i))void send({type:"reaction",piece:i},game.pending?.chooser??game.turn);return;}
    if(game.phase!=="play")return;
    if(stage){
      if(!legal.includes(i))return;const id=stage.card;
      if(id==="gatling"&&stage.mode==="burst"){setStage({...stage,from:i});setSelected(i);confirmBurst(stage.side,i,stage.card);return;}
      if(id==="necro"){submitWithPromotion({type:"ability",card:stage.card,capture:stage.capture,to:i},stage.side,game.captured[stage.side][stage.capture!]);return;}
      if(id==="burrow"||id==="general"&&generalAssignment(game,stage.side)){
        void send({type:"ability",card:stage.card,from:i},stage.side);return;
      }
      if(id==="shallNotPass"){
        setConfirm({title:"능력 발동",description:"선택한 비숍과 같은 세로줄의 상대 기물을 제거합니다. 킹은 면역입니다.",label:"발동",danger:true,run:()=>void send({type:"ability",card:stage.card,from:i},stage.side)});return;
      }
      if(id==="exorcism"){
        setStage({...stage,from:i});const targets=exorcismTargets(game,i);const names=targets.filter(t=>game.board[t]).map(t=>`${square(t)} ${sideName(game.board[t]!.color)} ${kindName[game.board[t]!.kind]}`);
        setConfirm({title:"퇴마(물리)",description:`${names.length?names.join(", ")+" 제거.":"제거할 기물이 없습니다."} 비숍은 제자리에 남고 차례가 넘어갑니다.`,label:"퇴마 발동",danger:true,run:()=>void send({type:"ability",card:stage.card,from:i},stage.side)});return;
      }
      if(stage.from===undefined){setStage({...stage,from:i});setSelected(i);return;}
      submitWithPromotion({type:"ability",card:stage.card,from:stage.from,to:i},stage.side,["spaceTravel","shiningKnight"].includes(id)?game.board[stage.from]:null);return;
    }
    if(online&&game.turn!==mySide)return;
    if(selected!==null&&legal.includes(i)){submitWithPromotion({type:"move",from:selected,to:i},game.turn,game.board[selected]);return;}
    if(game.board[i]?.color===game.turn){setSelected(selected===i?null:i);}else setSelected(null);
  };
  const copyCode=async()=>{try{await navigator.clipboard.writeText(session!.code);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{setError(`방 코드: ${session?.code} · 길게 눌러 복사할 수 있어요.`);}};
  const visualSquares=Array.from({length:64},(_,i)=>flip?63-i:i);
  const lastMove=game.log.findLast(x=>x.from!==undefined&&!x.ability);
  const dangerous=stage?.from!==undefined&&stage.card==="exorcism"?exorcismTargets(game,stage.from):[];
  const stageId=stage?.card??null;
  const stagePrompt=stage?stageId==="necro"?"부활시킬 킹 주변의 빈칸을 골라 주세요.":stageId==="exorcism"||stageId==="shallNotPass"?"능력을 사용할 내 비숍을 골라 주세요.":stageId==="burrow"?"숨길 내 기물을 골라 주세요.":stageId==="armyForward"?stage.from===undefined?"희생할 첫 번째 룩을 고르세요.":"희생할 두 번째 룩을 고르세요.":stageId==="general"&&generalAssignment(game,stage.side)?`휘하 ${generalAssignment(game,stage.side)==="n"?"나이트":"비숍"}를 지정하세요.`:stageId==="gatling"?stage.from===undefined?"발사할 퀸을 고르세요.":stage.mode==="burst"?"8발 모두 사용을 눌러 범위 사격하세요.":"명중 대상을 선택하거나 8발 모두 사용을 누르세요.":stageId==="mounted"?stage.from===undefined?"융합할 나이트를 고르세요.":`융합할 ${stage.side==="w"?"룩":"킹"}을 고르세요.`:stage.from===undefined?"빛나는 내 기물을 먼저 골라 주세요.":"빛나는 도착칸을 골라 주세요.":"";
  const status=!active?"대국을 준비하세요":waiting?"상대의 참가를 기다리는 중":game.result?game.result.winner==="draw"?"무승부":`${sideName(game.result.winner)} 승리`:game.phase==="reaction"?`${sideName(game.pending?.chooser??game.turn)} · 왕룩을 선택하세요`:game.phase==="choice"?`${sideName(game.pending?.chooser??game.turn)} · 결과를 선택하세요`:game.phase==="duel"?"속전속결 · 가위바위보":`${sideName(game.turn)}의 차례${game.doubleLeft?` · ${game.doubleLeft}회 이동 남음`:""}`;
  const cardPanel=(side:Side,a=game.abilities[side],index=0)=>{
    const concealed=a.id==="hidden"||(side!==mySide&&!a.revealed&&!a.uses)||(["fiveAhead","conscienceTest"].includes(a.id)&&!a.revealed);
    if(concealed)return <article className="ability-card" key={`${side}-${index}`}><div className="card-top"><span className="card-owner">{sideName(side)}의 능력</span></div><div className="card-main"><div className="ability-emblem" aria-hidden="true">?</div><h3>?</h3></div></article>;
    if(a.id==="hidden")return null;const id=a.id;
    const info=cardInfo(id),why=abilityError(game,side,id),canControl=!online||side===mySide;
    const used=(info.mode==="once"&&a.uses>0&&!a.burrow)||(info.mode==="twice"&&a.uses>=2)||(info.mode==="thrice"&&a.uses>=3);
    const label=a.burrow?"버로우 해제":a.id==="general"?generalAssignment(game,side)?`휘하 ${generalAssignment(game,side)==="n"?"나이트":"비숍"} 지정`:"장군·휘하 위치 교환":a.id==="mounted"?a.fusion?"연속 이동 사용":"융합":a.id==="armyForward"&&a.uses===1?"룩 2개 희생 후 재발동":a.id==="gatling"?"1발 사용":"능력 사용";
    return <article className={`ability-card ${side===game.turn?"current-card":""} ${used?"used-card":""}`} key={`${side}-${index}-${id}`}>
      <div className="card-top"><span className="card-owner"><i className={`side-token token-${side}`}/>{sideName(side)}의 능력{online&&side===mySide?" · 나":""}</span><span className="card-mode">{modeLabels[info.mode]}</span></div>
      <div className="card-main"><div className="ability-emblem"><AbilityIcon id={a.id}/></div><div><h3>{info.name}</h3></div></div>
      <p className="card-description">{info.description}</p>
      {a.power&&<div className="ability-stat">왕 강화 <strong>{a.power.left}회 남음</strong></div>}
      {a.burrow&&<div className="ability-stat">{square(a.burrow.at)} · {kindName[a.burrow.piece.kind]}<strong>{game.board[a.burrow.at]?"나오기 불가":"숨는 중"}</strong></div>}
      {a.general&&<div className="ability-stat">장군 부대 <strong>{a.general.kills}회 포획</strong></div>}
      {id==="giveMe"&&side===mySide&&<div className="ability-stat">보유 점수 <strong>{game.giveMe?.[side].score??0} / 5</strong></div>}
      {a.fusion&&side==="b"&&<><div className="ability-stat">연속 이동 <strong>{2-a.fusion.doubleUses} / 2</strong></div><div className="ability-stat">홀로 남은 뒤 받은 체크 <strong>{a.threats} / 5</strong></div></>}
      
      {a.id==="reactionary"&&<div className="ability-stat">{a.active?"왕룩 위협": "발동 조건"}<strong>{a.active?`${a.threats} / 3`:a.eligible?"유지 중":"해제됨"}</strong></div>}
      {(info.mode==="twice"||info.mode==="thrice")&&<div className="ability-stat">남은 횟수 <strong>{(info.mode==="thrice"?3:2)-a.uses} / {info.mode==="thrice"?3:2}</strong></div>}
      {side===mySide&&id==="gatling"&&(a.ammo??0)>=8&&<button className="primary-button burst-all-button" disabled={!!why||busy||waiting||online&&!connection} onClick={()=>beginBurst(side,id)}><Bomb size={18}/>8발 모두 사용</button>}
      {canControl&&info.mode!=="passive"?<><button className="card-use" disabled={!!why||busy||waiting||!connection&&online} onClick={()=>activateAbility(side,id)}>{used?a.active?"발동 완료":"사용 완료":<><Zap size={16}/>{stage?.side===side&&stage.card===id?"체스판에서 선택 중":label}<ChevronRight size={17}/></>}</button>{why&&!used&&<p className="card-condition">{why}</p>}</>:<div className="passive-state">{a.uses?"발동 완료":a.active?"적용 중":info.mode==="passive"?"조건을 기다리는 중":"상대의 능력"}</div>}
    </article>;
  };
  const ammoSides=(["w","b"] as Side[]).filter(s=>active&&s===mySide&&!!hasAbility(game,s,"gatling"));
  const hiddenPieces=(["w","b"] as Side[]).flatMap(s=>s===mySide?abilityStates(game,s).flatMap(a=>a.burrow?[a.burrow]:[]):[]);
  const extra=game.extraMove;
  const burstReady=stage?.from!==undefined&&stageId==="gatling"&&(abilityState(game,stage.side,stage.card).ammo??0)>=8;
  const duelSide:Side=session?.side??(!game.duel?.picked.w?"w":"b");

  if(practice)return <Practice onExit={()=>setPractice(false)}/>;
  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={requestNew} aria-label="랜덤능력체스 대국 설정"><span className="brand-mark"><ChessKnight/></span><span>랜덤능력<span className="brand-accent">체스</span><small>RANDOM CHESS</small></span></button><nav><button className="quiet-button" onClick={()=>setRules(true)}><BookOpen size={18}/><span>능력 도감</span></button><button className="icon-button" aria-label={sound?"효과음 끄기":"효과음 켜기"} onClick={()=>{setSound(!sound);try{localStorage.setItem("randomchess.sound",!sound?"yes":"no");}catch{}}}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button></nav></header>
    <main className="game-layout">
      <section className="board-section" aria-label="대국">
        <div className="board-heading"><div><h1>{online?"온라인 대국":"체스판"}</h1></div><span className="round-badge">{active?`${Math.floor(game.ply/2)+1}번째 턴`:"2인 대전"}</span></div>
        <div className={`player-bar ${active&&game.turn===(flip?"w":"b")?"player-active":""}`}><div className="player-identity"><span className={`player-avatar avatar-${flip?"w":"b"}`}><ChessKing/></span><div><strong>{sideName(flip?"w":"b")}{online&&mySide===(flip?"w":"b")?" · 나":""}</strong><span>{active?visibleAbilityId(game,flip?"w":"b",mySide)==="hidden"?"?":cardInfo(game.abilities[flip?"w":"b"].id).name:"능력 추첨 대기"}</span></div></div><div className="captured-pieces" aria-label="잡은 기물">{game.captured[flip?"w":"b"].slice(-10).map((p,i)=><PieceIcon key={i} piece={p} small/>)}</div></div>
        <div className={`board-with-ammo ${ammoSides.length?"has-ammo":""}`}>
          {ammoSides.length>0&&<aside className="ammo-rail" aria-label="내 탄약">{ammoSides.map(s=>{const ammo=hasAbility(game,s,"gatling")?.ammo??0;return <div className="ammo-counter" key={s}><span>{online?"탄약":sideName(s)}</span><strong aria-live="polite">{ammo}<small>/8</small></strong><div className="ammo-rounds" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i} className={i<ammo?"loaded":""}/>)}</div>{ammo===8&&<span className="ammo-full">범위</span>}</div>;})}</aside>}
        <div className="board-frame"><div ref={boardRef} className="chessboard" role="group" aria-label="체스판. 방향키로 칸을 옮기고 엔터로 선택하세요.">
          {visualSquares.map((i,vi)=>{const p=game.board[i],light=(Math.floor(i/8)+i%8)%2===0,highlight=legal.includes(i),royal=p&&isRoyal(game,p)&&p.kind!=="k";return <button key={i} data-square={i} type="button" tabIndex={i===focusSquare?0:-1} aria-label={`${square(i)}${p?` ${sideName(p.color)} ${kindName[p.kind]}`:" 빈칸"}${highlight?" · 선택 가능":""}`} aria-pressed={selected===i} className={`cell ${light?"light":"dark"} ${selected===i?"selected":""} ${lastMove?.from===i||lastMove?.to===i?"last-move":""} ${dangerous.includes(i)?"blast-target":""} ${highlight&&p?"capture-target":""}`} onClick={()=>clickSquare(i)} onKeyDown={e=>{
            if(e.key==="Escape"){setStage(null);setSelected(null);return;}const delta:Record<string,number>={ArrowUp:-8,ArrowDown:8,ArrowLeft:-1,ArrowRight:1};if(e.key in delta){e.preventDefault();const next=vi+delta[e.key];if(next>=0&&next<64&&(!["ArrowLeft","ArrowRight"].includes(e.key)||Math.floor(next/8)===Math.floor(vi/8))){const target=visualSquares[next];setFocusSquare(target);boardRef.current?.querySelector<HTMLButtonElement>(`[data-square="${target}"]`)?.focus();}}
          }}>{vi%8===0&&<span className="rank-label">{8-Math.floor(i/8)}</span>}{vi>=56&&<span className="file-label">{"abcdefgh"[i%8]}</span>}{p&&<PieceIcon piece={p} rainbow={game.glow?.includes(p.color)}/>}
            {p?.form&&<span className="piece-form" title={p.form==="prince"?"나이트 + 룩":"나이트 + 킹"}>♞</span>}
            {p&&hasAbility(game,p.color,"general")?.general?.id===p.id&&<span className="general-mark" title="장군">★</span>}
            {p&&[hasAbility(game,p.color,"general")?.general?.knightId,hasAbility(game,p.color,"general")?.general?.bishopId].includes(p.id)&&<span className="general-mark" title="휘하">·</span>}
            {hiddenPieces.some(h=>h.at===i)&&<span className="burrow-mark" title="내 기물이 이 칸에 숨어 있습니다">잠복</span>}
            {royal&&<span className="royal-mark" title="승패를 결정하는 기물">★</span>}{highlight&&!p&&<span className="move-dot"/>}</button>;})}
        </div></div></div>
        {burstReady&&<div className="burst-controls"><span>8방향 · 명중 지점마다 3×3</span><button className="secondary-button" disabled={busy||waiting||online&&!connection||!!abilityError(game,stage!.side,stage!.card)} onClick={()=>confirmBurst(stage!.side,stage!.from!,stage!.card)}>8발 모두 사용</button></div>}
        {extra&&(!online||extra.side===mySide)&&<div className="extra-controls"><span>{extra.kind==="general"?"휘하 하나 추가 이동":extra.kind==="mountedKnight"?"연속 이동 · 나이트 이동":"연속 이동 · 킹 이동"}</span>{extra.kind!=="mountedKnight"&&<button className="quiet-button" disabled={busy} onClick={()=>void send({type:"skipExtra"},extra.side)}>건너뛰기</button>}</div>}
        <div className={`player-bar ${active&&game.turn===(flip?"b":"w")?"player-active":""}`}><div className="player-identity"><span className={`player-avatar avatar-${flip?"b":"w"}`}><ChessKing/></span><div><strong>{sideName(flip?"b":"w")}{online&&mySide===(flip?"b":"w")?" · 나":""}</strong><span>{active?visibleAbilityId(game,flip?"b":"w",mySide)==="hidden"?"?":cardInfo(game.abilities[flip?"b":"w"].id).name:"능력 추첨 대기"}</span></div></div><div className="captured-pieces" aria-label="잡은 기물">{game.captured[flip?"b":"w"].slice(-10).map((p,i)=><PieceIcon key={i} piece={p} small/>)}</div></div>
        <div className="board-footer"><span><i className="legend-dot"/>이동 가능 <i className="legend-ring"/>포획 가능</span><button className="quiet-button" onClick={()=>setFlip(!flip)}><ArrowLeftRight size={16}/>판 뒤집기</button></div>
      </section>
      <aside className="control-column">
        {error&&<div className="error-banner" role="alert"><span>{error}</span><button aria-label="오류 알림 닫기" onClick={()=>setError("")}><X size={16}/></button></div>}
        {!active?<section className="setup-panel"><h2>대국 설정</h2>
          <Tabs value={setupMode} onValueChange={setSetupMode}><TabsList className="mode-tabs"><TabsTrigger value="local"><Users size={17}/>로컬 2인</TabsTrigger><TabsTrigger value="online"><Globe2 size={17}/>온라인</TabsTrigger><TabsTrigger value="practice">연습</TabsTrigger></TabsList>
            <div className="field"><label>능력 묶음</label><Select value={pool} onValueChange={v=>setPool(v as "all"|"selected")}><SelectTrigger className="ability-select" aria-label="능력 묶음"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">전체능력묶음</SelectItem><SelectItem value="selected">선택능력묶음</SelectItem></SelectContent></Select></div>
            {pool==="selected"&&<fieldset className="pool-picker"><legend>선택 능력 · {selectedCards.length}/{CARDS.length}</legend><div className="pool-picker-actions"><button type="button" onClick={()=>setSelectedCards(CARDS.map(c=>c.id))}>전체 선택</button><button type="button" onClick={()=>setSelectedCards([])}>전체 해제</button></div><div className="pool-options">{CARDS.map(card=><label className="pool-option" key={card.id}><input type="checkbox" checked={selectedCards.includes(card.id)} onChange={e=>{const checked=e.currentTarget.checked;setSelectedCards(previous=>checked?[...previous,card.id]:previous.filter(id=>id!==card.id));}}/><span>{card.name}</span></label>)}</div>{poolEmpty&&<p className="field-help" role="status">능력을 1개 이상 선택하세요.</p>}</fieldset>}
            <TabsContent value="local"><button className="primary-button start-button" onClick={()=>startLocal("random")} disabled={!loaded||poolEmpty}><Dices size={20}/>랜덤으로 시작<ArrowUpRight size={21}/></button><div className="or-divider"><span/>능력 지정<span/></div><div className="ability-choices">{(["w","b"] as Side[]).map(side=><div className="field" key={side}><label>{sideName(side)}의 능력</label><Select value={chosen[side]} onValueChange={value=>setChosen(previous=>({...previous,[side]:value as CardId|"random"}))}><SelectTrigger className="ability-select" aria-label={`${sideName(side)}의 지정 능력`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="random">랜덤</SelectItem>{availableCards.map(card=><SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>)}</SelectContent></Select></div>)}</div>{!validChosen&&<p className="field-help">현재 묶음에 포함된 능력을 다시 선택하세요.</p>}<button className="secondary-button" onClick={()=>startLocal("assigned")} disabled={!loaded||poolEmpty||!validChosen}>능력 지정 시작<ArrowUpRight size={20}/></button></TabsContent>
            <TabsContent value="practice"><button className="primary-button" onClick={()=>setPractice(true)}>연습 모드 열기<ArrowUpRight size={20}/></button></TabsContent>
            <TabsContent value="online"><button className="primary-button" disabled={busy||poolEmpty} onClick={()=>void connectRoom("create")}>{busy?<LoaderCircle className="spin" size={18}/>:<Globe2 size={18}/>}새 방 만들기<ArrowUpRight size={20}/></button><div className="or-divider"><span/>또는 코드로 참가<span/></div><form onSubmit={e=>{e.preventDefault();void connectRoom("join");}}><label className="input-label" htmlFor="room-code">방 코드</label><div className="join-row"><input id="room-code" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,6))} maxLength={6} placeholder="ABC123" autoComplete="off" spellCheck={false}/><button className="secondary-button" disabled={busy||joinCode.length!==6}>참가</button></div></form>{savedSession&&<button className="resume-button" disabled={busy} onClick={()=>void connectRoom("resume")}><RotateCw size={15}/>{savedSession.code} 방으로 돌아가기</button>}</TabsContent>
          </Tabs><button className="text-link" onClick={()=>setRules(true)}>{CARDS.length}가지 능력 살펴보기<ChevronRight size={16}/></button>
        </section>:<>
          <section className="match-status"><div className="status-top"><span className="eyebrow">{online?`ROOM ${session.code}`:"LOCAL · 2 PLAYERS"}</span><span className="live-state">{busy?<LoaderCircle size={14} className="spin"/>:online&&!connection?<WifiOff size={14}/>:<span className="live-dot"/>}{busy?"전송 중":online?connection?"연결됨":"재연결 중":"대국 중"}</span></div><h2 aria-live="polite">{status}</h2>{online&&<button className="room-copy" onClick={()=>void copyCode()}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?"복사했어":"방 코드 복사"}</button>}{waiting&&<p className="field-help">상대에게 방 코드를 알려 주세요.</p>}</section>
          {stage&&<div className="selection-banner"><Zap size={18}/><span>{stagePrompt}</span><button aria-label="능력 선택 취소" onClick={()=>{setStage(null);setSelected(null);}}><X size={18}/></button></div>}
          {game.drawOffer&&<div className="draw-offer"><p>{sideName(game.drawOffer)}이 무승부를 제안했어요.</p>{(!online||mySide!==game.drawOffer)?<div><button className="secondary-button" onClick={()=>void send({type:"acceptDraw"},other(game.drawOffer!))}>수락</button><button className="quiet-button" onClick={()=>void send({type:"declineDraw"},other(game.drawOffer!))}>계속하기</button></div>:<span>상대의 응답을 기다리는 중</span>}</div>}
          {!online&&game.phase==="play"&&<div className="pool-picker-actions" role="group" aria-label="로컬 플레이어 화면">{(["w","b"] as Side[]).map(side=><button key={side} aria-pressed={mySide===side} onClick={()=>{setLocalViewer(side);setStage(null);setSelected(null);}}>{sideName(side)} 화면{mySide===side?" ✓":""}</button>)}</div>}
          <Tabs defaultValue="abilities" className="play-tabs"><TabsList className="mode-tabs"><TabsTrigger value="abilities"><Zap size={16}/>능력</TabsTrigger><TabsTrigger value="history"><Rewind size={16}/>기보 <span className="count-pill">{game.log.length}</span></TabsTrigger></TabsList><TabsContent value="abilities" className="ability-stack">{(online?[mySide,other(mySide)]:["w","b"] as Side[]).flatMap(side=>abilityStates(game,side).map((a,i)=>cardPanel(side,a,i)))}</TabsContent><TabsContent value="history"><div className="move-history">{game.log.length?game.log.slice().reverse().map(l=><div className={`history-row ${l.ability?"history-ability":""}`} key={l.n}><span>{String(l.n).padStart(2,"0")}</span><i className={`side-token token-${l.side}`}/><p>{l.text}</p>{l.ability&&<Zap size={14}/>}</div>):<div className="history-empty"><ChessPawn/><p>첫 수를 기다리고 있어요.</p><span>이동과 능력 사용이 여기에 기록돼요.</span></div>}</div></TabsContent></Tabs>
          <div className="game-actions"><button className="quiet-button" onClick={requestNew}><RotateCw size={16}/>새 대국</button><button className="quiet-button" disabled={waiting||game.phase!=="play"||!!game.drawOffer} onClick={()=>void send({type:"draw"})}><Handshake size={17}/>무승부</button><button className="quiet-button" disabled={waiting||game.phase==="over"} onClick={()=>setConfirm({title:`${sideName(mySide)}이 기권할까?`,description:"기권하면 상대가 승리하고 이 대국이 종료됩니다.",label:"기권",danger:true,run:()=>void send({type:"resign"},mySide)})}><Flag size={16}/>기권</button></div>
          {game.result&&<button className="primary-button" onClick={()=>setResultHidden(false)}>대국 결과 보기<ArrowUpRight size={18}/></button>}
        </>}
      </aside>
    </main>
    <footer className="app-footer"><span>RANDOM CHESS <b>02</b></span><button onClick={()=>setRules(true)}>능력 도감<BookOpen size={14}/></button></footer>
    <Dialog open={rules} onOpenChange={setRules}><DialogContent className="rules-dialog"><DialogTitle>능력 도감 <span className="accent-text">{CARDS.length}</span></DialogTitle><DialogDescription className="sr-only">능력별 설명</DialogDescription><div className="rules-scroll"><div className="rule-cards">{CARDS.map(card=><article key={card.id}><div className="rule-card-heading"><AbilityIcon id={card.id}/><h3>{card.name}</h3></div><p>{handbookDescription(card.id)}</p></article>)}</div></div></DialogContent></Dialog>
    <AlertDialog open={!!confirm} onOpenChange={v=>{if(!v)setConfirm(null);}}><AlertDialogContent className="game-dialog"><AlertDialogTitle>{confirm?.title}</AlertDialogTitle><AlertDialogDescription>{confirm?.description}</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction className={confirm?.danger?"danger-button":""} onClick={()=>{const run=confirm?.run;setConfirm(null);run?.();}}>{confirm?.label}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={!!promotion} onOpenChange={v=>{if(!v)setPromotion(null);}}><DialogContent className="game-dialog"><DialogTitle>폰 프로모션</DialogTitle><DialogDescription>어떤 기물로 승격할까요?</DialogDescription><div className="promotion-options">{(["q","r","b","n"] as Kind[]).map(kind=><button key={kind} onClick={()=>{const p=promotion!;setPromotion(null);void send({...p.action,promotion:kind},p.side);}}><PieceIcon piece={{kind,color:promotion?.side??"w"}}/><span>{kindName[kind]}</span></button>)}</div></DialogContent></Dialog>
    <Dialog open={necro!==null} onOpenChange={v=>{if(!v)setNecro(null);}}><DialogContent className="game-dialog"><DialogTitle>누구를 부활시킬까?</DialogTitle><DialogDescription>잡은 상대 기물을 아군으로 되살립니다.</DialogDescription><div className="necro-options">{necro&&game.captured[necro.side].map((p,i)=><button key={i} onClick={()=>{setStage({side:necro.side,card:necro.card,capture:i});setNecro(null);}}><PieceIcon piece={{kind:p.kind,color:necro.side}} small/>{kindName[p.kind]}</button>)}</div></DialogContent></Dialog>
    <Dialog open={active&&!waiting&&game.phase==="choice"} onOpenChange={()=>{}}><DialogContent className="game-dialog" showCloseButton={false}><DialogTitle>승리 색 선택</DialogTitle><DialogDescription>승리할 색을 선택하세요.</DialogDescription>{game.pending&&(!online||mySide===game.pending.chooser)?<><p>{sideName(game.pending.chooser)}이 승리할 색을 선택하세요.</p><div className="choice-buttons">{(["w","b"] as Side[]).map(s=><button className="secondary-button" key={s} onClick={()=>void send({type:"choice",choice:s},game.pending?.chooser??game.turn)}>{sideName(s)} 승리</button>)}</div></>:<p>상대의 선택을 기다리고 있어요.</p>}</DialogContent></Dialog>
    <Dialog open={active&&!waiting&&game.phase==="duel"} onOpenChange={()=>{}}><DialogContent className="game-dialog" showCloseButton={false}><DialogTitle>속전속결 <span className="accent-text">{game.duel?.round}R</span></DialogTitle><DialogDescription>가위바위보로 먼저 2승을 가져가세요.</DialogDescription><div className="duel-score"><span>백 <b>{game.duel?.score.w}</b></span><span>:</span><span><b>{game.duel?.score.b}</b> 흑</span></div>{game.duel?.last&&<p className="duel-last">{game.duel.last}</p>}{game.duel?.picked[duelSide]?<p>선택 완료. 상대를 기다리는 중이에요.</p>:!online&&duelReady!==duelSide?<button className="primary-button" onClick={()=>setDuelReady(duelSide)}>{sideName(duelSide)}에게 기기를 넘기고 선택하기</button>:<><p>{sideName(duelSide)}의 선택</p><div className="gesture-options">{(["scissors","rock","paper"] as Gesture[]).map((gesture,i)=><button key={gesture} onClick={()=>void send({type:"duel",gesture},duelSide)}><span>{["✌","✊","✋"][i]}</span>{["가위","바위","보"][i]}</button>)}</div></>}<button className="quiet-button" onClick={()=>setConfirm({title:`${sideName(duelSide)}이 기권할까?`,description:"이 대국이 종료됩니다.",label:"기권",danger:true,run:()=>void send({type:"resign"},duelSide)})}>기권</button></DialogContent></Dialog>
    <Dialog open={active&&!!game.result&&!resultHidden} onOpenChange={v=>{if(!v)setResultHidden(true);}}><DialogContent className="game-dialog result-dialog"><div className="result-icon"><Crown/></div><DialogTitle>{game.result?.winner==="draw"?"무승부":`${game.result?sideName(game.result.winner as Side):""} 승리`}</DialogTitle><DialogDescription>{game.result?.reason}</DialogDescription><p className="result-moves">총 {game.ply}번의 행동 · {game.log.filter(l=>l.ability).length}번의 능력 기록</p>{online?<><button className="primary-button" disabled={busy||room?.rematch.includes(mySide)} onClick={()=>void rematch()}><RotateCw size={18}/>{room?.rematch.includes(mySide)?"상대의 재대국 수락을 기다리는 중":room?.rematch.length?"재대국 수락":"한 판 더 제안"}</button><button className="quiet-button" onClick={()=>setResultHidden(true)}>체스판 다시 보기</button></>:<><button className="primary-button" onClick={()=>startLocal()}><Dices size={18}/>같은 설정으로 한 판 더</button><button className="quiet-button" onClick={leave}>대국 설정으로</button></>}</DialogContent></Dialog>
  </div>;
}
