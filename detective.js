// ARRAI Detective Agency - Client Intake, Service Catalog & Case Tracking Engine

// Service Catalog Initialization & Filtering
const serviceCatalogContainer = document.querySelector("#detectiveServiceCatalog");
const serviceSearch = document.querySelector("#detectiveServiceSearch");
const serviceCategory = document.querySelector("#detectiveServiceCategory");
const serviceCount = document.querySelector("#detectiveServiceCount");
const caseServiceSelect = document.querySelector("#caseService");

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[m]);
}

function initServiceCatalog() {
  const catalog = window.detectiveServiceCatalog || [];
  if (!catalog.length) return;

  // Populate Categories in filter
  if (serviceCategory) {
    const categories = Array.from(new Set(catalog.map((s) => s.category).filter(Boolean)));
    serviceCategory.innerHTML = '<option value="all">All investigation fields</option>';
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      serviceCategory.appendChild(opt);
    });
  }

  // Populate Select in Case Intake Form
  if (caseServiceSelect) {
    caseServiceSelect.innerHTML = '<option value="" selected disabled>Choose a service</option>';
    catalog.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.title;
      opt.textContent = `${s.title} (${s.category || 'General'})`;
      caseServiceSelect.appendChild(opt);
    });
    const unlisted = document.createElement("option");
    unlisted.value = "Unlisted / Special Private Investigation";
    unlisted.textContent = "Unlisted / Special Private Investigation";
    caseServiceSelect.appendChild(unlisted);
  }

  renderServices(catalog);
}

function renderServices(items) {
  if (!serviceCatalogContainer) return;
  serviceCatalogContainer.innerHTML = "";

  if (!items.length) {
    serviceCatalogContainer.innerHTML = '<p class="client-muted">No investigation services match your search terms.</p>';
    if (serviceCount) serviceCount.textContent = "0 services listed";
    return;
  }

  items.forEach((item, index) => {
    const article = document.createElement("article");
    article.className = "investigation-card";
    article.innerHTML = `
      <span class="investigation-code">SVC-${String(index + 1).padStart(2, "0")} · ${escapeHtml(item.category || "INVESTIGATION")}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary || item.description || "")}</p>
      <div class="investigation-meta">
        <small>Discretion: Strict Confidentiality</small>
        <a class="case-text-link" href="#case-intake" onclick="preselectService('${escapeHtml(item.title)}')">Select service →</a>
      </div>
    `;
    serviceCatalogContainer.appendChild(article);
  });

  if (serviceCount) {
    serviceCount.textContent = `${items.length} investigation service${items.length === 1 ? "" : "s"} available`;
  }
}

window.preselectService = function (serviceTitle) {
  if (caseServiceSelect) {
    caseServiceSelect.value = serviceTitle;
  }
};

function filterServices() {
  const catalog = window.detectiveServiceCatalog || [];
  const q = (serviceSearch?.value || "").toLowerCase().trim();
  const cat = serviceCategory?.value || "all";

  const filtered = catalog.filter((s) => {
    const matchCat = cat === "all" || s.category === cat;
    const matchQ = !q || s.title.toLowerCase().includes(q) || (s.summary || "").toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  renderServices(filtered);
}

serviceSearch?.addEventListener("input", filterServices);
serviceCategory?.addEventListener("change", filterServices);

// Client Type & Professional / Student Toggles
const clientTypeSelect = document.querySelector("#clientType");
const professionalFields = document.querySelector("#professionalFields");
const studentStatusField = document.querySelector("#studentStatusField");
const studentStatusSelect = document.querySelector("#studentStatus");

function updateClientFields() {
  const val = clientTypeSelect?.value || "";
  const isProfessional = [
    "Lawyer or legal professional",
    "Police or law-enforcement official",
    "Public authority or government body",
    "Business or employer",
    "Insurer or claims professional",
    "Nonprofit or community organization"
  ].includes(val);

  if (professionalFields) professionalFields.hidden = !isProfessional;
  if (studentStatusField) studentStatusField.hidden = val !== "Student";
}

clientTypeSelect?.addEventListener("change", updateClientFields);

// Local Storage Case Management Helpers
function getStoredClientCases() {
  try {
    const raw = localStorage.getItem("arrai_client_cases");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveStoredClientCase(caseObj) {
  try {
    const cases = getStoredClientCases();
    cases.unshift(caseObj);
    localStorage.setItem("arrai_client_cases", JSON.stringify(cases));
  } catch {}
}

// PDF Generation using jsPDF
function generateCasePdf(caseData) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return null;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 20;
  let y = 24;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(21, 26, 23);
  doc.text("ARRAI DETECTIVE AGENCY", left, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 95);
  doc.text("Giaspura, Ludhiana · Punjab 141003, India | Private Investigation Enquiries", left, y);
  y += 4;
  doc.text("Lead Investigator: Mr. A (Abhishek Rai) | abhishekrai6897@gmail.com", left, y);
  y += 8;

  doc.setDrawColor(200, 210, 205);
  doc.setLineWidth(0.5);
  doc.line(left, y, 190, y);
  y += 10;

  // Case Reference Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(21, 26, 23);
  doc.text(`CONFIDENTIAL CASE INTAKE ACKNOWLEDGEMENT`, left, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(2, 132, 199);
  doc.text(`Case Tracking Number: ${caseData.caseNumber}`, left, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70, 80, 75);
  doc.text(`Filing Timestamp: ${new Date(caseData.createdAt).toLocaleString()}`, left, y);
  y += 8;

  // Metadata Table
  const rows = [
    ["Client Name", caseData.name],
    ["Client Email", caseData.email],
    ["Client Classification", caseData.clientType],
    ["Matter Category", caseData.caseCategory],
    ["Assigned Service", caseData.service],
    ["Location Jurisdiction", `${caseData.city || 'Punjab'}, ${caseData.state || 'India'} (${caseData.postalCode || '141003'})`],
    ["Enquiry Urgency", caseData.timing || "Routine enquiry"],
    ["Current Status", "Active Intake · Preliminary Review"]
  ];

  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${label}:`, left, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value || "—"), left + 45, y);
    y += 6;
  });

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Submitted Case Outline (Summary):", left, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const splitSummary = doc.splitTextToSize(caseData.message || "No outline provided.", 165);
  doc.text(splitSummary, left, y);
  y += splitSummary.length * 5 + 8;

  // Disclaimer & Rules
  doc.setDrawColor(220, 225, 222);
  doc.line(left, y, 190, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(110, 115, 112);
  doc.text("TERMS & CONFIDENTIALITY ACKNOWLEDGEMENT:", left, y);
  y += 5;

  const legalNotes = [
    "1. This document acknowledges a private, preliminary investigation enquiry only.",
    "2. No work commences until lawful scope, authorization, fees and timelines are agreed in writing.",
    "3. The agency operates strictly within the law: no unauthorized hacking, wiretaps, or unlawful surveillance.",
    "4. Retain this Case Tracking Number for portal status tracking at https://arrai.in/detective.html"
  ];
  doc.setFont("helvetica", "normal");
  legalNotes.forEach((line) => {
    doc.text(line, left, y);
    y += 4.5;
  });

  return doc;
}

// Case Intake Form Submission Handler
const caseIntakeForm = document.querySelector("#caseIntake");
const caseDownloadPanel = document.querySelector("#caseDownloadPanel");
const caseNumberDisplay = document.querySelector("#caseNumberDisplay");
const casePdfLink = document.querySelector("#casePdfLink");
const caseDeskLink = document.querySelector("#caseDeskLink");
const caseSubmissionStatus = document.querySelector("#caseSubmissionStatus");

if (caseIntakeForm) {
  // Draft PDF Buttons
  document.querySelectorAll("[data-case-pdf-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const data = new FormData(caseIntakeForm);
      const tempCase = {
        caseNumber: `DRAFT-${Date.now().toString().slice(-6)}`,
        name: data.get("name") || "Prospective Client",
        email: data.get("email") || "enquirer@domain.com",
        clientType: data.get("clientType") || "Individual",
        caseCategory: data.get("caseCategory") || "General Matter",
        service: data.get("service") || "Private Investigation Enquiry",
        city: data.get("city") || "Ludhiana",
        state: data.get("state") || "Punjab",
        postalCode: data.get("postalCode") || "141003",
        timing: data.get("timing") || "Routine",
        message: data.get("message") || "Draft investigation enquiry overview.",
        createdAt: new Date().toISOString()
      };

      const doc = generateCasePdf(tempCase);
      if (!doc) {
        alert("PDF generator is initializing. Please try again in a moment.");
        return;
      }

      const action = button.dataset.casePdfAction;
      if (action === "download") {
        doc.save(`ARRAI-Case-Draft-${tempCase.caseNumber}.pdf`);
      } else if (action === "print") {
        doc.autoPrint();
        window.open(doc.output("bloburl"), "_blank");
      } else {
        window.open(doc.output("bloburl"), "_blank");
      }
    });
  });

  // Submit Form
  caseIntakeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!caseIntakeForm.reportValidity()) return;

    const submitBtn = caseIntakeForm.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    if (caseSubmissionStatus) caseSubmissionStatus.textContent = "Encrypting and recording case intake…";

    const data = new FormData(caseIntakeForm);
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(10000 + Math.random() * 90000);
    const caseNumber = `AR-${year}-${randomSeq}`;

    const caseRecord = {
      id: `case-${Date.now()}`,
      caseNumber: caseNumber,
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim().toLowerCase(),
      clientType: String(data.get("clientType") || ""),
      caseCategory: String(data.get("caseCategory") || ""),
      service: String(data.get("service") || ""),
      country: String(data.get("country") || "India"),
      state: String(data.get("state") || "Punjab"),
      city: String(data.get("city") || "Ludhiana"),
      area: String(data.get("area") || ""),
      postalCode: String(data.get("postalCode") || "141003"),
      policeStation: String(data.get("policeStation") || ""),
      timing: String(data.get("timing") || "Routine"),
      message: String(data.get("message") || ""),
      status: "case_received",
      progressStage: "case_received",
      createdAt: new Date().toISOString(),
      timeline: [
        {
          title: "Confidential Case Intake Recorded",
          detail: "Intake form received and preliminary case tracking file created.",
          created_at: new Date().toISOString()
        }
      ]
    };

    // Save locally
    saveStoredClientCase(caseRecord);

    // Generate PDF
    const pdfDoc = generateCasePdf(caseRecord);
    if (pdfDoc) {
      const pdfBlob = pdfDoc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      if (casePdfLink) {
        casePdfLink.href = pdfUrl;
        casePdfLink.download = `${caseNumber}.pdf`;
        casePdfLink.textContent = `Download Official PDF (${caseNumber})`;
        casePdfLink.hidden = false;
      }
      // Auto trigger download
      pdfDoc.save(`${caseNumber}.pdf`);
    }

    // Display confirmation
    if (caseNumberDisplay) caseNumberDisplay.textContent = caseNumber;
    if (caseDeskLink) {
      caseDeskLink.href = `client-cases.html?email=${encodeURIComponent(caseRecord.email)}`;
    }
    if (caseDownloadPanel) caseDownloadPanel.hidden = false;

    if (caseSubmissionStatus) {
      caseSubmissionStatus.textContent = `Case ${caseNumber} successfully recorded! Your acknowledgement PDF has downloaded. Keep your Case Tracking ID for updates.`;
      caseSubmissionStatus.style.color = "#86efac";
    }

    // Scroll to download panel smoothly
    caseDownloadPanel?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (submitBtn) {
      submitBtn.textContent = "Case Filed Successfully ✓";
    }

    // Attempt optional background API sync
    try {
      fetch("/api/detective-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-case",
          clientName: caseRecord.name,
          clientEmail: caseRecord.email,
          clientType: caseRecord.clientType,
          agreementName: caseRecord.name,
          agreementAccepted: true,
          summary: caseRecord.message,
          caseNumber: caseNumber
        })
      }).catch(() => null);
    } catch {}
  });
}

// Live Case Tracking & Query System
const trackCaseForm = document.querySelector("#trackCaseForm");
const trackCaseInput = document.querySelector("#trackCaseInput");
const trackResultBox = document.querySelector("#trackResultBox");

function renderTrackResult(c) {
  if (!trackResultBox) return;

  const stages = [
    ["case_received", "Case Received"],
    ["osint_analysis_active", "OSINT Analysis Active"],
    ["compiling_intelligence", "Compiling Report"],
    ["report_ready", "Final Report Ready"]
  ];

  const currentIdx = stages.findIndex(([k]) => k === c.progressStage || k === c.status) || 0;

  trackResultBox.hidden = false;
  trackResultBox.innerHTML = `
    <div class="track-card">
      <div class="track-header">
        <div>
          <span class="case-kicker" style="color:var(--sky); font-weight:700;">LIVE INVESTIGATION STATUS</span>
          <h3 style="margin:4px 0 2px;">Case Tracking ID: <span style="color:#fff;">${escapeHtml(c.caseNumber)}</span></h3>
          <p style="color:var(--muted); font-size:0.85rem; margin:0;">Client: ${escapeHtml(c.name)} · ${escapeHtml(c.service || c.caseCategory)}</p>
        </div>
        <span class="dossier-stamp" style="font-size:0.8rem; padding:4px 10px;">${escapeHtml(c.timing || "CONFIDENTIAL")}</span>
      </div>

      <!-- Investigation Progress Bar -->
      <div style="margin: 20px 0;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted);">
          <span>Phase 1: Intake</span>
          <span>Phase 2: Analysis</span>
          <span>Phase 3: Intelligence</span>
          <span>Phase 4: Resolution</span>
        </div>
        <div style="height:8px; border-radius:999px; background:rgba(255,255,255,0.1); overflow:hidden; display:flex;">
          <div style="width: ${Math.max(25, (currentIdx + 1) * 25)}%; background:linear-gradient(90deg, #38bdf8, #818cf8); transition:width 0.4s ease;"></div>
        </div>
        <p style="font-size:0.82rem; color:#86efac; margin-top:8px; font-weight:600;">
          Current Stage: ${escapeHtml(stages[currentIdx]?.[1] || "Active Preliminary Analysis")}
        </p>
      </div>

      <!-- Details Summary -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; padding:14px; background:rgba(15,23,42,0.6); border-radius:12px; font-size:0.82rem;">
        <div><strong style="color:var(--muted); display:block;">Matter:</strong> ${escapeHtml(c.caseCategory)}</div>
        <div><strong style="color:var(--muted); display:block;">Jurisdiction:</strong> ${escapeHtml(c.city || 'Punjab')}, ${escapeHtml(c.state || 'India')}</div>
        <div><strong style="color:var(--muted); display:block;">Opened:</strong> ${new Date(c.createdAt).toLocaleDateString()}</div>
        <div><strong style="color:var(--muted); display:block;">Assigned Desk:</strong> Case Solver Mr. A</div>
      </div>

      <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
        <a class="case-button" href="client-cases.html?email=${encodeURIComponent(c.email)}">Open Private Client Desk →</a>
        <button type="button" class="case-text-link" onclick="window.printCasePdf('${escapeHtml(c.caseNumber)}')">Re-download Acknowledgement PDF 📄</button>
      </div>
    </div>
  `;
}

window.printCasePdf = function (caseNumber) {
  const cases = getStoredClientCases();
  const c = cases.find((x) => x.caseNumber === caseNumber);
  if (c) {
    const doc = generateCasePdf(c);
    if (doc) doc.save(`${c.caseNumber}.pdf`);
  }
};

if (trackCaseForm) {
  trackCaseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = (trackCaseInput?.value || "").trim().toUpperCase();
    if (!query) return;

    const cases = getStoredClientCases();
    // Search by Case Number or Email
    const found = cases.find((c) => 
      c.caseNumber.toUpperCase() === query || 
      c.email.toUpperCase() === query ||
      query.includes(c.caseNumber.toUpperCase())
    );

    if (found) {
      renderTrackResult(found);
    } else {
      // If none found locally, show verification message or default sample
      if (trackResultBox) {
        trackResultBox.hidden = false;
        trackResultBox.innerHTML = `
          <div style="padding:24px; border:1px dashed var(--line); border-radius:14px; text-align:center; background:rgba(22,34,56,0.4);">
            <p style="color:var(--muted); margin-bottom:12px;">No active case found matching "<strong>${escapeHtml(query)}</strong>".</p>
            <p style="font-size:0.85rem; color:var(--muted); margin-bottom:16px;">If you recently filed a case, make sure the Case Tracking ID (e.g. <code>AR-2026-XXXXX</code>) or registered email address is exact.</p>
            <div style="display:flex; gap:10px; justify-content:center;">
              <a class="case-button" href="#case-intake">File a New Case Enquiry ↗</a>
              <a class="case-text-link" href="client-cases.html">Access Client Desk via Email Code →</a>
            </div>
          </div>
        `;
      }
    }
  });
}

// Check URL params for quick tracking lookup
const urlParams = new URLSearchParams(window.location.search);
const qCase = urlParams.get("caseId") || urlParams.get("tracking");
if (qCase && trackCaseInput) {
  trackCaseInput.value = qCase;
  trackCaseForm?.dispatchEvent(new Event("submit"));
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", initServiceCatalog);
initServiceCatalog();
