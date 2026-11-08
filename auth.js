const authStatus = document.querySelector("#authStatus");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const switchAuth = document.querySelector("#switchAuth");
const switchPromptText = document.querySelector("#switchPromptText");
const authSwitchPrompt = document.querySelector("#authSwitchPrompt");
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
const oauthProviders = document.querySelector("#oauthProviders");

const requestedPage = new URLSearchParams(window.location.search).get("next");
const nextPage = requestedPage === "chess" ? "chess.html" : requestedPage === "owner" ? "owner.html" : "community.html";
const authReturn = nextPage === "community.html" ? "" : `?next=${nextPage === "chess.html" ? "chess" : "owner"}`;

function showStatus(message, type = "") {
  if (!authStatus) return;
  authStatus.textContent = message;
  authStatus.className = `auth-status ${type}`;
}

// Single-form mode switcher (Sign In vs Create Account)
function setAuthMode(mode) {
  const isLogin = mode === "login";

  if (loginForm) {
    loginForm.style.display = isLogin ? "grid" : "none";
    loginForm.hidden = !isLogin;
  }
  if (signupForm) {
    signupForm.style.display = isLogin ? "none" : "grid";
    signupForm.hidden = isLogin;
  }

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
      ? "Sign in to your account, manage your portfolio, and connect with the community."
      : "Create your Arrai profile to explore, build, and connect.";
  }
  if (switchPromptText) {
    switchPromptText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
  }
  if (switchAuth) {
    switchAuth.textContent = isLogin ? "Create Account" : "Sign In";
  }
}

// Set initial mode to login
setAuthMode("login");

if (tabLogin) tabLogin.addEventListener("click", () => setAuthMode("login"));
if (tabSignup) tabSignup.addEventListener("click", () => setAuthMode("signup"));

if (switchAuth) {
  switchAuth.addEventListener("click", () => {
    const isCurrentlyLogin = loginForm && loginForm.style.display !== "none" && !loginForm.hidden;
    setAuthMode(isCurrentlyLogin ? "signup" : "login");
  });
}

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

    if (settings?.external && oauthProviders) {
      googleButton.hidden = isAuthenticated || settings.external.google !== true;
      for (const [provider, enabled] of Object.entries(settings.external)) {
        if (!enabled || ["email", "phone", "anonymous_users", "google"].includes(provider)) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button auth-provider-btn";
        button.textContent = `Continue with ${providerLabels[provider] || provider.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}`;
        button.addEventListener("click", async () => {
          const { error } = await window.arraiSupabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: `${window.location.origin}/auth.html${authReturn}` },
          });
          if (error) showStatus(error.message, "error");
        });
        oauthProviders.append(button);
      }
    }

    if (isAuthenticated) {
      showStatus(`You are signed in as ${user.name || user.email}.`, "success");
      if (loginForm) { loginForm.style.display = "none"; loginForm.hidden = true; }
      if (signupForm) { signupForm.style.display = "none"; signupForm.hidden = true; }
      if (authTabs) authTabs.hidden = true;
      if (authDivider) authDivider.hidden = true;
      if (authSocialRow) authSocialRow.hidden = true;
      if (authSwitchPrompt) authSwitchPrompt.hidden = true;

      // Add a clean Continue & Logout button
      const actionsDiv = document.createElement("div");
      actionsDiv.style.display = "grid";
      actionsDiv.style.gap = "10px";
      actionsDiv.style.marginTop = "14px";

      const continueBtn = document.createElement("a");
      continueBtn.className = "button primary auth-submit";
      continueBtn.href = nextPage;
      continueBtn.innerHTML = "Continue to Dashboard <b>↗</b>";

      const logoutBtn = document.createElement("button");
      logoutBtn.className = "button auth-provider-btn";
      logoutBtn.type = "button";
      logoutBtn.textContent = "Sign Out";
      logoutBtn.addEventListener("click", () => window.logout());

      actionsDiv.append(continueBtn, logoutBtn);
      authStatus.after(actionsDiv);
      return;
    }

    showStatus("Continue with email, Google, or your Web3 wallet.");
  })
  .catch(() => {
    showStatus("Authentication could not start. Please try again shortly.", "error");
  });

// Magic Link
if (magicLinkButton) {
  magicLinkButton.addEventListener("click", async () => {
    const isLoginActive = loginForm && loginForm.style.display !== "none" && !loginForm.hidden;
    const activeForm = isLoginActive ? loginForm : signupForm;
    const emailInput = activeForm?.elements?.email;
    if (!emailInput || !emailInput.reportValidity()) return;

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
}

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

// Email/Password Login
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(loginForm);
    const email = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "").trim();
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Signing in…"; }

    try {
      const { error } = await window.arraiSupabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        const errMsg = error.message || "Invalid email or password.";
        if (errMsg.toLowerCase().includes("captcha")) {
          return showStatus("Supabase bot protection blocked sign-in. Sign in with Google or Web3 Wallet, or disable Captcha in Supabase Dashboard (Auth → Bot Protection).", "error");
        }
        return showStatus(errMsg, "error");
      }
      showStatus("Signed in successfully! Redirecting…", "success");
      window.location.assign(nextPage);
    } catch (err) {
      showStatus(err.message || "Sign in failed.", "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = "Sign In <b>↗</b>"; }
    }
  });
}

// Email/Password Signup (with Captcha Bypass through Serverless Admin API)
if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(signupForm);
    const email = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "").trim();
    const name = String(values.get("name") || "").trim();

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Creating profile…"; }

    try {
      // 1. Try serverless signup first (bypasses Turnstile captcha using Supabase Admin API)
      let adminSignupOk = false;
      try {
        const resp = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await resp.json();
        if (resp.ok && data.ok) {
          adminSignupOk = true;
        } else if (resp.status === 400 || (resp.status >= 401 && resp.status < 500 && resp.status !== 503)) {
          return showStatus(data.error || "Signup error.", "error");
        }
      } catch (e) {
        console.warn("Serverless signup endpoint not reached, falling back to client-side:", e);
      }

      if (adminSignupOk) {
        showStatus("Account created! Signing you in…", "success");
        const { error: loginErr } = await window.arraiSupabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!loginErr) {
          showStatus("Signed in successfully! Redirecting…", "success");
          setTimeout(() => window.location.assign(nextPage), 800);
          return;
        }
        showStatus("Account created! Please sign in with your password.", "success");
        setTimeout(() => setAuthMode("login"), 1500);
        return;
      }

      // 2. Client-side fallback via Supabase SDK
      const { data: signUpData, error: signUpErr } = await window.arraiSupabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, display_name: name },
          emailRedirectTo: `${window.location.origin}/auth.html${authReturn}`,
        },
      });

      if (signUpErr) {
        const errMsg = signUpErr.message || "";
        if (errMsg.toLowerCase().includes("captcha")) {
          return showStatus(
            "Supabase Bot Protection is active. Please sign in with Google or Web3 Wallet, or disable Captcha in Supabase Dashboard (Auth → Bot Protection).",
            "error"
          );
        }
        return showStatus(errMsg, "error");
      }

      if (signUpData?.session) {
        showStatus("Account created and signed in! Redirecting…", "success");
        setTimeout(() => window.location.assign(nextPage), 900);
        return;
      }

      showStatus("Account created! Please check your email to confirm, then sign in.", "success");
      setTimeout(() => setAuthMode("login"), 2500);
    } catch (err) {
      showStatus(err.message || "Could not complete account creation.", "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = "Create Account <b>✦</b>"; }
    }
  });
}

// Google OAuth
if (googleButton) {
  googleButton.addEventListener("click", async () => {
    const { error } = await window.arraiSupabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth.html${authReturn}` },
    });
    if (error) showStatus(error.message, "error");
  });
}
