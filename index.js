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

function createRoom(meta = {}) {
  return {
    id: meta.id || makeRoomId(),
    name: meta.name || "이름 없는 방",
    password: meta.password || "",
    isPrivate: !!meta.isPrivate,
    hostName: meta.hostName || "unknown",
    hostUid: meta.hostUid || "",
    createdAt: Date.now(),

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
    },

    equalityUses: {
      white: 0,
      black: 0
    }
  };
}

function makeRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function safeRoomInfo(room) {
  return {
    id: room.id,
    name: room.name,
    isPrivate: room.isPrivate,
    hasPassword: !!room.password,
    hostName: room.hostName,
    players: room.players.length,
    maxPlayers: 2,
    createdAt: room.createdAt,
    over: room.over
  };
}

function getPublicRooms() {
  return Object.values(rooms)
    .filter(room => !room.over)
    .filter(room => !room.isPrivate)
    .map(safeRoomInfo)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function send(ws, data) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data) {
  room.players.forEach(p => send(p.ws, data));
}

function otherColor(color) {
  return color === "white" ? "black" : "white";
}

function getPlayer(room, color) {
  return room.players.find(p => p.color === color);
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
    [3, 2],
    [3, -2],
    [-3, 2],
    [-3, -2],
    [2, 3],
    [-2, 3],
    [2, -3],
    [-2, -3]
  ];

  return moves.some(([mr, mc]) => mr === dr && mc === dc);
}

function validEqualityCastle() {
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

function getReactionaryOptions(room, color) {
  const result = [];

  if (color === "white") {
    if (room.moved.wk || room.moved.wrA || room.moved.wrH) {
      return result;
    }

    if (room.board[7]?.[0] === "wr") {
      result.push({ r: 7, c: 0, type: "normal" });
    }

    if (room.board[7]?.[7] === "wr") {
      result.push({ r: 7, c: 7, type: "normal" });
    }
  }

  if (color === "black") {
    if (room.moved.bk || room.moved.brA || room.moved.brH) {
      return result;
    }

    if (room.board[0]?.[0] === "br") {
      result.push({ r: 0, c: 0, type: "normal" });
    }

    if (room.board[0]?.[7] === "br") {
      result.push({ r: 0, c: 7, type: "normal" });
    }
  }

  return result;
}

function tryTriggerReactionaryAfterKingCapture(room, defenderColor) {
  if (room.cards[defenderColor] !== "reactionary") return false;
  if (room.reactionary[defenderColor]?.active) return false;

  const options = getReactionaryOptions(room, defenderColor);

  if (options.length === 0) return false;

  room.turn = defenderColor;

  broadcast(room, makeUpdatePayload(room));

  const defender = getPlayer(room, defenderColor);

  if (defender) {
    send(defender.ws, {
      type: "reactionaryRequest",
      color: defenderColor,
      board: room.board,
      turn: room.turn,
      options,
      message: "킹이 잡혔습니다. 반동분자로 왕룩을 선택하세요."
    });
  }

  return true;
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
    usedCards: room.usedCards,
    equalityUses: room.equalityUses,
    roomInfo: safeRoomInfo(room)
  };
}

function finishGame(room, winner) {
  room.over = true;

  broadcast(room, {
    type: "gameover",
    winner,
    board: room.board
  });
}

function startIfReady(room) {
  if (room.players.length < 2) {
    send(room.players[0]?.ws, {
      type: "waiting",
      message: "상대 기다리는 중...",
      roomInfo: safeRoomInfo(room)
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
      spaceTravelEnabled: room.spaceTravel[player.color],
      equalityUses: room.equalityUses,
      roomInfo: safeRoomInfo(room)
    });
  });
}

function joinRoom(ws, data) {
  const roomId = data.roomId;
  const room = rooms[roomId];

  if (!room) {
    send(ws, {
      type: "error",
      message: "방이 없습니다."
    });
    return null;
  }

  if (room.players.length >= 2) {
    send(ws, {
      type: "full",
      message: "방이 가득 찼습니다."
    });
    return null;
  }

  if (room.password && room.password !== (data.password || "")) {
    send(ws, {
      type: "error",
      message: "비밀번호가 틀렸습니다."
    });
    return null;
  }

  const color = room.players.length === 0 ? "white" : "black";

  room.players.push({
    ws,
    color,
    uid: data.uid || "",
    name: data.name || "guest"
  });

  startIfReady(room);

  return { room, color };
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

    if (data.type === "listRooms") {
      send(ws, {
        type: "roomList",
        rooms: getPublicRooms()
      });
      return;
    }

    if (data.type === "createRoom") {
      const id = makeRoomId();

      const room = createRoom({
        id,
        name: String(data.name || "이름 없는 방").slice(0, 24),
        password: String(data.password || ""),
        isPrivate: !!data.isPrivate,
        hostName: String(data.hostName || "host").slice(0, 24),
        hostUid: String(data.hostUid || "")
      });

      rooms[id] = room;
      roomId = id;

      const joined = joinRoom(ws, {
        roomId: id,
        password: data.password || "",
        uid: data.hostUid || "",
        name: data.hostName || "host"
      });

      if (joined) {
        color = joined.color;

        send(ws, {
          type: "roomCreated",
          roomInfo: safeRoomInfo(room)
        });
      }

      return;
    }

    if (data.type === "joinRoom") {
      roomId = data.roomId;

      const joined = joinRoom(ws, data);

      if (joined) {
        color = joined.color;
      }

      return;
    }

    if (data.type === "join") {
      roomId = data.roomId || "room1";

      if (!rooms[roomId]) {
        rooms[roomId] = createRoom({
          id: roomId,
          name: roomId,
          hostName: data.name || "host",
          hostUid: data.uid || ""
        });
      }

      const joined = joinRoom(ws, {
        roomId,
        password: data.password || "",
        uid: data.uid || "",
        name: data.name || "guest"
      });

      if (joined) {
        color = joined.color;
      }

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

      if (data.card === "equality") {
        broadcast(room, makeUpdatePayload(room));
        return;
      }

      if (data.card === "reactionary") {
        broadcast(room, makeUpdatePayload(room));
        return;
      }

      if (data.card === "spaceTravel") {
        room.spaceTravel[color] = true;
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
        finishGame(room, color);
        return;
      }

      updateMoved(room, moving, from);
      room.enPassant = null;

      if (moveType === "enPassant") {
        const capRow = color === "white" ? to.r + 1 : to.r - 1;
        captured = board[capRow][to.c];
        capturedForNecro = captured;

        if (captured && isReactionaryRook(room, opponent, capRow, to.c)) {
          finishGame(room, color);
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

      if (captured && captured[1] === "k") {
        const reactionaryTriggered = tryTriggerReactionaryAfterKingCapture(room, opponent);

        if (reactionaryTriggered) {
          return;
        }

        finishGame(room, color);
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
        finishGame(room, reactionaryWinner);
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

      if (data.equalityUsed) {
        room.equalityUses[color]++;

        if (room.equalityUses[color] >= 10) {
          finishGame(room, color);
          return;
        }
      }

      broadcast(room, makeUpdatePayload(room));
      return;
    }

    if (data.type === "resign") {
      const room = rooms[roomId];
      if (!room || room.over) return;

      const winner = color === "white" ? "black" : "white";
      finishGame(room, winner);
      return;
    }
  });

  ws.on("close", () => {
    const room = rooms[roomId];
    if (!room) return;

    room.players = room.players.filter(p => p.ws !== ws);

    if (room.players.length === 0) {
      delete rooms[roomId];
      return;
    }

    broadcast(room, {
      type: "opponentLeft",
      message: "상대가 나갔습니다."
    });
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
