const supabaseUrl = process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
const anonKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

async function ownerSession(request) {
  const bearer = request.headers.authorization || "";
  if (!bearer.startsWith("Bearer ")) throw new Error("Please sign in first.");
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: bearer } });
  const user = await response.json();
  if (!response.ok || !user.email) throw new Error("Your session could not be verified.");
  if (!process.env.OWNER_EMAIL || user.email.toLowerCase() !== process.env.OWNER_EMAIL.toLowerCase()) throw new Error("This page is reserved for the verified owner.");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Owner studio needs its secure server configuration.");
  return user;
}
const adminHeaders = () => ({ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" });

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  try {
    await ownerSession(request);
    if (request.body.action === "profiles") {
      const query = String(request.body.query || "").replace(/[%(),]/g, "").slice(0, 50);
      const filter = query ? `&or=(username.ilike.*${encodeURIComponent(query)}*,display_name.ilike.*${encodeURIComponent(query)}*)` : "";
      const upstream = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,username,display_name,bio,avatar_url&order=created_at.desc&limit=30${filter}`, { headers: adminHeaders() });
      if (!upstream.ok) throw new Error("Could not load profiles.");
      return response.status(200).json({ profiles: await upstream.json() });
    }
    if (request.body.action === "update-profile") {
      const id = String(request.body.id || ""); const displayName = String(request.body.displayName || "").trim().slice(0, 50); const bio = String(request.body.bio || "").trim().slice(0, 180);
      if (!id || !displayName) return response.status(400).json({ error: "A profile name is required." });
      const upstream = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ display_name: displayName, bio }) });
      if (!upstream.ok) throw new Error("Could not update this profile.");
      return response.status(200).json({ ok: true });
    }
    return response.status(400).json({ error: "Unknown owner action." });
  } catch (error) { return response.status(error.message.includes("reserved") || error.message.includes("sign in") ? 403 : 500).json({ error: error.message || "Owner request failed." }); }
}
