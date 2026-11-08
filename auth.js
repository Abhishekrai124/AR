const authStatus = document.querySelector("#authStatus");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const switchAuth = document.querySelector("#switchAuth");
const tabLogin = document.querySelector("#tabLogin");
const tabSignup = document.querySelector("#tabSignup");
const authTitle = document.querySelector("#authTitle");
const authSubtitle = document.querySelector("#authSubtitle");
const authTabs = document.querySelector("#authTabs");
const authDivider = document.querySelector("#authDivider");
const authSocialRow = document.querySelector("#authSocialRow");
const googleButton = document.querySelector("#googleButton");
const web3Button = document.querySelector("#web3Button");
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

// Mode Switcher (Sign In vs Create Account)
function setAuthMode(mode) {
  const isLogin = mode === "login";
  loginForm.hidden = !isLogin;
  signupForm.hidden = isLogin;

  if (tabLogin && tabSignup) {
    tabLogin.classList.toggle("active", isLogin);
    tabSignup.classList.toggle("active", !isLogin);
    tabLogin.setAttribute("aria-selected", isLogin ? "true" : "false");
    tabSignup.setAttribute("aria-selected", !isLogin ? "true" : "false");
  }

  if (authTitle) {
    authTitle.innerHTML = isLogin ? 'Welcome <em>in.</em>' : 'Join the <em>Studio.</em>';
  }
  if (authSubtitle) {
    authSubtitle.textContent = isLogin
      ? "Sign in to access your projects, profile & community."
      : "Create your Arrai profile to explore, build, and connect.";
  }
  if (switchAuth) {
    switchAuth.textContent = isLogin ? "Create a new account" : "I already have an account";
  }
}

if (tabLogin) tabLogin.addEventListener("click", () => setAuthMode("login"));
if (tabSignup) tabSignup.addEventListener("click", () => setAuthMode("signup"));

// Password eye toggles
document.querySelectorAll(".toggle-password").forEach((toggleBtn) => {
  toggleBtn.addEventListener("click", () => {
    const input = toggleBtn.parentElement.querySelector("input");
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    toggleBtn.textContent = isPassword ? "🙈" : "👁️";
  });
});

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
      if (switchAuth) switchAuth.hidden = !emailEnabled;
      magicLinkButton.hidden = !emailEnabled;
      googleButton.hidden = isAuthenticated || settings.external.google !== true;
      for (const [provider, enabled] of Object.entries(settings.external)) {
        if (!enabled || ["email", "phone", "anonymous_users", "google"].includes(provider)) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button auth-provider-btn";
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
      if (authTabs) authTabs.hidden = true;
      if (authDivider) authDivider.hidden = true;
      if (authSocialRow) authSocialRow.hidden = true;
      if (switchAuth) switchAuth.hidden = true;
      googleButton.hidden = true;
      magicLinkButton.hidden = true;
      if (web3Button) web3Button.hidden = true;
      communityButton.hidden = false;
      communityButton.href = "#";
      communityButton.textContent = "Logout ↗";
      communityButton.addEventListener("click", (event) => {
        event.preventDefault();
        window.logout();
      }, { once: true });
      return;
    }
    showStatus("Continue with email, Google, or your Web3 wallet.");
  })
  .catch(() => {
    showStatus("Authentication could not start. Please try again shortly.", "error");
  });

if (switchAuth) {
  switchAuth.addEventListener("click", () => {
    const isCurrentlyLogin = !loginForm.hidden;
    setAuthMode(isCurrentlyLogin ? "signup" : "login");
  });
}

// Magic Link
magicLinkButton.addEventListener("click", async () => {
  const activeForm = signupForm.hidden ? loginForm : signupForm;
  const emailInput = activeForm.elements.email;
  if (!emailInput.reportValidity()) return;
  magicLinkButton.disabled = true;
  magicLinkButton.textContent = "Sending link…";
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
    magicLinkButton.innerHTML = `<svg class="provider-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg><span>Magic Link</span>`;
  }
});

// Web3 Wallet Sign-in
if (web3Button) {
  web3Button.addEventListener("click", async () => {
    if (typeof window.ethereum === "undefined") {
      showStatus("No Web3 wallet found. Please install MetaMask, Coinbase Wallet, or Phantom.", "error");
      return;
    }
    try {
      web3Button.disabled = true;
      showStatus("Connecting to your Web3 wallet…");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0];
      if (!address) throw new Error("No wallet account selected.");

      const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
      showStatus(`Requesting authentication signature for ${shortAddress}…`);

      const message = `Welcome to arrai.in!\n\nSign in with Web3 Wallet:\nAddress: ${address}\nTimestamp: ${Date.now()}`;
      await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });

      showStatus(`Wallet authenticated (${shortAddress})! Redirecting…`, "success");
      setTimeout(() => {
        window.location.assign(nextPage);
      }, 1000);
    } catch (err) {
      showStatus(err.message || "Web3 authentication failed.", "error");
    } finally {
      web3Button.disabled = false;
    }
  });
}

// Passkey handlers
passkeyButton.addEventListener("click", async () => {
  passkeyButton.disabled = true;
  passkeyButton.textContent = "Waiting for passkey…";
  try {
    const { error } = await window.arraiSupabase.auth.signInWithPasskey();
    if (error) throw error;
    window.location.assign(nextPage);
  } catch (error) {
    showStatus(error.message || "Passkey sign-in could not be completed.", "error");
  } finally {
    passkeyButton.disabled = false;
    passkeyButton.textContent = "🔑 Sign in with Passkey";
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
    registerPasskeyButton.textContent = "⚙️ Set up a Passkey";
  }
});

// Email/Password Login
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(loginForm);
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Signing in…"; }
  try {
    const { error } = await window.arraiSupabase.auth.signInWithPassword({
      email: values.get("email"),
      password: values.get("password"),
    });
    if (error) return showStatus(error.message, "error");
    showStatus("Signed in successfully! Redirecting…", "success");
    window.location.assign(nextPage);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = "Sign In <b>↗</b>"; }
  }
});

// Email/Password Signup
signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(signupForm);
  const submitBtn = signupForm.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Creating profile…"; }
  try {
    const { error } = await window.arraiSupabase.auth.signUp({
      email: values.get("email"),
      password: values.get("password"),
      options: {
        data: { full_name: values.get("name") },
        emailRedirectTo: `${window.location.origin}/auth.html${authReturn}`,
      },
    });
    if (error) return showStatus(error.message, "error");
    showStatus("Account created! Please check your email to confirm, then sign in.", "success");
    setTimeout(() => setAuthMode("login"), 2000);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = "Create Account <b>✦</b>"; }
  }
});

// Google OAuth
googleButton.addEventListener("click", async () => {
  const { error } = await window.arraiSupabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth.html${authReturn}` },
  });
  if (error) showStatus(error.message, "error");
});
