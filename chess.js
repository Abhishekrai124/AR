const pieces = {
  r: "♜",
  n: "♞",
  b: "♝",
  q: "♛",
  k: "♚",
  p: "♟",
  R: "♖",
  N: "♘",
  B: "♗",
  Q: "♕",
  K: "♔",
  P: "♙",
};
let board,
  turn,
  selected,
  flipped = false,
  mode = "local",
  stats = JSON.parse(
    localStorage.getItem("arraiChessStats") ||
      '{"wins":0,"losses":0,"games":0,"rating":800}',
  );
const start =
  "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR";
const el = (id) => document.getElementById(id);
const isWhite = (p) => p && p === p.toUpperCase();
const nameOf = (p) =>
  p ? ("prnbqk".includes(p.toLowerCase()) ? p.toLowerCase() : null) : null;
function init() {
  board = start.split("");
  turn = "white";
  selected = null;
  render();
  message("White to move");
}
function render() {
  const root = el("chessBoard");
  root.innerHTML = "";
  const order = [...Array(64).keys()];
  if (flipped) order.reverse();
  order.forEach((i) => {
    const r = Math.floor(i / 8),
      c = i % 8,
      p = board[i],
      btn = document.createElement("button");
    btn.className = `square ${(r + c) % 2 ? "dark" : "light"}`;
    btn.dataset.i = i;
    btn.innerHTML = `<span class="${isWhite(p) ? "white-piece" : "black-piece"}">${pieces[p] || ""}</span>${c === 0 ? `<small class="coord">${8 - r}</small>` : ""}${r === 7 ? `<small class="coord" style="left:auto;right:3px;bottom:auto;top:2px">${"abcdefgh"[c]}</small>` : ""}`;
    if (selected === i) btn.classList.add("selected");
    if (selected !== null && legal(selected, i))
      btn.classList.add(board[i] ? "capture" : "move");
    btn.onclick = () => clickSquare(i);
    root.append(btn);
  });
  el("whiteTurn").classList.toggle("current", turn === "white");
  el("blackTurn").classList.toggle("current", turn === "black");
}
function pathClear(a, b) {
  const ar = Math.floor(a / 8),
    ac = a % 8,
    br = Math.floor(b / 8),
    bc = b % 8,
    dr = Math.sign(br - ar),
    dc = Math.sign(bc - ac);
  let r = ar + dr,
    c = ac + dc;
  while (r !== br || c !== bc) {
    if (board[r * 8 + c]) return false;
    r += dr;
    c += dc;
  }
  return true;
}
function legal(a, b) {
  const p = board[a];
  if (
    !p ||
    a === b ||
    isWhite(p) !== (turn === "white") ||
    (board[b] && isWhite(board[b]) === isWhite(p))
  )
    return false;
  const ar = Math.floor(a / 8),
    ac = a % 8,
    br = Math.floor(b / 8),
    bc = b % 8,
    dr = br - ar,
    dc = bc - ac,
    kind = p.toLowerCase();
  if (kind === "n") return Math.abs(dr) * Math.abs(dc) === 2;
  if (kind === "k") return Math.max(Math.abs(dr), Math.abs(dc)) === 1;
  if (kind === "r") return (dr === 0 || dc === 0) && pathClear(a, b);
  if (kind === "b") return Math.abs(dr) === Math.abs(dc) && pathClear(a, b);
  if (kind === "q")
    return (
      (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) && pathClear(a, b)
    );
  if (kind === "p") {
    const d = isWhite(p) ? -1 : 1,
      startRow = isWhite(p) ? 6 : 1;
    if (
      dc === 0 &&
      !board[b] &&
      (dr === d ||
        (ar === startRow && dr === 2 * d && !board[(ar + d) * 8 + ac]))
    )
      return true;
    return Math.abs(dc) === 1 && dr === d && !!board[b];
  }
  return false;
}
function clickSquare(i) {
  const p = board[i];
  if (selected === null) {
    if (p && isWhite(p) === (turn === "white")) {
      selected = i;
      render();
    }
    return;
  }
  if (i === selected) {
    selected = null;
    render();
    return;
  }
  if (legal(selected, i)) {
    move(selected, i);
    return;
  }
  if (p && isWhite(p) === (turn === "white")) {
    selected = i;
    render();
  } else {
    selected = null;
    render();
  }
}
function move(a, b) {
  const captured = board[b],
    piece = board[a];
  board[b] = piece;
  board[a] = "";
  if (piece.toLowerCase() === "p" && (b < 8 || b > 55))
    board[b] = isWhite(piece) ? "Q" : "q";
  selected = null;
  if (captured && captured.toLowerCase() === "k") {
    finish(turn === "white" ? "win" : "loss");
    return;
  }
  turn = turn === "white" ? "black" : "white";
  message(`${turn[0].toUpperCase() + turn.slice(1)} to move`);
  render();
  if (mode === "bot" && turn === "black") setTimeout(botMove, 400);
}
function botMove() {
  const moves = [];
  board.forEach((p, a) => {
    if (p && !isWhite(p))
      board.forEach((_, b) => {
        if (legal(a, b)) moves.push([a, b]);
      });
  });
  if (moves.length) {
    const captures = moves.filter((x) => board[x[1]]);
    move(...(captures[0] || moves[Math.floor(Math.random() * moves.length)]));
  }
}
function finish(result) {
  stats.games++;
  if (result === "win") {
    stats.wins++;
    stats.rating += 12;
    message("Checkmate! You win ✦");
  } else {
    stats.losses++;
    stats.rating = Math.max(100, stats.rating - 8);
    message("Game over — try again ♡");
  }
  saveStats();
  render();
}
function saveStats() {
  localStorage.setItem("arraiChessStats", JSON.stringify(stats));
  el("wins").textContent = stats.wins;
  el("losses").textContent = stats.losses;
  el("games").textContent = stats.games;
  el("rating").textContent = stats.rating;
}
function message(t) {
  el("gameMessage").textContent = t;
}
el("newGame").onclick = init;
el("flipBoard").onclick = () => {
  flipped = !flipped;
  render();
};
document.querySelectorAll(".mode").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll(".mode")
        .forEach((x) => x.classList.remove("active-mode"));
      b.classList.add("active-mode");
      mode = b.dataset.mode;
      el("modeNote").textContent =
        mode === "bot"
          ? "A simple practice bot plays Black."
          : "Pass the board to play with a friend.";
      init();
    }),
);
el("showAuth").onclick = () => {
  window.location.href = "auth.html?next=chess";
};
el("signOut").onclick = () => {
  localStorage.removeItem("arraiChessUser");
  window.logout();
};
function setProfile(user = null) {
  const name = user?.name || localStorage.getItem("arraiChessUser");
  el("guestView").hidden = !!name;
  el("memberView").hidden = !name;
  if (name) {
    el("playerName").textContent = name;
    el("whiteName").textContent = name;
    el("avatarLetter").textContent = name[0].toUpperCase();
  }
}
["googleConnect", "chessConnect"].forEach(
  (id) =>
    (el(id).onclick = () =>
      alert(
        "This connection needs a secure OAuth backend and app credentials before it can be activated. Your existing accounts are never requested or stored here.",
      )),
);
window.arraiAuth
  .catch(() => ({ isAuthenticated: false, user: null }))
  .then(({ isAuthenticated, user }) => {
    saveStats();
    setProfile(isAuthenticated ? user : null);
    init();
  });
