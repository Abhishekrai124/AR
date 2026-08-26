const auth0Config = {
  domain: "dev-ebtf7ivbthpezgtd.us.auth0.com",
  clientId: "obJXEM4UYskV4uvzsISavnje8yIG38JA",
};

async function startAuth0() {
  const client = await auth0.createAuth0Client({
    ...auth0Config,
    authorizationParams: {
      redirect_uri: `${window.location.origin}/auth.html`,
    },
  });

  const query = new URLSearchParams(window.location.search);
  if (query.has("code") && query.has("state")) {
    await client.handleRedirectCallback();
    window.history.replaceState({}, document.title, "auth.html");
  }

  const isAuthenticated = await client.isAuthenticated();
  const user = isAuthenticated ? await client.getUser() : null;
  if (user) {
    localStorage.setItem("arraiChessUser", user.name || user.nickname || user.email);
  }

  window.auth0Client = client;
  return { client, isAuthenticated, user };
}

window.arraiAuth = startAuth0();
window.loginWithAuth0 = async (signup = false) => {
  const { client } = await window.arraiAuth;
  return client.loginWithRedirect({
    authorizationParams: signup ? { screen_hint: "signup" } : {},
  });
};
window.logoutWithAuth0 = async () => {
  const { client } = await window.arraiAuth;
  return client.logout({
    logoutParams: { returnTo: window.location.origin },
  });
};
