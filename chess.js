import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

const pieces = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

let game;
let flipped = false;
let mode = "local";
let botTimer;
let stats = JSON.parse(localStorage.getItem("arraiChessStats") || '{"wins":0,"losses":0,"games":0,"rating":800}');

const el = (id) => document.getElementById(id);
const boardElement = () => el("chessBoard");

// chess.js owns the difficult truth of chess. This page owns the friendly board,
// buttons and feelings; the library prevents illegal king adventures for us. ♟
function init() {
  clearTimeout(botTimer);
  game = new Chess();
  delete boardElement().dataset.selected;
  render();
  message("White to move — may your first move be less awkward than a first text.");
}

function squareName(row, column) {
  return `${"abcdefgh"[column]}${8 - row}`;
}

function boardOrder() {
  const squares = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) squares.push({ row, column });
  }
  return flipped ? squares.reverse() : squares;
}

function legalTargets(square) {
  return game.moves({ square, verbose: true }).map((move) => move.to);
}

function render() {
  const root = boardElement();
  const currentTurn = game.turn();
  const selectedSquare = root.dataset.selected || "";
  const targets = selectedSquare ? legalTargets(selectedSquare) : [];
  const lastMove = game.history({ verbose: true }).at(-1);
  root.innerHTML = "";

  boardOrder().forEach(({ row, column }) => {
    const square = squareName(row, column);
    const piece = game.get(square);
    const button = document.createElement("button");
    const isLastMove = lastMove && [lastMove.from, lastMove.to].includes(square);

    button.className = `square ${(row + column) % 2 ? "dark" : "light"}`;
    button.dataset.square = square;
    if (square === selectedSquare) button.classList.add("selected");
    if (isLastMove) button.classList.add("last-move");
    if (targets.includes(square)) button.classList.add(piece ? "capture" : "move");
    if (game.isCheck() && piece?.type === "k" && piece.color === currentTurn) button.classList.add("in-check");

    const fileLabel = row === 7 ? `<small class="coord file">${"abcdefgh"[column]}</small>` : "";
    const rankLabel = column === 0 ? `<small class="coord rank">${8 - row}</small>` : "";
    button.innerHTML = `${piece ? `<span class="${piece.color === "w" ? "white-piece" : "black-piece"}">${pieces[piece.color][piece.type]}</span>` : ""}${rankLabel}${fileLabel}`;
    button.addEventListener("click", () => clickSquare(square));
    root.append(button);
  });

  el("whiteTurn").classList.toggle("current", currentTurn === "w");
  el("blackTurn").classList.toggle("current", currentTurn === "b");
  renderHistory();
}

function clickSquare(square) {
  if (game.isGameOver() || (mode === "bot" && game.turn() === "b")) return;
  const selectedSquare = boardElement().dataset.selected || "";
  const piece = game.get(square);

  if (!selectedSquare) {
    if (piece?.color === game.turn()) {
      boardElement().dataset.selected = square;
      render();
    }
    return;
  }
  if (square === selectedSquare) {
    delete boardElement().dataset.selected;
    render();
    return;
  }
  if (piece?.color === game.turn()) {
    boardElement().dataset.selected = square;
    render();
    return;
  }

  const move = game.moves({ square: selectedSquare, verbose: true }).find((item) => item.to === square);
  if (!move) {
    delete boardElement().dataset.selected;
    message("That move is not legal — chess has boundaries, darling.", "error");
    render();
    return;
  }
  playMove(selectedSquare, square);
}

function playMove(from, to) {
  const movingPiece = game.get(from);
  let promotion = "q";
  if (movingPiece?.type === "p" && (to.endsWith("8") || to.endsWith("1"))) {
    const choice = window.prompt("Promotion time: choose q, r, b or n", "q")?.toLowerCase();
    promotion = ["q", "r", "b", "n"].includes(choice) ? choice : "q";
  }

  try {
    game.move({ from, to, promotion });
  } catch {
    message("The board rejected that move. Even queens have standards.", "error");
    return;
  }
  delete boardElement().dataset.selected;
  render();
  finishOrContinue();
}

function finishOrContinue() {
  if (game.isGameOver()) return finishGame();
  const side = game.turn() === "w" ? "White" : "Black";
  message(`${side} to move${game.isCheck() ? " — check, the king is having a dramatic moment." : ""}`);
  if (mode === "bot" && game.turn() === "b") botTimer = setTimeout(botMove, 450);
}

function botMove() {
  if (game.isGameOver() || game.turn() !== "b") return;
  const moves = game.moves({ verbose: true });
  const move = moves.find((item) => item.captured) || moves[Math.floor(Math.random() * moves.length)];
  if (!move) return;
  game.move({ from: move.from, to: move.to, promotion: "q" });
  render();
  finishOrContinue();
}

function finishGame() {
  stats.games += 1;
  if (game.isCheckmate()) {
    const winner = game.turn() === "b" ? "w" : "b";
    const playerWon = mode === "local" || winner === "w";
    if (playerWon) {
      stats.wins += 1;
      stats.rating += 12;
      message("Checkmate! The king has been politely escorted off the board. You win ✦");
    } else {
      stats.losses += 1;
      stats.rating = Math.max(100, stats.rating - 8);
      message("Checkmate. A little heartbreak, a lot of practice. ♡");
    }
  } else if (game.isDraw()) {
    message("Draw game — nobody won, nobody got rejected. Very mature of you.");
  }
  saveStats();
  render();
}

function renderHistory() {
  const list = el("moveHistory");
  if (!list) return;
  const history = game.history();
  list.innerHTML = history.map((move, index) => index % 2 === 0 ? `<li>${Math.floor(index / 2) + 1}. ${move}</li>` : `<li>${move}</li>`).join("");
}

function saveStats() {
  localStorage.setItem("arraiChessStats", JSON.stringify(stats));
  el("wins").textContent = stats.wins;
  el("losses").textContent = stats.losses;
  el("games").textContent = stats.games;
  el("rating").textContent = stats.rating;
}

function message(text, type = "") {
  el("gameMessage").textContent = text;
  el("gameMessage").className = type;
  renderHistory();
}

el("newGame").addEventListener("click", init);
el("undoMove")?.addEventListener("click", () => {
  if (!game.history().length) return message("Nothing to undo. The past is empty for now.");
  game.undo();
  if (mode === "bot" && game.history().length) game.undo();
  delete boardElement().dataset.selected;
  render();
  message(`${game.turn() === "w" ? "White" : "Black"} to move — second chances are allowed here.`);
});
el("flipBoard").addEventListener("click", () => {
  flipped = !flipped;
  render();
});
el("copyPgn").addEventListener("click", async () => {
  const pgn = game.pgn() || "*";
  try {
    await navigator.clipboard.writeText(pgn);
    message("PGN copied. A tiny souvenir of the battle ✦");
  } catch {
    message(`PGN: ${pgn}`);
  }
});

document.querySelectorAll(".mode").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach((item) => item.classList.remove("active-mode"));
    button.classList.add("active-mode");
    mode = button.dataset.mode;
    el("modeNote").textContent = mode === "bot" ? "A tiny practice bot plays Black. It has no feelings, allegedly." : "Pass the board to a friend and see who forgives the blunders first.";
    init();
  });
});

el("showAuth").addEventListener("click", () => { window.location.href = "auth.html?next=chess"; });
el("signOut").addEventListener("click", () => { localStorage.removeItem("arraiChessUser"); window.logout(); });

function setProfile(user = null, profile = {}) {
  const name = profile.display_name || user?.name || localStorage.getItem("arraiChessUser");
  el("guestView").hidden = Boolean(name);
  el("memberView").hidden = !name;
  if (!name) return;
  el("playerName").textContent = profile.username ? `${name} @${profile.username}` : name;
  el("whiteName").textContent = profile.username ? `@${profile.username}` : name;
  el("avatarLetter").textContent = name[0].toUpperCase();
}

// OAuth buttons stay honest until provider credentials exist; pretending a
// connection worked would be more embarrassing than hanging a queen. ♛
["googleConnect", "chessConnect"].forEach((id) => {
  el(id).addEventListener("click", () => alert("This connection needs secure OAuth credentials before it can be activated."));
});

window.arraiAuth
  .catch(() => ({ isAuthenticated: false, user: null }))
  .then(async ({ isAuthenticated, user }) => {
    saveStats();
    if (isAuthenticated && window.arraiSupabase) {
      const { data: chessProfile } = await window.arraiSupabase.from("profiles").select("display_name,username,avatar_url").eq("id", user.id).maybeSingle();
      setProfile(user, chessProfile || {});
    } else {
      setProfile(null);
    }
    init();
  });
