export const CARD_INFO = {
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
    desc: "패시브. 게임 시작 시 자동으로 왕룩을 지정한다. 왕룩이 잡히면 패배하고, 상대가 왕룩을 공격 가능한 위치로 이동할 때마다 위협 1회 누적된다. 3회 누적 시 패배."
  },
  exorcism: {
    name: "퇴마(물리)",
    desc: "내 비숍 하나를 골라 전방 가로 3칸의 모든 기물을 제거한다. 킹도 제거 가능."
  },
  kingReturn: {
    name: "왕의 귀환",
    desc: "내 킹/폰 제외 기물을 제거하고 점수에 따라 내 킹 이동능력이 일정 턴 강화된다. 23점 이상이면 패배."
  }
};

export function createCardState() {
  return {
    activeMode: null,
    selectedSquares: [],

    wildHorse: false,
    doubleMoveLeft: 0,
    doubleMoveActive: false,

    necroUsed: false,
    necroCapturedPieces: [],
    necroSelectedPiece: null,

    spaceTravelEnabled: false,
    teleportPieces: [],

    kingReturn: null,

    reactionaryActive: false,
    reactionaryRook: null,
    reactionaryChecks: 0,
    reactionaryOptions: []
  };
}

export function getCardName(cardId) {
  return CARD_INFO[cardId]?.name || "알 수 없는 카드";
}

export function getCardDescription(cardId) {
  return CARD_INFO[cardId]?.desc || "";
}

export function useCard(cardId, state) {
  if (!cardId) return { ok: false, message: "카드가 없습니다." };

  if (cardId === "wildHorse") {
    state.wildHorse = true;
    return { ok: true, message: "존나 야생마 발동! 내 나이트가 상처럼 움직이고 기물을 뛰어넘습니다." };
  }

  if (cardId === "doubleMove") {
    state.doubleMoveLeft = 2;
    state.doubleMoveActive = true;
    return { ok: true, message: "더블무브 발동! 이번 턴에 2번 이동합니다." };
  }

  if (cardId === "spaceTravel") {
    state.spaceTravelEnabled = true;
    return { ok: true, message: "우주여행 활성화! 조건을 만족한 기물이 있으면 텔레포트할 수 있습니다." };
  }

  if (cardId === "equality") {
    state.activeMode = "equalityPickA";
    state.selectedSquares = [];
    return {
      ok: true,
      message: "평등국가 발동! 캐슬링할 첫 번째 내 기물을 선택하세요."
    };
  }

  if (cardId === "reactionary") {
    return {
      ok: false,
      message: "반동분자는 패시브 능력이라 자동으로 발동됩니다."
    };
  }

  if (cardId === "exorcism") {
    state.activeMode = "exorcism";
    state.selectedSquares = [];
    return { ok: true, message: "퇴마(물리): 사용할 비숍을 선택하세요." };
  }

  if (cardId === "necro") {
    if (state.necroUsed) {
      return { ok: false, message: "네크로맨서는 이미 사용했습니다." };
    }

    if (state.necroCapturedPieces.length === 0) {
      return { ok: false, message: "아직 부활시킬 잡은 기물이 없습니다." };
    }

    state.activeMode = "necroPick";
    return { ok: true, message: "네크로맨서: 부활시킬 기물을 선택하세요." };
  }

  if (cardId === "kingReturn") {
    state.activeMode = "kingReturn";
    return { ok: true, message: "왕의 귀환 발동!" };
  }

  return { ok: false, message: "알 수 없는 카드입니다." };
}

export function getWildHorseMoves(r, c, board, color) {
  const result = [];

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

  for (const [dr, dc] of moves) {
    const nr = r + dr;
    const nc = c + dc;

    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;

    const target = board[nr][nc];

    if (!target || target[0] !== color) {
      result.push({
        r: nr,
        c: nc,
        type: "normal"
      });
    }
  }

  return result;
}
