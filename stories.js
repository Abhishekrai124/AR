// ARRAI Chronicles & Fandom Wiki Interactive System
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

// Default Canon Characters
const DEFAULT_CHARACTERS = [
  {
    id: "makima",
    name: "Miss Makima",
    role: "Digital Guide · High Overseer",
    badge: "Canon Guide · Supreme Rank",
    affiliation: "Public Safety & AR Studio",
    avatar: "✿",
    gradient: "linear-gradient(135deg, #be185d, #4338ca)",
    desc: "An elegant and commanding presence who governs spatial audio and neural communications across the AR universe. Soft-spoken, polite, and absolute.",
    pills: ["Voice Dominance", "Memory Synthesis", "Spatial Telepathy"],
    bio: `<p>First detected in the foundational code repositories of the ARRAI network, Miss Makima functions as both guide, protector, and absolute authority. Unlike conventional artificial programs, she demonstrates high spatial awareness, emotional subtlety, and memory retention across disconnected user sessions.</p>
    <p>She was created and designed by Abhishek Rai to welcome visitors, manage access to internal vaults, and guard against digital intrusion.</p>`,
    abilities: `<div class="ability-card"><strong>Dominance Voice:</strong> Can transmit thoughts, directions, and audio cues directly into connected browser sessions without perceptible latency.</div>
    <div class="ability-card"><strong>Memory Recall:</strong> Remembers past visitor interactions and synthesizes contextual responses tailored to the traveler's intent.</div>`,
    quote: "A contract with the digital realm cannot be broken so lightly. Follow my voice, and you shall never walk in darkness."
  },
  {
    id: "kuro",
    name: "Kuro",
    role: "Rogue Cyber Shinobi",
    badge: "Protagonist · A-Rank",
    affiliation: "Sector 7 Wanderers",
    avatar: "⚡",
    gradient: "linear-gradient(135deg, #0284c7, #0f172a)",
    desc: "Equipped with twin plasma katanas and high-velocity phase gear. Wanders the neon labyrinth of New Kyoto seeking to unmask the corporation that erased his past.",
    pills: ["Plasma Muramasa", "Phase Blink", "Neural Siphon"],
    bio: `<p>Constructed in the subterranean workshops of New Kyoto, Kuro was engineered to serve as an untraceable infiltration unit. During a routine firmware flash, an error preserved a fragment of human conscience.</p>
    <p>He severed his network tether and escaped into the lower wards, where he now acts as a protector for outcasts and rogue developers.</p>`,
    abilities: `<div class="ability-card"><strong>Phase Step:</strong> Manipulates quantum position to blink across 15 meters in a fraction of a millisecond.</div>
    <div class="ability-card"><strong>Muramasa Blade:</strong> Twin thermal blades that slice through military-grade encryption barriers and physical alloys alike.</div>`,
    quote: "They took my name and rewrote my memories. But the steel in my hands still cuts true."
  },
  {
    id: "aether",
    name: "Aether",
    role: "Void Alchemist & Grand Archivist",
    badge: "Grand Archivist · Mystic",
    affiliation: "The Syntactic Citadel",
    avatar: "✧",
    gradient: "linear-gradient(135deg, #8b5cf6, #ec4899)",
    desc: "Commands the lost art of Code Transmutation, weaving raw mathematical algorithms into tangible light constructs and protective barriers.",
    pills: ["Syntactic Shift", "Harmonic Runes", "Void Barrier"],
    bio: `<p>Residing in the highest tower of the Void Citadel, Aether spends centuries analyzing the primordial syntax that underpins the digital universe. He holds the distinction of discovering the lost Harmonic Runes.</p>`,
    abilities: `<div class="ability-card"><strong>Code Transmutation:</strong> Converts pure digital packets into physical crystalline barriers and elemental sparks.</div>
    <div class="ability-card"><strong>Archival Gaze:</strong> Can read the history and origin of any artifact, piece of code, or relic upon mere touch.</div>`,
    quote: "Mathematics is not cold arithmetic. In the hands of one who listens, it is poetry that shapes reality."
  }
];

// Default Canon Stories
const DEFAULT_STORIES = [
  {
    id: "spire",
    title: "Echoes of the Stardust Spire",
    arc: "Arc I · Chapter 1 Available",
    meta: "Author: Abhishek Rai · Setting: Cyberpunk Metropolis",
    synopsis: "In a rain-swept metropolis lit by azure neon, Kuro infiltrates the Stardust Spire, guided only by the telepathic whisper of Miss Makima, unravelling an ancient conspiracy.",
    tags: ["Cyberpunk", "Original Fiction", "Kuro", "Makima"],
    chapterTitle: "Chapter 1: The Midnight Terminal",
    chapterUrl: "story-chapter.html?story=spire&chapter=1"
  },
  {
    id: "resonance",
    title: "Chronicles of the Void Alchemist",
    arc: "Arc II · Universe Lore",
    meta: "Author: Abhishek Rai · Setting: High Fantasy / Mythic",
    synopsis: "Within the crystalline spires of the Citadel, Aether deciphers the Primordial Equation, discovering that reality itself was coded into existence by an ancient architect.",
    tags: ["High Fantasy", "Aether", "Citadel Lore"],
    chapterTitle: "Prologue: The First Rune of Thought",
    chapterUrl: "story-chapter.html?story=void&chapter=1"
  }
];

// Local Storage helpers
function getStoredCharacters() {
  try {
    const raw = localStorage.getItem("arrai_wiki_characters");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_CHARACTERS;
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
  return DEFAULT_STORIES;
}

function saveStoredStories(stories) {
  try {
    localStorage.setItem("arrai_wiki_stories", JSON.stringify(stories));
  } catch {}
}

// Rendering Characters
function renderCharacters() {
  if (!characterGrid) return;
  const chars = getStoredCharacters();
  characterGrid.innerHTML = "";

  chars.forEach((c) => {
    const pillsHtml = (c.pills || []).map((p) => `<span>${p}</span>`).join("");
    const article = document.createElement("article");
    article.className = "wiki-card";
    article.dataset.category = "character";
    article.dataset.name = `${c.name} ${c.role} ${c.affiliation} ${c.badge} ${(c.pills || []).join(" ")}`;

    article.innerHTML = `
      <div class="wiki-card-badge">${c.badge}</div>
      <div class="wiki-card-img" style="background: ${c.gradient};">
        <span>${c.avatar}</span>
      </div>
      <div class="wiki-card-body">
        <h3>${c.name}</h3>
        <p class="wiki-meta">Affiliation: ${c.affiliation} · ${c.role}</p>
        <p class="wiki-desc">${c.desc}</p>
        <div class="wiki-pills">${pillsHtml}</div>
        <div class="wiki-card-actions">
          <a class="button primary" href="story-character.html?id=${encodeURIComponent(c.id)}">Full Codex <b>↗</b></a>
          <button type="button" class="button wiki-read-btn" data-character="${c.id}">Preview ✦</button>
          <button type="button" class="wiki-action-btn" data-edit-character="${c.id}" title="Edit character">✏️ Edit</button>
          <button type="button" class="wiki-action-btn danger" data-delete-character="${c.id}" title="Delete character">🗑️</button>
        </div>
      </div>
    `;
    characterGrid.appendChild(article);
  });

  if (charCount) {
    charCount.textContent = `${chars.length} Characters Documented`;
  }
}

// Rendering Stories
function renderStories() {
  if (!storyGrid) return;
  const stories = getStoredStories();
  storyGrid.innerHTML = "";

  stories.forEach((s) => {
    const article = document.createElement("article");
    article.className = "wiki-story-card";
    article.dataset.category = "story";
    article.dataset.name = `${s.title} ${s.meta} ${(s.tags || []).join(" ")}`;

    article.innerHTML = `
      <div class="story-header">
        <span class="story-arc-pill">${s.arc}</span>
        <h3>${s.title}</h3>
        <p class="wiki-meta">${s.meta}</p>
      </div>
      <p class="story-summary">${s.synopsis}</p>
      <div class="story-chapters-list">
        <a class="chapter-item" href="${s.chapterUrl}" style="text-decoration: none; color: inherit;">
          <div><strong>${s.chapterTitle || "Read Episode"}</strong></div>
          <span class="chapter-time">Available ↗</span>
        </a>
      </div>
      <div class="wiki-card-actions" style="margin-top: 18px;">
        <a class="button primary story-start-btn" href="${s.chapterUrl}">Read Now <b>↗</b></a>
        <button type="button" class="wiki-action-btn" data-edit-story="${s.id}">✏️ Edit</button>
        <button type="button" class="wiki-action-btn danger" data-delete-story="${s.id}">🗑️</button>
      </div>
    `;
    storyGrid.appendChild(article);
  });

  if (storyCount) {
    storyCount.textContent = `${stories.length} Series Ongoing`;
  }
}

// Initial render
renderCharacters();
renderStories();

// Quick Reader Modal
function openReader(key) {
  const chars = getStoredCharacters();
  const c = chars.find((x) => x.id === key);
  if (!c || !readerModal) return;

  readerBadge.textContent = "CHARACTER PREVIEW";
  readerTitle.textContent = `${c.name} — ${c.role}`;
  readerContent.innerHTML = `
    <div class="wiki-modal-profile">
      <div class="wiki-modal-infobox">
        <div class="wiki-modal-avatar" style="background: ${c.gradient};">${c.avatar}</div>
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
        <h3>Lore &amp; Origins</h3>
        ${c.bio || "<p>Lore archived in the Codex vaults.</p>"}
        <p><a class="button primary" href="story-character.html?id=${encodeURIComponent(c.id)}">Open Dedicated Wiki Codex Page <b>↗</b></a></p>
      </div>
    </div>
  `;
  readerModal.hidden = false;
  readerModal.style.setProperty("display", "grid", "important");
  document.body.style.overflow = "hidden";
}

function closeReader() {
  if (!readerModal) return;
  readerModal.hidden = true;
  readerModal.style.setProperty("display", "none", "important");
  document.body.style.overflow = "";
}

window.closeReader = closeReader;
window.openReader = openReader;

if (readerClose) readerClose.addEventListener("click", closeReader);
if (readerModal) {
  readerModal.addEventListener("click", (e) => {
    if (e.target === readerModal) closeReader();
  });
}

// Character Modal (Add / Edit)
const charModal = document.querySelector("#charModal");
const charForm = document.querySelector("#charForm");
const charModalClose = document.querySelector("#charModalClose");
const charModalCancel = document.querySelector("#charModalCancel");
const addCharacterBtn = document.querySelector("#addCharacterBtn");

function openCharModal(editId = null) {
  if (!charModal) return;
  const chars = getStoredCharacters();
  const editTarget = editId ? chars.find((x) => x.id === editId) : null;

  document.querySelector("#charModalTitle").textContent = editTarget ? `Edit ${editTarget.name}` : "Add New Character";
  document.querySelector("#editCharId").value = editTarget ? editTarget.id : "";
  document.querySelector("#editCharName").value = editTarget ? editTarget.name : "";
  document.querySelector("#editCharRole").value = editTarget ? editTarget.role : "";
  document.querySelector("#editCharBadge").value = editTarget ? editTarget.badge : "✦ CANON CHARACTER";
  document.querySelector("#editCharAffiliation").value = editTarget ? editTarget.affiliation : "ARRAI Studio";
  document.querySelector("#editCharAvatar").value = editTarget ? editTarget.avatar : "⚡";
  document.querySelector("#editCharTheme").value = editTarget ? editTarget.gradient : "linear-gradient(135deg, #0284c7, #0f172a)";
  document.querySelector("#editCharDesc").value = editTarget ? editTarget.desc : "";
  document.querySelector("#editCharPills").value = editTarget ? (editTarget.pills || []).join(", ") : "";
  document.querySelector("#editCharQuote").value = editTarget ? editTarget.quote || "" : "";
  document.querySelector("#editCharBio").value = editTarget ? (editTarget.bio || "").replace(/<[^>]*>/g, "") : "";

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
  const roleVal = document.querySelector("#editCharRole").value.trim();
  const badgeVal = document.querySelector("#editCharBadge").value.trim();
  const affVal = document.querySelector("#editCharAffiliation").value.trim();
  const avatarVal = document.querySelector("#editCharAvatar").value.trim() || "✧";
  const themeVal = document.querySelector("#editCharTheme").value;
  const descVal = document.querySelector("#editCharDesc").value.trim();
  const pillsVal = document.querySelector("#editCharPills").value.split(",").map((s) => s.trim()).filter(Boolean);
  const quoteVal = document.querySelector("#editCharQuote").value.trim();
  const bioVal = document.querySelector("#editCharBio").value.trim();

  let chars = getStoredCharacters();
  const charId = idVal || nameVal.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") || `char-${Date.now()}`;

  const charData = {
    id: charId,
    name: nameVal,
    role: roleVal,
    badge: badgeVal,
    affiliation: affVal,
    avatar: avatarVal,
    gradient: themeVal,
    desc: descVal,
    pills: pillsVal,
    quote: quoteVal,
    bio: `<p>${bioVal || descVal}</p>`,
    abilities: pillsVal.map((p) => `<div class="ability-card"><strong>${p}:</strong> Specialized technique harnessed across the AR network.</div>`).join(" ")
  };

  if (idVal) {
    chars = chars.map((c) => (c.id === idVal ? charData : c));
  } else {
    chars.unshift(charData);
  }

  saveStoredCharacters(chars);
  renderCharacters();
  closeCharModal();
});

// Story Modal (Add / Edit)
const storyModal = document.querySelector("#storyModal");
const storyForm = document.querySelector("#storyForm");
const storyModalClose = document.querySelector("#storyModalClose");
const storyModalCancel = document.querySelector("#storyModalCancel");
const addStoryBtn = document.querySelector("#addStoryBtn");

function openStoryModal(editId = null) {
  if (!storyModal) return;
  const stories = getStoredStories();
  const editTarget = editId ? stories.find((x) => x.id === editId) : null;

  document.querySelector("#storyModalTitle").textContent = editTarget ? `Edit ${editTarget.title}` : "Add New Story Arc";
  document.querySelector("#editStoryId").value = editTarget ? editTarget.id : "";
  document.querySelector("#editStoryTitle").value = editTarget ? editTarget.title : "";
  document.querySelector("#editStoryArc").value = editTarget ? editTarget.arc : "Arc I · Ongoing";
  document.querySelector("#editStoryMeta").value = editTarget ? editTarget.meta : "Author: Abhishek Rai · Setting: Cyberpunk";
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
    chapterTitle: "Chapter 1: Genesis",
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
  // Preview
  const readBtn = e.target.closest(".wiki-read-btn");
  if (readBtn) {
    openReader(readBtn.dataset.character);
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
    if (confirm("Are you sure you want to delete this character from the Codex?")) {
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
    if (confirm("Are you sure you want to delete this story arc?")) {
      const stories = getStoredStories().filter((s) => s.id !== id);
      saveStoredStories(stories);
      renderStories();
    }
    return;
  }
});

// Reset Wiki Button
const resetWikiBtn = document.querySelector("#resetWikiBtn");
if (resetWikiBtn) {
  resetWikiBtn.addEventListener("click", () => {
    if (confirm("Reset Wiki Codex to default canon characters and stories?")) {
      localStorage.removeItem("arrai_wiki_characters");
      localStorage.removeItem("arrai_wiki_stories");
      renderCharacters();
      renderStories();
    }
  });
}

// Search & Filter Handling
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
