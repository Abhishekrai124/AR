const statusNode = document.querySelector("#makimaStatus");
const dashboard = document.querySelector("#makimaDashboard");
const canvas = document.querySelector("#brainCanvas");
const context = canvas.getContext("2d");
let graph = { nodes: [], edges: [], episodes: [] };
let selectedNode = null;
let mode = "teach";
let sessionToken = "";

function setStatus(message, error = false) {
  statusNode.textContent = message;
  statusNode.closest(".makima-status-chip").classList.toggle("is-error", error);
}

async function coreRequest(action, data = {}) {
  const response = await fetch("/api/makima-core", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ action, ...data }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Brain Studio request failed.");
  return result;
}

function nodePositions(nodes) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const radius = Math.min(width, height) * 0.39;
  return new Map(nodes.map((node, index) => {
    const ring = Math.floor(Math.sqrt(index));
    const inRing = Math.max(1, ring * 2 + 1);
    const slot = index - ring * ring;
    const angle = -Math.PI / 2 + (slot / inRing) * Math.PI * 2 + ring * 0.28;
    const distance = radius * (ring === 0 ? 0.28 : Math.min(1, 0.36 + ring * 0.13));
    return [node.id, { x: width / 2 + Math.cos(angle) * distance, y: height / 2 + Math.sin(angle) * distance }];
  }));
}

function drawGraph() {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  const nodes = graph.nodes.slice(0, 70);
  const positions = nodePositions(nodes);
  for (const edge of graph.edges) {
    const from = positions.get(edge.source_node), to = positions.get(edge.target_node);
    if (!from || !to) continue;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.strokeStyle = edge.weight < 0 ? `rgba(242, 139, 112, ${Math.min(.62, .18 + Math.abs(edge.weight))})` : `rgba(99, 210, 170, ${Math.min(.72, .2 + edge.weight)})`;
    context.lineWidth = 1 + Math.abs(edge.weight) * 3;
    context.stroke();
  }
  nodes.forEach((node, index) => {
    const point = positions.get(node.id);
    const radius = 5 + Math.min(6, Math.log2(Number(node.activation_count) + 1));
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = node.id === selectedNode ? "#f4c76b" : `hsl(${145 + (index * 23) % 70} 48% 62%)`;
    context.fill();
    context.fillStyle = "#d8e3dd";
    context.font = "11px Manrope, sans-serif";
    context.textAlign = "center";
    context.fillText(node.token.slice(0, 16), point.x, point.y + radius + 14);
  });
}

function renderGraph() {
  document.querySelector("#nodeMetric").textContent = graph.nodes.length;
  document.querySelector("#edgeMetric").textContent = graph.edges.length;
  document.querySelector("#episodeMetric").textContent = graph.episodes.length;
  const strength = graph.edges.length ? graph.edges.reduce((sum, edge) => sum + Math.abs(Number(edge.weight)), 0) / graph.edges.length : 0;
  document.querySelector("#strengthMetric").textContent = strength.toFixed(2);
  document.querySelector("#graphCount").textContent = `${Math.min(70, graph.nodes.length)} of ${graph.nodes.length} nodes shown`;
  document.querySelector("#episodeCount").textContent = graph.episodes.length;

  const episodes = document.querySelector("#episodeList");
  episodes.replaceChildren();
  if (!graph.episodes.length) {
    const empty = document.createElement("li"); empty.className = "makima-empty"; empty.textContent = "No training records yet."; episodes.append(empty);
  } else {
    graph.episodes.forEach((episode) => {
      const item = document.createElement("li");
      const heading = document.createElement("div"); heading.className = "makima-episode-meta";
      const event = document.createElement("strong"); event.textContent = episode.event_type;
      const date = document.createElement("time"); date.dateTime = episode.created_at; date.textContent = new Date(episode.created_at).toLocaleString();
      const content = document.createElement("p"); content.textContent = episode.content;
      heading.append(event, date); item.append(heading, content); episodes.append(item);
    });
  }
  const chosen = graph.nodes.find((node) => node.id === selectedNode);
  document.querySelector("#selectedNodeLabel").textContent = chosen?.token || "Choose a node";
  document.querySelector("#selectedNodeInfo").textContent = chosen ? `Activated ${chosen.activation_count} times. Local feature vector: ${chosen.embedding?.length || 0} dimensions.` : "Node vectors have 32 locally generated features. No user activity is ingested automatically.";
  document.querySelector("#reinforceNode").disabled = !chosen;
  document.querySelector("#correctNode").disabled = !chosen;
  drawGraph();
}

async function loadGraph() {
  graph = await coreRequest("snapshot");
  if (!graph.nodes.some((node) => node.id === selectedNode)) selectedNode = null;
  renderGraph();
  dashboard.hidden = false;
  setStatus("Owner verified · explicit training only");
}

canvas.addEventListener("click", (event) => {
  const bounds = canvas.getBoundingClientRect();
  const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  const positions = nodePositions(graph.nodes.slice(0, 70));
  const hit = graph.nodes.slice(0, 70).find((node) => {
    const spot = positions.get(node.id);
    return spot && Math.hypot(spot.x - point.x, spot.y - point.y) < 18;
  });
  selectedNode = hit?.id || null;
  renderGraph();
});

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
  mode = button.dataset.mode;
  document.querySelectorAll("[data-mode]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
}));

async function submitLearning(text, action = mode) {
  const trainingStatus = document.querySelector("#trainingStatus");
  trainingStatus.textContent = "Updating the owner-taught graph…";
  try {
    const result = await coreRequest(action, { text });
    trainingStatus.textContent = `${result.learnedNodes} nodes activated; ${result.updatedEdges} links updated.`;
    await loadGraph();
  } catch (error) {
    trainingStatus.textContent = error.message;
  }
}

document.querySelector("#makimaTrainingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = document.querySelector("#trainingText").value.trim();
  if (text) await submitLearning(text);
});

function signalSelectedNode(action) {
  const node = graph.nodes.find((item) => item.id === selectedNode);
  if (!node) return;
  const neighbors = graph.edges
    .filter((edge) => edge.source_node === node.id || edge.target_node === node.id)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 4)
    .map((edge) => graph.nodes.find((item) => item.id === (edge.source_node === node.id ? edge.target_node : edge.source_node))?.token)
    .filter(Boolean);
  submitLearning(`Node ${[node.token, ...neighbors].join(" ")}`, action);
}
document.querySelector("#reinforceNode").addEventListener("click", () => signalSelectedNode("reinforce"));
document.querySelector("#correctNode").addEventListener("click", () => signalSelectedNode("correct"));

document.querySelector("#micButton").addEventListener("click", () => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const trainingStatus = document.querySelector("#trainingStatus");
  if (!Recognition) { trainingStatus.textContent = "This browser does not support speech recognition. Type the training phrase instead."; return; }
  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "hi-IN";
  trainingStatus.textContent = "Listening once. Speak a short training phrase.";
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    const input = document.querySelector("#trainingText");
    input.value = `${input.value}${input.value ? "\n" : ""}${transcript}`.slice(0, 1000);
    trainingStatus.textContent = "Transcript added for review. It has not been saved.";
  };
  recognition.onerror = () => { trainingStatus.textContent = "Speech input was unavailable. You can type instead."; };
  recognition.start();
});

new ResizeObserver(drawGraph).observe(canvas);
window.arraiAuth.then(async ({ isAuthenticated }) => {
  if (!isAuthenticated) return window.location.assign("auth.html");
  try {
    const { data: { session } } = await window.arraiSupabase.auth.getSession();
    sessionToken = session?.access_token || "";
    await loadGraph();
  } catch (error) {
    setStatus(error.message || "Owner verification failed.", true);
  }
}).catch(() => setStatus("Could not verify sign-in.", true));