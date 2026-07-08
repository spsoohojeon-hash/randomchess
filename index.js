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

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
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

    pendingChoice: null,

    quickDuel: null
  };
}

function send(ws, data) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data) {
  for (const player of room.players) {
    send(player.ws, data);
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

function colorPrefix(color) {
  return color === "white" ? "w" : "b";
}

function isKing(piece) {
  return piece === "wk" || piece === "bk";
}

function isQueen(piece) {
  return piece === "wq" || piece === "bq";
}

function sameSquare(a, b) {
  return a && b && a.r === b.r && a.c === b.c;
}

function sameMove(a, b) {
  if (!a || !b) return false;
  return sameSquare(a.from, b.from) && sameSquare(a.to, b.to);
}

function applyExtremeEfficiency(room, color) {
  const p = colorPrefix(color);
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

function getPlayer(room, color) {
  return room.players.find(p => p.color === color);
}

function requestStartChoiceIfNeeded(room) {
  if (room.pendingChoice) return true;

  for (const color of ["white", "black"]) {
    const card = room.cards[color];

    if (card !== "fiveAhead" && card !== "conscienceTest") continue;
    if (room.usedCards[color]) continue;

    const opponent = opposite(color);
    const opponentPlayer = getPlayer(room, opponent);

    if (!opponentPlayer) continue;

    room.pendingChoice = {
      owner: color,
      chooser: opponent,
      card
    };

    send(opponentPlayer.ws, {
      type: "resultChoiceRequest",
      card,
      owner: color,
      chooser: opponent,
      title: card === "fiveAhead" ? "5수 앞" : "양심테스트",
      message: card === "fiveAhead"
        ? "상대가 5수 앞을 사용했습니다. 결과를 선택하세요. 실제 결과는 반대로 적용됩니다."
        : "상대가 양심테스트를 사용했습니다. 결과를 선택하세요. 선택한 그대로 적용됩니다."
    });

    return true;
  }

  return false;
}

function startRoomIfReady(room) {
  applyStartPassives(room);

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
      equalityUses: room.equalityUses,
      bombLauncherUsed: room.bombLauncherUsed[player.color],
      noThatMoveUses: room.noThatMoveUses[player.color],
      temusanTimeStoneUses: room.temusanTimeStoneUses[player.color],
      queenRuleActive: room.queenRule[player.color],
      versatileActive: room.versatile[player.color],
      extremeEfficiencyActive: room.extremeEfficiency[player.color]
    });
  }

  requestStartChoiceIfNeeded(room);
}

function applyBombExplosion(room, centerR, centerC, ownerColor) {
  if (room.bombLauncherUsed[ownerColor]) return;

  room.bombLauncherUsed[ownerColor] = true;
  room.usedCards[ownerColor] = true;

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = centerR + dr;
      const c = centerC + dc;

      if (r < 0 || r > 7 || c < 0 || c > 7) continue;

      const piece = room.board[r][c];

      if (!piece) continue;
      if (isKing(piece)) continue;

      room.board[r][c] = "";
    }
  }

  broadcast(room, {
    type: "bombActivated",
    owner: ownerColor,
    center: {
      r: centerR,
      c: centerC
    }
  });
}

function checkQueenRuleCapture(room, target, capturedColor, moverColor) {
  if (!target) return false;
  if (!capturedColor) return false;

  if (room.queenRule[capturedColor] && isQueen(target)) {
    broadcast(room, {
      type: "gameover",
      winner: moverColor,
      board: room.board,
      reason: "queenRule"
    });
    return true;
  }

  if (!room.queenRule[capturedColor] && isKing(target)) {
    broadcast(room, {
      type: "gameover",
      winner: moverColor,
      board: room.board,
      reason: "kingCaptured"
    });
    return true;
  }

  return false;
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

  if (room.pendingChoice) {
    send(ws, {
      type: "error",
      message: "선택 능력 처리 중입니다."
    });
    return;
  }

  if (room.quickDuel) {
    send(ws, {
      type: "error",
      message: "묵찌빠 진행 중입니다."
    });
    return;
  }

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

  const attemptedMove = {
    from,
    to
  };

  if (sameMove(room.forbiddenMove[player.color], attemptedMove)) {
    send(ws, {
      type: "error",
      message: "그 수 하지 마로 금지된 같은 수입니다."
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

  const beforeBoard = clone(room.board);
  const beforeTurn = room.turn;
  const beforeState = {
    enPassant: clone(room.enPassant),
    moved: clone(room.moved),
    capturedBy: clone(room.capturedBy),
    doubleMove: clone(room.doubleMove),
    wildHorse: clone(room.wildHorse),
    kingReturn: clone(room.kingReturn),
    reactionary: clone(room.reactionary),
    spaceTravel: clone(room.spaceTravel),
    equalityUses: clone(room.equalityUses),
    bombLauncherUsed: clone(room.bombLauncherUsed),
    usedCards: clone(room.usedCards),
    queenRule: clone(room.queenRule),
    versatile: clone(room.versatile),
    extremeEfficiency: clone(room.extremeEfficiency),
    forbiddenMove: clone(room.forbiddenMove)
  };

  const capturedColor = target ? pieceColor(target) : null;

  if (target && !isKing(target) && !isQueen(target) && capturedColor && capturedColor !== player.color) {
    room.capturedBy[player.color].push(target);
  }

  if (target && isQueen(target) && capturedColor && capturedColor !== player.color) {
    room.capturedBy[player.color].push(target);
  }

  room.board[to.r][to.c] = moving;
  room.board[from.r][from.c] = "";

  if (moving[1] === "p" && (to.r === 0 || to.r === 7)) {
    room.board[to.r][to.c] = moving[0] + (data.promoteTo || "q");
  }

  room.moveHistory.push({
    by: player.color,
    from: clone(from),
    to: clone(to),
    moving,
    target,
    promoteTo: data.promoteTo || null,
    beforeBoard,
    beforeTurn,
    beforeState
  });

  room.forbiddenMove[player.color] = null;

  if (target && capturedColor && capturedColor !== player.color) {
    const possibleBombOwners = [player.color, capturedColor];

    for (const owner of possibleBombOwners) {
      if (room.cards[owner] === "bombLauncher" && !room.bombLauncherUsed[owner]) {
        applyBombExplosion(room, to.r, to.c, owner);
        break;
      }
    }
  }

  if (checkQueenRuleCapture(room, target, capturedColor, player.color)) {
    return;
  }

  if (room.doubleMove[player.color] > 1) {
    room.doubleMove[player.color]--;
  } else {
    room.doubleMove[player.color] = 0;
    room.turn = opposite(room.turn);
  }

  broadcastUpdate(room);
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

  if (card === "noThatMove") {
    handleNoThatMove(room, player);
    return;
  }

  if (card === "temusanTimeStone") {
    handleTemusanTimeStone(room, player);
    return;
  }

  if (card === "quickDuel") {
    handleQuickDuelStart(room, player);
    return;
  }

  if (card !== "equality" && card !== "reactionary" && card !== "spaceTravel" && card !== "queenRule") {
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

  if (card === "queenRule") {
    room.queenRule[player.color] = true;
    room.usedCards[player.color] = true;
  }

  broadcastUpdate(room);
}

function restoreRoomSnapshot(room, historyItem) {
  room.board = clone(historyItem.beforeBoard);
  room.turn = historyItem.beforeTurn;
  room.enPassant = clone(historyItem.beforeState.enPassant);
  room.moved = clone(historyItem.beforeState.moved);
  room.capturedBy = clone(historyItem.beforeState.capturedBy);
  room.doubleMove = clone(historyItem.beforeState.doubleMove);
  room.wildHorse = clone(historyItem.beforeState.wildHorse);
  room.kingReturn = clone(historyItem.beforeState.kingReturn);
  room.reactionary = clone(historyItem.beforeState.reactionary);
  room.spaceTravel = clone(historyItem.beforeState.spaceTravel);
  room.equalityUses = clone(historyItem.beforeState.equalityUses);
  room.bombLauncherUsed = clone(historyItem.beforeState.bombLauncherUsed);
  room.usedCards = clone(historyItem.beforeState.usedCards);
  room.queenRule = clone(historyItem.beforeState.queenRule);
  room.versatile = clone(historyItem.beforeState.versatile);
  room.extremeEfficiency = clone(historyItem.beforeState.extremeEfficiency);
  room.forbiddenMove = clone(historyItem.beforeState.forbiddenMove);
}

function handleNoThatMove(room, player) {
  if (room.cards[player.color] !== "noThatMove") {
    return;
  }

  if (room.noThatMoveUses[player.color] <= 0) {
    const p = getPlayer(room, player.color);
    if (p) {
      send(p.ws, {
        type: "error",
        message: "그 수 하지 마 사용 횟수가 없습니다."
      });
    }
    return;
  }

  const last = room.moveHistory[room.moveHistory.length - 1];

  if (!last) {
    const p = getPlayer(room, player.color);
    if (p) {
      send(p.ws, {
        type: "error",
        message: "무를 상대 수가 없습니다."
      });
    }
    return;
  }

  if (last.by === player.color) {
    const p = getPlayer(room, player.color);
    if (p) {
      send(p.ws, {
        type: "error",
        message: "상대가 마지막으로 둔 수만 막을 수 있습니다."
      });
    }
    return;
  }

  restoreRoomSnapshot(room, last);

  room.moveHistory.pop();
  room.noThatMoveUses[player.color]--;
  room.forbiddenMove[last.by] = {
    from: clone(last.from),
    to: clone(last.to)
  };

  if (room.noThatMoveUses[player.color] <= 0) {
    room.usedCards[player.color] = true;
  }

  broadcast(room, {
    type: "moveUndone",
    by: player.color,
    target: last.by,
    reason: "noThatMove",
    forbiddenMove: room.forbiddenMove[last.by]
  });

  broadcastUpdate(room);
}

function handleTemusanTimeStone(room, player) {
  if (room.cards[player.color] !== "temusanTimeStone") {
    return;
  }

  if (room.temusanTimeStoneUses[player.color] <= 0) {
    const p = getPlayer(room, player.color);
    if (p) {
      send(p.ws, {
        type: "error",
        message: "테무산 타임스톤 사용 횟수가 없습니다."
      });
    }
    return;
  }

  let index = -1;

  for (let i = room.moveHistory.length - 1; i >= 0; i--) {
    if (room.moveHistory[i].by === player.color) {
      index = i;
      break;
    }
  }

  if (index === -1) {
    const p = getPlayer(room, player.color);
    if (p) {
      send(p.ws, {
        type: "error",
        message: "무를 내 수가 없습니다."
      });
    }
    return;
  }

  const targetHistory = room.moveHistory[index];

  restoreRoomSnapshot(room, targetHistory);

  room.moveHistory = room.moveHistory.slice(0, index);

  room.temusanTimeStoneUses[player.color]--;

  if (room.temusanTimeStoneUses[player.color] <= 0) {
    room.usedCards[player.color] = true;
  }

  broadcast(room, {
    type: "moveUndone",
    by: player.color,
    target: player.color,
    reason: "temusanTimeStone"
  });

  broadcastUpdate(room);
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

  if (data.queenRuleActive !== undefined) {
    room.queenRule[player.color] = data.queenRuleActive;
  }

  if (data.versatileActive !== undefined) {
    room.versatile[player.color] = data.versatileActive;
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

  broadcastUpdate(room);
}

function handleResultChoice(ws, data) {
  const found = findRoomBySocket(ws);

  if (!found) {
    send(ws, {
      type: "error",
      message: "방을 찾을 수 없음"
    });
    return;
  }

  const { room, player } = found;
  const pending = room.pendingChoice;

  if (!pending) {
    send(ws, {
      type: "error",
      message: "처리할 선택지가 없습니다."
    });
    return;
  }

  if (pending.chooser !== player.color) {
    send(ws, {
      type: "error",
      message: "네가 선택할 차례가 아닙니다."
    });
    return;
  }

  const option = data.option;

  if (option !== "opponentWin" && option !== "opponentLose") {
    send(ws, {
      type: "error",
      message: "잘못된 선택지"
    });
    return;
  }

  const owner = pending.owner;
  const chooser = pending.chooser;
  const card = pending.card;

  let winner;

  if (card === "fiveAhead") {
    if (option === "opponentWin") {
      winner = owner;
    } else {
      winner = chooser;
    }
  } else {
    if (option === "opponentWin") {
      winner = chooser;
    } else {
      winner = owner;
    }
  }

  room.usedCards[owner] = true;
  room.pendingChoice = null;

  broadcast(room, {
    type: "gameover",
    winner,
    board: room.board,
    reason: card,
    selectedOption: option
  });
}

function handleQuickDuelStart(room, player) {
  if (room.cards[player.color] !== "quickDuel") {
    return;
  }

  if (room.usedCards[player.color]) {
    const p = getPlayer(room, player.color);
    if (p) {
      send(p.ws, {
        type: "error",
        message: "이미 사용한 능력입니다."
      });
    }
    return;
  }

  room.usedCards[player.color] = true;

  room.quickDuel = {
    starter: player.color,
    round: 1,
    score: {
      white: 0,
      black: 0
    },
    choices: {}
  };

  broadcast(room, {
    type: "quickDuelStart",
    starter: player.color,
    round: 1,
    score: room.quickDuel.score
  });
}

function duelWinner(a, b) {
  if (a === b) return null;

  if (a === "rock" && b === "scissors") return "a";
  if (a === "scissors" && b === "paper") return "a";
  if (a === "paper" && b === "rock") return "a";

  return "b";
}

function choiceKorean(choice) {
  if (choice === "rock") return "묵";
  if (choice === "scissors") return "찌";
  if (choice === "paper") return "빠";
  return "?";
}

function handleQuickDuelChoice(ws, data) {
  const found = findRoomBySocket(ws);

  if (!found) {
    send(ws, {
      type: "error",
      message: "방을 찾을 수 없음"
    });
    return;
  }

  const { room, player } = found;

  if (!room.quickDuel) {
    send(ws, {
      type: "error",
      message: "묵찌빠가 진행 중이 아닙니다."
    });
    return;
  }

  const choice = data.choice;

  if (!["rock", "scissors", "paper"].includes(choice)) {
    send(ws, {
      type: "error",
      message: "잘못된 묵찌빠 선택"
    });
    return;
  }

  room.quickDuel.choices[player.color] = choice;

  send(ws, {
    type: "quickDuelPicked",
    choice
  });

  const whiteChoice = room.quickDuel.choices.white;
  const blackChoice = room.quickDuel.choices.black;

  if (!whiteChoice || !blackChoice) {
    return;
  }

  const result = duelWinner(whiteChoice, blackChoice);

  let roundWinner = null;

  if (result === "a") roundWinner = "white";
  if (result === "b") roundWinner = "black";

  if (roundWinner) {
    room.quickDuel.score[roundWinner]++;
  }

  broadcast(room, {
    type: "quickDuelRound",
    round: room.quickDuel.round,
    whiteChoice,
    blackChoice,
    whiteText: choiceKorean(whiteChoice),
    blackText: choiceKorean(blackChoice),
    roundWinner,
    score: room.quickDuel.score
  });

  if (room.quickDuel.score.white >= 2 || room.quickDuel.score.black >= 2) {
    const winner = room.quickDuel.score.white >= 2 ? "white" : "black";

    room.quickDuel = null;

    broadcast(room, {
      type: "gameover",
      winner,
      board: room.board,
      reason: "quickDuel"
    });

    return;
  }

  room.quickDuel.round++;
  room.quickDuel.choices = {};

  broadcast(room, {
    type: "quickDuelNext",
    round: room.quickDuel.round,
    score: room.quickDuel.score
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
    board: room.board,
    reason: "resign"
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

      startRoomIfReady(room);
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

    if (data.type === "resultChoice") {
      handleResultChoice(ws, data);
      return;
    }

    if (data.type === "quickDuelChoice") {
      handleQuickDuelChoice(ws, data);
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
      board: room.board,
      reason: "disconnect"
    });

    delete rooms[roomId];
  });
});

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
