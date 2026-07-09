const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

const CARD_IDS = [
  "fiveAhead",
  "bombLauncher",
  "noThatMove",
  "extremeEfficiency",
  "quickDuel",
  "queenRule",
  "temusanTimeStone",
  "versatile",
  "conscienceTest",
  "necro",
  "wildHorse",
  "spaceTravel",
  "doubleMove",
  "equality",
  "reactionary",
  "exorcism",
  "kingReturn"
];

const rooms = new Map();

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

function randomCard() {
  return CARD_IDS[Math.floor(Math.random() * CARD_IDS.length)];
}

function send(ws, data) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data) {
  for (const color of ["white", "black"]) {
    const player = room.players[color];
    if (player) send(player.ws, data);
  }
}

function getContentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  return "text/plain; charset=utf-8";
}

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
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": getContentType(filePath)
    });

    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

function makeRoomState() {
  return {
    players: {
      white: null,
      black: null
    },

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

    cards: {
      white: randomCard(),
      black: randomCard()
    },

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
      white: null,
      black: null
    },

    spaceTravel: {
      white: false,
      black: false
    },

    equalityUses: {
      white: 0,
      black: 0
    },

    bombLauncherUsed: {
      white: false,
      black: false
    },

    noThatMoveUses: {
      white: 2,
      black: 2
    },

    temusanTimeStoneUses: {
      white: 2,
      black: 2
    },

    queenRule: {
      white: false,
      black: false
    },

    versatile: {
      white: false,
      black: false
    },

    extremeEfficiency: {
      white: false,
      black: false
    },

    forbiddenMove: {
      white: null,
      black: null
    },

    moveHistory: [],
    quickDuel: null,
    pendingChoice: null
  };
}

function applyExtremeEfficiency(room, color) {
  const p = color === "white" ? "w" : "b";
  const row = color === "white" ? 7 : 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = room.board[r][c];

      if (!piece) continue;
      if (piece[0] !== p) continue;

      if (piece[1] !== "k" && piece[1] !== "q") {
        room.board[r][c] = "";
      }
    }
  }

  room.board[row][0] = p + "q";
  room.board[row][3] = p + "q";
  room.board[row][4] = p + "k";
  room.board[row][7] = p + "q";

  room.extremeEfficiency[color] = true;
}

function applyStartPassives(room) {
  for (const color of ["white", "black"]) {
    const card = room.cards[color];

    if (card === "extremeEfficiency") {
      applyExtremeEfficiency(room, color);
    }

    if (card === "versatile") {
      room.versatile[color] = true;
    }
  }
}

function sendStart(room) {
  for (const color of ["white", "black"]) {
    const player = room.players[color];

    send(player.ws, {
      type: "start",
      color,
      card: room.cards[color],
      board: room.board,
      turn: room.turn,
      enPassant: room.enPassant,
      moved: room.moved,
      equalityUses: room.equalityUses,

      capturedPieces: room.capturedBy[color],
      spaceTravelEnabled: room.spaceTravel[color],
      bombLauncherUsed: room.bombLauncherUsed[color],
      noThatMoveUses: room.noThatMoveUses[color],
      temusanTimeStoneUses: room.temusanTimeStoneUses[color],
      queenRuleActive: room.queenRule[color],
      versatileActive: room.versatile[color],
      extremeEfficiencyActive: room.extremeEfficiency[color]
    });
  }

  requestStartChoice(room);
}

function requestStartChoice(room) {
  for (const color of ["white", "black"]) {
    const card = room.cards[color];

    if (card !== "fiveAhead" && card !== "conscienceTest") continue;

    const chooser = color === "white" ? "black" : "white";

    room.pendingChoice = {
      card,
      owner: color,
      chooser
    };

    send(room.players[chooser].ws, {
      type: "resultChoiceRequest",
      card,
      owner: color,
      chooser,
      title: card === "fiveAhead" ? "5수 앞" : "양심테스트",
      message: card === "fiveAhead"
        ? "결과를 선택하세요. 실제 결과는 반대로 적용됩니다."
        : "결과를 선택하세요. 선택한 그대로 적용됩니다."
    });

    break;
  }
}

function broadcastUpdate(room) {
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
    equalityUses: room.equalityUses,

    bombLauncherUsed: room.bombLauncherUsed,
    noThatMoveUses: room.noThatMoveUses,
    temusanTimeStoneUses: room.temusanTimeStoneUses,
    queenRule: room.queenRule,
    versatile: room.versatile,
    extremeEfficiency: room.extremeEfficiency,
    forbiddenMove: room.forbiddenMove
  });
}

function updateMoved(room, piece, from) {
  if (piece === "wk") room.moved.wk = true;
  if (piece === "bk") room.moved.bk = true;

  if (piece === "wr" && from.r === 7 && from.c === 0) room.moved.wrA = true;
  if (piece === "wr" && from.r === 7 && from.c === 7) room.moved.wrH = true;

  if (piece === "br" && from.r === 0 && from.c === 0) room.moved.brA = true;
  if (piece === "br" && from.r === 0 && from.c === 7) room.moved.brH = true;
}

function handleMove(room, color, data) {
  if (room.pendingChoice || room.quickDuel) return;

  if (room.turn !== color) {
    send(room.players[color].ws, {
      type: "error",
      message: "네 턴이 아님"
    });
    return;
  }

  const { from, to, promoteTo } = data;

  const forbidden = room.forbiddenMove[color];

  if (
    forbidden &&
    forbidden.from.r === from.r &&
    forbidden.from.c === from.c &&
    forbidden.to.r === to.r &&
    forbidden.to.c === to.c
  ) {
    send(room.players[color].ws, {
      type: "error",
      message: "그 수 하지 마로 금지된 수입니다."
    });
    return;
  }

  const moving = room.board[from.r]?.[from.c];

  if (!moving || moving[0] !== (color === "white" ? "w" : "b")) {
    send(room.players[color].ws, {
      type: "error",
      message: "내 기물이 아님"
    });
    return;
  }

  const target = room.board[to.r]?.[to.c];

  if (target && target[0] === moving[0]) {
    send(room.players[color].ws, {
      type: "error",
      message: "내 기물이 있는 칸입니다."
    });
    return;
  }

  room.moveHistory.push({
    by: color,
    from,
    to,
    board: JSON.parse(JSON.stringify(room.board)),
    turn: room.turn,
    moved: JSON.parse(JSON.stringify(room.moved)),
    enPassant: room.enPassant,
    forbiddenMove: JSON.parse(JSON.stringify(room.forbiddenMove))
  });

  updateMoved(room, moving, from);

  if (target && target[0] !== moving[0] && target[1] !== "k") {
    room.capturedBy[color].push(target);
  }

  room.board[to.r][to.c] = moving;
  room.board[from.r][from.c] = "";

  if (moving[1] === "p" && (to.r === 0 || to.r === 7)) {
    room.board[to.r][to.c] = moving[0] + (promoteTo || "q");
  }

  if (target && target[0] !== moving[0]) {
    maybeBomb(room, color, to);

    const targetColor = target[0] === "w" ? "white" : "black";

    if (room.queenRule[targetColor]) {
      if (target[1] === "q") {
        broadcast(room, {
          type: "gameover",
          winner: color,
          reason: "queenRule",
          board: room.board
        });
        return;
      }
    } else if (target[1] === "k") {
      broadcast(room, {
        type: "gameover",
        winner: color,
        reason: "king",
        board: room.board
      });
      return;
    }
  }

  room.forbiddenMove[color] = null;

  if (room.doubleMove[color] > 1) {
    room.doubleMove[color]--;
  } else {
    room.doubleMove[color] = 0;
    room.turn = color === "white" ? "black" : "white";
  }

  broadcastUpdate(room);
}

function maybeBomb(room, color, center) {
  const colors = ["white", "black"];

  for (const owner of colors) {
    if (room.cards[owner] !== "bombLauncher") continue;
    if (room.bombLauncherUsed[owner]) continue;

    room.bombLauncherUsed[owner] = true;
    room.usedCards[owner] = true;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = center.r + dr;
        const c = center.c + dc;

        if (r < 0 || r > 7 || c < 0 || c > 7) continue;

        const piece = room.board[r][c];

        if (!piece) continue;
        if (piece[1] === "k") continue;

        room.board[r][c] = "";
      }
    }

    broadcast(room, {
      type: "bombActivated",
      owner
    });
  }
}

function handleCard(room, color, card) {
  if (card === "doubleMove") {
    room.doubleMove[color] = 2;
    room.usedCards[color] = true;
    broadcastUpdate(room);
    return;
  }

  if (card === "wildHorse") {
    room.wildHorse[color] = true;
    room.usedCards[color] = true;
    broadcastUpdate(room);
    return;
  }

  if (card === "spaceTravel") {
    room.spaceTravel[color] = true;
    broadcastUpdate(room);
    return;
  }

  if (card === "queenRule") {
    room.queenRule[color] = true;
    room.usedCards[color] = true;
    broadcastUpdate(room);
    return;
  }

  if (card === "quickDuel") {
    room.quickDuel = {
      round: 1,
      score: {
        white: 0,
        black: 0
      },
      choices: {}
    };

    room.usedCards[color] = true;

    broadcast(room, {
      type: "quickDuelStart",
      round: 1,
      score: room.quickDuel.score
    });

    return;
  }

  if (card === "noThatMove") {
    handleNoThatMove(room, color);
    return;
  }

  if (card === "temusanTimeStone") {
    handleTemusanTimeStone(room, color);
    return;
  }

  room.usedCards[color] = true;
  broadcastUpdate(room);
}

function handleNoThatMove(room, color) {
  if (room.noThatMoveUses[color] <= 0) return;

  const last = room.moveHistory[room.moveHistory.length - 1];

  if (!last || last.by === color) {
    send(room.players[color].ws, {
      type: "error",
      message: "무를 상대 수가 없습니다."
    });
    return;
  }

  room.board = last.board;
  room.turn = last.turn;
  room.moved = last.moved;
  room.enPassant = last.enPassant;
  room.forbiddenMove = last.forbiddenMove;

  room.moveHistory.pop();

  room.noThatMoveUses[color]--;

  room.forbiddenMove[last.by] = {
    from: last.from,
    to: last.to
  };

  if (room.noThatMoveUses[color] <= 0) {
    room.usedCards[color] = true;
  }

  broadcast(room, {
    type: "moveUndone",
    reason: "noThatMove"
  });

  broadcastUpdate(room);
}

function handleTemusanTimeStone(room, color) {
  if (room.temusanTimeStoneUses[color] <= 0) return;

  let index = -1;

  for (let i = room.moveHistory.length - 1; i >= 0; i--) {
    if (room.moveHistory[i].by === color) {
      index = i;
      break;
    }
  }

  if (index === -1) {
    send(room.players[color].ws, {
      type: "error",
      message: "무를 내 수가 없습니다."
    });
    return;
  }

  const item = room.moveHistory[index];

  room.board = item.board;
  room.turn = item.turn;
  room.moved = item.moved;
  room.enPassant = item.enPassant;
  room.forbiddenMove = item.forbiddenMove;

  room.moveHistory = room.moveHistory.slice(0, index);

  room.temusanTimeStoneUses[color]--;

  if (room.temusanTimeStoneUses[color] <= 0) {
    room.usedCards[color] = true;
  }

  broadcast(room, {
    type: "moveUndone",
    reason: "temusanTimeStone"
  });

  broadcastUpdate(room);
}

function handleCardUpdate(room, color, data) {
  room.board = data.board || room.board;
  room.turn = data.turn || room.turn;
  room.enPassant = data.enPassant || room.enPassant;
  room.moved = data.moved || room.moved;

  if (data.necroCapturedPieces) {
    room.capturedBy[color] = data.necroCapturedPieces;
  }

  if (data.spaceTravelEnabled !== undefined) {
    room.spaceTravel[color] = data.spaceTravelEnabled;
  }

  if (data.queenRuleActive !== undefined) {
    room.queenRule[color] = data.queenRuleActive;
  }

  if (data.versatileActive !== undefined) {
    room.versatile[color] = data.versatileActive;
  }

  if (data.kingReturn !== undefined) {
    room.kingReturn[color] = data.kingReturn;
  }

  if (data.reactionary) {
    room.reactionary[color] = data.reactionary;
  }

  if (data.equalityUsed) {
    room.equalityUses[color]++;
  }

  broadcastUpdate(room);
}

function handleResultChoice(room, color, option) {
  const pending = room.pendingChoice;

  if (!pending) return;
  if (pending.chooser !== color) return;

  const owner = pending.owner;
  const chooser = pending.chooser;
  let winner;

  if (pending.card === "fiveAhead") {
    winner = option === "opponentWin" ? owner : chooser;
  } else {
    winner = option === "opponentWin" ? chooser : owner;
  }

  room.pendingChoice = null;

  broadcast(room, {
    type: "gameover",
    winner,
    reason: pending.card,
    board: room.board
  });
}

function handleQuickDuelChoice(room, color, choice) {
  const duel = room.quickDuel;

  if (!duel) return;

  duel.choices[color] = choice;

  send(room.players[color].ws, {
    type: "quickDuelPicked"
  });

  if (!duel.choices.white || !duel.choices.black) return;

  const white = duel.choices.white;
  const black = duel.choices.black;

  let roundWinner = null;

  if (white !== black) {
    if (
      (white === "rock" && black === "scissors") ||
      (white === "scissors" && black === "paper") ||
      (white === "paper" && black === "rock")
    ) {
      roundWinner = "white";
    } else {
      roundWinner = "black";
    }

    duel.score[roundWinner]++;
  }

  broadcast(room, {
    type: "quickDuelRound",
    round: duel.round,
    whiteText: choiceToKorean(white),
    blackText: choiceToKorean(black),
    roundWinner,
    score: duel.score
  });

  if (duel.score.white >= 2 || duel.score.black >= 2) {
    const winner = duel.score.white >= 2 ? "white" : "black";

    room.quickDuel = null;

    broadcast(room, {
      type: "gameover",
      winner,
      reason: "quickDuel",
      board: room.board
    });

    return;
  }

  duel.round++;
  duel.choices = {};

  broadcast(room, {
    type: "quickDuelNext",
    round: duel.round,
    score: duel.score
  });
}

function choiceToKorean(choice) {
  if (choice === "rock") return "묵";
  if (choice === "scissors") return "찌";
  if (choice === "paper") return "빠";
  return "?";
}

wss.on("connection", ws => {
  ws.roomId = null;
  ws.color = null;

  ws.on("message", raw => {
    let data;

    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data.type === "join") {
      const roomId = String(data.roomId || "").toUpperCase();

      if (!roomId) {
        send(ws, {
          type: "error",
          message: "방 코드 없음"
        });
        return;
      }

      if (!rooms.has(roomId)) {
        rooms.set(roomId, makeRoomState());
      }

      const room = rooms.get(roomId);

      let color = null;

      if (!room.players.white) {
        color = "white";
      } else if (!room.players.black) {
        color = "black";
      } else {
        send(ws, {
          type: "full"
        });
        return;
      }

      room.players[color] = {
        ws
      };

      ws.roomId = roomId;
      ws.color = color;

      if (!room.players.white || !room.players.black) {
        send(ws, {
          type: "waiting",
          message: "상대 기다리는 중... 방 코드: " + roomId
        });
        return;
      }

      applyStartPassives(room);
      sendStart(room);
      return;
    }

    const room = rooms.get(ws.roomId);

    if (!room || !ws.color) return;

    if (data.type === "move") {
      handleMove(room, ws.color, data);
      return;
    }

    if (data.type === "card") {
      handleCard(room, ws.color, data.card);
      return;
    }

    if (data.type === "cardUpdate") {
      handleCardUpdate(room, ws.color, data);
      return;
    }

    if (data.type === "resultChoice") {
      handleResultChoice(room, ws.color, data.option);
      return;
    }

    if (data.type === "quickDuelChoice") {
      handleQuickDuelChoice(room, ws.color, data.choice);
      return;
    }

    if (data.type === "resign") {
      broadcast(room, {
        type: "gameover",
        winner: ws.color === "white" ? "black" : "white",
        reason: "resign",
        board: room.board
      });
    }
  });

  ws.on("close", () => {
    const room = rooms.get(ws.roomId);

    if (!room) return;

    if (ws.color && room.players[ws.color]?.ws === ws) {
      room.players[ws.color] = null;
    }

    if (!room.players.white && !room.players.black) {
      rooms.delete(ws.roomId);
    }
  });
});

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
