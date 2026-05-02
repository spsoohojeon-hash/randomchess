import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
  let filePath = req.url.split("?")[0];

  if (filePath === "/") {
    filePath = "/index.html";
  }

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
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=UTF-8"
      });
      res.end("404 Not Found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream"
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = {};

const CARD_POOL = [
  "necro",
  "wildHorse",
  "spaceTravel",
  "doubleMove",
  "equality",
  "reactionary",
  "exorcism",
  "kingReturn"
];

function drawCards() {
  const shuffled = [...CARD_POOL].sort(() => Math.random() - 0.5);

  return {
    white: shuffled[0],
    black: shuffled[1]
  };
}

function createBoard() {
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

function createRoom() {
  return {
    players: [],
    board: createBoard(),
    cards: drawCards(),
    turn: "white",
    over: false,
    enPassant: null,
    moved: {
      wk:false, wrA:false, wrH:false,
      bk:false, brA:false, brH:false
    },
    doubleMove: {
      white: 0,
      black: 0
    },
    wildHorse: {
      white: false,
      black: false
    },
    usedCards: {
      white: false,
      black: false
    },
    kingReturn: {
      white: null,
      black: null
    },
    reactionary: {
      white: {
        active: false,
        rook: null,
        checks: 0
      },
      black: {
        active: false,
        rook: null,
        checks: 0
      }
    },
    capturedBy: {
      white: [],
      black: []
    },
    spaceTravel: {
      white: false,
      black: false
    }
  };
}

function send(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data) {
  room.players.forEach(p => send(p.ws, data));
}

function otherColor(color) {
  return color === "white" ? "black" : "white";
}

function clearPath(board, from, to) {
  const sr = Math.sign(to.r - from.r);
  const sc = Math.sign(to.c - from.c);
  let r = from.r + sr;
  let c = from.c + sc;

  while (r !== to.r || c !== to.c) {
    if (board[r][c]) return false;
    r += sr;
    c += sc;
  }

  return true;
}

function validElephantMove(board, from, to) {
  const dr = to.r - from.r;
  const dc = to.c - from.c;

  const moves = [
    { dr: 3, dc: 2, blocks: [[1, 0], [2, 1]] },
    { dr: 3, dc: -2, blocks: [[1, 0], [2, -1]] },
    { dr: -3, dc: 2, blocks: [[-1, 0], [-2, 1]] },
    { dr: -3, dc: -2, blocks: [[-1, 0], [-2, -1]] },

    { dr: 2, dc: 3, blocks: [[0, 1], [1, 2]] },
    { dr: -2, dc: 3, blocks: [[0, 1], [-1, 2]] },
    { dr: 2, dc: -3, blocks: [[0, -1], [1, -2]] },
    { dr: -2, dc: -3, blocks: [[0, -1], [-1, -2]] }
  ];

  const move = moves.find(m => m.dr === dr && m.dc === dc);

  if (!move) return false;

  for (const [br, bc] of move.blocks) {
    const blockR = from.r + br;
    const blockC = from.c + bc;

    if (board[blockR]?.[blockC]) {
      return false;
    }
  }

  return true;
}

/*
  평등국가는 이제 일반 이동에 섞이는 패시브가 아님.
  app.js에서 평등국가 전용 선택 모드로 처리하고 cardUpdate로 서버에 동기화함.
*/
function hasEquality(room, color) {
  return false;
}

function validEqualityCastle(room, from, to, color) {
  return false;
}

function validMove(room, from, to, color) {
  const board = room.board;
  const piece = board[from.r]?.[from.c];

  if (!piece || piece[0] !== color[0]) return false;

  const target = board[to.r]?.[to.c];
  if (target && target[0] === color[0]) return false;

  const equalityCastle = validEqualityCastle(room, from, to, color);
  if (equalityCastle) return equalityCastle;

  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const ar = Math.abs(dr);
  const ac = Math.abs(dc);
  const type = piece[1];

  if (type === "p") {
    const dir = color === "white" ? -1 : 1;
    const start = color === "white" ? 6 : 1;

    if (dc === 0 && !target && dr === dir) return "normal";

    if (
      dc === 0 &&
      !target &&
      from.r === start &&
      dr === dir * 2 &&
      !board[from.r + dir][from.c]
    ) {
      return "doublePawn";
    }

    if (ac === 1 && dr === dir && target) return "normal";

    if (
      ac === 1 &&
      dr === dir &&
      !target &&
      room.enPassant?.r === to.r &&
      room.enPassant?.c === to.c
    ) {
      return "enPassant";
    }

    return false;
  }

  if (type === "r") {
    return (dr === 0 || dc === 0) && clearPath(board, from, to) ? "normal" : false;
  }

  if (type === "b") {
    return ar === ac && clearPath(board, from, to) ? "normal" : false;
  }

  if (type === "q") {
    return (dr === 0 || dc === 0 || ar === ac) && clearPath(board, from, to) ? "normal" : false;
  }

  if (type === "n") {
    if (room.wildHorse?.[color]) {
      return validElephantMove(board, from, to) ? "normal" : false;
    }

    return ((ar === 2 && ac === 1) || (ar === 1 && ac === 2)) ? "normal" : false;
  }

  if (type === "k") {
    const kr = room.kingReturn?.[color];

    if (kr && kr.turns > 0) {
      if (kr.mode === "bn" || kr.mode === "qn") {
        if ((ar === 2 && ac === 1) || (ar === 1 && ac === 2)) {
          return "normal";
        }
      }

      if (kr.mode === "bn") {
        if (ar === ac && clearPath(board, from, to)) {
          return "normal";
        }
      }

      if (kr.mode === "q" || kr.mode === "qn") {
        if ((dr === 0 || dc === 0 || ar === ac) && clearPath(board, from, to)) {
          return "normal";
        }
      }
    }

    if (ar <= 1 && ac <= 1) return "normal";

    if (color === "white" && from.r === 7 && from.c === 4 && dr === 0) {
      if (
        dc === 2 &&
        !room.moved.wk &&
        !room.moved.wrH &&
        board[7][5] === "" &&
        board[7][6] === "" &&
        board[7][7] === "wr"
      ) {
        return "castleKing";
      }

      if (
        dc === -2 &&
        !room.moved.wk &&
        !room.moved.wrA &&
        board[7][1] === "" &&
        board[7][2] === "" &&
        board[7][3] === "" &&
        board[7][0] === "wr"
      ) {
        return "castleQueen";
      }
    }

    if (color === "black" && from.r === 0 && from.c === 4 && dr === 0) {
      if (
        dc === 2 &&
        !room.moved.bk &&
        !room.moved.brH &&
        board[0][5] === "" &&
        board[0][6] === "" &&
        board[0][7] === "br"
      ) {
        return "castleKing";
      }

      if (
        dc === -2 &&
        !room.moved.bk &&
        !room.moved.brA &&
        board[0][1] === "" &&
        board[0][2] === "" &&
        board[0][3] === "" &&
        board[0][0] === "br"
      ) {
        return "castleQueen";
      }
    }

    return false;
  }

  return false;
}

function updateMoved(room, piece, from) {
  if (piece === "wk") room.moved.wk = true;
  if (piece === "bk") room.moved.bk = true;

  if (piece === "wr" && from.r === 7 && from.c === 0) room.moved.wrA = true;
  if (piece === "wr" && from.r === 7 && from.c === 7) room.moved.wrH = true;
  if (piece === "br" && from.r === 0 && from.c === 0) room.moved.brA = true;
  if (piece === "br" && from.r === 0 && from.c === 7) room.moved.brH = true;
}

function isReactionaryRook(room, color, r, c) {
  const state = room.reactionary[color];

  if (!state || !state.active || !state.rook) return false;

  return state.rook.r === r && state.rook.c === c;
}

function canAttackSquare(room, from, to, color) {
  const board = room.board;
  const piece = board[from.r]?.[from.c];

  if (!piece || piece[0] !== color[0]) return false;

  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const ar = Math.abs(dr);
  const ac = Math.abs(dc);
  const type = piece[1];

  if (type === "p") {
    const dir = color === "white" ? -1 : 1;
    return ar === 1 && dr === dir;
  }

  if (type === "r") {
    return (dr === 0 || dc === 0) && clearPath(board, from, to);
  }

  if (type === "b") {
    return ar === ac && clearPath(board, from, to);
  }

  if (type === "q") {
    return (dr === 0 || dc === 0 || ar === ac) && clearPath(board, from, to);
  }

  if (type === "n") {
    if (room.wildHorse?.[color]) {
      return validElephantMove(board, from, to);
    }

    return (ar === 2 && ac === 1) || (ar === 1 && ac === 2);
  }

  if (type === "k") {
    const kr = room.kingReturn?.[color];

    if (kr && kr.turns > 0) {
      if (kr.mode === "bn" || kr.mode === "qn") {
        if ((ar === 2 && ac === 1) || (ar === 1 && ac === 2)) {
          return true;
        }
      }

      if (kr.mode === "bn") {
        if (ar === ac && clearPath(board, from, to)) {
          return true;
        }
      }

      if (kr.mode === "q" || kr.mode === "qn") {
        if ((dr === 0 || dc === 0 || ar === ac) && clearPath(board, from, to)) {
          return true;
        }
      }
    }

    return ar <= 1 && ac <= 1;
  }

  return false;
}

function isSquareAttacked(room, target, byColor) {
  const board = room.board;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];

      if (!piece || piece[0] !== byColor[0]) continue;

      if (canAttackSquare(room, { r, c }, target, byColor)) {
        return true;
      }
    }
  }

  return false;
}

function updateReactionaryRookAfterMove(room, color, from, to, moveType) {
  const state = room.reactionary[color];

  if (!state || !state.active || !state.rook) return;

  if (state.rook.r === from.r && state.rook.c === from.c) {
    state.rook = { r: to.r, c: to.c };
  }

  if (moveType === "castleKing") {
    const row = color === "white" ? 7 : 0;

    if (state.rook.r === row && state.rook.c === 7) {
      state.rook = { r: row, c: 5 };
    }
  }

  if (moveType === "castleQueen") {
    const row = color === "white" ? 7 : 0;

    if (state.rook.r === row && state.rook.c === 0) {
      state.rook = { r: row, c: 3 };
    }
  }
}

function checkReactionaryThreat(room, attackerColor) {
  const defender = otherColor(attackerColor);
  const state = room.reactionary[defender];

  if (!state || !state.active || !state.rook) return null;

  if (isSquareAttacked(room, state.rook, attackerColor)) {
    state.checks++;

    if (state.checks >= 3) {
      room.over = true;
      return attackerColor;
    }
  }

  return null;
}

function makeUpdatePayload(room) {
  return {
    type: "update",
    board: room.board,
    turn: room.turn,
    enPassant: room.enPassant,
    moved: room.moved,
    doubleMove: room.doubleMove,
    wildHorse: room.wildHorse,
    kingReturn: room.kingReturn,
    reactionary: room.reactionary,
    capturedBy: room.capturedBy,
    spaceTravel: room.spaceTravel,
    usedCards: room.usedCards
  };
}

wss.on("connection", ws => {
  let roomId = null;
  let color = null;

  ws.on("message", msg => {
    let data;

    try {
      data = JSON.parse(msg.toString());
    } catch {
      send(ws, {
        type: "error",
        message: "잘못된 메시지 형식입니다."
      });
      return;
    }

    if (data.type === "join") {
      roomId = data.roomId || "room1";

      if (!rooms[roomId]) rooms[roomId] = createRoom();
      const room = rooms[roomId];

      if (room.players.length >= 2) {
        send(ws, { type:"full" });
        return;
      }

      color = room.players.length === 0 ? "white" : "black";
      room.players.push({ ws, color });

      if (room.players.length === 1) {
        send(ws, {
          type: "waiting",
          message: "매칭 찾는 중..."
        });
        return;
      }

      room.players.forEach(player => {
        send(player.ws, {
          type: "start",
          color: player.color,
          board: room.board,
          turn: room.turn,
          enPassant: room.enPassant,
          moved: room.moved,
          card: room.cards[player.color],
          capturedPieces: room.capturedBy[player.color],
          spaceTravelEnabled: room.spaceTravel[player.color]
        });
      });

      return;
    }

    if (data.type === "card") {
      const room = rooms[roomId];
      if (!room || room.over) return;

      if (data.card !== room.cards[color]) {
        send(ws, {
          type: "error",
          message: "네 카드가 아닙니다."
        });
        return;
      }

      /*
        평등국가는 사용 횟수 제한 없음 + app.js 전용 모드로 처리함.
        서버에서 usedCards를 true로 만들지 않음.
      */
      if (data.card === "equality") {
        broadcast(room, makeUpdatePayload(room));
        return;
      }

      /*
        반동분자는 자동 패시브라 app.js에서 cardUpdate로 왕룩만 동기화함.
        혹시 카드 메시지가 와도 usedCards 처리하지 않음.
      */
      if (data.card === "reactionary") {
        broadcast(room, makeUpdatePayload(room));
        return;
      }

      if (room.usedCards[color]) {
        send(ws, {
          type: "error",
          message: "이미 카드를 사용했습니다."
        });
        return;
      }

      if (data.card === "doubleMove") {
        if (room.turn !== color) {
          send(ws, {
            type: "error",
            message: "더블무브는 내 턴에만 사용할 수 있습니다."
          });
          return;
        }

        room.doubleMove[color] = 2;
      }

      if (data.card === "wildHorse") {
        room.wildHorse[color] = true;
      }

      if (data.card === "spaceTravel") {
        room.spaceTravel[color] = true;
      }

      room.usedCards[color] = true;

      broadcast(room, makeUpdatePayload(room));

      return;
    }

    if (data.type === "move") {
      const room = rooms[roomId];
      if (!room || room.over) return;

      if (room.turn !== color) {
        send(ws, {
          type:"error",
          message:"네 차례가 아님"
        });
        return;
      }

      const { from, to } = data;
      const moveType = validMove(room, from, to, color);

      if (!moveType) {
        send(ws, {
          type:"error",
          message:"불가능한 이동"
        });
        return;
      }

      const board = room.board;
      const moving = board[from.r][from.c];
      let captured = board[to.r][to.c];
      let capturedForNecro = captured;

      const opponent = otherColor(color);

      if (room.doubleMove[color] > 0 && captured && captured[1] === "k") {
        send(ws, {
          type: "error",
          message: "더블무브 중에는 킹을 잡을 수 없습니다."
        });
        return;
      }

      if (captured && isReactionaryRook(room, opponent, to.r, to.c)) {
        room.over = true;

        broadcast(room, {
          type:"gameover",
          winner: color,
          board
        });

        return;
      }

      updateMoved(room, moving, from);
      room.enPassant = null;

      if (moveType === "enPassant") {
        const capRow = color === "white" ? to.r + 1 : to.r - 1;
        captured = board[capRow][to.c];
        capturedForNecro = captured;

        if (captured && isReactionaryRook(room, opponent, capRow, to.c)) {
          room.over = true;

          broadcast(room, {
            type:"gameover",
            winner: color,
            board
          });

          return;
        }

        board[capRow][to.c] = "";
      }

      board[to.r][to.c] = moving;
      board[from.r][from.c] = "";

      if (
        capturedForNecro &&
        capturedForNecro[0] !== moving[0] &&
        capturedForNecro[1] !== "k"
      ) {
        room.capturedBy[color].push(capturedForNecro);
      }

      if (moveType === "doublePawn") {
        const dir = color === "white" ? -1 : 1;
        room.enPassant = {
          r: from.r + dir,
          c: from.c
        };
      }

      if (moveType === "castleKing") {
        const row = color === "white" ? 7 : 0;
        board[row][5] = board[row][7];
        board[row][7] = "";
      }

      if (moveType === "castleQueen") {
        const row = color === "white" ? 7 : 0;
        board[row][3] = board[row][0];
        board[row][0] = "";
      }

      if (moving[1] === "p" && (to.r === 0 || to.r === 7)) {
        const allowed = ["q","r","b","n"];
        const promoteTo = allowed.includes(data.promoteTo) ? data.promoteTo : "q";
        board[to.r][to.c] = moving[0] + promoteTo;
      }

      if (captured && captured[1] === "k" && !room.reactionary[opponent].active) {
        room.over = true;

        broadcast(room, {
          type:"gameover",
          winner: color,
          board
        });

        return;
      }

      if (moving[1] === "k" && room.kingReturn[color]) {
        room.kingReturn[color].turns--;

        if (room.kingReturn[color].turns <= 0) {
          room.kingReturn[color] = null;
        }
      }

      updateReactionaryRookAfterMove(room, color, from, to, moveType);

      const reactionaryWinner = checkReactionaryThreat(room, color);

      if (reactionaryWinner) {
        broadcast(room, {
          type: "gameover",
          winner: reactionaryWinner,
          board
        });

        return;
      }

      if (room.doubleMove[color] > 1) {
        room.doubleMove[color]--;
      } else {
        room.doubleMove[color] = 0;
        room.turn = room.turn === "white" ? "black" : "white";
      }

      broadcast(room, makeUpdatePayload(room));
      return;
    }

    if (data.type === "cardUpdate") {
      const room = rooms[roomId];
      if (!room || room.over) return;

      room.board = data.board;
      room.turn = data.turn;
      room.enPassant = data.enPassant || null;
      room.moved = data.moved || room.moved;

      if (Array.isArray(data.necroCapturedPieces)) {
        room.capturedBy[color] = data.necroCapturedPieces;
      }

      if ("spaceTravelEnabled" in data) {
        room.spaceTravel[color] = !!data.spaceTravelEnabled;
      }

      if ("kingReturn" in data) {
        room.kingReturn[color] = data.kingReturn;
      }

      if ("reactionary" in data) {
        room.reactionary[color] = data.reactionary;
      }

      broadcast(room, makeUpdatePayload(room));
      return;
    }

    if (data.type === "resign") {
      const room = rooms[roomId];
      if (!room || room.over) return;

      room.over = true;

      const winner = color === "white" ? "black" : "white";

      broadcast(room, {
        type: "gameover",
        winner,
        board: room.board
      });

      return;
    }
  });

  ws.on("close", () => {
    const room = rooms[roomId];
    if (!room) return;

    room.players = room.players.filter(p => p.ws !== ws);

    if (room.players.length === 0) {
      delete rooms[roomId];
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
