const searchablePages = [
  {
    title: "Home",
    url: "index.html",
    description: "Meet ARRAI, explore the studio, and find the latest community updates.",
    keywords: "home founder studio Abhishek Rai",
  },
  {
    title: "Abhishek Rai — Founder page",
    url: "abhishek-rai",
    description: "A dreamy founder page with Abhishek's story, music, links and ARRAI projects.",
    keywords: "founder Abhishek Rai bio story music Instagram GitHub shayari",
  },
  {
    title: "Services",
    url: "services.html",
    description: "Explore web, design, creative and digital services from ARRAI.",
    keywords: "web design development creative digital services",
  },
  {
    title: "Projects",
    url: "projects.html",
    description: "Browse projects, experiments and work from the ARRAI studio.",
    keywords: "portfolio projects work",
  },
  {
    title: "ARRAI Community",
    url: "community.html",
    description: "Share posts, meet members, join communities and send messages.",
    keywords: "social posts people profile dm direct message groups channels",
  },
  {
    title: "ARRAI Pay",
    url: "https://pay.arrai.in/",
    description: "Open ARRAI Pay to check your wallet, scan or send payments and view history.",
    keywords: "wallet payment money UPI QR funds balance bills",
  },
  {
    title: "ARRAI VIP Membership",
    url: "/membership",
    description: "See the ₹45 one-year VIP membership and its account benefits.",
    keywords: "vip membership gold badge themes annual price rupees",
  },
  {
    title: "ARRAI Family",
    url: "family.html",
    description: "Support ARRAI, explore the optional ₹45 VIP membership and see verified opt-in donor recognition.",
    keywords: "family donation donate supporters leaderboard vip membership UPI QR",
  },
  {
    title: "Music Room",
    url: "music.html",
    description: "Visit the ARRAI music room.",
    keywords: "music songs audio",
  },
  {
    title: "ARRAI Detective Agency",
    url: "detective.html",
    description: "Learn about the Detective Agency and its services.",
    keywords: "detective agency case investigation",
  },
  {
    title: "Contact ARRAI",
    url: "contact.html",
    description: "Contact the studio about a project or collaboration.",
    keywords: "contact email help support collaboration",
  },
  {
    title: "About ARRAI",
    url: "about.html",
    description: "Learn about the ARRAI studio and its work.",
    keywords: "about company studio",
  },
  {
    title: "Chess",
    url: "chess.html",
    description: "Open the ARRAI chess page.",
    keywords: "game chess",
  },
  {
    title: "Calendar",
    url: "calendar.html",
    description: "See ARRAI community events and the shared calendar.",
    keywords: "calendar dates events schedule",
  },
];

const searchInput = document.querySelector("#siteSearchInput");
const searchResults = document.querySelector("#searchResults");
const searchTitle = document.querySelector("#searchResultTitle");
const searchEyebrow = document.querySelector("#searchResultEyebrow");
const googleSearchLink = document.querySelector("#googleSearchLink");
const searchForm = document.querySelector("#siteSearchForm");

const normalizeSearchText = (text) =>
  String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const renderSearchResults = (query) => {
  const normalizedQuery = normalizeSearchText(query);
  googleSearchLink.href = normalizedQuery
    ? `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
    : "https://www.google.com/";
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const results = searchablePages
    .map((page) => {
      const title = normalizeSearchText(page.title);
      const searchable = normalizeSearchText(
        `${page.title} ${page.description} ${page.keywords}`,
      );
      const score = terms.reduce(
        (total, term) =>
          total +
          (title === term ? 8 : title.includes(term) ? 4 : 0) +
          (searchable.includes(term) ? 2 : 0),
        0,
      );
      return { ...page, score };
    })
    .filter((page) => !terms.length || page.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  searchTitle.textContent = terms.length
    ? `Results for “${query.trim()}”`
    : "Explore ARRAI";
  searchEyebrow.textContent = terms.length
    ? `${results.length} site ${results.length === 1 ? "result" : "results"}`
    : "A few good places to start";
  searchResults.replaceChildren();
  if (!results.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state search-empty";
    empty.textContent =
      "No ARRAI pages matched that phrase. Ask Gemini for a grounded web search or try Google.";
    const geminiButton = document.createElement("button");
    geminiButton.className = "button primary";
    geminiButton.type = "button";
    geminiButton.textContent = `Ask Gemini to search for “${query.trim()}”`;
    geminiButton.addEventListener("click", async () => {
      geminiButton.disabled = true;
      geminiButton.textContent = "Searching with Gemini…";
      const answerCard = document.createElement("article");
      answerCard.className = "search-result-card search-ai-answer";
      const heading = document.createElement("h3");
      heading.textContent = "Gemini web search";
      const answer = document.createElement("p");
      answer.textContent = "Looking for current sources…";
      answerCard.append(heading, answer);
      searchResults.replaceChildren(answerCard);
      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: query.trim(), webSearch: true }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Gemini search is unavailable.");
        answer.textContent = result.answer;
        const sources = (result.sources || []).filter((source) => {
          try {
            return new URL(source.url).protocol === "https:";
          } catch {
            return false;
          }
        });
        if (sources.length) {
          const sourceList = document.createElement("ul");
          sourceList.className = "search-ai-sources";
          sources.forEach((source) => {
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = source.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = source.title;
            item.append(link);
            sourceList.append(item);
          });
          answerCard.append(sourceList);
        }
      } catch (error) {
        answer.textContent = `${error.message} Try again later or use Google for the wider web.`;
      } finally {
        geminiButton.disabled = false;
        geminiButton.textContent = `Ask Gemini to search for “${query.trim()}”`;
        if (!document.body.contains(geminiButton)) answerCard.append(geminiButton);
      }
    });
    searchResults.append(empty, geminiButton);
    return;
  }
  results.forEach((result) => {
    const card = document.createElement("a");
    card.className = "search-result-card";
    card.href = result.url;
    if (result.url.startsWith("https://")) {
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    }
    const label = document.createElement("small");
    label.textContent = result.url.startsWith("https://")
      ? "pay.arrai.in"
      : "arrai.in";
    const heading = document.createElement("h3");
    heading.textContent = result.title;
    const description = document.createElement("p");
    description.textContent = result.description;
    card.append(label, heading, description);
    searchResults.append(card);
  });
};

const initialQuery = new URLSearchParams(location.search).get("q") || "";
searchInput.value = initialQuery.slice(0, 120);
renderSearchResults(searchInput.value);
searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim().slice(0, 120);
  if (!query) return;
  history.replaceState(null, "", `search.html?q=${encodeURIComponent(query)}`);
  renderSearchResults(query);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !event.target.matches("input,textarea,[contenteditable=true]")) {
    event.preventDefault();
    searchInput.focus();
  }
});
