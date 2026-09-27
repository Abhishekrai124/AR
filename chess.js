import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

const pieces = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

let game;
let flipped = false;
let mode = "local";
let botTimer;
let draggedFrom = "";
let soundOn = true;
let onlineChannel = null;
let onlineColor = null;
const audioContext = window.AudioContext || window.webkitAudioContext;
let stats = JSON.parse(localStorage.getItem("arraiChessStats") || '{"wins":0,"losses":0,"games":0,"rating":800}');

const el = (id) => document.getElementById(id);
const boardElement = () => el("chessBoard");

// Tiny browser-made sound effects keep the board alive without shipping
// copyrighted audio files: a soft tap for moves, a brighter note for checks,
// and a gentle low chord when the king finally runs out of excuses. ♫
function playSound(kind = "move") {
  if (!soundOn || !audioContext) return;
  const context = new audioContext();
  const notes = { move: [440], capture: [330, 494], check: [660, 880], mate: [523, 659, 784] };
  const now = context.currentTime;
  notes[kind].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind === "mate" ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + index * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.08, now + index * 0.07 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.07 + 0.28);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now + index * 0.07);
    oscillator.stop(now + index * 0.07 + 0.3);
  });
}

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
    button.draggable = Boolean(piece && piece.color === currentTurn && !(mode === "online" && onlineColor !== currentTurn));
    button.addEventListener("dragstart", () => {
      draggedFrom = square;
      button.classList.add("dragging");
    });
    button.addEventListener("dragend", () => {
      draggedFrom = "";
      button.classList.remove("dragging");
    });
    button.addEventListener("dragover", (event) => event.preventDefault());
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      if (draggedFrom) playMove(draggedFrom, square);
    });
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
  if (mode === "online" && onlineColor !== game.turn()) {
    message("Your friend is thinking — no stealing their turn, sweet cheater. 😄", "error");
    return;
  }
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
  if (mode === "online" && onlineColor !== game.turn()) {
    message("Your friend is thinking — no stealing their turn, sweet cheater. 😄", "error");
    return;
  }
  const movingPiece = game.get(from);
  let promotion = "q";
  if (movingPiece?.type === "p" && (to.endsWith("8") || to.endsWith("1"))) {
    const choice = window.prompt("Promotion time: choose q, r, b or n", "q")?.toLowerCase();
    promotion = ["q", "r", "b", "n"].includes(choice) ? choice : "q";
  }

  try {
    const played = game.move({ from, to, promotion });
    playSound(played.captured ? "capture" : "move");
    if (mode === "online") onlineChannel?.send({ type: "broadcast", event: "move", payload: { from, to, promotion } });
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
  if (game.isCheck()) playSound("check");
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
      playSound("mate");
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

function applyRemoteMove({ from, to, promotion = "q" }) {
  if (mode !== "online" || game.isGameOver() || game.turn() === onlineColor) return;
  try {
    const move = game.move({ from, to, promotion });
    playSound(move.captured ? "capture" : "move");
    delete boardElement().dataset.selected;
    render();
    finishOrContinue();
  } catch {
    message("That online move did not arrive cleanly. The board kept your game safe.", "error");
  }
}

async function joinOnlineRoom() {
  const code = el("roomCode").value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 12);
  if (!code || !window.arraiSupabase) {
    el("roomStatus").textContent = "A room code and a live Supabase connection are needed.";
    return;
  }
  onlineChannel?.unsubscribe();
  onlineChannel = window.arraiSupabase.channel(`arrai-chess:${code}`, {
    config: { broadcast: { self: false }, presence: { key: crypto.randomUUID() } },
  });
  onlineChannel
    .on("broadcast", { event: "move" }, ({ payload }) => applyRemoteMove(payload))
    .on("broadcast", { event: "state-request" }, () => {
      onlineChannel.send({ type: "broadcast", event: "state", payload: { fen: game.fen() } });
    })
    .on("broadcast", { event: "state" }, ({ payload }) => {
      if (game.history().length || !payload?.fen) return;
      try {
        game.load(payload.fen);
        render();
        message(`${game.turn() === "w" ? "White" : "Black"} to move — the board caught up with the conversation.`);
      } catch {
        message("The room sent a board state I could not read, so this game stayed safe.", "error");
      }
    })
    .on("presence", { event: "sync" }, () => {
      const members = Object.keys(onlineChannel.presenceState()).sort();
      onlineColor = members.indexOf(onlineChannel.presenceKey) === 0 ? "w" : "b";
      el("roomStatus").textContent = members.length > 2
        ? "Room is full — this little board only seats two players."
        : `Connected as ${onlineColor === "w" ? "White" : "Black"} · share the code with your friend.`;
      render();
    });
  await onlineChannel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await onlineChannel.track({ joinedAt: Date.now() });
      onlineChannel.send({ type: "broadcast", event: "state-request", payload: {} });
      el("roomStatus").textContent = "Room joined. Waiting for your favourite opponent…";
    }
  });
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
    el("onlineRoom").hidden = mode !== "online";
    el("modeNote").textContent = mode === "bot"
      ? "A tiny practice bot plays Black. It has no feelings, allegedly."
      : mode === "online"
        ? "Join the same room from two browsers and let the board carry the conversation."
        : "Pass the board to a friend and see who forgives the blunders first.";
    init();
  });
});

el("joinRoom")?.addEventListener("click", joinOnlineRoom);
el("copyRoomLink")?.addEventListener("click", async () => {
  const code = el("roomCode").value.trim();
  if (!code) return message("Give the room a name first — even love letters need an address.");
  const link = `${location.origin}${location.pathname}?room=${encodeURIComponent(code)}`;
  await navigator.clipboard.writeText(link);
  el("roomStatus").textContent = "Invite link copied. Now send it to your favourite rival. 💌";
});
el("soundToggle")?.addEventListener("click", () => {
  soundOn = !soundOn;
  el("soundToggle").textContent = soundOn ? "🔊 Sound on" : "🔇 Sound off";
  el("soundToggle").setAttribute("aria-pressed", String(soundOn));
  if (soundOn) playSound("move");
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
    const room = new URLSearchParams(location.search).get("room");
    if (room) {
      mode = "online";
      document.querySelector('[data-mode="online"]')?.click();
      el("roomCode").value = room;
      joinOnlineRoom();
    }
  });
