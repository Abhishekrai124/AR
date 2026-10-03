const authStatus = document.querySelector("#authStatus");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const switchAuth = document.querySelector("#switchAuth");
const googleButton = document.querySelector("#googleButton");
const communityButton = document.querySelector("#communityButton");
const requestedPage = new URLSearchParams(window.location.search).get("next");
const nextPage =
  requestedPage === "chess"
    ? "chess.html"
    : requestedPage === "owner"
      ? "owner.html"
      : "community.html";
const authReturn =
  nextPage === "community.html"
    ? ""
    : `?next=${nextPage === "chess.html" ? "chess" : "owner"}`;

function showStatus(message, type = "") {
  authStatus.textContent = message;
  authStatus.className = `auth-status ${type}`;
}

window.arraiAuth
  .then(({ isAuthenticated, user, profileUnavailable }) => {
    if (isAuthenticated) {
      showStatus(
        profileUnavailable
          ? `You are signed in as ${user.name || user.email}. Wallet profile setup is pending schema availability.`
          : `You are signed in as ${user.name || user.email}.`,
        profileUnavailable ? "" : "success",
      );
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
  if (error) {
    const message = /invalid|credentials|password|email/i.test(error.message || "")
      ? "Invalid email or password. If you already have an account, use Login instead of creating another one."
      : error.message || "Sign-in could not be completed.";
    return showStatus(message, "error");
  }
  await window.ensureArraiProfile();
  window.location.assign(nextPage);
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
  if (error) {
    const message = /already registered|already exists|user already/i.test(error.message || "")
      ? "An account already exists for these credentials. Switch to Login to use the existing account."
      : /rate limit|confirm|weak password/i.test(error.message || "")
        ? error.message
        : "Account creation could not be completed.";
    return showStatus(message, "error");
  }
  showStatus(
    "Account created. Check your email to confirm it, then log in. Your ARRAI Pay wallet uses this same Supabase user ID.",
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
