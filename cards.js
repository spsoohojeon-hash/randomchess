export const CARD_INFO = {
  necro: {
    name: "네크로맨서",
    desc: "내가 잡은 상대 기물 중 하나를 선택하고, 내 킹 주변 빈칸에 내 기물로 부활시킨다. 게임당 1회."
  },
  wildHorse: {
    name: "존나 야생마",
    desc: "발동 후 내 나이트는 장기 상처럼 움직인다. 중간 길이 막히면 이동할 수 없다."
  },
  spaceTravel: {
    name: "우주여행",
    desc: "백은 a8/h8, 흑은 a1/h1 도달 시 다음 턴부터 1회 텔레포트 가능. 킹은 텔레포트할 수 없다."
  },
  doubleMove: {
    name: "더블무브",
    desc: "사용한 턴에 2번 이동한다. 같은 말 2번 가능. 더블무브 중에는 킹을 잡을 수 없다."
  },
  equality: {
    name: "평등국가",
    desc: "패시브. 내 홈 랭크의 모든 기물이 룩과 캐슬링할 수 있다."
  },
  reactionary: {
    name: "반동분자",
    desc: "캐슬링을 둘 다 하지 않았다면 내 룩 하나를 왕룩으로 지정한다. 왕룩이 잡히면 패배하고, 상대가 왕룩을 공격 가능한 위치로 이동할 때마다 위협 1회 누적된다. 3회 누적 시 패배."
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
    return { ok: true, message: "존나 야생마 발동! 내 나이트가 장기 상처럼 움직입니다." };
  }

  if (cardId === "doubleMove") {
    state.doubleMoveLeft = 2;
    return { ok: true, message: "더블무브 발동! 이번 턴에 2번 이동합니다." };
  }

  if (cardId === "spaceTravel") {
    state.spaceTravelEnabled = true;
    return { ok: true, message: "우주여행 활성화! 조건을 만족한 기물이 있으면 텔레포트할 수 있습니다." };
  }

  if (cardId === "equality") {
    return {
      ok: false,
      message: "평등국가는 패시브 능력이라 직접 사용할 필요가 없습니다."
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

  if (cardId === "reactionary") {
    state.activeMode = "reactionaryPick";
    state.reactionaryOptions = [];
    return { ok: true, message: "반동분자: 왕룩으로 지정할 룩을 선택하세요." };
  }

  return { ok: false, message: "알 수 없는 카드입니다." };
}

export function getWildHorseMoves(r, c, board, color) {
  const result = [];

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

  for (const move of moves) {
    const nr = r + move.dr;
    const nc = c + move.dc;

    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;

    let blocked = false;

    for (const [br, bc] of move.blocks) {
      const blockR = r + br;
      const blockC = c + bc;

      if (board[blockR]?.[blockC]) {
        blocked = true;
        break;
      }
    }

    if (blocked) continue;

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
