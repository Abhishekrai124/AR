// ARRAI Dedicated Net Banking Engine

const bankNames = {
  sbi: "State Bank of India (SBI Core Node)",
  hdfc: "HDFC Bank (National Clearing Node)",
  icici: "ICICI Bank (Digital Gateway)",
  axis: "Axis Bank (Inter-Bank Wire)",
  pnb: "Punjab National Bank (Regional Desk)",
  kotak: "Kotak Mahindra (Capital Node)",
  bob: "Bank of Baroda (Core Clearing)"
};

let currentBank = "sbi";

// Bank Selector Chips
document.querySelectorAll(".bank-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".bank-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentBank = chip.dataset.bank;
    const display = document.querySelector("#selectedBankDisplay");
    if (display) {
      display.value = bankNames[currentBank] || "National Core Banking";
    }
  });
});

// Retail vs Corporate toggle
const btnRetail = document.querySelector("#btnRetailAuth");
const btnCorp = document.querySelector("#btnCorporateAuth");
const lblCorp = document.querySelector("#lblCorpId");

btnRetail?.addEventListener("click", () => {
  btnRetail.classList.add("active");
  btnCorp?.classList.remove("active");
  if (lblCorp) lblCorp.style.display = "none";
});

btnCorp?.addEventListener("click", () => {
  btnCorp.classList.add("active");
  btnRetail?.classList.remove("active");
  if (lblCorp) lblCorp.style.display = "block";
});

// Net Banking Login Form
const loginForm = document.querySelector("#netBankingLoginForm");
const loginStatus = document.querySelector("#netBankingStatus");

loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const user = document.querySelector("#netBankingUser")?.value.trim();
  if (loginStatus) {
    loginStatus.textContent = `Authenticating securely with ${bankNames[currentBank]}…`;
    loginStatus.style.color = "#38bdf8";
  }

  setTimeout(() => {
    if (loginStatus) {
      loginStatus.textContent = `Welcome, User ${user}! Authenticated session active. Net Banking node connected ✓`;
      loginStatus.style.color = "#86efac";
    }
  }, 900);
});

// Bank Wire Transfer (IMPS / RTGS / NEFT)
const transferForm = document.querySelector("#bankTransferForm");
const transferStatus = document.querySelector("#transferStatus");

transferForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const acc1 = document.querySelector("#benAccount")?.value.trim();
  const acc2 = document.querySelector("#benAccountConfirm")?.value.trim();
  const ifsc = document.querySelector("#benIfsc")?.value.trim().toUpperCase();
  const name = document.querySelector("#benName")?.value.trim();
  const amount = Number(document.querySelector("#transferAmount")?.value || 0);
  const method = document.querySelector("#transferMethod")?.value || "IMPS";

  if (acc1 !== acc2) {
    if (transferStatus) {
      transferStatus.textContent = "Account numbers do not match. Please verify carefully.";
      transferStatus.style.color = "#f87171";
    }
    return;
  }

  if (!ifsc || ifsc.length < 11) {
    if (transferStatus) {
      transferStatus.textContent = "Please enter a valid 11-character Indian IFSC code (e.g. SBIN0001234).";
      transferStatus.style.color = "#f87171";
    }
    return;
  }

  const utr = `UTR${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

  if (transferStatus) {
    transferStatus.textContent = `Processing ${method} transfer of ₹${amount.toLocaleString()} to ${name} (${ifsc})…`;
    transferStatus.style.color = "#38bdf8";
  }

  setTimeout(() => {
    if (transferStatus) {
      transferStatus.textContent = `Transfer Authorised! Reference UTR: ${utr} · Status: Settled via ${method} ✓`;
      transferStatus.style.color = "#86efac";
    }
    transferForm.reset();
  }, 1100);
});

// Fixed Deposit Calculator
const fdAmountInput = document.querySelector("#fdAmount");
const fdTenureSelect = document.querySelector("#fdTenure");
const fdMaturityResult = document.querySelector("#fdMaturityResult");
const fdInterestResult = document.querySelector("#fdInterestResult");

const rates = {
  "1": 0.068,
  "2": 0.072,
  "3": 0.076,
  "5": 0.078
};

function calculateFD() {
  const p = Number(fdAmountInput?.value || 50000);
  const t = Number(fdTenureSelect?.value || 3);
  const r = rates[t] || 0.076;

  // Compound quarterly
  const n = 4;
  const a = p * Math.pow(1 + r / n, n * t);
  const interest = a - p;

  if (fdMaturityResult) {
    fdMaturityResult.textContent = `₹${Math.round(a).toLocaleString("en-IN")}.00`;
  }
  if (fdInterestResult) {
    fdInterestResult.textContent = `+ ₹${Math.round(interest).toLocaleString("en-IN")}.00 (${(r * 100).toFixed(1)}% APY)`;
  }
}

fdAmountInput?.addEventListener("input", calculateFD);
fdTenureSelect?.addEventListener("change", calculateFD);
calculateFD();

const fdBookBtn = document.querySelector("#fdBookBtn");
const fdStatus = document.querySelector("#fdStatus");

fdBookBtn?.addEventListener("click", () => {
  const p = Number(fdAmountInput?.value || 50000);
  const fdCertId = `FD-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  if (fdStatus) {
    fdStatus.textContent = `FD Certificate booked! Number: ${fdCertId} for ₹${p.toLocaleString()} · Stored in ARRAI Treasury Vault ✓`;
    fdStatus.style.color = "#86efac";
  }
});

// Statement PDF Downloader
window.downloadStatement = function (type) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert("PDF library initializing. Please try again.");
    return;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 20;
  let y = 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text("ARRAI NET BANKING — OFFICIAL e-STATEMENT", left, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Institution: ${bankNames[currentBank]} | RBI Licensed Gateway`, left, y);
  y += 5;
  doc.text(`Generated: ${new Date().toLocaleString()} | Statement Type: ${type}`, left, y);
  y += 9;

  doc.setDrawColor(203, 213, 225);
  doc.line(left, y, 190, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Account Activity Summary", left, y);
  y += 8;

  const records = [
    ["12 Oct 2026", "IMPS Wire Credit — Client Retainer", "+ ₹45,000.00", "SUCCESS"],
    ["18 Oct 2026", "UPI Transfer — ARRAI Studio Royalty", "+ ₹12,500.00", "SUCCESS"],
    ["25 Oct 2026", "NEFT Wire — Server Infrastructure", "- ₹8,200.00", "SUCCESS"],
    ["02 Nov 2026", "Fixed Deposit Interest Credit (Q3)", "+ ₹3,850.00", "SUCCESS"],
    ["08 Nov 2026", "Razorpay Payment Gateway Top-up", "+ ₹25,000.00", "SUCCESS"]
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Date", left, y);
  doc.text("Description", left + 30, y);
  doc.text("Amount", left + 120, y);
  doc.text("Status", left + 150, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  records.forEach(([d, desc, amt, st]) => {
    doc.text(d, left, y);
    doc.text(desc, left + 30, y);
    doc.text(amt, left + 120, y);
    doc.text(st, left + 150, y);
    y += 7;
  });

  y += 10;
  doc.setDrawColor(226, 232, 240);
  doc.line(left, y, 190, y);
  y += 8;

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("This is an authenticated computer-generated e-statement. Contact abhishekrai6897@gmail.com for enquiries.", left, y);

  doc.save(`ARRAI-Statement-${type.replace(/\s+/g, "_")}.pdf`);
};
