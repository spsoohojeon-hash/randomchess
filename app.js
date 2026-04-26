import { createCardState, useCard, getWildHorseMoves } from "./cards.js";
const Game = (() => {
  const SERVER = "wss://randomchess.onrender.com";

  let ws = null, board = [], turn = "white", selected = null, moves = [];
  let localMode = true, myColor = null, roomCode = null;
  let enPassant = null, dragFrom = null, touchFrom = null, ghost = null, promotionResolve = null;
  let moved = { wk:false, wrA:false, wrH:false, bk:false, brA:false, brH:false };
  let myCard = null;
  let cardState = createCardState();
  
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

  function createBoard() {
    return [
      ["br","bn","bb","bq","bk","bb","bn","br"],
      ["bp","bp","bp","bp","bp","bp","bp","bp"],
      ["","","","","","","",""], ["","","","","","","",""],
      ["","","","","","","",""], ["","","","","","","",""],
      ["wp","wp","wp","wp","wp","wp","wp","wp"],
      ["wr","wn","wb","wq","wk","wb","wn","wr"]
    ];
  }

  function resetState() {
    board = createBoard(); turn = "white"; selected = null; moves = [];
    enPassant = null;
    moved = { wk:false, wrA:false, wrH:false, bk:false, brA:false, brH:false };
  }

  function showGame() {
    document.getElementById("menu").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
  }

  function backMenu() {
    removeGhost();
    document.getElementById("game").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
  }

  function status(text) {
    document.getElementById("status").textContent = text;
  }

  function startLocal() {
    localMode = true; myColor = null; roomCode = null;
    resetState(); showGame(); render();
  }

  function makeRoom() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById("roomInput").value = code;
    alert("방 코드: " + code);
    joinOnline();
  }

  function joinOnline() {
    const input = document.getElementById("roomInput").value.trim().toUpperCase();
    if (!input) return alert("방 코드를 입력해라.");

    localMode = false; roomCode = input;
    if (ws) ws.close();
    ws = new WebSocket(SERVER);

    ws.onopen = () => ws.send(JSON.stringify({ type:"join", roomId:roomCode }));

    ws.onmessage = e => {
      const data = JSON.parse(e.data);
      if (data.type === "waiting") {
  showGame();
  status("매칭 찾는 중...");
  document.getElementById("board").innerHTML = "";
      }

      if (data.type === "start") {
        myCard = data.card;
renderCard();
        myColor = data.color;
        board = data.board;
        turn = data.turn;
        enPassant = data.enPassant || null;
        moved = data.moved || moved;
        showGame(); render();
      }

      if (data.type === "update") {
        board = data.board;
        turn = data.turn;
        enPassant = data.enPassant || null;
        moved = data.moved || moved;
        selected = null; moves = []; removeGhost(); render();
      }

      if (data.type === "gameover") {
        board = data.board;
        removeGhost(); render();
        alert("게임 끝! 승자: " + data.winner);
      }

      if (data.type === "full") alert("방이 가득 참");
      if (data.type === "error") alert(data.message);
    };

    ws.onerror = () => alert("서버 연결 에러");
  }

  function reset() {
    removeGhost();
    if (localMode) startLocal();
    else if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type:"reset" }));
  }

  function render() {
    const boardDiv = document.getElementById("board");
    boardDiv.innerHTML = "";

    status((localMode ? "로컬 2인" : `온라인 ${roomCode} / 내 색: ${myColor || "대기중"}`) + ` | ${turn} 턴`);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement("div");
        cell.className = "cell " + ((r + c) % 2 === 0 ? "light" : "dark");
        cell.dataset.r = r;
        cell.dataset.c = c;

        if (selected && selected.r === r && selected.c === c) cell.classList.add("selected");

        const legal = moves.find(m => m.r === r && m.c === c);
        if (legal) {
          if (board[r][c] || legal.type === "enPassant") cell.classList.add("capture");
          else cell.classList.add("move");
        }

        const piece = board[r][c];
        if (piece) {
          const img = document.createElement("img");
          img.src = imgs[piece];

          cell.appendChild(img);
        }

        cell.onclick = () => clickCell(r, c);

        cell.ontouchstart = ev => {
  if (!canSelect(r, c)) return;

  ev.preventDefault();

  selected = { r, c };
  touchFrom = { r, c };
  moves = getMoves(r, c);

  render(); 

  const pieceNow = board[r][c];

  removeGhost();

  ghost = document.createElement("img");
  ghost.src = imgs[pieceNow];
  ghost.className = "dragGhost";
  document.body.appendChild(ghost);

  const t = ev.touches[0];
  moveGhost(t.clientX, t.clientY);
};

        cell.ontouchmove = ev => {
          if (!ghost) return;
          ev.preventDefault();
          const t = ev.touches[0];
          moveGhost(t.clientX, t.clientY);
        };

        cell.ontouchend = ev => {
          if (!touchFrom) return;
          ev.preventDefault();

          const t = ev.changedTouches[0];
          const el = document.elementFromPoint(t.clientX, t.clientY);
          const target = el?.closest(".cell");
          removeGhost();

          if (target) {
            tryMove(touchFrom, {
              r: Number(target.dataset.r),
              c: Number(target.dataset.c)
            });
          }
          touchFrom = null;
        };

        boardDiv.appendChild(cell);
      }
    }
  }

  function moveGhost(x, y) {
    if (!ghost) return;
    ghost.style.left = x + "px";
    ghost.style.top = y + "px";
  }

  function removeGhost() {
    if (ghost) {
      ghost.remove();
      ghost = null;
    }
  }

  function canSelect(r, c) {
    const piece = board[r]?.[c];
    if (!piece) return false;
    if (piece[0] !== turn[0]) return false;
    if (!localMode && myColor && piece[0] !== myColor[0]) return false;
    return true;
  }

  function clickCell(r, c) {
    if (!selected) {
      if (!canSelect(r, c)) return;
      selected = { r, c };
      moves = getMoves(r, c);
      render();
      return;
    }
    tryMove(selected, { r, c });
  }

  async function tryMove(from, to) {
    const legal = moves.find(m => m.r === to.r && m.c === to.c);
    if (!legal) {
      selected = null; moves = []; touchFrom = null; render();
      return;
    }

    let promoteTo = null;
    const moving = board[from.r][from.c];

    if (moving[1] === "p" && (to.r === 0 || to.r === 7)) {
      promoteTo = await askPromotion();
    }

    if (localMode) {
      applyMove(from, to, promoteTo);
      selected = null; moves = []; touchFrom = null; render();
    } else if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type:"move", from, to, promoteTo }));
      selected = null; moves = []; touchFrom = null; render();
    }
  }

  function askPromotion() {
    document.getElementById("promotionModal").classList.remove("hidden");
    return new Promise(resolve => promotionResolve = resolve);
  }

  function choosePromotion(piece) {
    document.getElementById("promotionModal").classList.add("hidden");
    if (promotionResolve) {
      promotionResolve(piece);
      promotionResolve = null;
    }
  }

  function applyMove(from, to, promoteTo) {
    const moving = board[from.r][from.c];
    let captured = board[to.r][to.c];
    const legal = getMoves(from.r, from.c).find(m => m.r === to.r && m.c === to.c);

    updateMoved(moving, from);
    enPassant = null;

    if (legal?.type === "enPassant") {
      const capRow = moving[0] === "w" ? to.r + 1 : to.r - 1;
      captured = board[capRow][to.c];
      board[capRow][to.c] = "";
    }

    board[to.r][to.c] = moving;
    board[from.r][from.c] = "";

    if (legal?.type === "doublePawn") {
      const dir = moving[0] === "w" ? -1 : 1;
      enPassant = { r: from.r + dir, c: from.c };
    }

    if (legal?.type === "castleKing") {
      const row = moving[0] === "w" ? 7 : 0;
      board[row][5] = board[row][7];
      board[row][7] = "";
    }

    if (legal?.type === "castleQueen") {
      const row = moving[0] === "w" ? 7 : 0;
      board[row][3] = board[row][0];
      board[row][0] = "";
    }

    if (moving[1] === "p" && (to.r === 0 || to.r === 7)) {
      board[to.r][to.c] = moving[0] + (promoteTo || "q");
    }

    if (captured && captured[1] === "k") {
      alert("게임 끝! 승자: " + turn);
      return;
    }

    turn = turn === "white" ? "black" : "white";
  }

  function updateMoved(piece, from) {
    if (piece === "wk") moved.wk = true;
    if (piece === "bk") moved.bk = true;
    if (piece === "wr" && from.r === 7 && from.c === 0) moved.wrA = true;
    if (piece === "wr" && from.r === 7 && from.c === 7) moved.wrH = true;
    if (piece === "br" && from.r === 0 && from.c === 0) moved.brA = true;
    if (piece === "br" && from.r === 0 && from.c === 7) moved.brH = true;
  }

  function getMoves(r, c) {
    const piece = board[r]?.[c];
    if (!piece) return [];

    const color = piece[0];
    const type = piece[1];
    const res = [];

    const add = (nr, nc, kind = "normal") => {
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return;
      if (!board[nr][nc] || board[nr][nc][0] !== color) {
        res.push({ r:nr, c:nc, type:kind });
      }
    };

    const slide = dirs => {
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          if (!board[nr][nc]) res.push({ r:nr, c:nc, type:"normal" });
          else {
            if (board[nr][nc][0] !== color) res.push({ r:nr, c:nc, type:"normal" });
            break;
          }
          nr += dr; nc += dc;
        }
      }
    };

    if (type === "p") {
      const dir = color === "w" ? -1 : 1;
      const start = color === "w" ? 6 : 1;

      if (!board[r + dir]?.[c]) add(r + dir, c);
      if (r === start && !board[r + dir]?.[c] && !board[r + dir * 2]?.[c]) add(r + dir * 2, c, "doublePawn");

      for (const dc of [-1, 1]) {
        const target = board[r + dir]?.[c + dc];
        if (target && target[0] !== color) add(r + dir, c + dc);
        if (enPassant && enPassant.r === r + dir && enPassant.c === c + dc) {
          res.push({ r:r + dir, c:c + dc, type:"enPassant" });
        }
      }
    }

    if (type === "n") [[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]].forEach(([dr,dc]) => add(r+dr,c+dc));
    if (type === "b") slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
    if (type === "r") slide([[1,0],[-1,0],[0,1],[0,-1]]);
    if (type === "q") slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);

    if (type === "k") {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(r+dr,c+dc);

      if (color === "w" && r === 7 && c === 4 && !moved.wk) {
        if (!moved.wrH && board[7][5] === "" && board[7][6] === "" && board[7][7] === "wr") add(7, 6, "castleKing");
        if (!moved.wrA && board[7][1] === "" && board[7][2] === "" && board[7][3] === "" && board[7][0] === "wr") add(7, 2, "castleQueen");
      }

      if (color === "b" && r === 0 && c === 4 && !moved.bk) {
        if (!moved.brH && board[0][5] === "" && board[0][6] === "" && board[0][7] === "br") add(0, 6, "castleKing");
        if (!moved.brA && board[0][1] === "" && board[0][2] === "" && board[0][3] === "" && board[0][0] === "br") add(0, 2, "castleQueen");
      }
    }

    return res;
  }

  const CARD_NAMES = {
  necro: "네크로맨서",
  wildHorse: "존나 야생마",
  spaceTravel: "우주여행",
  doubleMove: "더블무브",
  equality: "평등국가",
  reactionary: "반동분자",
  exorcism: "퇴마(물리)",
  kingReturn: "왕의 귀환"
};

function renderCard() {
  const area = document.getElementById("cardArea");
  if (!area) return;

  if (!myCard) {
    area.innerHTML = "";
    return;
  }

  area.innerHTML = `
    <button class="cardBtn" onclick="Game.useCard()">
      카드 사용: ${CARD_NAMES[myCard]}
    </button>
  `;
}

function activateCard() {
  const result = useCard(myCard, cardState);
  alert(result.message);
}

return { startLocal, makeRoom, joinOnline, backMenu, reset, choosePromotion, activateCard };    
})();
