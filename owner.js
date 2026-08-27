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
  ownerResults.innerHTML = profiles.length ? profiles.map((profile) => `<button class="owner-result" type="button" data-select="${escapeHtml(profile.id)}"><img src="${escapeHtml(profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}`)}" alt="" /><span><b>${escapeHtml(profile.display_name)} ${profile.is_vip ? "✦ VIP" : ""}${profile.blue_tick ? " 🔵" : ""}${profile.gold_tick ? " 🟡" : ""}</b><small>@${escapeHtml(profile.username)} · ${escapeHtml(profile.account_status)}</small><small>${escapeHtml(profile.id)}</small></span></button>`).join("") : '<p class="empty-state">No matching profiles.</p>';
  window.ownerProfiles = new Map(profiles.map((profile) => [profile.id, profile]));
};
const loadAnalytics = async () => {
  const data = await ownerRequest("analytics");
  ownerAnalytics.innerHTML = `<span>${data.members} members</span><span>${data.vip} VIP</span><span>${data.posts} posts</span><span>${data.messageRequests} requests</span><span>${data.suspended} moderated</span>`;
};
const searchProfiles = async () => renderProfiles((await ownerRequest("profiles", { query: document.querySelector("#ownerSearch").value })).profiles);

const parseLines = (value) => String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const siteForm = document.querySelector("#siteSettingsForm");
const loadSiteControls = async () => { const settings = await ownerRequest("get-site-settings"); for (const [id, key] of [["siteHeroPic","hero_image_url"],["founderName","founder_name"],["founderRole","founder_role"],["founderNote","founder_note"],["founderTags","founder_tags"],["founderLinks","founder_links"]]) { const el=document.querySelector(`#${id}`); if(el) el.value=settings[key]||""; } document.querySelector("#globalThemeSelect").value=settings.global_theme||"midnight"; document.querySelector("#founderUsername").value=settings.founder_username||""; document.querySelector("#siteSaveState").textContent="Ready to edit"; };
siteForm?.addEventListener("submit", async (event) => { event.preventDefault(); const state=document.querySelector("#siteSaveState"); state.textContent="Saving…"; try { await ownerRequest("update-site-settings", { global_theme: document.querySelector("#globalThemeSelect").value, hero_image_url: document.querySelector("#siteHeroPic").value.trim(), founder_username: document.querySelector("#founderUsername").value.trim(), founder_name: document.querySelector("#founderName").value.trim(), founder_role: document.querySelector("#founderRole").value.trim(), founder_note: document.querySelector("#founderNote").value.trim(), founder_tags: document.querySelector("#founderTags").value, founder_links: document.querySelector("#founderLinks").value }); state.textContent="Saved ✓"; } catch(error) { state.textContent=error.message; } });
document.querySelector("#founderPicUpload")?.addEventListener("change", async (event) => { const file=event.target.files?.[0]; if(!file)return; const state=document.querySelector("#siteSaveState"); state.textContent="Uploading…"; try { const path=`owner-founder/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi,"-")}`; const {error}=await window.arraiSupabase.storage.from("avatars").upload(path,file,{upsert:false}); if(error)throw error; const {data}=window.arraiSupabase.storage.from("avatars").getPublicUrl(path); document.querySelector("#siteHeroPic").value=data.publicUrl; state.textContent="Photo ready — save home appearance"; } catch(error){ state.textContent=error.message||"Upload failed"; } });
const cardForm=document.querySelector("#publicCardForm"), cardResults=document.querySelector("#cardUserResults"), cardList=document.querySelector("#publicCardList");
const loadCards=async()=>{ const cards=await ownerRequest("get-founder-cards"); cardList.innerHTML=cards.length?cards.map(c=>`<article class="owner-card-row"><img src="${escapeHtml(c.image_url||'assets/founder.jpg')}" alt=""><div><b>${escapeHtml(c.title)}</b><small>${escapeHtml(c.subtitle||'')}</small></div><button class="follow-button" data-delete-card="${c.id}" type="button">Remove</button></article>`).join(""):"<p class=empty-state>No public cards yet.</p>"; };
 document.querySelector("#cardUsername")?.addEventListener("input", async (event)=>{ const q=event.target.value.trim(); if(q.length<2){cardResults.innerHTML="";return;} try { const {profiles}=await ownerRequest("profiles",{query:q}); window.ownerProfiles=new Map(profiles.map(p=>[p.id,p])); cardResults.innerHTML=profiles.slice(0,5).map(p=>`<button type="button" class="owner-result" data-card-profile="${escapeHtml(p.id)}"><img src="${escapeHtml(p.avatar_url||'')}" alt=""><span><b>${escapeHtml(p.display_name)}</b><small>@${escapeHtml(p.username)}</small></span></button>`).join(""); }catch{} });
cardResults?.addEventListener("click",(event)=>{const b=event.target.closest("[data-card-profile]");if(!b)return;const p=window.ownerProfiles?.get(b.dataset.cardProfile);if(!p)return;cardForm.elements.title.value=p.display_name||"";cardForm.elements.description.value=p.bio||"";cardForm.elements.imageUrl.value=p.avatar_url||"";cardForm.elements.dateOfBirth.value=p.date_of_birth||"";document.querySelector("#cardUserHint").textContent=`Selected @${p.username}`;cardForm.dataset.profileId=p.id;});
cardForm?.addEventListener("submit",async(event)=>{event.preventDefault();const data=Object.fromEntries(new FormData(cardForm));try{await ownerRequest("add-founder-card",{title:data.title,subtitle:data.subtitle,image_url:data.imageUrl,description:data.description,tags:data.tags,links:data.links,date_of_birth:data.dateOfBirth,profile_id:cardForm.dataset.profileId||null});cardForm.reset();delete cardForm.dataset.profileId;await loadCards();ownerStatus.textContent="Public card added to home. ✦";}catch(error){ownerStatus.textContent=error.message;}});
cardList?.addEventListener("click",async(event)=>{const b=event.target.closest("[data-delete-card]");if(!b||!confirm("Remove this public card from home?"))return;try{await ownerRequest("delete-founder-card",{id:b.dataset.deleteCard});await loadCards();}catch(error){ownerStatus.textContent=error.message;}});

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
  document.querySelector("#ownerRecord").textContent = `ID: ${profile.id} · Joined: ${new Date(profile.created_at).toLocaleString()} · Updated: ${new Date(profile.updated_at || profile.created_at).toLocaleString()} · Status: ${profile.account_status} · VIP: ${profile.is_vip ? "on" : "off"} · Blue tick: ${profile.blue_tick ? "on" : "off"} · Gold tick: ${profile.gold_tick ? "on" : "off"}`;
  if (!editor.querySelector("[data-role]")) editor.querySelector(".owner-actions").insertAdjacentHTML("beforeend", '<button class="follow-button" type="button" data-role="admin">Make admin</button><button class="follow-button" type="button" data-role="moderator">Make moderator</button><button class="follow-button" type="button" data-role="member">Remove staff role</button>');
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
  const badge = event.target.dataset.badge;
  const role = event.target.dataset.role;
  const deleteAccount = event.target.matches("[data-delete-account]");
  if (!status && !vipType && !removeVip && !badge && !role && !deleteAccount) return;
  try {
    const label = deleteAccount ? "permanently delete this account" : "apply this action";
    if (!confirm(`Confirm: ${label} for ${selectedProfile.display_name}?`)) return;
    if (deleteAccount && !confirm("This cannot be undone. Delete this user and their profile now?")) return;
    await ownerRequest(deleteAccount ? "delete-account" : role ? "set-role" : badge ? "set-badge" : vipType || removeVip ? "set-vip" : "moderate", deleteAccount ? { id: selectedProfile.id } : role ? { id: selectedProfile.id, role } : badge ? { id: selectedProfile.id, badge, enabled: !selectedProfile[`${badge}_tick`] } : vipType || removeVip ? { id: selectedProfile.id, isVip: !removeVip, vipType } : { id: selectedProfile.id, moderationAction: status });
    ownerStatus.textContent = "Member state updated. ✦";
    await Promise.all([searchProfiles(), loadAnalytics(), loadSiteControls(), loadCards()]);
    openEditor(window.ownerProfiles.get(selectedProfile.id) || selectedProfile);
  } catch (error) { ownerStatus.textContent = error.message; }
});

(async () => {
  const { data: { session } } = await window.arraiSupabase.auth.getSession();
  if (!session) return window.location.assign("auth.html?next=owner");
  ownerId = session.user.id;
  ownerToken = session.access_token;
  try {
    await Promise.all([searchProfiles(), loadAnalytics(), loadSiteControls(), loadCards()]);
    ownerTools.hidden = false;
    ownerStatus.textContent = "Owner access verified. God Mode is ready.";
  } catch (error) { ownerStatus.textContent = error.message; }
})();
