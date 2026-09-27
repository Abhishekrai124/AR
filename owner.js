const ownerStatus = document.querySelector("#ownerStatus");
const ownerTools = document.querySelector("#ownerTools");
const ownerResults = document.querySelector("#ownerResults");
const ownerAnalytics = document.querySelector("#ownerAnalytics");
const editor = document.querySelector("#ownerEditor");
let ownerToken = "";
let ownerId = "";
let selectedProfile;

// Owner Studio is the locked backstage room. The browser asks; the server decides.

const escapeHtml = (value) =>
  String(value || "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
const ownerRequest = async (action, payload = {}) => {
  const response = await fetch("/api/owner", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Owner request failed.");
  return body;
};
const renderProfiles = (profiles) => {
  ownerResults.innerHTML = profiles.length
    ? profiles
        .map(
          (profile) =>
            `<button class="owner-result" type="button" data-select="${escapeHtml(profile.id)}"><img src="${escapeHtml(profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}`)}" alt="" /><span><b>${escapeHtml(profile.display_name)} ${profile.is_vip ? "✦ VIP" : ""}${profile.blue_tick ? " 🔵" : ""}${profile.gold_tick ? " 🟡" : ""}</b><small>@${escapeHtml(profile.username)} · ${escapeHtml(profile.account_status)}</small><small>${escapeHtml(profile.id)}</small></span></button>`,
        )
        .join("")
    : '<p class="empty-state">No matching profiles.</p>';
  window.ownerProfiles = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );
};
const loadAnalytics = async () => {
  const data = await ownerRequest("analytics");
  ownerAnalytics.innerHTML = `<span>${data.members} members</span><span>${data.vip} VIP</span><span>${data.posts} posts</span><span>${data.messageRequests} requests</span><span>${data.suspended} moderated</span>`;
};
const loadPrivateContact = async () => {
  const details = document.querySelector("#privateContactDetails");
  const data = await ownerRequest("private-contact");
  details.innerHTML = `<span><b>Personal email</b><br /><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></span>${data.phones.map((phone) => `<span><b>Private mobile</b><br /><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></span>`).join("")}`;
};
const searchProfiles = async () =>
  renderProfiles(
    (
      await ownerRequest("profiles", {
        query: document.querySelector("#ownerSearch").value,
      })
    ).profiles,
  );
const ownerEventList = document.querySelector("#ownerEventList");
const renderOwnerEvents = (events) => {
  ownerEventList.innerHTML = events.length
    ? events
        .map(
          (event) =>
            `<article class="owner-card-row"><div><b>${escapeHtml(event.title)}</b><small>${escapeHtml(event.event_date)} · ${escapeHtml(event.start_time)} · ${escapeHtml(event.location)}</small></div><button class="follow-button" type="button" data-delete-event="${escapeHtml(event.id)}">Let it go</button></article>`,
        )
        .join("")
    : "<p class=empty-state>No plans yet. The calendar is currently enjoying its main-character silence.</p>";
};
const loadOwnerEvents = async () =>
  renderOwnerEvents((await ownerRequest("calendar-events")).events);
const detectiveAdminRequest = async (action, payload = {}) => {
  const response = await fetch("/api/detective-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Detective owner request failed.");
  return result;
};
const detectiveApplications = document.querySelector("#detectiveApplications");
const detectiveCaseRegister = document.querySelector("#detectiveCaseRegister");
const detectiveAdminStatus = document.querySelector("#detectiveAdminStatus");
const detectiveIssuedId = document.querySelector("#detectiveIssuedId");
const renderDetectiveApplications = (applications) => {
  const members = applications.filter((application) => application.status === "approved");
  window.detectiveApprovedMembers = members;
  detectiveApplications.innerHTML = applications.length
    ? applications.map((application) => {
        const actions = application.status === "pending"
          ? `<button class="follow-button" type="button" data-detective-review="approve" data-user-id="${escapeHtml(application.user_id)}">Approve &amp; issue ID</button><button class="follow-button" type="button" data-detective-review="reject" data-user-id="${escapeHtml(application.user_id)}">Reject</button>`
          : application.status === "approved"
            ? `<button class="follow-button" type="button" data-detective-review="rotate-id" data-user-id="${escapeHtml(application.user_id)}">Reissue member ID</button><button class="follow-button" type="button" data-detective-review="suspend" data-user-id="${escapeHtml(application.user_id)}">Suspend access</button>`
            : application.status === "suspended"
              ? `<button class="follow-button" type="button" data-detective-review="restore" data-user-id="${escapeHtml(application.user_id)}">Restore access</button>`
              : `<button class="follow-button" type="button" data-detective-review="approve" data-user-id="${escapeHtml(application.user_id)}">Re-review &amp; issue new ID</button>`;
        const photo = application.photoUrl
          ? `<a class="detective-app-photo" href="${escapeHtml(application.photoUrl)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(application.photoUrl)}" alt="Applicant photo for ${escapeHtml(application.full_name)}" /></a>`
          : "";
        return `<article class="owner-card-row detective-application-row">${photo}<div><b>${escapeHtml(application.full_name)}</b><small>${escapeHtml(application.email)} · ${escapeHtml(application.phone)}</small><small>${escapeHtml(application.city)}, ${escapeHtml(application.state)}, ${escapeHtml(application.country)} · ${escapeHtml(application.years_experience)} years</small><small>Languages: ${escapeHtml((application.languages || []).join(", "))}</small><small>Status: ${escapeHtml(application.status)}${application.member_id_suffix ? ` · member ID ending ${escapeHtml(application.member_id_suffix)}` : ""}</small><small>Specialties: ${escapeHtml((application.specialties || []).join(", "))}</small><small>Qualifications: ${escapeHtml(application.qualifications)}</small><small>License details: ${escapeHtml(application.license_details)}</small><div class="detective-owner-actions">${actions}</div></div></article>`;
      }).join("")
    : '<p class="empty-state">No detective applications yet.</p>';
};
const renderDetectiveCases = (cases) => {
  const members = window.detectiveApprovedMembers || [];
  detectiveCaseRegister.innerHTML = cases.length
    ? cases.map((item) => {
        const selected = item.assigned_member_id || "";
        const memberOptions = `<option value="">Unassigned</option>${members.map((member) => `<option value="${escapeHtml(member.user_id)}" ${member.user_id === selected ? "selected" : ""}>${escapeHtml(member.full_name)}${member.member_id_suffix ? ` · ID …${escapeHtml(member.member_id_suffix)}` : ""}</option>`).join("")}`;
        const statusOptions = ["new", "reviewing", "assigned", "in_progress", "closed", "declined"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status.replaceAll("_", " ")}</option>`).join("");
        const documentLink = item.documentUrl ? `<a href="${escapeHtml(item.documentUrl)}" target="_blank" rel="noreferrer">Open private PDF</a>` : "PDF not attached";
        const location = [item.area, item.city, item.state, item.country].filter(Boolean).join(", ");
        return `<article class="owner-card-row detective-case-row"><div><b>${escapeHtml(item.case_number)} · ${escapeHtml(item.service_name)}</b><small>${escapeHtml(item.client_name)} · ${escapeHtml(item.client_email)} · ${escapeHtml(item.client_type)}</small><small>${escapeHtml(item.matter_category)}${location ? ` · ${escapeHtml(location)}` : ""}</small><p>${escapeHtml(item.non_sensitive_summary)}</p><small>${documentLink}</small><div class="detective-owner-actions"><label>Assign detective<select data-case-assignee="${escapeHtml(item.id)}">${memberOptions}</select></label><button class="follow-button" type="button" data-assign-case="${escapeHtml(item.id)}">Save assignment</button><label>Case status<select data-case-status="${escapeHtml(item.id)}">${statusOptions}</select></label><button class="follow-button" type="button" data-update-case="${escapeHtml(item.id)}">Update status</button></div></div></article>`;
      }).join("")
    : '<p class="empty-state">No case enquiries in the register.</p>';
};
const loadDetectiveAdmin = async () => {
  const [applicationData, caseData] = await Promise.all([
    detectiveAdminRequest("applications"),
    detectiveAdminRequest("cases"),
  ]);
  renderDetectiveApplications(applicationData.applications);
  renderDetectiveCases(caseData.cases);
};
detectiveApplications?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-detective-review]");
  if (!button) return;
  button.disabled = true;
  try {
    const result = await detectiveAdminRequest("review-application", {
      userId: button.dataset.userId,
      decision: button.dataset.detectiveReview,
    });
    if (result.memberId) {
      document.querySelector("#detectiveIssuedIdValue").textContent = result.memberId;
      detectiveIssuedId.hidden = false;
      detectiveAdminStatus.textContent = result.memberEmailSent
        ? "Member approved. The ID was shown once and emailed to the applicant."
        : "Member approved. The ID was shown once; copy it and deliver it securely because email delivery is not available.";
    } else {
      detectiveAdminStatus.textContent = `Application ${result.decision} completed.`;
    }
    await loadDetectiveAdmin();
  } catch (error) {
    detectiveAdminStatus.textContent = error.message;
    button.disabled = false;
  }
});
detectiveIssuedId?.querySelector("button")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(document.querySelector("#detectiveIssuedIdValue").textContent);
    detectiveAdminStatus.textContent = "One-time member ID copied. Store and deliver it securely.";
  } catch {
    detectiveAdminStatus.textContent = "Select and copy the displayed one-time ID, then store it securely.";
  }
});
detectiveCaseRegister?.addEventListener("click", async (event) => {
  const assign = event.target.closest("[data-assign-case]");
  const update = event.target.closest("[data-update-case]");
  if (!assign && !update) return;
  const button = assign || update;
  button.disabled = true;
  try {
    if (assign) {
      await detectiveAdminRequest("assign-case", {
        caseId: assign.dataset.assignCase,
        memberUserId: detectiveCaseRegister.querySelector(`[data-case-assignee="${assign.dataset.assignCase}"]`).value,
      });
    } else {
      await detectiveAdminRequest("update-case-status", {
        caseId: update.dataset.updateCase,
        status: detectiveCaseRegister.querySelector(`[data-case-status="${update.dataset.updateCase}"]`).value,
      });
    }
    detectiveAdminStatus.textContent = "Case register updated.";
    await loadDetectiveAdmin();
  } catch (error) {
    detectiveAdminStatus.textContent = error.message;
    button.disabled = false;
  }
});
document
  .querySelector("#calendarEventForm")
  ?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await ownerRequest(
        "add-calendar-event",
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      event.currentTarget.reset();
      await loadOwnerEvents();
      ownerStatus.textContent =
        "It is on the calendar. Future-you says thank you. ✦";
    } catch (error) {
      ownerStatus.textContent = error.message;
    }
  });
ownerEventList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-event]");
  if (!button) return;
  try {
    await ownerRequest("delete-calendar-event", {
      id: button.dataset.deleteEvent,
    });
    await loadOwnerEvents();
    ownerStatus.textContent = "Gone. The calendar has made peace with it.";
  } catch (error) {
    ownerStatus.textContent = error.message;
  }
});

const parseLines = (value) =>
  String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
const siteForm = document.querySelector("#siteSettingsForm");
const loadSiteControls = async () => {
  const settings = await ownerRequest("get-site-settings");
  for (const [id, key] of [
    ["siteHeroPic", "hero_image_url"],
    ["founderName", "founder_name"],
    ["founderRole", "founder_role"],
    ["founderNote", "founder_note"],
    ["founderTags", "founder_tags"],
    ["founderLinks", "founder_links"],
  ]) {
    const el = document.querySelector(`#${id}`);
    if (el) el.value = settings[key] || "";
  }
  document.querySelector("#globalThemeSelect").value =
    settings.global_theme || "midnight";
  document.querySelector("#founderUsername").value =
    settings.founder_username || "";
  document.querySelector("#showPersonalContact").checked =
    settings.show_personal_contact === true;
  document.querySelector("#siteSaveState").textContent = "Ready to edit";
};
const specialDayForm = document.querySelector("#specialDayForm");
const loadSpecialDayControls = async () => {
  const settings = await ownerRequest("get-site-settings");
  for (const [id, key] of [
    ["specialDayStart", "special_day_start"],
    ["specialDayEnd", "special_day_end"],
    ["specialDayName", "special_day_name"],
    ["specialDayTitle", "special_day_title"],
    ["specialDayMessage", "special_day_message"],
    ["specialDayImageUrl", "special_day_image_url"],
    ["specialDayRole", "special_day_role"],
    ["specialDayTags", "special_day_tags"],
    ["specialDayLinks", "special_day_links"],
    ["specialDayIntroTitle", "special_day_intro_title"],
    ["specialDayIntroText", "special_day_intro_text"],
    ["specialDayCtaTitle", "special_day_cta_title"],
  ])
    document.querySelector(`#${id}`).value = settings[key] || "";
  document.querySelector("#specialDayEnabled").checked =
    settings.special_day_enabled === true;
  document.querySelector("#specialDayTheme").value =
    settings.special_day_theme || "sakura";
};
specialDayForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const value = (id) => document.querySelector(`#${id}`).value.trim();
    await ownerRequest("update-site-settings", {
      special_day_enabled: document.querySelector("#specialDayEnabled").checked,
      special_day_start: value("specialDayStart"),
      special_day_end: value("specialDayEnd"),
      special_day_name: value("specialDayName"),
      special_day_title: value("specialDayTitle"),
      special_day_message: value("specialDayMessage"),
      special_day_theme: document.querySelector("#specialDayTheme").value,
      special_day_image_url: value("specialDayImageUrl"),
      special_day_role: value("specialDayRole"),
      special_day_tags: value("specialDayTags"),
      special_day_links: value("specialDayLinks"),
      special_day_intro_title: value("specialDayIntroTitle"),
      special_day_intro_text: value("specialDayIntroText"),
      special_day_cta_title: value("specialDayCtaTitle"),
    });
    ownerStatus.textContent = "Special day world saved. ✦";
  } catch (error) {
    ownerStatus.textContent = error.message;
  }
});
siteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const state = document.querySelector("#siteSaveState");
  state.textContent = "Saving…";
  try {
    await ownerRequest("update-site-settings", {
      global_theme: document.querySelector("#globalThemeSelect").value,
      hero_image_url: document.querySelector("#siteHeroPic").value.trim(),
      founder_username: document.querySelector("#founderUsername").value.trim(),
      founder_name: document.querySelector("#founderName").value.trim(),
      founder_role: document.querySelector("#founderRole").value.trim(),
      founder_note: document.querySelector("#founderNote").value.trim(),
      founder_tags: document.querySelector("#founderTags").value,
      founder_links: document.querySelector("#founderLinks").value,
      show_personal_contact: document.querySelector("#showPersonalContact")
        .checked,
    });
    state.textContent = "Saved ✓";
  } catch (error) {
    state.textContent = error.message;
  }
});
document
  .querySelector("#globalThemeSelect")
  ?.addEventListener("change", async (event) => {
    const theme = event.target.value;
    document.body.dataset.theme = theme;
    const state = document.querySelector("#siteSaveState");
    state.textContent = "Applying theme…";
    try {
      await ownerRequest("update-site-settings", { global_theme: theme });
      state.textContent = "Theme applied ✓";
    } catch (error) {
      state.textContent = error.message;
    }
  });
document
  .querySelector("#founderPicUpload")
  ?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const state = document.querySelector("#siteSaveState");
    state.textContent = "Uploading…";
    try {
      const path = `${ownerId}/founder/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "-")}`;
      const { error } = await window.arraiSupabase.storage
        .from("avatars")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = window.arraiSupabase.storage
        .from("avatars")
        .getPublicUrl(path);
      document.querySelector("#siteHeroPic").value = data.publicUrl;
      state.textContent = "Photo ready — now press Save home appearance";
    } catch (error) {
      state.textContent = error.message || "Upload failed";
    }
  });
const cardForm = document.querySelector("#publicCardForm"),
  cardResults = document.querySelector("#cardUserResults"),
  cardList = document.querySelector("#publicCardList");
const loadCards = async () => {
  const cards = await ownerRequest("get-founder-cards");
  cardList.innerHTML = cards.length
    ? cards
        .map(
          (c) =>
            `<article class="owner-card-row"><img src="${escapeHtml(c.image_url || "assets/founder.jpg")}" alt=""><div><b>${escapeHtml(c.title)}</b><small>${escapeHtml(c.subtitle || "")}</small></div><button class="follow-button" data-edit-card="${c.id}" type="button">Edit</button><button class="follow-button" data-delete-card="${c.id}" type="button">Remove</button></article>`,
        )
        .join("")
    : "<p class=empty-state>No public cards yet.</p>";
  window.ownerCards = new Map(cards.map((c) => [c.id, c]));
};
document
  .querySelector("#cardUsername")
  ?.addEventListener("input", async (event) => {
    const q = event.target.value.trim();
    if (q.length < 2) {
      cardResults.innerHTML = "";
      return;
    }
    try {
      const { profiles } = await ownerRequest("profiles", { query: q });
      window.ownerProfiles = new Map(profiles.map((p) => [p.id, p]));
      cardResults.innerHTML = profiles
        .slice(0, 5)
        .map(
          (p) =>
            `<button type="button" class="owner-result" data-card-profile="${escapeHtml(p.id)}"><img src="${escapeHtml(p.avatar_url || "")}" alt=""><span><b>${escapeHtml(p.display_name)}</b><small>@${escapeHtml(p.username)}</small></span></button>`,
        )
        .join("");
    } catch {}
  });
cardResults?.addEventListener("click", (event) => {
  const b = event.target.closest("[data-card-profile]");
  if (!b) return;
  const p = window.ownerProfiles?.get(b.dataset.cardProfile);
  if (!p) return;
  cardForm.elements.title.value = p.display_name || "";
  cardForm.elements.description.value = p.bio || "";
  cardForm.elements.imageUrl.value = p.avatar_url || "";
  cardForm.elements.dateOfBirth.value = p.date_of_birth || "";
  document.querySelector("#cardUserHint").textContent =
    `Selected @${p.username}`;
  cardForm.dataset.profileId = p.id;
});
cardForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(cardForm));
  try {
    const payload = {
      title: data.title,
      subtitle: data.subtitle,
      image_url: data.imageUrl,
      description: data.description,
      tags: data.tags,
      links: data.links,
      date_of_birth: data.dateOfBirth,
      profile_id: cardForm.dataset.profileId || null,
    };
    await ownerRequest(
      cardForm.dataset.editId ? "update-founder-card" : "add-founder-card",
      cardForm.dataset.editId
        ? { ...payload, id: cardForm.dataset.editId }
        : payload,
    );
    cardForm.reset();
    delete cardForm.dataset.profileId;
    delete cardForm.dataset.editId;
    await loadCards();
    ownerStatus.textContent = "Public card saved to home. ✦";
  } catch (error) {
    ownerStatus.textContent = error.message;
  }
});
cardList?.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit-card]");
  if (edit) {
    const c = window.ownerCards?.get(edit.dataset.editCard);
    if (c) {
      cardForm.elements.title.value = c.title || "";
      cardForm.elements.subtitle.value = c.subtitle || "";
      cardForm.elements.imageUrl.value = c.image_url || "";
      cardForm.elements.description.value = c.description || "";
      cardForm.elements.tags.value = c.tags || "";
      cardForm.elements.links.value = c.links || "";
      cardForm.elements.dateOfBirth.value = c.date_of_birth || "";
      cardForm.dataset.editId = c.id;
      cardForm.scrollIntoView({ behavior: "smooth", block: "center" });
      ownerStatus.textContent = "Editing public card…";
    }
    return;
  }
  const b = event.target.closest("[data-delete-card]");
  if (
    !b ||
    !(await window.cuteConfirm(
      "This card will be removed from the home page.",
      { title: "Remove public card?", danger: true },
    ))
  )
    return;
  try {
    await ownerRequest("delete-founder-card", { id: b.dataset.deleteCard });
    await loadCards();
    ownerStatus.textContent = "Public card removed.";
  } catch (error) {
    ownerStatus.textContent = error.message;
  }
});

function openEditor(profile) {
  selectedProfile = profile;
  editor.hidden = false;
  editor.elements.id.value = profile.id;
  editor.elements.displayName.value = profile.display_name || "";
  if (!editor.elements.phoneNumber) {
    const label = document.createElement("label");
    label.innerHTML =
      'Mobile number <input name="phoneNumber" type="tel" maxlength="25" />';
    editor.elements.displayName.closest("label")?.after(label);
  }
  editor.elements.phoneNumber.value = profile.phone_number || "";
  editor.elements.bio.value = profile.bio || "";
  editor.elements.dateOfBirth.value = profile.date_of_birth || "";
  editor.elements.gender.value = profile.gender || "";
  editor.elements.privacy.value = profile.privacy || "public";
  editor.elements.customUsername.value = profile.is_vip ? profile.username : "";
  const isOwnerProfile = profile.id === ownerId;
  editor.classList.toggle("editing-owner-profile", isOwnerProfile);
  editor.elements.customUsername.disabled = !profile.is_vip && !isOwnerProfile;
  document.querySelector("#vipUsernameHelp").textContent = isOwnerProfile
    ? "Owner profile: all profile fields are unrestricted."
    : profile.is_vip
      ? "VIP custom username is unlocked."
      : "Grant VIP to unlock this field.";
  document.querySelector("#ownerRecord").textContent =
    `ID: ${profile.id} · Joined: ${new Date(profile.created_at).toLocaleString()} · Updated: ${new Date(profile.updated_at || profile.created_at).toLocaleString()} · Status: ${profile.account_status} · VIP: ${profile.is_vip ? "on" : "off"} · Blue tick: ${profile.blue_tick ? "on" : "off"} · Gold tick: ${profile.gold_tick ? "on" : "off"}`;
  if (!editor.querySelector("[data-role]"))
    editor
      .querySelector(".owner-actions")
      .insertAdjacentHTML(
        "beforeend",
        '<button class="follow-button" type="button" data-role="admin">Make admin</button><button class="follow-button" type="button" data-role="moderator">Make moderator</button><button class="follow-button" type="button" data-role="member">Remove staff role</button>',
      );
}

document
  .querySelector("#ownerSearch")
  .addEventListener("input", () =>
    searchProfiles().catch(
      (error) => (ownerStatus.textContent = error.message),
    ),
  );
document.querySelector("#ownerSelf").addEventListener("click", async () => {
  try {
    const { profiles } = await ownerRequest("profiles", { query: ownerId });
    const ownProfile = profiles.find((profile) => profile.id === ownerId);
    if (!ownProfile)
      throw new Error(
        "Create your Community profile once before editing it here.",
      );
    openEditor(ownProfile);
  } catch (error) {
    ownerStatus.textContent = error.message;
  }
});
ownerResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select]");
  if (button) openEditor(window.ownerProfiles.get(button.dataset.select));
});
editor.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await ownerRequest(
      "update-profile",
      Object.fromEntries(new FormData(editor)),
    );
    ownerStatus.textContent = "Profile forcibly updated. ✦";
    await searchProfiles();
    openEditor(window.ownerProfiles.get(selectedProfile.id) || selectedProfile);
  } catch (error) {
    ownerStatus.textContent = error.message;
  }
});
editor.addEventListener("click", async (event) => {
  const status = event.target.dataset.status;
  const vipType = event.target.dataset.vipType;
  const removeVip = event.target.matches("[data-vip-remove]");
  const badge = event.target.dataset.badge;
  const role = event.target.dataset.role;
  const deleteAccount = event.target.matches("[data-delete-account]");
  if (!status && !vipType && !removeVip && !badge && !role && !deleteAccount)
    return;
  try {
    const label = deleteAccount
      ? "permanently delete this account"
      : "apply this action";
    if (
      !(await window.cuteConfirm(
        `${label} for ${selectedProfile.display_name}?`,
        { title: "Confirm owner action" },
      ))
    )
      return;
    if (
      deleteAccount &&
      !(await window.cuteConfirm(
        "This cannot be undone. Delete this user and their profile now?",
        { title: "Delete this user?", danger: true },
      ))
    )
      return;
    await ownerRequest(
      deleteAccount
        ? "delete-account"
        : role
          ? "set-role"
          : badge
            ? "set-badge"
            : vipType || removeVip
              ? "set-vip"
              : "moderate",
      deleteAccount
        ? { id: selectedProfile.id }
        : role
          ? { id: selectedProfile.id, role }
          : badge
            ? {
                id: selectedProfile.id,
                badge,
                enabled: !selectedProfile[`${badge}_tick`],
              }
            : vipType || removeVip
              ? { id: selectedProfile.id, isVip: !removeVip, vipType }
              : { id: selectedProfile.id, moderationAction: status },
    );
    ownerStatus.textContent = "Member state updated. ✦";
    await Promise.all([
      searchProfiles(),
      loadAnalytics(),
      loadPrivateContact(),
      loadSiteControls(),
      loadSpecialDayControls(),
      loadCards(),
      loadOwnerEvents(),
    ]);
    openEditor(window.ownerProfiles.get(selectedProfile.id) || selectedProfile);
  } catch (error) {
    ownerStatus.textContent = error.message;
  }
});

(async () => {
  const {
    data: { session },
  } = await window.arraiSupabase.auth.getSession();
  if (!session) return window.location.assign("auth.html?next=owner");
  ownerId = session.user.id;
  ownerToken = session.access_token;
  try {
    await Promise.all([
      searchProfiles(),
      loadAnalytics(),
      loadSiteControls(),
      loadCards(),
    ]);
    ownerTools.hidden = false;
    ownerStatus.textContent = "Owner access verified. God Mode is ready.";
    loadDetectiveAdmin().catch((error) => {
      if (detectiveAdminStatus) detectiveAdminStatus.textContent = error.message;
    });
  } catch (error) {
    ownerStatus.textContent = error.message;
  }
})();
