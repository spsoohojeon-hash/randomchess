// Shared, deterministic rules for local play and server-authoritative online play.
// RandomChess deliberately uses king capture rather than checkmate.
export type Side = "w" | "b";
export type Kind = "p" | "n" | "b" | "r" | "q" | "k";
export type CardId = "necro" | "wildHorse" | "spaceTravel" | "doubleMove" | "equality" | "reactionary" | "exorcism" | "kingReturn" | "bombLauncher" | "noThatMove" | "temusanTimeStone" | "extremeEfficiency" | "quickDuel" | "queenRule" | "versatile" | "fiveAhead" | "conscienceTest" | "burrow" | "shiningKnight" | "forwardPawns" | "nothing" | "armyForward" | "general" | "gatling" | "shallNotPass" | "mounted";
export type Gesture = "rock" | "scissors" | "paper";
export type Piece = { id: string; color: Side; kind: Kind; moved: boolean; form?:"prince"|"emperor" };
export type Card = { id: CardId; name: string; short: string; description: string; mode: "passive" | "once" | "repeat" | "twice" | "thrice"; classic: boolean; icon: string };
export const CARDS: Card[] = [
  { id:"necro",name:"네크로맨서",short:"쓰러진 적을 아군으로",description:"내가 잡은 적 기물 하나를 내 킹 주변 8칸 중 빈칸에 아군으로 부활시킵니다. 마지막 줄의 폰은 승격합니다. 1회, 한 턴을 사용합니다.",mode:"once",classic:true,icon:"skull" },
  { id:"wildHorse",name:"존나 야생마",short:"나이트, 더 멀리 뛰다",description:"발동 이후 내 나이트의 이동이 3×2 또는 2×3 점프로 바뀝니다. 중간 기물을 뛰어넘습니다. 기존 2×1 이동을 대체합니다. 발동은 턴을 쓰지 않습니다.",mode:"once",classic:true,icon:"horse" },
  { id:"spaceTravel",name:"우주여행",short:"적의 코너에서 어디로든",description:"백은 a8·h8, 흑은 a1·h1에 있는 내 기물을 원하는 칸으로 이동합니다. 적 기물은 잡을 수 있지만 킹과 승패를 결정하는 기물은 잡을 수 없습니다. 무제한, 한 턴을 사용합니다.",mode:"repeat",classic:true,icon:"orbit" },
  { id:"doubleMove",name:"더블무브",short:"한 턴에 두 번의 기회",description:"이번 턴에 두 번 이동합니다. 같은 기물을 두 번 움직여도 됩니다. 두 이동 모두 상대 킹과 승패를 결정하는 기물을 잡을 수 없습니다. 한 판에 1회.",mode:"once",classic:true,icon:"zap" },
  { id:"equality",name:"평등국가",short:"모든 기물에게 캐슬링을",description:"같은 가로줄에서 사이에 빈칸 2개가 있는 내 기물 둘을 고릅니다. 처음 고른 기물은 안쪽으로 2칸, 두 번째도 안쪽으로 2칸 이동합니다. 한 턴을 사용합니다.",mode:"repeat",classic:true,icon:"equal" },
  { id:"reactionary",name:"반동분자",short:"왕이 죽어도 끝나지 않는다",description:"내 킹이 잡힐 때까지 원래 킹과 양쪽 룩을 한 번도 움직이지 않았다면, 원래 자리의 살아 있는 룩을 왕룩으로 지정합니다. 왕룩 포획 또는 상대 행동 후 위협 3회 누적 시 패배합니다.",mode:"passive",classic:true,icon:"flag" },
  { id:"exorcism",name:"퇴마(물리)",short:"비숍 앞을 쓸어버리다",description:"내 비숍 바로 앞줄의 왼쪽·정면·오른쪽 3칸에 있는 기물을 모두 제거합니다. 아군과 킹도 포함합니다. 비숍은 움직이지 않습니다. 1회, 한 턴을 사용합니다.",mode:"once",classic:true,icon:"cross" },
  { id:"kingReturn",name:"왕의 귀환",short:"모든 것을 왕에게",description:"내 킹·폰을 제외한 기물을 전부 희생합니다. 나이트·비숍 3, 룩 5, 퀸 9점. 3–6점: 비숍+나이트 15회, 7–10점: 퀸 5회, 11–14점: 퀸 10회, 15–18점: 퀸 15회, 19–22점: 퀸+나이트 15회. 23점 이상이면 즉시 패배. 남은 횟수는 킹을 움직일 때 감소합니다. 발동은 턴을 쓰지 않습니다.",mode:"once",classic:true,icon:"crown" },
  { id:"bombLauncher",name:"폭탄 발사대",short:"첫 전투가 폭발한다",description:"내 기물이 처음 잡거나 잡히는 순간, 포획 칸을 중심으로 3×3 범위의 킹을 제외한 기물이 모두 사라집니다. 아군과 공격자도 포함합니다. 한 판에 한 번 자동 발동합니다.",mode:"passive",classic:false,icon:"bomb" },
  { id:"noThatMove",name:"그 수 하지 마",short:"방금 그 수는 금지",description:"상대의 가장 최근 이동을 되돌리고, 같은 출발칸에서 같은 도착칸으로 다시 두지 못하게 합니다. 상대가 다른 수를 두면 금지가 풀립니다. 2회. 상대가 마지막으로 한 행동이 이동일 때 사용합니다.",mode:"twice",classic:false,icon:"ban" },
  { id:"temusanTimeStone",name:"테무산 타임스톤",short:"내 실수를 되감다",description:"내 가장 최근 이동 직전으로 돌아갑니다. 그 이후 상대의 이동·능력 효과도 함께 돌아갑니다. 2회. 되감기 능력의 사용 횟수는 복구되지 않습니다. 승패가 결정된 뒤에는 사용할 수 없습니다.",mode:"twice",classic:false,icon:"rewind" },
  { id:"extremeEfficiency",name:"극한의 효율",short:"킹 하나, 퀸 셋",description:"시작 배치가 킹 1개와 퀸 3개로 바뀝니다. 퀸은 내 뒷줄 a·d·h열에 놓이고 나머지 기물은 없습니다. 시작 시 자동 적용됩니다.",mode:"passive",classic:false,icon:"triangle" },
  { id:"quickDuel",name:"속전속결",short:"체스판 대신 가위바위보",description:"체스를 멈추고 가위바위보로 승부합니다. 무승부를 제외하고 먼저 두 번 이기는 쪽이 이 대국의 승자입니다. 양쪽 선택이 끝나기 전에는 패를 공개하지 않습니다.",mode:"once",classic:false,icon:"hand" },
  { id:"queenRule",name:"이 국가는 여왕이 통치한다",short:"왕과 여왕의 역할 교체",description:"발동하면 내 킹은 퀸처럼, 내 퀸은 킹처럼 움직입니다. 이후 내 퀸 중 하나라도 잡히면 패배하며 내 킹은 잡혀도 계속합니다. 살아 있는 킹과 퀸이 있어야 발동됩니다. 발동은 턴을 쓰지 않습니다.",mode:"once",classic:false,icon:"queen" },
  { id:"versatile",name:"다재다능",short:"룩의 새로운 가능성",description:"내 룩은 비숍·나이트·킹의 이동을 모두 사용할 수 있습니다. 기존 룩의 직선 장거리 이동은 없어집니다. 시작부터 자동 적용됩니다.",mode:"passive",classic:false,icon:"shuffle" },
  { id:"fiveAhead",name:"5수 앞",short:"선택을 뒤집는 결말",description:"시작할 때 상대가 승리할 색을 선택합니다. 실제 승자는 선택과 반대가 됩니다.",mode:"passive",classic:false,icon:"eye" },
  { id:"conscienceTest",name:"양심테스트",short:"상대에게 맡기는 결말",description:"시작할 때 상대가 승리할 색을 선택합니다. 고른 색이 그대로 승리합니다.",mode:"passive",classic:false,icon:"heart" },
  { id:"burrow",name:"버로우",short:"원하는 순간 다시 등장",description:"킹을 제외한 내 기물 하나를 제자리에서 숨깁니다. 숨은 기물은 이동하거나 잡힐 수 없습니다. 그 칸은 다른 기물이 사용할 수 있으며, 비어 있을 때만 다시 나올 수 있습니다. 숨기기 1회, 숨기기와 나오기 모두 턴 소모 없음.",mode:"once",classic:false,icon:"eye" },
  { id:"shiningKnight",name:"나는 내가 빛나는 나이트인 줄 알았어요",short:"가로막은 적을 뛰어넘기",description:"버튼으로 발동합니다. 내 기물 하나가 직선·대각선으로 상대 기물을 개수 제한 없이 뛰어넘어 빈칸에 착지합니다. 아군을 넘거나 착지하며 잡을 수 없습니다. 3회, 이동에 한 턴을 사용합니다.",mode:"thrice",classic:false,icon:"horse" },
  { id:"forwardPawns",name:"전진밖에 모르는 병신들",short:"앞으로 잡는 폰",description:"발동 후 내 폰은 대각선 대신 앞으로 상대 기물을 잡습니다. 처음 위치에서 아직 움직이지 않은 폰은 중간 칸이 비어 있으면 두 칸 앞의 상대 기물도 잡습니다. 효과는 계속 유지됩니다. 발동은 턴 소모 없음.",mode:"once",classic:false,icon:"zap" },
  { id:"nothing",name:"진-짜 사기적인 능력",short:"무능력",description:"발동하면 내 기물의 테두리가 무지개빛으로 빛납니다. 게임 규칙에 영향을 주는 효과는 없습니다. 턴 소모 없음.",mode:"once",classic:false,icon:"shuffle" },
  { id:"armyForward",name:"전군, 앞으로!",short:"모든 폰을 한 칸 앞으로",description:"내 모든 폰을 동시에 한 칸 전진시킵니다. 앞에 기물이 있으면 움직이지 않습니다. 첫 사용은 턴 소모 없음. 내 룩 2개를 희생하고 한 턴을 사용해 한 번 더 발동할 수 있습니다. 끝줄에 도착한 폰은 퀸으로 승격합니다.",mode:"twice",classic:false,icon:"flag" },
  { id:"general",name:"오성장군",short:"장군과 휘하 병력",description:"처음 적을 잡은 내 폰이 장군이 됩니다. 장군·휘하의 합산 포획 1회: 기존 내 나이트를 휘하로 지정. 장군 이동 후 추가 이동 가능. 2회: 장군이 킹처럼 이동. 3회: 기존 내 비숍도 지정하며 추가 이동은 휘하 중 하나만 가능. 4회 이상: 한 턴을 써서 장군과 휘하 하나의 위치 교환. 교환은 이동으로 취급하지 않습니다. 지정은 턴 소모 없음.",mode:"repeat",classic:false,icon:"crown" },
  { id:"gatling",name:"개틀링건",short:"폰을 탄환으로",description:"내 퀸이 적 폰 또는 아군 폰을 먹으면 탄약 1발을 얻습니다. 최대 8발. 한 턴과 1발을 써서 직선·대각선 한 방향으로 발사합니다. 8발을 모두 쓰면 8방향 동시 사격하며 각 명중 지점의 3×3 범위에 있는 적 기물을 잡습니다. 총알은 관통하지 않고 아군에 막힙니다. 팀킬은 퀸으로 아군 폰을 먹을 때만 가능합니다.",mode:"repeat",classic:false,icon:"bomb" },
  { id:"shallNotPass",name:"You Shall Not Pass",short:"비숍과 같은 열을 제거",description:"버튼으로 내 비숍 하나를 지정해 같은 세로줄의 상대 기물을 모두 잡습니다. 중간 기물에 막히지 않으며 킹은 면역입니다. 1회, 한 턴을 사용합니다.",mode:"once",classic:false,icon:"ban" },
  { id:"mounted",name:"백마 탄 왕자님, 흑마 탄 임금님",short:"나이트와 영구 융합",description:"백은 내 나이트와 룩, 흑은 내 나이트와 킹을 영구 융합합니다. 나이트가 대상 칸으로 이동하며 두 기물의 이동을 모두 얻습니다. 융합은 1회, 턴 소모 없음. 흑은 게임당 2번 나이트 이동 한 번과 킹 이동 한 번을 한 턴에 연속 사용합니다. 흑마 탄 임금님만 남은 뒤 상대 행동으로 체크를 5번 받으면 흑이 패배합니다.",mode:"repeat",classic:false,icon:"horse" },
];
export const cardInfo = (id: CardId | "hidden") => id === "hidden" ? {...CARDS[0], name:"비공개", short:"상대 능력", description:"상대의 능력은 공개되지 않습니다.", icon:"eye"} : CARDS.find(c => c.id === id)!;
// The handbook describes actions without revealing special victory conditions.
const handbookOverrides:Partial<Record<CardId,string>>={
  reactionary:"내 킹이 잡힐 때까지 원래 킹과 양쪽 룩을 움직이지 않았다면, 원래 자리의 살아 있는 룩 하나를 왕룩으로 지정합니다.",
  kingReturn:"내 킹·폰을 제외한 기물을 전부 희생합니다. 나이트·비숍 3점, 룩 5점, 퀸 9점. 3–6점: 비숍+나이트 15회. 7–10점: 퀸 5회. 11–14점: 퀸 10회. 15–18점: 퀸 15회. 19–22점: 퀸+나이트 15회. 횟수는 킹 이동 시 감소합니다. 발동은 턴 소모 없음.",
  quickDuel:"체스를 멈추고 가위바위보를 진행합니다. 양쪽이 선택하기 전에는 패를 공개하지 않습니다.",
  queenRule:"내 킹은 퀸처럼, 내 퀸은 킹처럼 움직이며 퀸이 왕의 역할을 맡습니다. 살아 있는 킹과 퀸이 필요합니다. 턴 소모 없음.",
  fiveAhead:"대국 시작 시 상대에게 색을 선택하게 합니다.",
  conscienceTest:"대국 시작 시 상대에게 색을 선택하게 합니다.",
  mounted:"내 나이트가 룩(백) 또는 킹(흑)의 칸으로 이동해 영구 융합합니다. 두 기물의 이동을 모두 얻습니다. 융합은 1회, 턴 소모 없음. 흑은 게임당 2번 나이트 이동 한 번과 킹 이동 한 번을 한 턴에 연속 사용할 수 있습니다.",
};
export const handbookDescription=(id:CardId)=>handbookOverrides[id]??cardInfo(id).description;
export type CardPool="all"|CardId[];
export function normalizeCardPool(pool:unknown):CardPool {
  if(pool==="all")return "all";
  // Existing saved games and rooms retain their old pool as an explicit selection.
  if(pool==="classic")return CARDS.filter(c=>c.classic).map(c=>c.id);
  if(!Array.isArray(pool)||pool.length<1||pool.length>CARDS.length||pool.some(id=>typeof id!=="string"||!CARDS.some(c=>c.id===id))||new Set(pool).size!==pool.length)throw new Error("능력을 1개 이상 중복 없이 선택해 주세요.");
  return CARDS.filter(c=>pool.includes(c.id)).map(c=>c.id);
}
export const other = (s: Side): Side => s === "w" ? "b" : "w";
export const sideName = (s: Side) => s === "w" ? "백" : "흑";
export const kindName: Record<Kind,string> = {p:"폰",n:"나이트",b:"비숍",r:"룩",q:"퀸",k:"킹"};
export const square = (i: number) => `${"abcdefgh"[i % 8]}${8 - Math.floor(i / 8)}`;
export function indexOf(s: string): number { if(!/^[a-h][1-8]$/.test(s)) throw new Error("올바른 칸을 입력해 주세요."); return (8-Number(s[1]))*8+"abcdefgh".indexOf(s[0]); }
export type Ability = { id:CardId|"hidden"; uses:number; active:boolean; castleCount:number; eligible:boolean; threats:number; rookId:string|null; power:null|{mode:"bn"|"q"|"qn";left:number;score:number}; burrow?:{piece:Piece;at:number}; ammo?:number; general?:{id:string;kills:number;knightId?:string;bishopId?:string}; fusion?:{id:string;doubleUses:number} };
export type Move = { from:number; to:number; special?:"castle"|"ep"; rookFrom?:number; rookTo?:number; capturedAt?:number };
export type Log = { n:number; side:Side; text:string; ability?:boolean; from?:number; to?:number };
export type Core = {
  onlineView?: {side:Side;moves:Record<number,Move[]>;targets:Record<string,number[]>};
  board:(Piece|null)[]; turn:Side; ply:number; abilities:Record<Side,Ability>;
  glow?:Side[];
  extraMove?:{side:Side;kind:"general"|"mountedKnight"|"mountedKing";ids:string[]};
  captured:Record<Side,Piece[]>; phase:"play"|"reaction"|"choice"|"duel"|"over";
  doubleLeft:number; ep:null|{target:number;pawn:number;for:Side}; ban:Record<Side,Move|null>;
  result:null|{winner:Side|"draw";reason:string}; pending:null|{owner:Side;chooser:Side;options:number[]};
  duel:null|{score:Record<Side,number>;picks:Record<Side,Gesture|null>;picked:Record<Side,boolean>;round:number;last:string};
  drawOffer:Side|null; log:Log[]; serial:number; lastAction:"move"|"ability"|null;
};
export type Game = Core & { revision:number; undo:{by:Side;move:Move;before:Core}[] };
// Choice abilities must remain indistinguishable, including after their result.
export function visibleAbilityId(g:Core,side:Side,viewer:Side):CardId|"hidden" {
  const a=g.abilities[side];
  if(a.id==="hidden"||a.id==="fiveAhead"||a.id==="conscienceTest")return "hidden";
  if(side===viewer||a.uses>0)return a.id;
  return "hidden";
}
export type Action = { type:"move"|"ability"|"reaction"|"choice"|"duel"|"resign"|"draw"|"acceptDraw"|"declineDraw"|"skipExtra"; from?:number;to?:number;piece?:number;capture?:number;promotion?:Kind;choice?:Side;gesture?:Gesture;mode?:"shot"|"burst" };
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
export function drawCards(pool:CardPool|"classic",requested?:{w?:CardId|"random";b?:CardId|"random"}):[CardId,CardId] {
  const normalized=normalizeCardPool(pool),ids=normalized==="all"?CARDS.map(c=>c.id):normalized;
  const random=(arr:CardId[])=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return arr[n[0]%arr.length];};
  for(const s of ["w","b"] as Side[])if(requested?.[s]&&requested[s]!=="random"&&!ids.includes(requested[s] as CardId))throw new Error("선택한 능력이 이 카드 묶음에 없습니다.");
  const w=requested?.w&&requested.w!=="random"?requested.w:random(ids.length===1?ids:ids.filter(id=>id!==requested?.b));
  const b=requested?.b&&requested.b!=="random"?requested.b:random(ids.length===1?ids:ids.filter(id=>id!==w));
  return [w,b];
}
export function isRoyal(g:Core,p:Piece):boolean {
  const a=g.abilities[p.color];
  if(a.id==="queenRule"&&a.active)return p.kind==="q";
  if(a.id==="reactionary"&&a.active)return p.id===a.rookId;
  return p.kind==="k";
}
export function movesFor(g:Core,from:number,attacks=false):Move[] {
  if(g.onlineView)return attacks?[]:g.onlineView.moves[from]??[];
  const p=g.board[from];if(!p)return [];
  const a=g.abilities[p.color],r=Math.floor(from/8),c=from%8,out:Move[]=[];
  if(!attacks&&g.extraMove?.side===p.color&&!g.extraMove.ids.includes(p.id))return [];
  const add=(nr:number,nc:number,extra:Partial<Move>={})=>{
    if(nr<0||nr>7||nc<0||nc>7)return;
    const to=nr*8+nc,t=g.board[to];if(attacks||!t||t.color!==p.color||a.id==="gatling"&&p.kind==="q"&&t.kind==="p")out.push({from,to,...extra});
  };
  const jump=(steps:number[][])=>steps.forEach(([dr,dc])=>add(r+dr,c+dc));
  const slide=(dirs:number[][])=>{for(const [dr,dc] of dirs){let nr=r+dr,nc=c+dc;while(nr>=0&&nr<8&&nc>=0&&nc<8){const t=g.board[nr*8+nc];add(nr,nc);if(t)break;nr+=dr;nc+=dc;}}};
  if(a.general?.id===p.id&&a.general.kills>=2)jump(kingSteps);
  else if(p.form){jump(knight);if(p.form==="prince")slide(straight);else jump(kingSteps);}
  else {
  if(p.kind==="p"){
    const dir=p.color==="w"?-1:1;
    const forward=a.id==="forwardPawns"&&a.active;
    for(const dc of forward?[0]:[-1,1]){
      const nr=r+dir,nc=c+dc;if(nr<0||nr>7||nc<0||nc>7)continue;
      const to=nr*8+nc,t=g.board[to];
      if(attacks||t&&t.color!==p.color)add(nr,nc);
      else if(!forward&&g.ep?.for===p.color&&g.ep.target===to&&g.board[g.ep.pawn]?.kind==="p")add(nr,nc,{special:"ep",capturedAt:g.ep.pawn});
    }
    if(r+dir>=0&&r+dir<8&&!g.board[(r+dir)*8+c]){
      if(!attacks)add(r+dir,c);
      if(!p.moved&&r===(p.color==="w"?6:1)){
        const target=g.board[(r+2*dir)*8+c];
        if(forward&&attacks||!attacks&&(!target||forward&&target.color!==p.color))add(r+2*dir,c);
      }
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
    if(!attacks&&!p.moved&&from===home&&!(a.id==="queenRule"&&a.active)){
      for(const [rc,dir] of [[0,-1],[7,1]]){
        const ri=r*8+rc,rook=g.board[ri];if(!rook||rook.kind!=="r"||rook.color!==p.color||rook.moved)continue;
        let free=true;for(let cc=c+dir;cc!==rc;cc+=dir)if(g.board[r*8+cc])free=false;
        if(free)add(r,c+2*dir,{special:"castle",rookFrom:ri,rookTo:from+dir});
      }
    }
  }
  }
  const unique=out.filter((m,i)=>out.findIndex(n=>n.to===m.to)===i);
  if(attacks)return unique;
  return unique.filter(m=>{
    const extra=g.extraMove;
    if(extra?.side===p.color&&extra.kind!=="general"){
      const dr=Math.floor(m.to/8)-r,dc=m.to%8-c;
      if(!(extra.kind==="mountedKnight"?knight:kingSteps).some(([rr,cc])=>rr===dr&&cc===dc))return false;
    }
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
export function generalAssignment(g:Core,s:Side):"n"|"b"|null {
  const a=g.abilities[s],army=a.general;
  if(!army||!g.board.some(p=>p?.id===army.id))return null;
  if(!army.knightId&&g.board.some(p=>p?.color===s&&p.kind==="n"&&p.id!==army.id))return "n";
  if(army.kills>=3&&!army.bishopId&&g.board.some(p=>p?.color===s&&p.kind==="b"&&p.id!==army.id))return "b";
  return null;
}
function followers(g:Core,s:Side):string[]{
  const army=g.abilities[s].general;if(!army)return [];
  return g.board.flatMap(p=>p?.color===s&&[army.knightId,army.bishopId].includes(p.id)?[p.id]:[]);
}
function jumpTargets(g:Core,from:number):number[]{
  const p=g.board[from];if(!p)return [];
  const out:number[]=[];
  for(const [dr,dc] of kingSteps){
    let r=Math.floor(from/8)+dr,c=from%8+dc,crossed=false;
    while(r>=0&&r<8&&c>=0&&c<8){
      const i=r*8+c,t=g.board[i];if(t?.color===p.color)break;
      if(t)crossed=true;else if(crossed&&!(g.ban[p.color]?.from===from&&g.ban[p.color]?.to===i))out.push(i);
      r+=dr;c+=dc;
    }
  }return out;
}
export function gatlingImpacts(g:Core,from:number):number[]{
  const p=g.board[from];if(!p)return [];
  const out:number[]=[];
  for(const [dr,dc] of kingSteps){
    let r=Math.floor(from/8)+dr,c=from%8+dc;
    while(r>=0&&r<8&&c>=0&&c<8){const t=g.board[r*8+c];if(t){if(t.color!==p.color)out.push(r*8+c);break;}r+=dr;c+=dc;}
  }return out;
}
export function blastArea(at:number):number[]{
  const out:number[]=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    const r=Math.floor(at/8)+dr,c=at%8+dc;if(r>=0&&r<8&&c>=0&&c<8)out.push(r*8+c);
  }return out;
}
export function abilityTargets(g:Core,s:Side,from?:number):number[] {
  if(g.onlineView)return s===g.onlineView.side?g.onlineView.targets[from===undefined?"start":String(from)]??[]:[];
  const a=g.abilities[s],id=a.id;
  const own=(kind?:Kind)=>g.board.flatMap((p,i)=>p?.color===s&&(!kind||p.kind===kind)?[i]:[]);
  if(id==="burrow")return a.burrow?g.board[a.burrow.at]?[]:[a.burrow.at]:own().filter(i=>!isRoyal(g,g.board[i]!)&&g.board[i]!.kind!=="k");
  if(id==="shiningKnight")return from===undefined?own().filter(i=>jumpTargets(g,i).length):g.board[from]?.color===s?jumpTargets(g,from):[];
  if(id==="shallNotPass")return own("b");
  if(id==="gatling")return from===undefined?own("q").filter(i=>gatlingImpacts(g,i).length):g.board[from]?.color===s&&g.board[from]?.kind==="q"?gatlingImpacts(g,from):[];
  if(id==="armyForward")return a.uses===1?own("r").filter(i=>i!==from):[];
  if(id==="mounted"){
    if(a.fusion)return [];
    const targets=own(s==="w"?"r":"k");
    return from===undefined?targets.length?own("n"):[]:g.board[from]?.color===s&&g.board[from]?.kind==="n"?targets:[];
  }
  if(id==="general"){
    const army=a.general;if(!army||!g.board.some(p=>p?.id===army.id))return [];
    const assign=generalAssignment(g,s);if(assign)return own(assign).filter(i=>g.board[i]!.id!==army.id);
    if(army.kills<4||g.extraMove)return [];
    const troops=followers(g,s);if(!troops.length)return [];
    return from===undefined?g.board.flatMap((p,i)=>p?.id===army.id?[i]:[]):g.board[from]?.id===army.id?g.board.flatMap((p,i)=>p&&troops.includes(p.id)?[i]:[]):[];
  }
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
  if(a.id==="burrow"&&a.burrow)return g.board[a.burrow.at]?"숨은 칸에 기물이 있어 나올 수 없습니다.":null;
  if(info.mode==="passive")return "조건을 만족하면 자동으로 발동합니다.";
  if((info.mode==="once"&&a.uses>=1)||(info.mode==="twice"&&a.uses>=2)||(info.mode==="thrice"&&a.uses>=3))return "모두 사용했습니다.";
  if(a.id==="temusanTimeStone")return g.undo.some(h=>h.by===s)?null:"되돌릴 내 이동이 없습니다.";
  const free=["burrow","forwardPawns","nothing"].includes(a.id)||a.id==="armyForward"&&a.uses===0||a.id==="mounted"&&!a.fusion;
  if(g.turn!==s&&!free)return "내 차례에 사용할 수 있습니다.";
  if(g.extraMove&&!free&&!(a.id==="general"&&generalAssignment(g,s)))return "추가 이동을 먼저 마치거나 건너뛰세요.";
  if(a.id==="mounted"&&a.fusion)return s!=="b"?"융합을 완료했습니다.":a.fusion.doubleUses>=2?"연속 이동을 모두 사용했습니다.":!g.board.some(p=>p?.id===a.fusion!.id)?"융합 기물이 없습니다.":null;
  if(a.id==="gatling"&&!(a.ammo??0))return "퀸으로 폰을 먹어 탄약을 충전하세요.";
  if(a.id==="armyForward"&&a.uses===1&&abilityTargets(g,s).length<2)return "다시 발동하려면 내 룩 2개가 필요합니다.";
  if(["burrow","shiningKnight","shallNotPass","gatling","mounted","general"].includes(a.id)&&!abilityTargets(g,s).length)return a.id==="general"?"장군의 포획 또는 지정 가능한 휘하 기물이 필요합니다.":"현재 사용할 수 있는 기물이 없습니다.";
  if(a.id==="noThatMove")return g.undo.at(-1)?.by===other(s)&&g.lastAction==="move"?null:"상대의 최근 행동이 이동이어야 합니다.";
  if(a.id==="necro"&&(!g.captured[s].length||!abilityTargets(g,s).length))return "잡은 적 기물과 킹 주변 빈칸이 필요합니다.";
  if(["spaceTravel","exorcism","equality"].includes(a.id)&&!abilityTargets(g,s).length)return "현재 사용할 수 있는 기물이 없습니다.";
  if(a.id==="queenRule"&&(!g.board.some(p=>p?.color===s&&p.kind==="q")||!g.board.some(p=>p?.color===s&&p.kind==="k")))return "살아 있는 킹과 퀸이 필요합니다.";
  return null;
}
function coreOf(g:Game):Core {const {revision,undo,...rest}=g;void revision;void undo;return clone(rest);}
function record(g:Game,s:Side,text:string,ability=false,move?:Move){g.log.push({n:++g.serial,side:s,text,ability,from:move?.from,to:move?.to});if(g.log.length>200)g.log.shift();}
function end(g:Game,winner:Side|"draw",reason:string){g.phase="over";g.result={winner,reason};g.pending=null;g.drawOffer=null;delete g.extraMove;}
function markMoved(g:Game,p:Piece){p.moved=true;const home=p.color==="w"?"1":"8";if(["a","e","h"].some(f=>p.id===p.color+f+home))g.abilities[p.color].eligible=false;}
function take(g:Game,i:number,by:Side){const p=g.board[i];if(p&&p.color!==by&&p.kind!=="k")g.captured[by].push(clone(p));g.board[i]=null;return p;}
function onCapture(g:Game,p:Piece,target:Piece){
  const a=g.abilities[p.color];
  if(a.id==="gatling"&&p.kind==="q"&&target.kind==="p")a.ammo=Math.min(8,(a.ammo??0)+1);
  if(a.id!=="general"||target.color===p.color)return;
  if(!a.general&&p.kind==="p"){a.general={id:p.id,kills:0};a.active=true;}
  const army=a.general;
  if(army&&[army.id,army.knightId,army.bishopId].includes(p.id)){
    army.kills++;record(g,p.color,`장군 부대 포획 ${army.kills}회`,true);
  }
}
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
function finishTurn(g:Game,by:Side){delete g.extraMove;g.doubleLeft=0;g.turn=other(by);}
function afterAction(g:Game,by:Side,fallenQueens:Side[]=[],generalMoved=false){
  resolveRoyals(g,fallenQueens);if(g.phase==="over")return;
  const defender=other(by),a=g.abilities[defender];
  if(a.id==="reactionary"&&a.active&&threatened(g,defender).length){a.threats++;record(g,by,`왕룩 위협 ${a.threats}/3`,true);if(a.threats>=3){end(g,by,"왕룩에 대한 위협이 3회 누적되었습니다.");return;}}
  if(defender==="b"&&a.id==="mounted"&&a.fusion&&g.board.filter(p=>p?.color==="b").length===1&&threatened(g,"b").length){
    a.threats++;record(g,by,`흑마 위협 ${a.threats}/5`,true);
    if(a.threats>=5){end(g,"w","흑마 탄 임금님이 홀로 남은 뒤 체크를 5회 받았습니다.");return;}
  }
  g.ply++;
  if(g.extraMove?.side===by){
    if(g.extraMove.kind==="mountedKnight"){
      g.extraMove.kind="mountedKing";
      const at=g.board.findIndex(p=>p&&g.extraMove!.ids.includes(p.id));
      if(g.phase==="play"&&at>=0&&movesFor(g,at).length)return;
    }
    finishTurn(g,by);return;
  }
  if(generalMoved&&g.phase==="play"){
    const army=g.abilities[by].general;
    if(army&&g.board.some(p=>p?.id===army.id)){
      const ids=followers(g,by);
      g.extraMove={side:by,kind:"general",ids};
      if(generalAssignment(g,by)||g.board.some((p,i)=>p&&ids.includes(p.id)&&movesFor(g,i).length))return;
      delete g.extraMove;
    }
  }
  if(g.doubleLeft>1)g.doubleLeft--;else finishTurn(g,by);
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
    const card=g.abilities[g.pending.owner].id;end(g,card==="fiveAhead"?other(action.choice):action.choice,"승리 색 선택 결과가 적용되었습니다.");g.revision++;return g;
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
  if(action.type==="skipExtra"){
    assert(g.turn===by&&g.extraMove?.side===by,"건너뛸 추가 이동이 없습니다.");
    assert(g.extraMove.kind!=="mountedKnight","나이트 이동을 먼저 해 주세요.");
    finishTurn(g,by);g.lastAction="ability";record(g,by,"추가 이동 건너뛰기",true);g.revision++;return g;
  }
  if(action.type==="draw"){assert(!g.drawOffer,"이미 무승부 제안이 있습니다.");g.drawOffer=by;record(g,by,"무승부 제안",true);g.revision++;return g;}
  if(action.type==="acceptDraw"||action.type==="declineDraw"){
    assert(g.drawOffer===other(by),"상대의 무승부 제안이 없습니다.");
    if(action.type==="acceptDraw")end(g,"draw","양쪽이 무승부에 동의했습니다.");else g.drawOffer=null;g.revision++;return g;
  }
  if(action.type==="ability"){
    const error=abilityError(g,by);assert(!error,error||"");
    if(a.id==="noThatMove"||a.id==="temusanTimeStone"){restoreMove(g,by,a.id);g.revision=previous.revision+1;return g;}
    let consumes=false;const fallenQueens:Side[]=[];g.drawOffer=null;
    let incrementUse=true;
    if(a.id==="wildHorse")a.active=true;
    else if(a.id==="doubleMove"){a.active=true;g.doubleLeft=2;}
    else if(a.id==="queenRule"||a.id==="forwardPawns")a.active=true;
    else if(a.id==="nothing"){a.active=true;g.glow=[...new Set([...(g.glow??[]),by])];}
    else if(a.id==="burrow"){
      if(a.burrow){
        assert(!g.board[a.burrow.at],"숨은 칸에 기물이 있어 나올 수 없습니다.");
        g.board[a.burrow.at]=a.burrow.piece;delete a.burrow;incrementUse=false;a.active=false;
      }else{
        assert(validSquare(action.from)&&abilityTargets(g,by).includes(action.from),"숨길 내 기물을 선택하세요. 킹은 숨길 수 없습니다.");
        a.burrow={at:action.from,piece:g.board[action.from]!};g.board[action.from]=null;a.active=true;
        if(g.ep?.pawn===action.from)g.ep=null;
      }
    }
    else if(a.id==="shiningKnight"){
      assert(validSquare(action.from)&&abilityTargets(g,by).includes(action.from),"뛰어넘을 내 기물을 선택하세요.");
      assert(validSquare(action.to)&&abilityTargets(g,by,action.from).includes(action.to),"상대 기물을 넘어 빈칸에 착지하세요.");
      const p=g.board[action.from]!;g.board[action.from]=null;g.board[action.to]=p;markMoved(g,p);promote(p,action.to,action.promotion);consumes=true;
    }
    else if(a.id==="armyForward"){
      if(a.uses===1){
        assert(validSquare(action.from)&&validSquare(action.to)&&action.from!==action.to&&[action.from,action.to].every(i=>g.board[i]?.color===by&&g.board[i]?.kind==="r"),"희생할 내 룩 두 개를 선택하세요.");
        take(g,action.from,by);take(g,action.to,by);consumes=true;
      }
      const dir=by==="w"?-8:8;
      // Determine every destination before moving: blocked pawns never follow into a vacated square.
      const advancing=g.board.flatMap((p,i)=>p?.color===by&&p.kind==="p"&&validSquare(i+dir)&&!g.board[i+dir]?[{p,from:i,to:i+dir}]:[]);
      for(const {p,from,to} of advancing){g.board[from]=null;g.board[to]=p;markMoved(g,p);promote(p,to,"q");}
      g.ep=null;a.active=true;
    }
    else if(a.id==="general"){
      const army=a.general;assert(army,"먼저 내 폰으로 상대 기물을 잡으세요.");
      assert(validSquare(action.from)&&abilityTargets(g,by).includes(action.from),"장군 또는 지정할 휘하 기물을 선택하세요.");
      const assign=generalAssignment(g,by);
      if(assign){
        if(assign==="n")army.knightId=g.board[action.from]!.id;else army.bishopId=g.board[action.from]!.id;
        if(g.extraMove?.kind==="general")g.extraMove.ids=followers(g,by);
      }else{
        assert(validSquare(action.to)&&abilityTargets(g,by,action.from).includes(action.to),"위치를 교환할 휘하 기물을 선택하세요.");
        [g.board[action.from],g.board[action.to]]=[g.board[action.to],g.board[action.from]];consumes=true;
      }
    }
    else if(a.id==="gatling"){
      assert(validSquare(action.from)&&abilityTargets(g,by).includes(action.from),"발사할 내 퀸을 선택하세요.");
      const impacts=gatlingImpacts(g,action.from),burst=action.mode==="burst";
      assert(action.mode===undefined||action.mode==="shot"||burst,"발사 방식을 확인하세요.");
      assert(!burst||(a.ammo??0)>=8,"범위 사격에는 8발이 필요합니다.");
      if(!burst)assert(validSquare(action.to)&&impacts.includes(action.to),"막히지 않은 방향의 첫 상대 기물을 선택하세요.");
      const centers=burst?impacts:[action.to!];
      // Resolve all rays against the same board; blast removal cannot make a ray penetrate.
      const targets=[...new Set(centers.flatMap(i=>burst?blastArea(i):[i]))];
      const hits=targets.filter(i=>g.board[i]?.color===other(by));
      for(const i of hits){const p=g.board[i]!;if(p.kind==="q"&&isRoyal(g,p))fallenQueens.push(p.color);take(g,i,by);}
      if(hits.length)explode(g,centers[0],by,fallenQueens);
      a.ammo=(a.ammo??0)-(burst?8:1);consumes=true;
    }
    else if(a.id==="shallNotPass"){
      assert(validSquare(action.from)&&abilityTargets(g,by).includes(action.from),"내 비숍을 선택하세요.");
      for(let i=action.from%8;i<64;i+=8){const p=g.board[i];if(p?.color===other(by)&&p.kind!=="k"){if(p.kind==="q"&&isRoyal(g,p))fallenQueens.push(p.color);take(g,i,by);}}
      consumes=true;
    }
    else if(a.id==="mounted"){
      if(!a.fusion){
        assert(validSquare(action.from)&&abilityTargets(g,by).includes(action.from),"융합할 내 나이트를 선택하세요.");
        assert(validSquare(action.to)&&abilityTargets(g,by,action.from).includes(action.to),by==="w"?"융합할 내 룩을 선택하세요.":"융합할 내 킹을 선택하세요.");
        const p=g.board[action.to]!;markMoved(g,g.board[action.from]!);markMoved(g,p);p.form=by==="w"?"prince":"emperor";g.board[action.from]=null;
        a.fusion={id:p.id,doubleUses:0};a.active=true;
      }else{
        assert(by==="b"&&a.fusion.doubleUses<2,"연속 이동을 사용할 수 없습니다.");
        const at=g.board.findIndex(p=>p?.id===a.fusion!.id);
        g.extraMove={side:by,kind:"mountedKnight",ids:[a.fusion.id]};
        assert(at>=0&&movesFor(g,at).length,"가능한 나이트 이동이 없습니다.");
        a.fusion.doubleUses++;incrementUse=false;
      }
    }
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
      if(a.castleCount>=7)end(g,by,"평등국가 · 히든 승리");
    }else throw new Error("자동 발동 능력입니다.");
    if(incrementUse)a.uses++;g.lastAction="ability";record(g,by,`${cardInfo(a.id).name}${action.from!==undefined?" · "+square(action.from):""}${action.to!==undefined?" → "+square(action.to):""}`,true);
    if(consumes){g.ep=null;g.ban[by]=null;if(!g.result)afterAction(g,by,fallenQueens);}
    else if(!g.result)resolveRoyals(g,fallenQueens);
    g.revision=previous.revision+1;return g;
  }
  assert(action.type==="move","지원하지 않는 동작입니다.");assert(g.turn===by,"내 차례가 아닙니다.");
  assert(validSquare(action.from)&&validSquare(action.to),"출발칸과 도착칸을 확인해 주세요.");
  const p=g.board[action.from];assert(p&&p.color===by,"내 기물을 선택해 주세요.");
  const move=movesFor(g,action.from).find(m=>m.to===action.to);assert(move,"이 기물은 그 칸으로 이동할 수 없습니다.");
  const snapshot=coreOf(g);const capturedAt=move.capturedAt??move.to;const target=take(g,capturedAt,by);
  const fallenQueens:Side[]=[];if(target?.kind==="q"&&isRoyal(g,target))fallenQueens.push(target.color);
  if(target)onCapture(g,p,target);
  g.board[move.from]=null;g.board[move.to]=p;markMoved(g,p);
  if(!(a.general?.id===p.id&&a.general.kills>=2))promote(p,move.to,action.promotion);
  if(move.special==="castle"){const rook=g.board[move.rookFrom!]!;g.board[move.rookFrom!]=null;g.board[move.rookTo!]=rook;markMoved(g,rook);}
  g.ep=null;if(p.kind==="p"&&!(a.general?.id===p.id&&a.general.kills>=2)&&Math.abs(move.to-move.from)===16)g.ep={target:(move.from+move.to)/2,pawn:move.to,for:other(by)};
  if(target&&target.color!==by)explode(g,move.to,by,fallenQueens);
  if(p.kind==="k"&&a.power){a.power.left--;if(a.power.left<=0)a.power=null;}
  g.ban[by]=null;g.drawOffer=null;g.lastAction="move";
  record(g,by,`${kindName[snapshot.board[move.from]!.kind]} ${square(move.from)} ${target?"×":"→"} ${square(move.to)}${p.kind!==snapshot.board[move.from]!.kind?" = "+kindName[p.kind]:""}${move.special==="castle"?" · 캐슬링":move.special==="ep"?" · 앙파상":""}`,false,move);
  g.undo.push({by,move,before:snapshot});g.undo=g.undo.slice(-4);afterAction(g,by,fallenQueens,a.general?.id===p.id);
  g.revision=previous.revision+1;return g;
}
export function publicGame(g:Game,viewer?:Side):Game {
  const out=clone(g);if(out.duel)out.duel.picks={w:null,b:null};
  if(viewer){
    const opponent=other(viewer),hidden=g.abilities[opponent];
    out.onlineView={side:viewer,moves:{},targets:{start:abilityTargets(g,viewer)}};
    g.board.forEach((p,i)=>{if(p?.color===viewer){out.onlineView!.moves[i]=movesFor(g,i);out.onlineView!.targets[String(i)]=abilityTargets(g,viewer,i);}});
    out.abilities[opponent]={id:"hidden",uses:0,active:false,castleCount:0,eligible:false,threats:0,rookId:null,power:null};
    out.board.forEach(p=>{if(p?.color===opponent)delete p.form;});
    out.captured.w.forEach(p=>{delete p.form;});out.captured.b.forEach(p=>{delete p.form;});
    if(out.extraMove?.side===opponent)delete out.extraMove;
    out.log=out.log.map(entry=>entry.ability&&(entry.side===opponent||entry.text.includes(cardInfo(hidden.id).name)||hidden.id==="reactionary"&&entry.text.includes("왕룩")||hidden.id==="mounted"&&entry.text.includes("흑마"))?{n:entry.n,side:entry.side,text:"능력 관련 행동",ability:true}:entry);
    if(out.result&&(out.result.reason.includes(cardInfo(hidden.id).name)||hidden.id==="reactionary"&&out.result.reason.includes("왕룩")||hidden.id==="mounted"&&out.result.reason.includes("흑마")))out.result.reason="능력 효과로 대국이 종료되었습니다.";
    if(out.pending&&out.pending.chooser!==viewer)out.pending.options=[];
  }
  // Clients receive availability metadata, never a state snapshot they can send back.
  out.undo=out.undo.map(h=>({by:h.by,move:h.move,before:null as unknown as Core}));return out;
}
