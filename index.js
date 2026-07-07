import http from "http";
import fs from "fs";
import path from "path";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3000;
const __dirname = process.cwd();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  let filePath = req.url.split("?")[0];

  if (filePath === "/") {
    filePath = "/index.html";
  }

  filePath = path.join(__dirname, filePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath);
    const type = mimeTypes[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-cache"
    });

    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

const rooms = {};

const CARD_IDS = [
  "necro",
  "wildHorse",
  "spaceTravel",
  "doubleMove",
  "equality",
  "reactionary",
  "exorcism",
  "kingReturn"
];

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

function pickCards() {
  const shuffled = [...CARD_IDS].sort(() => Math.random() - 0.5);

  return {
    white: shuffled[0],
    black: shuffled[1]
  };
}

function createRoom() {
  return {
    players: [],
    board: createBoard(),
    turn: "white",
    enPassant: null,
    moved: {
      wk: false,
      wrA: false,
      wrH: false,
      bk: false,
      brA: false,
      brH: false
    },
    cards: pickCards(),
    usedCards: {
      white: false,
      black: false
    },
    capturedBy: {
      white: [],
      black: []
    },
    doubleMove: {
      white: 0,
      black: 0
    },
    wildHorse: {
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

function send(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data) {
  for (const player of room.players) {
    send(player.ws, data);
  }
}

function findRoomBySocket(ws) {
  for (const [roomId, room] of Object.entries(rooms)) {
    const player = room.players.find(p => p.ws === ws);

    if (player) {
      return {
        roomId,
        room,
        player
      };
    }
  }

  return null;
}

function opposite(color) {
  return color === "white" ? "black" : "white";
}

function pieceColor(piece) {
  if (!piece) return null;
  return piece[0] === "w" ? "white" : "black";
}

function isKing(piece) {
  return piece === "wk" || piece === "bk";
}

function handleMove(ws, data) {
  const found = findRoomBySocket(ws);

  if (!found) {
    send(ws, {
      type: "error",
      message: "방을 찾을 수 없음"
    });
    return;
  }

  const { room, player } = found;

  if (room.turn !== player.color) {
    send(ws, {
      type: "error",
      message: "네 턴이 아님"
    });
    return;
  }

  const from = data.from;
  const to = data.to;

  if (!from || !to) {
    send(ws, {
      type: "error",
      message: "잘못된 이동"
    });
    return;
  }

  const moving = room.board[from.r]?.[from.c];

  if (!moving) {
    send(ws, {
      type: "error",
      message: "기물이 없음"
    });
    return;
  }

  if (pieceColor(moving) !== player.color) {
    send(ws, {
      type: "error",
      message: "내 기물이 아님"
    });
    return;
  }

  const target = room.board[to.r]?.[to.c];

  if (target && pieceColor(target) === player.color) {
    send(ws, {
      type: "error",
      message: "내 기물이 있는 칸"
    });
    return;
  }

  const capturedColor = target ? pieceColor(target) : null;

  if (target && !isKing(target) && capturedColor && capturedColor !== player.color) {
    room.capturedBy[player.color].push(target);
  }

  room.board[to.r][to.c] = moving;
  room.board[from.r][from.c] = "";

  if (moving[1] === "p" && (to.r === 0 || to.r === 7)) {
    room.board[to.r][to.c] = moving[0] + (data.promoteTo || "q");
  }

  if (isKing(target)) {
    broadcast(room, {
      type: "gameover",
      winner: player.color,
      board: room.board
    });
    return;
  }

  if (room.doubleMove[player.color] > 1) {
    room.doubleMove[player.color]--;
  } else {
    room.doubleMove[player.color] = 0;
    room.turn = opposite(room.turn);
  }

  broadcast(room, {
    type: "update",
    board: room.board,
    turn: room.turn,
    enPassant: room.enPassant,
    moved: room.moved,
    usedCards: room.usedCards,
    capturedBy: room.capturedBy,
    doubleMove: room.doubleMove,
    wildHorse: room.wildHorse,
    kingReturn: room.kingReturn,
    reactionary: room.reactionary,
    spaceTravel: room.spaceTravel,
    equalityUses: room.equalityUses
  });
}

function handleCard(ws, data) {
  const found = findRoomBySocket(ws);

  if (!found) {
    send(ws, {
      type: "error",
      message: "방을 찾을 수 없음"
    });
    return;
  }

  const { room, player } = found;
  const card = data.card;

  if (!card) return;

  if (card !== "equality" && card !== "reactionary" && card !== "spaceTravel") {
    room.usedCards[player.color] = true;
  }

  if (card === "doubleMove") {
    room.doubleMove[player.color] = 2;
  }

  if (card === "wildHorse") {
    room.wildHorse[player.color] = true;
  }

  if (card === "spaceTravel") {
    room.spaceTravel[player.color] = true;
  }

  broadcast(room, {
    type: "update",
    board: room.board,
    turn: room.turn,
    enPassant: room.enPassant,
    moved: room.moved,
    usedCards: room.usedCards,
    capturedBy: room.capturedBy,
    doubleMove: room.doubleMove,
    wildHorse: room.wildHorse,
    kingReturn: room.kingReturn,
    reactionary: room.reactionary,
    spaceTravel: room.spaceTravel,
    equalityUses: room.equalityUses
  });
}

function handleCardUpdate(ws, data) {
  const found = findRoomBySocket(ws);

  if (!found) {
    send(ws, {
      type: "error",
      message: "방을 찾을 수 없음"
    });
    return;
  }

  const { room, player } = found;

  if (data.board) room.board = data.board;
  if (data.turn) room.turn = data.turn;
  if (data.enPassant !== undefined) room.enPassant = data.enPassant;
  if (data.moved) room.moved = data.moved;

  if (Array.isArray(data.necroCapturedPieces)) {
    room.capturedBy[player.color] = data.necroCapturedPieces;
  }

  if (data.kingReturn !== undefined) {
    room.kingReturn[player.color] = data.kingReturn;
  }

  if (data.reactionary) {
    room.reactionary[player.color] = data.reactionary;
  }

  if (data.spaceTravelEnabled !== undefined) {
    room.spaceTravel[player.color] = data.spaceTravelEnabled;
  }

  if (data.equalityUsed) {
    room.equalityUses[player.color]++;

    if (room.equalityUses[player.color] >= 10) {
      broadcast(room, {
        type: "gameover",
        winner: player.color,
        board: room.board
      });
      return;
    }
  }

  broadcast(room, {
    type: "update",
    board: room.board,
    turn: room.turn,
    enPassant: room.enPassant,
    moved: room.moved,
    usedCards: room.usedCards,
    capturedBy: room.capturedBy,
    doubleMove: room.doubleMove,
    wildHorse: room.wildHorse,
    kingReturn: room.kingReturn,
    reactionary: room.reactionary,
    spaceTravel: room.spaceTravel,
    equalityUses: room.equalityUses
  });
}

function handleResign(ws) {
  const found = findRoomBySocket(ws);

  if (!found) return;

  const { room, player } = found;
  const winner = opposite(player.color);

  broadcast(room, {
    type: "gameover",
    winner,
    board: room.board
  });
}

wss.on("connection", ws => {
  ws.on("message", raw => {
    let data;

    try {
      data = JSON.parse(raw.toString());
    } catch {
      send(ws, {
        type: "error",
        message: "잘못된 데이터"
      });
      return;
    }

    if (data.type === "join") {
      const roomId = String(data.roomId || "").trim().toUpperCase();

      if (!roomId) {
        send(ws, {
          type: "error",
          message: "방 코드 없음"
        });
        return;
      }

      if (!rooms[roomId]) {
        rooms[roomId] = createRoom();
      }

      const room = rooms[roomId];

      if (room.players.length >= 2) {
        send(ws, {
          type: "full"
        });
        return;
      }

      const color = room.players.length === 0 ? "white" : "black";

      room.players.push({
        ws,
        color
      });

      ws.roomId = roomId;
      ws.color = color;

      if (room.players.length === 1) {
        send(ws, {
          type: "waiting",
          message: "상대 기다리는 중..."
        });
        return;
      }

      for (const player of room.players) {
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
          equalityUses: room.equalityUses
        });
      }

      return;
    }

    if (data.type === "move") {
      handleMove(ws, data);
      return;
    }

    if (data.type === "card") {
      handleCard(ws, data);
      return;
    }

    if (data.type === "cardUpdate") {
      handleCardUpdate(ws, data);
      return;
    }

    if (data.type === "resign") {
      handleResign(ws);
      return;
    }

    send(ws, {
      type: "error",
      message: "알 수 없는 요청: " + data.type
    });
  });

  ws.on("close", () => {
    const found = findRoomBySocket(ws);

    if (!found) return;

    const { roomId, room, player } = found;

    room.players = room.players.filter(p => p.ws !== ws);

    if (room.players.length === 0) {
      delete rooms[roomId];
      return;
    }

    broadcast(room, {
      type: "gameover",
      winner: opposite(player.color),
      board: room.board
    });

    delete rooms[roomId];
  });
});

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
