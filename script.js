const button = document.querySelector(".menu-button"),
  nav = document.querySelector("nav");
if (nav && !nav.querySelector('[href="chess.html"]')) {
  const chessLink = document.createElement("a");
  chessLink.href = "chess.html";
  chessLink.textContent = "Chess";
  const contact = nav.querySelector('[href="contact.html"]');
  nav.insertBefore(chessLink, contact);
}
if (nav && !nav.querySelector('[href="auth.html"]')) {
  const authLink = document.createElement("a");
  authLink.href = "auth.html";
  authLink.textContent = "Login / Register";
  nav.append(authLink);
}
if (nav && !nav.querySelector('[href="community.html"]')) {
  const communityLink = document.createElement("a");
  communityLink.href = "community.html";
  communityLink.textContent = "Community";
  const authLink = nav.querySelector('[href="auth.html"]');
  nav.insertBefore(communityLink, authLink || null);
}
if (nav && !nav.querySelector('[href="payments.html"]')) {
  const paymentsLink = document.createElement("a");
  paymentsLink.href = "payments.html";
  paymentsLink.textContent = "Payments";
  const authLink = nav.querySelector('[href="auth.html"]');
  nav.insertBefore(paymentsLink, authLink || null);
}
if (button && nav)
  button.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", open);
    button.textContent = open ? "×" : "☰";
  });

const localAssistantReply = (question) => {
  const q = question.toLowerCase();
  if (q.includes("contact") || q.includes("email") || q.includes("hire")) return "Of course ♡ You can reach Abhishek at abhishekrai@arrai.in, or use the Contact page and I’ll help you find the right place.";
  if (q.includes("service") || q.includes("work") || q.includes("website")) return "AR gently brings together web design, visual direction and practical digital strategy. The Services page has the lovely details. ✿";
  if (q.includes("founder") || q.includes("abhishek") || q.includes("ceo")) return "Abhishek Rai is AR’s Founder & CEO, connected with RaiGenZ Foundation and AR Tech Solutions. He is building thoughtful digital work with care. ✦";
  if (q.includes("project") || q.includes("portfolio")) return "The Projects page is the best place to see what is in motion. If you have an idea of your own, I can also guide you to Abhishek’s contact page. ♡";
  return "I’m Miss Makima, your gentle AR guide. I can help with AR, Abhishek Rai, services, projects, chess or contacting the team. For live web-researched replies, add the optional AI keys in AI_SETUP.md. ✿";
};

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
  const panel = shell.querySelector(".ai-panel"), launcher = shell.querySelector(".ai-launcher"), close = shell.querySelector(".ai-close"), form = shell.querySelector("form"), input = shell.querySelector("input"), messages = shell.querySelector(".ai-messages");
  const toggle = (open) => { panel.classList.toggle("open", open); launcher.setAttribute("aria-expanded", open); if (open) input.focus(); };
  launcher.addEventListener("click", () => toggle(!panel.classList.contains("open")));
  close.addEventListener("click", () => toggle(false));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    messages.insertAdjacentHTML("beforeend", `<p class="ai-message user"></p>`);
    messages.lastElementChild.textContent = question;
    input.value = "";
    const status = document.createElement("p"); status.className = "ai-message status"; status.textContent = "Thinking ✦"; messages.append(status); messages.scrollTop = messages.scrollHeight;
    let answer = localAssistantReply(question);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      if (response.ok) answer = (await response.json()).answer || answer;
    } catch { /* The local assistant is intentionally available without an API key. */ }
    status.remove();
    const reply = document.createElement("p"); reply.className = "ai-message"; reply.textContent = answer; messages.append(reply); messages.scrollTop = messages.scrollHeight;
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
