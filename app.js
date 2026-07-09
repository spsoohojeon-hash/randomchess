import {
  createCardState,
  useCard,
  getWildHorseMoves,
  getVersatileRookMoves,
  getCardName,
  getCardDescription
} from "./cards.js";

window.onerror = (msg, src, line) => alert("에러: " + msg + "\nline: " + line);

const Game = (() => {
  const SERVER = "wss://randomchess.onrender.com";

  let ws = null;
  let board = [];
  let turn = "white";
  let selected = null;
  let moves = [];
  let localMode = true;
  let myColor = null;
  let roomCode = null;
  let enPassant = null;
  let myCard = null;
  let cardState = createCardState();
  let pendingCardUse = null;
  let pendingUndoType = null;
  let promotionResolve = null;
  let resultChoiceState = null;
  let quickDuelState = null;
  let moveHistory = [];
  let forbiddenMove = { white: null, black: null };

  let moved = { wk:false, wrA:false, wrH:false, bk:false, brA:false, brH:false };
  let equalityUses = { white:0, black:0 };

  const imgs = {
    wp:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wp.png",
    wr:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wr.png",
    wn:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wn.png",
    wb:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wb.png",
    wq:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wq.png",
    wk:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wk.png",
    bp:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bp.png",
    br:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/br.png",
    bn:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bn.png",
    bb:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bb.png",
    bq:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bq.png",
    bk:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bk.png"
  };

  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function opp(c){ return c === "white" ? "black" : "white"; }
  function pref(c){ return c === "white" ? "w" : "b"; }
  function pcolor(p){ return !p ? null : p[0] === "w" ? "white" : "black"; }
  function sq(r,c){ return `${String.fromCharCode(97+c)}${8-r}`; }
  function sameSq(a,b){ return a && b && a.r === b.r && a.c === b.c; }
  function sameMove(a,b){ return a && b && sameSq(a.from,b.from) && sameSq(a.to,b.to); }
  function pname(p){ return ({p:"폰",r:"룩",n:"나이트",b:"비숍",q:"퀸",k:"킹"})[p?.[1]] || "기물"; }

  function createBoard(){
    return [
      ["br","bn","bb","bq","bk","bb","bn","br"],
      ["bp","bp","bp","bp","bp","bp","bp","bp"],
      ["","","","","","","",""],
      ["","","","","","","",""],
      ["","","","","","","",""],
      ["","","","","","","",""],
      ["wp","wp","wp","wp","wp","wp","wp","wp"],
      ["wr","wn","wb","wq","wk","wb","wn","wr"]
    ];
  }

  function setStatus(t){ const el=document.getElementById("status"); if(el) el.textContent=t; }
  function showGame(){ document.getElementById("menu")?.classList.add("hidden"); document.getElementById("game")?.classList.remove("hidden"); }
  function backMenu(){ closeAllCardModals(); document.getElementById("game")?.classList.add("hidden"); document.getElementById("menu")?.classList.remove("hidden"); }

  function closeAllCardModals(){
    ["promotionModal","necroModal","exorcismModal","reactionaryModal","spaceModal","choiceResultModal","quickDuelModal","undoMoveModal"].forEach(id=>document.getElementById(id)?.classList.add("hidden"));
  }

  function resetState(){
    board=createBoard(); turn="white"; selected=null; moves=[]; enPassant=null;
    myCard=null; cardState=createCardState(); pendingCardUse=null; pendingUndoType=null;
    resultChoiceState=null; quickDuelState=null; moveHistory=[];
    forbiddenMove={white:null,black:null};
    moved={wk:false,wrA:false,wrH:false,bk:false,brA:false,brH:false};
    equalityUses={white:0,black:0}; closeAllCardModals();
  }

  function randomLocalCard(){
    const ids=["fiveAhead","bombLauncher","noThatMove","extremeEfficiency","quickDuel","queenRule","temusanTimeStone","versatile","conscienceTest","necro","wildHorse","spaceTravel","doubleMove","equality","reactionary","exorcism","kingReturn"];
    return ids[Math.floor(Math.random()*ids.length)];
  }

  function applyExtremeEfficiency(color){
    const p=pref(color), row=color==="white"?7:0;
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const pc=board[r][c];
      if(pc && pc[0]===p && pc[1]!=="k" && pc[1]!=="q") board[r][c]="";
    }
    board[row][0]=p+"q"; board[row][3]=p+"q"; board[row][4]=p+"k"; board[row][7]=p+"q";
    cardState.extremeEfficiencyActive=true;
  }

  function applyLocalPassives(){
    if(myCard==="extremeEfficiency") applyExtremeEfficiency("white");
    if(myCard==="versatile") cardState.versatileActive=true;
    if(myCard==="fiveAhead") openResultChoiceModal({card:"fiveAhead",owner:"white",chooser:"black",local:true});
    if(myCard==="conscienceTest") openResultChoiceModal({card:"conscienceTest",owner:"white",chooser:"black",local:true});
  }

  function startLocal(){
    localMode=true; myColor=null; roomCode=null; resetState(); myCard=randomLocalCard(); applyLocalPassives(); showGame(); renderCard(); render();
  }

  function connectSocket(onOpen){
    if(ws && ws.readyState===WebSocket.OPEN){ onOpen?.(); return; }
    if(ws){ try{ws.close();}catch{} }
    ws=new WebSocket(SERVER);
    ws.onopen=()=>onOpen?.();
    ws.onerror=err=>{ console.log("WebSocket error",err); alert("서버 연결 에러"); };
    ws.onclose=()=>console.log("서버 연결 끊김");
    ws.onmessage=e=>handleServerMessage(JSON.parse(e.data));
  }

  function makeRoom(){
    const code=Math.random().toString(36).substring(2,8).toUpperCase();
    const input=document.getElementById("roomInput"); if(input) input.value=code;
    alert("방 코드: "+code); localMode=false; roomCode=code;
    connectSocket(()=>ws.send(JSON.stringify({type:"join",roomId:code})));
  }

  function joinOnline(){
    const code=document.getElementById("roomInput")?.value.trim().toUpperCase();
    if(!code){ alert("방 코드를 입력해라."); return; }
    localMode=false; roomCode=code;
    connectSocket(()=>ws.send(JSON.stringify({type:"join",roomId:code})));
  }

  function handleServerMessage(d){
    if(d.type==="waiting"){
      showGame(); setStatus(d.message||"상대 기다리는 중...");
      const bd=document.getElementById("board"); if(bd) bd.innerHTML="";
      return;
    }
    if(d.type==="start"){
      myCard=d.card; myColor=d.color; board=d.board; turn=d.turn; enPassant=d.enPassant||null; moved=d.moved||moved;
      cardState=createCardState();
      if(d.capturedPieces) cardState.necroCapturedPieces=d.capturedPieces;
      cardState.spaceTravelEnabled=!!d.spaceTravelEnabled;
      cardState.bombLauncherUsed=!!d.bombLauncherUsed;
      cardState.noThatMoveUses=d.noThatMoveUses??2;
      cardState.temusanTimeStoneUses=d.temusanTimeStoneUses??2;
      cardState.queenRuleActive=!!d.queenRuleActive;
      cardState.versatileActive=!!d.versatileActive;
      cardState.extremeEfficiencyActive=!!d.extremeEfficiencyActive;
      if(d.equalityUses) equalityUses=d.equalityUses;
      showGame(); renderCard(); render(); return;
    }
    if(d.type==="update"){
      board=d.board; turn=d.turn; enPassant=d.enPassant||null; moved=d.moved||moved;
      if(d.doubleMove&&myColor){ cardState.doubleMoveLeft=d.doubleMove[myColor]; cardState.doubleMoveActive=cardState.doubleMoveLeft>0; }
      if(d.wildHorse&&myColor) cardState.wildHorse=d.wildHorse[myColor];
      if(d.kingReturn&&myColor) cardState.kingReturn=d.kingReturn[myColor]||null;
      if(d.capturedBy&&myColor) cardState.necroCapturedPieces=d.capturedBy[myColor]||[];
      if(d.spaceTravel&&myColor) cardState.spaceTravelEnabled=!!d.spaceTravel[myColor];
      if(d.equalityUses) equalityUses=d.equalityUses;
      if(d.bombLauncherUsed&&myColor) cardState.bombLauncherUsed=!!d.bombLauncherUsed[myColor];
      if(d.noThatMoveUses&&myColor) cardState.noThatMoveUses=d.noThatMoveUses[myColor];
      if(d.temusanTimeStoneUses&&myColor) cardState.temusanTimeStoneUses=d.temusanTimeStoneUses[myColor];
      if(d.queenRule&&myColor) cardState.queenRuleActive=!!d.queenRule[myColor];
      if(d.versatile&&myColor) cardState.versatileActive=!!d.versatile[myColor];
      if(d.extremeEfficiency&&myColor) cardState.extremeEfficiencyActive=!!d.extremeEfficiency[myColor];
      if(d.forbiddenMove) forbiddenMove=d.forbiddenMove;
      if(d.usedCards&&myColor&&d.usedCards[myColor]&&!keepAfterUse(myCard)) myCard=null;
      selected=null; moves=[]; renderCard(); render(); return;
    }
    if(d.type==="resultChoiceRequest"){
      openResultChoiceModal({card:d.card,owner:d.owner,chooser:d.chooser,title:d.title,message:d.message,local:false}); return;
    }
    if(d.type==="bombActivated"){ alert(`${d.owner}의 폭탄 발사대 발동!`); return; }
    if(d.type==="moveUndone"){
      alert(d.reason==="noThatMove"?"그 수 하지 마 발동!":"테무산 타임스톤 발동!"); return;
    }
    if(d.type==="quickDuelStart"){
      quickDuelState={round:d.round||1,score:d.score||{white:0,black:0},picked:false}; openQuickDuelModal(); return;
    }
    if(d.type==="quickDuelPicked"){ updateQuickDuelStatus("선택 완료. 상대 선택 대기 중..."); return; }
    if(d.type==="quickDuelRound"){
      alert(`묵찌빠 ${d.round}라운드\n백: ${d.whiteText}\n흑: ${d.blackText}\n결과: ${d.roundWinner?d.roundWinner+" 승":"무승부"}`);
      quickDuelState={round:d.round,score:d.score,picked:false};
      updateQuickDuelStatus(`현재 스코어 - 백 ${d.score.white} : 흑 ${d.score.black}`); return;
    }
    if(d.type==="quickDuelNext"){
      quickDuelState={round:d.round,score:d.score,picked:false};
      updateQuickDuelStatus(`${d.round}라운드 선택하세요. 백 ${d.score.white} : 흑 ${d.score.black}`); return;
    }
    if(d.type==="gameover"){
      board=d.board||board; closeAllCardModals(); render();
      let reason="";
      if(d.reason==="queenRule") reason="\n여왕 통치 룰로 퀸이 잡혔습니다.";
      if(d.reason==="quickDuel") reason="\n속전속결 묵찌빠 승리.";
      if(d.reason==="fiveAhead") reason="\n5수 앞 결과 적용.";
      if(d.reason==="conscienceTest") reason="\n양심테스트 결과 적용.";
      alert("게임 끝! 승자: "+d.winner+reason); return;
    }
    if(d.type==="full"){ alert("방이 가득 참"); return; }
    if(d.type==="error") alert(d.message||"서버 오류");
  }

  function keepAfterUse(card){
    return ["equality","reactionary","spaceTravel","bombLauncher","versatile","extremeEfficiency","fiveAhead","conscienceTest"].includes(card);
  }

  function syncCardUpdate(equalityUsed=false){
    if(!localMode&&ws&&ws.readyState===WebSocket.OPEN){
      ws.send(JSON.stringify({
        type:"cardUpdate", board, turn, enPassant, moved,
        necroCapturedPieces:cardState.necroCapturedPieces,
        kingReturn:cardState.kingReturn,
        reactionary:{active:cardState.reactionaryActive,rook:cardState.reactionaryRook,checks:cardState.reactionaryChecks},
        spaceTravelEnabled:cardState.spaceTravelEnabled,
        queenRuleActive:cardState.queenRuleActive,
        versatileActive:cardState.versatileActive,
        equalityUsed
      }));
    }
  }

  function consumeCurrentCard(){
    const used=pendingCardUse||myCard; if(!used) return;
    if(!localMode&&ws&&ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:"card",card:used}));
    if(used===myCard&&!keepAfterUse(used)) myCard=null;
    pendingCardUse=null; renderCard();
  }

  function resign(){
    const winner=turn==="white"?"black":"white"; alert("기권! 승자: "+winner);
    if(!localMode&&ws&&ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:"resign"}));
  }

  function render(){
    const div=document.getElementById("board"); if(!div) return; div.innerHTML="";
    setStatus((localMode?"로컬 2인":`온라인 ${roomCode} / 내 색: ${myColor||"대기중"}`)+` | ${turn} 턴`);
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const cell=document.createElement("div");
      cell.className="cell "+((r+c)%2===0?"light":"dark"); cell.dataset.r=r; cell.dataset.c=c;
      if(selected&&selected.r===r&&selected.c===c) cell.classList.add("selected");
      const legal=moves.find(m=>m.r===r&&m.c===c);
      if(legal) cell.classList.add(board[r][c]?"capture":"move");
      const pc=board[r][c];
      if(pc){ const img=document.createElement("img"); img.src=imgs[pc]; cell.appendChild(img); }
      cell.onclick=()=>clickCell(r,c); div.appendChild(cell);
    }
  }

  function canSelect(r,c){
    const pc=board[r]?.[c];
    if(!pc) return false;
    if(pc[0]!==turn[0]) return false;
    if(!localMode&&myColor&&pc[0]!==myColor[0]) return false;
    return true;
  }

  function clickCell(r,c){
    if(cardState.activeMode==="equalityPickA"){ chooseEqualityFirst(r,c); return; }
    if(cardState.activeMode==="equalityPickB"){ chooseEqualitySecond(r,c); return; }
    if(cardState.activeMode==="exorcism"){ chooseExorcismBishop(r,c); return; }
    if(cardState.activeMode==="spacePick"){ chooseSpacePiece(r,c); return; }
    if(cardState.activeMode==="spacePlace"){ placeSpaceTravel(r,c); return; }
    if(cardState.activeMode==="necroPlace"){ placeNecro(r,c); return; }
    if(!selected){ if(!canSelect(r,c)) return; selected={r,c}; moves=getMoves(r,c); render(); return; }
    tryMove(selected,{r,c});
  }

  async function tryMove(from,to){
    if(sameMove(forbiddenMove[turn],{from,to})){ alert("그 수 하지 마로 금지된 같은 수입니다."); selected=null; moves=[]; render(); return; }
    const legal=moves.find(m=>m.r===to.r&&m.c===to.c);
    if(!legal){ selected=null; moves=[]; render(); return; }
    const moving=board[from.r][from.c], target=board[to.r][to.c]; let promoteTo=null;
    if(cardState.doubleMoveActive&&cardState.doubleMoveLeft>0&&target&&target[1]==="k"){ alert("더블무브 중에는 킹을 잡을 수 없음"); selected=null; moves=[]; render(); return; }
    if(moving[1]==="p"&&(to.r===0||to.r===7)) promoteTo=await askPromotion();
    if(localMode){ saveLocalHistory(from,to,promoteTo); applyMoveLocal(from,to,promoteTo); selected=null; moves=[]; render(); return; }
    if(ws&&ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:"move",from,to,promoteTo}));
    selected=null; moves=[]; render();
  }

  function saveLocalHistory(from,to,promoteTo){
    moveHistory.push({by:turn,from:clone(from),to:clone(to),promoteTo:promoteTo||null,beforeBoard:clone(board),beforeTurn:turn,beforeCardState:clone(cardState),beforeMoved:clone(moved),beforeEnPassant:clone(enPassant),beforeEqualityUses:clone(equalityUses),beforeForbiddenMove:clone(forbiddenMove)});
  }

  function restoreLocalHistory(h){
    board=clone(h.beforeBoard); turn=h.beforeTurn; cardState=clone(h.beforeCardState); moved=clone(h.beforeMoved); enPassant=clone(h.beforeEnPassant); equalityUses=clone(h.beforeEqualityUses); forbiddenMove=clone(h.beforeForbiddenMove);
  }

  function applyMoveLocal(from,to,promoteTo){
    const moving=board[from.r][from.c]; let captured=board[to.r][to.c];
    updateMoved(moving,from); enPassant=null;
    if(captured&&captured[0]!==moving[0]&&captured[1]!=="k") cardState.necroCapturedPieces.push(captured);
    board[to.r][to.c]=moving; board[from.r][from.c]="";
    if(moving[1]==="p"&&(to.r===0||to.r===7)) board[to.r][to.c]=moving[0]+(promoteTo||"q");
    if(captured&&captured[0]!==moving[0]) maybeTriggerBombLocal(to.r,to.c,moving,captured);
    if(captured&&isGameEndingCapture(captured)){ alert("게임 끝! 승자: "+turn); return; }
    if(moving[1]==="k"&&cardState.kingReturn&&cardState.kingReturn.turns>0){ cardState.kingReturn.turns--; if(cardState.kingReturn.turns<=0) cardState.kingReturn=null; }
    forbiddenMove[turn]=null; finishMoveTurn();
  }

  function isGameEndingCapture(captured){ return cardState.queenRuleActive ? captured[1]==="q" : captured[1]==="k"; }

  function maybeTriggerBombLocal(r,c,moving,captured){
    if(myCard!=="bombLauncher"||cardState.bombLauncherUsed) return;
    const myP=turn[0]; if(moving[0]!==myP&&captured[0]!==myP) return;
    cardState.bombLauncherUsed=true; myCard=null;
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      const nr=r+dr,nc=c+dc; if(nr<0||nr>7||nc<0||nc>7) continue;
      const pc=board[nr][nc]; if(!pc||pc[1]==="k") continue; board[nr][nc]="";
    }
    alert("폭탄 발사대 발동!");
  }

  function finishMoveTurn(){
    if(cardState.doubleMoveLeft>1) cardState.doubleMoveLeft--;
    else { cardState.doubleMoveLeft=0; cardState.doubleMoveActive=false; turn=opp(turn); }
  }

  function updateMoved(piece,from){
    if(piece==="wk") moved.wk=true; if(piece==="bk") moved.bk=true;
    if(piece==="wr"&&from.r===7&&from.c===0) moved.wrA=true;
    if(piece==="wr"&&from.r===7&&from.c===7) moved.wrH=true;
    if(piece==="br"&&from.r===0&&from.c===0) moved.brA=true;
    if(piece==="br"&&from.r===0&&from.c===7) moved.brH=true;
  }

  function getMoves(r,c){
    const piece=board[r]?.[c]; if(!piece) return [];
    const color=piece[0], type=piece[1], res=[];
    const add=(nr,nc,t="normal")=>{ if(nr<0||nr>7||nc<0||nc>7) return; if(!board[nr][nc]||board[nr][nc][0]!==color) res.push({r:nr,c:nc,type:t}); };
    const slide=dirs=>{ for(const [dr,dc] of dirs){ let nr=r+dr,nc=c+dc; while(nr>=0&&nr<8&&nc>=0&&nc<8){ if(!board[nr][nc]) res.push({r:nr,c:nc,type:"normal"}); else { if(board[nr][nc][0]!==color) res.push({r:nr,c:nc,type:"normal"}); break; } nr+=dr; nc+=dc; } } };
    if(type==="p"){
      const dir=color==="w"?-1:1, start=color==="w"?6:1;
      if(!board[r+dir]?.[c]) add(r+dir,c);
      if(r===start&&!board[r+dir]?.[c]&&!board[r+dir*2]?.[c]) add(r+dir*2,c,"doublePawn");
      for(const dc of [-1,1]){ const t=board[r+dir]?.[c+dc]; if(t&&t[0]!==color) add(r+dir,c+dc); }
    }
    if(type==="n"){
      if(cardState.wildHorse) return getWildHorseMoves(r,c,board,color);
      [[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]].forEach(([dr,dc])=>add(r+dr,c+dc));
    }
    if(type==="b") slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
    if(type==="r"){
      if(cardState.versatileActive) return getVersatileRookMoves(r,c,board,color);
      slide([[1,0],[-1,0],[0,1],[0,-1]]);
    }
    if(type==="q"){
      if(cardState.queenRuleActive){ for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc) add(r+dr,c+dc,"queenRuleKing"); }
      else slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
    }
    if(type==="k"){
      if(cardState.queenRuleActive) slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
      else for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc) add(r+dr,c+dc);
      if(cardState.kingReturn&&cardState.kingReturn.turns>0){
        const m=cardState.kingReturn.mode;
        if(m==="bn"||m==="qn") [[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]].forEach(([dr,dc])=>add(r+dr,c+dc,"kingReturnKnight"));
        if(m==="bn") slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
        if(m==="q"||m==="qn") slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
      }
      if(!cardState.queenRuleActive){
        if(color==="w"&&r===7&&c===4&&!moved.wk){ if(!moved.wrH&&board[7][5]===""&&board[7][6]===""&&board[7][7]==="wr") add(7,6,"castleKing"); if(!moved.wrA&&board[7][1]===""&&board[7][2]===""&&board[7][3]===""&&board[7][0]==="wr") add(7,2,"castleQueen"); }
        if(color==="b"&&r===0&&c===4&&!moved.bk){ if(!moved.brH&&board[0][5]===""&&board[0][6]===""&&board[0][7]==="br") add(0,6,"castleKing"); if(!moved.brA&&board[0][1]===""&&board[0][2]===""&&board[0][3]===""&&board[0][0]==="br") add(0,2,"castleQueen"); }
      }
    }
    return res;
  }

  function askPromotion(){
    document.getElementById("promotionModal")?.classList.remove("hidden");
    return new Promise(resolve=>promotionResolve=resolve);
  }

  function choosePromotion(piece){
    document.getElementById("promotionModal")?.classList.add("hidden");
    if(promotionResolve){ const r=promotionResolve; promotionResolve=null; r(piece); }
  }

  function getEqualityTargets(){
    if(cardState.activeMode!=="equalityPickB"||!cardState.selectedSquares[0]) return [];
    const from=cardState.selectedSquares[0], moving=board[from.r]?.[from.c]; if(!moving) return [];
    const out=[], row=from.r, color=moving[0];
    for(const dc of [-3,3]){ const tc=from.c+dc; if(tc<0||tc>7) continue; const target=board[row][tc]; if(!target||target[0]!==color) continue; const dir=Math.sign(dc); if(board[row][from.c+dir]||board[row][from.c+dir*2]) continue; out.push({r:row,c:tc,type:"equalityCastle"}); }
    return out;
  }

  function chooseEqualityFirst(r,c){
    const pc=board[r]?.[c]; if(!pc||pc[0]!==turn[0]){ alert("내 기물만 선택 가능합니다."); return; }
    cardState.selectedSquares=[{r,c}]; cardState.activeMode="equalityPickB"; selected={r,c}; moves=getEqualityTargets();
    if(moves.length===0){ alert("이 기물은 평등국가 캐슬링 가능한 상대 기물이 없습니다."); cardState.activeMode="equalityPickA"; cardState.selectedSquares=[]; selected=null; moves=[]; }
    render();
  }

  function chooseEqualitySecond(r,c){
    const from=cardState.selectedSquares[0]; if(!from) return;
    const ok=getEqualityTargets().some(p=>p.r===r&&p.c===c); if(!ok){ alert("같은 가로줄에서 사이 빈칸 2칸인 내 기물만 선택 가능합니다."); return; }
    const a=board[from.r][from.c], b=board[r][c], dir=Math.sign(c-from.c), aFinal=from.c+dir*2, bFinal=from.c+dir;
    board[from.r][from.c]=""; board[r][c]=""; board[from.r][bFinal]=b; board[from.r][aFinal]=a;
    const used=turn; cardState.activeMode=null; cardState.selectedSquares=[]; selected=null; moves=[]; equalityUses[used]++;
    if(equalityUses[used]>=10){ alert("게임 끝! 승자: "+used); render(); return; }
    turn=opp(turn); syncCardUpdate(true); renderCard(); render();
  }

  function getExorcismBishopOptions(){
    const out=[], color=turn[0]; for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]===color+"b") out.push({r,c}); return out;
  }

  function showExorcismModal(){
    const modal=document.getElementById("exorcismModal"), list=document.getElementById("exorcismList"), bishops=getExorcismBishopOptions();
    if(bishops.length===0){ alert("사용할 수 있는 비숍이 없습니다."); return; }
    list.innerHTML=""; bishops.forEach(pos=>{ const btn=document.createElement("button"); btn.className="selectBtn"; btn.textContent=`비숍 ${sq(pos.r,pos.c)}`; btn.onclick=()=>chooseExorcismBishop(pos.r,pos.c); list.appendChild(btn); });
    cardState.activeMode="exorcism"; pendingCardUse=myCard; modal.classList.remove("hidden"); render();
  }

  function chooseExorcismBishop(r,c){
    const pc=board[r]?.[c]; if(!pc||pc[0]!==turn[0]||pc[1]!=="b"){ alert("퇴마(물리)는 내 비숍만 사용할 수 있습니다."); return; }
    const dir=pc[0]==="w"?-1:1;
    for(let dc=-1;dc<=1;dc++){
      const nr=r+dir,nc=c+dc; if(nr<0||nr>7||nc<0||nc>7) continue;
      const target=board[nr][nc];
      if(target&&isGameEndingCapture(target)){ alert("퇴마(물리)로 핵심 기물 제거! 승자: "+turn); board[nr][nc]=""; closeAllCardModals(); render(); return; }
      board[nr][nc]="";
    }
    closeAllCardModals(); cardState.activeMode=null; selected=null; moves=[]; turn=opp(turn); consumeCurrentCard(); syncCardUpdate(); renderCard(); render();
  }

  function getSpaceTravelPieces(){
    if(!cardState.spaceTravelEnabled) return [];
    if(!localMode&&myColor&&turn!==myColor) return [];
    const color=turn[0], corners=color==="w"?[{r:0,c:0},{r:0,c:7}]:[{r:7,c:0},{r:7,c:7}], out=[];
    for(const pos of corners){ const pc=board[pos.r]?.[pos.c]; if(pc&&pc[0]===color) out.push(pos); }
    return out;
  }

  function showSpaceModal(){ const targets=getSpaceTravelPieces(); if(targets.length===0){ alert("텔레포트 가능한 기물이 없습니다."); return; } cardState.activeMode="spacePick"; selected=null; moves=targets; render(); }

  function chooseSpacePiece(r,c){
    if(!getSpaceTravelPieces().some(p=>p.r===r&&p.c===c)){ alert("상대 진영 코너에 도착한 기물만 선택 가능합니다."); return; }
    cardState.selectedSquares=[{r,c}]; cardState.activeMode="spacePlace"; selected={r,c}; moves=getSpaceDestinationMoves(board[r][c][0]); alert("이동할 칸을 선택하세요."); render();
  }

  function getSpaceDestinationMoves(color){
    const out=[]; for(let r=0;r<8;r++) for(let c=0;c<8;c++){ const t=board[r][c]; if(!t||(t[0]!==color&&t[1]!=="k")) out.push({r,c}); } return out;
  }

  function placeSpaceTravel(r,c){
    const from=cardState.selectedSquares[0]; if(!from) return;
    const pc=board[from.r][from.c], target=board[r][c]; if(!pc) return;
    if(target&&target[0]===pc[0]){ alert("내 기물이 있는 칸으로는 텔레포트할 수 없습니다."); return; }
    if(target&&target[1]==="k"){ alert("우주여행으로 킹은 잡을 수 없습니다."); return; }
    if(target&&target[0]!==pc[0]) cardState.necroCapturedPieces.push(target);
    board[r][c]=pc; board[from.r][from.c]=""; cardState.activeMode=null; cardState.selectedSquares=[]; selected=null; moves=[]; turn=opp(turn); syncCardUpdate(); renderCard(); render();
  }

  function showNecroModal(){
    const modal=document.getElementById("necroModal"), list=document.getElementById("necroList");
    if(cardState.necroCapturedPieces.length===0){ alert("부활시킬 수 있는 잡은 기물이 없습니다."); return; }
    list.innerHTML=""; cardState.necroCapturedPieces.forEach((pc,i)=>{ const btn=document.createElement("button"); btn.className="selectBtn"; btn.textContent=`${pname(pc)} (${pc[0]==="w"?"백":"흑"})`; btn.onclick=()=>chooseNecroPiece(i); list.appendChild(btn); });
    cardState.activeMode="necroPick"; pendingCardUse=myCard; modal.classList.remove("hidden");
  }

  function chooseNecroPiece(index){
    const pc=cardState.necroCapturedPieces[index]; if(!pc){ alert("선택한 기물이 없습니다."); return; }
    cardState.necroSelectedPiece=pc; cardState.activeMode="necroPlace"; moves=getNecroPlaceMoves(); selected=null; closeAllCardModals();
    if(moves.length===0){ alert("킹 주변에 부활 가능한 빈칸이 없습니다."); cardState.necroSelectedPiece=null; cardState.activeMode=null; moves=[]; render(); return; }
    alert("킹 주변 빈칸을 선택하세요."); render();
  }

  function findMyKing(){ const k=turn==="white"?"wk":"bk"; for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]===k) return {r,c}; return null; }
  function getNecroPlaceMoves(){
    const k=findMyKing(); if(!k) return []; const out=[];
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){ if(!dr&&!dc) continue; const r=k.r+dr,c=k.c+dc; if(r<0||r>7||c<0||c>7||board[r][c]) continue; out.push({r,c}); }
    return out;
  }

  function placeNecro(r,c){
    if(board[r][c]){ alert("빈칸만 가능"); return; }
    const k=findMyKing(); if(!k){ alert("킹 없음"); return; }
    if(Math.abs(k.r-r)>1||Math.abs(k.c-c)>1){ alert("킹 주변만 가능"); return; }
    board[r][c]=turn[0]+cardState.necroSelectedPiece[1]; cardState.necroUsed=true;
    const idx=cardState.necroCapturedPieces.findIndex(p=>p===cardState.necroSelectedPiece); if(idx!==-1) cardState.necroCapturedPieces.splice(idx,1);
    cardState.necroSelectedPiece=null; cardState.activeMode=null; selected=null; moves=[]; turn=opp(turn); consumeCurrentCard(); syncCardUpdate(); renderCard(); render();
  }

  function getKingReturnData(score){
    if(score>=3&&score<=6) return {mode:"bn",turns:15,score};
    if(score>=7&&score<=10) return {mode:"q",turns:5,score};
    if(score>=11&&score<=14) return {mode:"q",turns:10,score};
    if(score>=15&&score<=18) return {mode:"q",turns:15,score};
    if(score>=19&&score<=22) return {mode:"qn",turns:15,score};
    return null;
  }

  function activateKingReturn(){
    const values={q:9,r:5,b:3,n:3}; let score=0;
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){ const pc=board[r][c]; if(!pc||pc[0]!==turn[0]||pc[1]==="k"||pc[1]==="p") continue; score+=values[pc[1]]||0; board[r][c]=""; }
    if(score>=23){ alert("왕의 귀환 실패! 23점 이상이라 패배"); if(!localMode&&ws&&ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:"resign"})); return; }
    cardState.kingReturn=getKingReturnData(score);
    alert(cardState.kingReturn?`왕의 귀환 발동! 점수 ${score}, ${cardState.kingReturn.turns}턴 강화`:`왕의 귀환 발동! 점수 ${score}, 강화 없음`);
  }

  function openUndoMoveModal(type){
    pendingUndoType=type;
    const modal=document.getElementById("undoMoveModal"), title=document.getElementById("undoMoveTitle"), desc=document.getElementById("undoMoveDesc");
    if(type==="noThatMove"){ if(title) title.textContent="그 수 하지 마"; if(desc) desc.textContent="상대가 마지막으로 둔 수를 무르고, 같은 수를 다시 못 두게 합니다."; }
    if(type==="temusanTimeStone"){ if(title) title.textContent="테무산 타임스톤"; if(desc) desc.textContent="내가 마지막으로 둔 수를 무릅니다."; }
    modal?.classList.remove("hidden");
  }

  function closeUndoMoveModal(){ pendingUndoType=null; document.getElementById("undoMoveModal")?.classList.add("hidden"); }
  function confirmUndoMove(){
    if(!pendingUndoType) return; const type=pendingUndoType; closeUndoMoveModal();
    if(!localMode&&ws&&ws.readyState===WebSocket.OPEN){ ws.send(JSON.stringify({type:"card",card:type})); return; }
    if(type==="noThatMove") useNoThatMoveLocal();
    if(type==="temusanTimeStone") useTemusanTimeStoneLocal();
  }

  function useNoThatMoveLocal(){
    if(myCard!=="noThatMove") return;
    if(cardState.noThatMoveUses<=0){ alert("그 수 하지 마 사용 횟수가 없습니다."); return; }
    const last=moveHistory[moveHistory.length-1]; if(!last){ alert("무를 상대 수가 없습니다."); return; }
    if(last.by==="white"){ alert("상대가 마지막으로 둔 수만 막을 수 있습니다."); return; }
    restoreLocalHistory(last); moveHistory.pop(); cardState.noThatMoveUses--; forbiddenMove[last.by]={from:clone(last.from),to:clone(last.to)}; if(cardState.noThatMoveUses<=0) myCard=null; alert("그 수 하지 마 발동!"); renderCard(); render();
  }

  function useTemusanTimeStoneLocal(){
    if(myCard!=="temusanTimeStone") return;
    if(cardState.temusanTimeStoneUses<=0){ alert("테무산 타임스톤 사용 횟수가 없습니다."); return; }
    let index=-1; for(let i=moveHistory.length-1;i>=0;i--) if(moveHistory[i].by==="white"){ index=i; break; }
    if(index===-1){ alert("무를 내 수가 없습니다."); return; }
    restoreLocalHistory(moveHistory[index]); moveHistory=moveHistory.slice(0,index); cardState.temusanTimeStoneUses--; if(cardState.temusanTimeStoneUses<=0) myCard=null; alert("테무산 타임스톤 발동!"); renderCard(); render();
  }

  function openResultChoiceModal(info){
    resultChoiceState=info;
    const modal=document.getElementById("choiceResultModal"), title=document.getElementById("choiceResultTitle"), desc=document.getElementById("choiceResultDesc");
    if(title) title.textContent=info.card==="fiveAhead"?"5수 앞":"양심테스트";
    if(desc) desc.textContent=info.message||(info.card==="fiveAhead"?"결과를 선택하세요. 실제 결과는 반대로 적용됩니다.":"결과를 선택하세요. 선택한 그대로 적용됩니다.");
    modal?.classList.remove("hidden");
  }

  function chooseResultOption(option){
    document.getElementById("choiceResultModal")?.classList.add("hidden");
    if(!resultChoiceState) return; const info=resultChoiceState; resultChoiceState=null;
    if(!localMode&&ws&&ws.readyState===WebSocket.OPEN){ ws.send(JSON.stringify({type:"resultChoice",option})); return; }
    const owner=info.owner||"white", chooser=info.chooser||"black";
    const winner=info.card==="fiveAhead"?(option==="opponentWin"?owner:chooser):(option==="opponentWin"?chooser:owner);
    alert("게임 끝! 승자: "+winner);
  }

  function openQuickDuelModal(){ document.getElementById("quickDuelModal")?.classList.remove("hidden"); updateQuickDuelStatus("1라운드 선택하세요. 3판 2선승제입니다."); }
  function updateQuickDuelStatus(t){ const el=document.getElementById("quickDuelStatus"); if(el) el.textContent=t; }
  function chooseQuickDuel(choice){
    if(!localMode&&ws&&ws.readyState===WebSocket.OPEN){ ws.send(JSON.stringify({type:"quickDuelChoice",choice})); return; }
    const other=["rock","scissors","paper"][Math.floor(Math.random()*3)], result=quickDuelCompare(choice,other);
    if(!quickDuelState) quickDuelState={round:1,score:{white:0,black:0}};
    let rw=null; if(result==="win"){rw="white"; quickDuelState.score.white++;} if(result==="lose"){rw="black"; quickDuelState.score.black++;}
    alert(`내 선택: ${choiceToKorean(choice)}\n상대 선택: ${choiceToKorean(other)}\n결과: ${rw?rw+" 승":"무승부"}`);
    if(quickDuelState.score.white>=2||quickDuelState.score.black>=2){ const winner=quickDuelState.score.white>=2?"white":"black"; closeAllCardModals(); alert("속전속결 종료! 승자: "+winner); quickDuelState=null; return; }
    quickDuelState.round++; updateQuickDuelStatus(`${quickDuelState.round}라운드 선택하세요. 백 ${quickDuelState.score.white} : 흑 ${quickDuelState.score.black}`);
  }

  function quickDuelCompare(a,b){ if(a===b) return "draw"; if(a==="rock"&&b==="scissors") return "win"; if(a==="scissors"&&b==="paper") return "win"; if(a==="paper"&&b==="rock") return "win"; return "lose"; }
  function choiceToKorean(x){ return x==="rock"?"묵":x==="scissors"?"찌":x==="paper"?"빠":"?"; }

  function activateCard(){
    if(!myCard){ alert("사용할 카드가 없습니다."); return; }
    const card=myCard;
    if(card==="bombLauncher"){ alert("폭탄 발사대는 첫 전투 시 자동 발동합니다."); return; }
    if(card==="versatile"){ alert("다재다능은 게임 시작부터 적용되는 패시브입니다."); return; }
    if(card==="extremeEfficiency"){ alert("극한의 효율은 게임 시작 전 자동 적용되는 패시브입니다."); return; }
    if(card==="fiveAhead"||card==="conscienceTest"){ alert("이 능력은 게임 시작 시 자동 발동됩니다."); return; }
    if(card==="reactionary"){ alert("반동분자는 패시브 능력입니다."); return; }
    if(card==="noThatMove"){ openUndoMoveModal("noThatMove"); return; }
    if(card==="temusanTimeStone"){ openUndoMoveModal("temusanTimeStone"); return; }
    if(card==="quickDuel"){
      if(!localMode&&ws&&ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:"card",card:"quickDuel"}));
      else { quickDuelState={round:1,score:{white:0,black:0}}; openQuickDuelModal(); }
      myCard=null; renderCard(); return;
    }
    if(card==="equality"){ const res=useCard(card,cardState); alert(res.message); renderCard(); render(); return; }
    if(card==="exorcism"){ pendingCardUse=card; showExorcismModal(); return; }
    if(card==="necro"){
      if(cardState.necroCapturedPieces.length===0){ alert("아직 부활시킬 잡은 기물이 없습니다."); return; }
      pendingCardUse=card; showNecroModal(); return;
    }
    if(card==="spaceTravel"){
      const res=useCard(card,cardState); if(!res.ok){ alert(res.message); return; } alert(res.message);
      if(!localMode&&ws&&ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:"card",card}));
      syncCardUpdate(); renderCard(); render(); return;
    }
    if(card==="queenRule"){
      const res=useCard(card,cardState); alert(res.message); pendingCardUse=card; consumeCurrentCard(); syncCardUpdate(); renderCard(); render(); return;
    }
    if(card==="kingReturn"){
      pendingCardUse=card; activateKingReturn(); consumeCurrentCard(); syncCardUpdate(); renderCard(); render(); return;
    }
    if(card==="doubleMove"||card==="wildHorse"){
      const res=useCard(card,cardState); alert(res.message); if(!res.ok) return; pendingCardUse=card; consumeCurrentCard(); renderCard(); render(); return;
    }
    const res=useCard(card,cardState); alert(res.message); if(res.ok){ pendingCardUse=card; consumeCurrentCard(); renderCard(); render(); }
  }

  function activateSpaceTravel(){ showSpaceModal(); }

  function renderCard(){
    const area=document.getElementById("cardArea"); if(!area) return;
    const spaceTargets=getSpaceTravelPieces();
    if(cardState.activeMode==="equalityPickA"){ area.innerHTML='<div class="cardBox"><div class="cardTitle">평등국가</div><div class="cardDesc">캐슬링할 첫 번째 내 기물을 선택하세요.</div></div>'; return; }
    if(cardState.activeMode==="equalityPickB"){ area.innerHTML='<div class="cardBox"><div class="cardTitle">평등국가</div><div class="cardDesc">사이에 빈칸 2칸이 있는 같은 가로줄의 내 기물을 선택하세요.</div></div>'; return; }
    if(cardState.activeMode==="exorcism"){ area.innerHTML='<div class="cardBox"><div class="cardTitle">퇴마(물리)</div><div class="cardDesc">능력을 사용할 비숍을 선택하세요.</div></div>'; return; }
    if(cardState.activeMode==="necroPlace"){ area.innerHTML='<div class="cardBox"><div class="cardTitle">네크로맨서</div><div class="cardDesc">킹 주변 빈칸을 선택하세요.</div></div>'; return; }
    if(cardState.activeMode==="spacePlace"){ area.innerHTML='<div class="cardBox"><div class="cardTitle">우주여행</div><div class="cardDesc">이동할 칸을 선택하세요.</div></div>'; return; }
    if(cardState.spaceTravelEnabled&&spaceTargets.length>0){ area.innerHTML='<div class="cardBox"><div class="cardTitle">우주여행 준비됨</div><div class="cardDesc">상대 진영 코너에 도착한 내 기물을 텔레포트합니다.</div><button class="cardBtn" onclick="Game.activateSpaceTravel()">텔레포트 사용</button></div>'; return; }
    if(!myCard){ area.innerHTML=""; return; }
    let extra="";
    if(myCard==="bombLauncher") extra=`<br><b>상태:</b> ${cardState.bombLauncherUsed?"사용됨":"대기 중"}`;
    if(myCard==="noThatMove") extra=`<br><b>남은 횟수:</b> ${cardState.noThatMoveUses}`;
    if(myCard==="temusanTimeStone") extra=`<br><b>남은 횟수:</b> ${cardState.temusanTimeStoneUses}`;
    if(myCard==="versatile") extra="<br><b>패시브 적용 중:</b> 룩 = 비숍 + 나이트 + 킹 이동";
    if(myCard==="extremeEfficiency") extra="<br><b>패시브 적용됨:</b> 킹 1개 + 퀸 3개";
    if(myCard==="queenRule"&&cardState.queenRuleActive) extra="<br><b>활성화됨:</b> 킹과 퀸 역할 교체";
    const buttonCards=["necro","wildHorse","spaceTravel","doubleMove","equality","exorcism","kingReturn","noThatMove","temusanTimeStone","quickDuel","queenRule"];
    const btn=buttonCards.includes(myCard)?'<button class="cardBtn" onclick="Game.activateCard()">능력 사용</button>':"";
    area.innerHTML=`<div class="cardBox"><div class="cardTitle">${getCardName(myCard)}</div><div class="cardDesc">${getCardDescription(myCard)}${extra}</div>${btn}</div>`;
  }

  return {
    startLocal, makeRoom, joinOnline, backMenu, resign,
    choosePromotion, activateCard, activateSpaceTravel,
    cancelCardSelection, chooseExorcismBishop, chooseSpacePiece, chooseNecroPiece,
    chooseResultOption, chooseQuickDuel, confirmUndoMove, closeUndoMoveModal
  };
})();

window.Game = Game;
