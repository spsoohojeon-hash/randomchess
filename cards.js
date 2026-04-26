export const CARD_NAMES = {
  necro: "네크로맨서",
  wildHorse: "존나 야생마",
  spaceTravel: "우주여행",
  doubleMove: "더블무브",
  equality: "평등국가",
  reactionary: "반동분자",
  exorcism: "퇴마(물리)",
  kingReturn: "왕의 귀환"
};

export function createCardState() {
  return {
    activeMode: null,
    selectedSquares: [],
    wildHorse: false,
    doubleMoveLeft: 0,
    necroUsed: false,
    necroWaiting: false,
    necroCapturedPiece: null,
    spaceTravelEnabled: false,
    teleportPieces: [],
    kingReturn: null,
    reactionaryActive: false,
    reactionaryChecks: 0
  };
}

export function getCardName(cardId) {
  return CARD_NAMES[cardId] || "알 수 없는 카드";
}

export function useCard(cardId, state) {
  if (!cardId) return { ok: false, message: "카드가 없습니다." };

  if (cardId === "wildHorse") {
    state.wildHorse = true;
    return { ok: true, message: "존나 야생마 발동: 나이트가 대각선 2칸 점프합니다." };
  }

  if (cardId === "doubleMove") {
    state.doubleMoveLeft = 2;
    return { ok: true, message: "더블무브 발동: 이번 턴에 2번 이동합니다." };
  }

  if (cardId === "exorcism") {
    state.activeMode = "exorcism";
    state.selectedSquares = [];
    return { ok: true, message: "퇴마(물리): 사용할 내 기물을 선택하세요." };
  }

  if (cardId === "equality") {
    state.activeMode = "equality";
    state.selectedSquares = [];
    return { ok: true, message: "평등국가: 바꿀 내 기물 2개를 선택하세요." };
  }

  if (cardId === "necro") {
    if (state.necroUsed) return { ok: false, message: "네크로맨서는 이미 사용했습니다." };
    state.necroWaiting = true;
    return { ok: true, message: "네크로맨서 대기: 다음에 잡은 적 기물을 부활시킵니다." };
  }

  if (cardId === "spaceTravel") {
    state.spaceTravelEnabled = true;
    return { ok: true, message: "우주여행 활성화: 상대 진영 코너 도달 시 다음 턴 텔레포트 가능." };
  }

  if (cardId === "kingReturn") {
    state.activeMode = "kingReturn";
    return { ok: true, message: "왕의 귀환 발동 준비." };
  }

  if (cardId === "reactionary") {
    return { ok: true, message: "반동분자는 킹이 잡힐 때 자동 발동합니다." };
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
      result.push({ r: nr, c: nc, type: "normal" });
    }
  }

  return result;
}
