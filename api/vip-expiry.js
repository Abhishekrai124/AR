const supabaseUrl =
  process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({ error: "Method not allowed." });
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return response.status(503).json({ error: "VIP expiry job is not configured." });
  }
  if (request.headers.authorization !== `Bearer ${secret}`) {
    return response.status(401).json({ error: "Unauthorized." });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return response.status(503).json({ error: "Supabase service access is not configured." });
  }
  const expiredBefore = encodeURIComponent(new Date().toISOString());
  try {
    const result = await fetch(
      `${supabaseUrl}/rest/v1/profiles?is_vip=eq.true&vip_badge=eq.purchased&vip_expires_at=lte.${expiredBefore}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          is_vip: false,
          vip_badge: "none",
          gold_tick: false,
          show_vip_on_home: false,
        }),
      },
    );
    if (!result.ok) {
      const detail = await result.text();
      throw new Error(`Supabase rejected the VIP expiry update (${result.status}): ${detail}`);
    }
    const expired = await result.json();
    return response.status(200).json({ expired: expired.length });
  } catch (error) {
    console.error("VIP expiry job failed:", error);
    return response.status(502).json({ error: "Could not expire paid VIP memberships." });
  }
}
