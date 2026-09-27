const otpRequestForm = document.querySelector("#clientOtpRequest");
const otpVerifyForm = document.querySelector("#clientOtpVerify");
const clientDashboard = document.querySelector("#clientCaseDashboard");
const casesContainer = document.querySelector("#clientCases");
const portalStatus = document.querySelector("#clientPortalStatus");
let requestedEmail = "";
let clientSession = null;
let idleTimer = 0;
let refreshTimer = 0;
let clientCasesCache = [];

const emailFromLink = new URLSearchParams(window.location.search).get("email");
if (emailFromLink && otpRequestForm) {
  otpRequestForm.elements.email.value = emailFromLink.trim().toLowerCase();
  window.history.replaceState({}, "", window.location.pathname);
}

const portalEscape = (value) =>
  String(value || "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );

const setPortalStatus = (message, isError = false) => {
  portalStatus.textContent = message;
  portalStatus.classList.toggle("is-error", isError);
};

const clientApi = async (action, payload = {}) => {
  const response = await fetch("/api/detective-client", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${clientSession.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Case service is unavailable.");
  return result;
};

const stageDefinitions = [
  ["case_received", "Case received"],
  ["osint_analysis_active", "Analysis active"],
  ["compiling_intelligence", "Compiling report"],
  ["report_ready", "Report ready"],
];

const renderProgress = (current) => {
  const currentIndex = stageDefinitions.findIndex(([key]) => key === current);
  return `<ol class="case-progress" aria-label="Case progress">${stageDefinitions.map(([key, label], index) => `<li class="case-progress-step ${index < currentIndex ? "is-complete" : ""} ${index === currentIndex ? "is-current" : ""}">${portalEscape(label)}</li>`).join("")}</ol>`;
};

const renderTimeline = (events) => events.length
  ? `<ol class="case-timeline">${events.map((event) => `<li><time datetime="${portalEscape(event.created_at)}">${portalEscape(new Date(event.created_at).toLocaleString())}</time><div><b>${portalEscape(event.title)}</b><p>${portalEscape(event.detail)}</p></div></li>`).join("")}</ol>`
  : '<p class="client-muted">No timeline updates yet.</p>';

const renderEvidence = (files) => files.length
  ? `<div class="client-evidence-list">${files.map((file) => `<a href="${portalEscape(file.downloadUrl || "#")}" target="_blank" rel="noreferrer">${portalEscape(file.original_name)} · ${portalEscape(new Date(file.created_at).toLocaleString())}</a>`).join("")}</div>`
  : '<p class="client-muted">No evidence files uploaded.</p>';

const renderInvoices = (invoices) => invoices.length
  ? `<div class="client-invoices">${invoices.map((invoice) => {
      const amount = invoice.currency === "INR" ? `₹${(invoice.amount_minor / 100).toFixed(2)}` : `${(invoice.amount_minor / 100).toFixed(2)} ${invoice.currency}`;
      const action = invoice.status === "paid"
        ? `<button type="button" data-receipt="${portalEscape(invoice.invoice_number)}">Download receipt</button>`
        : invoice.status === "payment_submitted"
          ? `<small>Transaction reference submitted · awaiting owner verification</small>`
        : invoice.payment_method === "razorpay"
          ? `<button type="button" data-pay-invoice="${portalEscape(invoice.id)}">Pay securely</button>`
          : invoice.payment_method === "usdt_manual" && invoice.usdt_address && invoice.usdt_network
            ? `<div class="usdt-instructions"><small>Send only ${portalEscape(amount)} to ${portalEscape(invoice.usdt_address)} on ${portalEscape(invoice.usdt_network)}. Verify the network/address before sending.</small><form class="usdt-reference-form" data-usdt-reference="${portalEscape(invoice.id)}"><label>Transaction hash/reference<input name="transactionReference" minlength="20" maxlength="160" required /></label><button type="submit">Submit for verification</button></form></div>`
            : "Payment method not configured";
      return `<article class="client-invoice"><div><b>${portalEscape(invoice.invoice_number)} · ${portalEscape(amount)}</b><small>${portalEscape(invoice.description)} · ${portalEscape(invoice.status)}${invoice.paid_at ? ` · paid ${portalEscape(new Date(invoice.paid_at).toLocaleString())}` : ""}</small></div><div class="client-invoice-action">${action}</div></article>`;
    }).join("")}</div>`
  : '<p class="client-muted">No invoice has been issued for this case.</p>';

const renderCase = (item) => {
  if (item.status === "purged")
    return `<article class="purged-case-notice"><b>${portalEscape(item.caseNumber)}</b><p>${portalEscape(item.purgeMessage)}</p></article>`;
  const details = [
    ["Client category", item.clientType],
    ["Matter", item.matterCategory],
    ["Service", item.service],
    ["Professional identity", item.professionalIdentity],
    ["Location", item.location],
    ["Police station", item.policeStation],
    ["Timing", item.timing],
  ].filter(([, value]) => value);
  return `<article class="client-case-card" data-case-id="${portalEscape(item.id)}">
    <div class="client-case-heading"><h3>${portalEscape(item.caseNumber)} <small>READ ONLY</small></h3><span class="client-case-meta">${portalEscape(item.status.replaceAll("_", " "))} · Opened ${portalEscape(new Date(item.createdAt).toLocaleDateString())}</span></div>
    ${renderProgress(item.progressStage)}
    <dl class="case-detail-grid">${details.map(([label, value]) => `<div><dt>${portalEscape(label)}</dt><dd>${portalEscape(value)}</dd></div>`).join("")}<div class="case-summary-block"><dt>Submitted case summary · read only</dt><dd class="case-readonly-summary">${portalEscape(item.summary)}</dd></div></dl>
    <div class="client-case-links">${item.pdfUrl ? `<a href="${portalEscape(item.pdfUrl)}" target="_blank" rel="noreferrer">Open intake PDF</a>` : ""}</div>
    <section class="case-client-subsection"><p class="case-kicker">Investigation timeline</p>${renderTimeline(item.timeline)}</section>
    <section class="case-client-subsection"><p class="case-kicker">Invoices &amp; payments</p>${renderInvoices(item.invoices)}</section>
    <section class="case-client-subsection"><p class="case-kicker">Secure evidence drop-zone</p><p class="client-muted">Upload up to 10 JPG, PNG, WebP or PDF files, max 2 MB each. Do not upload passwords, intimate images or unrelated personal data.</p>${renderEvidence(item.evidence)}<form class="case-evidence-form" data-evidence-form="${portalEscape(item.id)}"><label>Choose a relevant file<input name="evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /></label><button class="follow-button" type="submit">Upload securely</button><span class="client-muted" aria-live="polite"></span></form></section>
  </article>`;
};

const loadCases = async () => {
  const result = await clientApi("cases");
  clientCasesCache = result.cases;
  casesContainer.innerHTML = result.cases.length
    ? result.cases.map(renderCase).join("")
    : '<p class="client-muted">No cases are registered to this verified email yet. Use “New enquiry” to open a case.</p>';
};

const clearIdleTimer = () => window.clearTimeout(idleTimer);
const signOutClient = async (message = "Signed out to protect your case information.") => {
  clearIdleTimer();
  window.clearInterval(refreshTimer);
  clientSession = null;
  casesContainer.replaceChildren();
  clientDashboard.hidden = true;
  otpRequestForm.hidden = false;
  otpVerifyForm.hidden = true;
  await window.arraiSupabase.auth.signOut({ scope: "local" });
  setPortalStatus(message);
};
const resetIdleTimer = () => {
  if (!clientSession) return;
  clearIdleTimer();
  idleTimer = window.setTimeout(() => {
    void signOutClient("Signed out after 10 minutes without activity. Request a new email code to continue.");
  }, 10 * 60 * 1000);
};
[
  "pointerdown",
  "keydown",
  "touchstart",
  "scroll",
].forEach((eventName) => document.addEventListener(eventName, resetIdleTimer, { passive: true }));

const enterClientDashboard = async (session) => {
  clientSession = session;
  otpRequestForm.hidden = true;
  otpVerifyForm.hidden = true;
  clientDashboard.hidden = false;
  document.querySelector("#clientDashboardEmail").textContent = session.user.email;
  setPortalStatus("Email verified. Loading your cases…");
  try {
    await loadCases();
    setPortalStatus("Cases loaded. Your submitted details are read-only.");
    resetIdleTimer();
    window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => {
      if (clientSession) loadCases().catch(() => {});
    }, 60_000);
  } catch (error) {
    setPortalStatus(error.message, true);
  }
};

otpRequestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!otpRequestForm.reportValidity()) return;
  requestedEmail = String(new FormData(otpRequestForm).get("email") || "").trim().toLowerCase();
  const button = otpRequestForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const { error } = await window.arraiSupabase.auth.signInWithOtp({
      email: requestedEmail,
      options: {
        shouldCreateUser: true,
        data: { portal: "detective-client" },
        emailRedirectTo: `${window.location.origin}/client-cases.html`,
      },
    });
    if (error) throw error;
    document.querySelector("#otpSentTo").textContent = `Enter the six-digit email code sent to ${requestedEmail}. Use your enquiry email address.`;
    otpRequestForm.hidden = true;
    otpVerifyForm.hidden = false;
    setPortalStatus("Code sent. Check your inbox and spam folder.");
    otpVerifyForm.elements.token.focus();
  } catch (error) {
    setPortalStatus(error.message || "Could not send a sign-in code.", true);
  } finally {
    button.disabled = false;
  }
});

otpVerifyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!otpVerifyForm.reportValidity()) return;
  const button = otpVerifyForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const token = String(new FormData(otpVerifyForm).get("token") || "").trim();
    if (!/^\d{6}$/.test(token)) throw new Error("Enter the six-digit email code.");
    const { data, error } = await window.arraiSupabase.auth.verifyOtp({
      email: requestedEmail,
      token,
      type: "email",
    });
    if (error) throw error;
    if (!data.session?.user?.email) throw new Error("Email verification did not create a valid session.");
    await enterClientDashboard(data.session);
  } catch (error) {
    setPortalStatus(error.message || "Email code could not be verified.", true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#requestNewCode").addEventListener("click", () => {
  otpVerifyForm.hidden = true;
  otpRequestForm.hidden = false;
  otpRequestForm.elements.email.value = requestedEmail;
  setPortalStatus("Request a fresh code for the email used on your case.");
});

document.querySelector("#clientSignOut").addEventListener("click", () => {
  void signOutClient("You have signed out.");
});

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file || file.size > 2_097_152 || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
    reject(new Error("Choose a JPG, PNG, WebP or PDF smaller than 2 MB."));
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => resolve(reader.result));
  reader.addEventListener("error", () => reject(new Error("The selected file could not be read.")));
  reader.readAsDataURL(file);
});

casesContainer.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-evidence-form]");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector("button");
  const feedback = form.querySelector("span");
  const file = form.elements.evidence.files[0];
  button.disabled = true;
  feedback.textContent = "Encrypting transfer…";
  try {
    const fileData = await fileToDataUrl(file);
    await clientApi("upload-evidence", {
      caseId: form.dataset.evidenceForm,
      fileName: file.name,
      contentType: file.type,
      fileData,
    });
    feedback.textContent = "Evidence securely added to the case inbox.";
    await loadCases();
    resetIdleTimer();
  } catch (error) {
    feedback.textContent = error.message || "Secure upload failed.";
  } finally {
    button.disabled = false;
  }
});

const createReceipt = (invoice, caseNumber) => {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("ARRAI DETECTIVE AGENCY", 18, 24);
  pdf.setFontSize(13);
  pdf.text("PAYMENT RECEIPT", 18, 36);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Receipt: ${invoice.invoice_number}`, 18, 50);
  pdf.text(`Case: ${caseNumber}`, 18, 58);
  pdf.text(`Description: ${invoice.description}`, 18, 66);
  pdf.text(`Amount: ${(invoice.amount_minor / 100).toFixed(2)} ${invoice.currency}`, 18, 74);
  pdf.text(`Paid at: ${new Date(invoice.paid_at).toLocaleString()}`, 18, 82);
  pdf.text(`Reference: ${invoice.razorpay_payment_id || invoice.payment_reference || "Verified payment"}`, 18, 90);
  pdf.text("This receipt confirms payment recorded by the agency; retain it with your case number.", 18, 104, { maxWidth: 170 });
  pdf.save(`${invoice.invoice_number}.pdf`);
};

casesContainer.addEventListener("click", async (event) => {
  const receiptButton = event.target.closest("[data-receipt]");
  if (receiptButton) {
    const invoice = clientCasesCache.flatMap((item) => item.invoices).find((item) => item.invoice_number === receiptButton.dataset.receipt);
    const caseItem = clientCasesCache.find((item) => item.invoices.some((entry) => entry.invoice_number === receiptButton.dataset.receipt));
    if (invoice && caseItem) createReceipt(invoice, caseItem.caseNumber);
    return;
  }
  const payButton = event.target.closest("[data-pay-invoice]");
  if (!payButton) return;
  const invoiceId = payButton.dataset.payInvoice;
  const invoice = clientCasesCache.flatMap((item) => item.invoices).find((item) => item.id === invoiceId);
  if (!invoice) return;
  if (invoice.payment_method === "razorpay" && invoice.razorpay_order_id && window.Razorpay) {
    const payment = new window.Razorpay({
      key: invoice.razorpay_key_id,
      amount: invoice.amount_minor,
      currency: invoice.currency,
      name: "ARRAI Detective Agency",
      description: invoice.description,
      order_id: invoice.razorpay_order_id,
      handler: async (response) => {
        try {
          await clientApi("verify-invoice-payment", { ...response, invoiceId: invoice.id });
          await loadCases();
          const paidInvoice = clientCasesCache.flatMap((item) => item.invoices).find((entry) => entry.id === invoice.id);
          const paidCase = clientCasesCache.find((item) => item.invoices.some((entry) => entry.id === invoice.id));
          setPortalStatus("Payment verified. Your digital receipt is downloading.");
          if (paidInvoice && paidCase) createReceipt(paidInvoice, paidCase.caseNumber);
        } catch (error) {
          setPortalStatus(error.message, true);
        }
      },
      modal: { ondismiss: () => setPortalStatus("Payment was not completed.") },
      theme: { color: "#d5ad6f" },
    });
    payment.open();
  } else if (invoice.payment_method === "usdt_manual" && invoice.usdt_address) {
    await navigator.clipboard?.writeText(invoice.usdt_address).catch(() => {});
    setPortalStatus(`Send ${invoice.amount_minor / 100} USDT on ${invoice.usdt_network} only to ${invoice.usdt_address}. Submit the transaction reference to the agency for manual verification.`);
  }
});

casesContainer.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-usdt-reference]");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await clientApi("submit-usdt-reference", {
      invoiceId: form.dataset.usdtReference,
      transactionReference: new FormData(form).get("transactionReference"),
    });
    setPortalStatus("USDT reference submitted. The invoice will remain pending until the owner verifies it.");
    await loadCases();
  } catch (error) {
    setPortalStatus(error.message, true);
    button.disabled = false;
  }
});

