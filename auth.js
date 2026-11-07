const authStatus = document.querySelector("#authStatus");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const switchAuth = document.querySelector("#switchAuth");
const googleButton = document.querySelector("#googleButton");
const magicLinkButton = document.querySelector("#magicLinkButton");
const passkeyButton = document.querySelector("#passkeyButton");
const registerPasskeyButton = document.querySelector("#registerPasskeyButton");
const oauthProviders = document.querySelector("#oauthProviders");
const communityButton = document.querySelector("#communityButton");
const requestedPage = new URLSearchParams(window.location.search).get("next");
const nextPage = requestedPage === "chess" ? "chess.html" : requestedPage === "owner" ? "owner.html" : "community.html";
const authReturn = nextPage === "community.html" ? "" : `?next=${nextPage === "chess.html" ? "chess" : "owner"}`;

function showStatus(message, type = "") {
  authStatus.textContent = message;
  authStatus.className = `auth-status ${type}`;
}

const supportsPasskeys = () => Boolean(window.isSecureContext && window.PublicKeyCredential && window.arraiSupabase.auth.signInWithPasskey && window.arraiSupabase.auth.registerPasskey);
const providerLabels = {
  apple: "Apple", azure: "Microsoft", bitbucket: "Bitbucket", discord: "Discord",
  facebook: "Facebook", figma: "Figma", fly: "Fly.io", github: "GitHub",
  gitlab: "GitLab", kakao: "Kakao", keycloak: "Keycloak",
  linkedin: "LinkedIn", linkedin_oidc: "LinkedIn", notion: "Notion",
  snapchat: "Snapchat", spotify: "Spotify", slack: "Slack", slack_oidc: "Slack",
  twitch: "Twitch", twitter: "X", workos: "WorkOS", zoom: "Zoom",
};

window.arraiAuth
  .then(async ({ isAuthenticated, user }) => {
    let settings = null;
    try { settings = await window.arraiGetAuthSettings(); }
    catch (error) { console.error("Supabase auth options could not be loaded:", error); }
    if (settings?.external) {
      const emailEnabled = settings.external.email === true;
      loginForm.hidden = !emailEnabled;
      signupForm.hidden = true;
      switchAuth.hidden = !emailEnabled;
      magicLinkButton.hidden = !emailEnabled;
      googleButton.hidden = isAuthenticated || settings.external.google !== true;
      for (const [provider, enabled] of Object.entries(settings.external)) {
        if (!enabled || ["email", "phone", "anonymous_users", "google"].includes(provider)) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button";
        button.textContent = `Continue with ${providerLabels[provider] || provider.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}`;
        button.addEventListener("click", async () => {
          const { error } = await window.arraiSupabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth.html${authReturn}` } });
          if (error) showStatus(error.message, "error");
        });
        oauthProviders.append(button);
      }
    }
    const passkeysEnabled = settings?.passkeys_enabled === true && supportsPasskeys();
    passkeyButton.hidden = isAuthenticated || !passkeysEnabled;
    registerPasskeyButton.hidden = !isAuthenticated || !passkeysEnabled;
    if (isAuthenticated) {
      showStatus(`You are signed in as ${user.name || user.email}.`, "success");
      loginForm.hidden = true;
      signupForm.hidden = true;
      switchAuth.hidden = true;
      googleButton.hidden = true;
      magicLinkButton.hidden = true;
      communityButton.hidden = false;
      communityButton.href = "#";
      communityButton.textContent = "Logout";
      communityButton.addEventListener("click", (event) => {
        event.preventDefault();
        window.logout();
      }, { once: true });
      return;
    }
    showStatus("Continue with email, a sign-in link, or any social provider enabled in Supabase.");
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

magicLinkButton.addEventListener("click", async () => {
  const activeForm = signupForm.hidden ? loginForm : signupForm;
  const emailInput = activeForm.elements.email;
  if (!emailInput.reportValidity()) return;
  magicLinkButton.disabled = true;
  magicLinkButton.textContent = "Sending sign-in link…";
  try {
    const { error } = await window.arraiSupabase.auth.signInWithOtp({
      email: emailInput.value.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth.html${authReturn}`,
      },
    });
    if (error) throw error;
    showStatus("If that email belongs to an account, a sign-in link is on its way.", "success");
  } catch (error) {
    showStatus(error.message || "The sign-in link could not be sent.", "error");
  } finally {
    magicLinkButton.disabled = false;
    magicLinkButton.textContent = "Email me a sign-in link";
  }
});

passkeyButton.addEventListener("click", async () => {
  passkeyButton.disabled = true;
  passkeyButton.textContent = "Waiting for your passkey…";
  try {
    const { error } = await window.arraiSupabase.auth.signInWithPasskey();
    if (error) throw error;
    window.location.assign(nextPage);
  } catch (error) {
    showStatus(error.message || "Passkey sign-in could not be completed.", "error");
  } finally {
    passkeyButton.disabled = false;
    passkeyButton.textContent = "Sign in with a passkey";
  }
});

registerPasskeyButton.addEventListener("click", async () => {
  registerPasskeyButton.disabled = true;
  registerPasskeyButton.textContent = "Setting up passkey…";
  try {
    const { error } = await window.arraiSupabase.auth.registerPasskey();
    if (error) throw error;
    showStatus("Passkey set up on this device. You can use it the next time you sign in.", "success");
  } catch (error) {
    showStatus(error.message || "Passkey setup could not be completed.", "error");
  } finally {
    registerPasskeyButton.disabled = false;
    registerPasskeyButton.textContent = "Set up a passkey";
  }
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
