const supabaseUrl = process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
const anonKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

const adminHeaders = () => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
});

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  if (request.body?.action !== "delete-my-account") return response.status(400).json({ error: "Unknown account action." });
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Account deletion is not configured yet.");
    const bearer = request.headers.authorization || "";
    if (!bearer.startsWith("Bearer ")) throw new Error("Please sign in first.");
    const session = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: bearer } });
    const user = await session.json();
    if (!session.ok || !user?.id) throw new Error("Your session could not be verified.");
    const profileDeleted = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method: "DELETE", headers: { ...adminHeaders(), Prefer: "return=minimal" } });
    if (!profileDeleted.ok) throw new Error("Your community data could not be deleted.");
    const deleted = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE", headers: adminHeaders() });
    if (!deleted.ok) throw new Error("Your profile was removed, but your sign-in could not be deleted. Please contact support.");
    return response.status(200).json({ ok: true });
  } catch (error) {
    return response.status(error.message.includes("sign in") || error.message.includes("verified") ? 403 : 500).json({ error: error.message || "Account request failed." });
  }
}
