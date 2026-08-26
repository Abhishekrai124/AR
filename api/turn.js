export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.METERED_TURN_API_KEY;
  if (!apiKey) return response.status(500).json({ error: "TURN service is not configured." });

  try {
    const upstream = await fetch(`https://arrai.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`);
    if (!upstream.ok) throw new Error("TURN provider request failed");
    response.setHeader("Cache-Control", "private, max-age=300");
    return response.status(200).json(await upstream.json());
  } catch {
    return response.status(502).json({ error: "Could not obtain call credentials." });
  }
}
