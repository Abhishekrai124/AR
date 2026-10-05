const authStatus = document.querySelector("#authStatus");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const switchAuth = document.querySelector("#switchAuth");
const googleButton = document.querySelector("#googleButton");
const communityButton = document.querySelector("#communityButton");
const resetPasswordButton = document.querySelector("#resetPasswordButton");
const resetForm = document.querySelector("#resetForm");
const authParams = new URLSearchParams(window.location.search);
const requestedPage = authParams.get("next");
const isPasswordReset = authParams.get("reset") === "1";
const nextPage =
  requestedPage === "membership"
    ? "membership.html?checkout=1"
    : requestedPage === "chess"
      ? "chess.html"
      : requestedPage === "owner"
        ? "owner.html"
        : requestedPage === "admin"
          ? "admin.html"
          : requestedPage === "family"
            ? "family.html"
            : requestedPage === "founder"
              ? "/founder.html"
              : "community.html";
const authReturn =
  nextPage === "community.html"
    ? ""
    : `?next=${
        requestedPage === "membership"
          ? "membership"
          : nextPage === "chess.html"
            ? "chess"
            : requestedPage === "admin"
              ? "admin"
              : requestedPage === "family"
                ? "family"
                : requestedPage === "founder"
                  ? "founder"
                  : "owner"
      }`;

function showStatus(message, type = "") {
  authStatus.textContent = message;
  authStatus.className = `auth-status ${type}`;
}

window.arraiAuth
  .then(({ isAuthenticated, user }) => {
    if (isPasswordReset) {
      loginForm.hidden = true;
      signupForm.hidden = true;
      resetForm.hidden = false;
      switchAuth.hidden = true;
      googleButton.hidden = true;
      resetPasswordButton.hidden = true;
      communityButton.hidden = true;
      showStatus("Choose a new password for your account.");
      return;
    }
    if (isAuthenticated) {
      if (requestedPage && nextPage !== "community.html") {
        window.location.replace(nextPage);
        return;
      }
      showStatus(`You are signed in as ${user.name || user.email}.`, "success");
      loginForm.hidden = true;
      signupForm.hidden = true;
      switchAuth.hidden = true;
      googleButton.hidden = true;
      resetPasswordButton.hidden = true;
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
    resetPasswordButton.hidden = false;
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
  resetPasswordButton.hidden = signingUp;
  switchAuth.textContent = signingUp
    ? "I already have an account"
    : "Create a new account";
});

const installPasswordVisibility = (form) => {
  form.querySelectorAll('input[type="password"]').forEach((input) => {
    const field = document.createElement("span");
    field.className = "auth-password-field";
    const toggle = document.createElement("button");
    toggle.className = "auth-password-toggle";
    toggle.type = "button";
    toggle.textContent = "Show";
    toggle.setAttribute("aria-label", "Show password");
    toggle.addEventListener("click", () => {
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      toggle.textContent = reveal ? "Hide" : "Show";
      toggle.setAttribute("aria-label", `${reveal ? "Hide" : "Show"} password`);
    });
    input.replaceWith(field);
    field.append(input, toggle);
  });
};
installPasswordVisibility(loginForm);
installPasswordVisibility(signupForm);
installPasswordVisibility(resetForm);

resetPasswordButton.addEventListener("click", async () => {
  const email = loginForm.elements.namedItem("email").value.trim();
  if (!email) {
    showStatus("Enter your email above first, and I’ll send a quiet reset link.", "error");
    loginForm.elements.namedItem("email").focus();
    return;
  }
  resetPasswordButton.disabled = true;
  try {
    const { error } = await window.arraiSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth.html?reset=1`,
    });
    if (error) throw error;
    showStatus("If that email has an account, a password-reset link is on its way. Check your inbox.", "success");
  } catch (error) {
    showStatus(error.message || "The password-reset link could not be sent.", "error");
  } finally {
    resetPasswordButton.disabled = false;
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(loginForm);
  const submit = loginForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const { error } = await window.arraiSupabase.auth.signInWithPassword({
      email: values.get("email"),
      password: values.get("password"),
    });
    if (error) throw error;
    window.location.assign(nextPage);
  } catch (error) {
    showStatus(error.message || "Sign in could not be completed.", "error");
  } finally {
    submit.disabled = false;
  }
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = resetForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const password = new FormData(resetForm).get("password");
    const { error } = await window.arraiSupabase.auth.updateUser({ password });
    if (error) throw error;
    showStatus("Password changed. You’re safely back in your ARRAI world.", "success");
    resetForm.hidden = true;
    communityButton.hidden = false;
    communityButton.href = nextPage;
    communityButton.textContent = "Continue ↗";
  } catch (error) {
    showStatus(error.message || "The password could not be changed.", "error");
  } finally {
    submit.disabled = false;
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(signupForm);
  const submit = signupForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const { error } = await window.arraiSupabase.auth.signUp({
      email: values.get("email"),
      password: values.get("password"),
      options: {
        data: { full_name: values.get("name") },
        emailRedirectTo: `${window.location.origin}/auth.html${authReturn}`,
      },
    });
    if (error) throw error;
    showStatus(
      "Account created. Check your email to confirm it, then log in.",
      "success",
    );
  } catch (error) {
    showStatus(error.message || "Account creation could not be completed.", "error");
  } finally {
    submit.disabled = false;
  }
});

googleButton.addEventListener("click", async () => {
  googleButton.disabled = true;
  try {
    const { error } = await window.arraiSupabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth.html${authReturn}` },
    });
    if (error) throw error;
  } catch (error) {
    showStatus(error.message || "Google sign in could not be opened.", "error");
  } finally {
    googleButton.disabled = false;
  }
});
