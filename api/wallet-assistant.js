const supabaseUrl = String(process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co").trim();
const anonKey = String(process.env.SUPABASE_ANON_KEY || "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l").trim();
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const systemInstruction = `You are AR Wallet Guide, a concise assistant for a personal finance ledger. The ledger contains user-entered records, not verified bank data or spendable funds. Never imply that a transaction was sent, received, or verified. Explain trends neutrally, do not provide individualized investment, tax, lending, or legal advice, and never request credentials or payment details. Use the read-only tools when ledger facts are needed. Do not invent missing data. Keep answers under 120 words.`;
const tools = [{ functionDeclarations: [
  { name: "get_wallet_summary", description: "Read the current recorded balance and income/expense totals for this month.", parameters: { type: "OBJECT", properties: {} } },
  { name: "analyze_spending", description: "Aggregate manually recorded expenses by category for this month or all returned history.", parameters: { type: "OBJECT", properties: { period: { type: "STRING", enum: ["this_month", "all_time"] } }, required: ["period"] } },
  { name: "get_recent_entries", description: "Read a few recent user-entered records to answer questions about activity.", parameters: { type: "OBJECT", properties: { limit: { type: "INTEGER" } }, required: ["limit"] } },
] }];

async function json(response) {
  const raw = await response.text();
  try { return JSON.parse(raw); } catch { return {}; }
}

function runTool(name, args, snapshot) {
  const entries = Array.isArray(snapshot.transactions) ? snapshot.transactions : [];
  if (name === "get_wallet_summary") {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const currentMonth = entries.filter((entry) => new Date(entry.created_at) >= monthStart);
    const sum = (type) => currentMonth.filter((entry) => entry.type === type).reduce((total, entry) => total + Number(entry.amount_minor), 0);
    return { recordedBalanceINR: Number(snapshot.balanceMinor) / 100, currentMonthIncomeINR: sum("income") / 100, currentMonthExpensesINR: sum("expense") / 100, recordsAnalyzed: entries.length, scope: "The snapshot contains at most 200 recent entries; monthly totals may be incomplete if older entries were omitted.", note: "Records are user-entered and may not represent verified financial activity." };
  }
  if (name === "analyze_spending") {
    const selected = args.period === "all_time" ? entries : entries.filter((entry) => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return new Date(entry.created_at) >= start;
    });
    const totals = selected.filter((entry) => entry.type === "expense").reduce((groups, entry) => {
      groups[entry.category] = (groups[entry.category] || 0) + Number(entry.amount_minor);
      return groups;
    }, Object.create(null));
    return { period: args.period === "all_time" ? "latest returned history" : "this month", categoriesINR: Object.fromEntries(Object.entries(totals).map(([category, amount]) => [category, amount / 100])), recordsAnalyzed: selected.length, scope: "Analysis uses at most 200 recent entries and may not include older records." };
  }
  if (name === "get_recent_entries") {
    const limit = Math.max(1, Math.min(10, Math.trunc(Number(args.limit) || 5)));
    return { entries: entries.slice(0, limit).map((entry) => ({ type: entry.type, amountINR: Number(entry.amount_minor) / 100, category: entry.category, description: entry.description, recordedAt: entry.created_at })) };
  }
  return { error: "Unknown read-only tool." };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  if (!process.env.GEMINI_API_KEY || !serviceKey) return response.status(503).json({ error: "The wallet guide is not configured. Add GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY, then redeploy." });
  const bearer = request.headers.authorization || "";
  if (!bearer.startsWith("Bearer ")) return response.status(401).json({ error: "Please sign in first." });
  const body = typeof request.body === "string" ? (() => { try { return JSON.parse(request.body); } catch { return {}; } })() : request.body || {};
  const question = String(body.question || "").trim().slice(0, 500);
  if (!question) return response.status(400).json({ error: "Ask a question about your recorded finances." });
  const history = Array.isArray(body.history) ? body.history.slice(-8).filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.text === "string").map((item) => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.text.slice(0, 500) }] })) : [];

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: bearer } });
    const user = await json(authResponse);
    if (!authResponse.ok || !user.id) return response.status(401).json({ error: "Your session could not be verified." });
    const snapshotResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/wallet_read_snapshot`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user_id: user.id }),
    });
    const snapshot = await json(snapshotResponse);
    if (!snapshotResponse.ok) return response.status(503).json({ error: "Your ledger is unavailable. Apply the wallet migration first." });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
    const contents = [...history, { role: "user", parts: [{ text: question }] }];
    for (let turn = 0; turn < 3; turn += 1) {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: systemInstruction }] }, contents, tools, toolConfig: { functionCallingConfig: { mode: "AUTO" } } }),
      });
      const result = await json(upstream);
      if (!upstream.ok) return response.status(502).json({ error: "The wallet guide could not prepare a reply." });
      const modelContent = result.candidates?.[0]?.content;
      const parts = modelContent?.parts || [];
      const calls = parts.filter((part) => part.functionCall?.name);
      if (!calls.length) {
        const answer = parts.map((part) => part.text || "").join("").trim();
        return response.status(200).json({ answer: answer || "I could not prepare an answer from your recorded entries." });
      }
      contents.push(modelContent);
      contents.push({ role: "function", parts: calls.map(({ functionCall }) => ({ functionResponse: { name: functionCall.name, response: { result: runTool(functionCall.name, functionCall.args || {}, snapshot) } } })) });
    }
    return response.status(200).json({ answer: "I could not complete that analysis. Please try a more specific question." });
  } catch {
    return response.status(502).json({ error: "The wallet guide is temporarily unavailable." });
  }
}