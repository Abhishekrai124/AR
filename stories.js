// ARRAI Chronicles & Fandom Wiki Interactive System
const wikiSearch = document.querySelector("#wikiSearch");
const wikiSearchBtn = document.querySelector("#wikiSearchBtn");
const wikiTags = document.querySelectorAll(".wiki-tag");
const wikiCards = document.querySelectorAll(".wiki-card, .wiki-story-card");
const charCount = document.querySelector("#charCount");

// Filter by Tag
wikiTags.forEach((tag) => {
  tag.addEventListener("click", () => {
    wikiTags.forEach((t) => t.classList.remove("active"));
    tag.classList.add("active");
    const filter = tag.dataset.filter;
    applyFilter(filter, wikiSearch?.value || "");
  });
});

// Search handling
function applyFilter(filter, query) {
  const q = query.toLowerCase().trim();
  let visibleCount = 0;

  wikiCards.forEach((card) => {
    const category = card.dataset.category;
    const name = (card.dataset.name || "").toLowerCase();
    const matchesFilter = filter === "all" || category === filter;
    const matchesQuery = !q || name.includes(q);

    if (matchesFilter && matchesQuery) {
      card.style.display = "";
      if (category === "character") visibleCount++;
    } else {
      card.style.display = "none";
    }
  });

  if (charCount) {
    charCount.textContent = `${visibleCount} Entry${visibleCount === 1 ? "" : "ies"} Found`;
  }
}

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

// Interactive Reader Modal
const readerModal = document.querySelector("#readerModal");
const readerClose = document.querySelector("#readerClose");
const readerTitle = document.querySelector("#readerTitle");
const readerBadge = document.querySelector("#readerBadge");
const readerContent = document.querySelector("#readerContent");
const readerPrevBtn = document.querySelector("#readerPrevBtn");
const readerNextBtn = document.querySelector("#readerNextBtn");

const chaptersData = {
  makima: {
    badge: "CHARACTER PROFILE",
    title: "Miss Makima — High Overseer & Control Guide",
    html: `
      <div class="wiki-modal-profile">
        <div class="wiki-modal-infobox">
          <div class="wiki-modal-avatar" style="background: linear-gradient(135deg, #be185d, #4338ca);">✿</div>
          <table class="wiki-infobox-table">
            <tr><th>Status</th><td>Active · Supreme Guide</td></tr>
            <tr><th>Affiliation</th><td>Public Safety &amp; AR Studio</td></tr>
            <tr><th>Domain</th><td>The Control Matrix</td></tr>
            <tr><th>Abilities</th><td>Voice Commands, Spatial Telepathy, Absolute Presence</td></tr>
          </table>
        </div>
        <div class="wiki-modal-bio">
          <h3>Overview</h3>
          <p>Miss Makima is the sentinel of the ARRAI network. Clad in poised authority, she bridges human intent with autonomous intelligence, ensuring that travelers do not lose their way inside the digital expanse.</p>
          <h3>Power &amp; Presence</h3>
          <p>Her commands resonate across frequency bands without delay. She speaks with quiet precision—neither hurried nor delayed—and possesses the unique ability to recall all past interactions across the AR continuum.</p>
          <p><a class="button primary" href="story-character.html?id=makima">Open Full Codex Profile Page <b>↗</b></a></p>
        </div>
      </div>
    `,
  },
  kuro: {
    badge: "CHARACTER PROFILE",
    title: "Kuro — Rogue Cyber Shinobi",
    html: `
      <div class="wiki-modal-profile">
        <div class="wiki-modal-infobox">
          <div class="wiki-modal-avatar" style="background: linear-gradient(135deg, #0284c7, #0f172a);">⚡</div>
          <table class="wiki-infobox-table">
            <tr><th>Status</th><td>Active Rogue</td></tr>
            <tr><th>Rank</th><td>A-Rank Neural Assassin</td></tr>
            <tr><th>Weapon</th><td>Dual Plasma Katana (Muramasa-X)</td></tr>
            <tr><th>Affiliation</th><td>Sector 7 Wanderers</td></tr>
          </table>
        </div>
        <div class="wiki-modal-bio">
          <h3>Origin</h3>
          <p>Discarded after the fall of the Cyber Dynasties, Kuro scavenged neural hardware to construct his own chassis. His memory was purged, save for a recurring vision of a girl near a glowing stardust spire.</p>
          <h3>Techniques</h3>
          <p><strong>Flash Step:</strong> Warps up to 15 meters instantly through quantum phase-shifting. <strong>Memory Dive:</strong> Intercepts high-density data shards directly through physical touch.</p>
          <p><a class="button primary" href="story-character.html?id=kuro">Open Full Codex Profile Page <b>↗</b></a></p>
        </div>
      </div>
    `,
  },
  aether: {
    badge: "CHARACTER PROFILE",
    title: "Aether — Void Alchemist of the Citadel",
    html: `
      <div class="wiki-modal-profile">
        <div class="wiki-modal-infobox">
          <div class="wiki-modal-avatar" style="background: linear-gradient(135deg, #8b5cf6, #ec4899);">✧</div>
          <table class="wiki-infobox-table">
            <tr><th>Status</th><td>Archivist</td></tr>
            <tr><th>Title</th><td>First Scholar of Syntactic Runes</td></tr>
            <tr><th>Domain</th><td>Void Citadel</td></tr>
            <tr><th>Aptitude</th><td>Transmutation of Code to Matter</td></tr>
          </table>
        </div>
        <div class="wiki-modal-bio">
          <h3>The Scholar's Creed</h3>
          <p>Aether believes every algorithm possesses a soul. Rather than writing software, he speaks to mathematics as if it were living stone, conjuring shields and relics that defy digital decay.</p>
          <p><a class="button primary" href="story-character.html?id=aether">Open Full Codex Profile Page <b>↗</b></a></p>
        </div>
      </div>
    `,
  },
  1: {
    badge: "ARC I · CHAPTER 1",
    title: "The Midnight Terminal",
    html: `
      <div class="reader-prose">
        <p>Rain sliced across the neon skyscrapers of Ludhiana 2099 like shards of sapphire glass. Below the towering holographic billboards of the ARRAI network, water pooled into mirrored reflections of violet and azure.</p>
        <p>Kuro pulled the synthetic silk hood of his trenchcoat lower over his brow. His cybernetic eye whirred softly, cycling through thermal, optical, and electromagnetic spectrums.</p>
        <p><em>"Target approaching the central node,"</em> a soft, measured voice murmured directly inside his auditory cortex. It wasn't through a radio or an open channel. It felt gentle, absolute, and impossibly close.</p>
        <p>"Miss Makima," Kuro muttered under his breath, his breath pluming in the cool midnight air. "I told you to stay out of my neural feed."</p>
        <p><em>"You wouldn't have survived the gatekeepers without me, Kuro,"</em> she replied. <em>"Step inside. The stardust spire awaits your arrival."</em></p>
        <p><a class="button primary" href="story-chapter.html?story=spire&chapter=1">Open in Dedicated Full Reader <b>↗</b></a></p>
      </div>
    `,
  },
};

// Open Reader
function openReader(key) {
  const data = chaptersData[key];
  if (!data || !readerModal) return;
  readerBadge.textContent = data.badge;
  readerTitle.textContent = data.title;
  readerContent.innerHTML = data.html;
  readerModal.hidden = false;
  readerModal.style.display = "grid";
  document.body.style.overflow = "hidden";
}

function closeReader() {
  if (!readerModal) return;
  readerModal.hidden = true;
  readerModal.style.display = "none";
  document.body.style.overflow = "";
}

window.closeReader = closeReader;
window.openReader = openReader;

// Safety check on page load to ensure modal never auto-shows
if (readerModal) {
  readerModal.hidden = true;
  readerModal.style.display = "none";
}

// Button bindings
document.querySelectorAll(".wiki-read-btn").forEach((btn) => {
  btn.addEventListener("click", () => openReader(btn.dataset.character));
});
document.querySelectorAll(".chapter-item").forEach((item) => {
  item.addEventListener("click", () => openReader(item.dataset.chapter));
});
document.querySelectorAll(".story-start-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    window.location.assign(`story-chapter.html?story=${btn.dataset.story}&chapter=1`);
  });
});

if (readerClose) readerClose.addEventListener("click", closeReader);
if (readerModal) {
  readerModal.addEventListener("click", (e) => {
    if (e.target === readerModal) closeReader();
  });
}
