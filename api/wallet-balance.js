const supabaseUrl =
  process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

export default async function handler(request, response) {
  if (request.method !== "GET")
    return response.status(405).json({ error: "Method not allowed." });

  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer "))
    return response.status(401).json({ error: "Sign in to view your wallet." });

  try {
    const verified = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
    });
    if (!verified.ok)
      return response.status(401).json({ error: "Your sign-in session expired." });

    const user = await verified.json();
    if (!user?.id)
      return response.status(401).json({ error: "Your sign-in session is invalid." });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey)
      return response.status(503).json({
        error: "Wallet balance lookup is not configured on this site.",
      });

    const walletResponse = await fetch(
      `${supabaseUrl}/rest/v1/wallet_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=balance_paise`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );
    if (!walletResponse.ok)
      return response.status(502).json({
        error: "ARRAI Wallet could not be reached. Check the shared Pay database setup.",
      });

    const wallets = await walletResponse.json();
    if (!Array.isArray(wallets) || wallets.length > 1)
      return response.status(502).json({
        error: "ARRAI Wallet returned an invalid balance response.",
      });

    const balancePaise = wallets.length ? Number(wallets[0].balance_paise) : 0;
    if (!Number.isSafeInteger(balancePaise) || balancePaise < 0)
      return response.status(502).json({
        error: "ARRAI Wallet returned an invalid balance.",
      });

    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).json({
      wallet_exists: wallets.length === 1,
      balance_paise: balancePaise,
    });
  } catch {
    return response.status(502).json({
      error: "ARRAI Wallet balance could not be loaded. Please try again.",
    });
  }
}
