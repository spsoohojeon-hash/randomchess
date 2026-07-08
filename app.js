export const CARD_INFO = {
  fiveAhead: {
    name: "5수 앞",
    desc: "게임 시작 시 상대에게 상대 승리/상대 패배 선택지를 보여준다. 상대가 고른 결과의 반대로 승패가 결정된다."
  },

  bombLauncher: {
    name: "폭탄 발사대",
    desc: "게임당 1회. 처음으로 내 기물이 잡히거나 내가 기물을 잡을 때 자동 발동한다. 전투 칸 중심 3x3 범위의 기물을 제거한다. 킹은 폭발로 제거되지 않는다."
  },

  noThatMove: {
    name: "그 수 하지 마",
    desc: "게임당 2회. 상대가 마지막으로 둔 수를 무르고, 상대가 같은 수를 다시 두지 못하게 한다."
  },

  extremeEfficiency: {
    name: "극한의 효율",
    desc: "게임 시작 전 발동. 비숍, 룩, 나이트, 폰을 모두 제거하고 킹 1개와 퀸 3개만 남긴다. 기존 룩 자리에는 퀸이 배치된다."
  },

  quickDuel: {
    name: "속전속결",
    desc: "묵찌빠 3판 2선승제로 승부를 정한다."
  },

  queenRule: {
    name: "이 국가는 여왕이 통치한다",
    desc: "킹과 퀸의 역할이 바뀐다. 킹은 퀸처럼, 퀸은 킹처럼 움직인다. 퀸이 잡히면 패배한다."
  },

  temusanTimeStone: {
    name: "테무산 타임스톤",
    desc: "게임당 2회. 발동 조건 없이 내가 마지막으로 둔 수를 무른다."
  },

  versatile: {
    name: "다재다능",
    desc: "게임 시작부터 적용되는 패시브. 내 룩은 기존 룩 이동 대신 비숍, 나이트, 킹의 이동 방식을 합친 방식으로 움직인다."
  },

  conscienceTest: {
    name: "양심테스트",
    desc: "게임 시작 시 상대에게 상대 승리/상대 패배 선택지를 보여준다. 상대가 고른 결과 그대로 승패가 결정된다."
  },

  necro: {
    name: "네크로맨서",
    desc: "내가 잡은 상대 기물 중 하나를 선택하고, 내 킹 주변 빈칸에 내 기물로 부활시킨다. 게임당 1회."
  },

  wildHorse: {
    name: "존나 야생마",
    desc: "발동 후 내 나이트는 상하좌우로 1칸 간 뒤, 그 방향 대각선으로 2칸 움직인다. 다른 기물을 뛰어넘을 수 있다."
  },

  spaceTravel: {
    name: "우주여행",
    desc: "백은 a8/h8, 흑은 a1/h1에 도달한 내 기물을 원하는 칸으로 텔레포트한다. 상대 기물은 잡을 수 있지만 킹은 못 잡는다. 사용 횟수 제한 없음."
  },

  doubleMove: {
    name: "더블무브",
    desc: "사용한 턴에 2번 이동한다. 같은 말 2번 가능. 더블무브 중에는 킹을 잡을 수 없다."
  },

  equality: {
    name: "평등국가",
    desc: "사용한 턴에 평등국가 캐슬링만 할 수 있다. 같은 가로줄에서 내 기물 둘 사이에 빈칸 2칸이 있으면 서로 안쪽으로 캐슬링한다. 사용 횟수 제한 없음."
  },

  reactionary: {
    name: "반동분자",
    desc: "패시브. 내 킹이 잡혔을 때 조건을 만족하면 왕룩을 지정한다. 왕룩이 잡히면 패배하고, 상대가 왕룩을 공격 가능한 위치로 이동할 때마다 위협 1회 누적된다. 3회 누적 시 패배."
  },

  exorcism: {
    name: "퇴마(물리)",
    desc: "내 비숍 하나를 골라 전방 가로 3칸의 모든 기물을 제거한다. 킹도 제거 가능."
  },

  kingReturn: {
    name: "왕의 귀환",
    desc: "내 킹/폰 제외 기물을 제거하고 점수에 따라 내 킹 이동능력이 일정 턴 강화된다. 23점 이상이면 패배. 발동은 턴을 소모하지 않는다."
  }
};

export function createCardState() {
  return {
    activeMode: null,
    selectedSquares: [],

    necroUsed: false,
    necroCapturedPieces: [],
    necroSelectedPiece: null,

    wildHorse: false,

    spaceTravelEnabled: false,

    doubleMoveActive: false,
    doubleMoveLeft: 0,

    equalityActive: false,

    reactionaryActive: false,
    reactionaryRook: null,
    reactionaryChecks: 0,

    kingReturn: null,

    bombLauncherUsed: false,

    noThatMoveUses: 2,
    noThatMoveLastForbidden: null,

    temusanTimeStoneUses: 2,

    queenRuleActive: false,

    versatileActive: false,

    fiveAheadPending: false,
    conscienceTestPending: false
  };
}

export function getCardName(cardId) {
  return CARD_INFO[cardId]?.name || "알 수 없는 능력";
}

export function getCardDescription(cardId) {
  return CARD_INFO[cardId]?.desc || "";
}

export function isStartPassiveCard(cardId) {
  return (
    cardId === "extremeEfficiency" ||
    cardId === "versatile" ||
    cardId === "fiveAhead" ||
    cardId === "conscienceTest"
  );
}

export function isUnlimitedCard(cardId) {
  return (
    cardId === "equality" ||
    cardId === "reactionary" ||
    cardId === "spaceTravel" ||
    cardId === "versatile" ||
    cardId === "extremeEfficiency" ||
    cardId === "fiveAhead" ||
    cardId === "conscienceTest" ||
    cardId === "bombLauncher"
  );
}

export function useCard(cardId, state) {
  if (!cardId) {
    return {
      ok: false,
      message: "사용할 능력이 없습니다."
    };
  }

  if (cardId === "wildHorse") {
    if (state.wildHorse) {
      return {
        ok: false,
        message: "야생마는 이미 발동 중입니다."
      };
    }

    state.wildHorse = true;

    return {
      ok: true,
      message: "야생마 발동. 내 나이트의 이동 방식이 변경됩니다."
    };
  }

  if (cardId === "doubleMove") {
    if (state.doubleMoveActive || state.doubleMoveLeft > 0) {
      return {
        ok: false,
        message: "더블무브가 이미 발동 중입니다."
      };
    }

    state.doubleMoveActive = true;
    state.doubleMoveLeft = 2;

    return {
      ok: true,
      message: "더블무브 발동. 이번 턴에 2번 이동할 수 있습니다."
    };
  }

  if (cardId === "spaceTravel") {
    state.spaceTravelEnabled = true;

    return {
      ok: true,
      message: "우주여행 발동. 상대 진영 코너에 도착한 내 기물을 텔레포트할 수 있습니다."
    };
  }

  if (cardId === "equality") {
    state.activeMode = "equalityPickA";
    state.selectedSquares = [];

    return {
      ok: true,
      message: "평등국가 발동. 캐슬링할 첫 번째 내 기물을 선택하세요."
    };
  }

  if (cardId === "reactionary") {
    return {
      ok: false,
      message: "반동분자는 패시브 능력입니다."
    };
  }

  if (cardId === "necro") {
    if (state.necroUsed) {
      return {
        ok: false,
        message: "네크로맨서는 이미 사용했습니다."
      };
    }

    state.activeMode = "necroPick";

    return {
      ok: true,
      message: "부활시킬 기물을 선택하세요."
    };
  }

  if (cardId === "exorcism") {
    state.activeMode = "exorcism";

    return {
      ok: true,
      message: "퇴마를 사용할 비숍을 선택하세요."
    };
  }

  if (cardId === "kingReturn") {
    return {
      ok: true,
      message: "왕의 귀환 발동."
    };
  }

  if (cardId === "noThatMove") {
    return {
      ok: true,
      message: "그 수 하지 마를 사용합니다."
    };
  }

  if (cardId === "temusanTimeStone") {
    return {
      ok: true,
      message: "테무산 타임스톤을 사용합니다."
    };
  }

  if (cardId === "quickDuel") {
    return {
      ok: true,
      message: "속전속결 발동. 묵찌빠 승부를 시작합니다."
    };
  }

  if (cardId === "queenRule") {
    state.queenRuleActive = true;

    return {
      ok: true,
      message: "이 국가는 여왕이 통치한다 발동. 킹과 퀸의 역할이 바뀝니다."
    };
  }

  if (cardId === "bombLauncher") {
    return {
      ok: false,
      message: "폭탄 발사대는 첫 전투 시 자동 발동하는 패시브입니다."
    };
  }

  if (cardId === "versatile") {
    state.versatileActive = true;

    return {
      ok: false,
      message: "다재다능은 게임 시작부터 적용되는 패시브입니다."
    };
  }

  if (cardId === "extremeEfficiency") {
    return {
      ok: false,
      message: "극한의 효율은 게임 시작 전 자동 적용되는 패시브입니다."
    };
  }

  if (cardId === "fiveAhead") {
    return {
      ok: false,
      message: "5수 앞은 게임 시작 시 자동 발동되는 능력입니다."
    };
  }

  if (cardId === "conscienceTest") {
    return {
      ok: false,
      message: "양심테스트는 게임 시작 시 자동 발동되는 능력입니다."
    };
  }

  return {
    ok: false,
    message: "아직 구현되지 않은 능력입니다."
  };
}

export function getWildHorseMoves(r, c, board, color) {
  const result = [];

  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];

  for (const [dr, dc] of dirs) {
    const baseR = r + dr;
    const baseC = c + dc;

    const options = [];

    if (dr !== 0) {
      options.push([baseR + dr, baseC - 2]);
      options.push([baseR + dr, baseC + 2]);
    } else {
      options.push([baseR - 2, baseC + dc]);
      options.push([baseR + 2, baseC + dc]);
    }

    for (const [nr, nc] of options) {
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;

      const target = board[nr][nc];

      if (!target || target[0] !== color) {
        result.push({
          r: nr,
          c: nc,
          type: "wildHorse"
        });
      }
    }
  }

  return result;
}

export function getVersatileRookMoves(r, c, board, color) {
  const result = [];

  const add = (nr, nc, type = "versatile") => {
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return;

    const target = board[nr][nc];

    if (!target || target[0] !== color) {
      result.push({
        r: nr,
        c: nc,
        type
      });
    }
  };

  // 킹 이동
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      add(r + dr, c + dc, "versatileKing");
    }
  }

  // 나이트 이동
  [
    [2, 1],
    [1, 2],
    [-1, 2],
    [-2, 1],
    [-2, -1],
    [-1, -2],
    [1, -2],
    [2, -1]
  ].forEach(([dr, dc]) => {
    add(r + dr, c + dc, "versatileKnight");
  });

  // 비숍 이동
  const bishopDirs = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ];

  for (const [dr, dc] of bishopDirs) {
    let nr = r + dr;
    let nc = c + dc;

    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const target = board[nr][nc];

      if (!target) {
        result.push({
          r: nr,
          c: nc,
          type: "versatileBishop"
        });
      } else {
        if (target[0] !== color) {
          result.push({
            r: nr,
            c: nc,
            type: "versatileBishop"
          });
        }
        break;
      }

      nr += dr;
      nc += dc;
    }
  }

  return result;
}
