import {
  createCardState,
  useCard,
  getWildHorseMoves,
  getCardName,
  getCardDescription
} from "./cards.js";

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

window.onerror = function(msg) {
  alert("에러: " + msg);
};

const firebaseConfig = {
  apiKey: "AIzaSyCLHcT1IPTW_60G2eR1gWx5Ft78gR0_UAc",
  authDomain: "randomechess-ab59f.firebaseapp.com",
  projectId: "randomechess-ab59f",
  storageBucket: "randomechess-ab59f.firebasestorage.app",
  messagingSenderId: "140048881457",
  appId: "1:140048881457:web:4526303c95476bfed98210",
  measurementId: "G-8HVR0F6JEN"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

getRedirectResult(auth).catch(err => {
  alert("구글 로그인 처리 실패: " + err.code + "\n" + err.message);
});

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

  let moved = {
    wk:false, wrA:false, wrH:false,
    bk:false, brA:false, brH:false
  };

  let equalityUses = {
    white: 0,
    black: 0
  };

  const imgs = {
    wp:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wp.png",
    wr:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wr.png",
    wn:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wn.png",
    wb:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wb.png",
    wq:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wq.png",
    wk:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wk.png",
    bp:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bp.png",
    br:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/br.png",
    bn:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bn.png",
    bb:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bb.png",
    bq:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bq.png",
    bk:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bk.png"
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

  function squareName(r, c) {
    return `${String.fromCharCode(97 + c)}${8 - r}`;
  }

  function ensureOnlineUI() {
    const menu = document.getElementById("menu");
    if (!menu) return;

    if (!document.getElementById("accountBox")) {
      const box = document.createElement("div");
      box.id = "accountBox";
      box.className = "onlineBox";
      box.innerHTML = `
        <h2>계정</h2>
        <div id="accountStatus">로그인 안 됨</div>
        <input id="nicknameInput" placeholder="닉네임">
        <button id="googleLoginBtn" onclick="Game.loginGoogle()">Google 로그인</button>
        <button onclick="Game.loginNickname()">닉네임 로그인</button>
        <button id="logoutBtn" class="hidden" onclick="Game.logout()">로그아웃</button>
      `;
      menu.appendChild(box);
    }

    if (!document.getElementById("newLobbyBox")) {
      const box = document.createElement("div");
      box.id = "newLobbyBox";
      box.className = "onlineBox";
      box.innerHTML = `
        <h2>온라인 방</h2>
        <input id="roomNameInput" placeholder="방 이름">
        <input id="roomPasswordInput" placeholder="비밀번호, 없으면 공개방">
        <button onclick="Game.createNamedRoom()">방 만들기</button>
        <button onclick="Game.refreshRooms()">방 목록 새로고침</button>
        <div id="roomList" class="miniList"></div>
      `;
      menu.appendChild(box);
    }

    if (!document.getElementById("friendBox")) {
      const box = document.createElement("div");
      box.id = "friendBox";
      box.className = "onlineBox";
      box.innerHTML = `
        <h2>친구</h2>
        <input id="friendSearchInput" placeholder="친구 닉네임 또는 이메일">
        <button onclick="Game.addFriend()">친구 추가</button>
        <div class="modalDesc">친구 요청</div>
        <div id="friendRequestList" class="miniList"></div>
        <div class="modalDesc">친구 목록</div>
        <div id="friendList" class="miniList"></div>
      `;
      menu.appendChild(box);
    }
  }

  async function loginGoogle() {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      alert("구글 로그인 실패: " + err.code + "\n" + err.message);
    }
  }

  async function logout() {
    try {
      await signOut(auth);
      currentUser = null;
      stopFriendListeners();
      renderAccount();
      renderFriends([], []);
      alert("로그아웃됨");
    } catch (err) {
      alert("로그아웃 실패: " + err.code + "\n" + err.message);
    }
  }

  async function loginNickname() {
    const input = document.getElementById("nicknameInput");
    const name = input?.value?.trim();

    if (!name) {
      alert("닉네임을 입력해라.");
      return;
    }

    const uid = localStorage.getItem("randomChessGuestUid") || "guest-" + crypto.randomUUID();
    localStorage.setItem("randomChessGuestUid", uid);

    currentUser = {
      uid,
      name,
      email: "",
      photoURL: "",
      provider: "nickname"
    };

    localStorage.setItem("randomChessGuestName", name);

    try {
      await saveUserProfile();
      startFriendListeners();
    } catch {}

    renderAccount();
    alert(name + " 로그인됨");
  }

  async function saveUserProfile() {
    if (!currentUser) return;

    await setDoc(doc(db, "users", currentUser.uid), {
      uid: currentUser.uid,
      name: currentUser.name,
      nickname: currentUser.name,
      email: currentUser.email || "",
      provider: currentUser.provider,
      photoURL: currentUser.photoURL || "",
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  function renderAccount() {
    ensureOnlineUI();

    const accountStatus = document.getElementById("accountStatus");
    const googleBtn = document.getElementById("googleLoginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const nicknameInput = document.getElementById("nicknameInput");

    if (accountStatus) {
      accountStatus.textContent = currentUser
        ? `${currentUser.name} 로그인됨`
        : "로그인 안 됨";
    }

    if (googleBtn) googleBtn.classList.toggle("hidden", !!currentUser);
    if (logoutBtn) logoutBtn.classList.toggle("hidden", !currentUser);
    if (nicknameInput && currentUser) nicknameInput.value = currentUser.name;
  }

  function stopFriendListeners() {
    if (unsubscribeFriends) unsubscribeFriends();
    if (unsubscribeRequests) unsubscribeRequests();
    unsubscribeFriends = null;
    unsubscribeRequests = null;
  }

  function startFriendListeners() {
    stopFriendListeners();

    if (!currentUser) return;

    const friendsRef = collection(db, "users", currentUser.uid, "friends");
    const requestsRef = collection(db, "users", currentUser.uid, "friendRequests");

    unsubscribeFriends = onSnapshot(friendsRef, snap => {
      const friends = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.__randomChessFriends = friends;
      renderFriends(friends, window.__randomChessRequests || []);
    }, () => {});

    unsubscribeRequests = onSnapshot(requestsRef, snap => {
      const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.__randomChessRequests = requests;
      renderFriends(window.__randomChessFriends || [], requests);
    }, () => {});
  }

  function renderFriends(friends = [], requests = []) {
    ensureOnlineUI();

    const friendList = document.getElementById("friendList");
    const requestList = document.getElementById("friendRequestList");

    if (requestList) {
      if (requests.length === 0) {
        requestList.innerHTML = `<div class="modalDesc">받은 요청 없음</div>`;
      } else {
        requestList.innerHTML = requests.map(req => `
          <div class="listItem">
            <b>${escapeHtml(req.fromName || "알 수 없음")}</b>
            <button onclick="Game.acceptFriend('${req.id}')">수락</button>
            <button onclick="Game.rejectFriend('${req.id}')">거절</button>
          </div>
        `).join("");
      }
    }

    if (friendList) {
      if (friends.length === 0) {
        friendList.innerHTML = `<div class="modalDesc">친구 없음</div>`;
      } else {
        friendList.innerHTML = friends.map(fr => `
          <div class="listItem">
            <b>${escapeHtml(fr.name || "친구")}</b>
            <button onclick="Game.inviteFriend('${fr.uid}')">초대</button>
          </div>
        `).join("");
      }
    }
  }

  async function addFriend() {
    if (!currentUser) {
      alert("먼저 로그인해라.");
      return;
    }

    const value = document.getElementById("friendSearchInput")?.value?.trim();
    if (!value) {
      alert("친구 닉네임 또는 이메일을 입력해라.");
      return;
    }

    try {
      const usersRef = collection(db, "users");

      const q1 = query(usersRef, where("nickname", "==", value));
      const q2 = query(usersRef, where("email", "==", value));

      const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const found = [...s1.docs, ...s2.docs]
        .map(d => d.data())
        .find(u => u.uid !== currentUser.uid);

      if (!found) {
        alert("해당 유저를 못 찾음. 상대가 먼저 한 번 로그인해야 검색됨.");
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
      const reqSnap = await getDoc(reqRef);

      if (!reqSnap.exists()) {
        alert("요청이 없음");
        return;
      }

      const req = reqSnap.data();

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
    } catch (err) {
      alert("친구 수락 실패: " + err.message);
    }
  }

  async function rejectFriend(requestId) {
    if (!currentUser) return;

    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "friendRequests", requestId));
    } catch (err) {
      alert("거절 실패: " + err.message);
    }
  }

  function inviteFriend(friendUid) {
    if (!roomCode) {
      alert("먼저 방을 만들거나 입장해라.");
      return;
    }

    alert("초대 링크:\n" + location.origin + `/?room=${encodeURIComponent(roomCode)}`);
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  onAuthStateChanged(auth, async user => {
    ensureOnlineUI();

    if (user) {
      currentUser = {
        uid: user.uid,
        name: user.displayName || user.email || "Google User",
        email: user.email || "",
        photoURL: user.photoURL || "",
        provider: "google"
      };

      try {
        await saveUserProfile();
        startFriendListeners();
      } catch (err) {
        console.log(err);
      }
    } else if (currentUser?.provider === "google") {
      currentUser = null;
      stopFriendListeners();
    }

    renderAccount();
  });

  function connectSocket(onOpen) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      onOpen?.();
      return;
    }

    if (ws) ws.close();

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
    if (data.type === "rooms") {
      roomList = data.rooms || [];
      renderRoomList();
      return;
    }

    if (data.type === "roomCreated") {
      roomCode = data.roomId || data.roomCode || data.id;
      if (roomCode) {
        joinOnlineById(roomCode, data.password || "");
      }
      return;
    }

    if (data.type === "waiting") {
      showGame();
      status("매칭 찾는 중...");
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
        const myReactionary = data.reactionary[myColor];

        if (myReactionary) {
          cardState.reactionaryActive = myReactionary.active;
          cardState.reactionaryRook = myReactionary.rook;
          cardState.reactionaryChecks = myReactionary.checks;
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
      if (data.color) {
        turn = data.color;
      }

      cardState.activeMode = "reactionaryPick";
      selected = null;
      moves = data.options || [];

      alert(data.message || "킹이 잡혔습니다. 반동분자로 왕룩을 선택하세요.");

      renderCard();
      render();
      return;
    }

    if (data.type === "gameover") {
      board = data.board;

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
      alert(data.message);
    }
  }

  function createNamedRoom() {
    const name = document.getElementById("roomNameInput")?.value?.trim() || "무제 방";
    const password = document.getElementById("roomPasswordInput")?.value || "";
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();

    connectSocket(() => {
      ws.send(JSON.stringify({
        type: "createRoom",
        roomId: id,
        roomName: name,
        password,
        user: currentUser
      }));

      setTimeout(() => {
        if (!roomCode) {
          roomCode = id;
          joinOnlineById(id, password);
        }
      }, 500);
    });
  }

  function refreshRooms() {
    ensureOnlineUI();

    connectSocket(() => {
      ws.send(JSON.stringify({
        type: "listRooms"
      }));
    });

    setTimeout(() => {
      if (roomList.length === 0) {
        const list = document.getElementById("roomList");
        if (list) {
          list.innerHTML = `<div class="modalDesc">서버가 방 목록을 지원하지 않으면 기존 방 코드 입장을 사용해야 함.</div>`;
        }
      }
    }, 800);
  }

  function renderRoomList() {
    const list = document.getElementById("roomList");
    if (!list) return;

    if (roomList.length === 0) {
      list.innerHTML = `<div class="modalDesc">열린 방 없음</div>`;
      return;
    }

    list.innerHTML = roomList.map(room => `
      <div class="listItem">
        <b>${escapeHtml(room.name || room.roomName || room.id || room.roomId)}</b>
        <span>${room.hasPassword ? "🔒" : "공개"}</span>
        <button onclick="Game.joinRoomFromList('${room.id || room.roomId}', ${room.hasPassword ? "true" : "false"})">입장</button>
      </div>
    `).join("");
  }

  function joinRoomFromList(id, hasPassword) {
    let password = "";

    if (hasPassword) {
      password = prompt("비밀번호 입력") || "";
    }

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

      ws.send(JSON.stringify({
        type: "join",
        roomId: id,
        password,
        user: currentUser
      }));
    });
  }

  function makeRoom() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const input = document.getElementById("roomInput");

    if (input) {
      input.value = code;
    }

    alert("방 코드: " + code);
    joinOnline();
  }

  function joinOnline() {
    const input = document.getElementById("roomInput")?.value.trim().toUpperCase();
    if (!input) return alert("방 코드를 입력해라.");

    joinOnlineById(input, "");
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
      wk:false, wrA:false, wrH:false,
      bk:false, brA:false, brH:false
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

          if (piece && piece[0] === turn[0]) {
            cell.classList.add("equalityCastleMove");
          }
        }

        if (cardState.activeMode === "equalityPickB") {
          const targets = getEqualityTargets();

          if (targets.some(pos => pos.r === r && pos.c === c)) {
            cell.classList.add("equalityCastleMove");
          }
        }

        if (cardState.activeMode === "exorcism") {
          const bishops = getExorcismBishopOptions();

          if (bishops.some(pos => pos.r === r && pos.c === c)) {
            cell.classList.add("exorcismCandidate");
          }
        }

        if (cardState.activeMode === "reactionaryPick") {
          const rooks = getReactionaryRookOptions();

          if (rooks.some(pos => pos.r === r && pos.c === c)) {
            cell.classList.add("reactionaryCandidate");
          }
        }

        if (cardState.activeMode === "spacePick") {
          const targets = getSpaceTravelPieces();

          if (targets.some(pos => pos.r === r && pos.c === c)) {
            cell.classList.add("spaceCandidate");
          }
        }

        if (cardState.activeMode === "necroPlace") {
          const places = getNecroPlaceMoves();

          if (places.some(pos => pos.r === r && pos.c === c)) {
            cell.classList.add("necroPlaceCandidate");
          }
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
          ) {
            return;
          }

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
        type:"move",
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
      promotionResolve = null;
      promotionResolve?.(piece);
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

      result.push({
        r: row,
        c: targetC,
        type: "equalityCastle"
      });
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
        res.push({
          r: nr,
          c: nc,
          type: kind
        });
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
          res.push({
            r: r + dir,
            c: c + dc,
            type: "enPassant"
          });
        }
      }
    }

    if (type === "n") {
      if (cardState.wildHorse) {
        return getWildHorseMoves(r, c, board, color);
      }

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

        if (mode === "bn") {
          slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
        }

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
