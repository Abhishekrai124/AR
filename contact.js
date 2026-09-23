const escapeContact = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));

const loadPersonalContact = async () => {
  const panel = document.querySelector("#personalContact");
  const status = document.querySelector("#personalContactStatus");
  if (!panel || !status || !window.arraiAuth) return;
  const auth = await window.arraiAuth;
  if (!auth.isAuthenticated) return;
  try {
    const { data: settings, error: settingsError } = await window.arraiSupabase.from("site_settings").select("show_personal_contact").eq("id", "global").maybeSingle();
    if (settingsError) throw settingsError;
    if (settings?.show_personal_contact !== true) {
      status.textContent = "The private contact drawer is taking a tiny nap right now.";
      return;
    }
    const session = await window.arraiSupabase.auth.getSession();
    const response = await fetch("/api/contact", { headers: { Authorization: `Bearer ${session.data.session?.access_token || ""}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The private contact drawer got shy. Try again in a moment.");
    const phoneLinks = data.phones.map((phone) => `<a href="tel:${encodeURIComponent(phone)}">${escapeContact(phone)}</a>`).join("<br />");
    panel.innerHTML = `<p class="eyebrow">Personal contact · signed in</p><p><a href="mailto:${escapeContact(data.email)}">${escapeContact(data.email)}</a><br /><small>Personal email</small></p><p>${phoneLinks}<br /><small>Personal mobile</small></p>`;
    panel.hidden = false;
    status.remove();
  } catch (error) {
    status.textContent = error.message;
  }
};

loadPersonalContact();
