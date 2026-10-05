const $ = (selector) => document.querySelector(selector);
const status = $("#communityStatus");
const setup = $("#profileSetup");
const app = $("#communityApp");
let db;
let user;
let profile;
let activeChat;
let realtimeChannel;
let callChannel;
let peerConnection;
let localStream;
let activeCall;
let pendingCall;
let activeCallType = "video";
let queuedCandidates = [];
let approximateProfileLocation = null;
let clearProfileLocation = false;
let walletBalancePaise = 0;
let walletExists = false;
let feedMode = "home";
let feedOffset = 0;
let feedHasMore = false;
const communityOwnerEmail = "abhishekrai6897@gmail.com";
const locationSchemaUnavailable = (error) =>
  ["42P01", "PGRST202", "PGRST205"].includes(error?.code) ||
  /profile_locations|arrai_public_profile_location/i.test(error?.message || "");
const isOwner = () => user?.email?.toLowerCase() === communityOwnerEmail;
const isVipActive = () =>
  Boolean(
    profile?.is_vip &&
      (!profile.vip_expires_at ||
        new Date(profile.vip_expires_at).getTime() > Date.now()),
  );
const isProfileVipActive = (person) =>
  Boolean(
    person?.is_vip &&
        (!person.vip_expires_at ||
          new Date(person.vip_expires_at).getTime() > Date.now()),
  );

// This is the neighbourhood: profiles, posts, follows, messages and calls.
// Each action still checks ownership, because even a friendly community needs doors.

function say(message, type = "") {
  status.textContent = message;
  status.className = `community-status ${type}`;
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value || "";
  return element.innerHTML;
}

function avatar(profileData) {
  if (profileData.avatar_url) return profileData.avatar_url;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.display_name)}&background=38bdf8&color=0f172a&bold=true`;
}
const badge = (profileData) =>
  `${profileData?.community_role === "owner" ? '<span class="owner-tag" title="AR owner">arrai.in · OWNER</span>' : ""}${profileData?.blue_tick ? '<span class="verified blue" title="Blue tick">✓</span>' : ""}${profileData?.gold_tick && (!profileData.vip_expires_at || new Date(profileData.vip_expires_at).getTime() > Date.now()) ? '<span class="verified gold" title="Gold tick">✓</span>' : ""}`;

async function openProfile(profileId) {
  const { data: person, error } = await db
    .from("profiles")
    .select(
      "id, username, display_name, bio, avatar_url, is_vip, vip_expires_at, blue_tick, gold_tick, community_role, privacy, created_at",
    )
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!person) throw new Error("This member’s profile is unavailable.");

  if (person.privacy === "private" && profileId !== user.sub) {
    const { data: access, error: accessError } = await db
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.sub)
      .eq("following_id", profileId)
      .maybeSingle();
    if (accessError) throw accessError;
    if (!access) {
      $("#profileDetails").innerHTML =
        `<section class="instagram-profile"><img class="profile-hero-avatar" src="${escapeHtml(avatar(person))}" alt="" /><div><p class="eyebrow">Private account</p><h2>${escapeHtml(person.display_name)} ${badge(person)}</h2><p class="profile-handle">@${escapeHtml(person.username)}</p><p>This profile is visible to approved followers only. Follow requests are not available yet.</p></div></section>`;
      if (!$("#profileDialog").open) $("#profileDialog").showModal();
      return;
    }
  }

  const [
    { count: followerCount },
    { count: followingCount },
    { data: posts, error: postError },
    { data: followers, error: followerError },
    { data: following, error: followingError },
    { data: locationRows, error: locationError },
  ] = await Promise.all([
    db
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profileId),
    db
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profileId),
    db
      .from("posts")
      .select("id, body, image_url, created_at")
      .eq("author_id", profileId)
      .order("created_at", { ascending: false })
      .limit(24),
    db
      .from("follows")
      .select(
        "profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)",
      )
      .eq("following_id", profileId)
      .limit(24),
    db
      .from("follows")
      .select(
        "profiles!follows_following_id_fkey(id, username, display_name, avatar_url)",
      )
      .eq("follower_id", profileId)
      .limit(24),
    profileId === user.sub
      ? db
          .from("profile_locations")
          .select("city, state, country, show_on_profile")
          .eq("profile_id", profileId)
          .maybeSingle()
          .then(({ data, error: ownLocationError }) => ({
            data: data ? [data] : [],
            error: ownLocationError,
          }))
      : db.rpc("arrai_public_profile_location", {
          p_profile_id: profileId,
        }),
  ]);
  if (postError || followerError || followingError)
    throw postError || followerError || followingError;
  if (locationError && !locationSchemaUnavailable(locationError))
    throw locationError;
  if (locationError) {
    console.warn("Profile location is unavailable until its Supabase migration is applied:", locationError);
  }
  const profileLocation = locationRows?.[0];
  const locationMarkup = profileLocation
    ? `<p class="profile-location">📍 ${escapeHtml(
        [profileLocation.city, profileLocation.state, profileLocation.country]
          .filter(Boolean)
          .join(", "),
      )} <a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(
        [profileLocation.city, profileLocation.state, profileLocation.country]
          .filter(Boolean)
          .join(", "),
      )}" target="_blank" rel="noopener noreferrer">Map</a></p>`
    : "";
  let profileActions = "";
  if (profileId !== user.sub) {
    const [follow, block, mute] = await Promise.all([
      db
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.sub)
        .eq("following_id", profileId)
        .maybeSingle(),
      db
        .from("member_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.sub)
        .eq("blocked_id", profileId)
        .maybeSingle(),
      db
        .from("member_mutes")
        .select("muted_id")
        .eq("muter_id", user.sub)
        .eq("muted_id", profileId)
        .maybeSingle(),
    ]);
    if (follow.error || block.error || mute.error)
      throw follow.error || block.error || mute.error;
    profileActions = `<div class="profile-safety-actions"><button class="follow-button" type="button" data-member-action="follow" data-member-id="${escapeHtml(profileId)}" data-active="${Boolean(follow.data)}">${follow.data ? "Unfollow" : "Follow"}</button><button class="follow-button" type="button" data-member-action="block" data-member-id="${escapeHtml(profileId)}" data-active="${Boolean(block.data)}">${block.data ? "Unblock" : "Block"}</button><button class="follow-button" type="button" data-member-action="mute" data-member-id="${escapeHtml(profileId)}" data-active="${Boolean(mute.data)}">${mute.data ? "Unmute" : "Mute"}</button><button class="follow-button" type="button" data-member-action="report" data-member-id="${escapeHtml(profileId)}">Report</button></div>`;
  }
  const memberList = (rows) =>
    (rows || [])
      .map((row) => row.profiles)
      .filter(Boolean)
      .map(
        (member) =>
          `<button class="profile-member" type="button" data-profile="${escapeHtml(member.id)}" data-name="${escapeHtml(member.display_name)}"><img src="${avatar(member)}" alt="" />${escapeHtml(member.display_name)} <small>@${escapeHtml(member.username)}</small></button>`,
      )
      .join("") || '<span class="empty-state">None yet</span>';
  $("#profileDetails").innerHTML =
    `<section class="instagram-profile"><img class="profile-hero-avatar" src="${escapeHtml(avatar(person))}" alt="" /><div><p class="eyebrow">${isProfileVipActive(person) ? "✦ VIP member" : "AR member"}</p><h2>${escapeHtml(person.display_name)}</h2><p class="profile-handle">@${escapeHtml(person.username)}</p><p>${escapeHtml(person.bio || "No bio yet.")}</p>${locationMarkup}<div class="profile-stats"><span><b>${posts.length}</b> posts</span><span><b>${followerCount || 0}</b> followers</span><span><b>${followingCount || 0}</b> following</span></div>${profileActions}</div></section><section class="profile-lists"><div><p class="eyebrow">Followers</p>${memberList(followers, "follower")}</div><div><p class="eyebrow">Following</p>${memberList(following, "following")}</div></section><section class="profile-posts"><p class="eyebrow">Posts</p>${posts.length ? posts.map((post) => `<article class="social-card"><small>${new Date(post.created_at).toLocaleDateString()}</small><p>${escapeHtml(post.body)}</p>${post.image_url ? `<img src="${escapeHtml(post.image_url)}" alt="Member post" />` : ""}</article>`).join("") : '<p class="empty-state">No posts yet.</p>'}</section>`;
  $("#profileDetails h2").insertAdjacentHTML("beforeend", ` ${badge(person)}`);
  if (profileId !== user.sub)
    $("#profileDetails .instagram-profile > div").insertAdjacentHTML(
      "beforeend",
      `<button class="message-button profile-message" type="button" data-message="${escapeHtml(person.id)}" data-name="${escapeHtml(person.display_name)}">Message</button>`,
    );
  if (
    profileId !== user.sub &&
    ["moderator", "admin", "owner"].includes(profile.community_role)
  )
    $("#profileDetails .instagram-profile > div").insertAdjacentHTML(
      "beforeend",
      `<span class="staff-actions"><button class="follow-button" type="button" data-staff-action="suspended" data-staff-id="${escapeHtml(person.id)}">Suspend</button><button class="follow-button" type="button" data-staff-action="active" data-staff-id="${escapeHtml(person.id)}">Restore</button>${["admin", "owner"].includes(profile.community_role) ? `<button class="follow-button" type="button" data-staff-action="banned" data-staff-id="${escapeHtml(person.id)}">Ban</button>` : ""}</span>`,
    );
  if (!$("#profileDialog").open) $("#profileDialog").showModal();
}

async function uploadImage(bucket, file) {
  // Empty file inputs arrive as a zero-byte File in some browsers — that is not an upload.
  if (!file || !file.size) return null;
  const maxSize = bucket === "dm-media" ? 25 : 5;
  if (file.size > maxSize * 1024 * 1024)
    throw new Error(
      `${bucket === "dm-media" ? "DM media" : "Images"} must be ${maxSize} MB or smaller.`,
    );
  const extension = file.name.split(".").pop() || "jpg";
  const path = `${user.sub}/${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage
    .from(bucket)
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function loadProfile() {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.sub)
    .maybeSingle();
  if (error) throw error;
  profile = data;
  if (!profile) {
    setup.hidden = false;
    if (isOwner()) {
      $("#profileForm [name='username']").value = "abhishekrai6897";
      $("#profileForm [name='displayName']").value = "Abhishek Rai";
      $("#profileForm [name='bio']").value =
        "Founder & CEO of AR · Building digital dreams with care.";
    }
    say("Set up your public profile to join the community.");
    return false;
  }
  setup.hidden = true;
  app.hidden = false;
  $("#myAvatar").src = avatar(profile);
  $("#myName").textContent = profile.display_name;
  $("#myHandle").textContent = `@${profile.username}`;
  $("#membershipBadge").textContent = isVipActive()
    ? "✦ VIP member"
    : "Standard member";
  $("#membershipBadge").innerHTML = isOwner()
    ? "♛ Owner · all access"
    : isVipActive()
      ? `${badge(profile)} VIP member`
      : "Standard member";
  const { data: siteSettings } = await db
    .from("site_settings")
    .select("global_theme")
    .eq("id", "global")
    .maybeSingle();
  const globalTheme = siteSettings?.global_theme || "midnight";
  const savedTheme = localStorage.getItem("arrai-site-theme");
  const personalTheme = savedTheme === "warm"
    ? "warm"
    : isVipActive() || isOwner()
      ? savedTheme || profile.theme || globalTheme
      : globalTheme;
  document.body.dataset.globalTheme = globalTheme;
  document.body.dataset.userTheme =
    isVipActive() || isOwner() || personalTheme === "warm" ? personalTheme : "";
  $("#themeSelect").value = personalTheme;
  document.body.dataset.theme = personalTheme;
  const globalThemePicker = $("#siteThemePicker");
  if (globalThemePicker) globalThemePicker.value = personalTheme;
  say("You’re connected.", "success");
  return true;
}

async function loadPosts({ append = false } = {}) {
  if (!append) feedOffset = 0;
  const { data: blockedMembers, error: blockedError } = await db.rpc(
    "arrai_member_blocked_ids",
  );
  if (blockedError) throw blockedError;
  const hiddenAuthors = new Set(
    (blockedMembers || []).map((row) => row.member_id),
  );
  let request = db
    .from("posts")
    .select(
      "id, author_id, body, image_url, created_at, post_type, reply_to, updated_at, profiles!posts_author_id_fkey(id, username, display_name, avatar_url, blue_tick, gold_tick, community_role)",
    )
    .order("created_at", { ascending: false })
    .range(feedOffset, feedOffset + 29);
  if (hiddenAuthors.size)
    request = request.not(
      "author_id",
      "in",
      `(${[...hiddenAuthors].map((id) => `"${id.replaceAll('"', "")}"`).join(",")})`,
    );
  if (feedMode === "following") {
    const { data: following, error: followError } = await db
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.sub);
    if (followError) throw followError;
    const ids = [...new Set([user.sub, ...(following || []).map((row) => row.following_id)])];
    request = request.in("author_id", ids);
  }
  if (feedMode === "saved") {
    const { data: bookmarks, error: bookmarkError } = await db
      .from("post_bookmarks")
      .select("post_id")
      .eq("user_id", user.sub);
    if (bookmarkError) throw bookmarkError;
    const ids = (bookmarks || []).map((row) => row.post_id);
    if (!ids.length) {
      if (!append) $("#postFeed").innerHTML = '<p class="empty-state">No saved posts yet. Bookmark a post to keep it here.</p>';
      $("#loadMorePosts").hidden = true;
      return;
    }
    request = request.in("id", ids);
  }
  const { data, error } = await request;
  if (error) throw error;
  const page = data || [];
  feedHasMore = page.length === 30;
  feedOffset += page.length;
  $("#loadMorePosts").hidden = !feedHasMore;
  const existingPostIds = append
    ? new Set(
        [...$("#postFeed").querySelectorAll("[id^='post-']")].map((node) =>
          node.id.slice(5),
        ),
      )
    : new Set();
  const newPosts = page.filter((post) => !existingPostIds.has(post.id));
  if (!append) $("#postFeed").replaceChildren();
  if (!newPosts.length && !append) {
    $("#postFeed").innerHTML = '<p class="empty-state">No posts yet. Be the first to share something.</p>';
    return;
  }
  const postIds = newPosts.map((post) => post.id);
  const [
    { data: comments, error: commentError },
    { data: reactions, error: reactionError },
    { data: bookmarks, error: bookmarkError },
    { data: reposts, error: repostError },
  ] = postIds.length
    ? await Promise.all([
        db
          .from("comments")
          .select(
            "id, post_id, body, created_at, updated_at, author_id, profiles!comments_author_id_fkey(username, display_name, avatar_url)",
          )
          .in("post_id", postIds)
          .order("created_at", { ascending: true }),
        db
          .from("post_reactions")
          .select("post_id, user_id")
          .in("post_id", postIds),
        db
          .from("post_bookmarks")
          .select("post_id")
          .eq("user_id", user.sub)
          .in("post_id", postIds),
        db
          .from("post_reposts")
          .select("post_id, user_id")
          .eq("user_id", user.sub)
          .in("post_id", postIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (commentError || reactionError || bookmarkError || repostError)
    throw commentError || reactionError || bookmarkError || repostError;
  const commentsByPost = (comments || []).reduce(
    (all, comment) => ((all[comment.post_id] ||= []).push(comment), all),
    {},
  );
  const reactionsByPost = (reactions || []).reduce(
    (all, reaction) => ((all[reaction.post_id] ||= []).push(reaction), all),
    {},
  );
  const savedPostIds = new Set((bookmarks || []).map((item) => item.post_id));
  const repostedPostIds = new Set((reposts || []).map((item) => item.post_id));
  const markup = newPosts.length
    ? newPosts
        .map((post) => {
          const postComments = commentsByPost[post.id] || [];
          const postReactions = reactionsByPost[post.id] || [];
          const liked = postReactions.some(
            (reaction) => reaction.user_id === user.sub,
          );
          const commentMarkup = postComments
            .slice(-6)
            .map((comment) => {
              const canManage =
                comment.author_id === user.sub || post.author_id === user.sub;
              const wasEdited =
                comment.updated_at &&
                new Date(comment.updated_at).getTime() -
                  new Date(comment.created_at).getTime() >
                  1000;
              return `<article class="comment"><div><b>${escapeHtml(comment.profiles?.display_name || "Member")}</b><time>${new Date(comment.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}${wasEdited ? " · edited" : ""}</time></div><p>${escapeHtml(comment.body)}</p>${comment.author_id === user.sub ? `<button type="button" data-edit-comment="${comment.id}" data-comment-body="${encodeURIComponent(comment.body)}">Edit</button>` : ""}${canManage ? `<button type="button" data-delete-comment="${comment.id}">${comment.author_id === user.sub ? "Delete" : "Remove"}</button>` : ""}</article>`;
            })
            .join("");
          return `<article class="social-card post" id="post-${post.id}"><img class="post-avatar" src="${avatar(post.profiles)}" alt="" /><div><button type="button" class="profile-link" data-profile="${post.profiles.id}">${escapeHtml(post.profiles.display_name)} ${badge(post.profiles)}</button><span>@${escapeHtml(post.profiles.username)} · ${new Date(post.created_at).toLocaleDateString()}${post.updated_at ? " · edited" : ""}</span>${post.reply_to ? `<small class="community-reply-ref">↳ In reply to a community post</small>` : ""}${post.body ? `<p>${escapeHtml(post.body)}</p>` : ""}${post.image_url ? `<img class="post-image" src="${post.image_url}" alt="Post image" loading="lazy" />` : ""}<div class="post-tools"><button type="button" data-like="${post.id}" class="${liked ? "liked" : ""}">♡ ${postReactions.length || ""}</button><button type="button" data-bookmark="${post.id}" class="${savedPostIds.has(post.id) ? "liked" : ""}">${savedPostIds.has(post.id) ? "Saved" : "Save"}</button><button type="button" data-repost="${post.id}" class="${repostedPostIds.has(post.id) ? "liked" : ""}">${repostedPostIds.has(post.id) ? "Reposted" : "Repost"}</button><button type="button" data-reply="${post.id}">Reply</button><button type="button" data-report-post="${post.id}">Report</button><button type="button" data-share="${post.id}" data-share-text="${escapeHtml(post.body.slice(0, 160))}">↗ Share</button>${post.author_id === user.sub ? `<button type="button" data-edit-post="${post.id}" data-post-body="${encodeURIComponent(post.body)}">Edit</button><button type="button" data-delete-post="${post.id}">Delete</button>` : ""}<span>${postComments.length} comment${postComments.length === 1 ? "" : "s"}</span></div><div class="comment-list">${commentMarkup}</div><form class="comment-form" data-comment-form="${post.id}"><input maxlength="500" required placeholder="Write a kind comment…" /><button type="submit">Send</button></form></div></article>`;
        })
        .join("")
    : "";
  if (append) $("#postFeed").insertAdjacentHTML("beforeend", markup);
  else $("#postFeed").innerHTML = markup || '<p class="empty-state">No posts yet. Be the first to share something.</p>';
}

async function searchPeople(query = "") {
  let request = db
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .neq("id", user.sub)
      .order("username")
      .limit(24);
  if (query) {
    const term = query.toLowerCase().replace(/[,()]/g, "");
    request = request.or(
      `username.ilike.%${term}%,display_name.ilike.%${term}%`,
    );
  }
  const [
    { data: people, error },
    { data: following, error: followError },
    { data: blockedMembers, error: blockedError },
  ] = await Promise.all([
    request,
    db.from("follows").select("following_id").eq("follower_id", user.sub),
    db.rpc("arrai_member_blocked_ids"),
  ]);
  if (error || followError || blockedError)
    throw error || followError || blockedError;
  const followed = new Set(following.map((row) => row.following_id));
  const blocked = new Set((blockedMembers || []).map((row) => row.member_id));
  const visiblePeople = (people || []).filter((person) => !blocked.has(person.id)).slice(0, 8);
  $("#peopleResults").innerHTML = visiblePeople.length
    ? visiblePeople
        .map(
          (person) =>
            `<div class="person-row"><img src="${avatar(person)}" alt="" /><div><b>${escapeHtml(person.display_name)}</b><small>@${escapeHtml(person.username)}</small></div><a class="follow-button" href="/${encodeURIComponent(person.username)}">Profile</a><button class="follow-button" data-follow="${person.id}" data-following="${followed.has(person.id)}">${followed.has(person.id) ? "Following" : "Follow"}</button><a class="message-button" href="/dm?with=${encodeURIComponent(person.id)}">Message</a></div>`,
        )
        .join("")
    : '<p class="empty-state">No people found.</p>';
}

async function setFollow(personId, following) {
  const request = following
    ? db
        .from("follows")
        .delete()
        .eq("follower_id", user.sub)
        .eq("following_id", personId)
    : db
        .from("follows")
        .insert({ follower_id: user.sub, following_id: personId });
  const { error } = await request;
  if (error) {
    if (!following && error.code === "42501")
      throw new Error(
        "This member's privacy settings do not allow a new follow. Private-profile follow requests are not available yet.",
      );
    throw error;
  }
  await searchPeople($("#peopleSearch").value);
}

async function openChat(personId, name) {
  activeChat = { id: personId, name };
  $("#chatTitle").textContent = name;
  $("#messageForm").hidden = false;
  $("#messageShortcuts").hidden = false;
  $("#audioCallButton").disabled = false;
  $("#callButton").disabled = false;
  await loadMessages();
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  realtimeChannel = db
    .channel(`dm:${[user.sub, personId].sort().join(":")}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "direct_messages" },
      (payload) => {
        const message = payload.new;
        if (
          [message.sender_id, message.recipient_id].includes(user.sub) &&
          [message.sender_id, message.recipient_id].includes(personId)
        )
          loadMessages();
      },
    )
    .subscribe();
}

async function loadMessages() {
  if (!activeChat) return;
  const { data, error } = await db
    .from("direct_messages")
    .select(
      "id, sender_id, body, media_url, media_type, attachment_url, attachment_type, created_at",
    )
    .or(
      `and(sender_id.eq.${user.sub},recipient_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},recipient_id.eq.${user.sub})`,
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  $("#messageList").innerHTML = data.length
    ? data
        .map((message) => {
          const mediaUrl = message.media_url || message.attachment_url;
          const mediaType = message.media_type || message.attachment_type;
          return `<div class="message ${message.sender_id === user.sub ? "mine" : "theirs"}">${message.body ? `<p>${escapeHtml(message.body)}</p>` : ""}${mediaUrl ? (mediaType?.startsWith("image/") ? `<img src="${escapeHtml(mediaUrl)}" alt="Shared image" />` : mediaType?.startsWith("video/") ? `<video src="${escapeHtml(mediaUrl)}" controls playsinline></video>` : `<audio src="${escapeHtml(mediaUrl)}" controls></audio>`) : ""}<time class="message-time" datetime="${escapeHtml(message.created_at)}">${escapeHtml(new Date(message.created_at).toLocaleString())}</time></div>`;
        })
        .join("")
    : '<p class="empty-state">Say hello to start the conversation.</p>';
  $("#messageList").scrollTop = $("#messageList").scrollHeight;
}

async function sendCallSignal(recipientId, kind, payload = {}) {
  const { error } = await db
    .from("call_signals")
    .insert({
      call_id: activeCall?.id || pendingCall?.id,
      sender_id: user.sub,
      recipient_id: recipientId,
      kind,
      payload,
    });
  if (error) throw error;
}

async function getPeerConnection(callType) {
  let iceServers = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  try {
    const response = await fetch("/api/account?action=turn");
    if (response.ok) iceServers = await response.json();
  } catch {
    /* public STUN fallback */
  }
  peerConnection = new RTCPeerConnection({ iceServers });
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error("Your browser does not support calls.");
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: callType === "video",
  });
  $("#localVideo").hidden = callType !== "video";
  $("#remoteVideo").hidden = callType !== "video";
  $("#remoteAudio").hidden = callType === "video";
  $("#localVideo").srcObject = localStream;
  localStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, localStream));
  peerConnection.ontrack = (event) => {
    $("#remoteVideo").srcObject = event.streams[0];
    $("#remoteVideo").muted = callType === "audio";
    $("#remoteAudio").srcObject = event.streams[0];
  };
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && activeCall)
      sendCallSignal(
        activeCall.otherId,
        "candidate",
        event.candidate.toJSON(),
      ).catch((error) => say(`Call connection issue: ${error.message}`, "error"));
  };
  peerConnection.onconnectionstatechange = () => {
    if (["failed", "disconnected"].includes(peerConnection.connectionState))
      endCall(false);
  };
  return peerConnection;
}

function showCallDialog() {
  const dialog = $("#callDialog");
  if (!dialog.open) dialog.showModal();
}

async function startCall(callType = "video") {
  try {
    if (!activeChat) throw new Error("Open a conversation before calling.");
    activeCallType = callType;
    activeCall = { id: crypto.randomUUID(), otherId: activeChat.id };
    $("#callState").textContent = `Connecting ${callType} call`;
    $("#callTitle").textContent = `Calling ${activeChat.name}…`;
    $("#acceptCall").hidden = true;
    showCallDialog();
    const connection = await getPeerConnection(callType);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await sendCallSignal(activeChat.id, "offer", {
      description: offer,
      callerName: profile.display_name,
      callType,
    });
  } catch (error) {
    endCall(false);
    say(error.message, "error");
  }
}

async function acceptCall() {
  if (!pendingCall) return;
  try {
    activeCallType = pendingCall.payload.callType === "audio" ? "audio" : "video";
    activeCall = { id: pendingCall.id, otherId: pendingCall.sender_id };
    $("#callState").textContent = `Connecting ${activeCallType} call`;
    $("#callTitle").textContent =
      `Calling ${pendingCall.payload.callerName || "friend"}…`;
    $("#acceptCall").hidden = true;
    const connection = await getPeerConnection(activeCallType);
    await connection.setRemoteDescription(pendingCall.payload.description);
    for (const candidate of queuedCandidates)
      await connection.addIceCandidate(candidate);
    queuedCandidates = [];
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    await sendCallSignal(activeCall.otherId, "answer", { description: answer });
    pendingCall = null;
  } catch (error) {
    endCall(false);
    say(error.message, "error");
  }
}

async function handleCallSignal(signal) {
  if (signal.recipient_id !== user.sub) return;
  if (signal.kind === "offer") {
    pendingCall = signal;
    queuedCandidates = [];
    $("#callState").textContent =
      `Incoming ${signal.payload.callType === "audio" ? "audio" : "video"} call`;
    $("#callTitle").textContent =
      `${signal.payload.callerName || "Someone"} is calling`;
    $("#acceptCall").hidden = false;
    showCallDialog();
    return;
  }
  if (
    signal.kind === "candidate" &&
    pendingCall &&
    signal.call_id === pendingCall.id
  ) {
    queuedCandidates.push(signal.payload);
    return;
  }
  if (!activeCall || signal.call_id !== activeCall.id) return;
  if (signal.kind === "answer") {
    await peerConnection.setRemoteDescription(signal.payload.description);
    for (const candidate of queuedCandidates)
      await peerConnection.addIceCandidate(candidate);
    queuedCandidates = [];
  }
  if (signal.kind === "candidate") {
    if (peerConnection?.remoteDescription)
      await peerConnection.addIceCandidate(signal.payload);
    else queuedCandidates.push(signal.payload);
  }
  if (signal.kind === "hangup") endCall(false);
}

async function endCall(notify = true) {
  const otherId = activeCall?.otherId || pendingCall?.sender_id;
  if (notify && otherId && (activeCall || pendingCall)) {
    try {
      await sendCallSignal(otherId, "hangup");
    } catch (error) {
      say(`Call ended here, but the other member could not be notified: ${error.message}`, "error");
    }
  }
  peerConnection?.close();
  localStream?.getTracks().forEach((track) => track.stop());
  peerConnection = null;
  localStream = null;
  activeCall = null;
  pendingCall = null;
  queuedCandidates = [];
  $("#localVideo").srcObject = null;
  $("#remoteVideo").srcObject = null;
  $("#remoteAudio").srcObject = null;
  $("#localVideo").hidden = false;
  $("#remoteVideo").hidden = false;
  $("#remoteAudio").hidden = true;
  activeCallType = "video";
  if ($("#callDialog").open) $("#callDialog").close();
}

function subscribeToCalls() {
  callChannel = db
    .channel(`calls:${user.sub}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "call_signals" },
      (payload) =>
        handleCallSignal(payload.new).catch((error) =>
          say(error.message, "error"),
        ),
    )
    .subscribe();
}

async function openAccountSettings() {
  const [
    { count: postCount },
    { count: followerCount },
    { count: followingCount },
    { data: location, error: locationError },
  ] = await Promise.all([
    db
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("author_id", user.sub),
    db
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", user.sub),
    db
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", user.sub),
    db
      .from("profile_locations")
      .select("city, state, country, show_on_profile")
      .eq("profile_id", user.sub)
      .maybeSingle(),
  ]);
  if (locationError && !locationSchemaUnavailable(locationError)) throw locationError;
  if (locationError) {
    console.warn("Profile location is unavailable until its Supabase migration is applied:", locationError);
    say("Location settings need the profile-locations Supabase migration. Membership and other account settings are still available.", "info");
  }
  const form = $("#accountForm");
  form.elements.privacy.value = profile.privacy || "public";
  form.elements.whoCanFollow.value = profile.who_can_follow || "everyone";
  form.elements.whoCanMessage.value = profile.who_can_message || "everyone";
  form.elements.bio.value = profile.bio || "";
  form.elements.theme.value = profile.theme || "midnight";
  form.elements.showVipOnHome.checked = Boolean(profile.show_vip_on_home);
  form.elements.showLocation.checked = Boolean(location?.show_on_profile);
  approximateProfileLocation = location
    ? {
        city: location.city,
        state: location.state || "",
        country: location.country,
      }
    : null;
  clearProfileLocation = false;
  updateProfileLocationSettings();
  const expiresAt = profile.vip_expires_at
    ? new Date(profile.vip_expires_at)
    : null;
  $("#vipMembershipStatus").textContent =
    profile.vip_badge === "owner_granted"
      ? "Owner VIP access is active."
      : isVipActive() && expiresAt
        ? `VIP active until ${expiresAt.toLocaleDateString()}. Your gold badge is ready.`
        : profile.vip_badge === "purchased" && expiresAt
          ? `Membership expired on ${expiresAt.toLocaleDateString()}. Renew to restore VIP benefits.`
        : "Personal themes and a gold profile badge. Membership lasts 12 months.";
  const ownerVip = (profile.vip_badge === "owner_granted" && isVipActive()) ||
    isOwner();
  $("#buyVipMembership").hidden = ownerVip;
  $("#buyVipWithWallet").hidden = true;
  $("#buyVipMembership").textContent =
    isVipActive() && profile.vip_badge === "purchased"
      ? "Renew VIP · ₹45"
      : "Get VIP · ₹45";
  $("#accountActivity").innerHTML =
    `<span><b>${postCount || 0}</b> posts</span><span><b>${followerCount || 0}</b> followers</span><span><b>${followingCount || 0}</b> following</span>`;
  $("#accountDialog").showModal();
}

function updateProfileLocationSettings() {
  const preview = $("#profileLocationPreview");
  const map = $("#profileLocationMap");
  const clear = $("#clearProfileLocation");
  if (approximateProfileLocation) {
    const label = [
      approximateProfileLocation.city,
      approximateProfileLocation.state,
      approximateProfileLocation.country,
    ]
      .filter(Boolean)
      .join(", ");
    preview.textContent = `Approximate city: ${label}`;
    map.href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(label)}`;
    map.hidden = false;
    clear.hidden = false;
  } else {
    preview.textContent = "No location is saved.";
    map.hidden = true;
    clear.hidden = true;
  }
}

async function loadRazorpayCheckout() {
  if (window.Razorpay) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Razorpay checkout could not load."));
    document.head.append(script);
  });
}

async function refreshWalletBalance() {
  const {
    data: { session },
    error: sessionError,
  } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token)
    throw new Error("Sign in again to check your ARRAI Wallet.");
  const response = await fetch(
    "/api/vip-membership?action=wallet-balance",
    { headers: { Authorization: `Bearer ${session.access_token}` } },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not check your wallet balance.");
  if (
    typeof result.wallet_exists !== "boolean" ||
    !Number.isSafeInteger(result.balance_paise) ||
    result.balance_paise < 0
  )
    throw new Error("ARRAI Wallet returned an invalid balance.");
  walletBalancePaise = result.balance_paise;
  walletExists = result.wallet_exists;
  $("#arraiWalletBalance").textContent = walletExists
    ? `ARRAI Wallet balance: ${new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(walletBalancePaise / 100)}`
    : "Activate your ARRAI Wallet at pay.arrai.in to use wallet checkout.";
  $("#buyVipWithWallet").disabled =
    !walletExists || walletBalancePaise < 4500;
  if (walletExists && walletBalancePaise < 4500) {
    $("#arraiWalletBalance").textContent +=
      " Add at least ₹45 to pay for VIP.";
  }
}

async function buyVipWithWallet() {
  const button = $("#buyVipWithWallet");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Paying securely from your wallet…";
  try {
    const {
      data: { session },
      error: sessionError,
    } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.access_token)
      throw new Error("Please sign in again before purchasing VIP.");
    const idempotencyStorageKey = `arrai-vip-wallet:${user.sub}`;
    let idempotencyKey = localStorage.getItem(idempotencyStorageKey);
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      localStorage.setItem(idempotencyStorageKey, idempotencyKey);
    }
    const response = await fetch("/api/vip-membership?action=wallet-pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ idempotencyKey }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "ARRAI Wallet payment was declined.");
    await loadProfile();
    await refreshWalletBalance();
    localStorage.removeItem(idempotencyStorageKey);
    $("#accountDialog").close();
    say(
      result.activated
        ? `VIP is active until ${new Date(result.expires_at).toLocaleDateString()}. ₹45 was paid from your ARRAI Wallet.`
        : `This wallet payment was already completed. VIP is active until ${new Date(result.expires_at).toLocaleDateString()}.`,
      "success",
    );
  } catch (error) {
    say(error.message || "ARRAI Wallet payment could not be completed.", "error");
    await refreshWalletBalance().catch((balanceError) => {
      $("#arraiWalletBalance").textContent =
        `Wallet balance unavailable: ${balanceError.message}`;
    });
  } finally {
    button.textContent = originalText;
    button.disabled = !walletExists || walletBalancePaise < 4500;
  }
}

async function buyVipMembership() {
  const button = $("#buyVipMembership");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Opening secure checkout…";
  try {
    const {
      data: { session },
      error: sessionError,
    } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.access_token)
      throw new Error("Please sign in again before purchasing VIP.");
    const orderResponse = await fetch("/api/vip-membership?action=create-order", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const order = await orderResponse.json();
    if (!orderResponse.ok)
      throw new Error(order.error || "Could not start VIP checkout.");
    if (
      order.amount !== 4500 ||
      order.currency !== "INR" ||
      typeof order.order_id !== "string" ||
      typeof order.key_id !== "string"
    )
      throw new Error("The server returned an invalid membership order.");
    await loadRazorpayCheckout();
    const checkout = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: "ARRAI",
      description: "One-year VIP membership",
      order_id: order.order_id,
      prefill: {
        name: profile.display_name,
        email: user.email,
      },
      theme: { color: "#38bdf8" },
      handler: async (payment) => {
        try {
          const verifyResponse = await fetch(
            "/api/vip-membership?action=verify",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                orderId: payment.razorpay_order_id,
                paymentId: payment.razorpay_payment_id,
                signature: payment.razorpay_signature,
              }),
            },
          );
          const verification = await verifyResponse.json();
          if (!verifyResponse.ok)
            throw new Error(
              verification.error || "VIP payment could not be verified.",
            );
          await loadProfile();
          $("#accountDialog").close();
          say(
            `VIP is active until ${new Date(verification.expires_at).toLocaleDateString()}. Welcome in!`,
            "success",
          );
        } catch (error) {
          say(
            `${error.message} If your payment was charged, contact support with payment ID ${payment.razorpay_payment_id}.`,
            "error",
          );
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      },
      modal: {
        ondismiss: () => {
          button.disabled = false;
          button.textContent = originalText;
        },
      },
    });
    checkout.on("payment.failed", (event) => {
      button.disabled = false;
      button.textContent = originalText;
      say(
        event.error?.description || "VIP payment did not complete.",
        "error",
      );
    });
    checkout.open();
  } catch (error) {
    button.disabled = false;
    button.textContent = originalText;
    say(error.message || "VIP checkout could not be opened.", "error");
  }
}

$("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const username = String(data.get("username") || "")
    .trim()
    .toLowerCase();
  const displayName = String(data.get("displayName") || "").trim();
  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return say(
      "Username 3–20 characters ka ho: only a-z, 0-9, underscore. Example: abhi123",
      "error",
    );
  if (!displayName) return say("Display name is required.", "error");
  try {
    const { error } = await db
      .from("profiles")
      .insert({
        id: user.sub,
        username,
        display_name: displayName,
        phone_number: String(data.get("phoneNumber") || "").trim(),
        date_of_birth: data.get("dateOfBirth"),
        gender: data.get("gender"),
        privacy: data.get("privacy"),
        bio: String(data.get("bio") || "").trim(),
      });
    if (error) {
      if (error.code === "23505")
        return say(
          "That username is already taken. Try another one, like abhi1234.",
          "error",
        );
      if (error.code === "42501")
        return say(
          "Profile save blocked by Supabase permissions. Run the latest SQL migration, then try again.",
          "error",
        );
      return say(error.message || "Profile could not be saved.", "error");
    }
    if (await loadProfile()) {
      await Promise.all([loadPosts(), searchPeople()]);
      subscribeToCalls();
      window.dispatchEvent(
        new CustomEvent("arrai:profile-ready", { detail: { db, user, profile } }),
      );
      if (new URLSearchParams(location.search).get("membership") === "1")
        await openAccountSettings();
    }
  } catch (error) {
    say(
      error.message || "Profile could not be saved. Please try again.",
      "error",
    );
  }
});

$("#accountSettings").addEventListener("click", () =>
  openAccountSettings().catch((error) => say(error.message, "error")),
);
$("#closeAccount").addEventListener("click", () => $("#accountDialog").close());
$("#buyVipMembership").addEventListener("click", () =>
  buyVipMembership().catch((error) => say(error.message, "error")),
);
$("#buyVipWithWallet").addEventListener("click", () =>
  buyVipWithWallet().catch((error) => say(error.message, "error")),
);
$("#refreshVipWalletBalance").addEventListener("click", () =>
  refreshWalletBalance().catch((error) => {
    $("#arraiWalletBalance").textContent =
      `Wallet balance unavailable: ${error.message}`;
    $("#buyVipWithWallet").disabled = true;
  }),
);
$("#useProfileLocation").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Finding approximate city…";
  try {
    if (!window.arraiGetApproximateLocation)
      throw new Error("Approximate city lookup is unavailable on this page.");
    approximateProfileLocation = await window.arraiGetApproximateLocation();
    clearProfileLocation = false;
    updateProfileLocationSettings();
    $("#accountForm").elements.showLocation.checked = true;
    say("Approximate city found. Save settings to keep it on your profile.", "success");
  } catch (error) {
    say(error.message || "Could not find your approximate city.", "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
$("#clearProfileLocation").addEventListener("click", () => {
  approximateProfileLocation = null;
  clearProfileLocation = true;
  $("#accountForm").elements.showLocation.checked = false;
  updateProfileLocationSettings();
  say("Location will be removed when you save settings.");
});
$("#accountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const theme = data.get("theme");
  if (theme !== "midnight" && !isVipActive() && !isOwner())
    return say("Exclusive themes are available with VIP membership.", "error");
  if (
    data.get("showVipOnHome") &&
    (profile.vip_badge !== "purchased" ||
      !isVipActive() ||
      (profile.vip_expires_at &&
        new Date(profile.vip_expires_at).getTime() <= Date.now()))
  )
    return say("Only paid VIP members can be featured on the homepage.", "error");
  if (data.get("showLocation") && !approximateProfileLocation)
    return say("Choose an approximate city before displaying it.", "error");
  try {
    if (clearProfileLocation) {
      const { error: deleteLocationError } = await db
        .from("profile_locations")
        .delete()
        .eq("profile_id", user.sub);
      if (deleteLocationError) throw deleteLocationError;
    } else if (approximateProfileLocation) {
      const { error: saveLocationError } = await db
        .from("profile_locations")
        .upsert(
          {
            profile_id: user.sub,
            ...approximateProfileLocation,
            show_on_profile: Boolean(data.get("showLocation")),
          },
          { onConflict: "profile_id" },
        );
      if (saveLocationError) throw saveLocationError;
    }
  } catch (error) {
    return say(`Location settings could not be saved: ${error.message}`, "error");
  }
  const { error } = await db
    .from("profiles")
    .update({
      privacy: data.get("privacy"),
      who_can_follow: data.get("whoCanFollow"),
      who_can_message: data.get("whoCanMessage"),
      bio: data.get("bio").trim(),
      theme,
      show_vip_on_home: Boolean(data.get("showVipOnHome")),
    })
    .eq("id", user.sub);
  if (error) return say(error.message, "error");
  Object.assign(profile, {
    privacy: data.get("privacy"),
    who_can_follow: data.get("whoCanFollow"),
    who_can_message: data.get("whoCanMessage"),
    bio: data.get("bio").trim(),
    theme,
    show_vip_on_home: Boolean(data.get("showVipOnHome")),
  });
  document.body.dataset.theme = theme;
  $("#themeSelect").value = theme;
  $("#accountDialog").close();
  say("Account settings saved. ✦", "success");
});
$("#deleteMyAccount").addEventListener("click", async () => {
  if (
    !(await window.cuteConfirm(
      "Permanently delete your account and all community content? This cannot be undone.",
      { title: "Delete your account?", danger: true },
    ))
  )
    return;
  if (
    !(await window.cuteConfirm(
      "This is the last check. Your profile, posts and messages will be removed.",
      { title: "Final confirmation", danger: true },
    ))
  )
    return;
  try {
    const {
      data: { session },
    } = await db.auth.getSession();
    const response = await fetch("/api/account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify({ action: "delete-my-account" }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Account deletion failed.");
    await db.auth.signOut();
    window.location.assign("index.html");
  } catch (error) {
    say(error.message, "error");
  }
});

$("#avatarInput").addEventListener("change", async (event) => {
  try {
    const avatarUrl = await uploadImage("avatars", event.target.files[0]);
    const { error } = await db
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.sub);
    if (error) throw error;
    profile.avatar_url = avatarUrl;
    $("#myAvatar").src = avatarUrl;
    say("Profile photo updated.", "success");
  } catch (error) {
    say(error.message, "error");
  }
});

$("#themeSelect").addEventListener("change", async (event) => {
  const theme = event.target.value;
  if (theme !== "midnight" && theme !== "warm" && !isVipActive() && !isOwner()) {
    event.target.value = profile.theme || "midnight";
    return say("Exclusive themes are available with VIP membership.", "error");
  }
  const { error } = await db
    .from("profiles")
    .update({ theme })
    .eq("id", user.sub);
  if (error) return say(error.message, "error");
  profile.theme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem("arrai-site-theme", theme);
  const globalThemePicker = $("#siteThemePicker");
  if (globalThemePicker) globalThemePicker.value = theme;
  say("Your theme has been updated. ✦", "success");
});

$("#postForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = data.get("body").trim();
    const imageUrl = await uploadImage("post-media", data.get("image"));
    const replyTo = form.dataset.replyTo || null;
    if (!body && !imageUrl)
      throw new Error("Write a little update or choose a photo first.");
    const { error } = await db
      .from("posts")
      .insert({
        author_id: user.sub,
        body,
        image_url: imageUrl,
        reply_to: replyTo,
      });
    if (error) throw error;
    delete form.dataset.replyTo;
    form.querySelector(".reply-composer-context")?.remove();
    form.reset();
    await loadPosts();
    say(replyTo ? "Reply published." : "Post published.", "success");
  } catch (error) {
    say(error.message, "error");
  }
});

async function loadReels() {
  const { data, error } = await db
    .from("reels")
    .select(
      "id, author_id, video_url, caption, profiles!reels_author_id_fkey(id, username, display_name, avatar_url, blue_tick, gold_tick, community_role)",
    )
    .order("created_at", { ascending: false })
    .limit(18);
  if (error) throw error;
  $("#reelFeed").innerHTML = data
    .map(
      (reel) =>
        `<article class="social-card reel"><video src="${reel.video_url}" controls playsinline preload="metadata"></video><p><button type="button" class="profile-link" data-profile="${reel.profiles.id}">${escapeHtml(reel.profiles.display_name)} ${badge(reel.profiles)}</button> @${escapeHtml(reel.profiles.username)}</p><p>${escapeHtml(reel.caption)}</p>${reel.author_id === user.sub ? `<button class="follow-button" type="button" data-delete-reel="${reel.id}">Delete reel</button>` : ""}</article>`,
    )
    .join("");
}
$("#reelForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const form = event.currentTarget;
    const data = new FormData(form),
      video = data.get("video");
    if (video.size > 75 * 1024 * 1024)
      throw new Error("Reels must be 75 MB or smaller.");
    const videoUrl = await uploadImage("reel-media", video);
    const { error } = await db
      .from("reels")
      .insert({
        author_id: user.sub,
        video_url: videoUrl,
        caption: data.get("caption").trim(),
      });
    if (error) throw error;
    form.reset();
    await loadReels();
    say("Reel published. ✦", "success");
  } catch (error) {
    say(error.message, "error");
  }
});
$("#reelFeed").addEventListener("click", async (event) => {
  const profileButton = event.target.closest("[data-profile]"),
    remove = event.target.closest("[data-delete-reel]");
  try {
    if (profileButton) return openProfile(profileButton.dataset.profile);
    if (
      remove &&
      (await window.cuteConfirm("This reel will be removed from your feed.", {
        title: "Delete this reel?",
        danger: true,
      }))
    ) {
      const { error } = await db
        .from("reels")
        .delete()
        .eq("id", remove.dataset.deleteReel)
        .eq("author_id", user.sub);
      if (error) throw error;
      await loadReels();
    }
  } catch (error) {
    say(error.message, "error");
  }
});

$("#postFeed").addEventListener("click", async (event) => {
  const like = event.target.closest("[data-like]");
  const bookmark = event.target.closest("[data-bookmark]");
  const repost = event.target.closest("[data-repost]");
  const reply = event.target.closest("[data-reply]");
  const reportPost = event.target.closest("[data-report-post]");
  const editPost = event.target.closest("[data-edit-post]");
  const share = event.target.closest("[data-share]");
  const profileButton = event.target.closest("[data-profile]");
  const deletePost = event.target.closest("[data-delete-post]");
  const deleteComment = event.target.closest("[data-delete-comment]");
  const editComment = event.target.closest("[data-edit-comment]");
  try {
    if (profileButton) return openProfile(profileButton.dataset.profile);
    if (reply) {
      const form = $("#postForm");
      form.dataset.replyTo = reply.dataset.reply;
      form.querySelector(".reply-composer-context")?.remove();
      const context = document.createElement("p");
      context.className = "reply-composer-context";
      context.textContent = `Replying to a post · `;
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => {
        delete form.dataset.replyTo;
        context.remove();
      });
      context.append(cancel);
      form.querySelector(".eyebrow").after(context);
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      form.elements.body.focus();
      return;
    }
    if (editPost) {
      const previous = decodeURIComponent(editPost.dataset.postBody || "");
      const body = window.prompt("Edit your post:", previous)?.trim();
      if (body === undefined || body === previous) return;
      if (!body) return say("A post cannot be empty.", "error");
      const { error } = await db
        .from("posts")
        .update({ body, updated_at: new Date().toISOString() })
        .eq("id", editPost.dataset.editPost)
        .eq("author_id", user.sub);
      if (error) throw error;
      return loadPosts();
    }
    if (reportPost) {
      const reason = window.prompt(
        "Report reason: spam, harassment, scam, impersonation, illegal, or other",
        "spam",
      );
      if (!reason) return;
      const normalized = reason.trim().toLowerCase();
      if (
        ![
          "spam",
          "harassment",
          "scam",
          "impersonation",
          "illegal",
          "other",
        ].includes(normalized)
      )
        return say("Choose a listed report reason.", "error");
      const { error } = await db.from("community_reports").insert({
        reporter_id: user.sub,
        target_type: "post",
        target_id: reportPost.dataset.reportPost,
        reason: normalized,
      });
      if (error) throw error;
      return say("Report sent to the moderation queue.", "success");
    }
    if (
      deletePost &&
      (await window.cuteConfirm("This post will disappear for everyone.", {
        title: "Delete this post?",
        danger: true,
      }))
    ) {
      const { error } = await db
        .from("posts")
        .delete()
        .eq("id", deletePost.dataset.deletePost)
        .eq("author_id", user.sub);
      if (error) throw error;
      return loadPosts();
    }
    if (editComment) {
      const before = decodeURIComponent(editComment.dataset.commentBody || "");
      const body = window
        .prompt("Edit your comment — make it lovely:", before)
        ?.trim();
      if (body === undefined || body === before) return;
      if (!body) return say("A comment cannot be empty.", "error");
      const { error } = await db
        .from("comments")
        .update({ body, updated_at: new Date().toISOString() })
        .eq("id", editComment.dataset.editComment)
        .eq("author_id", user.sub);
      if (error) throw error;
      return loadPosts();
    }
    if (
      deleteComment &&
      (await window.cuteConfirm(
        "This comment will be removed from the conversation.",
        { title: "Remove this comment?", danger: true },
      ))
    ) {
      const { error } = await db
        .from("comments")
        .delete()
        .eq("id", deleteComment.dataset.deleteComment);
      if (error) throw error;
      return loadPosts();
    }
    if (like) {
      const postId = like.dataset.like;
      const alreadyLiked = like.classList.contains("liked");
      const { error } = alreadyLiked
        ? await db
            .from("post_reactions")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", user.sub)
        : await db
            .from("post_reactions")
            .insert({ post_id: postId, user_id: user.sub });
      if (error) throw error;
      await loadPosts();
    }
    if (bookmark) {
      const postId = bookmark.dataset.bookmark;
      const saved = bookmark.classList.contains("liked");
      const { error } = saved
        ? await db
            .from("post_bookmarks")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", user.sub)
        : await db
            .from("post_bookmarks")
            .insert({ post_id: postId, user_id: user.sub });
      if (error) throw error;
      await loadPosts();
    }
    if (repost) {
      const postId = repost.dataset.repost;
      const alreadyReposted = repost.classList.contains("liked");
      let quote = "";
      if (!alreadyReposted) {
        const quoteInput = window.prompt("Add a quote to your repost (optional):", "");
        if (quoteInput === null) return;
        quote = quoteInput;
        if (quote.length > 500)
          return say("A repost quote can be up to 500 characters.", "error");
      }
      const { error } = alreadyReposted
        ? await db
            .from("post_reposts")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", user.sub)
        : await db
            .from("post_reposts")
            .insert({ post_id: postId, user_id: user.sub, quote });
      if (error) throw error;
      await loadPosts();
    }
    if (share) {
      const url = `${window.location.origin}${window.location.pathname}#post-${share.dataset.share}`;
      const text =
        share.dataset.shareText || "A lovely update from AR Community";
      if (navigator.share)
        await navigator.share({ title: "AR Community", text, url });
      else
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
          "_blank",
          "noopener,noreferrer",
        );
    }
  } catch (error) {
    if (error.name !== "AbortError") say(error.message, "error");
  }
});

$("#feedMode").addEventListener("change", async (event) => {
  feedMode = event.currentTarget.value;
  try {
    await loadPosts();
  } catch (error) {
    say(error.message, "error");
  }
});

$("#loadMorePosts").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  try {
    await loadPosts({ append: true });
  } catch (error) {
    say(error.message, "error");
  } finally {
    event.currentTarget.disabled = false;
  }
});

$("#postFeed").addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-comment-form]");
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector("input");
  const body = input.value.trim();
  if (!body) return;
  const { error } = await db
    .from("comments")
    .insert({ post_id: form.dataset.commentForm, author_id: user.sub, body });
  if (error) return say(error.message, "error");
  input.value = "";
  await loadPosts();
});

$("#peopleSearch").addEventListener("input", () =>
  searchPeople($("#peopleSearch").value).catch((error) =>
    say(error.message, "error"),
  ),
);
$("#peopleResults").addEventListener("click", (event) => {
  const follow = event.target.closest("[data-follow]");
  const message = event.target.closest("[data-message]");
  const profileButton = event.target.closest("[data-profile]");
  if (follow)
    setFollow(follow.dataset.follow, follow.dataset.following === "true").catch(
      (error) => say(error.message, "error"),
    );
  if (message)
    openChat(message.dataset.message, message.dataset.name).catch((error) =>
      say(error.message, "error"),
    );
  if (profileButton)
    openProfile(profileButton.dataset.profile).catch((error) =>
      say(error.message, "error"),
    );
});

$("#messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.elements.body;
  const attachment = recordedVoiceFile || form.elements.attachment.files[0];
  try {
    const mediaUrl = attachment
      ? await uploadImage("dm-media", attachment)
      : null;
    const { error } = await db.rpc("send_media_message", {
      recipient: activeChat.id,
      message_body: input.value.trim(),
      media_url: mediaUrl,
      media_type: attachment?.type || null,
    });
    if (error) {
      if (error.code === "42501")
        return say("This member's privacy settings do not allow this message.", "error");
      return say(error.message, "error");
    }
    form.reset();
    recordedVoiceFile = null;
    if (voiceNoteButton) {
      voiceNoteButton.textContent = "🎙 Voice note";
      voiceNoteButton.classList.remove("is-ready", "is-recording");
    }
    await loadMessages();
  } catch (error) {
    say(error.message || "Message could not be sent.", "error");
  }
});
const voiceNoteButton = document.createElement("button");
voiceNoteButton.type = "button";
voiceNoteButton.className = "follow-button";
voiceNoteButton.id = "voiceNote";
voiceNoteButton.textContent = "🎙 Voice note";
$("#voiceText")?.remove();
$("#messageForm")
  ?.querySelector("button[type=submit]")
  ?.before(voiceNoteButton);
let voiceRecorder = null,
  voiceChunks = [],
  recordedVoiceFile = null;
voiceNoteButton.addEventListener("click", async () => {
  try {
    if (voiceRecorder?.state === "recording") {
      voiceRecorder.stop();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks = [];
    voiceRecorder = new MediaRecorder(stream);
    voiceRecorder.ondataavailable = (event) => {
      if (event.data.size) voiceChunks.push(event.data);
    };
    voiceRecorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const mime = voiceRecorder.mimeType || "audio/webm";
      const blob = new Blob(voiceChunks, { type: mime });
      recordedVoiceFile = new File(
        [blob],
        "voice-note-" + Date.now() + ".webm",
        { type: mime },
      );
      voiceNoteButton.textContent = "✓ Voice note ready — tap Send";
      voiceNoteButton.classList.remove("is-recording");
      voiceNoteButton.classList.add("is-ready");
    };
    voiceRecorder.start();
    voiceNoteButton.textContent = "■ Stop recording";
    voiceNoteButton.classList.add("is-recording");
  } catch (error) {
    say(error.message || "Microphone permission is required.", "error");
  }
});
$("#messageShortcuts").addEventListener("click", (event) => {
  if (event.target.matches("button")) {
    $("#messageForm").elements.body.value = event.target.textContent;
    $("#messageForm").elements.body.focus();
  }
});

$("#audioCallButton").addEventListener("click", () => startCall("audio"));
$("#callButton").addEventListener("click", () => startCall("video"));
$("#acceptCall").addEventListener("click", acceptCall);
$("#endCall").addEventListener("click", () => endCall());
$("#closeCall").addEventListener("click", () => endCall());
$("#logoutButton").addEventListener("click", () => window.logout());
$("#closeProfile").addEventListener("click", () => $("#profileDialog").close());
$("#profileDetails").addEventListener("click", (event) => {
  const message = event.target.closest("[data-message]");
  const person = event.target.closest("[data-profile]");
  const memberAction = event.target.closest("[data-member-action]");
  if (message) {
    $("#profileDialog").close();
    return openChat(message.dataset.message, message.dataset.name).catch(
      (error) => say(error.message, "error"),
    );
  }
  if (person) {
    $("#profileDialog").close();
    return openProfile(person.dataset.profile).catch((error) =>
      say(error.message, "error"),
    );
  }
  if (memberAction) {
    const memberId = memberAction.dataset.memberId;
    const action = memberAction.dataset.memberAction;
    const active = memberAction.dataset.active === "true";
    const run = async () => {
      if (action === "follow") {
        await setFollow(memberId, active);
      } else if (action === "block" || action === "mute") {
        const table = action === "block" ? "member_blocks" : "member_mutes";
        const ownerColumn = action === "block" ? "blocker_id" : "muter_id";
        const targetColumn = action === "block" ? "blocked_id" : "muted_id";
        const request = active
          ? db
              .from(table)
              .delete()
              .eq(ownerColumn, user.sub)
              .eq(targetColumn, memberId)
          : db.from(table).insert({
              [ownerColumn]: user.sub,
              [targetColumn]: memberId,
            });
        const { error } = await request;
        if (error) throw error;
      } else if (action === "report") {
        const reason = window.prompt(
          "Report reason: spam, harassment, scam, impersonation, illegal, or other",
          "other",
        );
        if (!reason) return;
        const normalized = reason.trim().toLowerCase();
        if (
          ![
            "spam",
            "harassment",
            "scam",
            "impersonation",
            "illegal",
            "other",
          ].includes(normalized)
        )
          throw new Error("Choose a listed report reason.");
        const { error } = await db.from("community_reports").insert({
          reporter_id: user.sub,
          target_type: "user",
          target_id: memberId,
          reason: normalized,
        });
        if (error) throw error;
        say("Report sent to the moderation queue.", "success");
        return;
      }
      await openProfile(memberId);
      if (action === "block" && !active) {
        activeChat = null;
        if (realtimeChannel) {
          await db.removeChannel(realtimeChannel);
          realtimeChannel = null;
        }
        $("#messageForm").hidden = true;
        $("#messageShortcuts").hidden = true;
        $("#chatTitle").textContent = "Choose a person";
        $("#messageList").textContent = "Search for a person, then press Message.";
      }
      say(
        `${action === "follow" ? (active ? "Unfollowed" : "Following") : action === "block" ? (active ? "Member unblocked" : "Member blocked") : active ? "Member unmuted" : "Member muted"}.`,
        "success",
      );
    };
    run().catch((error) => say(error.message, "error"));
    return;
  }
  const staff = event.target.closest("[data-staff-action]");
  if (staff)
    window
      .cuteConfirm(`Apply ${staff.dataset.staffAction} for this member?`, {
        title: "Update community role",
      })
      .then((ok) => {
        if (!ok) return;
        return db.auth
          .getSession()
          .then(({ data: { session } }) =>
            fetch("/api/staff", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.access_token || ""}`,
              },
              body: JSON.stringify({
                action: staff.dataset.staffAction,
                id: staff.dataset.staffId,
              }),
            }),
          )
          .then(async (response) => {
            const body = await response.json();
            if (!response.ok) throw new Error(body.error);
            say("Staff action applied.", "success");
          })
          .catch((error) => say(error.message, "error"));
      });
});
document
  .querySelector(".community-mobile-nav")
  .addEventListener("click", (event) => {
    const action = event.target.closest("[data-community-action]")?.dataset
      .communityAction;
    if (!action) return;
    if (action === "profile")
      return openProfile(user.sub).catch((error) =>
        say(error.message, "error"),
      );
    const target = {
      feed: ".community-feed",
      search: "#peopleSearch",
      messages: ".messages-panel",
    }[action];
    document
      .querySelector(target)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (action === "search") setTimeout(() => $("#peopleSearch").focus(), 350);
  });

(async () => {
  try {
    const auth = await window.arraiAuth;
    if (!auth.isAuthenticated) {
      const next = new URLSearchParams(location.search).get("membership") === "1"
        ? "?next=membership"
        : "";
      return window.location.assign(`auth.html${next}`);
    }
    user = auth.user;
    db = await window.createArraiSupabase();
    if (await loadProfile()) {
      await Promise.all([loadPosts(), loadReels(), searchPeople()]);
      subscribeToCalls();
      window.dispatchEvent(
        new CustomEvent("arrai:profile-ready", { detail: { db, user, profile } }),
      );
      if (new URLSearchParams(location.search).get("membership") === "1") {
        await openAccountSettings();
      }
    }
  } catch (error) {
    say(error.message || "Could not load the community.", "error");
  }
})();
