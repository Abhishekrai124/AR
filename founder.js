(() => {
  const OWNER_EMAIL = "abhishekrai6897@gmail.com";
  const PAGE_ID = "abhishek-rai";
  const DEFAULT_PAGE = {
    name: "Abhishek Rai",
    username: "abhishekyadav312_",
    title: "A little room for wonder",
    crown: "♛",
    bio: "Building soft places on the internet, following music home, and saving a little wonder for ordinary days. ✨",
    description: "Founder of ARRAI · Digital creator · I like thoughtful technology, honest stories, late-night melodies, and people who make the world feel kinder.",
    avatar_url: location.protocol === "file:"
      ? "assets/abhishek-rai-public.jpeg"
      : "/assets/abhishek-rai-public.jpeg",
    location: "",
    links: {
      instagram: "https://instagram.com/abhishekyadav312_",
      threads: "",
      x: "https://x.com/abhishekrai781",
      linkedin: "https://linkedin.com/in/abhishekrai1576",
      facebook: "https://facebook.com/iiabhishekrai",
      github: "https://github.com/Abhishekrai124",
      youtube: "https://youtube.com/@abhishekyadavrai",
      website: "https://arrai.in",
      email: "abhishekrai6897@gmail.com",
    },
    music: { title: "", artist: "", url: "" },
    stories: [],
    posts: [
      {
        id: "first-chord",
        text: "Somewhere between a half-written dream and a song I can’t quite name, I found this little corner. May it feel like a warm light left on for you. 🌙✨",
        image_url: location.protocol === "file:"
          ? "assets/abhishek-rai-public.jpeg"
          : "/assets/abhishek-rai-public.jpeg",
        location: "",
        music_title: "",
        music_url: "",
        created_at: "2026-10-05T00:00:00.000Z",
      },
    ],
  };
  const linkDetails = [
    ["instagram", "Instagram", "◎"],
    ["threads", "Threads", "＠"],
    ["x", "X", "𝕏"],
    ["linkedin", "LinkedIn", "in"],
    ["facebook", "Facebook", "f"],
    ["github", "GitHub", "⌘"],
    ["youtube", "YouTube", "▶"],
    ["website", "Website", "↗"],
    ["email", "Email", "✉"],
  ];
  const uploadTypes = {
    image: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    },
    audio: {
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/ogg": "ogg",
      "audio/wav": "wav",
      "audio/aac": "aac",
      "audio/x-m4a": "m4a",
    },
  };
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const safeUrl = (value = "") => {
    const url = String(value).trim();
    if (!url) return "";
    if (
      (url.startsWith("/assets/") && !url.startsWith("//")) ||
      url.startsWith("assets/")
    ) return url;
    try {
      const parsed = new URL(url, location.origin);
      return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
      return "";
    }
  };
  const founderImageUrl = (value = "") => {
    const url = safeUrl(value);
    if (!url) return "";
    const pathname = new URL(url, document.baseURI).pathname;
    return pathname.endsWith("/founder.jpg") || pathname.endsWith("/abhishek-rai.jpg")
      ? DEFAULT_PAGE.avatar_url
      : url;
  };
  const authPromise = window.arraiAuth;
  let auth = { isAuthenticated: false, user: null };
  let databaseReady = false;
  let page = structuredClone(DEFAULT_PAGE);
  let comments = [];
  let reactions = [];
  let publicMusicTracks = [];
  let editingPostId = "";
  let randomTrack = null;
  let databaseChecked = false;
  let eventsInstalled = false;
  const founderThemeStorageKey = "arrai-founder-theme";
  const visitorSessionKey = "arrai-visitor-session";
  let visitorSessionId = "";

  function initializePageTheme() {
    const select = byId("founderThemeSelect");
    const validThemes = window.arraiThemeOptions || ["midnight", "warm"];
    let theme = "midnight";
    try {
      const savedTheme = localStorage.getItem(founderThemeStorageKey);
      if (savedTheme && validThemes.includes(savedTheme)) theme = savedTheme;
      visitorSessionId = sessionStorage.getItem(visitorSessionKey) || crypto.randomUUID();
      sessionStorage.setItem(visitorSessionKey, visitorSessionId);
    } catch (error) {
      console.warn("Page-only theme preference could not be restored:", error);
    }
    if (!visitorSessionId) visitorSessionId = crypto.randomUUID();
    document.body.dataset.founderTheme = theme;
    if (select) select.value = theme;
    if (window.arraiCanUseTheme && !["midnight", "warm"].includes(theme)) {
      const savedTheme = theme;
      window.arraiCanUseTheme(savedTheme).then((allowed) => {
        if (!allowed && document.body.dataset.founderTheme === savedTheme) {
          document.body.dataset.founderTheme = "midnight";
          if (select) select.value = "midnight";
          showStatus("Your saved page-only premium theme is unavailable for this account now; Midnight is selected.", "info");
        }
      }).catch((error) => {
        console.error("The saved page theme could not be verified:", error);
        showStatus(`The saved page theme could not be verified: ${error.message}`, "error");
      });
    }
    select?.addEventListener("change", async () => {
      const selected = select.value;
      if (!validThemes.includes(selected)) return;
      if (window.arraiCanUseTheme && !(await window.arraiCanUseTheme(selected))) {
        select.value = document.body.dataset.founderTheme || "midnight";
        showStatus("Sign in to use Warm, or choose an eligible account for the other page-only themes.", "info");
        return;
      }
      try {
        localStorage.setItem(founderThemeStorageKey, selected);
        document.body.dataset.founderTheme = selected;
      } catch (error) {
        showStatus(`This page theme could not be saved: ${error.message}`, "error");
      }
    });

    const atmosphereSelect = byId("founderAtmosphereSelect");
    const validAtmospheres = [
      "none",
      "sakura",
      "rose",
      "stars",
      "sakura-rose",
      "flowers-stars",
      "moon-bloom",
      "rose-night",
    ];
    let atmosphere = "none";
    try {
      const savedAtmosphere = localStorage.getItem("arrai-founder-atmosphere");
      if (savedAtmosphere && validAtmospheres.includes(savedAtmosphere)) atmosphere = savedAtmosphere;
    } catch (error) {
      console.warn("Page atmosphere preference could not be restored:", error);
    }
    document.body.dataset.founderAtmosphere = atmosphere;
    if (atmosphereSelect) atmosphereSelect.value = atmosphere;
    atmosphereSelect?.addEventListener("change", () => {
      const selected = atmosphereSelect.value;
      if (!validAtmospheres.includes(selected)) return;
      try {
        localStorage.setItem("arrai-founder-atmosphere", selected);
        document.body.dataset.founderAtmosphere = selected;
      } catch (error) {
        showStatus(`This page mood could not be saved: ${error.message}`, "error");
      }
    });

    const quoteToast = byId("founderQuoteToast");
    const quoteText = byId("founderQuoteText");
    const closeQuote = byId("closeFounderQuote");
    if (quoteToast && quoteText && closeQuote) {
      const notes = [
        ["en", "Somewhere, someone is wishing you a softer day."],
        ["hi", "कहीं कोई तुम्हारे दिन के थोड़ा और नरम होने की दुआ कर रहा है।"],
        ["pa", "ਕਿਤੇ ਕੋਈ ਤੇਰੇ ਦਿਨ ਦੇ ਹੋਰ ਸੋਹਣੇ ਹੋਣ ਦੀ ਦੁਆ ਕਰ ਰਿਹਾ ਹੈ।"],
        ["ur", "کہیں کوئی تمہارے دن کے نرم اور خوبصورت ہونے کی دعا کر رہا ہے۔"],
        ["ar", "في مكان ما، يتمنى لك أحدهم يومًا أكثر لطفًا."],
        ["fr", "Quelque part, quelqu’un te souhaite une journée plus douce."],
        ["es", "En algún lugar, alguien te desea un día más amable."],
        ["bn", "কোথাও কেউ তোমার জন্য আরও কোমল একটি দিন কামনা করছে।"],
        ["ja", "どこかで誰かが、あなたにやさしい一日を願っている。"],
        ["fa", "یک‌جایی، کسی برایت روزی آرام‌تر آرزو می‌کند."],
      ];
      let lastNoteIndex = -1;
      let hideNoteTimer;
      const showNote = () => {
        let index = Math.floor(Math.random() * notes.length);
        if (notes.length > 1 && index === lastNoteIndex) index = (index + 1) % notes.length;
        lastNoteIndex = index;
        const [language, text] = notes[index];
        quoteText.lang = language;
        quoteText.dir = ["ur", "ar", "fa"].includes(language) ? "rtl" : "auto";
        quoteText.textContent = text;
        quoteToast.hidden = false;
        clearTimeout(hideNoteTimer);
        hideNoteTimer = window.setTimeout(() => {
          quoteToast.hidden = true;
        }, 9000);
      };
      closeQuote.addEventListener("click", () => {
        clearTimeout(hideNoteTimer);
        quoteToast.hidden = true;
      });
      window.setTimeout(showNote, 8000);
      window.setInterval(() => {
        if (quoteToast.hidden) showNote();
      }, 52000);
    }
  }

  function updateLocalClock() {
    const clock = byId("founderLocalTime");
    if (!clock) return;
    clock.dateTime = new Date().toISOString();
    clock.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
  }

  async function loadVisitorStats() {
    const { data, error } = await window.arraiSupabase.rpc("arrai_public_visitor_stats");
    if (error) throw error;
    const total = Number(data?.visits || 0);
    byId("siteVisitorCount").textContent = new Intl.NumberFormat().format(total);
    const cities = Array.isArray(data?.cities) ? data.cities : [];
    byId("siteVisitorPlaces").textContent = cities.length
      ? `Opt-in city lights: ${cities.map((item) => `${item.city}, ${item.region}, ${item.country} · ${item.visits}`).join("  ✦  ")}. Only groups of 3+ are shown.`
      : "Only grouped city/state/country totals with at least three opt-ins appear here. No IP addresses, names or precise locations are published.";
  }

  async function recordVisitorSession() {
    const { error } = await window.arraiSupabase.rpc("arrai_record_site_visit", {
      p_session_id: visitorSessionId,
    });
    if (error) throw error;
  }

  async function showCityWeather(city, region, country) {
    const weather = byId("founderWeather");
    weather.hidden = false;
    weather.textContent = `Checking the sky above ${city}…`;
    const lookupUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    lookupUrl.search = new URLSearchParams({ name: city, count: "10", language: "en", format: "json" });
    const placeResponse = await fetch(lookupUrl);
    if (!placeResponse.ok) throw new Error(`City lookup failed (${placeResponse.status}).`);
    const placeData = await placeResponse.json();
    const place = (placeData.results || []).find((item) =>
      item.name?.toLowerCase() === city.toLowerCase() &&
      (!region || item.admin1?.toLowerCase() === region.toLowerCase()) &&
      (!country || item.country?.toLowerCase() === country.toLowerCase()),
    );
    if (!place) throw new Error("Could not match that city to a weather station.");
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: "temperature_2m,apparent_temperature,weather_code",
      timezone: place.timezone || "auto",
    });
    const weatherResponse = await fetch(weatherUrl);
    if (!weatherResponse.ok) throw new Error(`Weather lookup failed (${weatherResponse.status}).`);
    const result = await weatherResponse.json();
    const current = result.current;
    if (!current || !Number.isFinite(current.temperature_2m)) {
      throw new Error("Current weather is not available for that city.");
    }
    const symbols = {
      0: "☀️ Clear",
      1: "🌤️ Mostly clear",
      2: "⛅ Partly cloudy",
      3: "☁️ Cloudy",
      45: "🌫️ Foggy",
      48: "🌫️ Foggy",
      51: "🌦️ Drizzle",
      53: "🌦️ Drizzle",
      55: "🌧️ Drizzle",
      61: "🌧️ Rain",
      63: "🌧️ Rain",
      65: "🌧️ Heavy rain",
      71: "🌨️ Snow",
      73: "🌨️ Snow",
      75: "❄️ Heavy snow",
      80: "🌦️ Showers",
      81: "🌧️ Showers",
      82: "⛈️ Heavy showers",
      95: "⛈️ Thunderstorm",
      96: "⛈️ Thunderstorm",
      99: "⛈️ Thunderstorm",
    };
    const localTime = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: place.timezone || undefined,
    }).format(new Date());
    weather.textContent = `${symbols[current.weather_code] || "🌥️ Sky"} · ${Math.round(current.temperature_2m)}°C in ${place.name} · ${localTime}`;
    weather.title = `Feels like ${Math.round(current.apparent_temperature)}°C. Weather from Open-Meteo.`;
  }

  function installVisitorSharing() {
    const dialog = byId("visitorLocationDialog");
    const form = byId("visitorLocationForm");
    byId("shareVisitorCity").addEventListener("click", () => dialog.showModal());
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = new FormData(form);
      if (!values.get("consent")) return;
      const location = {
        city: String(values.get("city") || "").trim(),
        region: String(values.get("region") || "").trim(),
        country: String(values.get("country") || "").trim(),
      };
      const errorTarget = byId("visitorLocationError");
      errorTarget.hidden = true;
      try {
        const { error } = await window.arraiSupabase.rpc("arrai_share_visitor_city", {
          p_session_id: visitorSessionId,
          p_city: location.city,
          p_region: location.region,
          p_country: location.country,
          p_consent: values.get("consent") === "on",
        });
        if (error) throw error;
        sessionStorage.setItem("arrai-visitor-city", JSON.stringify(location));
        dialog.close();
        showStatus("Thanks for sharing a little city light. Your location stays in anonymous, grouped totals.", "success");
        try {
          await loadVisitorStats();
        } catch (error) {
          showStatus(`Your city was shared, but totals could not refresh: ${error.message}`, "error");
        }
        try {
          await showCityWeather(location.city, location.region, location.country);
        } catch (error) {
          const weather = byId("founderWeather");
          weather.hidden = false;
          weather.textContent = `Weather unavailable: ${error.message}`;
        }
      } catch (error) {
        errorTarget.textContent = error.message || "Your city could not be shared.";
        errorTarget.hidden = false;
      }
    });
  }

  function installPageEngagementEvents() {
    const themeSelect = byId("founderThemeSelect");
    const pageTheme = document.body.dataset.founderTheme || "midnight";
    if (themeSelect) themeSelect.value = pageTheme;
    byId("founderLocalTime").dateTime = new Date().toISOString();
    updateLocalClock();
    window.setInterval(updateLocalClock, 60_000);
    installVisitorSharing();
    try {
      const savedCity = sessionStorage.getItem("arrai-visitor-city");
      if (savedCity) {
        const city = JSON.parse(savedCity);
        if (city.city && city.region && city.country) {
          showCityWeather(city.city, city.region, city.country).catch((error) => {
            byId("founderWeather").hidden = false;
            byId("founderWeather").textContent = `Weather unavailable: ${error.message}`;
          });
        }
      }
    } catch (error) {
      console.warn("The optional city weather preference could not be restored:", error);
    }
  }

  function showStatus(message, type = "info") {
    const status = byId("founderStatus");
    status.textContent = message;
    status.dataset.type = type;
    status.hidden = false;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "A little while ago"
      : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function postComments(postId) {
    return comments.filter((comment) => comment.post_id === postId);
  }

  function postReactions(postId, kind) {
    return reactions.filter((reaction) => reaction.post_id === postId && reaction.kind === kind);
  }

  function chooseRandomTrack() {
    const tracks = [
      ...publicMusicTracks,
      page.music,
      ...(page.posts || []).map((post) => ({
        title: post.music_title,
        artist: page.name,
        url: post.music_url,
      })),
    ].filter((track) => {
      const url = safeUrl(track?.url);
      if (!url || /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|spotify\.com|soundcloud\.com)\//i.test(url)) {
        return false;
      }
      return /\.(mp3|m4a|ogg|wav|aac)$/i.test(new URL(url).pathname) ||
        track?.media_type?.startsWith("audio/");
    });
    randomTrack = tracks.length
      ? tracks[Math.floor(Math.random() * tracks.length)]
      : null;
  }

  async function playRandomTrack() {
    const audio = byId("founderRandomAudio");
    if (!audio) return;
    try {
      audio.volume = 0.38;
      await audio.play();
      byId("founderMusicPlay").hidden = true;
    } catch {
      byId("founderMusicPlay").hidden = false;
      byId("founderMusicPlay").textContent = "▶ Tap to play";
    }
  }

  function renderLinks() {
    byId("creatorLinks").innerHTML = linkDetails
      .map(([key, label, icon]) => {
        const value = page.links?.[key] || DEFAULT_PAGE.links[key];
        const raw = key === "email" && value
          ? `mailto:${value}`
          : value;
        const href = key === "email"
          ? (value ? `mailto:${escapeHtml(value)}` : "")
          : safeUrl(raw);
        if (!href) return "";
        return `<a href="${escapeHtml(href)}" ${key === "email" ? "" : 'target="_blank" rel="noopener noreferrer"'}><span aria-hidden="true">${icon}</span>${label}</a>`;
      })
      .join("");
  }

  function renderProfile() {
    const avatar = founderImageUrl(page.avatar_url) || DEFAULT_PAGE.avatar_url;
    byId("creatorAvatar").src = avatar;
    byId("creatorAvatar").alt = page.name || DEFAULT_PAGE.name;
    byId("creatorCrown").textContent = page.crown || "";
    byId("creatorCrown").hidden = !page.crown;
    byId("creatorTitle").textContent = page.title || "";
    byId("creatorName").textContent = page.name || DEFAULT_PAGE.name;
    byId("creatorHandle").textContent = `@${page.username || DEFAULT_PAGE.username}`;
    byId("creatorBio").textContent = page.bio || "";
    byId("creatorDescription").textContent = page.description || "";
    const locationText = page.location?.trim();
    byId("creatorLocation").hidden = !locationText;
    byId("creatorLocation").innerHTML = locationText
      ? `📍 ${escapeHtml(locationText)} · <a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(locationText)}" target="_blank" rel="noopener noreferrer">view map</a>`
      : "";
    renderLinks();

    const musicBox = byId("creatorMusic");
    const musicUrl = safeUrl(randomTrack?.url);
    const trackKey = `${musicUrl}|${randomTrack?.title || ""}|${randomTrack?.artist || ""}`;
    musicBox.hidden = false;
    if (!randomTrack) {
      musicBox.dataset.trackKey = "no-track";
      musicBox.innerHTML = `<span class="creator-music-icon" aria-hidden="true">♫</span><span><b>Random soundtrack, coming soon</b><small>Add an audio track to the public music room to turn on random play.</small></span><a class="creator-music-link" href="/music">Music room ↗</a>`;
    } else if (musicBox.dataset.trackKey !== trackKey) {
      musicBox.dataset.trackKey = trackKey;
      musicBox.innerHTML = `
        <span class="creator-music-icon" aria-hidden="true">♫</span>
        <span><b>${escapeHtml(randomTrack.title || "A little soundtrack")}</b><small>${escapeHtml(randomTrack.artist || page.name)} · picked at random</small></span>
        <div class="creator-random-controls"><audio id="founderRandomAudio" controls autoplay preload="auto" src="${escapeHtml(musicUrl)}" aria-label="Random song: ${escapeHtml(randomTrack.title || "Abhishek's music")}"></audio><button id="founderMusicPlay" class="founder-button founder-button-light" type="button" hidden>▶ Tap to play</button></div>`;
      byId("founderRandomAudio").addEventListener("error", () => {
        byId("founderMusicPlay").hidden = false;
        byId("founderMusicPlay").textContent = "Track unavailable — tap to retry";
      });
      byId("founderMusicPlay").addEventListener("click", () => {
        playRandomTrack().catch((error) => showStatus(error.message, "error"));
      });
    }

    const stories = (page.stories || []).filter((story) => story.title && founderImageUrl(story.image_url));
    byId("creatorStoriesSection").hidden = !stories.length;
    byId("creatorStories").innerHTML = stories.map((story) =>
      `<div class="creator-story"><img src="${escapeHtml(founderImageUrl(story.image_url))}" alt="" loading="lazy" /><span>${escapeHtml(story.title)}</span></div>`,
    ).join("");
    byId("postCount").textContent = page.posts?.length || 0;
    byId("likeCount").textContent = reactions.filter((reaction) => reaction.kind === "like").length;
    byId("commentCount").textContent = comments.length;
  }

  function renderPosts() {
    const container = byId("creatorPosts");
    if (!page.posts?.length) {
      container.innerHTML = `<p class="creator-empty">${auth.user?.email?.toLowerCase() === OWNER_EMAIL
        ? "Your page is ready. Add a note, photo, music link, or location when you feel like sharing."
        : "No moments shared just yet. Come back soon for a new little story."}</p>`;
      return;
    }
    container.innerHTML = page.posts.map((post) => {
      const id = String(post.id || "");
      const image = founderImageUrl(post.image_url);
      const audioUrl = safeUrl(post.music_url);
      const liked = reactions.some((reaction) => reaction.post_id === id && reaction.kind === "like" && reaction.user_id === auth.user?.sub);
      const reposted = reactions.some((reaction) => reaction.post_id === id && reaction.kind === "repost" && reaction.user_id === auth.user?.sub);
      const postNotes = postComments(id);
      const ownerEdit = auth.user?.email?.toLowerCase() === OWNER_EMAIL
        ? `<button class="creator-post-edit" data-action="edit-post" data-post="${escapeHtml(id)}" type="button">Edit</button>`
        : "";
      const location = post.location?.trim()
        ? `<p class="creator-post-location">📍 ${escapeHtml(post.location)}</p>`
        : "";
      const media = image ? `<img class="creator-post-media" src="${escapeHtml(image)}" alt="Moment shared by ${escapeHtml(page.name)}" loading="lazy" />` : "";
      const audio = audioUrl
        ? `<div class="creator-post-audio"><span>♫ ${escapeHtml(post.music_title || "A little soundtrack")}</span>${/\.(mp3|m4a|ogg|wav|aac)(\?.*)?$/i.test(audioUrl)
          ? `<audio controls preload="none" src="${escapeHtml(audioUrl)}"></audio>`
          : `<a class="creator-music-link" href="${escapeHtml(audioUrl)}" target="_blank" rel="noopener noreferrer">Open track ↗</a>`}</div>`
        : "";
      const renderedComments = postNotes.map((comment) =>
        `<article class="creator-comment"><div class="creator-comment-head"><b>${escapeHtml(comment.display_name || "Community member")}</b>${auth.user?.email?.toLowerCase() === OWNER_EMAIL ? `<button data-action="delete-comment" data-comment="${escapeHtml(comment.id)}" type="button" aria-label="Delete note">Delete</button>` : ""}</div><p>${escapeHtml(comment.body)}</p><time>${formatDate(comment.created_at)}</time></article>`,
      ).join("");
      return `<article class="creator-post" id="post-${escapeHtml(id)}">
        <header class="creator-post-head"><div class="creator-post-author"><img src="${escapeHtml(founderImageUrl(page.avatar_url) || DEFAULT_PAGE.avatar_url)}" alt="" loading="lazy" /><span><b>${escapeHtml(page.name)}</b><time>${formatDate(post.created_at)}</time></span></div>${ownerEdit}</header>
        <p class="creator-post-copy">${escapeHtml(post.text || "")}</p>${location}${media}${audio}
        <div class="creator-post-actions">
          <button data-action="like" data-post="${escapeHtml(id)}" class="${liked ? "is-active" : ""}" type="button" aria-pressed="${liked}">♡ <span>${postReactions(id, "like").length}</span> Appreciate</button>
          <button data-action="comments" data-post="${escapeHtml(id)}" type="button">☷ <span>${postNotes.length}</span> Notes</button>
          <button data-action="repost" data-post="${escapeHtml(id)}" class="${reposted ? "is-active" : ""}" type="button" aria-pressed="${reposted}">⟳ <span>${postReactions(id, "repost").length}</span> Repost</button>
        </div>
        <div class="creator-comments" id="comments-${escapeHtml(id)}" ${postNotes.length ? "" : "hidden"}>${renderedComments}</div>
        <form class="creator-comment-form" data-post="${escapeHtml(id)}"><input name="body" maxlength="500" aria-label="Write a note" placeholder="Leave a kind note…" required /><button type="submit">Send</button></form>
      </article>`;
    }).join("");
  }

  function render() {
    renderProfile();
    renderPosts();
  }

  async function loadInteractions() {
    if (!databaseReady || !page.posts?.length) return;
    const postIds = page.posts.map((post) => String(post.id)).filter(Boolean);
    if (!postIds.length) return;
    const [commentResult, reactionResult] = await Promise.all([
      window.arraiSupabase.from("founder_page_comments").select("id,post_id,display_name,body,created_at").in("post_id", postIds).order("created_at", { ascending: true }),
      window.arraiSupabase.from("founder_page_reactions").select("post_id,user_id,kind").in("post_id", postIds),
    ]);
    if (commentResult.error) throw commentResult.error;
    if (reactionResult.error) throw reactionResult.error;
    comments = commentResult.data || [];
    reactions = reactionResult.data || [];
  }

  async function loadPublicMusic() {
    if (!window.arraiSupabase) return;
    const { data, error } = await window.arraiSupabase
      .from("music_tracks")
      .select("title,artist,media_url,media_type")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      console.error("Could not load public songs for the random soundtrack:", error);
      return;
    }
    publicMusicTracks = (data || []).map((track) => ({
      title: track.title,
      artist: track.artist,
      url: track.media_url,
      media_type: track.media_type,
    }));
  }

  function setOwnerControls() {
    const isOwner = auth.user?.email?.toLowerCase() === OWNER_EMAIL;
    const editButton = byId("editProfileButton");
    const postButton = byId("newPostButton");
    editButton.hidden = !isOwner;
    postButton.hidden = !isOwner;
    editButton.disabled = !databaseReady;
    postButton.disabled = !databaseReady;
    editButton.title = databaseReady ? "" : databaseChecked
      ? "The page database needs its setup migration before edits can be saved."
      : "Checking the page database; editing will be enabled when it is ready.";
    postButton.title = editButton.title;
    byId("ownerSignIn").hidden = isOwner;
    const studioStatus = byId("ownerStudioStatus");
    studioStatus.hidden = !isOwner;
    studioStatus.textContent = databaseReady
      ? `Owner Studio · signed in as ${auth.user.email}. Your page edits are enabled.`
      : databaseChecked
        ? `Owner Studio · signed in as ${auth.user.email}. This page is showing a preview; check the message above and apply supabase-founder-page-migration.sql in Supabase if it is not installed.`
        : `Owner Studio · signed in as ${auth.user.email}. Checking the shared page data; edits will unlock when it is ready.`;
    byId("creatorPosts").dataset.owner = String(isOwner);
  }

  function openProfileEditor() {
    const form = byId("founderProfileForm");
    for (const key of ["name", "username", "title", "crown", "bio", "description", "avatar_url", "location"])
      form.elements.namedItem(key).value = key === "avatar_url"
        ? founderImageUrl(page[key]) || DEFAULT_PAGE.avatar_url
        : page[key] || "";
    for (const key of ["title", "artist", "url"]) {
      form.elements.namedItem(`music_${key}`).value = page.music?.[key] || "";
    }
    for (const [key] of linkDetails) form.elements.namedItem(key).value = page.links?.[key] || DEFAULT_PAGE.links[key] || "";
    form.elements.namedItem("stories").value = (page.stories || [])
      .map((story) => `${story.title} | ${story.image_url}`).join("\n");
    byId("profileFormError").hidden = true;
    byId("founderProfileDialog").showModal();
  }

  function openPostEditor(post = null) {
    const form = byId("founderPostForm");
    editingPostId = post?.id || "";
    byId("postDialogTitle").textContent = post ? "Edit a moment" : "Add a moment";
    byId("deletePostButton").hidden = !post;
    byId("postFormError").hidden = true;
    for (const key of ["text", "image_url", "location", "music_title", "music_url"]) {
      form.elements.namedItem(key).value = post?.[key] || "";
    }
    const postDate = post?.created_at ? new Date(post.created_at) : new Date();
    form.elements.namedItem("created_at").value = Number.isNaN(postDate.getTime())
      ? ""
      : new Date(postDate.getTime() - postDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    byId("founderPostDialog").showModal();
  }

  function reportFormError(id, message) {
    const element = byId(id);
    element.textContent = message;
    element.hidden = false;
  }

  async function persistPage(nextPage) {
    const { data, error } = await window.arraiSupabase
      .from("founder_page_content")
      .update({ content: nextPage })
      .eq("id", PAGE_ID)
      .select("id")
      .single();
    if (error) throw error;
    if (!data) throw new Error("The owner-only page record was not updated.");
    page = nextPage;
    render();
  }

  async function uploadOwnerFile(file, bucket, kind, maximumBytes) {
    if (!file) return "";
    if (auth.user?.email?.toLowerCase() !== OWNER_EMAIL) {
      throw new Error("Only the page owner can upload files here.");
    }
    if (file.size > maximumBytes) {
      throw new Error(`That file is too large. The limit is ${Math.round(maximumBytes / 1024 / 1024)} MB.`);
    }
    const extension = uploadTypes[kind][file.type];
    if (!extension) throw new Error(`Please choose a supported ${kind} file.`);
    const objectPath = `${auth.user.sub}/founder-${crypto.randomUUID()}.${extension}`;
    const storage = window.arraiSupabase.storage.from(bucket);
    const { error } = await storage.upload(objectPath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data } = storage.getPublicUrl(objectPath);
    if (!data?.publicUrl) throw new Error("The upload completed, but its public URL could not be created.");
    return data.publicUrl;
  }

  async function requireMember() {
    if (!auth.isAuthenticated) {
      location.href = "/auth?next=founder";
      return false;
    }
    return true;
  }

  async function toggleReaction(postId, kind) {
    if (!(await requireMember())) return;
    const userId = auth.user.sub;
    const existing = reactions.find((reaction) => reaction.post_id === postId && reaction.kind === kind && reaction.user_id === userId);
    const request = existing
      ? window.arraiSupabase.from("founder_page_reactions").delete().eq("post_id", postId).eq("kind", kind).eq("user_id", userId)
      : window.arraiSupabase.from("founder_page_reactions").insert({ post_id: postId, kind, user_id: userId });
    const { error } = await request;
    if (error) throw error;
    await loadInteractions();
    render();
  }

  function installEvents() {
    installPageEngagementEvents();
    byId("editProfileButton").addEventListener("click", openProfileEditor);
    byId("newPostButton").addEventListener("click", () => openPostEditor());
    document.querySelectorAll("[data-close-dialog]").forEach((button) =>
      button.addEventListener("click", () => button.closest("dialog").close()),
    );

    byId("founderProfileForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (auth.user?.email?.toLowerCase() !== OWNER_EMAIL) return;
      const form = event.currentTarget;
      const values = new FormData(form);
      const links = {};
      for (const [key] of linkDetails) {
        const value = String(values.get(key) || "").trim();
        if (key === "email") {
          if (value) links[key] = value;
        } else if (value) {
          const safe = safeUrl(value);
          if (!safe) return reportFormError("profileFormError", `Please use a valid http(s) URL for ${key}.`);
          links[key] = safe;
        }
      }
      const stories = String(values.get("stories") || "").split("\n").map((line) => {
        const [title, ...urlParts] = line.split("|");
        return { title: title.trim(), image_url: urlParts.join("|").trim() };
      }).filter((story) => story.title && story.image_url);
      if (stories.some((story) => !safeUrl(story.image_url))) {
        return reportFormError("profileFormError", "Each highlight needs a valid http(s) image URL.");
      }
      const nextPage = {
        ...page,
        name: String(values.get("name") || "").trim(),
        username: String(values.get("username") || "").trim().replace(/^@/, ""),
        title: String(values.get("title") || "").trim(),
        crown: String(values.get("crown") || "").trim(),
        bio: String(values.get("bio") || "").trim(),
        description: String(values.get("description") || "").trim(),
        avatar_url: String(values.get("avatar_url") || "").trim() || DEFAULT_PAGE.avatar_url,
        location: String(values.get("location") || "").trim(),
        music: {
          title: String(values.get("music_title") || "").trim(),
          artist: String(values.get("music_artist") || "").trim(),
          url: String(values.get("music_url") || "").trim(),
        },
        links,
        stories,
      };
      const avatarFile = values.get("avatar_file");
      const musicFile = values.get("music_file");
      try {
        if (avatarFile?.size) {
          nextPage.avatar_url = await uploadOwnerFile(avatarFile, "avatars", "image", 8 * 1024 * 1024);
        }
        if (musicFile?.size) {
          nextPage.music.url = await uploadOwnerFile(musicFile, "music-media", "audio", 25 * 1024 * 1024);
        }
      } catch (error) {
        return reportFormError("profileFormError", error.message || "Could not upload this file.");
      }
      if (nextPage.avatar_url && !safeUrl(nextPage.avatar_url)) return reportFormError("profileFormError", "Profile photo must be a valid http(s) URL.");
      if (nextPage.music.url && !safeUrl(nextPage.music.url)) return reportFormError("profileFormError", "Music link must be a valid http(s) URL.");
      try {
        await persistPage(nextPage);
        chooseRandomTrack();
        byId("creatorMusic").dataset.trackKey = "";
        renderProfile();
        playRandomTrack();
        byId("founderProfileDialog").close();
        showStatus("Your public page has been updated.", "success");
      } catch (error) {
        reportFormError("profileFormError", error.message || "Could not save your page.");
      }
    });

    byId("founderPostForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (auth.user?.email?.toLowerCase() !== OWNER_EMAIL) return;
      const values = new FormData(event.currentTarget);
      const imageUrl = String(values.get("image_url") || "").trim();
      const musicUrl = String(values.get("music_url") || "").trim();
      if (imageUrl && !safeUrl(imageUrl)) return reportFormError("postFormError", "Photo URL must be a valid http(s) URL.");
      if (musicUrl && !safeUrl(musicUrl)) return reportFormError("postFormError", "Music URL must be a valid http(s) URL.");
      const post = {
        id: editingPostId || crypto.randomUUID(),
        text: String(values.get("text") || "").trim(),
        image_url: imageUrl,
        location: String(values.get("location") || "").trim(),
        music_title: String(values.get("music_title") || "").trim(),
        music_url: musicUrl,
        created_at: values.get("created_at")
          ? new Date(values.get("created_at")).toISOString()
          : new Date().toISOString(),
      };
      try {
        const imageFile = values.get("image_file");
        const musicFile = values.get("music_file");
        if (imageFile?.size) {
          post.image_url = await uploadOwnerFile(imageFile, "post-media", "image", 8 * 1024 * 1024);
        }
        if (musicFile?.size) {
          post.music_url = await uploadOwnerFile(musicFile, "music-media", "audio", 25 * 1024 * 1024);
        }
        const posts = editingPostId
          ? page.posts.map((item) => item.id === editingPostId ? post : item)
          : [post, ...(page.posts || [])];
        await persistPage({ ...page, posts });
        chooseRandomTrack();
        byId("creatorMusic").dataset.trackKey = "";
        renderProfile();
        playRandomTrack();
        byId("founderPostDialog").close();
        showStatus(editingPostId ? "Your moment has been updated." : "Your new moment is now public.", "success");
      } catch (error) {
        reportFormError("postFormError", error.message || "Could not publish this moment.");
      }
    });

    byId("deletePostButton").addEventListener("click", async () => {
      if (!editingPostId || auth.user?.email?.toLowerCase() !== OWNER_EMAIL) return;
      const deletedId = editingPostId;
      try {
        await persistPage({ ...page, posts: page.posts.filter((post) => post.id !== deletedId) });
        const [{ error: commentError }, { error: reactionError }] = await Promise.all([
          window.arraiSupabase.from("founder_page_comments").delete().eq("post_id", deletedId),
          window.arraiSupabase.from("founder_page_reactions").delete().eq("post_id", deletedId),
        ]);
        if (commentError) throw commentError;
        if (reactionError) throw reactionError;
        await loadInteractions();
        render();
        byId("founderPostDialog").close();
        showStatus("Moment and its public interactions were removed.", "success");
      } catch (error) {
        showStatus(error.message || "Could not remove this moment.", "error");
      }
    });

    byId("creatorPosts").addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const { action, post } = button.dataset;
      try {
        if (action === "edit-post") {
          if (auth.user?.email?.toLowerCase() !== OWNER_EMAIL) return;
          openPostEditor(page.posts.find((item) => String(item.id) === post));
        } else if (action === "delete-comment") {
          if (auth.user?.email?.toLowerCase() !== OWNER_EMAIL) return;
          const { error } = await window.arraiSupabase.from("founder_page_comments").delete().eq("id", button.dataset.comment);
          if (error) throw error;
          await loadInteractions();
          render();
        } else if (action === "like" || action === "repost") {
          await toggleReaction(post, action);
        } else if (action === "comments") {
          const notes = byId(`comments-${post}`);
          notes.hidden = !notes.hidden;
          if (!notes.hidden) notes.nextElementSibling?.querySelector("input")?.focus();
        }
      } catch (error) {
        showStatus(error.message || "That action could not be completed.", "error");
      }
    });

    byId("creatorPosts").addEventListener("submit", async (event) => {
      if (!event.target.matches(".creator-comment-form")) return;
      event.preventDefault();
      if (!(await requireMember())) return;
      const postId = event.target.dataset.post;
      const body = String(new FormData(event.target).get("body") || "").trim();
      if (!body) return;
      const { error } = await window.arraiSupabase.from("founder_page_comments").insert({
        post_id: postId,
        author_id: auth.user.sub,
        display_name: auth.user.name || auth.user.email?.split("@")[0] || "Community member",
        body,
      });
      if (error) {
        showStatus(error.message || "Your note could not be shared.", "error");
        return;
      }
      try {
        await loadInteractions();
        render();
        byId(`comments-${postId}`).hidden = false;
        byId(`comments-${postId}`).nextElementSibling?.querySelector("input")?.focus();
      } catch (error) {
        showStatus(error.message || "The note was saved, but the conversation could not be refreshed.", "error");
      }
    });
  }

  async function initialize() {
    initializePageTheme();
    render();
    setOwnerControls();
    if (!eventsInstalled) {
      installEvents();
      eventsInstalled = true;
    }
    const authCheck = Promise.resolve(authPromise);
    try {
      const resolvedAuth = await Promise.race([
        authCheck,
        new Promise((resolve) => window.setTimeout(() => resolve(null), 2500)),
      ]);
      if (resolvedAuth) {
        auth = resolvedAuth;
      } else {
        showStatus("Checking your sign-in securely. The public page is available while that check completes.", "info");
        authCheck.then((lateAuth) => {
          if (lateAuth) auth = lateAuth;
          setOwnerControls();
          renderPosts();
        }).catch((error) => {
          console.error("Sign-in status could not be checked:", error);
          showStatus(`Sign-in status could not be checked: ${error.message}`, "error");
        });
      }
    } catch (error) {
      showStatus("Sign-in status could not be checked. Public page editing and interactions are unavailable.", "error");
    }
    try {
      const { data, error } = await window.arraiSupabase
        .from("founder_page_content")
        .select("content")
        .eq("id", PAGE_ID)
        .maybeSingle();
      if (error) throw error;
      if (!data?.content) throw new Error("The public page has not been initialized in the database.");
      page = { ...DEFAULT_PAGE, ...data.content, links: { ...DEFAULT_PAGE.links, ...data.content.links } };
      if (page.title === "A little corner of the internet") page.title = DEFAULT_PAGE.title;
      if (page.bio === "Building meaningful digital spaces and collecting little moments along the way. ✨") page.bio = DEFAULT_PAGE.bio;
      if (page.description === "Founder of ARRAI · Digital creator · Music, ideas, and everyday stories.") page.description = DEFAULT_PAGE.description;
      if (!page.links.github) page.links.github = DEFAULT_PAGE.links.github;
      page.posts = (page.posts || []).map((post) =>
        post.id === "first-chord" &&
        post.text === "Finding my own rhythm — one little idea and one chord at a time. 🎸"
          ? { ...post, text: DEFAULT_PAGE.posts[0].text }
          : post,
      );
      databaseReady = true;
    } catch (error) {
      showStatus(`Showing a preview because the public page database is not ready: ${error.message} Apply supabase-founder-page-migration.sql to enable shared edits and interactions.`, "error");
    }
    databaseChecked = true;
    setOwnerControls();
    render();
    if (databaseReady) {
      try {
        await loadInteractions();
      } catch (error) {
        showStatus(`The page loaded, but likes and notes could not refresh: ${error.message}`, "error");
      }
      render();
    }
    void loadPublicMusic().then(() => {
      chooseRandomTrack();
      renderProfile();
      playRandomTrack();
    });
    void recordVisitorSession()
      .then(loadVisitorStats)
      .catch((error) => {
        console.error("Public visitor totals could not be loaded:", error);
        showStatus(`Visitor totals are not ready yet: ${error.message} Apply the visitor analytics SQL in supabase-founder-page-migration.sql.`, "info");
      });
  }

  initialize().catch((error) => {
    showStatus(error.message || "The public profile could not be loaded.", "error");
  });
})();
