export const CARD_INFO = {
  necro: {
    name: "네크로맨서",
    desc: "내가 잡은 상대 기물 중 하나를 내 킹 주변 빈칸에 내 기물로 부활시킨다. 게임당 1회."
  },
  wildHorse: {
    name: "존나 야생마",
    desc: "발동 후 내 나이트는 계속 대각선 2칸 점프 이동을 한다."
  },
  spaceTravel: {
    name: "우주여행",
    desc: "백은 a8/h8, 흑은 a1/h1 도달 시 다음 턴에 1회 텔레포트 가능. 킹은 못 잡는다."
  },
  doubleMove: {
    name: "더블무브",
    desc: "이번 턴에 2번 이동한다. 같은 말 2번 가능. 킹은 못 잡는다."
  },
  equality: {
    name: "평등국가",
    desc: "같은 가로줄에서 2칸 떨어진 내 기물 2개를 서로 교환한다."
  },
  reactionary: {
    name: "반동분자",
    desc: "캐슬링 안 한 내 룩 하나를 왕룩으로 지정한다. 왕룩이 잡히면 패배하고, 상대가 왕룩을 공격 가능한 위치로 이동할 때마다 위협 1회 누적된다. 3회 누적 시 패배."
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
    return { ok: true, message: "존나 야생마 발동!" };
  }

  if (cardId === "doubleMove") {
    state.doubleMoveLeft = 2;
    return { ok: true, message: "더블무브 발동!" };
  }

  if (cardId === "exorcism") {
    state.activeMode = "exorcism";
    state.selectedSquares = [];
    return { ok: true, message: "퇴마(물리): 사용할 비숍을 선택하세요." };
  }

  if (cardId === "equality") {
    state.activeMode = "equality";
    state.selectedSquares = [];
    return { ok: true, message: "평등국가: 바꿀 내 기물 2개를 선택하세요." };
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

  if (cardId === "spaceTravel") {
    state.spaceTravelEnabled = true;
    return { ok: true, message: "우주여행 활성화!" };
  }

  if (cardId === "kingReturn") {
    state.activeMode = "kingReturn";
    return { ok: true, message: "왕의 귀환 발동!" };
  }

  if (cardId === "reactionary") {
    state.activeMode = "reactionaryPick";
    state.reactionaryOptions = [];
    return { ok: true, message: "반동분자: 왕룩으로 지정할 캐슬링 안 한 룩을 선택하세요." };
  }

  return { ok: false, message: "알 수 없는 카드입니다." };
}

export function getWildHorseMoves(r, c, board, color) {
  const result = [];
  const dirs = [
    [2, 2],
    [2, -2],
    [-2, 2],
    [-2, -2]
  ];

  for (const [dr, dc] of dirs) {
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
