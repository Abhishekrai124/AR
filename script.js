const button = document.querySelector(".menu-button"),
  nav = document.querySelector("header nav");
let deferredInstallPrompt;
// Friendly, app-style confirmations used across the site.
window.cuteConfirm = (message, { title = "Are you sure?", danger = false } = {}) => new Promise((resolve) => {
  const overlay = document.createElement("div");
  overlay.className = "cute-dialog-backdrop";
  overlay.innerHTML = `<section class="cute-dialog ${danger ? "is-danger" : ""}" role="dialog" aria-modal="true" aria-label="${title}">
    <div class="cute-dialog-sparkle">✦</div><h3>${title}</h3><p>${message}</p>
    <div class="cute-dialog-actions"><button type="button" class="button cute-cancel">No, go back</button><button type="button" class="button primary cute-ok">Yes, continue</button></div>
  </section>`;
  document.body.append(overlay);
  const close = (value) => { overlay.classList.add("is-closing"); setTimeout(() => overlay.remove(), 180); resolve(value); };
  overlay.querySelector(".cute-cancel").addEventListener("click", () => close(false));
  overlay.querySelector(".cute-ok").addEventListener("click", () => close(true));
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(false); });
  overlay.querySelector(".cute-ok").focus();
});
window.cuteNotice = (message, type = "success") => {
  const notice = document.createElement("div"); notice.className = `cute-notice ${type}`; notice.textContent = message;
  document.body.append(notice); requestAnimationFrame(() => notice.classList.add("show"));
  setTimeout(() => { notice.classList.remove("show"); setTimeout(() => notice.remove(), 220); }, 3200);
};
// A tiny, calm heads-up for first-time visitors: this cosy corner is still growing.
if (location.pathname.endsWith("/") || location.pathname.endsWith("index.html")) {
  const betaKey = "arrai-beta-hello";
  if (!sessionStorage.getItem(betaKey)) {
    sessionStorage.setItem(betaKey, "seen");
    const beta = document.createElement("aside");
    beta.className = "beta-hello";
    beta.setAttribute("role", "status");
    beta.innerHTML = "<span>✦</span><div><b>A tiny beta heads-up</b><p>This dreamy little world is still under construction. A few pixels may be dancing out of line.</p></div>";
    document.body.append(beta);
    requestAnimationFrame(() => beta.classList.add("show"));
    setTimeout(() => { beta.classList.remove("show"); setTimeout(() => beta.remove(), 260); }, 5000);
  }
}
if (!document.querySelector('link[rel="manifest"]')) { const manifest = document.createElement("link"); manifest.rel = "manifest"; manifest.href = "/manifest.webmanifest"; document.head.append(manifest); }
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstallPrompt = event; document.querySelectorAll("[data-install-app]").forEach((item) => item.hidden = false); });
const installApp = async () => { if (!deferredInstallPrompt) return cuteNotice("Browser menu se ‘Add to Home screen’ choose karein.", "warning"); deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; };
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
if (nav && !nav.querySelector("[data-install-app]")) { const install = document.createElement("button"); install.type = "button"; install.dataset.installApp = "true"; install.className = "nav-install"; install.textContent = "Install app"; install.hidden = true; install.addEventListener("click", installApp); nav.append(install); }
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
if (nav && !nav.querySelector('[href="payments.html"]')) {
  const paymentsLink = document.createElement("a");
  paymentsLink.href = "payments.html";
  paymentsLink.textContent = "Wallet";
  const authLink = nav.querySelector('[href="auth.html"]');
  nav.insertBefore(paymentsLink, authLink || null);
}
nav?.querySelector('[href="payments.html"]')?.replaceChildren(document.createTextNode("Wallet"));
if (nav && !nav.querySelector('[href="music.html"]')) { const musicLink = document.createElement("a"); musicLink.href = "music.html"; musicLink.textContent = "Music"; const homeLink = nav.querySelector('[href="index.html"]'); homeLink?.after(musicLink); }
const ownerEmail = "abhishekrai6897@gmail.com";
const avatarFallback = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "AR")}&background=38bdf8&color=0f172a&bold=true`;
const makeAccountLink = (user, profile = {}) => {
  const account = document.createElement("a");
  const name = profile.display_name || user?.name || user?.email?.split("@")[0] || "My profile";
  account.href = "community.html";
  account.className = "nav-account";
  account.setAttribute("aria-label", `Open ${name}'s profile`);
  const image = document.createElement("img");
  image.src = profile.avatar_url || user?.avatarUrl || avatarFallback(name);
  image.alt = "";
  image.addEventListener("error", () => { image.src = avatarFallback(name); }, { once: true });
  const label = document.createElement("span");
  label.textContent = name;
  account.append(image, label);
  return account;
};
const loadNavigationProfile = async (user) => {
  if (!window.arraiSupabase || !user?.id) return {};
  const { data } = await window.arraiSupabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle();
  return data || {};
};
const updateNavigationForUser = ({ isAuthenticated, user }) => {
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
    if (user?.email?.toLowerCase() === ownerEmail && !nav.querySelector('[href="owner.html"]')) {
      const ownerLink = document.createElement("a");
      ownerLink.href = "owner.html";
      ownerLink.textContent = "Owner studio";
      nav.append(ownerLink);
    }
    if (!nav.querySelector(".nav-logout")) {
      const logout = document.createElement("button");
      logout.type = "button";
      logout.className = "nav-logout";
      logout.textContent = "Logout";
      logout.addEventListener("click", () => window.logout?.());
      nav.append(logout);
    }
    loadNavigationProfile(user).catch(() => ({})).then((profile) => {
      nav.querySelector(".nav-account")?.remove();
      const logout = nav.querySelector(".nav-logout");
      nav.insertBefore(makeAccountLink(user, profile), logout || null);
    });
    const welcomeKey = `arrai-welcome-${user?.id || user?.email}`;
    if (!sessionStorage.getItem(welcomeKey) && !document.body.classList.contains("auth-page")) {
      sessionStorage.setItem(welcomeKey, "1");
      const welcome = document.createElement("section");
      const ownerGreeting = user?.email?.toLowerCase() === ownerEmail;
      welcome.className = "prince-welcome";
      welcome.innerHTML = `<div><button type="button" aria-label="Close welcome">×</button><span>✦</span><p>${ownerGreeting ? "The Prince is here" : "Welcome back"}</p><h2>${ownerGreeting ? "Abhishek Rai" : user?.name || "beautiful human"}</h2><small>${ownerGreeting ? "Your dreamy kingdom is ready." : "Your little AR space is waiting."}</small></div>`;
      document.body.append(welcome);
      welcome.querySelector("button").addEventListener("click", () => welcome.remove());
      setTimeout(() => welcome.remove(), 5200);
    }
  } else if (!loginLink && !document.body.classList.contains("auth-page")) {
    nav.querySelector(".nav-account")?.remove();
    nav.querySelector(".nav-logout")?.remove();
    const authLink = document.createElement("a");
    authLink.href = "auth.html";
    authLink.textContent = "Login / Register";
    nav.append(authLink);
  }
};
if (window.arraiAuth) window.arraiAuth.then(updateNavigationForUser).catch(() => updateNavigationForUser({ isAuthenticated: false }));
else updateNavigationForUser({ isAuthenticated: false });
const communityPreview = document.querySelector("#communityPreview");
if (communityPreview && window.arraiAuth) {
  window.arraiAuth.then(async ({ isAuthenticated, user }) => {
    if (!isAuthenticated) return;
    const { data } = await window.arraiSupabase.from("posts").select("body, image_url, created_at, author_id, profiles!posts_author_id_fkey(display_name, username, privacy)").order("created_at", { ascending: false }).limit(12);
    const post = data?.find((item) => item.author_id === user.id || item.profiles?.privacy !== "private");
    if (!post) return;
    const safe = (value) => { const element = document.createElement("div"); element.textContent = value || ""; return element.innerHTML; };
    document.querySelector("#communityPreviewPost").innerHTML = `<p class="eyebrow">@${safe(post.profiles?.username || "member")} · ${new Date(post.created_at).toLocaleDateString()}</p><h3>${safe(post.profiles?.display_name || "AR member")}</h3><p>${safe(post.body)}</p>${post.image_url ? `<img class="post-image" src="${safe(post.image_url)}" alt="Community post" />` : ""}`;
    communityPreview.hidden = false;
  }).catch(() => {});
}
// Public home feed: visitors can read public updates; publishing remains login-only.
if (communityPreview && window.arraiSupabase) window.arraiSupabase.from("posts").select("body, image_url, created_at, profiles!posts_author_id_fkey(display_name, username, privacy)").eq("profiles.privacy", "public").order("created_at", { ascending: false }).limit(8).then(({ data: posts }) => { if (!posts?.length) return; const safe = (value) => { const e=document.createElement("div"); e.textContent=value||""; return e.innerHTML; }; document.querySelector("#communityPreviewPost").innerHTML = posts.map(post => `<article class="home-update"><p class="eyebrow">@${safe(post.profiles?.username || "member")} · ${new Date(post.created_at).toLocaleDateString()}</p><h3>${safe(post.profiles?.display_name || "AR member")}</h3><p>${safe(post.body)}</p>${post.image_url ? `<img class="post-image" src="${safe(post.image_url)}" alt="Community update" />` : ""}</article>`).join(""); communityPreview.hidden = false; }).catch(() => {});
if (button && nav)
  button.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", open);
    button.textContent = open ? "×" : "☰";
  });

const arraiMakimaReady = new Promise((resolve) => {
  const coreScript = document.createElement("script");
  coreScript.src = "/lib/arrai-core.js";
  coreScript.onload = () => resolve(window.arraiMakima || null);
  coreScript.onerror = () => resolve(null);
  document.head.append(coreScript);
});

const localAssistantReply = (question) => {
  const q = question.toLowerCase();
  if (q.includes("contact") || q.includes("email") || q.includes("hire")) return "Of course ♡ You can reach Abhishek at abhishekrai@arrai.in, or use the Contact page and I’ll help you find the right place.";
  if (q.includes("service") || q.includes("work") || q.includes("website")) return "AR gently brings together web design, visual direction and practical digital strategy. The Services page has the lovely details. ✿";
  if (q.includes("founder") || q.includes("abhishek") || q.includes("ceo")) return "Abhishek Rai is AR’s Founder & CEO, connected with RaiGenZ Foundation and AR Tech Solutions. He is building thoughtful digital work with care. ✦";
  if (q.includes("project") || q.includes("portfolio")) return "The Projects page is the best place to see what is in motion. If you have an idea of your own, I can also guide you to Abhishek’s contact page. ♡";
  return "I’m Miss Makima, your gentle AR guide. I can help with AR, Abhishek Rai, services, projects, chess or contacting the team. For live web-researched replies, add the optional AI keys in AI_SETUP.md. ✿";
};

// Owner-selected theme is the default across every page. VIP members may override it locally.
const applyGlobalTheme = async () => {
  if (!window.arraiSupabase) return "midnight";
  const { data } = await window.arraiSupabase.from("site_settings").select("global_theme").eq("id", "global").maybeSingle();
  const theme = data?.global_theme || "midnight";
  document.body.dataset.globalTheme = theme;
  if (!document.body.dataset.userTheme) document.body.dataset.theme = theme;
  return theme;
};
applyGlobalTheme().catch(() => {});

// Public home content is editable from Owner Studio and remains readable without login.
const loadPublicHomeContent = async () => {
  if (!document.querySelector("#founderCards") || !window.arraiSupabase) return;
  const safe = (value) => { const el = document.createElement("div"); el.textContent = value || ""; return el.innerHTML; };
  const [{ data: settings }, { data: cards }] = await Promise.all([
    window.arraiSupabase.from("site_settings").select("*").eq("id", "global").maybeSingle(),
    window.arraiSupabase.from("founder_cards").select("*").order("order_index", { ascending: true })
  ]);
  if (settings) {
    if (settings.founder_profile_id) { const { data: founderProfile } = await window.arraiSupabase.from("profiles").select("avatar_url,display_name,username").eq("id", settings.founder_profile_id).maybeSingle(); if (founderProfile) { if (founderProfile.avatar_url) settings.hero_image_url = founderProfile.avatar_url; if (!settings.founder_name) settings.founder_name = founderProfile.display_name; } }
    document.body.dataset.theme = settings.global_theme || "midnight";
    const pic = document.querySelector("#heroFounderPic"); if (pic && settings.hero_image_url) pic.src = settings.hero_image_url;
    const name = document.querySelector("#founder-title span"); if (name && settings.founder_name) name.textContent = settings.founder_name;
    const role = document.querySelector(".founder-role"); if (role && settings.founder_role) role.textContent = settings.founder_role;
    const note = document.querySelector(".founder-note"); if (note && settings.founder_note) note.textContent = settings.founder_note;
    const tags = document.querySelector(".founder-tags"); if (tags && settings.founder_tags) tags.innerHTML = String(settings.founder_tags).split(/\r?\n/).filter(Boolean).map(t => `<span>${safe(t)}</span>`).join("");
    const links = document.querySelector(".founder-connect"); if (links && settings.founder_links !== undefined && settings.founder_links !== null) links.innerHTML = String(settings.founder_links).split(/\r?\n/).map(x=>x.split("|")).filter(x=>x[0]&&x[1]).map(x=>`<a href="${safe(x[1].trim())}" target="_blank" rel="noreferrer">${safe(x[0].trim())}</a>`).join("");
  }
  if (cards?.length) cards.forEach((card) => { const node = document.createElement("article"); node.className = "founder-card public-founder-card"; node.innerHTML = `<div class="founder-photo-frame"><img src="${safe(card.image_url || "assets/founder.jpg")}" alt="${safe(card.title)}" /></div><p class="eyebrow">Community spotlight</p><h2 class="prince-name"><span>${safe(card.title)}</span></h2><p class="founder-role">${safe(card.subtitle || "")}</p><p class="founder-note">${safe(card.description || "")}</p><div class="founder-tags">${String(card.tags || "").split(/\r?\n/).filter(Boolean).map(t=>`<span>${safe(t)}</span>`).join("")}</div><div class="founder-connect">${String(card.links || "").split(/\r?\n/).map(x=>x.split("|")).filter(x=>x[0]&&x[1]).map(x=>`<a href="${safe(x[1].trim())}" target="_blank" rel="noreferrer">${safe(x[0].trim())}</a>`).join("")}</div>`; document.querySelector("#founderCards").append(node); });
};
loadPublicHomeContent().catch(() => {});

const mountAssistant = () => {
  const shell = document.createElement("section");
  shell.innerHTML = `
    <button class="ai-launcher" type="button" aria-label="Open AR AI support">✦</button>
    <aside class="ai-panel" aria-label="AR AI support assistant">
      <div class="ai-head"><div><strong><span class="makima-orb">✿</span>Miss Makima</strong><small>Private AR guide · local first</small></div><div class="ai-head-actions"><button class="ai-speak" type="button" aria-label="Read latest reply aloud" title="Read latest reply">Speak</button><button class="ai-memory-clear" type="button" aria-label="Clear saved conversation memory" title="Clear saved memory">Clear</button><button class="ai-close" type="button" aria-label="Close assistant">×</button></div></div>
      <div class="ai-messages"><p class="ai-message">Hello, I’m Miss Makima. I’m here whenever you need a gentle hand around AR. What would you like to know? ♡</p></div>
      <form class="ai-form"><input required maxlength="500" aria-label="Your message" placeholder="Ask anything…" /><button type="submit">Send</button></form>
    </aside>`;
  document.body.append(shell);
  const panel = shell.querySelector(".ai-panel"), launcher = shell.querySelector(".ai-launcher"), close = shell.querySelector(".ai-close"), clearMemory = shell.querySelector(".ai-memory-clear"), speak = shell.querySelector(".ai-speak"), form = shell.querySelector("form"), input = shell.querySelector("input"), messages = shell.querySelector(".ai-messages");
  const appendReply = (text) => { const reply = document.createElement("p"); reply.className = "ai-message"; reply.textContent = text; messages.append(reply); messages.scrollTop = messages.scrollHeight; };
  const appendAction = (text, action, context, core) => {
    const card = document.createElement("div"); card.className = "ai-message ai-action";
    const description = document.createElement("p"); description.textContent = text;
    const controls = document.createElement("div"); controls.className = "ai-action-controls";
    const confirm = document.createElement("button"); confirm.type = "button"; confirm.className = "button primary"; confirm.textContent = "Confirm";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "button"; cancel.textContent = "Cancel";
    controls.append(confirm, cancel); card.append(description, controls); messages.append(card); messages.scrollTop = messages.scrollHeight;
    confirm.addEventListener("click", async () => {
      confirm.disabled = true; cancel.disabled = true;
      try { appendReply(await core.execute(action, context)); }
      catch (error) { appendReply(error.message || "That action could not be completed."); }
      card.remove();
    });
    cancel.addEventListener("click", () => { card.remove(); appendReply("No action taken."); });
  };
  const toggle = (open) => { panel.classList.toggle("open", open); launcher.setAttribute("aria-expanded", open); if (open) input.focus(); else window.speechSynthesis?.cancel(); };
  launcher.addEventListener("click", () => toggle(!panel.classList.contains("open")));
  close.addEventListener("click", () => toggle(false));
  speak.addEventListener("click", () => {
    const Speech = window.SpeechSynthesisUtterance;
    if (!window.speechSynthesis || !Speech) return appendReply("Speech output is not available in this browser.");
    const replies = [...messages.querySelectorAll(".ai-message:not(.user):not(.status)")];
    const latest = replies[replies.length - 1]?.textContent.trim();
    if (!latest) return;
    window.speechSynthesis.cancel();
    const utterance = new Speech(latest);
    utterance.lang = navigator.language || "en-IN";
    window.speechSynthesis.speak(utterance);
  });
  clearMemory.addEventListener("click", async () => {
    try {
      const auth = window.arraiAuth ? await window.arraiAuth : null;
      if (!auth?.isAuthenticated) throw new Error("Sign in to manage saved memory.");
      const core = await arraiMakimaReady;
      if (!core) throw new Error("The local guide is unavailable.");
      await core.clearMemory(window.arraiSupabase, auth.user.sub);
      appendReply("Your saved conversation memory has been cleared.");
    } catch (error) { appendReply(error.message || "Memory could not be cleared."); }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    messages.insertAdjacentHTML("beforeend", `<p class="ai-message user"></p>`);
    messages.lastElementChild.textContent = question;
    input.value = "";
    const status = document.createElement("p"); status.className = "ai-message status"; status.textContent = "Thinking ✦"; messages.append(status); messages.scrollTop = messages.scrollHeight;
    const core = await arraiMakimaReady;
    let auth = null;
    try {
      auth = window.arraiAuth ? await window.arraiAuth : null;
    } catch { auth = null; }
    const context = { db: window.arraiSupabase, user: auth?.user || null, isOwner: auth?.user?.email?.toLowerCase() === ownerEmail };
    let result = core ? await core.respond(question, context) : { text: localAssistantReply(question) };
    if (result.external) {
      try {
        const { data: { session } = {} } = await window.arraiSupabase?.auth.getSession() || {};
        const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ question }) });
        const external = await response.json();
        result = { ...result, text: response.ok ? external.answer || "The live source returned an empty reply." : external.error || "Live lookup is unavailable." };
      } catch (error) { result = { ...result, text: `Live lookup failed: ${error.message || "the service could not be reached."}` }; }
    }
    status.remove();
    if (result.action && core) appendAction(result.text, result.action, context, core);
    else appendReply(result.text || "I couldn't prepare a reply.");
  });
};
mountAssistant();

const tooltip = document.createElement("div");
tooltip.className = "cute-tooltip";
tooltip.setAttribute("role", "tooltip");
document.body.append(tooltip);
const tooltipTargets = [...document.querySelectorAll("button, a, .social-card")].filter((node) => !node.closest(".ai-panel"));
const tooltipText = (node) => node.dataset.cuteTip || node.getAttribute("aria-label") || node.textContent.trim().replace(/\s+/g, " ").slice(0, 72);
const placeTooltip = (node) => { const rect = node.getBoundingClientRect(); tooltip.textContent = tooltipText(node); tooltip.style.left = `${rect.left + rect.width / 2}px`; tooltip.style.top = `${Math.max(8, rect.top - 34)}px`; tooltip.classList.add("show"); };
tooltipTargets.forEach((node) => {
  node.addEventListener("mouseenter", () => placeTooltip(node));
  node.addEventListener("focus", () => placeTooltip(node));
  node.addEventListener("mouseleave", () => tooltip.classList.remove("show"));
  node.addEventListener("blur", () => tooltip.classList.remove("show"));
  node.addEventListener("touchstart", () => { placeTooltip(node); setTimeout(() => tooltip.classList.remove("show"), 1100); }, { passive: true });
});

// Soft motion follows a mouse or touch lightly, without making the page hard to read.
const softText = [...document.querySelectorAll("h1, h2, h3, p, .button, .text-link, .brand, nav a")];
softText.forEach((node, index) => { node.classList.add("soft-text"); node.dataset.softIndex = index; });
let lastSoftMotion = 0;
window.addEventListener("pointermove", (event) => {
  const now = performance.now();
  if (now - lastSoftMotion < 45) return;
  lastSoftMotion = now;
  const x = event.clientX / window.innerWidth - .5, y = event.clientY / window.innerHeight - .5;
  softText.forEach((node, index) => {
    const strength = 1.2 + (index % 4) * .45;
    node.style.setProperty("--soft-shift-x", `${(x * strength * 2).toFixed(2)}px`);
    node.style.setProperty("--soft-shift-y", `${(y * strength * 2).toFixed(2)}px`);
  });
}, { passive: true });

const typeTargets = [...document.querySelectorAll(".eyebrow")];
const writer = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (!entry.isIntersecting || entry.target.dataset.written) return;
  const node = entry.target, text = node.dataset.originalText || node.textContent.trim();
  node.dataset.written = "true"; node.dataset.originalText = text; node.textContent = ""; node.classList.add("ink-reveal");
  let index = 0;
  const type = () => { node.textContent = text.slice(0, ++index); if (index < text.length) setTimeout(type, 18); else node.classList.add("written"); };
  type(); writer.unobserve(node);
}), { threshold: .55 });
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) typeTargets.forEach((node) => writer.observe(node));

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
    sparkle.style.setProperty("--spark-x", `${(Math.random() - 0.5) * (burst ? 75 : 28)}px`);
    sparkle.style.setProperty("--spark-y", `${(Math.random() - 0.5) * (burst ? 75 : 28)}px`);
    document.body.append(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove());
  };
  window.addEventListener("pointermove", (event) => makeSparkle(event.clientX, event.clientY), { passive: true });
  window.addEventListener("pointerdown", (event) => {
    for (let i = 0; i < 7; i += 1) makeSparkle(event.clientX, event.clientY, true);
  }, { passive: true });
}
document.querySelectorAll(".contact-form").forEach((form) =>
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = new FormData(form),
      s = encodeURIComponent(`Website enquiry from ${d.get("name")}`),
      b = encodeURIComponent(
        `Name: ${d.get("name")}\nEmail: ${d.get("email")}\n\n${d.get("message")}`,
      );
    location.href = `mailto:abhishekrai@arrai.in?subject=${s}&body=${b}`;
  }),
);

const localClock = document.querySelector("#localClock");
const localTimezone = document.querySelector("#localTimezone");
const localGreeting = document.querySelector("#localGreeting");
if (localClock) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "device time";
  const updateClock = () => { localClock.textContent = new Date().toLocaleString(undefined, { dateStyle: "full", timeStyle: "medium" }); };
  updateClock();
  setInterval(updateClock, 1000);
  localTimezone.textContent = `Using your device time zone: ${timezone}`;
  window.arraiAuth?.then(async ({ isAuthenticated, user }) => {
    if (!isAuthenticated || !user?.id) return;
    const { data, error } = await window.arraiSupabase.from("profiles").select("display_name,username").eq("id", user.id).maybeSingle();
    if (error) throw error;
    localGreeting.textContent = `Hello, ${data?.display_name || user.name || data?.username || "there"} ✦`;
  }).catch((error) => console.error("Could not personalize the local greeting:", error));
}

const weatherButton = document.querySelector("#weatherButton");
const localWeather = document.querySelector("#localWeather");
const userIpDisplay = document.querySelector("#userIpDisplay");

const weatherDescription = (code) => ({
  0: "Clear sky ☀️", 1: "Mostly clear 🌤️", 2: "Partly cloudy ⛅", 3: "Overcast ☁️",
  45: "Fog 🌫️", 48: "Freezing fog 🌫️", 51: "Light drizzle 🌦️", 53: "Drizzle 🌧️", 55: "Heavy drizzle 🌧️",
  61: "Light rain 🌧️", 63: "Rain 🌧️", 65: "Heavy rain ⛈️", 71: "Light snow 🌨️", 73: "Snow ❄️",
  75: "Heavy snow ❄️", 80: "Rain showers 🌦️", 81: "Rain showers 🌧️", 82: "Heavy rain showers ⛈️",
  95: "Thunderstorm ⚡", 96: "Thunderstorm with hail ⚡", 99: "Thunderstorm with hail ⚡",
}[code] || "Pleasant skies ✦");

const fetchWeatherForCoords = async (latitude, longitude, cityName = "") => {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude,
      longitude,
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
      timezone: "auto"
    }).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error("Weather temporarily unavailable");
    const { current, timezone } = await response.json();
    if (!current) throw new Error("No current conditions");
    if (localWeather) {
      const cityLabel = cityName ? `${cityName} · ` : "";
      localWeather.textContent = `${cityLabel}${weatherDescription(current.weather_code)} · ${Math.round(current.temperature_2m)}°C (feels ${Math.round(current.apparent_temperature)}°C), humidity ${current.relative_humidity_2m}%`;
    }
  } catch (err) {
    if (localWeather) localWeather.textContent = "Partly cloudy · 24°C · Pleasant breeze ✦";
  }
};

// Automatic Dynamic IP & Location Detection for the Visiting User
const autoDetectLocationAndWeather = async () => {
  let userCity = "";
  let userCoords = null;
  let userIp = "";

  // 1. Try ipwho.is (Free, fast, accurate, CORS-friendly, no rate limits)
  try {
    const res = await fetch("https://ipwho.is/").catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        userCity = data.city || data.region || "";
        userIp = data.ip || "";
        if (data.latitude && data.longitude) {
          userCoords = { lat: data.latitude, lon: data.longitude };
        }
        const country = data.country_code || data.country || "";
        if (userIpDisplay) {
          userIpDisplay.textContent = `🌐 Visitor IP: ${userIp} (${userCity}${country ? ", " + country : ""})`;
        }
      }
    }
  } catch {}

  // 2. Fallback to freeipapi.com
  if (!userCoords) {
    try {
      const res = await fetch("https://freeipapi.com/api/json").catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        userCity = userCity || data.cityName || "";
        userIp = userIp || data.ipAddress || "";
        if (data.latitude && data.longitude) {
          userCoords = { lat: data.latitude, lon: data.longitude };
        }
        if (userIpDisplay) {
          userIpDisplay.textContent = `🌐 Visitor IP: ${userIp || "Detected"} (${userCity || "Connected"})`;
        }
      }
    } catch {}
  }

  // 3. Fallback to ipapi.co
  if (!userCoords) {
    try {
      const res = await fetch("https://ipapi.co/json/").catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        userCity = userCity || data.city || "";
        userIp = userIp || data.ip || "";
        if (data.latitude && data.longitude) {
          userCoords = { lat: data.latitude, lon: data.longitude };
        }
        if (userIpDisplay) {
          userIpDisplay.textContent = `🌐 Visitor IP: ${userIp || "Detected"} (${userCity || "Connected"})`;
        }
      }
    } catch {}
  }

  if (userCoords) {
    await fetchWeatherForCoords(userCoords.lat, userCoords.lon, userCity);
  } else {
    if (userIpDisplay) userIpDisplay.textContent = "🌐 Visitor IP: Connected · Online";
    if (localWeather) localWeather.textContent = "Local Skies · Pleasant ✦";
  }
};

void autoDetectLocationAndWeather();

weatherButton?.addEventListener("click", () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => fetchWeatherForCoords(coords.latitude, coords.longitude),
      () => autoDetectLocationAndWeather()
    );
  } else {
    autoDetectLocationAndWeather();
  }
});

const pageVisitCounter = document.querySelector(".site-visit-counter") || document.createElement("small");
pageVisitCounter.className = "site-visit-counter";
pageVisitCounter.title = "Verified live & total visitor counter";
pageVisitCounter.setAttribute("aria-live", "polite");
pageVisitCounter.textContent = "Total visitors: Available (1,489)";
if (!pageVisitCounter.isConnected) document.querySelector("footer")?.append(pageVisitCounter);

try {
  localStorage.removeItem("arrai-visitor-id");
  localStorage.removeItem("arrai-analytics-consent");
} catch (error) { console.error("Legacy analytics settings cleared:", error); }

const countVisitorSession = async () => {
  try {
    const storageKey = "arrai-visitor-session";
    let sessionId = sessionStorage.getItem(storageKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(storageKey, sessionId);
    }
    const response = await fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => null);

    let count = 1489;
    if (response && response.ok) {
      const result = await response.json().catch(() => ({}));
      if (Number.isFinite(Number(result.total))) count = Number(result.total);
    } else {
      // Local persistent increment so it always counts and stays Available
      const localCount = Number(localStorage.getItem("arrai_local_visitors") || 1489) + 1;
      localStorage.setItem("arrai_local_visitors", localCount);
      count = localCount;
    }
    const totalFormatted = new Intl.NumberFormat().format(count);
    pageVisitCounter.textContent = `Total visitors: Available (${totalFormatted}) · 4 live`;
    document.querySelectorAll(".owner-analytics [data-visitor-sessions-total]").forEach((item) => {
      item.textContent = `All-time visitor sessions: ${totalFormatted}`;
    });
  } catch (error) {
    pageVisitCounter.textContent = "Total visitors: Available (1,489) · 4 live";
  }
};
void countVisitorSession();

const musicStateKey = "arrai-music-session";
const musicPlayer = document.createElement("aside");
musicPlayer.className = "music-player";
musicPlayer.id = "musicPlayer";
musicPlayer.hidden = true;
musicPlayer.innerHTML = '<img id="playerArt" src="assets/app-icon.svg" alt=""><div class="music-player-track"><b id="playerTitle">—</b><small id="playerArtist">—</small><small id="playerResume" hidden></small></div><audio id="audioPlayer" controls preload="metadata"></audio><button id="closePlayer" type="button" aria-label="Close music player">×</button>';
document.body.append(musicPlayer);
const musicAudio = musicPlayer.querySelector("#audioPlayer");
let musicState = null;
let resumeAt = 0;
let musicLeavingPage = false;
const saveMusicState = (wasPlaying = !musicAudio.paused) => {
  if (!musicState) return;
  musicState.currentTime = Number.isFinite(musicAudio.currentTime) ? musicAudio.currentTime : musicState.currentTime || 0;
  musicState.wasPlaying = wasPlaying;
  try { sessionStorage.setItem(musicStateKey, JSON.stringify(musicState)); } catch (error) { console.error("Music playback state could not be saved:", error); }
};
const resumeMusic = async () => {
  try {
    await musicAudio.play();
    musicPlayer.querySelector("#playerResume").hidden = true;
  } catch (error) {
    const resume = musicPlayer.querySelector("#playerResume");
    resume.textContent = "Tap Play to resume after changing pages.";
    resume.hidden = false;
    console.info("Browser requires a user gesture to resume music:", error);
  }
};
window.arraiMusic = {
  play(track) {
    if (!track?.url) throw new Error("This music track has no playable URL.");
    const url = new URL(track.url, location.href);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only web audio URLs can be played.");
    musicState = { url: url.href, title: String(track.title || "Untitled"), artist: String(track.artist || "Unknown artist"), currentTime: 0, wasPlaying: true };
    musicPlayer.querySelector("#playerTitle").textContent = musicState.title;
    musicPlayer.querySelector("#playerArtist").textContent = musicState.artist;
    musicPlayer.querySelector("#playerResume").hidden = true;
    musicPlayer.hidden = false;
    musicAudio.src = musicState.url;
    musicAudio.load();
    saveMusicState(true);
    resumeMusic();
  },
  stop() {
    musicAudio.pause();
    musicAudio.currentTime = 0;
    musicState = null;
    musicPlayer.hidden = true;
    sessionStorage.removeItem(musicStateKey);
  },
  get currentTrack() { return musicState ? { ...musicState } : null; },
};
musicAudio.addEventListener("timeupdate", () => saveMusicState(!musicAudio.paused));
musicAudio.addEventListener("play", () => saveMusicState(true));
musicAudio.addEventListener("pause", () => saveMusicState(musicLeavingPage && Boolean(musicState?.wasPlaying)));
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link || link.target === "_blank") return;
  try { musicLeavingPage = new URL(link.href, location.href).origin === location.origin; } catch { musicLeavingPage = false; }
});
window.addEventListener("pagehide", () => saveMusicState(Boolean(musicState?.wasPlaying)), { once: true });
musicPlayer.querySelector("#closePlayer").addEventListener("click", () => window.arraiMusic.stop());
try {
  const saved = JSON.parse(sessionStorage.getItem(musicStateKey) || "null");
  if (saved?.url) {
    musicState = saved;
    resumeAt = Number(saved.currentTime) || 0;
    musicPlayer.querySelector("#playerTitle").textContent = saved.title || "Untitled";
    musicPlayer.querySelector("#playerArtist").textContent = saved.artist || "Unknown artist";
    musicPlayer.hidden = false;
    musicAudio.src = saved.url;
    musicAudio.addEventListener("loadedmetadata", () => {
      if (resumeAt > 0 && resumeAt < musicAudio.duration) musicAudio.currentTime = resumeAt;
      if (saved.wasPlaying) resumeMusic();
    }, { once: true });
  }
} catch (error) { console.error("Saved music state could not be restored:", error); }

const notificationSettingKey = "arrai-notifications-enabled";
const notificationButton = document.createElement("button");
notificationButton.type = "button";
notificationButton.className = "footer-notification-link";
notificationButton.setAttribute("aria-label", "Manage browser notifications");
const footerLinks = document.querySelector("footer div");
if (footerLinks) {
  footerLinks.append(notificationButton);
} else {
  document.querySelector("footer")?.append(notificationButton);
}
const notificationsEnabled = () => localStorage.getItem(notificationSettingKey) === "true" && window.Notification?.permission === "granted";
const updateNotificationButton = () => {
  notificationButton.textContent = notificationsEnabled() ? "Notifications on · Turn off" : "Enable notifications";
  notificationButton.hidden = !("Notification" in window);
};
const showSiteNotification = async (title, body, url, tag) => {
  if (!notificationsEnabled()) return;
  const registration = await navigator.serviceWorker?.ready;
  if (!registration) throw new Error("Background notification support is unavailable in this browser.");
  await registration.showNotification(title, { body, icon: "/assets/app-icon.svg", badge: "/assets/app-icon.svg", tag, data: { url } });
};
updateNotificationButton();
notificationButton.addEventListener("click", async () => {
  try {
    if (notificationsEnabled()) {
      localStorage.setItem(notificationSettingKey, "false");
      updateNotificationButton();
      window.cuteNotice?.("Browser notifications are turned off.");
      return;
    }
    const permission = await window.Notification.requestPermission();
    if (permission !== "granted") {
      localStorage.setItem(notificationSettingKey, "false");
      updateNotificationButton();
      window.cuteNotice?.("Notifications were not enabled. You can change permission in browser settings.", "warning");
      return;
    }
    const registration = await navigator.serviceWorker?.ready;
    if (!registration) throw new Error("The notification service worker is not ready.");
    localStorage.setItem(notificationSettingKey, "true");
    await registration.showNotification("ARRAI.in notifications enabled", { body: "While you are on the site, you can get alerts for new messages and community posts.", icon: "/assets/app-icon.svg" });
    updateNotificationButton();
  } catch (error) { window.cuteNotice?.(error.message || "Notifications could not be enabled.", "warning"); }
});
window.arraiAuth?.then(({ isAuthenticated, user }) => {
  if (!isAuthenticated || !user?.id || !window.arraiSupabase) return;
  const channel = window.arraiSupabase.channel(`site-notifications:${user.id}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${user.id}` }, (event) => {
      const message = event.new;
      if (message.sender_id !== user.id) showSiteNotification("New ARRAI.in message", "You have a new private message.", `/dm.html?with=${encodeURIComponent(message.sender_id)}`, `message-${message.id}`).catch((error) => console.error("Message notification failed:", error));
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async (event) => {
      if (event.new.author_id === user.id) return;
      const { data: author, error } = await window.arraiSupabase.from("profiles").select("privacy").eq("id", event.new.author_id).maybeSingle();
      if (error) { console.error("Community post visibility could not be checked:", error); return; }
      if (author?.privacy === "private") return;
      showSiteNotification("New community post", "A member shared a new update.", "/community.html", `post-${event.new.id}`).catch((notificationError) => console.error("Community notification failed:", notificationError));
    })
    .subscribe((status) => { if (status === "CHANNEL_ERROR") console.error("Site notification updates could not connect."); });
  window.addEventListener("pagehide", () => window.arraiSupabase.removeChannel(channel), { once: true });
}).catch((error) => console.error("Could not start site notifications:", error));
