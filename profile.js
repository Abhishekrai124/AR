const profilePage$ = (s) => document.querySelector(s);
const profilePageStatus = profilePage$("#profilePageStatus");

// This page has two doors: /username is a public little corner, while profile.html
// without a username remains private. One door for the world, one door for the owner. ✦
const profileEscape = (v) => {
  const e = document.createElement("div");
  e.textContent = v || "";
  return e.innerHTML;
};
const profileAvatar = (p) =>
  p?.avatar_url ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(p?.display_name || "AR")}&background=38bdf8&color=0f172a&bold=true`;
async function loadProfilePage() {
  const auth = await window.arraiAuth;
  const pathName = location.pathname.split("/").filter(Boolean).pop() || "";
  const requestedUsername =
    pathName && !["profile", "profile.html"].includes(pathName)
      ? decodeURIComponent(pathName).toLowerCase()
      : "";
  const queryId = new URLSearchParams(location.search).get("id");
  const isPublicRoute = Boolean(requestedUsername);
  // Visitors may admire a public profile without signing in; private profile access
  // still asks for a login instead of leaving someone else's life unlocked.
  if (!auth.isAuthenticated && !isPublicRoute) {
    profilePage$("#profilePageLogin").hidden = false;
    profilePageStatus.hidden = true;
    return;
  }
  const db = window.arraiSupabase;
  const profileRequest = requestedUsername
    ? auth.isAuthenticated
      ? db
          .from("profiles")
          .select(
            "id,username,display_name,bio,avatar_url,is_vip,vip_expires_at,blue_tick,gold_tick,created_at,privacy",
          )
          .eq("username", requestedUsername)
          .maybeSingle()
      : db.rpc("arrai_public_profile", { p_username: requestedUsername })
    : Promise.resolve({ data: { id: queryId || auth.user?.sub } });
  const { data: requestedData, error: requestedError } = await profileRequest;
  if (requestedError) throw requestedError;
  const requested = requestedUsername && !auth.isAuthenticated
    ? requestedData?.[0]
    : requestedData;
  const id = requested?.id;
  if (!id)
    throw new Error(
      "We couldn’t find that profile. Check the username and try again.",
    );
  const profileResult = requestedUsername
    ? { data: requested, error: null }
    : await db
        .from("profiles")
        .select(
          "id,username,display_name,bio,avatar_url,is_vip,vip_expires_at,blue_tick,gold_tick,created_at,privacy",
        )
        .eq("id", id)
        .maybeSingle();
  const { data: person, error } = profileResult;
  if (error) throw error;
  if (!person)
    throw new Error(
      "We couldn’t find that profile. Maybe they wandered off to get cookies.",
    );
  if (person.privacy === "private" && id !== auth.user?.sub) {
    if (!auth.isAuthenticated)
      throw new Error("This profile is private. Sign in to check follower access.");
    const { data: follows, error: followError } = await db
      .from("follows")
      .select("following_id")
      .eq("follower_id", auth.user.sub)
      .eq("following_id", id)
      .maybeSingle();
    if (followError) throw followError;
    if (!follows) {
      profilePage$("#profilePage").innerHTML =
        `<section class="profile-page-hero"><img src="${profileEscape(profileAvatar(person))}" alt="" /><div><p class="eyebrow">Private account</p><h1>${profileEscape(person.display_name)}</h1><p class="profile-handle">@${profileEscape(person.username)}</p><p>This profile is visible to approved followers only.</p></div></section>`;
      profilePage$("#profilePage").hidden = false;
      profilePageStatus.hidden = true;
      return;
    }
  }
  const [
    { count: followers },
    { count: following },
    { data: posts, error: postsError },
    { data: locationRows, error: locationError },
  ] = await Promise.all([
    db
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", id),
    db
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", id),
    db
      .from("posts")
      .select("body,image_url,created_at")
      .eq("author_id", id)
      .order("created_at", { ascending: false })
      .limit(18),
    db.rpc("arrai_public_profile_location", { p_profile_id: id }),
  ]);
  if (postsError) throw postsError;
  if (locationError) throw locationError;
  const location = locationRows?.[0];
  const locationLabel = location
    ? [location.city, location.state, location.country].filter(Boolean).join(", ")
    : "";
  const locationMarkup = locationLabel
    ? `<p class="profile-location">📍 ${profileEscape(locationLabel)} <a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(locationLabel)}" target="_blank" rel="noopener noreferrer">Map</a></p>`
    : "";
  const activeVip =
    person.is_vip &&
    (!person.vip_expires_at ||
      new Date(person.vip_expires_at).getTime() > Date.now());
  const tick = person.gold_tick && activeVip
    ? '<span class="verified gold">✓</span>'
    : person.blue_tick || activeVip
      ? '<span class="verified blue">✓</span>'
      : "";
  const viewerId = auth.user?.sub;
  const profileStats = auth.isAuthenticated
    ? `<div class="profile-stats"><span><b>${posts?.length || 0}</b> posts</span><span><b>${followers || 0}</b> followers</span><span><b>${following || 0}</b> following</span></div>`
    : `<div class="profile-stats"><span><b>${posts?.length || 0}</b> posts</span></div>`;
  const card = profilePage$("#profilePage");
  card.innerHTML = `<section class="profile-page-hero"><img src="${profileEscape(profileAvatar(person))}" alt="${profileEscape(person.display_name)}" /><div><p class="eyebrow">${activeVip ? "✦ VIP dreamer" : "AR community member"}</p><h1>${profileEscape(person.display_name)} ${tick}</h1><p class="profile-handle">@${profileEscape(person.username)}</p><p class="profile-bio">${profileEscape(person.bio || "Quietly collecting good ideas and nice moments.")}</p>${locationMarkup}${profileStats}${id !== viewerId ? (viewerId ? `<a class="button primary" href="/dm?with=${encodeURIComponent(id)}">Send a little hello <b>↗</b></a>` : '<a class="button primary" href="auth.html?next=community">Join the community <b>↗</b></a>') : '<a class="button" href="community.html">Edit in community ♡</a>'}</div></section><section class="profile-page-posts"><div><p class="eyebrow">From their corner</p><h2>Little things they’ve shared.</h2></div>${posts?.length ? posts.map((post) => `<article class="social-card"><small>${new Date(post.created_at).toLocaleDateString()}</small><p>${profileEscape(post.body)}</p>${post.image_url ? `<img src="${profileEscape(post.image_url)}" alt="Shared post" />` : ""}</article>`).join("") : '<p class="empty-state">No posts yet. The canvas is delightfully blank.</p>'}</section>`;
  card.hidden = false;
  profilePageStatus.hidden = true;
}
loadProfilePage().catch((e) => {
  profilePageStatus.textContent = e.message;
  profilePageStatus.classList.add("error");
});
