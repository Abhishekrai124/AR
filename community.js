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
let queuedCandidates = [];
const communityOwnerEmail = "abhishekrai6897@gmail.com";
const isOwner = () => user?.email?.toLowerCase() === communityOwnerEmail;

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
const badge = (profileData) => `${profileData?.community_role === "owner" ? '<span class="owner-tag" title="AR owner">arrai.in · OWNER</span>' : ""}${profileData?.blue_tick ? '<span class="verified blue" title="Blue tick">✓</span>' : ""}${profileData?.gold_tick ? '<span class="verified gold" title="Gold tick">✓</span>' : ""}`;

async function openProfile(profileId) {
  const [{ data: person, error }, { count: followerCount }, { count: followingCount }, { data: posts, error: postError }, { data: followers, error: followerError }, { data: following, error: followingError }] = await Promise.all([
    db.from("profiles").select("id, username, display_name, bio, avatar_url, is_vip, blue_tick, gold_tick, community_role, created_at").eq("id", profileId).single(),
    db.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileId),
    db.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileId),
    db.from("posts").select("id, body, image_url, created_at").eq("author_id", profileId).order("created_at", { ascending: false }).limit(24),
    db.from("follows").select("profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)").eq("following_id", profileId).limit(24),
    db.from("follows").select("profiles!follows_following_id_fkey(id, username, display_name, avatar_url)").eq("follower_id", profileId).limit(24),
  ]);
  if (error || postError || followerError || followingError) throw error || postError || followerError || followingError;
  if (person.privacy === "private" && profileId !== user.sub) {
    const { data: access, error: accessError } = await db.from("follows").select("following_id").eq("follower_id", user.sub).eq("following_id", profileId).maybeSingle();
    if (accessError) throw accessError;
    if (!access) {
      $("#profileDetails").innerHTML = `<section class="instagram-profile"><img class="profile-hero-avatar" src="${avatar(person)}" alt="" /><div><p class="eyebrow">Private account</p><h2>${escapeHtml(person.display_name)} ${badge(person)}</h2><p class="profile-handle">@${escapeHtml(person.username)}</p><p>This profile is visible to approved followers only.</p></div></section>`;
      return $("#profileDialog").showModal();
    }
  }
  const memberList = (rows) => (rows || []).map((row) => row.profiles).filter(Boolean).map((member) => `<button class="profile-member" type="button" data-profile="${escapeHtml(member.id)}" data-name="${escapeHtml(member.display_name)}"><img src="${avatar(member)}" alt="" />${escapeHtml(member.display_name)} <small>@${escapeHtml(member.username)}</small></button>`).join("") || '<span class="empty-state">None yet</span>';
  $("#profileDetails").innerHTML = `<section class="instagram-profile"><img class="profile-hero-avatar" src="${avatar(person)}" alt="" /><div><p class="eyebrow">${person.is_vip ? "✦ VIP member" : "AR member"}</p><h2>${escapeHtml(person.display_name)}</h2><p class="profile-handle">@${escapeHtml(person.username)}</p><p>${escapeHtml(person.bio || "No bio yet.")}</p><div class="profile-stats"><span><b>${posts.length}</b> posts</span><span><b>${followerCount || 0}</b> followers</span><span><b>${followingCount || 0}</b> following</span></div></div></section><section class="profile-lists"><div><p class="eyebrow">Followers</p>${memberList(followers, "follower")}</div><div><p class="eyebrow">Following</p>${memberList(following, "following")}</div></section><section class="profile-posts"><p class="eyebrow">Posts</p>${posts.length ? posts.map((post) => `<article class="social-card"><small>${new Date(post.created_at).toLocaleDateString()}</small><p>${escapeHtml(post.body)}</p>${post.image_url ? `<img src="${post.image_url}" alt="Member post" />` : ""}</article>`).join("") : '<p class="empty-state">No posts yet.</p>'}</section>`;
  $("#profileDetails h2").insertAdjacentHTML("beforeend", ` ${badge(person)}`);
  if (profileId !== user.sub) $("#profileDetails .instagram-profile > div").insertAdjacentHTML("beforeend", `<button class="message-button profile-message" type="button" data-message="${escapeHtml(person.id)}" data-name="${escapeHtml(person.display_name)}">Message</button>`);
  if (profileId !== user.sub && ["moderator", "admin", "owner"].includes(profile.community_role)) $("#profileDetails .instagram-profile > div").insertAdjacentHTML("beforeend", `<span class="staff-actions"><button class="follow-button" type="button" data-staff-action="suspended" data-staff-id="${escapeHtml(person.id)}">Suspend</button><button class="follow-button" type="button" data-staff-action="active" data-staff-id="${escapeHtml(person.id)}">Restore</button>${["admin", "owner"].includes(profile.community_role) ? `<button class="follow-button" type="button" data-staff-action="banned" data-staff-id="${escapeHtml(person.id)}">Ban</button>` : ""}</span>`);
  $("#profileDialog").showModal();
}

async function uploadImage(bucket, file) {
  if (!file) return null;
  const maxSize = bucket === "dm-media" ? 25 : 5;
  if (file.size > maxSize * 1024 * 1024) throw new Error(`${bucket === "dm-media" ? "DM media" : "Images"} must be ${maxSize} MB or smaller.`);
  const extension = file.name.split(".").pop() || "jpg";
  const path = `${user.sub}/${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function loadProfile() {
  const { data, error } = await db.from("profiles").select("*").eq("id", user.sub).maybeSingle();
  if (error) throw error;
  profile = data;
  if (!profile) {
    setup.hidden = false;
    if (isOwner()) {
      $("#profileForm [name='username']").value = "abhishekrai6897";
      $("#profileForm [name='displayName']").value = "Abhishek Rai";
      $("#profileForm [name='bio']").value = "Founder & CEO of AR · Building digital dreams with care.";
    }
    say("Set up your public profile to join the community.");
    return false;
  }
  setup.hidden = true;
  app.hidden = false;
  $("#myAvatar").src = avatar(profile);
  $("#myName").textContent = profile.display_name;
  $("#myHandle").textContent = `@${profile.username}`;
  $("#membershipBadge").textContent = profile.is_vip ? "✦ VIP member" : "Standard member";
  $("#membershipBadge").innerHTML = isOwner() ? "♛ Owner · all access" : profile.is_vip ? `${badge(profile)} VIP member` : "Standard member";
  $("#themeSelect").value = profile.theme || "midnight";
  document.body.dataset.theme = profile.theme || "midnight";
  say("You’re connected.", "success");
  return true;
}

async function loadPosts() {
  const { data, error } = await db
    .from("posts")
    .select("id, author_id, body, image_url, created_at, profiles!posts_author_id_fkey(id, username, display_name, avatar_url, blue_tick, gold_tick, community_role)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  const postIds = data.map((post) => post.id);
  const [{ data: comments, error: commentError }, { data: reactions, error: reactionError }] = postIds.length
    ? await Promise.all([
        db.from("comments").select("id, post_id, body, created_at, author_id, profiles!comments_author_id_fkey(username, display_name, avatar_url)").in("post_id", postIds).order("created_at", { ascending: true }),
        db.from("post_reactions").select("post_id, user_id").in("post_id", postIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (commentError || reactionError) throw commentError || reactionError;
  const commentsByPost = (comments || []).reduce((all, comment) => ((all[comment.post_id] ||= []).push(comment), all), {});
  const reactionsByPost = (reactions || []).reduce((all, reaction) => ((all[reaction.post_id] ||= []).push(reaction), all), {});
  $("#postFeed").innerHTML = data.length
    ? data
        .map(
          (post) => {
            const postComments = commentsByPost[post.id] || [];
            const postReactions = reactionsByPost[post.id] || [];
            const liked = postReactions.some((reaction) => reaction.user_id === user.sub);
            return `<article class="social-card post" id="post-${post.id}"><img class="post-avatar" src="${avatar(post.profiles)}" alt="" /><div><button type="button" class="profile-link" data-profile="${post.profiles.id}">${escapeHtml(post.profiles.display_name)} ${badge(post.profiles)}</button><span>@${escapeHtml(post.profiles.username)} · ${new Date(post.created_at).toLocaleDateString()}</span><p>${escapeHtml(post.body)}</p>${post.image_url ? `<img class="post-image" src="${post.image_url}" alt="Post image" />` : ""}<div class="post-tools"><button type="button" data-like="${post.id}" class="${liked ? "liked" : ""}">♡ ${postReactions.length || ""}</button><button type="button" data-share="${post.id}" data-share-text="${escapeHtml(post.body.slice(0, 160))}">↗ Share</button>${post.author_id === user.sub ? `<button type="button" data-delete-post="${post.id}">Delete</button>` : ""}<span>${postComments.length} comment${postComments.length === 1 ? "" : "s"}</span></div><div class="comment-list">${postComments.slice(-3).map((comment) => `<p><b>${escapeHtml(comment.profiles?.display_name || "Member")}</b> ${escapeHtml(comment.body)} ${comment.author_id === user.sub ? `<button type="button" data-delete-comment="${comment.id}">Delete</button>` : ""}</p>`).join("")}</div><form class="comment-form" data-comment-form="${post.id}"><input maxlength="500" required placeholder="Write a kind comment…" /><button type="submit">Send</button></form></div></article>`;
          },
        )
        .join("")
    : '<p class="empty-state">No posts yet. Be the first to share something.</p>';
}

async function searchPeople(query = "") {
  let request = db.from("profiles").select("id, username, display_name, avatar_url").neq("id", user.sub).order("username").limit(8);
  if (query) request = request.ilike("username", `%${query.toLowerCase()}%`);
  const [{ data: people, error }, { data: following, error: followError }] = await Promise.all([
    request,
    db.from("follows").select("following_id").eq("follower_id", user.sub),
  ]);
  if (error || followError) throw error || followError;
  const followed = new Set(following.map((row) => row.following_id));
  $("#peopleResults").innerHTML = people.length
    ? people
        .map(
          (person) => `<div class="person-row"><img src="${avatar(person)}" alt="" /><div><b>${escapeHtml(person.display_name)}</b><small>@${escapeHtml(person.username)}</small></div><button class="follow-button" data-profile="${person.id}">Profile</button><button class="follow-button" data-follow="${person.id}" data-following="${followed.has(person.id)}">${followed.has(person.id) ? "Following" : "Follow"}</button><button class="message-button" data-message="${person.id}" data-name="${escapeHtml(person.display_name)}">Message</button></div>`,
        )
        .join("")
    : '<p class="empty-state">No people found.</p>';
}

async function setFollow(personId, following) {
  const request = following
    ? db.from("follows").delete().eq("follower_id", user.sub).eq("following_id", personId)
    : db.from("follows").insert({ follower_id: user.sub, following_id: personId });
  const { error } = await request;
  if (error) throw error;
  await searchPeople($("#peopleSearch").value);
}

async function openChat(personId, name) {
  activeChat = { id: personId, name };
  $("#chatTitle").textContent = name;
  $("#messageForm").hidden = false;
  $("#messageShortcuts").hidden = false;
  $("#callButton").disabled = false;
  await loadMessages();
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  realtimeChannel = db
    .channel(`dm:${[user.sub, personId].sort().join(":")}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
      const message = payload.new;
      if ([message.sender_id, message.recipient_id].includes(user.sub) && [message.sender_id, message.recipient_id].includes(personId)) loadMessages();
    })
    .subscribe();
}

async function loadMessages() {
  if (!activeChat) return;
  const { data, error } = await db
    .from("direct_messages")
    .select("id, sender_id, body, attachment_url, attachment_type, created_at")
    .or(`and(sender_id.eq.${user.sub},recipient_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},recipient_id.eq.${user.sub})`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  $("#messageList").innerHTML = data.length
    ? data.map((message) => `<div class="message ${message.sender_id === user.sub ? "mine" : "theirs"}">${message.body ? `<p>${escapeHtml(message.body)}</p>` : ""}${message.attachment_url ? message.attachment_type?.startsWith("image/") ? `<img src="${escapeHtml(message.attachment_url)}" alt="Shared image" />` : message.attachment_type?.startsWith("video/") ? `<video src="${escapeHtml(message.attachment_url)}" controls playsinline></video>` : `<audio src="${escapeHtml(message.attachment_url)}" controls></audio>` : ""}</div>`).join("")
    : '<p class="empty-state">Say hello to start the conversation.</p>';
  $("#messageList").scrollTop = $("#messageList").scrollHeight;
}

async function sendCallSignal(recipientId, kind, payload = {}) {
  const { error } = await db.from("call_signals").insert({ call_id: activeCall?.id || pendingCall?.id, sender_id: user.sub, recipient_id: recipientId, kind, payload });
  if (error) throw error;
}

async function getPeerConnection() {
  const response = await fetch("/api/turn");
  if (!response.ok) throw new Error("Call service is unavailable. Please try again.");
  const iceServers = await response.json();
  peerConnection = new RTCPeerConnection({ iceServers });
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  $("#localVideo").srcObject = localStream;
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
  peerConnection.ontrack = (event) => { $("#remoteVideo").srcObject = event.streams[0]; };
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && activeCall) sendCallSignal(activeCall.otherId, "candidate", event.candidate.toJSON()).catch(() => {});
  };
  peerConnection.onconnectionstatechange = () => {
    if (["failed", "disconnected"].includes(peerConnection.connectionState)) endCall(false);
  };
  return peerConnection;
}

function showCallDialog() {
  const dialog = $("#callDialog");
  if (!dialog.open) dialog.showModal();
}

async function startCall() {
  try {
    activeCall = { id: crypto.randomUUID(), otherId: activeChat.id };
    $("#callState").textContent = "Connecting secure video call";
    $("#callTitle").textContent = `Calling ${activeChat.name}…`;
    $("#acceptCall").hidden = true;
    showCallDialog();
    const connection = await getPeerConnection();
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await sendCallSignal(activeChat.id, "offer", { description: offer, callerName: profile.display_name });
  } catch (error) { endCall(false); say(error.message, "error"); }
}

async function acceptCall() {
  if (!pendingCall) return;
  try {
    activeCall = { id: pendingCall.id, otherId: pendingCall.sender_id };
    $("#callState").textContent = "Connecting secure video call";
    $("#callTitle").textContent = `Calling ${pendingCall.payload.callerName || "friend"}…`;
    $("#acceptCall").hidden = true;
    const connection = await getPeerConnection();
    await connection.setRemoteDescription(pendingCall.payload.description);
    for (const candidate of queuedCandidates) await connection.addIceCandidate(candidate);
    queuedCandidates = [];
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    await sendCallSignal(activeCall.otherId, "answer", { description: answer });
    pendingCall = null;
  } catch (error) { endCall(false); say(error.message, "error"); }
}

async function handleCallSignal(signal) {
  if (signal.recipient_id !== user.sub) return;
  if (signal.kind === "offer") {
    pendingCall = signal;
    queuedCandidates = [];
    $("#callState").textContent = "Incoming video call";
    $("#callTitle").textContent = `${signal.payload.callerName || "Someone"} is calling`;
    $("#acceptCall").hidden = false;
    showCallDialog();
    return;
  }
  if (signal.kind === "candidate" && pendingCall && signal.call_id === pendingCall.id) {
    queuedCandidates.push(signal.payload);
    return;
  }
  if (!activeCall || signal.call_id !== activeCall.id) return;
  if (signal.kind === "answer") {
    await peerConnection.setRemoteDescription(signal.payload.description);
    for (const candidate of queuedCandidates) await peerConnection.addIceCandidate(candidate);
    queuedCandidates = [];
  }
  if (signal.kind === "candidate") {
    if (peerConnection?.remoteDescription) await peerConnection.addIceCandidate(signal.payload);
    else queuedCandidates.push(signal.payload);
  }
  if (signal.kind === "hangup") endCall(false);
}

async function endCall(notify = true) {
  const otherId = activeCall?.otherId || pendingCall?.sender_id;
  if (notify && otherId && (activeCall || pendingCall)) {
    try { await sendCallSignal(otherId, "hangup"); } catch {}
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
  if ($("#callDialog").open) $("#callDialog").close();
}

function subscribeToCalls() {
  callChannel = db.channel(`calls:${user.sub}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals" }, (payload) => handleCallSignal(payload.new).catch((error) => say(error.message, "error"))).subscribe();
}

async function openAccountSettings() {
  const [{ count: postCount }, { count: followerCount }, { count: followingCount }] = await Promise.all([
    db.from("posts").select("*", { count: "exact", head: true }).eq("author_id", user.sub),
    db.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.sub),
    db.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.sub),
  ]);
  const form = $("#accountForm");
  form.elements.privacy.value = profile.privacy || "public";
  form.elements.bio.value = profile.bio || "";
  form.elements.theme.value = profile.theme || "midnight";
  $("#accountActivity").innerHTML = `<span><b>${postCount || 0}</b> posts</span><span><b>${followerCount || 0}</b> followers</span><span><b>${followingCount || 0}</b> following</span>`;
  $("#accountDialog").showModal();
}

$("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const { error } = await db.from("profiles").insert({ id: user.sub, username: data.get("username").trim().toLowerCase(), display_name: data.get("displayName").trim(), date_of_birth: data.get("dateOfBirth"), gender: data.get("gender"), privacy: data.get("privacy"), bio: data.get("bio").trim() });
  if (error) return say(error.code === "23505" ? "That username is already taken." : error.message, "error");
  if (await loadProfile()) {
    await Promise.all([loadPosts(), searchPeople()]);
    subscribeToCalls();
  }
});

$("#accountSettings").addEventListener("click", () => openAccountSettings().catch((error) => say(error.message, "error")));
$("#closeAccount").addEventListener("click", () => $("#accountDialog").close());
$("#accountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const theme = data.get("theme");
  if (theme !== "midnight" && !profile.is_vip && !isOwner()) return say("Exclusive themes are available with VIP membership.", "error");
  const { error } = await db.from("profiles").update({ privacy: data.get("privacy"), bio: data.get("bio").trim(), theme }).eq("id", user.sub);
  if (error) return say(error.message, "error");
  Object.assign(profile, { privacy: data.get("privacy"), bio: data.get("bio").trim(), theme });
  document.body.dataset.theme = theme;
  $("#themeSelect").value = theme;
  $("#accountDialog").close();
  say("Account settings saved. ✦", "success");
});
$("#deleteMyAccount").addEventListener("click", async () => {
  if (!confirm("Permanently delete your account and all community content? This cannot be undone.")) return;
  if (!confirm("Final confirmation: delete my account now.")) return;
  try {
    const { data: { session } } = await db.auth.getSession();
    const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify({ action: "delete-my-account" }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Account deletion failed.");
    await db.auth.signOut();
    window.location.assign("index.html");
  } catch (error) { say(error.message, "error"); }
});

$("#avatarInput").addEventListener("change", async (event) => {
  try {
    const avatarUrl = await uploadImage("avatars", event.target.files[0]);
    const { error } = await db.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.sub);
    if (error) throw error;
    profile.avatar_url = avatarUrl;
    $("#myAvatar").src = avatarUrl;
    say("Profile photo updated.", "success");
  } catch (error) { say(error.message, "error"); }
});

$("#themeSelect").addEventListener("change", async (event) => {
  const theme = event.target.value;
  if (theme !== "midnight" && !profile.is_vip && !isOwner()) { event.target.value = profile.theme || "midnight"; return say("Exclusive themes are available with VIP membership.", "error"); }
  const { error } = await db.from("profiles").update({ theme }).eq("id", user.sub);
  if (error) return say(error.message, "error");
  profile.theme = theme; document.body.dataset.theme = theme; say("Your theme has been updated. ✦", "success");
});

$("#postForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = new FormData(event.currentTarget);
    const imageUrl = await uploadImage("post-media", data.get("image"));
    const { error } = await db.from("posts").insert({ author_id: user.sub, body: data.get("body").trim(), image_url: imageUrl });
    if (error) throw error;
    event.currentTarget.reset();
    await loadPosts();
    say("Post published.", "success");
  } catch (error) { say(error.message, "error"); }
});

async function loadReels() {
  const { data, error } = await db.from("reels").select("id, author_id, video_url, caption, profiles!reels_author_id_fkey(id, username, display_name, avatar_url, blue_tick, gold_tick, community_role)").order("created_at", { ascending: false }).limit(18);
  if (error) throw error;
  $("#reelFeed").innerHTML = data.map((reel) => `<article class="social-card reel"><video src="${reel.video_url}" controls playsinline preload="metadata"></video><p><button type="button" class="profile-link" data-profile="${reel.profiles.id}">${escapeHtml(reel.profiles.display_name)} ${badge(reel.profiles)}</button> @${escapeHtml(reel.profiles.username)}</p><p>${escapeHtml(reel.caption)}</p>${reel.author_id === user.sub ? `<button class="follow-button" type="button" data-delete-reel="${reel.id}">Delete reel</button>` : ""}</article>`).join("");
}
$("#reelForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = new FormData(event.currentTarget), video = data.get("video");
    if (video.size > 75 * 1024 * 1024) throw new Error("Reels must be 75 MB or smaller.");
    const videoUrl = await uploadImage("reel-media", video);
    const { error } = await db.from("reels").insert({ author_id: user.sub, video_url: videoUrl, caption: data.get("caption").trim() });
    if (error) throw error;
    event.currentTarget.reset(); await loadReels(); say("Reel published. ✦", "success");
  } catch (error) { say(error.message, "error"); }
});
$("#reelFeed").addEventListener("click", async (event) => {
  const profileButton = event.target.closest("[data-profile]"), remove = event.target.closest("[data-delete-reel]");
  try {
    if (profileButton) return openProfile(profileButton.dataset.profile);
    if (remove && confirm("Delete your reel?")) { const { error } = await db.from("reels").delete().eq("id", remove.dataset.deleteReel).eq("author_id", user.sub); if (error) throw error; await loadReels(); }
  } catch (error) { say(error.message, "error"); }
});

$("#postFeed").addEventListener("click", async (event) => {
  const like = event.target.closest("[data-like]");
  const share = event.target.closest("[data-share]");
  const profileButton = event.target.closest("[data-profile]");
  const deletePost = event.target.closest("[data-delete-post]");
  const deleteComment = event.target.closest("[data-delete-comment]");
  try {
    if (profileButton) return openProfile(profileButton.dataset.profile);
    if (deletePost && confirm("Delete your post?")) { const { error } = await db.from("posts").delete().eq("id", deletePost.dataset.deletePost).eq("author_id", user.sub); if (error) throw error; return loadPosts(); }
    if (deleteComment && confirm("Delete your comment?")) { const { error } = await db.from("comments").delete().eq("id", deleteComment.dataset.deleteComment).eq("author_id", user.sub); if (error) throw error; return loadPosts(); }
    if (like) {
      const postId = like.dataset.like;
      const alreadyLiked = like.classList.contains("liked");
      const { error } = alreadyLiked
        ? await db.from("post_reactions").delete().eq("post_id", postId).eq("user_id", user.sub)
        : await db.from("post_reactions").insert({ post_id: postId, user_id: user.sub });
      if (error) throw error;
      await loadPosts();
    }
    if (share) {
      const url = `${window.location.origin}${window.location.pathname}#post-${share.dataset.share}`;
      const text = share.dataset.shareText || "A lovely update from AR Community";
      if (navigator.share) await navigator.share({ title: "AR Community", text, url });
      else window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
    }
  } catch (error) { if (error.name !== "AbortError") say(error.message, "error"); }
});

$("#postFeed").addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-comment-form]");
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector("input");
  const body = input.value.trim();
  if (!body) return;
  const { error } = await db.from("comments").insert({ post_id: form.dataset.commentForm, author_id: user.sub, body });
  if (error) return say(error.message, "error");
  input.value = "";
  await loadPosts();
});

$("#peopleSearch").addEventListener("input", () => searchPeople($("#peopleSearch").value).catch((error) => say(error.message, "error")));
$("#peopleResults").addEventListener("click", (event) => {
  const follow = event.target.closest("[data-follow]");
  const message = event.target.closest("[data-message]");
  const profileButton = event.target.closest("[data-profile]");
  if (follow) setFollow(follow.dataset.follow, follow.dataset.following === "true").catch((error) => say(error.message, "error"));
  if (message) openChat(message.dataset.message, message.dataset.name).catch((error) => say(error.message, "error"));
  if (profileButton) openProfile(profileButton.dataset.profile).catch((error) => say(error.message, "error"));
});

$("#messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.body;
  const attachment = event.currentTarget.elements.attachment.files[0];
  const mediaUrl = attachment ? await uploadImage("dm-media", attachment) : null;
  const { error } = await db.rpc("send_media_message", { recipient: activeChat.id, message_body: input.value.trim(), media_url: mediaUrl, media_type: attachment?.type || null });
  if (error) return say(error.message, "error");
  event.currentTarget.reset();
  await loadMessages();
});
$("#voiceText").addEventListener("click", () => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return say("Voice-to-text is not supported in this browser. Try Chrome.", "error");
  const recognition = new Recognition(); recognition.lang = navigator.language || "en-IN"; recognition.interimResults = false;
  recognition.onresult = (event) => { const input = $("#messageForm").elements.body; input.value = `${input.value}${input.value ? " " : ""}${event.results[0][0].transcript}`; input.focus(); };
  recognition.onerror = () => say("Could not convert that voice note to text.", "error");
  recognition.start(); say("Listening… speak your message.", "success");
});
$("#messageShortcuts").addEventListener("click", (event) => {
  if (event.target.matches("button")) {
    $("#messageForm").elements.body.value = event.target.textContent;
    $("#messageForm").elements.body.focus();
  }
});

$("#callButton").addEventListener("click", startCall);
$("#acceptCall").addEventListener("click", acceptCall);
$("#endCall").addEventListener("click", () => endCall());
$("#closeCall").addEventListener("click", () => endCall());
$("#logoutButton").addEventListener("click", () => window.logout());
$("#closeProfile").addEventListener("click", () => $("#profileDialog").close());
$("#profileDetails").addEventListener("click", (event) => {
  const message = event.target.closest("[data-message]");
  const person = event.target.closest("[data-profile]");
  if (message) { $("#profileDialog").close(); return openChat(message.dataset.message, message.dataset.name).catch((error) => say(error.message, "error")); }
  if (person) { $("#profileDialog").close(); return openProfile(person.dataset.profile).catch((error) => say(error.message, "error")); }
  const staff = event.target.closest("[data-staff-action]");
  if (staff && confirm(`Confirm ${staff.dataset.staffAction} for this member?`)) db.auth.getSession().then(({ data: { session } }) => fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify({ action: staff.dataset.staffAction, id: staff.dataset.staffId }) })).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); say("Staff action applied.", "success"); }).catch((error) => say(error.message, "error"));
});
document.querySelector(".community-mobile-nav").addEventListener("click", (event) => {
  const action = event.target.closest("[data-community-action]")?.dataset.communityAction;
  if (!action) return;
  if (action === "profile") return openProfile(user.sub).catch((error) => say(error.message, "error"));
  const target = ({ feed: ".community-feed", search: "#peopleSearch", messages: ".messages-panel" })[action];
  document.querySelector(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (action === "search") setTimeout(() => $("#peopleSearch").focus(), 350);
});

(async () => {
  try {
    const auth = await window.arraiAuth;
    if (!auth.isAuthenticated) return window.location.assign("auth.html");
    user = auth.user;
    db = await window.createArraiSupabase();
    if (await loadProfile()) {
      await Promise.all([loadPosts(), loadReels(), searchPeople()]);
      subscribeToCalls();
    }
  } catch (error) { say(error.message || "Could not load the community.", "error"); }
})();
