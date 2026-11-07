const supabaseUrl = String(process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co").trim();
const anonKey = String(process.env.SUPABASE_ANON_KEY || "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l").trim();
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function adminHeaders() {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
}

async function readJson(response) {
  const raw = await response.text();
  try { return JSON.parse(raw); } catch { return {}; }
}

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  if (!supabaseUrl || !anonKey || !serviceKey) return response.status(503).json({ error: "Wallet storage is not configured. Add the Supabase server environment variables and redeploy." });

  const bearer = request.headers.authorization || "";
  if (!bearer.startsWith("Bearer ")) return response.status(401).json({ error: "Please sign in to access your ledger." });
  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: bearer } });
    const user = await readJson(authResponse);
    if (!authResponse.ok || !user.id) return response.status(401).json({ error: "Your session could not be verified." });

    let rpcName = "wallet_read_snapshot";
    let rpcBody = { p_user_id: user.id };
    if (request.method === "POST") {
      const body = typeof request.body === "string" ? (() => { try { return JSON.parse(request.body); } catch { return {}; } })() : request.body || {};
      const type = String(body.type || "");
      const amount = Number(body.amount);
      const category = String(body.category || "General").trim();
      const description = String(body.description || "").trim();
      const idempotencyKey = String(body.idempotencyKey || "");
      if (!["income", "expense"].includes(type)) return response.status(400).json({ error: "Choose income or expense." });
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000 || Math.round(amount * 100) / 100 !== amount) return response.status(400).json({ error: "Enter an amount up to ₹10,000,000 with no more than two decimals." });
      if (!description || description.length > 100 || !category || category.length > 40) return response.status(400).json({ error: "Add a description and valid category." });
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)) return response.status(400).json({ error: "A valid transaction request ID is required." });
      rpcName = "wallet_post_entry";
      rpcBody = { p_user_id: user.id, p_type: type, p_amount_minor: Math.round(amount * 100), p_description: description, p_category: category, p_idempotency_key: idempotencyKey };
    }

    const result = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, { method: "POST", headers: adminHeaders(), body: JSON.stringify(rpcBody) });
    const data = await readJson(result);
    if (!result.ok) {
      if (result.status === 409 || data.code === "P0001") return response.status(409).json({ error: data.message || "This expense exceeds the recorded balance." });
      return response.status(502).json({ error: "Could not load or update your ledger. Confirm the wallet migration has been applied." });
    }
    return response.status(200).json(data);
  } catch {
    return response.status(502).json({ error: "The wallet service is temporarily unavailable." });
  }
}