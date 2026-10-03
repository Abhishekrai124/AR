const supabaseRequest = async (path, options = {}) => {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) throw new Error("SUPABASE_PROFILE_NOT_CONFIGURED");
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

const authenticate = async (request) => {
  const bearer = request.headers.authorization || "";
  const key = String(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!bearer.startsWith("Bearer ") || !key || !url) return null;
  const result = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: bearer } });
  if (!result.ok) return null;
  const user = await result.json();
  return user?.id ? user : null;
};

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });
  const user = await authenticate(request);
  if (!user) return response.status(401).json({ error: "Sign in to continue." });
  try {
    const ensured = await supabaseRequest("/rest/v1/rpc/arrai_wallet_profile_ensure", {
      method: "POST",
      body: "{}",
      headers: { Prefer: "return=representation" },
    });
    if (!ensured.ok) return response.status(503).json({ error: "Shared identity schema is not available for this Supabase project." });
    const rows = await ensured.json();
    const profile = Array.isArray(rows) ? rows[0] : rows;
    if (!profile || profile.user_id !== user.id) return response.status(503).json({ error: "Shared identity could not be verified." });
    return response.status(200).json({ user_id: user.id, profile });
  } catch {
    return response.status(503).json({ error: "Shared identity service is temporarily unavailable." });
  }
}

export { authenticate };

// This module intentionally never accepts a user id from the client: the RPC
// derives it from auth.uid() after the bearer token has been verified.
