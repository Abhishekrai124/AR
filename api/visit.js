const supabaseUrl = String(process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co").trim();

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const origin = request.headers.origin;
  const requestHost = String(request.headers["x-forwarded-host"] || request.headers.host || "").split(",")[0].trim().toLowerCase();
  if (!origin || !requestHost) return response.status(403).json({ error: "Visitor counts accept same-site requests only." });
  try {
    const parsedOrigin = new URL(origin);
    if (!["https:", "http:"].includes(parsedOrigin.protocol) || parsedOrigin.host.toLowerCase() !== requestHost) {
      return response.status(403).json({ error: "Visitor counts accept same-site requests only." });
    }
  } catch {
    return response.status(403).json({ error: "Visitor counts accept same-site requests only." });
  }
  if (!String(request.headers["content-type"] || "").toLowerCase().includes("application/json")) {
    return response.status(415).json({ error: "Visitor counts require a JSON request." });
  }

  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceKey) return response.status(503).json({ error: "Visitor counts are not configured." });

  try {
    const stored = await fetch(`${supabaseUrl}/rest/v1/rpc/record_site_page_view`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!stored.ok) throw new Error(`Analytics storage failed (${stored.status}).`);
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json(await stored.json());
  } catch (error) {
    console.error("Visitor count error:", error);
    return response.status(502).json({ error: "The website visit could not be counted." });
  }
}
