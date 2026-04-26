import http from "http";
import { WebSocketServer } from "ws";

const server = http.createServer();
const wss = new WebSocketServer({ server });
const rooms = {};

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
    turn: "white",
    over: false,
    enPassant: null,
    moved: {
      wk:false, wrA:false, wrH:false,
      bk:false, brA:false, brH:false
    }
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
  let r = from.r + sr;
  let c = from.c + sc;

  while (r !== to.r || c !== to.c) {
    if (board[r][c]) return false;
    r += sr;
    c += sc;
  }

  return true;
}

function validMove(room, from, to, color) {
  const board = room.board;
  const piece = board[from.r]?.[from.c];

  if (!piece || piece[0] !== color[0]) return false;

  const target = board[to.r]?.[to.c];

  if (target && target[0] === color[0]) return false;

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
    ) return "doublePawn";

    if (ac === 1 && dr === dir && target) return "normal";

    if (
      ac === 1 &&
      dr === dir &&
      !target &&
      room.enPassant &&
      room.enPassant.r === to.r &&
      room.enPassant.c === to.c
    ) return "enPassant";

    return false;
  }

  if (type === "r") return (dr === 0 || dc === 0) && clearPath(board, from, to) ? "normal" : false;
  if (type === "b") return ar === ac && clearPath(board, from, to) ? "normal" : false;
  if (type === "q") return (dr === 0 || dc === 0 || ar === ac) && clearPath(board, from, to) ? "normal" : false;
  if (type === "n") return ((ar === 2 && ac === 1) || (ar === 1 && ac === 2)) ? "normal" : false;

  if (type === "k") {
    if (ar <= 1 && ac <= 1) return "normal";

    if (color === "white" && from.r === 7 && from.c === 4 && dr === 0) {
      if (dc === 2 && !room.moved.wk && !room.moved.wrH && board[7][5] === "" && board[7][6] === "" && board[7][7] === "wr") return "castleKing";
      if (dc === -2 && !room.moved.wk && !room.moved.wrA && board[7][1] === "" && board[7][2] === "" && board[7][3] === "" && board[7][0] === "wr") return "castleQueen";
    }

    if (color === "black" && from.r === 0 && from.c === 4 && dr === 0) {
      if (dc === 2 && !room.moved.bk && !room.moved.brH && board[0][5] === "" && board[0][6] === "" && board[0][7] === "br") return "castleKing";
      if (dc === -2 && !room.moved.bk && !room.moved.brA && board[0][1] === "" && board[0][2] === "" && board[0][3] === "" && board[0][0] === "br") return "castleQueen";
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

wss.on("connection", ws => {
  let roomId = null;
  let color = null;

  ws.on("message", msg => {
    const data = JSON.parse(msg.toString());

    if (data.type === "join") {
      roomId = data.roomId || "room1";

      if (!rooms[roomId]) rooms[roomId] = createRoom();

      const room = rooms[roomId];

      if (room.players.length >= 2) {
        send(ws, { type: "full" });
        return;
      }

      color = room.players.length === 0 ? "white" : "black";
      room.players.push({ ws, color });

      send(ws, {
        type: "start",
        color,
        board: room.board,
        turn: room.turn,
        enPassant: room.enPassant,
        moved: room.moved
      });
    }

    if (data.type === "move") {
      const room = rooms[roomId];

      if (!room || room.over) return;

      if (room.turn !== color) {
        send(ws, { type: "error", message: "네 차례가 아님" });
        return;
      }

      const { from, to } = data;
      const moveType = validMove(room, from, to, color);

      if (!moveType) {
        send(ws, { type: "error", message: "불가능한 이동" });
        return;
      }

      const board = room.board;
      const moving = board[from.r][from.c];
      let captured = board[to.r][to.c];

      updateMoved(room, moving, from);
      room.enPassant = null;

      if (moveType === "enPassant") {
        const capRow = color === "white" ? to.r + 1 : to.r - 1;
        captured = board[capRow][to.c];
        board[capRow][to.c] = "";
      }

      board[to.r][to.c] = moving;
      board[from.r][from.c] = "";

      if (moveType === "doublePawn") {
        const dir = color === "white" ? -1 : 1;
        room.enPassant = { r: from.r + dir, c: from.c };
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
        const allowed = ["q", "r", "b", "n"];
        const promoteTo = allowed.includes(data.promoteTo) ? data.promoteTo : "q";
        board[to.r][to.c] = moving[0] + promoteTo;
      }

      if (captured && captured[1] === "k") {
        room.over = true;

        broadcast(room, {
          type: "gameover",
          winner: color,
          board
        });

        return;
      }

      room.turn = room.turn === "white" ? "black" : "white";

      broadcast(room, {
        type: "update",
        board,
        turn: room.turn,
        enPassant: room.enPassant,
        moved: room.moved
      });
    }

    if (data.type === "reset") {
      const room = rooms[roomId];

      if (!room) return;

      room.board = createBoard();
      room.turn = "white";
      room.over = false;
      room.enPassant = null;
      room.moved = {
        wk:false, wrA:false, wrH:false,
        bk:false, brA:false, brH:false
      };

      broadcast(room, {
        type: "update",
        board: room.board,
        turn: room.turn,
        enPassant: room.enPassant,
        moved: room.moved
      });
    }
  });

  ws.on("close", () => {
    const room = rooms[roomId];

    if (!room) return;

    room.players = room.players.filter(p => p.ws !== ws);

    if (room.players.length === 0) delete rooms[roomId];
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
