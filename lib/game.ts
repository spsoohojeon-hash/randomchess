// Shared, deterministic rules for local play and server-authoritative online play.
// RandomChess deliberately uses king capture rather than checkmate.
export type Side = "w" | "b";
export type Kind = "p" | "n" | "b" | "r" | "q" | "k";
export type CardId = "necro" | "wildHorse" | "spaceTravel" | "doubleMove" | "equality" | "reactionary" | "exorcism" | "kingReturn" | "bombLauncher" | "noThatMove" | "temusanTimeStone" | "extremeEfficiency" | "quickDuel" | "queenRule" | "versatile" | "fiveAhead" | "conscienceTest";
export type Gesture = "rock" | "scissors" | "paper";
export type Piece = { id: string; color: Side; kind: Kind; moved: boolean };
export type Card = { id: CardId; name: string; short: string; description: string; mode: "passive" | "once" | "repeat" | "twice"; classic: boolean; icon: string };
export const CARDS: Card[] = [
  { id:"necro",name:"네크로맨서",short:"쓰러진 적을 아군으로",description:"내가 잡은 적 기물 하나를 내 킹 주변 8칸 중 빈칸에 아군으로 부활시킵니다. 마지막 줄의 폰은 승격합니다. 1회, 한 턴을 사용합니다.",mode:"once",classic:true,icon:"skull" },
  { id:"wildHorse",name:"존나 야생마",short:"나이트, 더 멀리 뛰다",description:"발동 이후 내 나이트의 이동이 3×2 또는 2×3 점프로 바뀝니다. 중간 기물을 뛰어넘습니다. 원본 파일 기준이며 기존 2×1 이동을 대체합니다. 발동은 턴을 쓰지 않습니다.",mode:"once",classic:true,icon:"horse" },
  { id:"spaceTravel",name:"우주여행",short:"적의 코너에서 어디로든",description:"백은 a8·h8, 흑은 a1·h1에 있는 내 기물을 원하는 칸으로 이동합니다. 적 기물은 잡을 수 있지만 킹과 승패를 결정하는 기물은 잡을 수 없습니다. 무제한, 한 턴을 사용합니다.",mode:"repeat",classic:true,icon:"orbit" },
  { id:"doubleMove",name:"더블무브",short:"한 턴에 두 번의 기회",description:"이번 턴에 두 번 이동합니다. 같은 기물을 두 번 움직여도 됩니다. 두 이동 모두 상대 킹과 승패를 결정하는 기물을 잡을 수 없습니다. 한 판에 1회.",mode:"once",classic:true,icon:"zap" },
  { id:"equality",name:"평등국가",short:"모든 기물에게 캐슬링을",description:"같은 가로줄에서 사이에 빈칸 2개가 있는 내 기물 둘을 고릅니다. 처음 고른 기물은 안쪽으로 2칸, 두 번째도 안쪽으로 2칸 이동합니다. 한 턴을 사용하며 10회 성공하면 즉시 승리합니다.",mode:"repeat",classic:true,icon:"equal" },
  { id:"reactionary",name:"반동분자",short:"왕이 죽어도 끝나지 않는다",description:"내 킹이 잡힐 때까지 원래 킹과 양쪽 룩을 한 번도 움직이지 않았다면, 원래 자리의 살아 있는 룩을 왕룩으로 지정합니다. 왕룩 포획 또는 상대 행동 후 위협 3회 누적 시 패배합니다.",mode:"passive",classic:true,icon:"flag" },
  { id:"exorcism",name:"퇴마(물리)",short:"비숍 앞을 쓸어버리다",description:"내 비숍 바로 앞줄의 왼쪽·정면·오른쪽 3칸에 있는 기물을 모두 제거합니다. 아군과 킹도 포함합니다. 비숍은 움직이지 않습니다. 1회, 한 턴을 사용합니다.",mode:"once",classic:true,icon:"cross" },
  { id:"kingReturn",name:"왕의 귀환",short:"모든 것을 왕에게",description:"내 킹·폰을 제외한 기물을 전부 희생합니다. 나이트·비숍 3, 룩 5, 퀸 9점. 3–6점: 비숍+나이트 15회, 7–10점: 퀸 5회, 11–14점: 퀸 10회, 15–18점: 퀸 15회, 19–22점: 퀸+나이트 15회. 23점 이상이면 즉시 패배. 남은 횟수는 킹을 움직일 때 감소합니다. 발동은 턴을 쓰지 않습니다.",mode:"once",classic:true,icon:"crown" },
  { id:"bombLauncher",name:"폭탄 발사대",short:"첫 전투가 폭발한다",description:"내 기물이 처음 잡거나 잡히는 순간, 포획 칸을 중심으로 3×3 범위의 킹을 제외한 기물이 모두 사라집니다. 아군과 공격자도 포함합니다. 한 판에 한 번 자동 발동합니다.",mode:"passive",classic:false,icon:"bomb" },
  { id:"noThatMove",name:"그 수 하지 마",short:"방금 그 수는 금지",description:"상대의 가장 최근 이동을 되돌리고, 같은 출발칸에서 같은 도착칸으로 다시 두지 못하게 합니다. 상대가 다른 수를 두면 금지가 풀립니다. 2회. 상대가 마지막으로 한 행동이 이동일 때 사용합니다.",mode:"twice",classic:false,icon:"ban" },
  { id:"temusanTimeStone",name:"테무산 타임스톤",short:"내 실수를 되감다",description:"내 가장 최근 이동 직전으로 돌아갑니다. 그 이후 상대의 이동·능력 효과도 함께 돌아갑니다. 2회. 되감기 능력의 사용 횟수는 복구되지 않습니다. 승패가 결정된 뒤에는 사용할 수 없습니다.",mode:"twice",classic:false,icon:"rewind" },
  { id:"extremeEfficiency",name:"극한의 효율",short:"킹 하나, 퀸 셋",description:"시작 배치가 킹 1개와 퀸 3개로 바뀝니다. 퀸은 내 뒷줄 a·d·h열에 놓이고 나머지 기물은 없습니다. 시작 시 자동 적용됩니다.",mode:"passive",classic:false,icon:"triangle" },
  { id:"quickDuel",name:"속전속결",short:"체스판 대신 가위바위보",description:"체스를 멈추고 가위바위보로 승부합니다. 무승부를 제외하고 먼저 두 번 이기는 쪽이 이 대국의 승자입니다. 양쪽 선택이 끝나기 전에는 패를 공개하지 않습니다.",mode:"once",classic:false,icon:"hand" },
  { id:"queenRule",name:"여왕 통치",short:"왕과 여왕의 역할 교체",description:"발동하면 내 킹은 퀸처럼, 내 퀸은 킹처럼 움직입니다. 이후 내 퀸 중 하나라도 잡히면 패배하며 내 킹은 잡혀도 계속합니다. 살아 있는 킹과 퀸이 있어야 발동됩니다. 발동은 턴을 쓰지 않습니다.",mode:"once",classic:false,icon:"queen" },
  { id:"versatile",name:"다재다능",short:"룩의 새로운 가능성",description:"내 룩은 비숍·나이트·킹의 이동을 모두 사용할 수 있습니다. 기존 룩의 직선 장거리 이동은 없어집니다. 시작부터 자동 적용됩니다.",mode:"passive",classic:false,icon:"shuffle" },
  { id:"fiveAhead",name:"5수 앞",short:"선택을 뒤집는 결말",description:"시작할 때 상대가 승리할 색을 선택합니다. 실제 승자는 선택과 반대가 됩니다. 즉시 대국이 끝나는 이벤트 능력입니다. 둘 다 시작 이벤트면 백의 능력을 먼저 처리합니다.",mode:"passive",classic:false,icon:"eye" },
  { id:"conscienceTest",name:"양심테스트",short:"상대에게 맡기는 결말",description:"시작할 때 상대가 승리할 색을 선택합니다. 고른 색이 그대로 승리합니다. 즉시 대국이 끝나는 이벤트 능력입니다. 둘 다 시작 이벤트면 백의 능력을 먼저 처리합니다.",mode:"passive",classic:false,icon:"heart" },
];
export const cardInfo = (id: CardId) => CARDS.find(c => c.id === id)!;
export const other = (s: Side): Side => s === "w" ? "b" : "w";
export const sideName = (s: Side) => s === "w" ? "백" : "흑";
export const kindName: Record<Kind,string> = {p:"폰",n:"나이트",b:"비숍",r:"룩",q:"퀸",k:"킹"};
export const square = (i: number) => `${"abcdefgh"[i % 8]}${8 - Math.floor(i / 8)}`;
export function indexOf(s: string): number { if(!/^[a-h][1-8]$/.test(s)) throw new Error("올바른 칸을 입력해 주세요."); return (8-Number(s[1]))*8+"abcdefgh".indexOf(s[0]); }
export type Ability = { id:CardId; uses:number; active:boolean; castleCount:number; eligible:boolean; threats:number; rookId:string|null; power:null|{mode:"bn"|"q"|"qn";left:number;score:number} };
export type Move = { from:number; to:number; special?:"castle"|"ep"; rookFrom?:number; rookTo?:number; capturedAt?:number };
export type Log = { n:number; side:Side; text:string; ability?:boolean; from?:number; to?:number };
export type Core = {
  board:(Piece|null)[]; turn:Side; ply:number; abilities:Record<Side,Ability>;
  captured:Record<Side,Piece[]>; phase:"play"|"reaction"|"choice"|"duel"|"over";
  doubleLeft:number; ep:null|{target:number;pawn:number;for:Side}; ban:Record<Side,Move|null>;
  result:null|{winner:Side|"draw";reason:string}; pending:null|{owner:Side;chooser:Side;options:number[]};
  duel:null|{score:Record<Side,number>;picks:Record<Side,Gesture|null>;picked:Record<Side,boolean>;round:number;last:string};
  drawOffer:Side|null; log:Log[]; serial:number; lastAction:"move"|"ability"|null;
};
export type Game = Core & { revision:number; undo:{by:Side;move:Move;before:Core}[] };
export type Action = { type:"move"|"ability"|"reaction"|"choice"|"duel"|"resign"|"draw"|"acceptDraw"|"declineDraw"; from?:number;to?:number;piece?:number;capture?:number;promotion?:Kind;choice?:Side;gesture?:Gesture };
const values:Record<Kind,number> = {p:1,n:3,b:3,r:5,q:9,k:0};
const clone = <T,>(x:T):T => structuredClone(x);
const validSquare = (i:unknown): i is number => Number.isInteger(i) && Number(i)>=0 && Number(i)<64;
function assert(condition:unknown,message:string): asserts condition {if(!condition) throw new Error(message);}
const diag = [[1,1],[1,-1],[-1,1],[-1,-1]];
const straight = [[1,0],[-1,0],[0,1],[0,-1]];
const kingSteps = [...diag,...straight];
const knight = [[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]];
const wildSteps = [[3,2],[3,-2],[-3,2],[-3,-2],[2,3],[-2,3],[2,-3],[-2,-3]];

export function createGame(white:CardId="wildHorse",black:CardId="necro"):Game {
  const board:(Piece|null)[]=Array(64).fill(null);
  const back:Kind[]=["r","n","b","q","k","b","n","r"];
  for(const s of ["w","b"] as Side[]) {
    const row=s==="w"?7:0, pawns=s==="w"?6:1;
    for(let c=0;c<8;c++)for(const [r,k] of [[row,back[c]],[pawns,"p"]] as [number,Kind][]) {
      const i=r*8+c; board[i]={id:s+square(i),color:s,kind:k,moved:false};
    }
  }
  const ability=(id:CardId):Ability=>({id,uses:0,active:["versatile","extremeEfficiency","spaceTravel"].includes(id),castleCount:0,eligible:true,threats:0,rookId:null,power:null});
  const g:Game={board,turn:"w",ply:0,abilities:{w:ability(white),b:ability(black)},captured:{w:[],b:[]},phase:"play",doubleLeft:0,ep:null,ban:{w:null,b:null},result:null,pending:null,duel:null,drawOffer:null,log:[],serial:0,lastAction:null,revision:0,undo:[]};
  for(const s of ["w","b"] as Side[])if(g.abilities[s].id==="extremeEfficiency") {
    g.board=g.board.map(p=>p?.color===s&&p.kind!=="k"?null:p);
    const r=s==="w"?7:0;
    for(const c of [0,3,7])g.board[r*8+c]={id:s+"eff"+c,color:s,kind:"q",moved:true};
  }
  for(const s of ["w","b"] as Side[])if(["fiveAhead","conscienceTest"].includes(g.abilities[s].id)) {
    g.phase="choice";g.pending={owner:s,chooser:other(s),options:[]};break;
  }
  return g;
}
export function drawCards(pool:"classic"|"all",requested?:{w?:CardId|"random";b?:CardId|"random"}):[CardId,CardId] {
  const ids=CARDS.filter(c=>pool==="all"||c.classic).map(c=>c.id);
  const random=(arr:CardId[])=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return arr[n[0]%arr.length];};
  for(const s of ["w","b"] as Side[])if(requested?.[s]&&requested[s]!=="random"&&!ids.includes(requested[s] as CardId))throw new Error("선택한 능력이 이 카드 묶음에 없습니다.");
  const w=requested?.w&&requested.w!=="random"?requested.w:random(ids.filter(id=>id!==requested?.b));
  const b=requested?.b&&requested.b!=="random"?requested.b:random(ids.filter(id=>id!==w));
  return [w,b];
}
export function isRoyal(g:Core,p:Piece):boolean {
  const a=g.abilities[p.color];
  if(a.id==="queenRule"&&a.active)return p.kind==="q";
  if(a.id==="reactionary"&&a.active)return p.id===a.rookId;
  return p.kind==="k";
}
export function movesFor(g:Core,from:number,attacks=false):Move[] {
  const p=g.board[from];if(!p)return [];
  const a=g.abilities[p.color],r=Math.floor(from/8),c=from%8,out:Move[]=[];
  const add=(nr:number,nc:number,extra:Partial<Move>={})=>{
    if(nr<0||nr>7||nc<0||nc>7)return;
    const to=nr*8+nc,t=g.board[to];if(attacks||!t||t.color!==p.color)out.push({from,to,...extra});
  };
  const jump=(steps:number[][])=>steps.forEach(([dr,dc])=>add(r+dr,c+dc));
  const slide=(dirs:number[][])=>{for(const [dr,dc] of dirs){let nr=r+dr,nc=c+dc;while(nr>=0&&nr<8&&nc>=0&&nc<8){const t=g.board[nr*8+nc];add(nr,nc);if(t)break;nr+=dr;nc+=dc;}}};
  if(p.kind==="p"){
    const dir=p.color==="w"?-1:1;
    for(const dc of [-1,1]){
      const nr=r+dir,nc=c+dc;if(nr<0||nr>7||nc<0||nc>7)continue;
      const to=nr*8+nc,t=g.board[to];
      if(attacks||t&&t.color!==p.color)add(nr,nc);
      else if(g.ep?.for===p.color&&g.ep.target===to&&g.board[g.ep.pawn]?.kind==="p")add(nr,nc,{special:"ep",capturedAt:g.ep.pawn});
    }
    if(!attacks&&r+dir>=0&&r+dir<8&&!g.board[(r+dir)*8+c]){
      add(r+dir,c);if(!p.moved&&r===(p.color==="w"?6:1)&&!g.board[(r+2*dir)*8+c])add(r+2*dir,c);
    }
  }
  if(p.kind==="n")jump(a.id==="wildHorse"&&a.active?wildSteps:knight);
  if(p.kind==="b")slide(diag);
  if(p.kind==="r"){if(a.id==="versatile"){slide(diag);jump(knight);jump(kingSteps);}else slide(straight);}
  if(p.kind==="q"){if(a.id==="queenRule"&&a.active)jump(kingSteps);else slide(kingSteps);}
  if(p.kind==="k"){
    if(a.id==="queenRule"&&a.active)slide(kingSteps);else jump(kingSteps);
    if(a.power&&a.power.left>0){slide(a.power.mode==="bn"?diag:kingSteps);if(a.power.mode!=="q")jump(knight);}
    const home=p.color==="w"?60:4;
    if(!attacks&&!p.moved&&from===home&&!(a.id==="queenRule"&&a.active)&&!attacked(g,from,other(p.color))){
      for(const [rc,dir] of [[0,-1],[7,1]]){
        const ri=r*8+rc,rook=g.board[ri];if(!rook||rook.kind!=="r"||rook.color!==p.color||rook.moved)continue;
        let free=true;for(let cc=c+dir;cc!==rc;cc+=dir)if(g.board[r*8+cc])free=false;
        if(free&&!attacked(g,from+dir,other(p.color))&&!attacked(g,from+2*dir,other(p.color)))add(r,c+2*dir,{special:"castle",rookFrom:ri,rookTo:from+dir});
      }
    }
  }
  const unique=out.filter((m,i)=>out.findIndex(n=>n.to===m.to)===i);
  if(attacks)return unique;
  return unique.filter(m=>{
    const b=g.ban[p.color];if(b&&b.from===m.from&&b.to===m.to)return false;
    const target=g.board[m.to];return !(g.doubleLeft>0&&p.color===g.turn&&target&&(target.kind==="k"||isRoyal(g,target)));
  });
}
export function attacked(g:Core,to:number,by:Side):boolean {return g.board.some((p,i)=>p?.color===by&&movesFor(g,i,true).some(m=>m.to===to));}
export function threatened(g:Core,s:Side):number[] {return g.board.flatMap((p,i)=>p?.color===s&&isRoyal(g,p)&&attacked(g,i,other(s))?[i]:[]);}
export function kingScore(g:Core,s:Side):number {return g.board.reduce((v,p)=>v+(p?.color===s&&p.kind!=="p"?values[p.kind]:0),0);}
export function exorcismTargets(g:Core,from:number):number[] {
  const p=g.board[from];if(!p)return [];const r=Math.floor(from/8)+(p.color==="w"?-1:1),c=from%8;
  return [-1,0,1].map(dc=>({r,c:c+dc})).filter(x=>x.r>=0&&x.r<8&&x.c>=0&&x.c<8).map(x=>x.r*8+x.c);
}
export function abilityTargets(g:Core,s:Side,from?:number):number[] {
  const id=g.abilities[s].id;
  if(id==="necro"){
    const ki=g.board.findIndex(p=>p?.color===s&&p.kind==="k");if(ki<0)return [];const r=Math.floor(ki/8),c=ki%8;
    return kingSteps.map(([dr,dc])=>[r+dr,c+dc]).filter(([r,c])=>r>=0&&r<8&&c>=0&&c<8&&!g.board[r*8+c]).map(([r,c])=>r*8+c);
  }
  if(id==="exorcism")return g.board.flatMap((p,i)=>p?.color===s&&p.kind==="b"?[i]:[]);
  if(id==="spaceTravel"){
    if(from===undefined)return (s==="w"?[0,7]:[56,63]).filter(i=>g.board[i]?.color===s);
    return g.board.flatMap((p,i)=>!p||p.color!==s&&p.kind!=="k"&&!isRoyal(g,p)?[i]:[]);
  }
  if(id==="equality"){
    if(from===undefined)return g.board.flatMap((p,i)=>p?.color===s&&abilityTargets(g,s,i).length?[i]:[]);
    const r=Math.floor(from/8),c=from%8;
    return [-3,3].map(d=>c+d).filter(n=>n>=0&&n<8&&g.board[r*8+n]?.color===s&&![1,2].some(k=>g.board[from+Math.sign(n-c)*k])).map(n=>r*8+n);
  }
  return [];
}
export function abilityError(g:Game,s:Side):string|null {
  if(g.phase!=="play")return "지금은 능력을 사용할 수 없습니다.";
  const a=g.abilities[s],info=cardInfo(a.id);
  if(info.mode==="passive")return "조건을 만족하면 자동으로 발동합니다.";
  if((info.mode==="once"&&a.uses>=1)||(info.mode==="twice"&&a.uses>=2))return "모두 사용했습니다.";
  if(a.id==="temusanTimeStone")return g.undo.some(h=>h.by===s)?null:"되돌릴 내 이동이 없습니다.";
  if(g.turn!==s)return "내 차례에 사용할 수 있습니다.";
  if(a.id==="noThatMove")return g.undo.at(-1)?.by===other(s)&&g.lastAction==="move"?null:"상대의 최근 행동이 이동이어야 합니다.";
  if(a.id==="necro"&&(!g.captured[s].length||!abilityTargets(g,s).length))return "잡은 적 기물과 킹 주변 빈칸이 필요합니다.";
  if(["spaceTravel","exorcism","equality"].includes(a.id)&&!abilityTargets(g,s).length)return "현재 사용할 수 있는 기물이 없습니다.";
  if(a.id==="queenRule"&&(!g.board.some(p=>p?.color===s&&p.kind==="q")||!g.board.some(p=>p?.color===s&&p.kind==="k")))return "살아 있는 킹과 퀸이 필요합니다.";
  return null;
}
function coreOf(g:Game):Core {const {revision,undo,...rest}=g;void revision;void undo;return clone(rest);}
function record(g:Game,s:Side,text:string,ability=false,move?:Move){g.log.push({n:++g.serial,side:s,text,ability,from:move?.from,to:move?.to});if(g.log.length>200)g.log.shift();}
function end(g:Game,winner:Side|"draw",reason:string){g.phase="over";g.result={winner,reason};g.pending=null;g.drawOffer=null;}
function markMoved(g:Game,p:Piece){p.moved=true;const home=p.color==="w"?"1":"8";if(["a","e","h"].some(f=>p.id===p.color+f+home))g.abilities[p.color].eligible=false;}
function take(g:Game,i:number,by:Side){const p=g.board[i];if(p&&p.color!==by&&p.kind!=="k")g.captured[by].push(clone(p));g.board[i]=null;return p;}
function explode(g:Game,at:number,by:Side,fallenQueens:Side[]){
  for(const s of [by,other(by)] as Side[])if(g.abilities[s].id==="bombLauncher"&&!g.abilities[s].uses){
    g.abilities[s].uses++;g.abilities[s].active=true;const r=Math.floor(at/8),c=at%8;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      const nr=r+dr,nc=c+dc;if(nr<0||nr>7||nc<0||nc>7)continue;const i=nr*8+nc,v=g.board[i];
      if(v&&v.kind!=="k"){if(v.kind==="q"&&isRoyal(g,v))fallenQueens.push(v.color);take(g,i,s);}
    }record(g,s,"폭탄 발사대 · 첫 전투 폭발",true);
  }
}
function reactionOptions(g:Game,s:Side):number[]{if(g.abilities[s].id!=="reactionary"||g.abilities[s].active||!g.abilities[s].eligible)return [];return(s==="w"?[56,63]:[0,7]).filter(i=>{const p=g.board[i];return p?.color===s&&p.kind==="r"&&!p.moved&&p.id===s+square(i);});}
function resolveRoyals(g:Game,fallenQueens:Side[]=[]){
  const missing=(["w","b"] as Side[]).filter(s=>fallenQueens.includes(s)||!g.board.some(p=>p?.color===s&&isRoyal(g,p)));
  const lost=missing.filter(s=>fallenQueens.includes(s)||!reactionOptions(g,s).length);
  if(lost.length===2){end(g,"draw","양쪽의 핵심 기물이 동시에 사라졌습니다.");return;}
  if(lost.length===1){end(g,other(lost[0]),`${sideName(lost[0])}의 핵심 기물이 잡혔습니다.`);return;}
  if(missing.length){const s=missing[0];g.phase="reaction";g.pending={owner:s,chooser:s,options:reactionOptions(g,s)};}
}
function afterAction(g:Game,by:Side,fallenQueens:Side[]=[]){
  resolveRoyals(g,fallenQueens);if(g.phase==="over")return;
  const defender=other(by),a=g.abilities[defender];
  if(a.id==="reactionary"&&a.active&&threatened(g,defender).length){a.threats++;record(g,by,`왕룩 위협 ${a.threats}/3`,true);if(a.threats>=3){end(g,by,"왕룩에 대한 위협이 3회 누적되었습니다.");return;}}
  g.ply++;if(g.doubleLeft>1)g.doubleLeft--;else{g.doubleLeft=0;g.turn=other(by);}
}
function promote(p:Piece,to:number,kind?:Kind){if(p.kind==="p"&&(Math.floor(to/8)===0||Math.floor(to/8)===7)){assert(kind&&["q","r","b","n"].includes(kind),"프로모션 기물을 선택해 주세요.");p.kind=kind;}}
function restoreMove(g:Game,s:Side,id:CardId){
  const last=id==="noThatMove"?g.undo.length-1:g.undo.findLastIndex(h=>h.by===s);
  assert(last>=0,"되돌릴 수가 없습니다.");const h=g.undo[last];
  if(id==="noThatMove")assert(h.by===other(s),"상대의 마지막 이동만 취소할 수 있습니다.");
  const uses={w:g.abilities.w.uses,b:g.abilities.b.uses};const history=g.undo.slice(0,last);const serial=g.serial;
  Object.assign(g,clone(h.before));g.undo=history;g.serial=serial;
  for(const side of ["w","b"] as Side[])if(["noThatMove","temusanTimeStone"].includes(g.abilities[side].id))g.abilities[side].uses=Math.max(g.abilities[side].uses,uses[side]);
  g.abilities[s].uses++;
  if(id==="noThatMove")g.ban[h.by]=h.move;
  g.lastAction="ability";
  record(g,s,`${cardInfo(id).name} · ${square(h.move.from)}–${square(h.move.to)} 취소`,true);
}
export function applyAction(previous:Game,by:Side,action:Action):Game {
  assert(by==="w"||by==="b","플레이어 정보가 올바르지 않습니다.");
  assert(action&&typeof action.type==="string","동작을 확인해 주세요.");
  assert(previous.phase!=="over","이미 끝난 대국입니다.");
  const g=clone(previous),a=g.abilities[by];
  if(action.type==="resign"){end(g,other(by),`${sideName(by)}이 기권했습니다.`);g.revision++;return g;}
  if(action.type==="reaction"){
    assert(g.phase==="reaction"&&g.pending?.chooser===by,"왕룩을 선택할 차례가 아닙니다.");
    assert(validSquare(action.piece)&&g.pending.options.includes(action.piece),"선택할 수 없는 왕룩입니다.");
    a.active=true;a.rookId=g.board[action.piece]!.id;a.uses=1;g.pending=null;g.phase="play";record(g,by,`반동분자 · ${square(action.piece)} 왕룩 지정`,true);resolveRoyals(g);g.revision++;return g;
  }
  if(action.type==="choice"){
    assert(g.phase==="choice"&&g.pending?.chooser===by,"결과를 고를 차례가 아닙니다.");
    assert(action.choice==="w"||action.choice==="b","승리할 색을 선택해 주세요.");
    const card=g.abilities[g.pending.owner].id;end(g,card==="fiveAhead"?other(action.choice):action.choice,`${cardInfo(card).name}의 결과가 적용되었습니다.`);g.revision++;return g;
  }
  if(action.type==="duel"){
    assert(g.phase==="duel"&&g.duel,"가위바위보가 진행 중이 아닙니다.");
    assert(action.gesture&&["rock","paper","scissors"].includes(action.gesture),"가위·바위·보 중 하나를 골라 주세요.");
    assert(!g.duel.picks[by],"이미 선택했습니다. 상대를 기다려 주세요.");
    const d=g.duel;d.picks[by]=action.gesture;d.picked[by]=true;
    if(d.picks.w&&d.picks.b){
      const w=d.picks.w,b=d.picks.b,win:Side|null=w===b?null:((w==="rock"&&b==="scissors")||(w==="scissors"&&b==="paper")||(w==="paper"&&b==="rock"))?"w":"b";
      const labels={rock:"바위",scissors:"가위",paper:"보"};d.last=`${d.round}라운드 · 백 ${labels[w]} / 흑 ${labels[b]} · ${win?sideName(win)+" 승":"무승부"}`;
      record(g,by,d.last,true);if(win)d.score[win]++;
      if(d.score.w===2||d.score.b===2)end(g,d.score.w===2?"w":"b","속전속결 · 가위바위보 2승");
      else{d.round++;d.picks={w:null,b:null};d.picked={w:false,b:false};}
    }
    g.revision++;return g;
  }
  assert(g.phase==="play","현재 선택을 먼저 완료해 주세요.");
  if(action.type==="draw"){assert(!g.drawOffer,"이미 무승부 제안이 있습니다.");g.drawOffer=by;record(g,by,"무승부 제안",true);g.revision++;return g;}
  if(action.type==="acceptDraw"||action.type==="declineDraw"){
    assert(g.drawOffer===other(by),"상대의 무승부 제안이 없습니다.");
    if(action.type==="acceptDraw")end(g,"draw","양쪽이 무승부에 동의했습니다.");else g.drawOffer=null;g.revision++;return g;
  }
  if(action.type==="ability"){
    const error=abilityError(g,by);assert(!error,error||"");
    if(a.id==="noThatMove"||a.id==="temusanTimeStone"){restoreMove(g,by,a.id);g.revision=previous.revision+1;return g;}
    let consumes=false;const fallenQueens:Side[]=[];g.drawOffer=null;
    if(a.id==="wildHorse")a.active=true;
    else if(a.id==="doubleMove"){a.active=true;g.doubleLeft=2;}
    else if(a.id==="queenRule")a.active=true;
    else if(a.id==="kingReturn"){
      const score=kingScore(g,by);
      g.board=g.board.map(p=>p?.color===by&&p.kind!=="k"&&p.kind!=="p"?null:p);a.active=true;
      if(score>=23)end(g,other(by),`왕의 귀환 · ${score}점으로 23점을 넘었습니다.`);
      else if(score>=3)a.power={mode:score<=6?"bn":score>=19?"qn":"q",left:score<=6?15:score<=10?5:score<=14?10:15,score};
    }
    else if(a.id==="quickDuel"){g.phase="duel";g.duel={score:{w:0,b:0},picks:{w:null,b:null},picked:{w:false,b:false},round:1,last:""};}
    else if(a.id==="necro"){
      assert(Number.isInteger(action.capture)&&g.captured[by][action.capture!],"부활시킬 기물을 선택해 주세요.");
      assert(validSquare(action.to)&&abilityTargets(g,by).includes(action.to),"내 킹 주변 빈칸에 놓아 주세요.");
      const p=clone(g.captured[by][action.capture!]);p.id=by+"revived"+g.revision;p.color=by;p.moved=true;promote(p,action.to,action.promotion);g.board[action.to]=p;g.captured[by].splice(action.capture!,1);consumes=true;
    }
    else if(a.id==="exorcism"){
      assert(validSquare(action.from)&&abilityTargets(g,by).includes(action.from),"내 비숍을 선택해 주세요.");
      for(const i of exorcismTargets(g,action.from)){const p=g.board[i];if(p?.kind==="q"&&isRoyal(g,p))fallenQueens.push(p.color);take(g,i,by);}consumes=true;
    }
    else if(a.id==="spaceTravel"){
      assert(validSquare(action.from)&&abilityTargets(g,by).includes(action.from),"상대 진영 코너의 내 기물을 고르세요.");
      assert(validSquare(action.to)&&abilityTargets(g,by,action.from).includes(action.to),"이 칸으로는 이동할 수 없습니다.");
      const p=g.board[action.from]!,target=take(g,action.to,by);g.board[action.to]=p;g.board[action.from]=null;markMoved(g,p);promote(p,action.to,action.promotion);if(target)explode(g,action.to,by,fallenQueens);consumes=true;
    }
    else if(a.id==="equality"){
      assert(validSquare(action.from)&&g.board[action.from]?.color===by,"내 기물을 선택해 주세요.");
      assert(validSquare(action.to)&&abilityTargets(g,by,action.from).includes(action.to),"사이에 빈칸 2개가 있는 같은 줄의 내 기물이 필요합니다.");
      const p=g.board[action.from]!,q=g.board[action.to]!,dir=Math.sign(action.to-action.from);
      g.board[action.from]=null;g.board[action.to]=null;g.board[action.from+dir*2]=p;g.board[action.from+dir]=q;markMoved(g,p);markMoved(g,q);a.castleCount++;consumes=true;
      if(a.castleCount>=10)end(g,by,"평등국가 · 캐슬링 10회 성공");
    }else throw new Error("자동 발동 능력입니다.");
    a.uses++;g.lastAction="ability";record(g,by,`${cardInfo(a.id).name}${action.from!==undefined?" · "+square(action.from):""}${action.to!==undefined?" → "+square(action.to):""}`,true);
    if(consumes){g.ep=null;g.ban[by]=null;if(!g.result)afterAction(g,by,fallenQueens);}
    g.revision=previous.revision+1;return g;
  }
  assert(action.type==="move","지원하지 않는 동작입니다.");assert(g.turn===by,"내 차례가 아닙니다.");
  assert(validSquare(action.from)&&validSquare(action.to),"출발칸과 도착칸을 확인해 주세요.");
  const p=g.board[action.from];assert(p&&p.color===by,"내 기물을 선택해 주세요.");
  const move=movesFor(g,action.from).find(m=>m.to===action.to);assert(move,"이 기물은 그 칸으로 이동할 수 없습니다.");
  const snapshot=coreOf(g);const capturedAt=move.capturedAt??move.to;const target=take(g,capturedAt,by);
  const fallenQueens:Side[]=[];if(target?.kind==="q"&&isRoyal(g,target))fallenQueens.push(target.color);
  g.board[move.from]=null;g.board[move.to]=p;markMoved(g,p);promote(p,move.to,action.promotion);
  if(move.special==="castle"){const rook=g.board[move.rookFrom!]!;g.board[move.rookFrom!]=null;g.board[move.rookTo!]=rook;markMoved(g,rook);}
  g.ep=null;if(p.kind==="p"&&Math.abs(move.to-move.from)===16)g.ep={target:(move.from+move.to)/2,pawn:move.to,for:other(by)};
  if(target)explode(g,move.to,by,fallenQueens);
  if(p.kind==="k"&&a.power){a.power.left--;if(a.power.left<=0)a.power=null;}
  g.ban[by]=null;g.drawOffer=null;g.lastAction="move";
  record(g,by,`${kindName[snapshot.board[move.from]!.kind]} ${square(move.from)} ${target?"×":"→"} ${square(move.to)}${p.kind!==snapshot.board[move.from]!.kind?" = "+kindName[p.kind]:""}${move.special==="castle"?" · 캐슬링":move.special==="ep"?" · 앙파상":""}`,false,move);
  g.undo.push({by,move,before:snapshot});g.undo=g.undo.slice(-4);afterAction(g,by,fallenQueens);
  g.revision=previous.revision+1;return g;
}
export function publicGame(g:Game):Game {
  const out=clone(g);if(out.duel)out.duel.picks={w:null,b:null};
  // Clients receive availability metadata, never a state snapshot they can send back.
  out.undo=out.undo.map(h=>({by:h.by,move:h.move,before:null as unknown as Core}));return out;
}
