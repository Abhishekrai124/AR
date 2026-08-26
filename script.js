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
