const supabaseUrl = process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
const anonKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

async function ownerSession(request) {
  const bearer = request.headers.authorization || "";
  if (!bearer.startsWith("Bearer ")) throw new Error("Please sign in first.");
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: bearer } });
  const user = await response.json();
  if (!response.ok || !user.email) throw new Error("Your session could not be verified.");
  const ownerEmail = process.env.OWNER_EMAIL || "abhishekrai6897@gmail.com";
  if (user.email.toLowerCase() !== ownerEmail.toLowerCase()) throw new Error("This page is reserved for the verified owner.");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Owner studio needs its secure server configuration.");
  return user;
}
const adminHeaders = () => ({ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" });

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  try {
    const owner = await ownerSession(request);
    if (request.body.action === "profiles") {
      const query = String(request.body.query || "").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 50);
      const filter = query ? `&or=(id.eq.${encodeURIComponent(query)},username.ilike.*${encodeURIComponent(query)}*,display_name.ilike.*${encodeURIComponent(query)}*)` : "";
      const upstream = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,username,display_name,bio,avatar_url,date_of_birth,gender,privacy,theme,is_vip,account_status,created_at,updated_at&order=created_at.desc&limit=30${filter}`, { headers: adminHeaders() });
      if (!upstream.ok) throw new Error("Could not load profiles.");
      return response.status(200).json({ profiles: await upstream.json() });
    }
    if (request.body.action === "update-profile") {
      const id = String(request.body.id || ""); const isOwnProfile = owner.id === id;
      const displayName = String(request.body.displayName || "").trim(); const bio = String(request.body.bio || "").trim();
      if (!id || !displayName) return response.status(400).json({ error: "A profile name is required." });
      if (!isOwnProfile && (displayName.length > 50 || bio.length > 180)) return response.status(400).json({ error: "This member's profile exceeds normal field limits." });
      const changes = { display_name: displayName, bio, privacy: ["public", "private"].includes(request.body.privacy) ? request.body.privacy : "public", gender: ["woman", "man", "non_binary", "prefer_not_to_say"].includes(request.body.gender) ? request.body.gender : null, date_of_birth: /^\d{4}-\d{2}-\d{2}$/.test(String(request.body.dateOfBirth || "")) ? request.body.dateOfBirth : null };
      const customUsername = String(request.body.customUsername || "").trim().toLowerCase();
      if (customUsername) {
        if (!isOwnProfile && !/^[a-z0-9_.-]{3,40}$/.test(customUsername)) return response.status(400).json({ error: "Custom username must be 3–40 lowercase letters, numbers, dots, hyphens, or underscores." });
        const member = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=is_vip`, { headers: adminHeaders() });
        const [profile] = await member.json();
        if (!isOwnProfile && !profile?.is_vip) return response.status(403).json({ error: "Custom usernames are reserved for VIP members." });
        changes.username = customUsername;
      }
      const upstream = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify(changes) });
      if (!upstream.ok) throw new Error("Could not update this profile.");
      return response.status(200).json({ ok: true });
    }
    if (request.body.action === "analytics") {
      const [profiles, posts, messages] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/profiles?select=id,is_vip,account_status`, { headers: { ...adminHeaders(), Prefer: "count=exact" } }),
        fetch(`${supabaseUrl}/rest/v1/posts?select=id`, { headers: { ...adminHeaders(), Prefer: "count=exact" } }),
        fetch(`${supabaseUrl}/rest/v1/direct_messages?select=id,status`, { headers: { ...adminHeaders(), Prefer: "count=exact" } }),
      ]);
      const profileRows = await profiles.json(), messageRows = await messages.json();
      return response.status(200).json({ members: profileRows.length, vip: profileRows.filter((p) => p.is_vip).length, suspended: profileRows.filter((p) => p.account_status !== "active").length, posts: (await posts.json()).length, messageRequests: messageRows.filter((m) => m.status === "request").length });
    }
    if (request.body.action === "moderate") {
      const id = String(request.body.id || ""); const action = String(request.body.moderationAction || "");
      if (!id || !["active", "suspended", "banned", "dismissed", "vip"].includes(action)) return response.status(400).json({ error: "Invalid moderation action." });
      if (id === owner.id && action !== "vip") return response.status(403).json({ error: "Owner profile cannot be moderated." });
      const changes = action === "vip" ? { is_vip: true, vip_granted_at: new Date().toISOString() } : { account_status: action };
      const upstream = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { ...adminHeaders(), Prefer: "return=representation" }, body: JSON.stringify(changes) });
      if (!upstream.ok) throw new Error("Could not apply that moderation action.");
      await fetch(`${supabaseUrl}/rest/v1/moderation_events`, { method: "POST", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ profile_id: id, action: action === "vip" ? "vip_granted" : action, note: "Owner Studio action" }) });
      return response.status(200).json({ ok: true });
    }
    if (request.body.action === "set-vip") {
      const id = String(request.body.id || ""); const isVip = request.body.isVip === true;
      const vipType = ["owner_granted", "purchased", "black"].includes(request.body.vipType) ? request.body.vipType : "owner_granted";
      if (!id) return response.status(400).json({ error: "Profile is required." });
      const upstream = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ is_vip: isVip, vip_badge: isVip ? vipType : "none", vip_granted_at: isVip ? new Date().toISOString() : null }) });
      if (!upstream.ok) throw new Error("Could not update VIP access.");
      return response.status(200).json({ ok: true });
    }
    if (request.body.action === "delete-content") {
      const kind = String(request.body.kind || ""); const id = String(request.body.id || "");
      const table = ({ post: "posts", comment: "comments", reel: "reels" })[kind];
      if (!table || !id) return response.status(400).json({ error: "Invalid content target." });
      const upstream = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { ...adminHeaders(), Prefer: "return=minimal" } });
      if (!upstream.ok) throw new Error("Could not remove this content.");
      await fetch(`${supabaseUrl}/rest/v1/moderation_events`, { method: "POST", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ profile_id: owner.id, action: "dismissed", note: `Owner removed ${kind} ${id}` }) });
      return response.status(200).json({ ok: true });
    }
    if (request.body.action === "delete-account") {
      const id = String(request.body.id || "");
      if (!id) return response.status(400).json({ error: "Profile is required." });
      if (id === owner.id) return response.status(403).json({ error: "Owner profile cannot be deleted." });
      const upstream = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", headers: adminHeaders() });
      if (!upstream.ok) throw new Error("Could not permanently delete this account.");
      const profileDelete = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { ...adminHeaders(), Prefer: "return=minimal" } });
      if (!profileDelete.ok) throw new Error("Authentication was deleted, but profile cleanup needs attention.");
      await fetch(`${supabaseUrl}/rest/v1/moderation_events`, { method: "POST", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ profile_id: id, action: "deleted", note: "Permanently deleted by Owner Studio" }) });
      return response.status(200).json({ ok: true });
    }
    return response.status(400).json({ error: "Unknown owner action." });
  } catch (error) { return response.status(error.message.includes("reserved") || error.message.includes("sign in") ? 403 : 500).json({ error: error.message || "Owner request failed." }); }
}
