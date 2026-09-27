const memberLoginForm = document.querySelector("#memberLoginForm");
const memberSignupForm = document.querySelector("#memberSignupForm");
const applicationResumeForm = document.querySelector("#applicationResumeForm");
const memberApplicationForm = document.querySelector("#memberApplicationForm");
const memberDashboard = document.querySelector("#memberDashboard");
const assignedCases = document.querySelector("#assignedCases");
const loginStatus = document.querySelector("#memberLoginStatus");
const signupStatus = document.querySelector("#memberSignupStatus");
const applicationStatus = document.querySelector("#applicationStatus");
const memberProfileForm = document.querySelector("#memberProfileForm");
const memberProfileStatus = document.querySelector("#memberProfileStatus");
let memberToken = "";
let verifiedMemberId = "";
const ownerMemberShortcut = document.querySelector("#ownerMemberShortcut");
const ownerEmail = "abhishekrai6897@gmail.com";

const showOwnerShortcut = async () => {
  const { data: { session } } = await window.arraiSupabase.auth.getSession();
  if (!session?.user?.email || session.user.email.toLowerCase() !== ownerEmail) return;
  ownerMemberShortcut.hidden = false;
  memberLoginForm.hidden = true;
  memberSignupForm.hidden = true;
  applicationResumeForm.hidden = true;
  memberApplicationForm.hidden = true;
  setMemberStatus(loginStatus, "Owner session detected. Open Owner Studio to approve detectives and assign cases.");
};

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
const applicantRole = document.querySelector("#applicantRole");
const roleCredentials = document.querySelector("#roleCredentials");
const credentialLabel = document.querySelector("#credentialLabel");
const employerLabel = document.querySelector("#employerLabel");
const applicationPdfButton = document.querySelector("#applicationPdfButton");
window.detectiveServiceCatalog?.forEach(({ title }) => specialtySelect.add(new Option(title, title)));

const updateRoleQuestions = () => {
  const role = applicantRole?.value || "";
  const professional = /Police|Lawyer|Court|Government|Forensic|investigator/i.test(role);
  if (roleCredentials) roleCredentials.hidden = !professional;
  if (!professional) return;
  credentialLabel.firstChild.textContent = /Lawyer|Court/.test(role) ? "Bar, court or professional registration reference" : /Police|Government/.test(role) ? "Official service / authorization reference" : "Professional licence / registration reference";
  employerLabel.firstChild.textContent = /Lawyer/.test(role) ? "Chambers, firm or court" : /Police|Government/.test(role) ? "Authority, department or organization" : "Employer or organization";
};
applicantRole?.addEventListener("change", updateRoleQuestions);

const buildApplicationPdf = (values) => {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) throw new Error("PDF support did not load. Please reload and try again.");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const rows = [["ARRAI DETECTIVE AGENCY", "MEMBER APPLICATION COPY"], ["Name", values.get("fullName")], ["Email", values.get("email")], ["Role", values.get("applicantRole")], ["Phone", values.get("phone")], ["Location", [values.get("city"), values.get("state"), values.get("country"), values.get("postalCode")].filter(Boolean).join(", ")], ["Experience", `${values.get("yearsExperience")} years`], ["Qualifications", values.get("qualifications")], ["Credentials", values.get("roleCredential") || values.get("licenseDetails")], ["Motivation", values.get("motivation")], ["Availability", values.get("availability")]];
  let y = 20;
  rows.forEach(([label, value]) => { const lines = pdf.splitTextToSize(`${label}: ${value || "Not provided"}`, 170); if (y + lines.length * 6 > 280) { pdf.addPage(); y = 20; } pdf.setFont("helvetica", label === "ARRAI DETECTIVE AGENCY" ? "bold" : "normal"); pdf.text(lines, 20, y); y += lines.length * 6 + 4; });
  return pdf.output("blob");
};

const openMemberPdf = (values, action) => {
  const blob = buildApplicationPdf(values);
  const url = URL.createObjectURL(blob);
  if (action === "download") {
    const link = document.createElement("a"); link.href = url; link.download = "ARRAI-member-application-draft.pdf"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); return;
  }
  const preview = window.open(url, "_blank", "noopener");
  if (!preview) { URL.revokeObjectURL(url); throw new Error("Allow pop-ups to preview or print the PDF."); }
  if (action === "print") preview.addEventListener("load", () => preview.print(), { once: true });
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

document.querySelectorAll("[data-member-pdf-action]").forEach((button) => button.addEventListener("click", () => {
  try { openMemberPdf(new FormData(memberApplicationForm), button.dataset.memberPdfAction); }
  catch (error) { setMemberStatus(applicationStatus, error.message || "Draft PDF could not be created."); }
}));

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
      postalCode: values.get("postalCode"),
      address: values.get("address"),
      applicantRole: values.get("applicantRole"),
      organization: values.get("organization"),
      roleCredential: values.get("roleCredential"),
      languages,
      yearsExperience: Number(values.get("yearsExperience")),
      specialties,
      qualifications: values.get("qualifications"),
      licenseDetails: values.get("licenseDetails"),
      motivation: values.get("motivation"),
      availability: values.get("availability"),
      photoType: photo.type,
      photoData,
      applicationConsent: values.get("applicationConsent") === "Confirmed",
    });
    memberApplicationForm.hidden = true;
    applicationPdfButton.hidden = false;
    applicationPdfButton.onclick = () => openMemberPdf(values, "download");
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

const loadMemberProfile = async () => {
  const result = await memberRequest("member-profile", { memberId: verifiedMemberId });
  const profile = result.profile;
  ["phone", "country", "state", "city", "postalCode", "address", "qualifications", "availability"].forEach((name) => {
    if (memberProfileForm.elements[name]) memberProfileForm.elements[name].value = profile[name] || "";
  });
  memberProfileForm.elements.languages.value = (profile.languages || []).join(", ");
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
    await loadMemberProfile();
    setMemberStatus(loginStatus, "Member access verified.");
  } catch (error) {
    setMemberStatus(loginStatus, error.message || "Member login failed.");
  } finally {
    button.disabled = false;
  }
});

memberProfileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!memberProfileForm.reportValidity()) return;
  const button = memberProfileForm.querySelector('[type="submit"]');
  const values = new FormData(memberProfileForm);
  button.disabled = true;
  setMemberStatus(memberProfileStatus, "Saving your private profile…");
  try {
    await memberRequest("update-member-profile", {
      memberId: verifiedMemberId,
      phone: values.get("phone"), country: values.get("country"), state: values.get("state"), city: values.get("city"),
      postalCode: values.get("postalCode"), address: values.get("address"), qualifications: values.get("qualifications"), availability: values.get("availability"),
      languages: String(values.get("languages") || "").split(",").map((value) => value.trim()).filter(Boolean),
    });
    setMemberStatus(memberProfileStatus, "Profile updated. Your owner review status and assigned cases are unchanged.");
  } catch (error) { setMemberStatus(memberProfileStatus, error.message || "Profile could not be updated."); }
  finally { button.disabled = false; }
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

showOwnerShortcut().catch(() => {});
