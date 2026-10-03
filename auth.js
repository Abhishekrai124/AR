const authStatus = document.querySelector("#authStatus");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const switchAuth = document.querySelector("#switchAuth");
const googleButton = document.querySelector("#googleButton");
const communityButton = document.querySelector("#communityButton");
const authParams = new URLSearchParams(window.location.search);
const requestedPage = authParams.get("next");
const requestToken =
  requestedPage === "payments" &&
  /^[A-Za-z0-9_-]{24,64}$/.test(authParams.get("request") || "")
    ? authParams.get("request")
    : "";
const nextPage =
  requestedPage === "chess"
    ? "chess.html"
    : requestedPage === "owner"
      ? "owner.html"
      : requestedPage === "payments"
        ? "payments.html"
        : "community.html";
const destination =
  nextPage === "payments.html" && requestToken
    ? `${nextPage}?request=${encodeURIComponent(requestToken)}`
    : nextPage;
const authReturn =
  nextPage === "community.html"
    ? ""
    : `?next=${nextPage === "chess.html" ? "chess" : nextPage === "owner.html" ? "owner" : "payments"}${requestToken ? `&request=${encodeURIComponent(requestToken)}` : ""}`;

function showStatus(message, type = "") {
  authStatus.textContent = message;
  authStatus.className = `auth-status ${type}`;
}

window.arraiAuth
  .then(({ isAuthenticated, user }) => {
    if (isAuthenticated) {
      if (requestedPage && nextPage !== "community.html") {
        window.location.replace(destination);
        return;
      }
      showStatus(`You are signed in as ${user.name || user.email}.`, "success");
      loginForm.hidden = true;
      signupForm.hidden = true;
      switchAuth.hidden = true;
      googleButton.hidden = true;
      communityButton.hidden = false;
      communityButton.href = "#";
      const isOwner = user?.email?.toLowerCase() === "abhishekrai6897@gmail.com";
      communityButton.textContent = isOwner ? "Open Owner Studio" : "Logout";
      communityButton.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          if (isOwner) window.location.assign("owner.html");
          else window.logout();
        },
        { once: true },
      );
      return;
    }
    showStatus("Continue securely with email and password or Google.");
  })
  .catch(() => {
    showStatus(
      "Authentication could not start. Please try again shortly.",
      "error",
    );
  });

switchAuth.addEventListener("click", () => {
  const signingUp = signupForm.hidden;
  signupForm.hidden = !signingUp;
  loginForm.hidden = signingUp;
  switchAuth.textContent = signingUp
    ? "I already have an account"
    : "Create a new account";
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(loginForm);
  const { error } = await window.arraiSupabase.auth.signInWithPassword({
    email: values.get("email"),
    password: values.get("password"),
  });
  if (error) return showStatus(error.message, "error");
  window.location.assign(destination);
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(signupForm);
  const { error } = await window.arraiSupabase.auth.signUp({
    email: values.get("email"),
    password: values.get("password"),
    options: {
      data: { full_name: values.get("name") },
      emailRedirectTo: `${window.location.origin}/auth.html${authReturn}`,
    },
  });
  if (error) return showStatus(error.message, "error");
  showStatus(
    "Account created. Check your email to confirm it, then log in.",
    "success",
  );
});

googleButton.addEventListener("click", async () => {
  const { error } = await window.arraiSupabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth.html${authReturn}` },
  });
  if (error) showStatus(error.message, "error");
});
