const ownerStatus = document.querySelector("#ownerStatus");
const ownerTools = document.querySelector("#ownerTools");
const ownerResults = document.querySelector("#ownerResults");
const ownerAnalytics = document.querySelector("#ownerAnalytics");
const editor = document.querySelector("#ownerEditor");
let ownerToken = "";
let ownerId = "";
let selectedProfile;

const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
const ownerRequest = async (action, payload = {}) => {
  const response = await fetch("/api/owner", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` }, body: JSON.stringify({ action, ...payload }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Owner request failed.");
  return body;
};
const renderProfiles = (profiles) => {
  ownerResults.innerHTML = profiles.length ? profiles.map((profile) => `<button class="owner-result" type="button" data-select="${escapeHtml(profile.id)}"><img src="${escapeHtml(profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}`)}" alt="" /><span><b>${escapeHtml(profile.display_name)} ${profile.is_vip ? "✦ VIP" : ""}</b><small>@${escapeHtml(profile.username)} · ${escapeHtml(profile.account_status)}</small><small>${escapeHtml(profile.id)}</small></span></button>`).join("") : '<p class="empty-state">No matching profiles.</p>';
  window.ownerProfiles = new Map(profiles.map((profile) => [profile.id, profile]));
};
const loadAnalytics = async () => {
  const data = await ownerRequest("analytics");
  ownerAnalytics.innerHTML = `<span>${data.members} members</span><span>${data.vip} VIP</span><span>${data.posts} posts</span><span>${data.messageRequests} requests</span><span>${data.suspended} moderated</span>`;
};
const searchProfiles = async () => renderProfiles((await ownerRequest("profiles", { query: document.querySelector("#ownerSearch").value })).profiles);

function openEditor(profile) {
  selectedProfile = profile;
  editor.hidden = false;
  editor.elements.id.value = profile.id;
  editor.elements.displayName.value = profile.display_name || "";
  editor.elements.bio.value = profile.bio || "";
  editor.elements.dateOfBirth.value = profile.date_of_birth || "";
  editor.elements.gender.value = profile.gender || "";
  editor.elements.privacy.value = profile.privacy || "public";
  editor.elements.customUsername.value = profile.is_vip ? profile.username : "";
  const isOwnerProfile = profile.id === ownerId;
  editor.classList.toggle("editing-owner-profile", isOwnerProfile);
  editor.elements.customUsername.disabled = !profile.is_vip && !isOwnerProfile;
  document.querySelector("#vipUsernameHelp").textContent = isOwnerProfile ? "Owner profile: all profile fields are unrestricted." : profile.is_vip ? "VIP custom username is unlocked." : "Grant VIP to unlock this field.";
  document.querySelector("#ownerRecord").textContent = `ID: ${profile.id} · Joined: ${new Date(profile.created_at).toLocaleString()} · Updated: ${new Date(profile.updated_at || profile.created_at).toLocaleString()} · Status: ${profile.account_status}`;
}

document.querySelector("#ownerSearch").addEventListener("input", () => searchProfiles().catch((error) => ownerStatus.textContent = error.message));
document.querySelector("#ownerSelf").addEventListener("click", async () => {
  try { const { profiles } = await ownerRequest("profiles", { query: ownerId }); const ownProfile = profiles.find((profile) => profile.id === ownerId); if (!ownProfile) throw new Error("Create your Community profile once before editing it here."); openEditor(ownProfile); } catch (error) { ownerStatus.textContent = error.message; }
});
ownerResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select]");
  if (button) openEditor(window.ownerProfiles.get(button.dataset.select));
});
editor.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await ownerRequest("update-profile", Object.fromEntries(new FormData(editor)));
    ownerStatus.textContent = "Profile forcibly updated. ✦";
    await searchProfiles();
    openEditor(window.ownerProfiles.get(selectedProfile.id) || selectedProfile);
  } catch (error) { ownerStatus.textContent = error.message; }
});
editor.addEventListener("click", async (event) => {
  const status = event.target.dataset.status;
  const vipType = event.target.dataset.vipType;
  const removeVip = event.target.matches("[data-vip-remove]");
  if (!status && !vipType && !removeVip) return;
  try {
    if (!confirm(`Confirm this Owner Studio action for ${selectedProfile.display_name}?`)) return;
    await ownerRequest(vipType || removeVip ? "set-vip" : "moderate", vipType || removeVip ? { id: selectedProfile.id, isVip: !removeVip, vipType } : { id: selectedProfile.id, moderationAction: status });
    ownerStatus.textContent = "Member state updated. ✦";
    await Promise.all([searchProfiles(), loadAnalytics()]);
    openEditor(window.ownerProfiles.get(selectedProfile.id) || selectedProfile);
  } catch (error) { ownerStatus.textContent = error.message; }
});

(async () => {
  const { data: { session } } = await window.arraiSupabase.auth.getSession();
  if (!session) return window.location.assign("auth.html?next=owner");
  ownerId = session.user.id;
  ownerToken = session.access_token;
  try {
    await Promise.all([searchProfiles(), loadAnalytics()]);
    ownerTools.hidden = false;
    ownerStatus.textContent = "Owner access verified. God Mode is ready.";
  } catch (error) { ownerStatus.textContent = error.message; }
})();
