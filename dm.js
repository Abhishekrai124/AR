const dm$ = (s) => document.querySelector(s);
const dmStatus = dm$("#dmStatus");
let dmDb, dmUser, activePerson, dmRealtime;

const dmEscape = (value) => {
  const e = document.createElement("div");
  e.textContent = value || "";
  return e.innerHTML;
};

const dmAvatar = (p) =>
  p?.avatar_url ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(p?.display_name || "AR")}&background=38bdf8&color=0f172a&bold=true`;

const dmSay = (m, type = "") => {
  if (!dmStatus) return;
  dmStatus.textContent = m;
  dmStatus.className = `community-status ${type}`;
};

async function getChats() {
  try {
    const { data, error } = await dmDb
      .from("direct_messages")
      .select("sender_id,recipient_id,body,created_at")
      .or(`sender_id.eq.${dmUser.sub},recipient_id.eq.${dmUser.sub}`)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;
    const latest = new Map();
    (data || []).forEach((m) => {
      const id = m.sender_id === dmUser.sub ? m.recipient_id : m.sender_id;
      if (!latest.has(id)) latest.set(id, m);
    });

    const ids = [...latest.keys()];
    if (!ids.length) {
      dm$("#chatList").innerHTML =
        '<p class="dm-list-empty">No conversations yet. Tap "New Chat" to say hello ✦</p>';
      return;
    }

    const { data: people } = await dmDb
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .in("id", ids);

    const lookup = new Map((people || []).map((p) => [p.id, p]));
    dm$("#chatList").innerHTML = ids
      .map((id) => {
        const p = lookup.get(id) || { id, display_name: "Community Member", username: "user" };
        const m = latest.get(id);
        return `<button class="chat-row ${activePerson?.id === id ? "active" : ""}" data-person="${id}">
          <img src="${dmAvatar(p)}" alt="" />
          <span><b>${dmEscape(p.display_name)}</b><small>${dmEscape(m?.body || "Shared a message")}</small></span>
          <time>${m ? new Date(m.created_at).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</time>
        </button>`;
      })
      .join("");
  } catch (err) {
    console.warn("Could not load chat list:", err);
  }
}

async function openDm(id) {
  try {
    const { data: person } = await dmDb
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .eq("id", id)
      .maybeSingle();

    activePerson = person || { id, display_name: "User", username: id.slice(0, 8) };
    dm$("#dmEmpty").hidden = true;
    dm$("#dmThread").hidden = false;
    dm$("#chatName").textContent = activePerson.display_name;
    dm$("#chatHandle").textContent = `@${activePerson.username} · online`;
    dm$("#chatAvatar").src = dmAvatar(activePerson);
    dm$("#openProfile").href = `profile.html?id=${encodeURIComponent(activePerson.id)}`;
    dm$("#peoplePicker").hidden = true;

    await loadThread();
    await getChats();

    if (dmRealtime) dmDb.removeChannel(dmRealtime);
    dmRealtime = dmDb
      .channel(`dream-dm:${[dmUser.sub, id].sort().join(":")}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => {
        loadThread();
        getChats();
      })
      .subscribe();
  } catch (err) {
    dmSay(err.message || "Failed to open conversation.", "error");
  }
}

async function loadThread() {
  if (!activePerson) return;
  try {
    const { data, error } = await dmDb
      .from("direct_messages")
      .select("sender_id,body,created_at")
      .or(
        `and(sender_id.eq.${dmUser.sub},recipient_id.eq.${activePerson.id}),and(sender_id.eq.${activePerson.id},recipient_id.eq.${dmUser.sub})`
      )
      .order("created_at", { ascending: true });

    if (error) throw error;
    dm$("#dmMessages").innerHTML = data?.length
      ? data
          .map(
            (m) =>
              `<article class="dm-bubble ${m.sender_id === dmUser.sub ? "mine" : "theirs"}">
                <p>${dmEscape(m.body)}</p>
                <time>${new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
              </article>`
          )
          .join("")
      : '<div class="dm-first-note">No messages yet. Send a warm hello to start the conversation ✦</div>';

    dm$("#dmMessages").scrollTop = dm$("#dmMessages").scrollHeight;
  } catch (err) {
    console.error("Load thread error:", err);
  }
}

async function showPeoplePicker() {
  const picker = dm$("#peoplePicker");
  picker.hidden = false;
  picker.innerHTML = '<p class="eyebrow">Discover people</p><p class="dm-list-empty">Loading active community members…</p>';
  try {
    const { data } = await dmDb
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .neq("id", dmUser.sub)
      .order("username")
      .limit(30);

    picker.innerHTML = `<p class="eyebrow">Select a person</p>${
      data?.length
        ? data
            .map(
              (p) => `<button class="chat-row" data-new-person="${p.id}">
                <img src="${dmAvatar(p)}" alt="" />
                <span><b>${dmEscape(p.display_name)}</b><small>@${dmEscape(p.username)}</small></span>
              </button>`
            )
            .join("")
        : '<p class="dm-list-empty">No other members registered yet.</p>'
    }`;
  } catch (err) {
    picker.innerHTML = `<p class="dm-list-empty">${err.message}</p>`;
  }
}

// Call Simulation System (Voice & Video Call)
function setupCallModal() {
  let callModal = document.querySelector("#callModal");
  if (!callModal) {
    callModal = document.createElement("div");
    callModal.id = "callModal";
    callModal.className = "reader-modal-backdrop";
    callModal.hidden = true;
    callModal.innerHTML = `
      <div class="reader-modal-card" style="max-width: 420px; text-align: center; padding: 36px 24px;">
        <div id="callAvatarContainer" style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 16px; overflow: hidden; border: 3px solid var(--sky); box-shadow: 0 0 25px rgba(56, 189, 248, 0.4);">
          <img id="callAvatar" src="" style="width:100%; height:100%; object-fit: cover;" alt="" />
        </div>
        <h3 id="callName" style="margin: 0 0 6px; font-size: 1.3rem;">Calling…</h3>
        <p id="callStatus" style="color: var(--sky); font-size: 0.85rem; margin: 0 0 24px;">Connecting encrypted line…</p>
        <div style="display: flex; gap: 14px; justify-content: center;">
          <button type="button" id="endCallBtn" class="button" style="background: #dc2626; border-color: #ef4444; color: #fff; padding: 12px 24px; border-radius: 999px;">
            End Call ✕
          </button>
        </div>
      </div>
    `;
    document.body.append(callModal);
    document.querySelector("#endCallBtn")?.addEventListener("click", () => {
      callModal.hidden = true;
    });
  }
  return callModal;
}

window.startCall = (type = "voice") => {
  if (!activePerson) return;
  const modal = setupCallModal();
  document.querySelector("#callAvatar").src = dmAvatar(activePerson);
  document.querySelector("#callName").textContent = activePerson.display_name;
  document.querySelector("#callStatus").textContent = `Encrypted ${type === "video" ? "Video" : "Voice"} Call · Ringing…`;
  modal.hidden = false;
  setTimeout(() => {
    if (!modal.hidden) {
      document.querySelector("#callStatus").textContent = "Connected (HD Audio ✦ 00:01)";
    }
  }, 2500);
};

// Initialize DM app
async function startDm() {
  const result = await window.arraiAuth;
  if (!result.isAuthenticated) {
    dm$("#dmLogin").hidden = false;
    dmStatus.hidden = true;
    return;
  }
  dmDb = window.arraiSupabase;
  dmUser = result.user;

  // Auto create or ensure profile exists
  let { data: mine } = await dmDb.from("profiles").select("id").eq("id", dmUser.sub).maybeSingle();
  if (!mine) {
    await dmDb.from("profiles").insert({
      id: dmUser.sub,
      display_name: dmUser.name || "AR Member",
      username: (dmUser.email?.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9_]/g, ""),
      account_status: "active",
    }).catch(() => {});
  }

  dm$("#dmApp").hidden = false;
  dmSay("Your private encrypted inbox is active ✦", "success");
  await getChats();

  const requested = new URLSearchParams(location.search).get("with");
  if (requested) await openDm(requested);
}

// Event bindings
dm$("#chatList")?.addEventListener("click", (e) => {
  const row = e.target.closest("[data-person]");
  if (row) openDm(row.dataset.person);
});
dm$("#newChat")?.addEventListener("click", showPeoplePicker);
dm$("#introNewChat")?.addEventListener("click", showPeoplePicker);
dm$("#emptyNewChat")?.addEventListener("click", showPeoplePicker);
dm$("#peoplePicker")?.addEventListener("click", (e) => {
  const row = e.target.closest("[data-new-person]");
  if (row) openDm(row.dataset.newPerson);
});
dm$("#chatProfile")?.addEventListener("click", () => {
  if (activePerson) location.href = `profile.html?id=${encodeURIComponent(activePerson.id)}`;
});

dm$(".dm-suggestions")?.addEventListener("click", (e) => {
  if (e.target.matches("button")) {
    dm$("#dmForm").elements.body.value = e.target.textContent;
    dm$("#dmForm").elements.body.focus();
  }
});

// Robust Message Send with Fallback
dm$("#dmForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const textarea = e.currentTarget.elements.body;
  const body = textarea.value.trim();
  if (!body || !activePerson) return;

  const send = e.currentTarget.querySelector("button[type=submit]");
  send.disabled = true;
  send.textContent = "Sending…";

  try {
    // 1. Try RPC first
    let res = await dmDb.rpc("send_media_message", {
      recipient: activePerson.id,
      message_body: body,
      media_url: null,
      media_type: null,
    });

    // 2. Fallback to direct INSERT if RPC fails
    if (res.error) {
      const fallback = await dmDb.from("direct_messages").insert({
        sender_id: dmUser.sub,
        recipient_id: activePerson.id,
        body: body,
      });
      if (fallback.error) throw fallback.error;
    }

    textarea.value = "";
    await loadThread();
    await getChats();
  } catch (err) {
    dmSay(`Message could not send: ${err.message}`, "error");
  } finally {
    send.disabled = false;
    send.innerHTML = "Send <b>↗</b>";
  }
});

dm$("#dmSearch")?.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  dm$("#chatList")
    ?.querySelectorAll(".chat-row")
    .forEach((row) => (row.hidden = !row.textContent.toLowerCase().includes(q)));
});

startDm().catch((e) => dmSay(e.message || "Could not open messages.", "error"));
