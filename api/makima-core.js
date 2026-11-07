const supabaseUrl = String(process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co").trim();
const anonKey = String(process.env.SUPABASE_ANON_KEY || "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l").trim();
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const stopWords = new Set(["the", "and", "for", "with", "that", "this", "you", "your", "are", "was", "when", "what", "from", "have", "will", "into", "mein", "mera", "meri", "hai", "hain", "kar", "karo", "node", "reinforce", "correct", "concept"]);
const httpError = (message, status) => Object.assign(new Error(message), { status });

async function readJson(response) {
  const raw = await response.text();
  try { return JSON.parse(raw); } catch { return {}; }
}

async function verifyOwner(request) {
  const bearer = request.headers.authorization || "";
  if (!bearer.startsWith("Bearer ")) throw httpError("Sign in to open Brain Studio.", 401);
  if (!serviceKey) throw httpError("Brain Studio needs SUPABASE_SERVICE_ROLE_KEY on the server.", 503);
  const auth = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: bearer } });
  const user = await readJson(auth);
  const ownerEmail = String(process.env.OWNER_EMAIL || "abhishekrai6897@gmail.com").toLowerCase();
  if (!auth.ok || !user.id) throw httpError("Your session could not be verified.", 401);
  if (String(user.email || "").toLowerCase() !== ownerEmail) throw httpError("Brain Studio is limited to the verified owner account.", 403);
  return user;
}

function tokenize(text) {
  return [...new Set((String(text).toLowerCase().match(/[a-z0-9\u0900-\u097f]+/g) || []).filter((word) => word.length > 1 && !stopWords.has(word)))].slice(0, 20);
}

function embed(tokens) {
  const vector = Array(32).fill(0);
  for (const token of tokens) {
    const padded = `^${token}$`;
    for (let index = 0; index < padded.length - 1; index += 1) {
      let hash = 2166136261;
      const gram = padded.slice(index, index + 2);
      for (let char = 0; char < gram.length; char += 1) hash = Math.imul(hash ^ gram.charCodeAt(char), 16777619) >>> 0;
      vector[hash % vector.length] += hash & 0x80000000 ? -1 : 1;
    }
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

async function callRpc(name, body) {
  const result = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson(result);
  if (!result.ok) throw new Error(data.message || "Brain storage is unavailable. Apply the Makima migration first.");
  return data;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  let owner;
  try { owner = await verifyOwner(request); }
  catch (error) { return response.status(error.status || 502).json({ error: error.message || "Owner verification is unavailable." }); }

  const body = typeof request.body === "string" ? (() => { try { return JSON.parse(request.body); } catch { return {}; } })() : request.body || {};
  try {
    if (body.action === "snapshot") {
      return response.status(200).json(await callRpc("makima_brain_snapshot", { p_owner_id: owner.id }));
    }
    if (body.action === "recall") {
      const text = String(body.text || "").trim().slice(0, 500);
      const tokens = tokenize(text);
      if (!tokens.length) return response.status(400).json({ error: "Add a query with recognizable terms." });
      return response.status(200).json(await callRpc("makima_brain_recall", { p_owner_id: owner.id, p_embedding: embed(tokens) }));
    }
    if (!["teach", "reinforce", "correct"].includes(body.action)) return response.status(400).json({ error: "Choose teach, reinforce, or correct." });
    const text = String(body.text || "").trim().slice(0, 1000);
    const tokens = tokenize(text);
    if (text.length < 3 || !tokens.length) return response.status(400).json({ error: "Add a short phrase with at least one recognizable term." });
    const reward = body.action === "correct" ? -1 : 1;
    const result = await callRpc("makima_learn", {
      p_owner_id: owner.id,
      p_memory: text,
      p_terms: tokens.map((token) => ({ token, embedding: embed([token]) })),
      p_episode_embedding: embed(tokens),
      p_reward: reward,
      p_event_type: body.action,
    });
    return response.status(200).json(result);
  } catch (error) {
    return response.status(502).json({ error: error.message || "Brain storage is temporarily unavailable." });
  }
}