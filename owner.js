const ownerStatus = document.querySelector("#ownerStatus");
const ownerTools = document.querySelector("#ownerTools");
const ownerResults = document.querySelector("#ownerResults");
let ownerToken = "";
const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));

const ownerRequest = async (action, payload = {}) => {
  const response = await fetch("/api/owner", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` }, body: JSON.stringify({ action, ...payload }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Owner request failed.");
  return body;
};
const renderProfiles = (profiles) => {
  ownerResults.innerHTML = profiles.length ? profiles.map((profile) => `<div class="person-row"><img src="${escapeHtml(profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}`)}" alt="" /><div><b>${escapeHtml(profile.display_name)}</b><small>@${escapeHtml(profile.username)}</small></div><button class="follow-button" data-id="${escapeHtml(profile.id)}" data-name="${encodeURIComponent(profile.display_name)}" data-bio="${encodeURIComponent(profile.bio || "")}">Correct</button></div>`).join("") : '<p class="empty-state">No matching profiles.</p>';
};
async function searchProfiles() { renderProfiles((await ownerRequest("profiles", { query: document.querySelector("#ownerSearch").value })).profiles); }
document.querySelector("#ownerSearch").addEventListener("input", () => searchProfiles().catch((error) => ownerStatus.textContent = error.message));
ownerResults.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-id]"); if (!button) return;
  const name = prompt("Correct display name:", decodeURIComponent(button.dataset.name)); if (name === null) return;
  const bio = prompt("Correct bio:", decodeURIComponent(button.dataset.bio)); if (bio === null) return;
  try { await ownerRequest("update-profile", { id: button.dataset.id, displayName: name, bio }); ownerStatus.textContent = "Profile updated safely. ✦"; searchProfiles(); } catch (error) { ownerStatus.textContent = error.message; }
});
(async () => {
  const { data: { session } } = await window.arraiSupabase.auth.getSession();
  if (!session) return window.location.assign("auth.html?next=owner");
  ownerToken = session.access_token;
  try { await searchProfiles(); ownerTools.hidden = false; ownerStatus.textContent = "Owner access verified. You can correct public profile name and bio here."; } catch (error) { ownerStatus.textContent = error.message; }
})();
