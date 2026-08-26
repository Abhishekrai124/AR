const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const authStatus = document.querySelector("#authStatus");
const authTabs = document.querySelectorAll("[data-auth-mode]");

function showStatus(message, type) {
  authStatus.textContent = message;
  authStatus.className = `auth-status ${type}`;
}

function setMode(mode) {
  const isLogin = mode === "login";
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  authTabs.forEach((tab) => {
    const isActive = tab.dataset.authMode === mode;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive);
  });
  showStatus("", "");
}

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.authMode));
});

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const details = new FormData(registerForm);
  const account = { name: details.get("name").trim(), email: details.get("email").trim().toLowerCase() };
  localStorage.setItem("arraiAccount", JSON.stringify(account));
  localStorage.setItem("arraiChessUser", account.name);
  registerForm.reset();
  showStatus(`Welcome, ${account.name}. Your local profile is ready.`, "success");
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const account = JSON.parse(localStorage.getItem("arraiAccount") || "null");
  const email = new FormData(loginForm).get("email").trim().toLowerCase();
  if (!account || account.email !== email) {
    showStatus("No matching local profile found. Please register first.", "error");
    return;
  }
  localStorage.setItem("arraiChessUser", account.name);
  loginForm.reset();
  showStatus(`Welcome back, ${account.name}.`, "success");
});
