const button = document.querySelector(".menu-button"),
  nav = document.querySelector("header nav");
let deferredInstallPrompt;
const header = document.querySelector("header");
let walletMenuLink;
const currentPath = location.pathname.replace(/\/+$/, "") || "/";
const bottomNavItems = [
  { href: "/", label: "Home", icon: "⌂", paths: ["/", "/index.html"] },
  { href: "/search", label: "Search", icon: "⌕", paths: ["/search", "/search.html"] },
  { href: "/founder.html", label: "My page", icon: "✦", paths: ["/founder.html"] },
  { href: "/community", label: "Community", icon: "☷", paths: ["/community", "/community.html"] },
  { href: "/profile.html", label: "Profile", icon: "◉", paths: ["/profile", "/profile.html"] },
];
if (!document.querySelector(".site-bottom-nav")) {
  const bottomNav = document.createElement("nav");
  bottomNav.className = "site-bottom-nav";
  bottomNav.setAttribute("aria-label", "Main navigation");
  bottomNav.innerHTML = bottomNavItems.map((item) => {
    const active = item.paths.includes(currentPath);
    return `<a class="site-bottom-nav-item${active ? " active" : ""}" href="${item.href}"${active ? ' aria-current="page"' : ""}><span class="site-bottom-nav-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></a>`;
  }).join("");
  document.body.append(bottomNav);
}
const founderPublicImage = location.protocol === "file:"
  ? "assets/abhishek-rai-2026.jpeg"
  : "/assets/abhishek-rai-2026.jpeg";
const founderPhotoSource = (value) => {
  if (!value) return founderPublicImage;
  try {
    const path = new URL(value, document.baseURI).pathname;
    return /\/(?:founder|abhishek-rai(?:-public)?)\.(?:jpe?g)$/i.test(path)
      ? founderPublicImage
      : location.protocol === "file:" && path.startsWith("/assets/")
        ? `assets/${path.slice("/assets/".length)}`
        : value;
  } catch {
    return founderPublicImage;
  }
};
document.querySelectorAll('.site-bottom-nav-item[href="/founder.html"]').forEach((link) => {
  const icon = link.querySelector(".site-bottom-nav-icon");
  if (!icon || icon.tagName === "IMG") return;
  const image = document.createElement("img");
  image.className = "site-bottom-nav-avatar";
  image.src = founderPublicImage;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  icon.replaceWith(image);
});
document.querySelectorAll(".brand:not(.site-bottom-nav .brand)").forEach((brand) => {
  if (brand.querySelector(".founder-brand-avatar")) return;
  const image = document.createElement("img");
  image.className = "founder-brand-avatar";
  image.src = founderPublicImage;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  brand.prepend(image);
});
document.querySelectorAll('link[rel~="icon"]').forEach((icon) => {
  icon.href = founderPublicImage;
  icon.type = "image/jpeg";
});
const siteMoods = [
  ["English", "Some hearts feel like a quiet home.", "May your day be gentle with you.", "You are allowed to bloom slowly."],
  ["हिन्दी", "कुछ दिल, घर जैसा सुकून देते हैं।", "आज अपने साथ थोड़ा नरम रहना।", "धीरे खिलना भी खिलना ही है।"],
  ["ਪੰਜਾਬੀ", "ਕੁਝ ਦਿਲ ਘਰ ਵਰਗਾ ਸਕੂਨ ਦਿੰਦੇ ਨੇ।", "ਅੱਜ ਆਪਣੇ ਨਾਲ ਨਰਮੀ ਰੱਖੀਂ।", "ਹੌਲੀ ਖਿੜਨਾ ਵੀ ਖਿੜਨਾ ਹੀ ਹੁੰਦਾ ਹੈ।"],
  ["اردو", "کچھ دل گھر جیسا سکون دیتے ہیں۔", "آج اپنے ساتھ نرمی سے پیش آؤ۔", "آہستہ کھلنا بھی کھلنا ہی ہے۔"],
  ["العربية", "بعض القلوب تشبه البيت والطمأنينة.", "كن لطيفًا مع نفسك اليوم.", "التفتح ببطء يظل تفتحًا."],
  ["বাংলা", "কিছু হৃদয় ঘরের মতো শান্তি দেয়।", "আজ নিজের প্রতি একটু কোমল থেকো।", "ধীরে ফোটাও ফোটাই।"],
  ["தமிழ்", "சில இதயங்கள் வீடு போன்ற அமைதியைத் தரும்.", "இன்று உன்னிடம் மென்மையாக இரு.", "மெதுவாக மலர்வதும் மலர்வதே."],
  ["తెలుగు", "కొన్ని మనసులు ఇంటిలా హాయినిస్తాయి.", "ఈ రోజు నీతో నువ్వు మృదువుగా ఉండు.", "నెమ్మదిగా వికసించినా వికసించినట్టే."],
  ["मराठी", "काही मने घरासारखी शांतता देतात.", "आज स्वतःशी थोडे प्रेमाने वाग.", "हळू उमलणेही उमलणेच असते."],
  ["ગુજરાતી", "કેટલાક દિલ ઘર જેવી શાંતિ આપે છે.", "આજે પોતાની સાથે નરમ રહેજો.", "ધીમે ખીલવું પણ ખીલવું જ છે."],
  ["ಕನ್ನಡ", "ಕೆಲವು ಹೃದಯಗಳು ಮನೆಯ ನೆಮ್ಮದಿಯಂತಿವೆ.", "ಇಂದು ನಿನ್ನೊಂದಿಗೆ ಮೃದುವಾಗಿರು.", "ನಿಧಾನವಾಗಿ ಅರಳುವುದೂ ಅರಳುವುದೇ."],
  ["മലയാളം", "ചില ഹൃദയങ്ങൾ വീടുപോലെ ആശ്വാസം നൽകും.", "ഇന്ന് നിന്നോട് തന്നെ കരുണയോടെ ഇരിക്കൂ.", "പതുക്കെ വിരിയുന്നതും വിരിയലാണ്."],
  ["Français", "Certains cœurs ressemblent à un chez-soi.", "Sois doux avec toi-même aujourd’hui.", "Fleurir lentement, c’est fleurir aussi."],
  ["Español", "Hay corazones que se sienten como hogar.", "Trátate con ternura hoy.", "Florecer despacio también es florecer."],
  ["Deutsch", "Manche Herzen fühlen sich wie Zuhause an.", "Sei heute freundlich zu dir selbst.", "Langsam zu blühen heißt trotzdem zu blühen."],
  ["日本語", "心が帰る場所のような人がいる。", "今日は自分にもやさしくしてね。", "ゆっくり咲くのも、咲くこと。"],
  ["فارسی", "بعضی دل‌ها شبیه خانه و آرامش‌اند.", "امروز با خودت مهربان باش.", "آهسته شکفتن هم شکفتن است."],
];
const addSiteMood = () => {
  const header = document.querySelector("header");
  if (!header || document.querySelector(".site-mood")) return;
  const banner = document.createElement("aside");
  banner.className = "site-mood";
  banner.setAttribute("aria-label", "A little note for today");
  banner.innerHTML = '<span class="site-mood-sparkle" aria-hidden="true">✦</span><span class="site-mood-quote" aria-live="polite"></span><div class="site-mood-checkin"><span>How’s your heart today?</span><button type="button">Lovely ✨</button><button type="button">Dreamy ☁️</button><button type="button">Need softness 🌙</button></div>';
  header.after(banner);
  const quote = banner.querySelector(".site-mood-quote");
  let previous = -1;
  const showNextMood = () => {
    let index = Math.floor(Math.random() * siteMoods.length);
    if (siteMoods.length > 1 && index === previous) index = (index + 1) % siteMoods.length;
    previous = index;
    const [language, ...lines] = siteMoods[index];
    quote.lang = ({ English: "en", हिन्दी: "hi", ਪੰਜਾਬੀ: "pa", اردو: "ur", العربية: "ar", বাংলা: "bn", தமிழ்: "ta", తెలుగు: "te", मराठी: "mr", ગુજરાતી: "gu", ಕನ್ನಡ: "kn", മലയാളം: "ml", Français: "fr", Español: "es", Deutsch: "de", 日本語: "ja", فارسی: "fa" })[language] || "en";
    quote.dir = ["اردو", "العربية", "فارسی"].includes(language) ? "rtl" : "auto";
    quote.textContent = `${lines[Math.floor(Math.random() * lines.length)]}  ·  ${language}`;
  };
  showNextMood();
  window.setInterval(showNextMood, 12_000);
  const checkin = banner.querySelector(".site-mood-checkin");
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const checkinKey = `arrai-checkin-${localDate}`;
  try {
    if (localStorage.getItem(checkinKey)) checkin.hidden = true;
  } catch (error) {
    console.warn("Daily check-in preference could not be restored:", error);
  }
  checkin.addEventListener("click", (event) => {
    const choice = event.target.closest("button");
    if (!choice) return;
    try {
      localStorage.setItem(checkinKey, "done");
    } catch (error) {
      console.warn("Daily check-in preference could not be saved:", error);
    }
    checkin.innerHTML = "<span>Thanks for checking in · take it softly ✨</span>";
  });
};
addSiteMood();
if (button && nav && header) {
  button.type = "button";
  button.textContent = "⋮";
  button.setAttribute("aria-label", "Open site menu");
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-controls", "siteMenu");
  nav.id = "siteMenu";
  nav.setAttribute("aria-label", "Site menu");
  const tools = document.createElement("div");
  tools.className = "header-menu-tools";
  walletMenuLink = document.createElement("a");
  walletMenuLink.className = "wallet-balance-link";
  walletMenuLink.href = "https://pay.arrai.in/";
  walletMenuLink.textContent = "Wallet · Open Pay";
  walletMenuLink.setAttribute("aria-label", "Open ARRAI Pay wallet");
  button.replaceWith(tools);
  tools.append(walletMenuLink, button);
}
const themePicker = document.querySelector(".site-theme-picker");
if (themePicker && !themePicker.isConnected) {
  (document.querySelector("header .header-menu-tools") || document.querySelector("header"))
    ?.append(themePicker);
}

const siteThemeOptions = [
  ["midnight", "Midnight"],
  ["warm", "Warm"],
  ["sakura", "Sakura"],
  ["rose", "Rose"],
  ["ocean", "Ocean"],
  ["royal", "Royal"],
  ["emerald", "Emerald"],
  ["ruby", "Ruby"],
  ["gold", "Gold"],
  ["nebula", "Nebula"],
  ["lava", "Lava"],
  ["cyber", "Cyber"],
  ["retro", "Retro"],
];
const siteThemeStorageKey = "arrai-site-theme";
window.arraiThemeOptions = siteThemeOptions.map(([value]) => value);
window.arraiApplyTheme = (theme) => {
  if (!window.arraiThemeOptions.includes(theme)) return false;
  document.body.dataset.theme = theme;
  document.body.dataset.userTheme = theme;
  return true;
};
window.arraiCanUseTheme = async (theme) => {
  if (!window.arraiThemeOptions.includes(theme)) return false;
  if (["midnight", "warm"].includes(theme)) return true;
  let auth;
  try {
    auth = await window.arraiAuth;
  } catch {
    return false;
  }
  if (!auth?.isAuthenticated) return false;
  if (auth.user?.email?.toLowerCase() === "abhishekrai6897@gmail.com") return true;
  if (!window.arraiSupabase) return false;
  const { data: profile, error } = await window.arraiSupabase
    .from("profiles")
    .select("is_vip,vip_expires_at")
    .eq("id", auth.user.sub)
    .maybeSingle();
  if (error) {
    console.error("Could not verify personal theme eligibility:", error);
    return false;
  }
  return Boolean(profile?.is_vip &&
    (!profile.vip_expires_at || Date.parse(profile.vip_expires_at) > Date.now()));
};
try {
  const savedTheme = localStorage.getItem(siteThemeStorageKey);
  if (savedTheme && window.arraiApplyTheme(savedTheme)) {
    document.documentElement.dataset.savedTheme = savedTheme;
  }
} catch (error) {
  console.warn("Saved theme preference is unavailable:", error);
}

if (header && !document.querySelector("#siteThemePicker")) {
  const themeLabel = document.createElement("label");
  themeLabel.className = "site-theme-picker";
  themeLabel.htmlFor = "siteThemePicker";
  themeLabel.title = "Change the website colours";
  themeLabel.innerHTML = `<span aria-hidden="true">◐</span><span class="site-theme-label">Theme</span>`;
  const themePicker = document.createElement("select");
  themePicker.id = "siteThemePicker";
  themePicker.setAttribute("aria-label", "Choose website theme");
  themePicker.innerHTML = siteThemeOptions
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
  const currentTheme = document.body.dataset.userTheme ||
    document.body.dataset.theme ||
    document.body.dataset.globalTheme ||
    "midnight";
  themePicker.value = window.arraiThemeOptions.includes(currentTheme)
    ? currentTheme
    : "midnight";
  themePicker.addEventListener("change", async () => {
    const selectedTheme = themePicker.value;
    if (!siteThemeOptions.some(([value]) => value === selectedTheme)) return;
    if (!(await window.arraiCanUseTheme(selectedTheme))) {
      themePicker.value = document.body.dataset.userTheme || "midnight";
      const auth = await window.arraiAuth;
      window.cuteNotice(
        auth?.isAuthenticated
          ? "Personal colour themes are available to ARRAI VIP members."
          : "Sign in to choose a personal colour theme.",
        "warning",
      );
      return;
    }
    try {
      localStorage.setItem(siteThemeStorageKey, selectedTheme);
      window.arraiApplyTheme(selectedTheme);
      if (selectedTheme === "midnight") delete document.documentElement.dataset.savedTheme;
      else document.documentElement.dataset.savedTheme = selectedTheme;
      const profileTheme = document.querySelector("#themeSelect");
      if (profileTheme && [...profileTheme.options].some((option) => option.value === selectedTheme)) {
        profileTheme.value = selectedTheme;
      }
      window.cuteNotice(`${themePicker.selectedOptions[0].textContent} theme applied across the site.`, "success");
    } catch (error) {
      window.cuteNotice(`Your theme could not be saved: ${error.message}`, "error");
    }
  });
  themeLabel.append(themePicker);
  (document.querySelector(".header-menu-tools") || header).append(themeLabel);
}

const natureNotes = [
  "🌱 A small beginning still counts as a beginning.",
  "🌙 You do not need to bloom on anyone else’s schedule.",
  "🌿 Take one slow breath. You are allowed to grow gently.",
  "✨ Even the quietest night leaves room for a little light.",
  "🌼 Rest is part of becoming, too.",
];
try {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem("arrai-nature-note-day") !== today) {
    window.setTimeout(() => {
      if (typeof window.cuteNotice !== "function") return;
      const note = natureNotes[Math.floor(Math.random() * natureNotes.length)];
      window.cuteNotice(note, "success");
      try {
        localStorage.setItem("arrai-nature-note-day", today);
      } catch (error) {
        console.warn("The daily nature note could not be remembered:", error);
      }
    }, 2200);
  }
} catch (error) {
  console.warn("Daily nature-note preference is unavailable:", error);
}

// The shared stage manager for every page: navigation, themes, notices and
// Miss Makima meet here so the site feels like one connected little world.
// Friendly, app-style confirmations used across the site.
window.cuteConfirm = (
  message,
  { title = "Are you sure?", danger = false } = {},
) =>
  new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "cute-dialog-backdrop";
    overlay.innerHTML = `<section class="cute-dialog ${danger ? "is-danger" : ""}" role="dialog" aria-modal="true" aria-label="${title}">
    <div class="cute-dialog-sparkle">✦</div><h3>${title}</h3><p>${message}</p>
    <div class="cute-dialog-actions"><button type="button" class="button cute-cancel">No, go back</button><button type="button" class="button primary cute-ok">Yes, continue</button></div>
  </section>`;
    document.body.append(overlay);
    const close = (value) => {
      overlay.classList.add("is-closing");
      setTimeout(() => overlay.remove(), 180);
      resolve(value);
    };
    overlay
      .querySelector(".cute-cancel")
      .addEventListener("click", () => close(false));
    overlay
      .querySelector(".cute-ok")
      .addEventListener("click", () => close(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(false);
    });
    overlay.querySelector(".cute-ok").focus();
  });
window.cuteNotice = (message, type = "success") => {
  const notice = document.createElement("div");
  notice.className = `cute-notice ${type}`;
  notice.textContent = message;
  document.body.append(notice);
  requestAnimationFrame(() => notice.classList.add("show"));
  setTimeout(() => {
    notice.classList.remove("show");
    setTimeout(() => notice.remove(), 220);
  }, 3200);
};
if (!document.querySelector('link[rel="icon"]')) {
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.type = "image/svg+xml";
  icon.href = "/assets/app-icon.svg";
  document.head.append(icon);
}
if (!document.querySelector('link[rel="manifest"]')) {
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "/manifest.webmanifest";
  document.head.append(manifest);
}
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document
    .querySelectorAll("[data-install-app]")
    .forEach((item) => (item.hidden = false));
});
const installApp = async () => {
  if (!deferredInstallPrompt)
    return cuteNotice(
      "Browser menu se ‘Add to Home screen’ choose karein.",
      "warning",
    );
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
};
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => console.error("The ARRAI offline cache could not be updated:", error)),
  );
if (nav && !nav.querySelector("[data-install-app]")) {
  const install = document.createElement("button");
  install.type = "button";
  install.dataset.installApp = "true";
  install.className = "nav-install";
  install.textContent = "Install app";
  install.hidden = true;
  install.addEventListener("click", installApp);
  nav.append(install);
}
if (nav && !nav.querySelector('[href="chess.html"]')) {
  const chessLink = document.createElement("a");
  chessLink.href = "chess.html";
  chessLink.textContent = "Chess";
  const contact = nav.querySelector('[href="contact.html"]');
  nav.insertBefore(chessLink, contact);
}
if (nav && !nav.querySelector('[href="community.html"]')) {
  const communityLink = document.createElement("a");
  communityLink.href = "community.html";
  communityLink.textContent = "Community";
  const authLink = nav.querySelector('[href="auth.html"]');
  nav.insertBefore(communityLink, authLink || null);
}
if (nav && !nav.querySelector('[href="dm.html"]')) {
  const dmLink = document.createElement("a");
  dmLink.href = "/dm";
  dmLink.textContent = "DM";
  const communityLink = nav.querySelector('[href="community.html"]');
  communityLink?.after(dmLink);
}
if (
  nav &&
  !nav.querySelector('[href="https://pay.arrai.in/"]')
) {
  const paymentsLink = document.createElement("a");
  paymentsLink.href = "https://pay.arrai.in/";
  paymentsLink.textContent = "ARRAI Pay";
  const authLink = nav.querySelector('[href="auth.html"]');
  nav.insertBefore(paymentsLink, authLink || null);
}
if (nav && !nav.querySelector('[href="music.html"]')) {
  const musicLink = document.createElement("a");
  musicLink.href = "music.html";
  musicLink.textContent = "Music";
  const homeLink = nav.querySelector('[href="index.html"]');
  homeLink?.after(musicLink);
}
if (nav && !nav.querySelector('[href="detective.html"]')) {
  const detectiveLink = document.createElement("a");
  detectiveLink.href = "detective.html";
  detectiveLink.textContent = "Detective Agency";
  const servicesLink = nav.querySelector('[href="services.html"]');
  servicesLink?.before(detectiveLink);
}
if (nav && !nav.querySelector('[href="detective-members.html"]')) {
  const detectiveMembersLink = document.createElement("a");
  detectiveMembersLink.href = "detective-members.html";
  detectiveMembersLink.textContent = "Detective Members";
  const detectiveLink = nav.querySelector('[href="detective.html"]');
  detectiveLink?.after(detectiveMembersLink);
}
if (nav && !nav.querySelector('[href="calendar.html"]')) {
  const calendarLink = document.createElement("a");
  calendarLink.href = "calendar.html";
  calendarLink.textContent = "Calendar";
  const contactLink = nav.querySelector('[href="contact.html"]');
  contactLink?.before(calendarLink);
}
const ensureMenuLink = (href, label, className = "") => {
  if (!nav) return null;
  let link = nav.querySelector(`a[href="${href}"]`);
  if (!link) {
    link = document.createElement("a");
    link.href = href;
    nav.append(link);
  }
  if (className) link.classList.add(className);
  link.textContent = label;
  return link;
};
const normalizeSiteMenu = (isAuthenticated = false) => {
  if (!nav) return;
  const primary = [
    ensureMenuLink("index.html", "Home", "site-menu-primary"),
    ensureMenuLink("https://pay.arrai.in/", "ARRAI Pay", "site-menu-primary"),
    ensureMenuLink("search.html", "Search", "site-menu-primary"),
    ensureMenuLink("community.html", "Community", "site-menu-primary"),
    ensureMenuLink("/membership", "VIP Membership · ₹45", "site-menu-primary"),
  ];
  const familyLink = ensureMenuLink(
    "family.html",
    "ARRAI Family",
    "site-menu-primary",
  );
  let profileLink = nav.querySelector(
    ".site-menu-primary[href='profile.html'], .site-menu-primary[href='auth.html']",
  );
  if (!profileLink) {
    profileLink = document.createElement("a");
    profileLink.className = "site-menu-primary";
  }
  profileLink.href = isAuthenticated ? "profile.html" : "auth.html";
  profileLink.textContent = isAuthenticated ? "My profile" : "Profile · Sign in";
  if (isAuthenticated) nav.querySelector('a[href="auth.html"]')?.remove();
  const ordered = [
    ...primary,
    familyLink,
    profileLink,
    ...[...nav.children].filter(
      (item) =>
        !primary.includes(item) && item !== familyLink && item !== profileLink,
    ),
  ];
  ordered.forEach((item) => item && nav.append(item));
};
normalizeSiteMenu(false);
const ownerEmail = "abhishekrai6897@gmail.com";
const avatarFallback = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "AR")}&background=38bdf8&color=0f172a&bold=true`;
const makeAccountLink = (user, profile = {}) => {
  const account = document.createElement("a");
  const name =
    profile.display_name ||
    user?.name ||
    user?.email?.split("@")[0] ||
    "My profile";
  account.href = "profile.html";
  account.className = "nav-account";
  account.setAttribute("aria-label", `Open ${name}'s profile`);
  const image = document.createElement("img");
  image.src = profile.avatar_url || user?.avatarUrl || avatarFallback(name);
  image.alt = "";
  image.addEventListener(
    "error",
    () => {
      image.src = avatarFallback(name);
    },
    { once: true },
  );
  const label = document.createElement("span");
  label.textContent = name;
  account.append(image, label);
  return account;
};
const loadNavigationProfile = async (user) => {
  if (!window.arraiSupabase || !user?.id) return {};
  const { data } = await window.arraiSupabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  return data || {};
};
const updateProfileBottomNav = (user, profile = {}) => {
  const link = document.querySelector('.site-bottom-nav-item[href="/profile.html"]');
  if (!link) return;
  const label = link.querySelector("span:last-child");
  const icon = link.querySelector(".site-bottom-nav-icon");
  const authenticated = Boolean(user);
  const avatarUrl = profile.avatar_url || user?.avatarUrl ||
    (user?.email?.toLowerCase() === ownerEmail ? founderPublicImage : "/assets/app-icon.svg");
  link.href = authenticated ? "/profile.html" : "/auth.html";
  const name = profile.display_name || user?.name || "my";
  link.setAttribute("aria-label", authenticated ? `Open ${name}'s profile` : "Sign in to profile");
  if (label) label.textContent = "Profile";
  if (icon && icon.tagName !== "IMG") {
    const image = document.createElement("img");
    image.className = "site-bottom-nav-avatar";
    image.alt = "";
    image.src = avatarUrl;
    icon.replaceWith(image);
  } else if (icon) {
    icon.src = avatarUrl;
  }
};
const updateNavigationForUser = async ({ isAuthenticated, user }) => {
  updateProfileBottomNav(isAuthenticated ? user : null);
  if (!nav) return;
  const loginLink = nav.querySelector('[href="auth.html"]');
  if (isAuthenticated) {
    loginLink?.remove();
    nav.querySelector(".nav-account")?.remove();
    nav.querySelector(".nav-logout")?.remove();
    if (!nav.querySelector('[href="community.html"]')) {
      const spaceLink = document.createElement("a");
      spaceLink.href = "community.html";
      spaceLink.textContent = "My space";
      nav.append(spaceLink);
    }
    if (
      user?.email?.toLowerCase() === ownerEmail &&
      !nav.querySelector('[href="owner.html"]')
    ) {
      const ownerLink = document.createElement("a");
      ownerLink.href = "owner.html";
      ownerLink.textContent = "Owner studio";
      nav.append(ownerLink);
    }
    if (user?.email?.toLowerCase() === ownerEmail) {
      ensureMenuLink("admin.html", "Admin console", "site-menu-admin");
    } else {
      nav.querySelector('[href="admin.html"]')?.remove();
      nav.querySelector('[href="owner.html"]')?.remove();
    }
    if (!nav.querySelector(".nav-logout")) {
      const logout = document.createElement("button");
      logout.type = "button";
      logout.className = "nav-logout";
      logout.textContent = "Logout";
      logout.addEventListener("click", () => window.logout?.());
      nav.append(logout);
    }
    loadNavigationProfile(user)
      .catch((error) => {
        console.warn("Profile avatar could not be loaded for navigation:", error);
        return {};
      })
      .then((profile) => {
        updateProfileBottomNav(user, profile);
        nav.querySelector(".nav-account")?.remove();
        const logout = nav.querySelector(".nav-logout");
        nav.insertBefore(makeAccountLink(user, profile), logout || null);
      });
    const profileLink = nav.querySelector(".site-menu-primary[href='profile.html']");
    if (profileLink) profileLink.textContent = "My profile";
    if (walletMenuLink) {
      walletMenuLink.textContent = "Wallet · Loading…";
      walletMenuLink.title = "Loading your ARRAI Pay wallet balance";
      window.arraiSupabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (error) throw error;
          const token = data.session?.access_token;
          if (!token) throw new Error("Sign in again to view your wallet.");
          return fetch("/api/wallet-balance", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
        })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error || "Wallet balance unavailable.");
          const amount = (result.balance_paise / 100).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          walletMenuLink.textContent = result.wallet_exists
            ? `₹${amount} · Wallet`
            : "Wallet · Set up";
          walletMenuLink.title = result.wallet_exists
            ? `Live balance from your ARRAI Pay wallet: ₹${amount}`
            : "No ARRAI Pay wallet is set up for this account yet";
          walletMenuLink.setAttribute(
            "aria-label",
            result.wallet_exists
              ? `ARRAI Pay wallet balance ₹${amount}`
              : "Set up your ARRAI Pay wallet",
          );
        })
        .catch((error) => {
          walletMenuLink.textContent = "Wallet · Open Pay";
          walletMenuLink.title = `Wallet balance unavailable: ${error.message}`;
          walletMenuLink.setAttribute("aria-label", "Open ARRAI Pay wallet");
        });
    }
    const welcomeKey = `arrai-welcome-${user?.id || user?.email}`;
    if (!sessionStorage.getItem(welcomeKey) && !document.body.classList.contains("auth-page")) {
      sessionStorage.setItem(welcomeKey, "1");
      const profile = await loadNavigationProfile(user).catch(() => ({}));
      window.cuteNotice(
        `Welcome back, ${profile.display_name || user?.name || "friend"}. Your AR space is ready.`,
      );
    }
  } else if (!document.body.classList.contains("auth-page")) {
    nav.querySelector(".nav-account")?.remove();
    nav.querySelector(".nav-logout")?.remove();
    nav.querySelector('[href="profile.html"]')?.setAttribute("href", "auth.html");
    walletMenuLink?.replaceChildren(document.createTextNode("Wallet · Open Pay"));
    walletMenuLink?.setAttribute("aria-label", "Open ARRAI Pay wallet");
    if (walletMenuLink)
      walletMenuLink.title = "Sign in to view your ARRAI Pay wallet balance";
    nav.querySelector('[href="owner.html"]')?.remove();
    nav.querySelector('[href="admin.html"]')?.remove();
  }
  normalizeSiteMenu(Boolean(isAuthenticated));
};
if (window.arraiAuth)
  window.arraiAuth
    .then(updateNavigationForUser)
    .catch(() => updateNavigationForUser({ isAuthenticated: false }));
else updateNavigationForUser({ isAuthenticated: false });
window.arraiSupabase?.auth.onAuthStateChange((_event, session) => {
  const source = session?.user;
  updateNavigationForUser({
    isAuthenticated: Boolean(source),
    user: source ? {
      id: source.id,
      email: source.email,
      name: source.user_metadata?.full_name || source.user_metadata?.name || source.email?.split("@")[0],
      avatarUrl: source.user_metadata?.avatar_url || source.user_metadata?.picture || "",
    } : null,
  });
});

const communityPreview = document.querySelector("#communityPreview");
if (communityPreview && window.arraiAuth) {
  window.arraiAuth
    .then(async ({ isAuthenticated, user }) => {
      if (!isAuthenticated) return;
      const { data } = await window.arraiSupabase
        .from("posts")
        .select(
          "body, image_url, created_at, author_id, profiles!posts_author_id_fkey(display_name, username, privacy)",
        )
        .order("created_at", { ascending: false })
        .limit(12);
      const post = data?.find(
        (item) =>
          item.author_id === user.id || item.profiles?.privacy !== "private",
      );
      if (!post) return;
      const safe = (value) => {
        const element = document.createElement("div");
        element.textContent = value || "";
        return element.innerHTML;
      };
      document.querySelector("#communityPreviewPost").innerHTML =
        `<p class="eyebrow">@${safe(post.profiles?.username || "member")} · ${new Date(post.created_at).toLocaleDateString()}</p><h3>${safe(post.profiles?.display_name || "AR member")}</h3><p>${safe(post.body)}</p>${post.image_url ? `<img class="post-image" src="${safe(post.image_url)}" alt="Community post" />` : ""}`;
      communityPreview.hidden = false;
    })
    .catch(() => {});
}
// Public home feed: visitors can read public updates; publishing remains login-only.
if (communityPreview && window.arraiSupabase)
  window.arraiSupabase
    .from("posts")
    .select(
      "body, image_url, created_at, profiles!posts_author_id_fkey(display_name, username, privacy)",
    )
    .eq("profiles.privacy", "public")
    .order("created_at", { ascending: false })
    .limit(8)
    .then(({ data: posts }) => {
      if (!posts?.length) return;
      const safe = (value) => {
        const e = document.createElement("div");
        e.textContent = value || "";
        return e.innerHTML;
      };
      document.querySelector("#communityPreviewPost").innerHTML = posts
        .map(
          (post) =>
            `<article class="home-update"><p class="eyebrow">@${safe(post.profiles?.username || "member")} · ${new Date(post.created_at).toLocaleDateString()}</p><h3>${safe(post.profiles?.display_name || "AR member")}</h3><p>${safe(post.body)}</p>${post.image_url ? `<img class="post-image" src="${safe(post.image_url)}" alt="Community update" />` : ""}</article>`,
        )
        .join("");
      communityPreview.hidden = false;
    })
    .catch(() => {});
if (button && nav)
  button.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", open);
    button.setAttribute("aria-label", open ? "Close site menu" : "Open site menu");
    button.textContent = open ? "×" : "⋮";
  });
if (nav)
  nav.addEventListener("click", (event) => {
    if (!event.target.closest("a")) return;
    nav.classList.remove("open");
    button?.setAttribute("aria-expanded", "false");
    button?.setAttribute("aria-label", "Open navigation");
    if (button) button.textContent = "⋮";
  });
document.addEventListener("click", (event) => {
  if (
    !nav?.classList.contains("open") ||
    event.target.closest("header")
  )
    return;
  nav.classList.remove("open");
  button?.setAttribute("aria-expanded", "false");
  button?.setAttribute("aria-label", "Open navigation");
  if (button) button.textContent = "⋮";
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !nav?.classList.contains("open")) return;
  nav.classList.remove("open");
  button?.setAttribute("aria-expanded", "false");
  button?.setAttribute("aria-label", "Open navigation");
  if (button) button.textContent = "⋮";
  button?.focus();
});

const localAssistantReply = (question) => {
  const q = question.toLowerCase();
  if (q.includes("contact") || q.includes("email") || q.includes("hire"))
    return "Of course ♡ You can reach Abhishek at abhishekrai@arrai.in, or use the Contact page and I’ll help you find the right place.";
  if (q.includes("service") || q.includes("work") || q.includes("website"))
    return "AR gently brings together web design, visual direction and practical digital strategy. The Services page has the lovely details. ✿";
  if (q.includes("founder") || q.includes("abhishek") || q.includes("ceo"))
    return "Abhishek Rai is AR’s Founder & CEO, connected with RaiGenZ Foundation and AR Tech Solutions. He is building thoughtful digital work with care. ✦";
  if (q.includes("project") || q.includes("portfolio"))
    return "The Projects page is the best place to see what is in motion. If you have an idea of your own, I can also guide you to Abhishek’s contact page. ♡";
  return "I’m Miss Makima, your gentle AR guide. I can help with AR, Abhishek Rai, services, projects, chess or contacting the team. For live web-researched replies, add the optional AI keys in AI_SETUP.md. ✿";
};

// Owner-selected theme is the default across every page. VIP members may override it locally.
const applyGlobalTheme = async () => {
  if (!window.arraiSupabase) return "midnight";
  const { data } = await window.arraiSupabase
    .from("site_settings")
    .select("*")
    .eq("id", "global")
    .maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  const specialActive =
    data?.special_day_enabled &&
    data.special_day_start &&
    data.special_day_end &&
    today >= data.special_day_start &&
    today <= data.special_day_end;
  const theme = specialActive
    ? data.special_day_theme || "sakura"
    : data?.global_theme || "midnight";
  document.body.dataset.globalTheme = theme;
  const savedTheme = localStorage.getItem(siteThemeStorageKey);
  if (savedTheme && window.arraiApplyTheme(savedTheme)) {
    document.documentElement.dataset.savedTheme = savedTheme;
  } else if (!document.body.dataset.userTheme) {
    document.body.dataset.theme = theme;
  }
  if (specialActive && !document.querySelector(".special-day-banner")) {
    const banner = document.createElement("aside");
    banner.className = "special-day-banner";
    const safe = (value) => {
      const element = document.createElement("div");
      element.textContent = value || "";
      return element.innerHTML;
    };
    banner.innerHTML = `<span class="special-day-spark">♡</span><div><strong>${safe(data.special_day_title || `A special day for ${data.special_day_name || "someone wonderful"}`)}</strong><p>${safe(data.special_day_message || "Today the whole AR corner is glowing a little more softly.")}</p></div>`;
    document.body.prepend(banner);
    document.body.classList.add("special-day-active");
  }
  return theme;
};
applyGlobalTheme().catch(() => {});

const locationStorageKey = "arrai-approximate-city";
window.arraiGetApproximateLocation = async () => {
  if (!navigator.geolocation) {
    throw new Error("This browser does not support location sharing.");
  }
  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 300000,
    });
  });
  const latitude = Math.round(position.coords.latitude * 100) / 100;
  const longitude = Math.round(position.coords.longitude * 100) / 100;
  const query = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "10",
    addressdetails: "1",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${query}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error("Approximate city lookup is unavailable.");
  const result = await response.json();
  const address = result.address || {};
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county;
  if (!city || !address.country) {
    throw new Error("We couldn’t identify a city from this location.");
  }
  const location = {
    city,
    state: address.state || address.region || "",
    country: address.country,
  };
  location.label = [location.city, location.state, location.country]
    .filter(Boolean)
    .join(", ");
  localStorage.setItem(locationStorageKey, JSON.stringify(location));
  return location;
};

const mountHomeLocalInfo = () => {
  const time = document.querySelector("#homeDateTime");
  const location = document.querySelector("#homeLocation");
  const button = document.querySelector("#requestHomeLocation");
  const map = document.querySelector("#homeLocationMap");
  if (!time && !location && !button) return;
  const updateTime = () => {
    if (time)
      time.textContent = `🕒 ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date())} (your local time)`;
  };
  updateTime();
  setInterval(updateTime, 30000);
  try {
    const saved = JSON.parse(localStorage.getItem(locationStorageKey) || "null");
    if (saved?.city && saved?.country) {
      location.textContent = `📍 ${saved.label}`;
      map.href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(saved.label)}`;
      map.hidden = false;
      button.textContent = "Refresh city";
    }
  } catch {
    localStorage.removeItem(locationStorageKey);
  }
  button?.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Finding your city…";
    try {
      const result = await window.arraiGetApproximateLocation();
      location.textContent = `📍 ${result.label}`;
      map.href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(result.label)}`;
      map.hidden = false;
      button.textContent = "Refresh city";
      window.cuteNotice("City updated. Your exact coordinates stay off the profile.");
    } catch (error) {
      button.textContent = "Set approximate city";
      window.cuteNotice(error.message || "Could not find your city.", "warning");
    } finally {
      button.disabled = false;
    }
  });
};
mountHomeLocalInfo();

const loadFeaturedVipMembers = async () => {
  const section = document.querySelector("#featuredVip");
  const list = document.querySelector("#featuredVipMembers");
  if (!section || !list || !window.arraiSupabase) return;
  const { data, error } = await window.arraiSupabase.rpc(
    "arrai_featured_vip_members",
  );
  if (error) {
    console.error("Could not load featured VIP members:", error.message);
    return;
  }
  if (!data?.length) return;
  list.replaceChildren();
  data.forEach((member) => {
    const item = document.createElement("a");
    item.className = "featured-vip-member";
    item.href = `/${encodeURIComponent(member.username)}`;
    const image = document.createElement("img");
    image.src = member.avatar_url || avatarFallback(member.display_name);
    image.alt = "";
    const name = document.createElement("span");
    name.textContent = member.display_name;
    item.append(image, name, document.createTextNode("✦"));
    list.append(item);
  });
  section.hidden = false;
};
loadFeaturedVipMembers();
let membershipHomePrompt = document.querySelector("#membershipHomePrompt");
const familyPromptExcludedPages = ["family-page", "admin-page", "auth-page", "owner-page"];
if (
  !membershipHomePrompt &&
  !familyPromptExcludedPages.some((page) => document.body.classList.contains(page))
) {
  membershipHomePrompt = document.createElement("aside");
  membershipHomePrompt.id = "membershipHomePrompt";
  membershipHomePrompt.className = "membership-home-prompt";
  membershipHomePrompt.setAttribute("aria-label", "ARRAI Family suggestion");
  membershipHomePrompt.innerHTML = `<span class="membership-spark" aria-hidden="true">✦</span><p><b>ARRAI Family</b>Support the community or explore optional ₹45/year VIP.</p><span class="family-prompt-actions"><a href="family.html">Visit family</a><a href="auth.html?next=membership">Explore VIP</a></span><button type="button" aria-label="Dismiss ARRAI Family suggestion">×</button>`;
  document.body.append(membershipHomePrompt);
}
if (membershipHomePrompt) {
  const membershipPromptKey = "arrai-family-prompt-last-shown";
  const dismissMembershipPrompt =
    membershipHomePrompt.querySelector("#dismissMembershipPrompt") ||
    membershipHomePrompt.querySelector("button");
  let lastShownAt = 0;
  try {
    lastShownAt = Number(localStorage.getItem(membershipPromptKey) || 0);
  } catch (error) {
    console.warn("ARRAI Family suggestion storage is unavailable:", error.message);
  }
  const isOnCooldown = Date.now() - lastShownAt < 5 * 24 * 60 * 60 * 1000;
  dismissMembershipPrompt?.addEventListener("click", () => {
    membershipHomePrompt.hidden = true;
    try {
      localStorage.setItem(membershipPromptKey, String(Date.now()));
    } catch (error) {
      console.warn("ARRAI Family suggestion preference could not be saved:", error.message);
    }
  });
  if (!isOnCooldown) {
    window.setTimeout(() => {
      membershipHomePrompt.hidden = false;
      try {
        localStorage.setItem(membershipPromptKey, String(Date.now()));
      } catch (error) {
        console.warn("ARRAI Family suggestion timing could not be saved:", error.message);
      }
    }, 12000 + Math.random() * 12000);
  }
}

// Public home content is editable from Owner Studio and remains readable without login.
const loadPublicHomeContent = async () => {
  if (!document.querySelector("#founderCards") || !window.arraiSupabase) return;
  const safe = (value) => {
    const el = document.createElement("div");
    el.textContent = value || "";
    return el.innerHTML;
  };
  const [{ data: settings }, { data: cards }] = await Promise.all([
    window.arraiSupabase
      .from("site_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle(),
    window.arraiSupabase
      .from("founder_cards")
      .select("*")
      .order("order_index", { ascending: true }),
  ]);
  if (settings) {
    if (settings.founder_profile_id) {
      const { data: founderProfile } = await window.arraiSupabase
        .from("profiles")
        .select("avatar_url,display_name,username")
        .eq("id", settings.founder_profile_id)
        .maybeSingle();
      if (founderProfile) {
        if (founderProfile.avatar_url)
          settings.hero_image_url = founderProfile.avatar_url;
        if (!settings.founder_name)
          settings.founder_name = founderProfile.display_name;
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const specialActive =
      settings.special_day_enabled &&
      settings.special_day_start &&
      settings.special_day_end &&
      today >= settings.special_day_start &&
      today <= settings.special_day_end;
    document.body.dataset.theme = specialActive
      ? settings.special_day_theme || "sakura"
      : settings.global_theme || "midnight";
    if (specialActive) {
      const specialText = (selector, value) => {
        const element = document.querySelector(selector);
        if (element && value) element.textContent = value;
      };
      const specialImage = document.querySelector("#heroFounderPic");
      if (specialImage && settings.special_day_image_url) {
        specialImage.src = settings.special_day_image_url;
        specialImage.alt = settings.special_day_name || "Someone special";
      }
      specialText("#founder-title span", settings.special_day_name);
      specialText(".founder-role", settings.special_day_role);
      specialText(".founder-note", settings.special_day_message);
      specialText(".intro h2", settings.special_day_intro_title);
      specialText(".intro > div > p", settings.special_day_intro_text);
      specialText(".cta h2", settings.special_day_cta_title);
      const specialTags = document.querySelector(".founder-tags");
      if (specialTags && settings.special_day_tags)
        specialTags.innerHTML = String(settings.special_day_tags)
          .split(/\r?\n/)
          .filter(Boolean)
          .map((tag) => `<span>${safe(tag)}</span>`)
          .join("");
      const socialLinks = document.querySelector(".founder-connect");
      if (socialLinks && settings.special_day_links)
        socialLinks.innerHTML = String(settings.special_day_links)
          .split(/\r?\n/)
          .map((line) => line.split("|"))
          .filter(
            (parts) => parts[0] && /^https?:\/\//i.test(parts[1]?.trim() || ""),
          )
          .map(
            (parts) =>
              `<a href="${safe(parts[1].trim())}" target="_blank" rel="noreferrer">${safe(parts[0].trim())}</a>`,
          )
          .join("");
    }
    const pic = document.querySelector("#heroFounderPic");
    if (pic && settings.hero_image_url) pic.src = founderPhotoSource(settings.hero_image_url);
    const name = document.querySelector("#founder-title span");
    if (name && settings.founder_name) name.textContent = settings.founder_name;
    const role = document.querySelector(".founder-role");
    if (role && settings.founder_role) role.textContent = settings.founder_role;
    const note = document.querySelector(".founder-note");
    if (note && settings.founder_note) note.textContent = settings.founder_note;
    const tags = document.querySelector(".founder-tags");
    if (tags && settings.founder_tags)
      tags.innerHTML = String(settings.founder_tags)
        .split(/\r?\n/)
        .filter(Boolean)
        .map((t) => `<span>${safe(t)}</span>`)
        .join("");
    const links = document.querySelector(".founder-connect");
    if (
      links &&
      settings.founder_links !== undefined &&
      settings.founder_links !== null
    )
      links.innerHTML = String(settings.founder_links)
        .split(/\r?\n/)
        .map((x) => x.split("|"))
        .filter((x) => x[0] && x[1])
        .map(
          (x) =>
            `<a href="${safe(x[1].trim())}" target="_blank" rel="noreferrer">${safe(x[0].trim())}</a>`,
        )
        .join("");
  }
  if (cards?.length)
    cards.forEach((card) => {
      const node = document.createElement("article");
      node.className = "founder-card public-founder-card";
      node.innerHTML = `<div class="founder-photo-frame"><img src="${safe(founderPhotoSource(card.image_url))}" alt="${safe(card.title)}" /></div><p class="eyebrow">Community spotlight</p><h2 class="prince-name"><span>${safe(card.title)}</span></h2><p class="founder-role">${safe(card.subtitle || "")}</p><p class="founder-note">${safe(card.description || "")}</p><div class="founder-tags">${String(
        card.tags || "",
      )
        .split(/\r?\n/)
        .filter(Boolean)
        .map((t) => `<span>${safe(t)}</span>`)
        .join("")}</div><div class="founder-connect">${String(card.links || "")
        .split(/\r?\n/)
        .map((x) => x.split("|"))
        .filter((x) => x[0] && x[1])
        .map(
          (x) =>
            `<a href="${safe(x[1].trim())}" target="_blank" rel="noreferrer">${safe(x[0].trim())}</a>`,
        )
        .join("")}</div>`;
      document.querySelector("#founderCards").append(node);
    });
};
loadPublicHomeContent().catch(() => {});

const mountAssistant = () => {
  const shell = document.createElement("section");
  shell.innerHTML = `
    <button class="ai-launcher" type="button" aria-label="Open AR AI support">✦</button>
    <aside class="ai-panel" aria-label="AR AI support assistant">
      <div class="ai-head"><div><strong><span class="makima-orb">✿</span>Miss Makima</strong><small>Your soft little AR guide</small></div><button class="ai-close" type="button" aria-label="Close assistant">×</button></div>
      <div class="ai-messages"><p class="ai-message">Hello, I’m Miss Makima. I’m here whenever you need a gentle hand around AR. What would you like to know? ♡</p></div>
      <form class="ai-form"><input required maxlength="500" aria-label="Your message" placeholder="Ask anything…" /><button type="submit">Send</button></form>
    </aside>`;
  document.body.append(shell);
  const panel = shell.querySelector(".ai-panel"),
    launcher = shell.querySelector(".ai-launcher"),
    close = shell.querySelector(".ai-close"),
    form = shell.querySelector("form"),
    input = shell.querySelector("input"),
    messages = shell.querySelector(".ai-messages");
  const toggle = (open) => {
    panel.classList.toggle("open", open);
    launcher.setAttribute("aria-expanded", open);
    if (open) input.focus();
  };
  launcher.addEventListener("click", () =>
    toggle(!panel.classList.contains("open")),
  );
  close.addEventListener("click", () => toggle(false));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    messages.insertAdjacentHTML("beforeend", `<p class="ai-message user"></p>`);
    messages.lastElementChild.textContent = question;
    input.value = "";
    const status = document.createElement("p");
    status.className = "ai-message status";
    status.textContent = "Thinking ✦";
    messages.append(status);
    messages.scrollTop = messages.scrollHeight;
    let answer = localAssistantReply(question);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (response.ok) answer = (await response.json()).answer || answer;
    } catch {
      /* The local assistant is intentionally available without an API key. */
    }
    status.remove();
    const reply = document.createElement("p");
    reply.className = "ai-message";
    reply.textContent = answer;
    messages.append(reply);
    messages.scrollTop = messages.scrollHeight;
  });
};
mountAssistant();

const tooltip = document.createElement("div");
tooltip.className = "cute-tooltip";
tooltip.setAttribute("role", "tooltip");
document.body.append(tooltip);
const tooltipTargets = [
  ...document.querySelectorAll("button, a, .social-card"),
].filter((node) => !node.closest(".ai-panel"));
const tooltipText = (node) =>
  node.dataset.cuteTip ||
  node.getAttribute("aria-label") ||
  node.textContent.trim().replace(/\s+/g, " ").slice(0, 72);
const placeTooltip = (node) => {
  const rect = node.getBoundingClientRect();
  tooltip.textContent = tooltipText(node);
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${Math.max(8, rect.top - 34)}px`;
  tooltip.classList.add("show");
};
tooltipTargets.forEach((node) => {
  node.addEventListener("mouseenter", () => placeTooltip(node));
  node.addEventListener("focus", () => placeTooltip(node));
  node.addEventListener("mouseleave", () => tooltip.classList.remove("show"));
  node.addEventListener("blur", () => tooltip.classList.remove("show"));
  node.addEventListener(
    "touchstart",
    () => {
      placeTooltip(node);
      setTimeout(() => tooltip.classList.remove("show"), 1100);
    },
    { passive: true },
  );
});

// Soft motion follows a mouse or touch lightly, without making the page hard to read.
const softText = [
  ...document.querySelectorAll(
    "h1, h2, h3, p, .button, .text-link, .brand, nav a",
  ),
];
softText.forEach((node, index) => {
  node.classList.add("soft-text");
  node.dataset.softIndex = index;
});
let lastSoftMotion = 0;
window.addEventListener(
  "pointermove",
  (event) => {
    const now = performance.now();
    if (now - lastSoftMotion < 45) return;
    lastSoftMotion = now;
    const x = event.clientX / window.innerWidth - 0.5,
      y = event.clientY / window.innerHeight - 0.5;
    softText.forEach((node, index) => {
      const strength = 1.2 + (index % 4) * 0.45;
      node.style.setProperty(
        "--soft-shift-x",
        `${(x * strength * 2).toFixed(2)}px`,
      );
      node.style.setProperty(
        "--soft-shift-y",
        `${(y * strength * 2).toFixed(2)}px`,
      );
    });
  },
  { passive: true },
);

const typeTargets = [...document.querySelectorAll(".eyebrow")];
const writer = new IntersectionObserver(
  (entries) =>
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.target.dataset.written) return;
      const node = entry.target,
        text = node.dataset.originalText || node.textContent.trim();
      node.dataset.written = "true";
      node.dataset.originalText = text;
      node.textContent = "";
      node.classList.add("ink-reveal");
      let index = 0;
      const type = () => {
        node.textContent = text.slice(0, ++index);
        if (index < text.length) setTimeout(type, 18);
        else node.classList.add("written");
      };
      type();
      writer.unobserve(node);
    }),
  { threshold: 0.55 },
);
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  typeTargets.forEach((node) => writer.observe(node));

// A gentle sakura shower and a small sparkle trail make every page feel alive.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const petalCount = 18;
  for (let i = 0; i < petalCount; i += 1) {
    const petal = document.createElement("span");
    petal.className = "sakura-petal";
    petal.style.left = `${Math.random() * 100}%`;
    petal.style.setProperty("--fall-time", `${9 + Math.random() * 9}s`);
    petal.style.setProperty("--fall-delay", `${-Math.random() * 16}s`);
    const sway = 30 + Math.random() * 90;
    petal.style.setProperty("--sway", `${sway}px`);
    petal.style.setProperty("--end-sway", `${-sway}px`);
    petal.style.transform = `scale(${0.65 + Math.random() * 0.8})`;
    document.body.append(petal);
  }

  let lastSparkle = 0;
  const makeSparkle = (x, y, burst = false) => {
    const now = Date.now();
    if (!burst && now - lastSparkle < 65) return;
    lastSparkle = now;
    const sparkle = document.createElement("span");
    sparkle.className = "cursor-sparkle";
    sparkle.textContent = Math.random() > 0.5 ? "✦" : "✧";
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.setProperty(
      "--spark-x",
      `${(Math.random() - 0.5) * (burst ? 75 : 28)}px`,
    );
    sparkle.style.setProperty(
      "--spark-y",
      `${(Math.random() - 0.5) * (burst ? 75 : 28)}px`,
    );
    document.body.append(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove());
  };
  window.addEventListener(
    "pointermove",
    (event) => makeSparkle(event.clientX, event.clientY),
    { passive: true },
  );
  window.addEventListener(
    "pointerdown",
    (event) => {
      for (let i = 0; i < 7; i += 1)
        makeSparkle(event.clientX, event.clientY, true);
    },
    { passive: true },
  );
}
document.querySelectorAll(".contact-form").forEach((form) =>
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (form.classList.contains("case-form")) return;
    const d = new FormData(form),
      requestType = d.get("requestType") || "Website enquiry",
      s = encodeURIComponent(`${requestType} from ${d.get("name")}`),
      details = [
        ["Enquiry type", requestType],
        ["Case solver", "Mr. A"],
        ["Client type", d.get("clientType")],
        ["Matter", d.get("caseCategory")],
        ["Service", d.get("service")],
        ["Organization", d.get("organization")],
        ["Role", d.get("professionalRole")],
        ["Reference", d.get("caseReference")],
        ["Authorized to enquire", d.get("authorizedToEnquire")],
        ["Country", d.get("country")],
        ["State / region", d.get("state")],
        ["District / county", d.get("district")],
        ["City / town", d.get("city")],
        ["Area / neighbourhood", d.get("area")],
        ["PIN / postal code", d.get("postalCode")],
        ["Police station / precinct", d.get("policeStation")],
        ["Location search sharing consent", d.get("locationLookupConsent")],
        ["Timing", d.get("timing")],
        ["Name", d.get("name")],
        ["Email", d.get("email")],
        ["Email-draft acknowledgement", d.get("emailDraftAcknowledged")],
      ]
        .map(([label, value]) => `${label}: ${value || "Not provided"}`)
        .join("\n"),
      b = encodeURIComponent(`${details}\n\nNon-sensitive summary:\n${d.get("message")}`);
    location.href = `mailto:info@arrai.in?subject=${s}&body=${b}`;
  }),
);
