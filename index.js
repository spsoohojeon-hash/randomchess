
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
  let filePath = req.url.split("?")[0];
  if (filePath === "/") filePath = "/index.html";
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=UTF-8",
    ".js": "text/javascript; charset=UTF-8",
    ".css": "text/css; charset=UTF-8",
    ".json": "application/json; charset=UTF-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon"
  };
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=UTF-8" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = {};
const CARD_POOL = ["necro","wildHorse","spaceTravel","doubleMove","equality","reactionary","exorcism","kingReturn"];

function makeRoomId(){return Math.random().toString(36).substring(2,8).toUpperCase()}
function safeText(text,max=30){return String(text||"").replace(/[<>]/g,"").trim().slice(0,max)}
function drawCards(){const s=[...CARD_POOL].sort(()=>Math.random()-.5);return{white:s[0],black:s[1]}}
function createBoard(){return [["br","bn","bb","bq","bk","bb","bn","br"],["bp","bp","bp","bp","bp","bp","bp","bp"],["","","","","","","",""],["","","","","","","",""],["","","","","","","",""],["","","","","","","",""],["wp","wp","wp","wp","wp","wp","wp","wp"],["wr","wn","wb","wq","wk","wb","wn","wr"]]}
function createRoom(o={}){return{id:o.id||makeRoomId(),name:safeText(o.name||"이름 없는 방",30),password:String(o.password||""),private:!!o.private,hostName:safeText(o.hostName||"unknown",20),started:false,players:[],board:createBoard(),cards:drawCards(),turn:"white",over:false,enPassant:null,moved:{wk:false,wrA:false,wrH:false,bk:false,brA:false,brH:false},doubleMove:{white:0,black:0},wildHorse:{white:false,black:false},usedCards:{white:false,black:false},kingReturn:{white:null,black:null},reactionary:{white:{active:false,rook:null,checks:0},black:{active:false,rook:null,checks:0}},capturedBy:{white:[],black:[]},spaceTravel:{white:false,black:false},equalityUses:{white:0,black:0}}}
function getPublicRoomList(){return Object.entries(rooms).filter(([id,r])=>!r.started&&!r.over&&!r.private).map(([id,r])=>({id,name:r.name,hasPassword:!!r.password,players:r.players.length,maxPlayers:2,hostName:r.hostName}))}
function send(ws,data){if(ws&&ws.readyState===ws.OPEN)ws.send(JSON.stringify(data))}
function broadcast(room,data){room.players.forEach(p=>send(p.ws,data))}
function otherColor(c){return c==="white"?"black":"white"}
function clearPath(board,from,to){const sr=Math.sign(to.r-from.r),sc=Math.sign(to.c-from.c);let r=from.r+sr,c=from.c+sc;while(r!==to.r||c!==to.c){if(board[r][c])return false;r+=sr;c+=sc}return true}
function validElephantMove(board,from,to){const dr=to.r-from.r,dc=to.c-from.c;return [[3,2],[3,-2],[-3,2],[-3,-2],[2,3],[-2,3],[2,-3],[-2,-3]].some(([r,c])=>r===dr&&c===dc)}
function validMove(room,from,to,color){
 const b=room.board,p=b[from.r]?.[from.c];if(!p||p[0]!==color[0])return false;const target=b[to.r]?.[to.c];if(target&&target[0]===color[0])return false;
 const dr=to.r-from.r,dc=to.c-from.c,ar=Math.abs(dr),ac=Math.abs(dc),type=p[1];
 if(type==="p"){const dir=color==="white"?-1:1,start=color==="white"?6:1;if(dc===0&&!target&&dr===dir)return"normal";if(dc===0&&!target&&from.r===start&&dr===dir*2&&!b[from.r+dir][from.c])return"doublePawn";if(ac===1&&dr===dir&&target)return"normal";if(ac===1&&dr===dir&&!target&&room.enPassant?.r===to.r&&room.enPassant?.c===to.c)return"enPassant";return false}
 if(type==="r")return(dr===0||dc===0)&&clearPath(b,from,to)?"normal":false;
 if(type==="b")return ar===ac&&clearPath(b,from,to)?"normal":false;
 if(type==="q")return(dr===0||dc===0||ar===ac)&&clearPath(b,from,to)?"normal":false;
 if(type==="n"){if(room.wildHorse?.[color])return validElephantMove(b,from,to)?"normal":false;return((ar===2&&ac===1)||(ar===1&&ac===2))?"normal":false}
 if(type==="k"){
  const kr=room.kingReturn?.[color];
  if(kr&&kr.turns>0){if((kr.mode==="bn"||kr.mode==="qn")&&((ar===2&&ac===1)||(ar===1&&ac===2)))return"normal";if(kr.mode==="bn"&&ar===ac&&clearPath(b,from,to))return"normal";if((kr.mode==="q"||kr.mode==="qn")&&(dr===0||dc===0||ar===ac)&&clearPath(b,from,to))return"normal"}
  if(ar<=1&&ac<=1)return"normal";
  if(color==="white"&&from.r===7&&from.c===4&&dr===0){if(dc===2&&!room.moved.wk&&!room.moved.wrH&&b[7][5]===""&&b[7][6]===""&&b[7][7]==="wr")return"castleKing";if(dc===-2&&!room.moved.wk&&!room.moved.wrA&&b[7][1]===""&&b[7][2]===""&&b[7][3]===""&&b[7][0]==="wr")return"castleQueen"}
  if(color==="black"&&from.r===0&&from.c===4&&dr===0){if(dc===2&&!room.moved.bk&&!room.moved.brH&&b[0][5]===""&&b[0][6]===""&&b[0][7]==="br")return"castleKing";if(dc===-2&&!room.moved.bk&&!room.moved.brA&&b[0][1]===""&&b[0][2]===""&&b[0][3]===""&&b[0][0]==="br")return"castleQueen"}
 }
 return false
}
function updateMoved(room,p,from){if(p==="wk")room.moved.wk=true;if(p==="bk")room.moved.bk=true;if(p==="wr"&&from.r===7&&from.c===0)room.moved.wrA=true;if(p==="wr"&&from.r===7&&from.c===7)room.moved.wrH=true;if(p==="br"&&from.r===0&&from.c===0)room.moved.brA=true;if(p==="br"&&from.r===0&&from.c===7)room.moved.brH=true}
function isReactionaryRook(room,color,r,c){const s=room.reactionary[color];return !!(s&&s.active&&s.rook&&s.rook.r===r&&s.rook.c===c)}
function canAttackSquare(room,from,to,color){const b=room.board,p=b[from.r]?.[from.c];if(!p||p[0]!==color[0])return false;const dr=to.r-from.r,dc=to.c-from.c,ar=Math.abs(dr),ac=Math.abs(dc),t=p[1];if(t==="p"){const dir=color==="white"?-1:1;return ar===1&&dr===dir}if(t==="r")return(dr===0||dc===0)&&clearPath(b,from,to);if(t==="b")return ar===ac&&clearPath(b,from,to);if(t==="q")return(dr===0||dc===0||ar===ac)&&clearPath(b,from,to);if(t==="n")return room.wildHorse?.[color]?validElephantMove(b,from,to):(ar===2&&ac===1)||(ar===1&&ac===2);if(t==="k")return ar<=1&&ac<=1;return false}
function isSquareAttacked(room,target,byColor){for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=room.board[r][c];if(p&&p[0]===byColor[0]&&canAttackSquare(room,{r,c},target,byColor))return true}return false}
function updateReactionaryRookAfterMove(room,color,from,to,moveType){const s=room.reactionary[color];if(!s||!s.active||!s.rook)return;if(s.rook.r===from.r&&s.rook.c===from.c)s.rook={r:to.r,c:to.c};if(moveType==="castleKing"){const row=color==="white"?7:0;if(s.rook.r===row&&s.rook.c===7)s.rook={r:row,c:5}}if(moveType==="castleQueen"){const row=color==="white"?7:0;if(s.rook.r===row&&s.rook.c===0)s.rook={r:row,c:3}}}
function checkReactionaryThreat(room,attackerColor){const defender=otherColor(attackerColor),s=room.reactionary[defender];if(!s||!s.active||!s.rook)return null;if(isSquareAttacked(room,s.rook,attackerColor)){s.checks++;if(s.checks>=3){room.over=true;return attackerColor}}return null}
function getReactionaryOptions(room,color){const r=[];if(color==="white"){if(room.moved.wk||room.moved.wrA||room.moved.wrH)return r;if(room.board[7]?.[0]==="wr")r.push({r:7,c:0,type:"normal"});if(room.board[7]?.[7]==="wr")r.push({r:7,c:7,type:"normal"})}if(color==="black"){if(room.moved.bk||room.moved.brA||room.moved.brH)return r;if(room.board[0]?.[0]==="br")r.push({r:0,c:0,type:"normal"});if(room.board[0]?.[7]==="br")r.push({r:0,c:7,type:"normal"})}return r}
function tryTriggerReactionaryAfterKingCapture(room,defenderColor){if(room.cards[defenderColor]!=="reactionary")return false;if(room.reactionary[defenderColor]?.active)return false;const options=getReactionaryOptions(room,defenderColor);if(options.length===0)return false;room.turn=defenderColor;broadcast(room,makeUpdatePayload(room));const defender=room.players.find(p=>p.color===defenderColor);if(defender)send(defender.ws,{type:"reactionaryRequest",color:defenderColor,board:room.board,turn:room.turn,options,message:"킹이 잡혔습니다. 반동분자로 왕룩을 선택하세요."});return true}
function makeUpdatePayload(room){return{type:"update",board:room.board,turn:room.turn,enPassant:room.enPassant,moved:room.moved,doubleMove:room.doubleMove,wildHorse:room.wildHorse,kingReturn:room.kingReturn,reactionary:room.reactionary,capturedBy:room.capturedBy,spaceTravel:room.spaceTravel,usedCards:room.usedCards,equalityUses:room.equalityUses,roomId:room.id,roomName:room.name}}
function finishGame(room,winner){room.over=true;broadcast(room,{type:"gameover",winner,board:room.board})}
function startGame(room){room.started=true;room.players.forEach(p=>send(p.ws,{type:"start",roomId:room.id,roomName:room.name,color:p.color,board:room.board,turn:room.turn,enPassant:room.enPassant,moved:room.moved,card:room.cards[p.color],capturedPieces:room.capturedBy[p.color],spaceTravelEnabled:room.spaceTravel[p.color],equalityUses:room.equalityUses,players:room.players.map(x=>({color:x.color,name:x.name}))}))}

wss.on("connection",ws=>{
 let roomId=null,color=null;
 ws.on("message",msg=>{
  let data;try{data=JSON.parse(msg.toString())}catch{send(ws,{type:"error",message:"잘못된 메시지 형식입니다."});return}
  if(data.type==="listRooms"){send(ws,{type:"roomList",rooms:getPublicRoomList()});return}
  if(data.type==="createRoom"){const id=makeRoomId();rooms[id]=createRoom({id,name:data.name,password:data.password,private:data.private,hostName:data.playerName});send(ws,{type:"roomCreated",roomId:id,roomName:rooms[id].name});return}
  if(data.type==="join"){
   roomId=data.roomId;if(!roomId||!rooms[roomId]){send(ws,{type:"error",message:"존재하지 않는 방입니다."});return}
   const room=rooms[roomId];if(room.players.length>=2||room.started){send(ws,{type:"full"});return}
   if(room.password&&String(data.password||"")!==room.password){send(ws,{type:"wrongPassword",message:"비밀번호가 틀렸습니다."});return}
   color=room.players.length===0?"white":"black";room.players.push({ws,color,name:safeText(data.playerName||"player",20)});
   if(room.players.length===1){send(ws,{type:"waiting",roomId,roomName:room.name,message:"상대 기다리는 중..."});return}
   startGame(room);return
  }
  const room=rooms[roomId];if(!room||room.over)return;
  if(data.type==="card"){
   if(data.card!==room.cards[color]){send(ws,{type:"error",message:"네 카드가 아닙니다."});return}
   if(data.card==="equality"||data.card==="reactionary"){broadcast(room,makeUpdatePayload(room));return}
   if(data.card==="spaceTravel"){room.spaceTravel[color]=true;broadcast(room,makeUpdatePayload(room));return}
   if(room.usedCards[color]){send(ws,{type:"error",message:"이미 카드를 사용했습니다."});return}
   if(data.card==="doubleMove"){if(room.turn!==color){send(ws,{type:"error",message:"더블무브는 내 턴에만 사용할 수 있습니다."});return}room.doubleMove[color]=2}
   if(data.card==="wildHorse")room.wildHorse[color]=true;
   room.usedCards[color]=true;broadcast(room,makeUpdatePayload(room));return
  }
  if(data.type==="move"){
   if(room.turn!==color){send(ws,{type:"error",message:"네 차례가 아님"});return}
   const {from,to}=data,moveType=validMove(room,from,to,color);if(!moveType){send(ws,{type:"error",message:"불가능한 이동"});return}
   const b=room.board,moving=b[from.r][from.c];let captured=b[to.r][to.c],capturedForNecro=captured;const opponent=otherColor(color);
   if(room.doubleMove[color]>0&&captured&&captured[1]==="k"){send(ws,{type:"error",message:"더블무브 중에는 킹을 잡을 수 없습니다."});return}
   if(captured&&isReactionaryRook(room,opponent,to.r,to.c)){finishGame(room,color);return}
   updateMoved(room,moving,from);room.enPassant=null;
   if(moveType==="enPassant"){const capRow=color==="white"?to.r+1:to.r-1;captured=b[capRow][to.c];capturedForNecro=captured;if(captured&&isReactionaryRook(room,opponent,capRow,to.c)){finishGame(room,color);return}b[capRow][to.c]=""}
   b[to.r][to.c]=moving;b[from.r][from.c]="";
   if(capturedForNecro&&capturedForNecro[0]!==moving[0]&&capturedForNecro[1]!=="k")room.capturedBy[color].push(capturedForNecro);
   if(moveType==="doublePawn"){const dir=color==="white"?-1:1;room.enPassant={r:from.r+dir,c:from.c}}
   if(moveType==="castleKing"){const row=color==="white"?7:0;b[row][5]=b[row][7];b[row][7]=""}
   if(moveType==="castleQueen"){const row=color==="white"?7:0;b[row][3]=b[row][0];b[row][0]=""}
   if(moving[1]==="p"&&(to.r===0||to.r===7)){const allowed=["q","r","b","n"],promoteTo=allowed.includes(data.promoteTo)?data.promoteTo:"q";b[to.r][to.c]=moving[0]+promoteTo}
   if(captured&&captured[1]==="k"){if(tryTriggerReactionaryAfterKingCapture(room,opponent))return;finishGame(room,color);return}
   if(moving[1]==="k"&&room.kingReturn[color]){room.kingReturn[color].turns--;if(room.kingReturn[color].turns<=0)room.kingReturn[color]=null}
   updateReactionaryRookAfterMove(room,color,from,to,moveType);const rw=checkReactionaryThreat(room,color);if(rw){finishGame(room,rw);return}
   if(room.doubleMove[color]>1)room.doubleMove[color]--;else{room.doubleMove[color]=0;room.turn=room.turn==="white"?"black":"white"}
   broadcast(room,makeUpdatePayload(room));return
  }
  if(data.type==="cardUpdate"){
   room.board=data.board;room.turn=data.turn;room.enPassant=data.enPassant||null;room.moved=data.moved||room.moved;
   if(Array.isArray(data.necroCapturedPieces))room.capturedBy[color]=data.necroCapturedPieces;if("spaceTravelEnabled"in data)room.spaceTravel[color]=!!data.spaceTravelEnabled;if("kingReturn"in data)room.kingReturn[color]=data.kingReturn;if("reactionary"in data)room.reactionary[color]=data.reactionary;
   if(data.equalityUsed){room.equalityUses[color]++;if(room.equalityUses[color]>=10){finishGame(room,color);return}}
   broadcast(room,makeUpdatePayload(room));return
  }
  if(data.type==="resign"){finishGame(room,color==="white"?"black":"white");return}
 });
 ws.on("close",()=>{const room=rooms[roomId];if(!room)return;room.players=room.players.filter(p=>p.ws!==ws);if(room.players.length===0)delete rooms[roomId];else if(!room.over)broadcast(room,{type:"error",message:"상대 연결이 끊겼습니다."})})
});
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log("Server running on",PORT));
