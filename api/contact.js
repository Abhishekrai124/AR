const supabaseUrl =
  process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

// Personal contact details require a real Supabase session, never a magic URL.
// Cute website, serious boundary.

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const bearer = request.headers.authorization || "";
  if (!bearer.startsWith("Bearer "))
    return response
      .status(401)
      .json({ error: "Sign in to view personal contact details." });
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: bearer },
    });
    const user = await userResponse.json();
    if (!userResponse.ok || !user.email)
      return response
        .status(401)
        .json({ error: "Your session could not be verified." });
    return response.status(200).json({
      email: process.env.OWNER_PRIVATE_EMAIL || "",
      phones: [
        process.env.OWNER_PRIVATE_PHONE_PRIMARY,
        process.env.OWNER_PRIVATE_PHONE_SECONDARY,
      ].filter(Boolean),
    });
  } catch {
    return response
      .status(502)
      .json({ error: "Personal contact details are temporarily unavailable." });
  }
}
