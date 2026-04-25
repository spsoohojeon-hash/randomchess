import http from "http";
import { WebSocketServer } from "ws";

const server = http.createServer();
const wss = new WebSocketServer({ server });
const rooms = {};

function newState() {
  return {
    board: [
      ["br","bn","bb","bq","bk","bb","bn","br"],
      ["bp","bp","bp","bp","bp","bp","bp","bp"],
      ["","","","","","","",""],
      ["","","","","","","",""],
      ["","","","","","","",""],
      ["","","","","","","",""],
      ["wp","wp","wp","wp","wp","wp","wp","wp"],
      ["wr","wn","wb","wq","wk","wb","wn","wr"]
    ],
    turn: "white",
    enPassant: null,
    moved: { wk:false, bk:false, wrA:false, wrH:false, brA:false, brH:false },
    over: false
  };
}

function roomState(room) {
  return {
    board: room.state.board,
    turn: room.state.turn,
    enPassant: room.state.enPassant,
    moved: room.state.moved,
    over: room.state.over
  };
}

function send(ws, data) {
  ws.send(JSON.stringify(data));
}

function broadcast(room, data) {
  room.players.forEach(p => send(p.ws, data));
}

function clearPath(board, from, to) {
  const sr = Math.sign(to.r - from.r);
  const sc = Math.sign(to.c - from.c);
  let r = from.r + sr, c = from.c + sc;

  while (r !== to.r || c !== to.c) {
    if (board[r][c]) return false;
    r += sr;
    c += sc;
  }
  return true;
}

function getMoveKind(state, from, to, color) {
  const b = state.board;
  const piece = b[from.r]?.[from.c];
  if (!piece || piece[0] !== color[0]) return null;

  const target = b[to.r]?.[to.c];
  if (target && target[0] === color[0]) return null;

  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const ar = Math.abs(dr);
  const ac = Math.abs(dc);
  const type = piece[1];

  if (type === "p") {
    const dir = color === "white" ? -1 : 1;
    const start = color === "white" ? 6 : 1;

    if (dc === 0 && !target && dr === dir) return "normal";
    if (dc === 0 && !target && from.r === start && dr === dir * 2 && !b[from.r + dir][from.c]) return "doublePawn";
    if (ac === 1 && dr === dir && target) return "normal";

    if (
      ac === 1 && dr === dir && !target &&
      state.enPassant &&
      state.enPassant.r === to.r &&
      state.enPassant.c === to.c
    ) return "enPassant";

    return null;
  }

  if (type === "r") return (dr === 0 || dc === 0) && clearPath(b, from, to) ? "normal" : null;
  if (type === "b") return ar === ac && clearPath(b, from, to) ? "normal" : null;
  if (type === "q") return (dr === 0 || dc === 0 || ar === ac) && clearPath(b, from, to) ? "normal" : null;
  if (type === "n") return (ar === 2 && ac === 1) || (ar === 1 && ac === 2) ? "normal" : null;

  if (type === "k") {
    if (ar <= 1 && ac <= 1) return "normal";

    if (color === "white" && from.r === 7 && from.c === 4 && dr === 0) {
      if (dc === 2 && !state.moved.wk && !state.moved.wrH && b[7][5] === "" && b[7][6] === "" && b[7][7] === "wr") return "castleKing";
      if (dc === -2 && !state.moved.wk && !state.moved.wrA && b[7][1] === "" && b[7][2] === "" && b[7][3] === "" && b[7][0] === "wr") return "castleQueen";
    }

    if (color === "black" && from.r === 0 && from.c === 4 && dr === 0) {
      if (dc === 2 && !state.moved.bk && !state.moved.brH && b[0][5] === "" && b[0][6] === "" && b[0][7] === "br") return "castleKing";
      if (dc === -2 && !state.moved.bk && !state.moved.brA && b[0][1] === "" && b[0][2] === "" && b[0][3] === "" && b[0][0] === "br") return "castleQueen";
    }
  }

  return null;
}

function markMoved(state, piece, from) {
  if (piece === "wk") state.moved.wk = true;
  if (piece === "bk") state.moved.bk = true;
  if (piece === "wr" && from.r === 7 && from.c === 0) state.moved.wrA = true;
  if (piece === "wr" && from.r === 7 && from.c === 7) state.moved.wrH = true;
  if (piece === "br" && from.r === 0 && from.c === 0) state.moved.brA = true;
  if (piece === "br" && from.r === 0 && from.c === 7) state.moved.brH = true;
}

function applyMove(state, from, to, color, promoteTo = "q") {
  const kind = getMoveKind(state, from, to, color);
  if (!kind) return { ok:false };

  const b = state.board;
  const moving = b[from.r][from.c];
  let captured = b[to.r][to.c];

  markMoved(state, moving, from);
  state.enPassant = null;

  if (kind === "enPassant") {
    const capRow = color === "white" ? to.r + 1 : to.r - 1;
    captured = b[capRow][to.c];
    b[capRow][to.c] = "";
  }

  b[to.r][to.c] = moving;
  b[from.r][from.c] = "";

  if (kind === "doublePawn") {
    const dir = color === "white" ? -1 : 1;
    state.enPassant = { r: from.r + dir, c: from.c };
  }

  if (kind === "castleKing") {
    const row = color === "white" ? 7 : 0;
    b[row][5] = b[row][7];
    b[row][7] = "";
  }

  if (kind === "castleQueen") {
    const row = color === "white" ? 7 : 0;
    b[row][3] = b[row][0];
    b[row][0] = "";
  }

  if (moving[1] === "p" && (to.r === 0 || to.r === 7)) {
    const allowed = ["q","r","b","n"];
    b[to.r][to.c] = moving[0] + (allowed.includes(promoteTo) ? promoteTo : "q");
  }

  if (captured && captured[1] === "k") {
    state.over = true;
    return { ok:true, gameover:true };
  }

  state.turn = state.turn === "white" ? "black" : "white";
  return { ok:true };
}

wss.on("connection", ws => {
  let currentRoom = null;
  let color = null;

  ws.on("message", raw => {
    const data = JSON.parse(raw.toString());

    if (data.type === "join") {
      const roomId = data.roomId;
      if (!roomId) return;

      if (!rooms[roomId]) rooms[roomId] = { players: [], state: newState() };
      const room = rooms[roomId];

      if (room.players.length >= 2) {
        send(ws, { type:"full" });
        return;
      }

      color = room.players.length === 0 ? "white" : "black";
      currentRoom = roomId;
      room.players.push({ ws, color });

      send(ws, { type:"start", color, state: roomState(room) });
      broadcast(room, { type:"players", count: room.players.length });
    }

    if (data.type === "move") {
      const room = rooms[currentRoom];
      if (!room || room.state.over) return;

      if (room.state.turn !== color) {
        send(ws, { type:"error", message:"네 차례가 아님" });
        return;
      }

      const result = applyMove(room.state, data.from, data.to, color, data.promoteTo);

      if (!result.ok) {
        send(ws, { type:"error", message:"불가능한 이동" });
        return;
      }

      if (result.gameover) {
        broadcast(room, { type:"gameover", winner:color, state: roomState(room) });
        return;
      }

      broadcast(room, { type:"update", state: roomState(room) });
    }

    if (data.type === "reset") {
      const room = rooms[currentRoom];
      if (!room) return;
      room.state = newState();
      broadcast(room, { type:"update", state: roomState(room) });
    }
  });

  ws.on("close", () => {
    const room = rooms[currentRoom];
    if (!room) return;

    room.players = room.players.filter(p => p.ws !== ws);
    if (room.players.length === 0) delete rooms[currentRoom];
    else broadcast(room, { type:"players", count: room.players.length });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on", PORT));
