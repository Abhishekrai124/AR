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
  // The verified owner is promoted server-side on every Studio visit; no browser client can assign this role.
  await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ community_role: "owner" }) }).catch(() => {});
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
      const upstream = await fetch(`${supabaseUrl}/rest/v1/profiles?select=*&order=created_at.desc&limit=30${filter}`, { headers: adminHeaders() });
      if (!upstream.ok) throw new Error(`Could not load profiles (Supabase ${upstream.status}). Check the Supabase project URL and service_role key, then redeploy.`);
      return response.status(200).json({ profiles: await upstream.json() });
    }
    if (request.body.action === "update-profile") {
      const id = String(request.body.id || ""); const isOwnProfile = owner.id === id;
      const displayName = String(request.body.displayName || "").trim(); const bio = String(request.body.bio || "").trim();
      if (!id || !displayName) return response.status(400).json({ error: "A profile name is required." });
      const target = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=community_role`, { headers: adminHeaders() });
      const [targetProfile] = target.ok ? await target.json() : [];
      if (targetProfile?.community_role === "owner" && !isOwnProfile) return response.status(403).json({ error: "Only the verified owner can edit the owner profile from Owner Studio." });
      if (!isOwnProfile && (displayName.length > 50 || bio.length > 180)) return response.status(400).json({ error: "This member's profile exceeds normal field limits." });
      const changes = { display_name: displayName, phone_number: String(request.body.phoneNumber || "").trim().slice(0, 25), bio, privacy: ["public", "private"].includes(request.body.privacy) ? request.body.privacy : "public", gender: ["woman", "man", "non_binary", "prefer_not_to_say"].includes(request.body.gender) ? request.body.gender : null, date_of_birth: /^\d{4}-\d{2}-\d{2}$/.test(String(request.body.dateOfBirth || "")) ? request.body.dateOfBirth : null };
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
      const changes = action === "vip" ? { is_vip: true, vip_granted_at: new Date().toISOString() } : { account_status: action };
      const upstream = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { ...adminHeaders(), Prefer: "return=representation" }, body: JSON.stringify(changes) });
      if (!upstream.ok) throw new Error("Could not apply that moderation action.");
      await fetch(`${supabaseUrl}/rest/v1/moderation_events`, { method: "POST", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ profile_id: id, action: action === "vip" ? "vip_granted" : action, note: "Owner Studio action" }) });
      return response.status(200).json({ ok: true });
    }
    if (request.body.action === "set-vip") {
      const id = String(request.body.id || ""); const isVip = request.body.isVip === true;
      const vipType = request.body.vipType === "purchased" ? "purchased" : "owner_granted";
      if (!id) return response.status(400).json({ error: "Profile is required." });
      const upstream = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ is_vip: isVip, vip_badge: isVip ? vipType : "none", vip_granted_at: isVip ? new Date().toISOString() : null }) });
      if (!upstream.ok) throw new Error("Could not update VIP access.");
      return response.status(200).json({ ok: true });
    }
    if (request.body.action === "set-badge") {
      const id = String(request.body.id || "");
      const badge = String(request.body.badge || "");
      const enabled = request.body.enabled === true;
      const column = ({ blue: "blue_tick", gold: "gold_tick" })[badge];
      if (!id || !column) return response.status(400).json({ error: "Invalid badge request." });
      const upstream = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ [column]: enabled }) });
      if (!upstream.ok) throw new Error("Could not update this verification badge.");
      await fetch(`${supabaseUrl}/rest/v1/moderation_events`, { method: "POST", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ profile_id: id, action: "profile_updated", actor_id: owner.id, note: `${enabled ? "Granted" : "Removed"} ${badge} tick` }) });
      return response.status(200).json({ ok: true });
    }
    if (request.body.action === "set-role") {
      const id = String(request.body.id || "");
      const role = String(request.body.role || "member");
      if (!id || !["member", "moderator", "admin"].includes(role)) return response.status(400).json({ error: "Invalid community role." });
      if (id === owner.id) return response.status(403).json({ error: "The owner role cannot be changed." });
      const target = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=community_role`, { headers: adminHeaders() });
      const [targetProfile] = target.ok ? await target.json() : [];
      if (targetProfile?.community_role === "owner") return response.status(403).json({ error: "The owner role cannot be changed." });
      const upstream = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ community_role: role }) });
      if (!upstream.ok) throw new Error("Could not update this community role. Run the latest Supabase migration first.");
      await fetch(`${supabaseUrl}/rest/v1/moderation_events`, { method: "POST", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ profile_id: id, action: "profile_updated", actor_id: owner.id, note: `Owner set role: ${role}` }) });
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
        if (request.body.action === "get-site-settings") {
      const upstream = await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.global&select=*`, { headers: adminHeaders() });
      const [settings] = await upstream.json();
      return response.status(200).json(settings || {});
    }
    if (request.body.action === "update-site-settings") {
      const changes = {};
      const themes = ["midnight", "sakura", "ocean", "emerald", "ruby", "gold", "nebula", "lava", "cyber", "retro"];
      if (request.body.hero_image_url !== undefined) changes.hero_image_url = String(request.body.hero_image_url).slice(0, 2000);
      if (request.body.global_theme !== undefined) { if (!themes.includes(String(request.body.global_theme))) return response.status(400).json({ error: "Choose a valid site theme." }); changes.global_theme = String(request.body.global_theme); }
      if (request.body.site_name !== undefined) changes.site_name = String(request.body.site_name).slice(0, 120);
      if (request.body.founder_username) { const username = String(request.body.founder_username).trim().toLowerCase(); const found = await fetch(`${supabaseUrl}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id,avatar_url,display_name&limit=1`, { headers: adminHeaders() }); const [profile] = found.ok ? await found.json() : []; if (!profile) return response.status(404).json({ error: "Founder username was not found." }); changes.founder_username = username; changes.founder_profile_id = profile.id; if (!request.body.hero_image_url) changes.hero_image_url = profile.avatar_url || changes.hero_image_url; if (!request.body.founder_name) changes.founder_name = profile.display_name; }
      for (const key of ["founder_name", "founder_role", "founder_note", "founder_tags", "founder_links"]) if (request.body[key] !== undefined) changes[key] = String(request.body[key]).slice(0, 2000);
      
      const upstream = await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.global`, { method: "PATCH", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify(changes) });
      if (!upstream.ok) throw new Error("Could not update site settings.");
      return response.status(200).json({ ok: true });
    }
    if (request.body.action === "get-founder-cards") {
      const upstream = await fetch(`${supabaseUrl}/rest/v1/founder_cards?select=*&order=order_index.asc`, { headers: adminHeaders() });
      return response.status(200).json(await upstream.json());
    }
    if (request.body.action === "add-founder-card") {
      const card = { title: String(request.body.title || "New Card").slice(0,80), subtitle: String(request.body.subtitle || "").slice(0,120), description: String(request.body.description || "").slice(0,400), image_url: String(request.body.image_url || "").slice(0,1000), tags: String(request.body.tags || "").slice(0,500), links: String(request.body.links || "").slice(0,1500), date_of_birth: /^\d{4}-\d{2}-\d{2}$/.test(String(request.body.date_of_birth || "")) ? request.body.date_of_birth : null, profile_id: request.body.profile_id || null };
      const upstream = await fetch(`${supabaseUrl}/rest/v1/founder_cards`, { method: "POST", headers: { ...adminHeaders(), Prefer: "return=minimal" }, body: JSON.stringify(card) });
      if (!upstream.ok) throw new Error("Could not add founder card.");
      return response.status(200).json({ ok: true });
    }
    if (request.body.action === "delete-founder-card") {
      const id = String(request.body.id || "");
      const upstream = await fetch(`${supabaseUrl}/rest/v1/founder_cards?id=eq.${id}`, { method: "DELETE", headers: adminHeaders() });
      if (!upstream.ok) throw new Error("Could not delete founder card.");
      return response.status(200).json({ ok: true });
    }

    return response.status(400).json({ error: "Unknown owner action." });
  } catch (error) { return response.status(error.message.includes("reserved") || error.message.includes("sign in") ? 403 : 500).json({ error: error.message || "Owner request failed." }); }
}
