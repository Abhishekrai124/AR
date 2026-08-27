const supabaseUrl = process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
const anonKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";
const adminHeaders = () => ({ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" });

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Staff controls are not configured.");
    const bearer = request.headers.authorization || "";
    const verified = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: bearer } });
    const user = await verified.json();
    if (!verified.ok || !user?.id) throw new Error("Please sign in first.");
    const action = String(request.body?.action || ""), targetId = String(request.body?.id || "");
    if (!targetId || !["active", "suspended", "banned"].includes(action)) throw new Error("Invalid staff action.");
    const roles = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,community_role&id=in.(${encodeURIComponent(user.id)},${encodeURIComponent(targetId)})`, { headers: adminHeaders() });
    const rows = await roles.json(); const actor = rows.find((row) => row.id === user.id), target = rows.find((row) => row.id === targetId);
    if (!actor || !target || !["moderator", "admin", "owner"].includes(actor.community_role)) throw new Error("Staff access is required.");
    if (target.community_role === "owner" || targetId === user.id) throw new Error("The owner and your own staff account cannot be moderated.");
    if (actor.community_role === "moderator" && action === "banned") throw new Error("Only an admin or owner can ban an account.");
    if (target.community_role === "admin" && actor.community_role !== "owner") throw new Error("Only the owner can moderate an admin.");
    const changed = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}`, { method: "PATCH", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ account_status: action }) });
    if (!changed.ok) throw new Error("Could not update this account.");
    return response.status(200).json({ ok: true });
  } catch (error) { return response.status(403).json({ error: error.message || "Staff action failed." }); }
}
