const authStatus = document.querySelector("#authStatus");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const switchAuth = document.querySelector("#switchAuth");
const googleButton = document.querySelector("#googleButton");
const communityButton = document.querySelector("#communityButton");
const requestedPage = new URLSearchParams(window.location.search).get("next");
const nextPage = requestedPage === "chess" ? "chess.html" : requestedPage === "owner" ? "owner.html" : "community.html";
const authReturn = nextPage === "community.html" ? "" : `?next=${nextPage === "chess.html" ? "chess" : "owner"}`;

function showStatus(message, type = "") {
  authStatus.textContent = message;
  authStatus.className = `auth-status ${type}`;
}

window.arraiAuth
  .then(({ isAuthenticated, user }) => {
    if (isAuthenticated) {
      showStatus(`You are signed in as ${user.name || user.email}.`, "success");
      loginForm.hidden = true;
      signupForm.hidden = true;
      switchAuth.hidden = true;
      googleButton.hidden = true;
      communityButton.hidden = false;
      communityButton.href = nextPage;
      communityButton.innerHTML = nextPage === "chess.html" ? "Open chess <b>♟</b>" : "Open community <b>↗</b>";
      return;
    }
    showStatus("Continue securely with email and password or Google.");
  })
  .catch(() => {
    showStatus("Authentication could not start. Please try again shortly.", "error");
  });

switchAuth.addEventListener("click", () => {
  const signingUp = signupForm.hidden;
  signupForm.hidden = !signingUp;
  loginForm.hidden = signingUp;
  switchAuth.textContent = signingUp ? "I already have an account" : "Create a new account";
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(loginForm);
  const { error } = await window.arraiSupabase.auth.signInWithPassword({ email: values.get("email"), password: values.get("password") });
  if (error) return showStatus(error.message, "error");
  window.location.assign(nextPage);
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(signupForm);
  const { error } = await window.arraiSupabase.auth.signUp({ email: values.get("email"), password: values.get("password"), options: { data: { full_name: values.get("name") }, emailRedirectTo: `${window.location.origin}/auth.html${authReturn}` } });
  if (error) return showStatus(error.message, "error");
  showStatus("Account created. Check your email to confirm it, then log in.", "success");
});

googleButton.addEventListener("click", async () => {
  const { error } = await window.arraiSupabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth.html${authReturn}` } });
  if (error) showStatus(error.message, "error");
});
