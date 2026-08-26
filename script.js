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
