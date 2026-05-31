import {
  createCardState,
  useCard,
  getWildHorseMoves,
  getCardName,
  getCardDescription
} from "./cards.js";

import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

window.onerror = function(msg, src, line, col, err) {
  alert("에러: " + msg + "\nline: " + line);
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

const Game = (() => {
  const SERVER = "wss://randomchess.onrender.com";

  let ws = null;

  let board = [];
  let turn = "white";
  let selected = null;
  let moves = [];
  let localMode = true;
  let myColor = null;
  let roomCode = null;
  let enPassant = null;

  let touchFrom = null;
  let ghost = null;
  let promotionResolve = null;

  let myCard = null;
  let cardState = createCardState();
  let pendingCardUse = null;

  let currentUser = null;
  let unsubscribeFriends = null;
  let unsubscribeRequests = null;

  let roomList = [];
  let pendingJoinRoomId = null;

  let moved = {
    wk: false,
    wrA: false,
    wrH: false,
    bk: false,
    brA: false,
    brH: false
  };

  let equalityUses = {
    white: 0,
    black: 0
  };

  const imgs = {
    wp: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wp.png",
    wr: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wr.png",
    wn: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wn.png",
    wb: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wb.png",
    wq: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wq.png",
    wk: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wk.png",
    bp: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bp.png",
    br: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/br.png",
    bn: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bn.png",
    bb: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bb.png",
    bq: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bq.png",
    bk: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bk.png"
  };

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

  function safeId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function squareName(r, c) {
    return `${String.fromCharCode(97 + c)}${8 - r}`;
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setLoginState(text) {
    const el = document.getElementById("loginState");
    if (el) el.textContent = text;
  }

  function renderAccount() {
    if (currentUser) {
      setLoginState(`${currentUser.name} 로그인됨`);
      const nick = document.getElementById("nickInput");
      if (nick) nick.value = currentUser.name;
    } else {
      setLoginState("로그인 안 됨");
    }
  }

  async function saveUserProfile() {
    if (!currentUser) return;

    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        uid: currentUser.uid,
        name: currentUser.name,
        nickname: currentUser.name,
        email: currentUser.email || "",
        photoURL: currentUser.photoURL || "",
        provider: currentUser.provider,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.log("프로필 저장 실패:", err);
    }
  }

  async function applyGoogleUser(user) {
    currentUser = {
      uid: user.uid,
      name: user.displayName || user.email || "Google User",
      email: user.email || "",
      photoURL: user.photoURL || "",
      provider: "google"
    };

    await saveUserProfile();
    startFriendListeners();
    renderAccount();
  }

  async function loginGoogle() {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      alert("구글 로그인 시작 실패: " + err.code + "\n" + err.message);
    }
  }

  async function loginNickname() {
    const nickInput = document.getElementById("nickInput");
    const passInput = document.getElementById("passInput");

    const name = nickInput?.value?.trim();
    const pass = passInput?.value || "";

    if (!name) {
      alert("닉네임을 입력해라.");
      return;
    }

    if (!pass) {
      alert("비밀번호를 입력해라.");
      return;
    }

    const key = name.toLowerCase();
    const passHash = await sha256(pass);
    const localKey = "randomChessNickAccount_" + key;

    let uid = null;

    try {
      const accountRef = doc(db, "nicknameAccounts", key);
      const snap = await getDoc(accountRef);

      if (snap.exists()) {
        const account = snap.data();

        if (account.passHash !== passHash) {
          alert("비밀번호가 틀림");
          return;
        }

        uid = account.uid;
      } else {
        uid = "nick-" + safeId();

        await setDoc(accountRef, {
          uid,
          nickname: name,
          passHash,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      const saved = localStorage.getItem(localKey);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (parsed.passHash !== passHash) {
          alert("비밀번호가 틀림");
          return;
        }

        uid = parsed.uid;
      } else {
        uid = "nick-" + safeId();

        localStorage.setItem(localKey, JSON.stringify({
          uid,
          passHash
        }));
      }
    }

    localStorage.setItem("randomChessGuestUid", uid);
    localStorage.setItem("randomChessGuestName", name);

    currentUser = {
      uid,
      name,
      email: "",
      photoURL: "",
      provider: "nickname"
    };

    await saveUserProfile();
    startFriendListeners();
    renderAccount();

    alert(name + " 로그인됨");
  }

  async function logout() {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }

      currentUser = null;
      stopFriendListeners();
      renderAccount();
      renderFriends([]);
      alert("로그아웃됨");
    } catch (err) {
      alert("로그아웃 실패: " + err.code + "\n" + err.message);
    }
  }

  onAuthStateChanged(auth, async user => {
  console.log("AUTH STATE:", user);

  if (user) {
    await applyGoogleUser(user);
    setLoginState((user.displayName || user.email || "Google User") + " 로그인됨");
    return;
  }

  if (currentUser?.provider === "google") {
    currentUser = null;
    stopFriendListeners();
  }

  renderAccount();
});

  function stopFriendListeners() {
    if (unsubscribeFriends) unsubscribeFriends();
    if (unsubscribeRequests) unsubscribeRequests();
    unsubscribeFriends = null;
    unsubscribeRequests = null;
  }

  function startFriendListeners() {
    stopFriendListeners();

    if (!currentUser) return;

    try {
      const friendsRef = collection(db, "users", currentUser.uid, "friends");

      unsubscribeFriends = onSnapshot(friendsRef, snap => {
        const friends = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFriends(friends);
      }, err => {
        console.log("친구 구독 실패:", err);
      });

      const requestsRef = collection(db, "users", currentUser.uid, "friendRequests");

      unsubscribeRequests = onSnapshot(requestsRef, snap => {
        const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFriendRequests(requests);
      }, err => {
        console.log("친구 요청 구독 실패:", err);
      });
    } catch (err) {
      console.log("친구 리스너 실패:", err);
    }
  }

  function renderFriends(friends = []) {
    const list = document.getElementById("friendList");
    if (!list) return;

    const requestsHtml = window.__friendRequestsHtml || "";

    if (friends.length === 0) {
      list.innerHTML = requestsHtml + `<div class="friendItem"><div class="friendMeta">친구 없음</div></div>`;
      return;
    }

    const html = friends.map(fr => `
      <div class="friendItem">
        <div class="friendTitle">${escapeHtml(fr.name || fr.nickname || "친구")}</div>
        <div class="friendMeta">UID: ${escapeHtml(fr.uid || fr.id)}</div>
        <div class="friendBtns">
          <button onclick="Game.inviteFriend('${escapeHtml(fr.uid || fr.id)}')">초대</button>
        </div>
      </div>
    `).join("");

    list.innerHTML = requestsHtml + html;
  }

  function renderFriendRequests(requests = []) {
    if (requests.length === 0) {
      window.__friendRequestsHtml = "";
      return;
    }

    window.__friendRequestsHtml = requests.map(req => `
      <div class="friendItem">
        <div class="friendTitle">친구 요청: ${escapeHtml(req.fromName || "알 수 없음")}</div>
        <div class="friendMeta">UID: ${escapeHtml(req.fromUid || "")}</div>
        <div class="friendBtns">
          <button onclick="Game.acceptFriend('${escapeHtml(req.id)}')">수락</button>
          <button onclick="Game.rejectFriend('${escapeHtml(req.id)}')">거절</button>
        </div>
      </div>
    `).join("");

    refreshFriends();
  }

  async function refreshFriends() {
    if (!currentUser) {
      renderFriends([]);
      return;
    }

    try {
      const snap = await getDocs(collection(db, "users", currentUser.uid, "friends"));
      const friends = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFriends(friends);
    } catch (err) {
      alert("친구 목록 불러오기 실패: " + err.message);
    }
  }

  async function addFriend() {
    if (!currentUser) {
      alert("먼저 로그인해라.");
      return;
    }

    const value = document.getElementById("friendInput")?.value?.trim();

    if (!value) {
      alert("친구 닉네임 또는 UID를 입력해라.");
      return;
    }

    try {
      let found = null;

      const direct = await getDoc(doc(db, "users", value));

      if (direct.exists()) {
        found = direct.data();
      }

      if (!found) {
        const usersRef = collection(db, "users");
        const q1 = query(usersRef, where("nickname", "==", value));
        const q2 = query(usersRef, where("email", "==", value));

        const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);

        found = [...s1.docs, ...s2.docs]
          .map(d => d.data())
          .find(u => u.uid !== currentUser.uid);
      }

      if (!found) {
        alert("해당 유저를 못 찾음. 상대가 먼저 로그인해야 검색됨.");
        return;
      }

      if (found.uid === currentUser.uid) {
        alert("자기 자신은 친구 추가 불가");
        return;
      }

      await addDoc(collection(db, "users", found.uid, "friendRequests"), {
        fromUid: currentUser.uid,
        fromName: currentUser.name,
        fromEmail: currentUser.email || "",
        createdAt: serverTimestamp()
      });

      alert("친구 요청 보냄");
    } catch (err) {
      alert("친구 추가 실패: " + err.message);
    }
  }

  async function acceptFriend(requestId) {
    if (!currentUser) return;

    try {
      const reqRef = doc(db, "users", currentUser.uid, "friendRequests", requestId);
      const snap = await getDoc(reqRef);

      if (!snap.exists()) {
        alert("요청이 없음");
        return;
      }

      const req = snap.data();

      await setDoc(doc(db, "users", currentUser.uid, "friends", req.fromUid), {
        uid: req.fromUid,
        name: req.fromName || "친구",
        email: req.fromEmail || "",
        createdAt: serverTimestamp()
      });

      await setDoc(doc(db, "users", req.fromUid, "friends", currentUser.uid), {
        uid: currentUser.uid,
        name: currentUser.name,
        email: currentUser.email || "",
        createdAt: serverTimestamp()
      });

      await deleteDoc(reqRef);
      alert("친구 추가됨");
      refreshFriends();
    } catch (err) {
      alert("친구 수락 실패: " + err.message);
    }
  }

  async function rejectFriend(requestId) {
    if (!currentUser) return;

    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "friendRequests", requestId));
      refreshFriends();
    } catch (err) {
      alert("친구 거절 실패: " + err.message);
    }
  }

  function inviteFriend(friendUid) {
    copyInvite();
  }

  async function copyInvite() {
    if (!roomCode) {
      alert("먼저 방을 만들거나 들어가라.");
      return;
    }

    const url = location.origin + "/?room=" + encodeURIComponent(roomCode);

    try {
      await navigator.clipboard.writeText(url);
      alert("초대 링크 복사됨:\n" + url);
    } catch {
      prompt("초대 링크", url);
    }
  }

  function connectSocket(onOpen) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      onOpen?.();
      return;
    }

    if (ws) {
      try {
        ws.close();
      } catch {}
    }

    ws = new WebSocket(SERVER);

    ws.onopen = () => {
      onOpen?.();
    };

    ws.onerror = () => {
      alert("서버 연결 에러");
    };

    ws.onclose = () => {
      console.log("서버 연결 끊김");
    };

    ws.onmessage = e => {
      const data = JSON.parse(e.data);
      handleServerMessage(data);
    };
  }

  function handleServerMessage(data) {
    if (data.type === "rooms" || data.type === "roomList") {
      roomList = data.rooms || [];
      renderRoomList();
      return;
    }

    if (data.type === "roomCreated") {
      roomCode = data.roomId || data.roomCode || data.id || roomCode;
      return;
    }

    if (data.type === "waiting") {
      showGame();
      status(data.message || "상대 기다리는 중...");
      const boardDiv = document.getElementById("board");
      if (boardDiv) boardDiv.innerHTML = "";
      return;
    }

    if (data.type === "start") {
      myCard = data.card;
      myColor = data.color;
      board = data.board;
      turn = data.turn;
      enPassant = data.enPassant || null;
      moved = data.moved || moved;

      if (data.capturedPieces) {
        cardState.necroCapturedPieces = data.capturedPieces;
      }

      if (data.spaceTravelEnabled !== undefined) {
        cardState.spaceTravelEnabled = data.spaceTravelEnabled;
      }

      if (data.equalityUses) {
        equalityUses = data.equalityUses;
      }

      showGame();
      renderCard();
      render();
      return;
    }

    if (data.type === "update") {
      board = data.board;
      turn = data.turn;
      enPassant = data.enPassant || null;
      moved = data.moved || moved;

      if (data.doubleMove && myColor) {
        cardState.doubleMoveLeft = data.doubleMove[myColor];
        cardState.doubleMoveActive = cardState.doubleMoveLeft > 0;
      }

      if (data.wildHorse && myColor) {
        cardState.wildHorse = data.wildHorse[myColor];
      }

      if (data.kingReturn && myColor) {
        cardState.kingReturn = data.kingReturn[myColor] || null;
      }

      if (data.reactionary && myColor) {
        const mine = data.reactionary[myColor];

        if (mine) {
          cardState.reactionaryActive = mine.active;
          cardState.reactionaryRook = mine.rook;
          cardState.reactionaryChecks = mine.checks;
        }
      }

      if (data.capturedBy && myColor) {
        cardState.necroCapturedPieces = data.capturedBy[myColor] || [];
      }

      if (data.spaceTravel && myColor) {
        cardState.spaceTravelEnabled = !!data.spaceTravel[myColor];
      }

      if (data.equalityUses) {
        equalityUses = data.equalityUses;
      }

      if (
        data.usedCards &&
        myColor &&
        data.usedCards[myColor] &&
        myCard !== "equality" &&
        myCard !== "reactionary" &&
        myCard !== "spaceTravel"
      ) {
        myCard = null;
      }

      selected = null;
      moves = [];
      removeGhost();

      renderCard();
      render();
      return;
    }

    if (data.type === "reactionaryRequest") {
      if (data.color) turn = data.color;

      cardState.activeMode = "reactionaryPick";
      selected = null;
      moves = data.options || [];

      alert(data.message || "킹이 잡혔습니다. 반동분자로 왕룩을 선택하세요.");

      renderCard();
      render();
      return;
    }

    if (data.type === "gameover") {
      board = data.board || board;
      removeGhost();
      render();
      alert("게임 끝! 승자: " + data.winner);
      return;
    }

    if (data.type === "full") {
      alert("방이 가득 참");
      return;
    }

    if (data.type === "wrongPassword") {
      alert("비밀번호가 틀림");
      return;
    }

    if (data.type === "error") {
      alert(data.message || "서버 오류");
    }
  }

  function createOnlineRoom() {
    const name = document.getElementById("roomNameInput")?.value?.trim() || "무제 방";
    const rawPassword = document.getElementById("roomPasswordInput")?.value || "";
    const isPrivate = document.getElementById("privateRoomInput")?.checked;
    const password = isPrivate ? rawPassword : "";
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();

    if (isPrivate && !password) {
      alert("비공개 방은 비밀번호를 입력해라.");
      return;
    }

    localMode = false;
    roomCode = id;

    connectSocket(() => {
      ws.send(JSON.stringify({
        type: "createRoom",
        roomId: id,
        roomName: name,
        password,
        user: currentUser
      }));
    });
  }

  function refreshRooms() {
    connectSocket(() => {
      ws.send(JSON.stringify({
        type: "listRooms"
      }));
    });
  }

  function renderRoomList() {
    const list = document.getElementById("roomList");
    if (!list) return;

    if (roomList.length === 0) {
      list.innerHTML = `<div class="roomItem"><div class="roomMeta">열린 방 없음</div></div>`;
      return;
    }

    list.innerHTML = roomList.map(room => {
      const id = room.id || room.roomId;
      const title = room.name || room.roomName || id;
      const locked = !!(room.hasPassword || room.locked);

      return `
        <div class="roomItem">
          <div class="roomTitle">${escapeHtml(title)}</div>
          <div class="roomMeta">
            방 코드: ${escapeHtml(id)}<br>
            ${locked ? "🔒 비공개방" : "공개방"} / ${room.players || 0}/${room.maxPlayers || 2}
          </div>
          <div class="roomBtns">
            <button onclick="Game.openJoinRoom('${escapeHtml(id)}', ${locked ? "true" : "false"})">입장</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function openJoinRoom(id, locked) {
    pendingJoinRoomId = id;

    const modal = document.getElementById("joinModal");
    const input = document.getElementById("joinPasswordInput");
    const title = document.getElementById("joinTitle");

    if (title) title.textContent = locked ? "비공개 방 입장" : "방 입장";

    if (input) {
      input.value = "";
      input.classList.toggle("hidden", !locked);
    }

    if (modal) {
      modal.classList.remove("hidden");
    } else {
      joinOnlineById(id, "");
    }
  }

  function closeJoinModal() {
    pendingJoinRoomId = null;
    document.getElementById("joinModal")?.classList.add("hidden");
  }

  function confirmJoinRoom() {
    if (!pendingJoinRoomId) {
      closeJoinModal();
      return;
    }

    const password = document.getElementById("joinPasswordInput")?.value || "";
    const id = pendingJoinRoomId;
    closeJoinModal();
    joinOnlineById(id, password);
  }

  function joinOnlineById(id, password = "") {
    localMode = false;
    roomCode = id;

    connectSocket(() => {
      ws.send(JSON.stringify({
        type: "joinRoom",
        roomId: id,
        password,
        user: currentUser
      }));
    });
  }

  function closeAllCardModals() {
    document.getElementById("necroModal")?.classList.add("hidden");
    document.getElementById("exorcismModal")?.classList.add("hidden");
    document.getElementById("reactionaryModal")?.classList.add("hidden");
    document.getElementById("spaceModal")?.classList.add("hidden");
  }

  function cancelCardSelection() {
    closeAllCardModals();

    pendingCardUse = null;
    cardState.activeMode = null;
    cardState.selectedSquares = [];

    selected = null;
    moves = [];

    renderCard();
    render();
  }

  function resetState() {
    board = createBoard();
    turn = "white";
    selected = null;
    moves = [];
    enPassant = null;

    moved = {
      wk: false,
      wrA: false,
      wrH: false,
      bk: false,
      brA: false,
      brH: false
    };

    cardState = createCardState();
    pendingCardUse = null;

    equalityUses = {
      white: 0,
      black: 0
    };

    closeAllCardModals();
  }

  function syncCardUpdate(equalityUsed = false) {
    if (!localMode && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "cardUpdate",
        board,
        turn,
        enPassant,
        moved,
        necroCapturedPieces: cardState.necroCapturedPieces,
        kingReturn: cardState.kingReturn,
        reactionary: {
          active: cardState.reactionaryActive,
          rook: cardState.reactionaryRook,
          checks: cardState.reactionaryChecks
        },
        spaceTravelEnabled: cardState.spaceTravelEnabled,
        equalityUsed
      }));
    }
  }

  function consumeCurrentCard() {
    const usedCard = pendingCardUse || myCard;
    if (!usedCard) return;

    if (!localMode && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "card",
        card: usedCard
      }));
    }

    if (usedCard === myCard) {
      myCard = null;
    }

    pendingCardUse = null;
    renderCard();
  }

  function showGame() {
    document.getElementById("menu")?.classList.add("hidden");
    document.getElementById("game")?.classList.remove("hidden");
  }

  function backMenu() {
    removeGhost();
    closeAllCardModals();
    document.getElementById("game")?.classList.add("hidden");
    document.getElementById("menu")?.classList.remove("hidden");
    renderAccount();
  }

  function status(text) {
    const el = document.getElementById("status");
    if (el) el.textContent = text;
  }

  function startLocal() {
    localMode = true;
    myColor = null;
    roomCode = null;
    myCard = null;
    resetState();
    showGame();
    renderCard();
    render();
  }

  function resign() {
    const winner = turn === "white" ? "black" : "white";
    alert("기권! 승자: " + winner);

    if (!localMode && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "resign"
      }));
    }
  }

  function render() {
    const boardDiv = document.getElementById("board");
    if (!boardDiv) return;

    boardDiv.innerHTML = "";

    status(
      (localMode ? "로컬 2인" : `온라인 ${roomCode} / 내 색: ${myColor || "대기중"}`)
      + ` | ${turn} 턴`
    );

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement("div");
        cell.className = "cell " + ((r + c) % 2 === 0 ? "light" : "dark");
        cell.dataset.r = r;
        cell.dataset.c = c;

        if (selected && selected.r === r && selected.c === c) {
          cell.classList.add("selected");
        }

        const legal = moves.find(m => m.r === r && m.c === c);

        if (legal) {
          if (
            legal.type === "equalityCastle" ||
            legal.type === "equalityCastleKing" ||
            legal.type === "equalityCastleQueen"
          ) {
            cell.classList.add("equalityCastleMove");
          } else if (board[r][c] || legal.type === "enPassant") {
            cell.classList.add("capture");
          } else {
            cell.classList.add("move");
          }
        }

        if (cardState.activeMode === "equalityPickA") {
          const piece = board[r]?.[c];
          if (piece && piece[0] === turn[0]) cell.classList.add("equalityCastleMove");
        }

        if (cardState.activeMode === "equalityPickB") {
          const targets = getEqualityTargets();
          if (targets.some(pos => pos.r === r && pos.c === c)) cell.classList.add("equalityCastleMove");
        }

        if (cardState.activeMode === "exorcism") {
          const bishops = getExorcismBishopOptions();
          if (bishops.some(pos => pos.r === r && pos.c === c)) cell.classList.add("exorcismCandidate");
        }

        if (cardState.activeMode === "reactionaryPick") {
          const rooks = getReactionaryRookOptions();
          if (rooks.some(pos => pos.r === r && pos.c === c)) cell.classList.add("reactionaryCandidate");
        }

        if (cardState.activeMode === "spacePick") {
          const targets = getSpaceTravelPieces();
          if (targets.some(pos => pos.r === r && pos.c === c)) cell.classList.add("spaceCandidate");
        }

        if (cardState.activeMode === "necroPlace") {
          const places = getNecroPlaceMoves();
          if (places.some(pos => pos.r === r && pos.c === c)) cell.classList.add("necroPlaceCandidate");
        }

        if (cardState.reactionaryActive && cardState.reactionaryRook) {
          if (cardState.reactionaryRook.r === r && cardState.reactionaryRook.c === c) {
            cell.classList.add("selected");
          }
        }

        const piece = board[r][c];

        if (piece) {
          const img = document.createElement("img");
          img.src = imgs[piece];
          cell.appendChild(img);
        }

        cell.onclick = () => clickCell(r, c);

        cell.ontouchstart = ev => {
          if (
            cardState.activeMode === "exorcism" ||
            cardState.activeMode === "reactionaryPick" ||
            cardState.activeMode === "spacePick" ||
            cardState.activeMode === "spacePlace" ||
            cardState.activeMode === "necroPlace" ||
            cardState.activeMode === "equalityPickA" ||
            cardState.activeMode === "equalityPickB"
          ) return;

          if (!canSelect(r, c)) return;

          ev.preventDefault();

          selected = { r, c };
          touchFrom = { r, c };
          moves = getMoves(r, c);

          render();

          const pieceNow = board[r][c];

          removeGhost();

          ghost = document.createElement("img");
          ghost.src = imgs[pieceNow];
          ghost.className = "dragGhost";
          document.body.appendChild(ghost);

          const t = ev.touches[0];
          moveGhost(t.clientX, t.clientY);
        };

        cell.ontouchmove = ev => {
          if (!ghost) return;
          ev.preventDefault();

          const t = ev.touches[0];
          moveGhost(t.clientX, t.clientY);
        };

        cell.ontouchend = ev => {
          if (!touchFrom) return;

          ev.preventDefault();

          const t = ev.changedTouches[0];
          const el = document.elementFromPoint(t.clientX, t.clientY);
          const target = el?.closest(".cell");

          removeGhost();

          if (target) {
            tryMove(touchFrom, {
              r: Number(target.dataset.r),
              c: Number(target.dataset.c)
            });
          }

          touchFrom = null;
        };

        boardDiv.appendChild(cell);
      }
    }
  }

  function moveGhost(x, y) {
    if (!ghost) return;
    ghost.style.left = x + "px";
    ghost.style.top = y + "px";
  }

  function removeGhost() {
    if (ghost) {
      ghost.remove();
      ghost = null;
    }
  }

  function canSelect(r, c) {
    const piece = board[r]?.[c];

    if (!piece) return false;
    if (piece[0] !== turn[0]) return false;
    if (!localMode && myColor && piece[0] !== myColor[0]) return false;

    return true;
  }

  function clickCell(r, c) {
    if (cardState.activeMode === "equalityPickA") {
      chooseEqualityFirst(r, c);
      return;
    }

    if (cardState.activeMode === "equalityPickB") {
      chooseEqualitySecond(r, c);
      return;
    }

    if (cardState.activeMode === "reactionaryPick") {
      chooseReactionaryRook(r, c);
      return;
    }

    if (cardState.activeMode === "spacePick") {
      chooseSpacePiece(r, c);
      return;
    }

    if (cardState.activeMode === "spacePlace") {
      placeSpaceTravel(r, c);
      return;
    }

    if (cardState.activeMode === "necroPlace") {
      placeNecro(r, c);
      return;
    }

    if (cardState.activeMode === "exorcism") {
      chooseExorcismBishop(r, c);
      return;
    }

    if (!selected) {
      if (!canSelect(r, c)) return;

      selected = { r, c };
      moves = getMoves(r, c);
      render();
      return;
    }

    tryMove(selected, { r, c });
  }

  async function tryMove(from, to) {
    const legal = moves.find(m => m.r === to.r && m.c === to.c);

    if (!legal) {
      selected = null;
      moves = [];
      touchFrom = null;
      render();
      return;
    }

    let promoteTo = null;

    const moving = board[from.r][from.c];
    const target = board[to.r][to.c];

    if (cardState.doubleMoveActive && cardState.doubleMoveLeft > 0 && target && target[1] === "k") {
      alert("더블무브 중에는 킹을 잡을 수 없음");
      selected = null;
      moves = [];
      touchFrom = null;
      render();
      return;
    }

    if (moving[1] === "p" && (to.r === 0 || to.r === 7)) {
      promoteTo = await askPromotion();
    }

    if (localMode) {
      applyMove(from, to, promoteTo);
      selected = null;
      moves = [];
      touchFrom = null;
      render();
    } else if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "move",
        from,
        to,
        promoteTo
      }));

      selected = null;
      moves = [];
      touchFrom = null;
      render();
    }
  }

  function askPromotion() {
    document.getElementById("promotionModal")?.classList.remove("hidden");

    return new Promise(resolve => {
      promotionResolve = resolve;
    });
  }

  function choosePromotion(piece) {
    document.getElementById("promotionModal")?.classList.add("hidden");

    if (promotionResolve) {
      const resolve = promotionResolve;
      promotionResolve = null;
      resolve(piece);
    }
  }

  function finishMoveTurn() {
    if (cardState.doubleMoveLeft > 1) {
      cardState.doubleMoveLeft--;
    } else {
      cardState.doubleMoveLeft = 0;
      cardState.doubleMoveActive = false;
      turn = turn === "white" ? "black" : "white";
    }
  }

  function applyMove(from, to, promoteTo) {
    const moving = board[from.r][from.c];
    let captured = board[to.r][to.c];

    if (captured && captured[0] !== moving[0] && captured[1] !== "k") {
      cardState.necroCapturedPieces.push(captured);
    }

    const legal = getMoves(from.r, from.c).find(m => m.r === to.r && m.c === to.c);

    updateMoved(moving, from);
    enPassant = null;

    if (legal?.type === "enPassant") {
      const capRow = moving[0] === "w" ? to.r + 1 : to.r - 1;
      captured = board[capRow][to.c];

      if (captured && captured[0] !== moving[0] && captured[1] !== "k") {
        cardState.necroCapturedPieces.push(captured);
      }

      board[capRow][to.c] = "";
    }

    board[to.r][to.c] = moving;
    board[from.r][from.c] = "";

    if (legal?.type === "doublePawn") {
      const dir = moving[0] === "w" ? -1 : 1;
      enPassant = {
        r: from.r + dir,
        c: from.c
      };
    }

    if (legal?.type === "castleKing") {
      const row = moving[0] === "w" ? 7 : 0;
      board[row][5] = board[row][7];
      board[row][7] = "";
    }

    if (legal?.type === "castleQueen") {
      const row = moving[0] === "w" ? 7 : 0;
      board[row][3] = board[row][0];
      board[row][0] = "";
    }

    if (moving[1] === "p" && (to.r === 0 || to.r === 7)) {
      board[to.r][to.c] = moving[0] + (promoteTo || "q");
    }

    if (captured && captured[1] === "k") {
      alert("게임 끝! 승자: " + turn);
      return;
    }

    if (moving[1] === "k" && cardState.kingReturn && cardState.kingReturn.turns > 0) {
      cardState.kingReturn.turns--;

      if (cardState.kingReturn.turns <= 0) {
        cardState.kingReturn = null;
      }
    }

    if (cardState.reactionaryActive && cardState.reactionaryRook) {
      if (cardState.reactionaryRook.r === from.r && cardState.reactionaryRook.c === from.c) {
        cardState.reactionaryRook = { r: to.r, c: to.c };
      }

      if (legal?.type === "castleKing") {
        const row = moving[0] === "w" ? 7 : 0;

        if (cardState.reactionaryRook.r === row && cardState.reactionaryRook.c === 7) {
          cardState.reactionaryRook = { r: row, c: 5 };
        }
      }

      if (legal?.type === "castleQueen") {
        const row = moving[0] === "w" ? 7 : 0;

        if (cardState.reactionaryRook.r === row && cardState.reactionaryRook.c === 0) {
          cardState.reactionaryRook = { r: row, c: 3 };
        }
      }
    }

    finishMoveTurn();
  }

  function updateMoved(piece, from) {
    if (piece === "wk") moved.wk = true;
    if (piece === "bk") moved.bk = true;

    if (piece === "wr" && from.r === 7 && from.c === 0) moved.wrA = true;
    if (piece === "wr" && from.r === 7 && from.c === 7) moved.wrH = true;
    if (piece === "br" && from.r === 0 && from.c === 0) moved.brA = true;
    if (piece === "br" && from.r === 0 && from.c === 7) moved.brH = true;
  }

  function getMoves(r, c) {
    const piece = board[r]?.[c];
    if (!piece) return [];

    const color = piece[0];
    const type = piece[1];
    const res = [];

    const add = (nr, nc, kind = "normal") => {
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return;

      if (!board[nr][nc] || board[nr][nc][0] !== color) {
        res.push({ r: nr, c: nc, type: kind });
      }
    };

    const slide = dirs => {
      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;

        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          if (!board[nr][nc]) {
            res.push({ r: nr, c: nc, type: "normal" });
          } else {
            if (board[nr][nc][0] !== color) {
              res.push({ r: nr, c: nc, type: "normal" });
            }
            break;
          }

          nr += dr;
          nc += dc;
        }
      }
    };

    if (type === "p") {
      const dir = color === "w" ? -1 : 1;
      const start = color === "w" ? 6 : 1;

      if (!board[r + dir]?.[c]) add(r + dir, c);

      if (r === start && !board[r + dir]?.[c] && !board[r + dir * 2]?.[c]) {
        add(r + dir * 2, c, "doublePawn");
      }

      for (const dc of [-1, 1]) {
        const target = board[r + dir]?.[c + dc];

        if (target && target[0] !== color) add(r + dir, c + dc);

        if (enPassant && enPassant.r === r + dir && enPassant.c === c + dc) {
          res.push({ r: r + dir, c: c + dc, type: "enPassant" });
        }
      }
    }

    if (type === "n") {
      if (cardState.wildHorse) return getWildHorseMoves(r, c, board, color);

      [
        [2,1],[1,2],[-1,2],[-2,1],
        [-2,-1],[-1,-2],[1,-2],[2,-1]
      ].forEach(([dr, dc]) => add(r + dr, c + dc));
    }

    if (type === "b") slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
    if (type === "r") slide([[1,0],[-1,0],[0,1],[0,-1]]);
    if (type === "q") slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);

    if (type === "k") {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr || dc) add(r + dr, c + dc);
        }
      }

      if (cardState.kingReturn && cardState.kingReturn.turns > 0) {
        const mode = cardState.kingReturn.mode;

        const addKingReturnMove = (dr, dc) => {
          const nr = r + dr;
          const nc = c + dc;

          if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return;

          const target = board[nr][nc];

          if (!target || target[0] !== color) {
            res.push({ r: nr, c: nc, type: "kingReturn" });
          }
        };

        if (mode === "bn" || mode === "qn") {
          [
            [2,1],[1,2],[-1,2],[-2,1],
            [-2,-1],[-1,-2],[1,-2],[2,-1]
          ].forEach(([dr, dc]) => addKingReturnMove(dr, dc));
        }

        if (mode === "bn") slide([[1,1],[1,-1],[-1,1],[-1,-1]]);

        if (mode === "q" || mode === "qn") {
          slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
        }
      }

      if (color === "w" && r === 7 && c === 4 && !moved.wk) {
        if (!moved.wrH && board[7][5] === "" && board[7][6] === "" && board[7][7] === "wr") {
          add(7, 6, "castleKing");
        }

        if (!moved.wrA && board[7][1] === "" && board[7][2] === "" && board[7][3] === "" && board[7][0] === "wr") {
          add(7, 2, "castleQueen");
        }
      }

      if (color === "b" && r === 0 && c === 4 && !moved.bk) {
        if (!moved.brH && board[0][5] === "" && board[0][6] === "" && board[0][7] === "br") {
          add(0, 6, "castleKing");
        }

        if (!moved.brA && board[0][1] === "" && board[0][2] === "" && board[0][3] === "" && board[0][0] === "br") {
          add(0, 2, "castleQueen");
        }
      }
    }

    return res;
  }

  function getEqualityTargets() {
    if (cardState.activeMode !== "equalityPickB") return [];
    if (!cardState.selectedSquares[0]) return [];

    const from = cardState.selectedSquares[0];
    const moving = board[from.r]?.[from.c];

    if (!moving) return [];

    const result = [];
    const row = from.r;
    const color = moving[0];

    for (const dc of [-3, 3]) {
      const targetC = from.c + dc;

      if (targetC < 0 || targetC > 7) continue;

      const target = board[row][targetC];

      if (!target || target[0] !== color) continue;

      const dir = Math.sign(dc);
      const mid1 = board[row][from.c + dir];
      const mid2 = board[row][from.c + dir * 2];

      if (mid1 || mid2) continue;

      result.push({ r: row, c: targetC, type: "equalityCastle" });
    }

    return result;
  }

  function chooseEqualityFirst(r, c) {
    const piece = board[r]?.[c];

    if (!piece || piece[0] !== turn[0]) {
      alert("내 기물만 선택 가능합니다.");
      return;
    }

    cardState.selectedSquares = [{ r, c }];
    cardState.activeMode = "equalityPickB";

    selected = { r, c };
    moves = getEqualityTargets();

    if (moves.length === 0) {
      alert("이 기물은 평등국가 캐슬링 가능한 상대 기물이 없습니다.");
      cardState.activeMode = "equalityPickA";
      cardState.selectedSquares = [];
      selected = null;
      moves = [];
    }

    render();
  }

  function chooseEqualitySecond(r, c) {
    const from = cardState.selectedSquares[0];

    if (!from) {
      cardState.activeMode = "equalityPickA";
      render();
      return;
    }

    const targets = getEqualityTargets();
    const ok = targets.some(pos => pos.r === r && pos.c === c);

    if (!ok) {
      alert("같은 가로줄에서 사이 빈칸 2칸인 내 기물만 선택 가능합니다.");
      return;
    }

    applyEqualityCastleSpecial(from, { r, c });

    const usedColor = turn;

    cardState.activeMode = null;
    cardState.selectedSquares = [];
    selected = null;
    moves = [];

    equalityUses[usedColor]++;

    if (equalityUses[usedColor] >= 10) {
      if (localMode) {
        alert("게임 끝! 승자: " + usedColor);
        renderCard();
        render();
        return;
      }

      turn = turn === "white" ? "black" : "white";
      syncCardUpdate(true);
      renderCard();
      render();
      return;
    }

    turn = turn === "white" ? "black" : "white";
    syncCardUpdate(true);
    renderCard();
    render();
  }

  function applyEqualityCastleSpecial(a, b) {
    const row = a.r;
    const pieceA = board[a.r][a.c];
    const pieceB = board[b.r][b.c];
    const dir = Math.sign(b.c - a.c);

    const aFinalC = a.c + dir * 2;
    const bFinalC = a.c + dir;

    board[a.r][a.c] = "";
    board[b.r][b.c] = "";

    board[row][bFinalC] = pieceB;
    board[row][aFinalC] = pieceA;
  }

  function getExorcismBishopOptions() {
    const result = [];
    const color = turn[0];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === color + "b") result.push({ r, c });
      }
    }

    return result;
  }

  function showExorcismModal() {
    const modal = document.getElementById("exorcismModal");
    const list = document.getElementById("exorcismList");
    const bishops = getExorcismBishopOptions();

    if (bishops.length === 0) {
      alert("사용할 수 있는 비숍이 없습니다.");
      cancelCardSelection();
      return;
    }

    if (!modal || !list) {
      cardState.activeMode = "exorcism";
      pendingCardUse = myCard;
      selected = null;
      moves = [];
      render();
      return;
    }

    list.innerHTML = "";

    bishops.forEach(pos => {
      const btn = document.createElement("button");
      btn.className = "selectBtn";
      btn.textContent = `비숍 ${squareName(pos.r, pos.c)}`;
      btn.onclick = () => chooseExorcismBishop(pos.r, pos.c);
      list.appendChild(btn);
    });

    cardState.activeMode = "exorcism";
    pendingCardUse = myCard;
    selected = null;
    moves = [];

    modal.classList.remove("hidden");
    render();
  }

  function chooseExorcismBishop(r, c) {
    const piece = board[r]?.[c];

    if (!piece || piece[0] !== turn[0] || piece[1] !== "b") {
      alert("퇴마(물리)는 내 비숍만 사용할 수 있습니다.");
      return;
    }

    closeAllCardModals();
    doExorcism(r, c);

    cardState.activeMode = null;
    selected = null;
    moves = [];

    consumeCurrentCard();
    syncCardUpdate();

    renderCard();
    render();
  }

  function doExorcism(r, c) {
    const bishop = board[r][c];
    if (!bishop) return;

    const color = bishop[0];
    const dir = color === "w" ? -1 : 1;

    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dir;
      const nc = c + dc;

      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;

      const target = board[nr][nc];

      if (target && target[1] === "k") {
        alert("퇴마(물리)로 킹 제거! 승자: " + turn);
        board[nr][nc] = "";
        return;
      }

      board[nr][nc] = "";
    }

    turn = turn === "white" ? "black" : "white";
  }

  function getReactionaryOwnerColor() {
    if (!localMode && myColor) return myColor;
    return turn;
  }

  function getReactionaryRookOptions() {
    const result = [];
    const owner = getReactionaryOwnerColor();

    if (owner === "white") {
      if (moved.wk || moved.wrA || moved.wrH) return result;
      if (board[7]?.[0] === "wr") result.push({ r: 7, c: 0 });
      if (board[7]?.[7] === "wr") result.push({ r: 7, c: 7 });
    }

    if (owner === "black") {
      if (moved.bk || moved.brA || moved.brH) return result;
      if (board[0]?.[0] === "br") result.push({ r: 0, c: 0 });
      if (board[0]?.[7] === "br") result.push({ r: 0, c: 7 });
    }

    return result;
  }

  function chooseReactionaryRook(r, c) {
    const owner = getReactionaryOwnerColor();
    const piece = board[r]?.[c];

    if (!piece || piece[0] !== owner[0] || piece[1] !== "r") {
      alert("내 룩만 왕룩으로 선택 가능합니다.");
      return;
    }

    const options = getReactionaryRookOptions();
    const ok = options.some(pos => pos.r === r && pos.c === c);

    if (!ok) {
      alert("캐슬링 둘 다 하지 않은 상태의 시작 위치 룩만 선택 가능합니다.");
      return;
    }

    closeAllCardModals();

    cardState.reactionaryActive = true;
    cardState.reactionaryRook = { r, c };
    cardState.reactionaryChecks = 0;
    cardState.activeMode = null;

    selected = null;
    moves = [];

    syncCardUpdate();

    alert("왕룩 지정 완료. 이 룩이 잡히면 패배합니다.");

    renderCard();
    render();
  }

  function getSpaceTravelPieces() {
    if (!cardState.spaceTravelEnabled) return [];

    if (!localMode && myColor && turn !== myColor) return [];

    const color = turn[0];
    const result = [];

    const corners = color === "w"
      ? [{ r: 0, c: 0 }, { r: 0, c: 7 }]
      : [{ r: 7, c: 0 }, { r: 7, c: 7 }];

    for (const pos of corners) {
      const piece = board[pos.r]?.[pos.c];

      if (piece && piece[0] === color) {
        result.push({ r: pos.r, c: pos.c, type: "normal" });
      }
    }

    return result;
  }

  function getSpaceDestinationMoves(color) {
    const result = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const target = board[r][c];

        if (!target) {
          result.push({ r, c, type: "normal" });
          continue;
        }

        if (target[0] !== color && target[1] !== "k") {
          result.push({ r, c, type: "normal" });
        }
      }
    }

    return result;
  }

  function showSpaceModal() {
    const modal = document.getElementById("spaceModal");
    const list = document.getElementById("spaceList");
    const targets = getSpaceTravelPieces();

    if (targets.length === 0) {
      alert("텔레포트 가능한 기물이 없습니다.");
      cancelCardSelection();
      return;
    }

    if (!modal || !list) {
      cardState.activeMode = "spacePick";
      cardState.selectedSquares = [];
      selected = null;
      moves = targets;
      renderCard();
      render();
      return;
    }

    list.innerHTML = "";

    targets.forEach(pos => {
      const piece = board[pos.r][pos.c];
      const btn = document.createElement("button");
      btn.className = "selectBtn";
      btn.textContent = `${pieceName(piece)} ${squareName(pos.r, pos.c)}`;
      btn.onclick = () => chooseSpacePiece(pos.r, pos.c);
      list.appendChild(btn);
    });

    cardState.activeMode = "spacePick";
    cardState.selectedSquares = [];
    selected = null;
    moves = targets;

    modal.classList.remove("hidden");
    render();
  }

  function chooseSpacePiece(r, c) {
    const piece = board[r]?.[c];

    if (!piece || piece[0] !== turn[0]) {
      alert("텔레포트 가능한 내 기물만 선택 가능합니다.");
      return;
    }

    const targets = getSpaceTravelPieces();
    const ok = targets.some(pos => pos.r === r && pos.c === c);

    if (!ok) {
      alert("상대 진영 코너에 도착한 기물만 선택 가능합니다.");
      return;
    }

    closeAllCardModals();

    cardState.selectedSquares = [{ r, c }];
    cardState.activeMode = "spacePlace";

    selected = { r, c };
    moves = getSpaceDestinationMoves(piece[0]);

    alert("이동할 칸을 선택하세요. 상대 기물은 잡을 수 있지만 킹은 못 잡습니다.");
    renderCard();
    render();
  }

  function placeSpaceTravel(r, c) {
    const from = cardState.selectedSquares[0];

    if (!from) {
      alert("텔레포트할 기물이 선택되지 않았습니다.");
      cardState.activeMode = null;
      cardState.selectedSquares = [];
      selected = null;
      moves = [];
      render();
      return;
    }

    const piece = board[from.r]?.[from.c];
    const target = board[r]?.[c];

    if (!piece) {
      alert("텔레포트할 기물이 없음");
      cardState.activeMode = null;
      cardState.selectedSquares = [];
      selected = null;
      moves = [];
      render();
      return;
    }

    if (target && target[0] === piece[0]) {
      alert("내 기물이 있는 칸으로는 텔레포트할 수 없습니다.");
      return;
    }

    if (target && target[1] === "k") {
      alert("우주여행으로 킹은 잡을 수 없습니다.");
      return;
    }

    if (target && target[0] !== piece[0] && target[1] !== "k") {
      cardState.necroCapturedPieces.push(target);
    }

    board[r][c] = piece;
    board[from.r][from.c] = "";

    cardState.selectedSquares = [];
    cardState.activeMode = null;

    selected = null;
    moves = [];

    turn = turn === "white" ? "black" : "white";

    syncCardUpdate();
    renderCard();
    render();
  }

  function showNecroModal() {
    const modal = document.getElementById("necroModal");
    const list = document.getElementById("necroList");

    if (cardState.necroCapturedPieces.length === 0) {
      alert("부활시킬 수 있는 잡은 기물이 없습니다.");
      cancelCardSelection();
      return;
    }

    if (!modal || !list) {
      cardState.activeMode = "necroPick";
      pendingCardUse = myCard;
      selected = null;
      moves = [];
      render();
      return;
    }

    list.innerHTML = "";

    cardState.necroCapturedPieces.forEach((piece, index) => {
      const btn = document.createElement("button");
      btn.className = "selectBtn";
      btn.textContent = `${pieceName(piece)} (${piece[0] === "w" ? "백" : "흑"})`;
      btn.onclick = () => chooseNecroPiece(index);
      list.appendChild(btn);
    });

    cardState.activeMode = "necroPick";
    pendingCardUse = myCard;
    selected = null;
    moves = [];

    modal.classList.remove("hidden");
    render();
  }

  function chooseNecroPiece(index) {
    const piece = cardState.necroCapturedPieces[index];

    if (!piece) {
      alert("선택한 기물이 없습니다.");
      return;
    }

    cardState.necroSelectedPiece = piece;
    cardState.activeMode = "necroPlace";

    moves = getNecroPlaceMoves();
    selected = null;

    closeAllCardModals();

    if (moves.length === 0) {
      alert("킹 주변에 부활 가능한 빈칸이 없습니다.");
      cardState.necroSelectedPiece = null;
      cardState.activeMode = null;
      moves = [];
      render();
      return;
    }

    alert("킹 주변 빈칸을 선택하세요.");
    render();
  }

  function placeNecro(r, c) {
    if (board[r][c]) {
      alert("빈칸만 가능");
      return;
    }

    const kingPos = findMyKing();

    if (!kingPos) {
      alert("킹 없음");
      return;
    }

    const near = Math.abs(kingPos.r - r) <= 1 && Math.abs(kingPos.c - c) <= 1;

    if (!near) {
      alert("킹 주변만 가능");
      return;
    }

    const color = turn[0];
    const type = cardState.necroSelectedPiece[1];

    board[r][c] = color + type;

    cardState.necroUsed = true;

    const usedIndex = cardState.necroCapturedPieces.findIndex(
      p => p === cardState.necroSelectedPiece
    );

    if (usedIndex !== -1) {
      cardState.necroCapturedPieces.splice(usedIndex, 1);
    }

    cardState.necroSelectedPiece = null;
    cardState.activeMode = null;

    selected = null;
    moves = [];

    turn = turn === "white" ? "black" : "white";

    consumeCurrentCard();
    syncCardUpdate();

    renderCard();
    render();
  }

  function pieceName(piece) {
    const names = {
      p: "폰",
      r: "룩",
      n: "나이트",
      b: "비숍",
      q: "퀸",
      k: "킹"
    };

    return names[piece?.[1]] || "알 수 없는 기물";
  }

  function findMyKing() {
    const king = turn === "white" ? "wk" : "bk";

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === king) return { r, c };
      }
    }

    return null;
  }

  function getNecroPlaceMoves() {
    const kingPos = findMyKing();
    if (!kingPos) return [];

    const result = [];

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;

        const r = kingPos.r + dr;
        const c = kingPos.c + dc;

        if (r < 0 || r > 7 || c < 0 || c > 7) continue;
        if (board[r][c]) continue;

        result.push({ r, c, type: "normal" });
      }
    }

    return result;
  }

  function getKingReturnData(score) {
    if (score >= 3 && score <= 6) return { mode: "bn", turns: 15, score };
    if (score >= 7 && score <= 10) return { mode: "q", turns: 5, score };
    if (score >= 11 && score <= 14) return { mode: "q", turns: 10, score };
    if (score >= 15 && score <= 18) return { mode: "q", turns: 15, score };
    if (score >= 19 && score <= 22) return { mode: "qn", turns: 15, score };
    return null;
  }

  function activateKingReturn() {
    const values = {
      q: 9,
      r: 5,
      b: 3,
      n: 3
    };

    let score = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];

        if (!piece) continue;
        if (piece[0] !== turn[0]) continue;
        if (piece[1] === "k") continue;
        if (piece[1] === "p") continue;

        score += values[piece[1]] || 0;
        board[r][c] = "";
      }
    }

    if (score >= 23) {
      alert("왕의 귀환 실패! 23점 이상이라 패배");

      if (!localMode && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resign" }));
      }

      return;
    }

    cardState.kingReturn = getKingReturnData(score);

    if (cardState.kingReturn) {
      alert(`왕의 귀환 발동! 점수 ${score}, ${cardState.kingReturn.turns}턴 강화`);
    } else {
      alert(`왕의 귀환 발동! 점수 ${score}, 강화 없음`);
    }

    turn = turn === "white" ? "black" : "white";
  }

  function activateCard() {
    if (!myCard) {
      alert("사용할 카드가 없습니다.");
      return;
    }

    const usedCard = myCard;

    if (usedCard === "equality") {
      const result = useCard(usedCard, cardState);
      alert(result.message);
      selected = null;
      moves = [];
      renderCard();
      render();
      return;
    }

    if (usedCard === "reactionary") {
      alert("반동분자는 패시브 능력입니다. 내 킹이 잡혔을 때 조건을 만족하면 발동됩니다.");
      return;
    }

    if (!localMode && myColor && turn !== myColor && usedCard === "doubleMove") {
      alert("더블무브는 내 턴에만 사용할 수 있습니다.");
      return;
    }

    if (usedCard === "exorcism") {
      pendingCardUse = usedCard;
      showExorcismModal();
      return;
    }

    if (usedCard === "necro") {
      if (cardState.necroUsed) {
        alert("네크로맨서는 이미 사용했습니다.");
        return;
      }

      if (cardState.necroCapturedPieces.length === 0) {
        alert("아직 부활시킬 잡은 기물이 없습니다.");
        return;
      }

      pendingCardUse = usedCard;
      showNecroModal();
      return;
    }

    if (usedCard === "spaceTravel") {
      const result = useCard(usedCard, cardState);

      if (!result.ok) {
        alert(result.message);
        return;
      }

      alert(result.message);

      pendingCardUse = null;

      if (!localMode && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "card",
          card: usedCard
        }));
      }

      syncCardUpdate();
      renderCard();
      render();
      return;
    }

    if (usedCard === "kingReturn") {
      pendingCardUse = usedCard;
      activateKingReturn();
      consumeCurrentCard();
      syncCardUpdate();
      renderCard();
      render();
      return;
    }

    if (usedCard === "doubleMove" || usedCard === "wildHorse") {
      const result = useCard(usedCard, cardState);

      alert(result.message);

      if (!result.ok) return;

      pendingCardUse = usedCard;
      consumeCurrentCard();

      renderCard();
      render();
      return;
    }

    const result = useCard(usedCard, cardState);
    alert(result.message);

    if (result.ok) {
      pendingCardUse = usedCard;
      consumeCurrentCard();
      renderCard();
      render();
    }
  }

  function activateSpaceTravel() {
    showSpaceModal();
  }

  function renderCard() {
    const area = document.getElementById("cardArea");
    if (!area) return;

    const spaceTargets = getSpaceTravelPieces();

    if (cardState.activeMode === "equalityPickA") {
      area.innerHTML = `
        <div class="cardBox">
          <div class="cardTitle">평등국가</div>
          <div class="cardDesc">캐슬링할 첫 번째 내 기물을 선택하세요.</div>
        </div>
      `;
      return;
    }

    if (cardState.activeMode === "equalityPickB") {
      area.innerHTML = `
        <div class="cardBox">
          <div class="cardTitle">평등국가</div>
          <div class="cardDesc">사이에 빈칸 2칸이 있는 같은 가로줄의 내 기물을 선택하세요.</div>
        </div>
      `;
      return;
    }

    if (cardState.activeMode === "reactionaryPick") {
      area.innerHTML = `
        <div class="cardBox">
          <div class="cardTitle">반동분자</div>
          <div class="cardDesc">왕룩으로 지정할 룩을 선택하세요.</div>
        </div>
      `;
      return;
    }

    if (cardState.activeMode === "exorcism") {
      area.innerHTML = `
        <div class="cardBox">
          <div class="cardTitle">퇴마(물리)</div>
          <div class="cardDesc">능력을 사용할 비숍을 선택하세요.</div>
        </div>
      `;
      return;
    }

    if (cardState.activeMode === "necroPlace") {
      area.innerHTML = `
        <div class="cardBox">
          <div class="cardTitle">네크로맨서</div>
          <div class="cardDesc">킹 주변 빈칸을 선택하세요.</div>
        </div>
      `;
      return;
    }

    if (cardState.activeMode === "spacePlace") {
      area.innerHTML = `
        <div class="cardBox">
          <div class="cardTitle">우주여행</div>
          <div class="cardDesc">이동할 칸을 선택하세요. 상대 기물은 잡을 수 있지만 킹은 못 잡습니다.</div>
        </div>
      `;
      return;
    }

    if (cardState.reactionaryActive && cardState.reactionaryRook) {
      area.innerHTML = `
        <div class="cardBox">
          <div class="cardTitle">왕룩 활성화</div>
          <div class="cardDesc">
            왕룩 위치: ${squareName(cardState.reactionaryRook.r, cardState.reactionaryRook.c)}<br>
            위협 누적: ${cardState.reactionaryChecks}/3
          </div>
        </div>
      `;
      return;
    }

    if (cardState.spaceTravelEnabled && spaceTargets.length > 0) {
      area.innerHTML = `
        <div class="cardBox">
          <div class="cardTitle">우주여행 준비됨</div>
          <div class="cardDesc">상대 진영 코너에 도착한 내 기물을 원하는 칸으로 텔레포트합니다.</div>
          <button class="cardBtn" onclick="Game.activateSpaceTravel()">텔레포트 사용</button>
        </div>
      `;
      return;
    }

    if (!myCard) {
      area.innerHTML = "";
      return;
    }

    if (myCard === "equality") {
      area.innerHTML = `
        <div class="cardBox">
          <div class="cardTitle">${getCardName(myCard)}</div>
          <div class="cardDesc">
            ${getCardDescription(myCard)}<br>
            <b>사용 횟수 제한 없음</b>
          </div>
          <button class="cardBtn" onclick="Game.activateCard()">평등국가 사용</button>
        </div>
      `;
      return;
    }

    if (myCard === "reactionary") {
      area.innerHTML = `
        <div class="cardBox">
          <div class="cardTitle">${getCardName(myCard)}</div>
          <div class="cardDesc">
            ${getCardDescription(myCard)}<br>
            <b>킹이 잡혔을 때 조건부 발동</b>
          </div>
        </div>
      `;
      return;
    }

    area.innerHTML = `
      <div class="cardBox">
        <div class="cardTitle">${getCardName(myCard)}</div>
        <div class="cardDesc">${getCardDescription(myCard)}</div>
        <button class="cardBtn" onclick="Game.activateCard()">능력 사용</button>
      </div>
    `;
  }

  window.addEventListener("load", () => {
  renderAccount();

  getRedirectResult(auth)
    .then(async result => {
      console.log("REDIRECT RESULT:", result);

      if (result && result.user) {
        await applyGoogleUser(result.user);
        setLoginState((result.user.displayName || result.user.email || "Google User") + " 로그인됨");
        alert((result.user.displayName || result.user.email || "Google User") + " 로그인됨");
      } else {
        console.log("redirect result 없음");
      }
    })
    .catch(err => {
      console.error("REDIRECT ERROR:", err);
      alert("구글 로그인 결과 처리 실패: " + err.code + "\n" + err.message);
    });

  const savedName = localStorage.getItem("randomChessGuestName");
  const nick = document.getElementById("nickInput");

  if (savedName && nick) {
    nick.value = savedName;
  }

  const params = new URLSearchParams(location.search);
  const room = params.get("room");

  if (room) {
    pendingJoinRoomId = room;
    openJoinRoom(room, false);
  }
});

    const savedName = localStorage.getItem("randomChessGuestName");
    const nick = document.getElementById("nickInput");

    if (savedName && nick) {
      nick.value = savedName;
    }

    const params = new URLSearchParams(location.search);
    const room = params.get("room");

    if (room) {
      pendingJoinRoomId = room;
      openJoinRoom(room, false);
    }
  });

  return {
    startLocal,
    createOnlineRoom,
    refreshRooms,
    openJoinRoom,
    confirmJoinRoom,
    closeJoinModal,
    backMenu,
    resign,
    copyInvite,
    choosePromotion,
    activateCard,
    activateSpaceTravel,

    loginGoogle,
    logout,
    loginNickname,

    addFriend,
    refreshFriends,
    acceptFriend,
    rejectFriend,
    inviteFriend,

    cancelCardSelection,
    chooseExorcismBishop,
    chooseReactionaryRook,
    chooseSpacePiece,
    chooseNecroPiece
  };
})();

window.Game = Game;
