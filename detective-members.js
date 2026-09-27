const memberLoginForm = document.querySelector("#memberLoginForm");
const memberSignupForm = document.querySelector("#memberSignupForm");
const applicationResumeForm = document.querySelector("#applicationResumeForm");
const memberApplicationForm = document.querySelector("#memberApplicationForm");
const memberDashboard = document.querySelector("#memberDashboard");
const assignedCases = document.querySelector("#assignedCases");
const loginStatus = document.querySelector("#memberLoginStatus");
const signupStatus = document.querySelector("#memberSignupStatus");
const applicationStatus = document.querySelector("#applicationStatus");
let memberToken = "";
let verifiedMemberId = "";

const memberEscape = (value) =>
  String(value || "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );

const memberRequest = async (action, payload = {}) => {
  const response = await fetch("/api/detective-member", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${memberToken}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Member request failed.");
  return result;
};

const setMemberStatus = (element, message) => {
  if (element) element.textContent = message;
};

const showApplicationState = async (user) => {
  memberToken = (await window.arraiSupabase.auth.getSession()).data.session?.access_token || "";
  const result = await memberRequest("application-status");
  if (result.application?.status === "pending") {
    memberApplicationForm.hidden = true;
    setMemberStatus(applicationStatus, "Application received and awaiting owner review. It does not grant detective access; the owner-issued member ID is still required.");
    return;
  }
  if (result.application?.status === "approved" || result.application?.status === "suspended") {
    memberApplicationForm.hidden = true;
    setMemberStatus(applicationStatus, result.application.status === "approved"
      ? "Application approved. Log out here, then use Member login with your owner-issued member ID."
      : "Membership is currently suspended. Contact the agency owner.");
    return;
  }
  memberApplicationForm.hidden = false;
  document.querySelector("#applicationAccountLabel").textContent = `Private application for ${user.email}. Your application and photo are visible only to the verified owner.`;
  memberApplicationForm.elements.fullName.value = user.user_metadata?.full_name || "";
  setMemberStatus(applicationStatus, "Complete the private investigator profile below. No member ID is needed to apply.");
};

const readPhoto = (file) => new Promise((resolve, reject) => {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2_000_000) {
    reject(new Error("Choose a JPG, PNG or WebP photo no larger than 2 MB."));
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => resolve(reader.result));
  reader.addEventListener("error", () => reject(new Error("The profile photo could not be read.")));
  reader.readAsDataURL(file);
});

const specialtySelect = document.querySelector("#memberSpecialties");
window.detectiveServiceCatalog?.forEach(({ title }) => specialtySelect.add(new Option(title, title)));

memberSignupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!memberSignupForm.reportValidity()) return;
  const values = new FormData(memberSignupForm);
  const button = memberSignupForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const { data, error } = await window.arraiSupabase.auth.signUp({
      email: values.get("email"),
      password: values.get("password"),
      options: { data: { full_name: values.get("fullName") } },
    });
    if (error) throw error;
    if (data.session && data.user) {
      memberSignupForm.hidden = true;
      applicationResumeForm.hidden = true;
      await showApplicationState(data.user);
      return;
    }
    signupStatus.textContent = "Account created. Verify the email first, then sign in below to finish the private application. This does not enable member access.";
    applicationResumeForm.hidden = false;
    applicationResumeForm.elements.email.value = values.get("email");
  } catch (error) {
    setMemberStatus(signupStatus, error.message || "Registration failed.");
  } finally {
    button.disabled = false;
  }
});

applicationResumeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!applicationResumeForm.reportValidity()) return;
  const values = new FormData(applicationResumeForm);
  const button = applicationResumeForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const { data, error } = await window.arraiSupabase.auth.signInWithPassword({
      email: values.get("email"),
      password: values.get("password"),
    });
    if (error) throw error;
    memberSignupForm.hidden = true;
    applicationResumeForm.hidden = true;
    await showApplicationState(data.user);
  } catch (error) {
    setMemberStatus(applicationStatus, error.message || "Account verification failed.");
  } finally {
    button.disabled = false;
  }
});

memberApplicationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!memberApplicationForm.reportValidity()) return;
  const values = new FormData(memberApplicationForm);
  const photo = memberApplicationForm.elements.profilePhoto.files[0];
  const button = memberApplicationForm.querySelector('[type="submit"]');
  button.disabled = true;
  setMemberStatus(applicationStatus, "Submitting your private application…");
  try {
    const photoData = await readPhoto(photo);
    const languages = String(values.get("languages") || "").split(",").map((item) => item.trim()).filter(Boolean);
    const specialties = [...specialtySelect.selectedOptions].map((option) => option.value);
    await memberRequest("apply", {
      fullName: values.get("fullName"),
      phone: values.get("phone"),
      country: values.get("country"),
      state: values.get("state"),
      city: values.get("city"),
      languages,
      yearsExperience: Number(values.get("yearsExperience")),
      specialties,
      qualifications: values.get("qualifications"),
      licenseDetails: values.get("licenseDetails"),
      photoType: photo.type,
      photoData,
      applicationConsent: values.get("applicationConsent") === "Confirmed",
    });
    memberApplicationForm.hidden = true;
    setMemberStatus(applicationStatus, "Application submitted. It stays pending until the owner reviews it and issues a member ID. You cannot access detective cases while pending.");
  } catch (error) {
    setMemberStatus(applicationStatus, error.message || "Application could not be submitted.");
  } finally {
    button.disabled = false;
  }
});

const renderAssignedCases = (cases) => {
  assignedCases.innerHTML = cases.length
    ? cases.map((item) => {
        const location = [item.area, item.city, item.district, item.state, item.country, item.postal_code].filter(Boolean).join(", ");
        const documentLink = item.documentUrl
          ? `<a href="${memberEscape(item.documentUrl)}" target="_blank" rel="noreferrer">Open private case PDF</a>`
          : "PDF pending";
        return `<article class="assigned-case"><h3>${memberEscape(item.case_number)} · ${memberEscape(item.status)}</h3><p>${memberEscape(item.service_name)} · ${memberEscape(item.matter_category)}</p><small>${memberEscape(location)}</small><p>${memberEscape(item.non_sensitive_summary)}</p>${documentLink}</article>`;
      }).join("")
    : '<p class="member-status">No cases are assigned to your account yet.</p>';
};

memberLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!memberLoginForm.reportValidity()) return;
  const values = new FormData(memberLoginForm);
  const button = memberLoginForm.querySelector('[type="submit"]');
  button.disabled = true;
  setMemberStatus(loginStatus, "Verifying your account, approval and member ID…");
  try {
    const { data, error } = await window.arraiSupabase.auth.signInWithPassword({
      email: values.get("email"),
      password: values.get("password"),
    });
    if (error) throw error;
    memberToken = data.session.access_token;
    verifiedMemberId = String(values.get("memberId") || "").trim();
    let access;
    try {
      access = await memberRequest("verify-member", { memberId: verifiedMemberId });
    } catch (error) {
      await window.arraiSupabase.auth.signOut({ scope: "local" });
      memberToken = "";
      verifiedMemberId = "";
      throw error;
    }
    memberDashboard.hidden = false;
    document.querySelector("#memberWelcome").textContent = `${access.member.fullName} · member …${access.member.memberIdSuffix}`;
    memberLoginForm.hidden = true;
    const cases = await memberRequest("assigned-cases", { memberId: verifiedMemberId });
    renderAssignedCases(cases.cases);
    setMemberStatus(loginStatus, "Member access verified.");
  } catch (error) {
    setMemberStatus(loginStatus, error.message || "Member login failed.");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#memberLogout").addEventListener("click", async () => {
  verifiedMemberId = "";
  memberToken = "";
  await window.arraiSupabase.auth.signOut({ scope: "local" });
  memberDashboard.hidden = true;
  memberLoginForm.hidden = false;
  memberLoginForm.reset();
  setMemberStatus(loginStatus, "Signed out.");
});