// ARRAI Chronicles & Original Universe Codex System
const wikiSearch = document.querySelector("#wikiSearch");
const wikiSearchBtn = document.querySelector("#wikiSearchBtn");
const wikiTags = document.querySelectorAll(".wiki-tag");
const charCount = document.querySelector("#charCount");
const storyCount = document.querySelector("#storyCount");
const characterGrid = document.querySelector("#characterGrid");
const storyGrid = document.querySelector("#storyGrid");

const readerModal = document.querySelector("#readerModal");
const readerClose = document.querySelector("#readerClose");
const readerTitle = document.querySelector("#readerTitle");
const readerBadge = document.querySelector("#readerBadge");
const readerContent = document.querySelector("#readerContent");

// Character Creator Modal elements
const charModal = document.querySelector("#charModal");
const charForm = document.querySelector("#charForm");
const charModalClose = document.querySelector("#charModalClose");
const charModalCancel = document.querySelector("#charModalCancel");
const addCharacterBtn = document.querySelector("#addCharacterBtn");
const editCharPhotoFile = document.querySelector("#editCharPhotoFile");
const editCharPhotoBase64 = document.querySelector("#editCharPhotoBase64");
const charPhotoPreviewContainer = document.querySelector("#charPhotoPreviewContainer");
const charPhotoPreviewImg = document.querySelector("#charPhotoPreviewImg");

// Story Creator Modal elements
const storyModal = document.querySelector("#storyModal");
const storyForm = document.querySelector("#storyForm");
const storyModalClose = document.querySelector("#storyModalClose");
const storyModalCancel = document.querySelector("#storyModalCancel");
const addStoryBtn = document.querySelector("#addStoryBtn");

// Purge legacy Makima / Spire defaults if found
try {
  const legacyChars = localStorage.getItem("arrai_wiki_characters");
  if (legacyChars && legacyChars.includes("makima")) {
    localStorage.removeItem("arrai_wiki_characters");
  }
  const legacyStories = localStorage.getItem("arrai_wiki_stories");
  if (legacyStories && (legacyStories.includes("spire") || legacyStories.includes("resonance"))) {
    localStorage.removeItem("arrai_wiki_stories");
  }
} catch {}

// User-governed storage helpers
function getStoredCharacters() {
  try {
    const raw = localStorage.getItem("arrai_wiki_characters");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveStoredCharacters(chars) {
  try {
    localStorage.setItem("arrai_wiki_characters", JSON.stringify(chars));
  } catch {}
}

function getStoredStories() {
  try {
    const raw = localStorage.getItem("arrai_wiki_stories");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveStoredStories(stories) {
  try {
    localStorage.setItem("arrai_wiki_stories", JSON.stringify(stories));
  } catch {}
}

// Dynamic Count Synchronizer
function updateCodexCounts() {
  const chars = getStoredCharacters();
  const stories = getStoredStories();
  const total = chars.length + stories.length;

  const tagAll = document.querySelector("#tagCountAll");
  const tagChar = document.querySelector("#tagCountChar");
  const tagStory = document.querySelector("#tagCountStory");
  const sideChar = document.querySelector("#sideCharCount");
  const sideStory = document.querySelector("#sideStoryCount");
  const headingChar = document.querySelector("#charCount");
  const headingStory = document.querySelector("#storyCount");

  if (tagAll) tagAll.textContent = total;
  if (tagChar) tagChar.textContent = chars.length;
  if (tagStory) tagStory.textContent = stories.length;
  if (sideChar) sideChar.textContent = chars.length;
  if (sideStory) sideStory.textContent = stories.length;
  if (headingChar) headingChar.textContent = `${chars.length} Character${chars.length === 1 ? "" : "s"} Documented`;
  if (headingStory) headingStory.textContent = `${stories.length} Series Ongoing`;
}

// Render Universe Characters
function renderCharacters() {
  if (!characterGrid) return;
  const chars = getStoredCharacters();
  characterGrid.innerHTML = "";

  if (!chars.length) {
    characterGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; border: 1px dashed var(--line); border-radius: 20px; background: rgba(22, 34, 56, 0.4);">
        <span style="font-size: 2.2rem; display: block; margin-bottom: 8px;">✦</span>
        <h3 style="margin: 0 0 6px; font-size: 1.25rem;">No characters in your Universe Codex yet</h3>
        <p style="color: var(--muted); font-size: 0.85rem; margin: 0 0 18px;">Design your first original character with photo upload, rank, powers, and auto-generated profile page.</p>
        <button type="button" class="button primary" onclick="document.querySelector('#addCharacterBtn')?.click()">＋ Design First Character</button>
      </div>
    `;
    updateCodexCounts();
    return;
  }

  chars.forEach((c) => {
    const pillsHtml = (c.pills || []).map((p) => `<span>${p}</span>`).join("");
    const article = document.createElement("article");
    article.className = "wiki-card";
    article.dataset.category = "character";
    article.dataset.name = `${c.name} ${c.role} ${c.affiliation} ${c.badge} ${(c.pills || []).join(" ")}`;

    const imgDisplay = c.photo
      ? `<img src="${c.photo}" alt="${c.name}" style="width: 100%; height: 100%; object-fit: cover;" />`
      : `<span>${c.avatar || "✦"}</span>`;

    article.innerHTML = `
      <div class="wiki-card-badge">${c.badge || "✦ Canon Rank"}</div>
      <div class="wiki-card-img" style="background: ${c.gradient || "linear-gradient(135deg, #0284c7, #0f172a)"};">
        ${imgDisplay}
      </div>
      <div class="wiki-card-body">
        <span style="font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--pink); font-weight: 700;">
          ${c.category === "real" ? "Real Entity / Creator" : "Fantasy Character"}
        </span>
        <h3 style="margin: 3px 0 4px;">${c.name}</h3>
        <p class="wiki-meta">${c.affiliation || "ARRAI Universe"} · ${c.role}</p>
        <p class="wiki-desc">${c.desc}</p>
        ${c.shortNote ? `<p style="font-size: 0.76rem; color: var(--muted); margin: -4px 0 10px; font-style: italic;">Note: ${c.shortNote}</p>` : ""}
        <div class="wiki-pills">${pillsHtml}</div>
        <div class="wiki-card-actions">
          <a class="button primary" href="story-character.html?id=${encodeURIComponent(c.id)}">Full Standalone Page <b>↗</b></a>
          <button type="button" class="button wiki-read-btn" data-character="${c.id}">Preview ✦</button>
          <button type="button" class="wiki-action-btn" data-edit-character="${c.id}" title="Edit character">✏️ Edit</button>
          <button type="button" class="wiki-action-btn danger" data-delete-character="${c.id}" title="Delete character">🗑️</button>
        </div>
      </div>
    `;
    characterGrid.appendChild(article);
  });

  updateCodexCounts();
}

// Render Original Story Arcs
function renderStories() {
  if (!storyGrid) return;
  const stories = getStoredStories();
  storyGrid.innerHTML = "";

  if (!stories.length) {
    storyGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; border: 1px dashed var(--line); border-radius: 20px; background: rgba(22, 34, 56, 0.4);">
        <span style="font-size: 2.2rem; display: block; margin-bottom: 8px;">📖</span>
        <h3 style="margin: 0 0 6px; font-size: 1.25rem;">No story arcs published yet</h3>
        <p style="color: var(--muted); font-size: 0.85rem; margin: 0 0 18px;">Publish original fiction episodes, fantasy chapters, and universe lore.</p>
        <button type="button" class="button primary" onclick="document.querySelector('#addStoryBtn')?.click()">＋ Add New Story Arc</button>
      </div>
    `;
    updateCodexCounts();
    return;
  }

  stories.forEach((s) => {
    const article = document.createElement("article");
    article.className = "wiki-story-card";
    article.dataset.category = "story";
    article.dataset.name = `${s.title} ${s.meta} ${(s.tags || []).join(" ")}`;

    article.innerHTML = `
      <div class="story-header">
        <span class="story-arc-pill">${s.arc || "Original Arc"}</span>
        <h3>${s.title}</h3>
        <p class="wiki-meta">${s.meta || "ARRAI Fiction Vault"}</p>
      </div>
      <p class="story-summary">${s.synopsis}</p>
      <div class="story-chapters-list">
        <a class="chapter-item" href="${s.chapterUrl || '#'}" style="text-decoration: none; color: inherit;">
          <div><strong>${s.chapterTitle || "Read Story Episode"}</strong></div>
          <span class="chapter-time">Open Chapter ↗</span>
        </a>
      </div>
      <div class="wiki-card-actions" style="margin-top: 18px;">
        <a class="button primary story-start-btn" href="${s.chapterUrl || '#'}">Read Story <b>↗</b></a>
        <button type="button" class="wiki-action-btn" data-edit-story="${s.id}">✏️ Edit</button>
        <button type="button" class="wiki-action-btn danger" data-delete-story="${s.id}">🗑️</button>
      </div>
    `;
    storyGrid.appendChild(article);
  });

  updateCodexCounts();
}

// Initial render
renderCharacters();
renderStories();
updateCodexCounts();

// Gallery Image Upload Handler (Converts file to base64 Data URL)
if (editCharPhotoFile) {
  editCharPhotoFile.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target.result;
      if (editCharPhotoBase64) editCharPhotoBase64.value = base64;
      if (charPhotoPreviewImg) charPhotoPreviewImg.src = base64;
      if (charPhotoPreviewContainer) charPhotoPreviewContainer.style.display = "flex";
    };
    reader.readAsDataURL(file);
  });
}

// Character Modal (Add / Edit)
function openCharModal(editId = null) {
  if (!charModal) return;
  const chars = getStoredCharacters();
  const editTarget = editId ? chars.find((x) => x.id === editId) : null;

  document.querySelector("#charModalTitle").textContent = editTarget ? `Edit ${editTarget.name}` : "Design New Character";
  document.querySelector("#editCharId").value = editTarget ? editTarget.id : "";
  document.querySelector("#editCharName").value = editTarget ? editTarget.name : "";
  document.querySelector("#editCharType").value = editTarget ? (editTarget.category || "fictional") : "fictional";
  document.querySelector("#editCharRole").value = editTarget ? editTarget.role : "";
  document.querySelector("#editCharBadge").value = editTarget ? editTarget.badge : "✦ CANON CHARACTER";
  document.querySelector("#editCharAffiliation").value = editTarget ? editTarget.affiliation : "ARRAI Universe";
  document.querySelector("#editCharAvatar").value = editTarget ? editTarget.avatar : "✿";
  document.querySelector("#editCharTheme").value = editTarget ? editTarget.gradient : "linear-gradient(135deg, #0284c7, #0f172a)";
  document.querySelector("#editCharShortNote").value = editTarget ? (editTarget.shortNote || "") : "";
  document.querySelector("#editCharDesc").value = editTarget ? editTarget.desc : "";
  document.querySelector("#editCharPills").value = editTarget ? (editTarget.pills || []).join(", ") : "";
  document.querySelector("#editCharQuote").value = editTarget ? editTarget.quote || "" : "";
  document.querySelector("#editCharBio").value = editTarget ? (editTarget.bio || "").replace(/<[^>]*>/g, "") : "";

  // Reset photo
  if (editTarget?.photo) {
    if (editCharPhotoBase64) editCharPhotoBase64.value = editTarget.photo;
    if (charPhotoPreviewImg) charPhotoPreviewImg.src = editTarget.photo;
    if (charPhotoPreviewContainer) charPhotoPreviewContainer.style.display = "flex";
  } else {
    if (editCharPhotoBase64) editCharPhotoBase64.value = "";
    if (charPhotoPreviewContainer) charPhotoPreviewContainer.style.display = "none";
  }

  charModal.hidden = false;
  charModal.style.setProperty("display", "grid", "important");
  document.body.style.overflow = "hidden";
}

function closeCharModal() {
  if (!charModal) return;
  charModal.hidden = true;
  charModal.style.setProperty("display", "none", "important");
  document.body.style.overflow = "";
}

if (addCharacterBtn) addCharacterBtn.addEventListener("click", () => openCharModal(null));
if (charModalClose) charModalClose.addEventListener("click", closeCharModal);
if (charModalCancel) charModalCancel.addEventListener("click", closeCharModal);
if (charModal) {
  charModal.addEventListener("click", (e) => {
    if (e.target === charModal) closeCharModal();
  });
}

charForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const idVal = document.querySelector("#editCharId").value.trim();
  const nameVal = document.querySelector("#editCharName").value.trim();
  const categoryVal = document.querySelector("#editCharType").value;
  const roleVal = document.querySelector("#editCharRole").value.trim();
  const badgeVal = document.querySelector("#editCharBadge").value.trim();
  const affVal = document.querySelector("#editCharAffiliation").value.trim();
  const avatarVal = document.querySelector("#editCharAvatar").value.trim() || "✿";
  const themeVal = document.querySelector("#editCharTheme").value;
  const photoVal = editCharPhotoBase64?.value || "";
  const shortNoteVal = document.querySelector("#editCharShortNote").value.trim();
  const descVal = document.querySelector("#editCharDesc").value.trim();
  const pillsVal = document.querySelector("#editCharPills").value.split(",").map((s) => s.trim()).filter(Boolean);
  const quoteVal = document.querySelector("#editCharQuote").value.trim();
  const bioVal = document.querySelector("#editCharBio").value.trim();

  let chars = getStoredCharacters();
  const charId = idVal || nameVal.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") || `char-${Date.now()}`;

  const charData = {
    id: charId,
    name: nameVal,
    category: categoryVal,
    role: roleVal,
    badge: badgeVal,
    affiliation: affVal,
    avatar: avatarVal,
    photo: photoVal,
    gradient: themeVal,
    shortNote: shortNoteVal,
    desc: descVal,
    pills: pillsVal,
    quote: quoteVal,
    bio: `<p>${bioVal || descVal}</p>`,
    abilities: pillsVal.map((p) => `<div class="ability-card"><strong>${p}:</strong> Dedicated power mastered in the ARRAI universe.</div>`).join(" ")
  };

  if (idVal) {
    chars = chars.map((c) => (c.id === idVal ? charData : c));
  } else {
    chars.unshift(charData);
  }

  saveStoredCharacters(chars);
  renderCharacters();
  closeCharModal();

  // Notify user and show link
  alert(`Character "${nameVal}" created successfully!\nStandalone Page: story-character.html?id=${charId}`);
});

// Story Modal (Add / Edit)
function openStoryModal(editId = null) {
  if (!storyModal) return;
  const stories = getStoredStories();
  const editTarget = editId ? stories.find((x) => x.id === editId) : null;

  document.querySelector("#storyModalTitle").textContent = editTarget ? `Edit ${editTarget.title}` : "Add New Story Arc";
  document.querySelector("#editStoryId").value = editTarget ? editTarget.id : "";
  document.querySelector("#editStoryTitle").value = editTarget ? editTarget.title : "";
  document.querySelector("#editStoryArc").value = editTarget ? editTarget.arc : "Arc I · Ongoing";
  document.querySelector("#editStoryMeta").value = editTarget ? editTarget.meta : "Author: Abhishek Rai · Fantasy Universe";
  document.querySelector("#editStorySynopsis").value = editTarget ? editTarget.synopsis : "";
  document.querySelector("#editStoryTags").value = editTarget ? (editTarget.tags || []).join(", ") : "";

  storyModal.hidden = false;
  storyModal.style.setProperty("display", "grid", "important");
  document.body.style.overflow = "hidden";
}

function closeStoryModal() {
  if (!storyModal) return;
  storyModal.hidden = true;
  storyModal.style.setProperty("display", "none", "important");
  document.body.style.overflow = "";
}

if (addStoryBtn) addStoryBtn.addEventListener("click", () => openStoryModal(null));
if (storyModalClose) storyModalClose.addEventListener("click", closeStoryModal);
if (storyModalCancel) storyModalCancel.addEventListener("click", closeStoryModal);
if (storyModal) {
  storyModal.addEventListener("click", (e) => {
    if (e.target === storyModal) closeStoryModal();
  });
}

storyForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const idVal = document.querySelector("#editStoryId").value.trim();
  const titleVal = document.querySelector("#editStoryTitle").value.trim();
  const arcVal = document.querySelector("#editStoryArc").value.trim();
  const metaVal = document.querySelector("#editStoryMeta").value.trim();
  const synVal = document.querySelector("#editStorySynopsis").value.trim();
  const tagsVal = document.querySelector("#editStoryTags").value.split(",").map((s) => s.trim()).filter(Boolean);

  let stories = getStoredStories();
  const storyId = idVal || titleVal.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") || `story-${Date.now()}`;

  const storyData = {
    id: storyId,
    title: titleVal,
    arc: arcVal,
    meta: metaVal,
    synopsis: synVal,
    tags: tagsVal,
    chapterTitle: "Chapter 1",
    chapterUrl: `story-chapter.html?story=${storyId}&chapter=1`
  };

  if (idVal) {
    stories = stories.map((s) => (s.id === idVal ? storyData : s));
  } else {
    stories.unshift(storyData);
  }

  saveStoredStories(stories);
  renderStories();
  closeStoryModal();
});

// Event Delegation for Character & Story Actions (Edit, Delete, Preview)
document.addEventListener("click", (e) => {
  // Preview Reader
  const readBtn = e.target.closest(".wiki-read-btn");
  if (readBtn) {
    const chars = getStoredCharacters();
    const c = chars.find((x) => x.id === readBtn.dataset.character);
    if (!c || !readerModal) return;

    readerBadge.textContent = c.category === "real" ? "REAL ENTITY / CREATOR" : "ORIGINAL CHARACTER";
    readerTitle.textContent = `${c.name} — ${c.role}`;
    const imgEl = c.photo
      ? `<img src="${c.photo}" style="width:100%; height:100%; object-fit:cover;" alt="" />`
      : c.avatar;

    readerContent.innerHTML = `
      <div class="wiki-modal-profile">
        <div class="wiki-modal-infobox">
          <div class="wiki-modal-avatar" style="background: ${c.gradient || 'linear-gradient(135deg, #0284c7, #0f172a)'}; overflow: hidden;">${imgEl}</div>
          <table class="wiki-infobox-table">
            <tr><th>Status</th><td>Active Canon</td></tr>
            <tr><th>Rank</th><td>${c.badge}</td></tr>
            <tr><th>Affiliation</th><td>${c.affiliation}</td></tr>
            <tr><th>Signature</th><td>${(c.pills || []).slice(0, 2).join(", ")}</td></tr>
          </table>
        </div>
        <div class="wiki-modal-bio">
          <h3>Overview</h3>
          <p>${c.desc}</p>
          ${c.shortNote ? `<p style="color:var(--sky); font-size:0.85rem;"><strong>Note:</strong> ${c.shortNote}</p>` : ""}
          <h3>Lore &amp; Origins</h3>
          ${c.bio || "<p>Lore archived in the Codex vaults.</p>"}
          <p><a class="button primary" href="story-character.html?id=${encodeURIComponent(c.id)}">Open Standalone Character Page <b>↗</b></a></p>
        </div>
      </div>
    `;
    readerModal.hidden = false;
    readerModal.style.setProperty("display", "grid", "important");
    document.body.style.overflow = "hidden";
    return;
  }

  // Edit Character
  const editCharBtn = e.target.closest("[data-edit-character]");
  if (editCharBtn) {
    openCharModal(editCharBtn.dataset.editCharacter);
    return;
  }

  // Delete Character
  const deleteCharBtn = e.target.closest("[data-delete-character]");
  if (deleteCharBtn) {
    const id = deleteCharBtn.dataset.deleteCharacter;
    if (confirm("Are you sure you want to permanently delete this character from your Codex?")) {
      const chars = getStoredCharacters().filter((c) => c.id !== id);
      saveStoredCharacters(chars);
      renderCharacters();
    }
    return;
  }

  // Edit Story
  const editStoryBtn = e.target.closest("[data-edit-story]");
  if (editStoryBtn) {
    openStoryModal(editStoryBtn.dataset.editStory);
    return;
  }

  // Delete Story
  const deleteStoryBtn = e.target.closest("[data-delete-story]");
  if (deleteStoryBtn) {
    const id = deleteStoryBtn.dataset.deleteStory;
    if (confirm("Are you sure you want to permanently delete this story arc?")) {
      const stories = getStoredStories().filter((s) => s.id !== id);
      saveStoredStories(stories);
      renderStories();
    }
    return;
  }
});

// Quick Reader Close
function closeReader() {
  if (!readerModal) return;
  readerModal.hidden = true;
  readerModal.style.setProperty("display", "none", "important");
  document.body.style.overflow = "";
}
window.closeReader = closeReader;
if (readerClose) readerClose.addEventListener("click", closeReader);
if (readerModal) {
  readerModal.addEventListener("click", (e) => {
    if (e.target === readerModal) closeReader();
  });
}

// Search & Filter
function applyFilter(filter, query) {
  const q = (query || "").toLowerCase().trim();
  const allCards = document.querySelectorAll(".wiki-card, .wiki-story-card");
  let visibleCharCount = 0;

  allCards.forEach((card) => {
    const category = card.dataset.category;
    const name = (card.dataset.name || "").toLowerCase();
    const matchesFilter = filter === "all" || category === filter;
    const matchesQuery = !q || name.includes(q);

    if (matchesFilter && matchesQuery) {
      card.style.display = "";
      if (category === "character") visibleCharCount++;
    } else {
      card.style.display = "none";
    }
  });

  if (charCount && filter === "character") {
    charCount.textContent = `${visibleCharCount} Entries Found`;
  }
}

wikiTags.forEach((tag) => {
  tag.addEventListener("click", () => {
    wikiTags.forEach((t) => t.classList.remove("active"));
    tag.classList.add("active");
    const filter = tag.dataset.filter;
    applyFilter(filter, wikiSearch?.value || "");
  });
});

if (wikiSearch) {
  wikiSearch.addEventListener("input", (e) => {
    const activeTag = document.querySelector(".wiki-tag.active")?.dataset.filter || "all";
    applyFilter(activeTag, e.target.value);
  });
}
if (wikiSearchBtn) {
  wikiSearchBtn.addEventListener("click", () => {
    const activeTag = document.querySelector(".wiki-tag.active")?.dataset.filter || "all";
    applyFilter(activeTag, wikiSearch?.value || "");
  });
}
