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

async function uploadImage(bucket, file) {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be 5 MB or smaller.");
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
    say("Set up your public profile to join the community.");
    return false;
  }
  setup.hidden = true;
  app.hidden = false;
  $("#myAvatar").src = avatar(profile);
  $("#myName").textContent = profile.display_name;
  $("#myHandle").textContent = `@${profile.username}`;
  say("You’re connected.", "success");
  return true;
}

async function loadPosts() {
  const { data, error } = await db
    .from("posts")
    .select("id, body, image_url, created_at, profiles!posts_author_id_fkey(username, display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  $("#postFeed").innerHTML = data.length
    ? data
        .map(
          (post) => `<article class="social-card post"><img class="post-avatar" src="${avatar(post.profiles)}" alt="" /><div><strong>${escapeHtml(post.profiles.display_name)}</strong><span>@${escapeHtml(post.profiles.username)} · ${new Date(post.created_at).toLocaleDateString()}</span><p>${escapeHtml(post.body)}</p>${post.image_url ? `<img class="post-image" src="${post.image_url}" alt="Post image" />` : ""}</div></article>`,
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
          (person) => `<div class="person-row"><img src="${avatar(person)}" alt="" /><div><b>${escapeHtml(person.display_name)}</b><small>@${escapeHtml(person.username)}</small></div><button class="follow-button" data-follow="${person.id}" data-following="${followed.has(person.id)}">${followed.has(person.id) ? "Following" : "Follow"}</button><button class="message-button" data-message="${person.id}" data-name="${escapeHtml(person.display_name)}">Message</button></div>`,
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
    .select("id, sender_id, body, created_at")
    .or(`and(sender_id.eq.${user.sub},recipient_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},recipient_id.eq.${user.sub})`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  $("#messageList").innerHTML = data.length
    ? data.map((message) => `<p class="message ${message.sender_id === user.sub ? "mine" : "theirs"}">${escapeHtml(message.body)}</p>`).join("")
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

$("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const { error } = await db.from("profiles").insert({ id: user.sub, username: data.get("username").trim().toLowerCase(), display_name: data.get("displayName").trim(), bio: data.get("bio").trim() });
  if (error) return say(error.code === "23505" ? "That username is already taken." : error.message, "error");
  if (await loadProfile()) {
    await Promise.all([loadPosts(), searchPeople()]);
    subscribeToCalls();
  }
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

$("#peopleSearch").addEventListener("input", () => searchPeople($("#peopleSearch").value).catch((error) => say(error.message, "error")));
$("#peopleResults").addEventListener("click", (event) => {
  const follow = event.target.closest("[data-follow]");
  const message = event.target.closest("[data-message]");
  if (follow) setFollow(follow.dataset.follow, follow.dataset.following === "true").catch((error) => say(error.message, "error"));
  if (message) openChat(message.dataset.message, message.dataset.name).catch((error) => say(error.message, "error"));
});

$("#messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.body;
  const { error } = await db.from("direct_messages").insert({ sender_id: user.sub, recipient_id: activeChat.id, body: input.value.trim() });
  if (error) return say(error.message, "error");
  input.value = "";
  await loadMessages();
});

$("#callButton").addEventListener("click", startCall);
$("#acceptCall").addEventListener("click", acceptCall);
$("#endCall").addEventListener("click", () => endCall());
$("#closeCall").addEventListener("click", () => endCall());
$("#logoutButton").addEventListener("click", () => window.logoutWithAuth0());

(async () => {
  try {
    const auth = await window.arraiAuth;
    if (!auth.isAuthenticated) return window.location.assign("auth.html");
    user = auth.user;
    db = await window.createArraiSupabase();
    if (await loadProfile()) {
      await Promise.all([loadPosts(), searchPeople()]);
      subscribeToCalls();
    }
  } catch (error) { say(error.message || "Could not load the community.", "error"); }
})();
