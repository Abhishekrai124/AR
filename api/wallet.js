const json = (value) => (typeof value === "string" ? JSON.parse(value || "{}") : value || {});

const supabaseRequest = async (path, options = {}) => {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) throw new Error("SUPABASE_WALLET_NOT_CONFIGURED");
  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
};

const callLedger = async (operation, payload) => {
  const response = await supabaseRequest(`/rest/v1/rpc/arrai_wallet_${operation}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const error = new Error(`WALLET_${operation.toUpperCase()}_FAILED`);
    error.status = response.status;
    error.detail = detail.slice(0, 240);
    throw error;
  }
  return response.json();
};

// Server-only hooks for verified payment, case-file, and chess workflows.
// Callers must supply their own authenticated business decision and a unique reference.
export const creditWallet = (payload) => callLedger("credit", payload);
export const debitWallet = (payload) => callLedger("debit", payload);

const authenticate = async (request) => {
  const bearer = request.headers.authorization || "";
  const anonKey = String(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!bearer.startsWith("Bearer ") || !anonKey || !url) return null;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: bearer } });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? user : null;
};

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });
  const user = await authenticate(request);
  if (!user) return response.status(401).json({ error: "Sign in to view your wallet." });
  try {
    const ensured = await supabaseRequest("/rest/v1/rpc/arrai_wallet_ensure", {
      method: "POST",
      body: JSON.stringify({ p_user: user.id }),
    });
    if (!ensured.ok) return response.status(503).json({ error: "Wallet schema is not available for this Supabase project." });
    const wallet = await ensured.json();
    const transactions = await supabaseRequest(`/rest/v1/wallet_transactions?user_id=eq.${encodeURIComponent(user.id)}&select=id,direction,amount_paise,balance_after_paise,kind,status,description,reference,metadata,created_at&order=created_at.desc&limit=8`);
    if (!transactions.ok) return response.status(503).json({ error: "Wallet ledger schema is not available for this Supabase project." });
    return response.status(200).json({
      wallet: {
        fund_id: wallet.referral_code || `AR-${String(user.id).slice(0, 8).toUpperCase()}`,
        balance_paise: Number(wallet.balance_paise),
        status: wallet.status,
        updated_at: wallet.updated_at,
      },
      transactions: await transactions.json(),
    });
  } catch (error) {
    const message = error.message === "SUPABASE_WALLET_NOT_CONFIGURED" ? "Wallet server configuration is incomplete." : "Wallet service is temporarily unavailable.";
    return response.status(503).json({ error: message });
  }
}

export { json };
