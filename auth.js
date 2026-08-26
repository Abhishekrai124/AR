const authStatus = document.querySelector("#authStatus");
const loginButton = document.querySelector("#loginButton");
const signupButton = document.querySelector("#signupButton");
const communityButton = document.querySelector("#communityButton");

function showStatus(message, type = "") {
  authStatus.textContent = message;
  authStatus.className = `auth-status ${type}`;
}

window.arraiAuth
  .then(({ isAuthenticated, user }) => {
    if (isAuthenticated) {
      showStatus(`You are signed in as ${user.name || user.email}.`, "success");
      loginButton.hidden = true;
      signupButton.hidden = true;
      communityButton.hidden = false;
      return;
    }
    showStatus("Continue securely with Auth0 to access your profile.");
  })
  .catch(() => {
    showStatus("Authentication could not start. Please try again shortly.", "error");
  });

loginButton.addEventListener("click", () => window.loginWithAuth0());
signupButton.addEventListener("click", () => window.loginWithAuth0(true));
