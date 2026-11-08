const status = document.querySelector("#walletStatus");
const app = document.querySelector("#walletApp");
const form = document.querySelector("#entryForm");
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
let ledger = { balanceMinor: 0, transactions: [] };
let assistantHistory = [];
let cameraStream;

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `community-status wallet-status ${type}`;
}

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function renderLedger() {
  const thisMonth = ledger.transactions.filter((entry) => new Date(entry.created_at) >= monthStart());
  const income = thisMonth.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount_minor, 0);
  const spending = thisMonth.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount_minor, 0);
  document.querySelector("#walletBalance").textContent = money.format(ledger.balanceMinor / 100);
  document.querySelector("#walletIncome").textContent = money.format(income / 100);
  document.querySelector("#walletSpending").textContent = money.format(spending / 100);
  document.querySelector("#entryCount").textContent = `${ledger.transactions.length} ${ledger.transactions.length === 1 ? "entry" : "entries"}`;

  const groups = thisMonth.filter((entry) => entry.type === "expense").reduce((result, entry) => {
    result[entry.category] = (result[entry.category] || 0) + entry.amount_minor;
    return result;
  }, Object.create(null));
  const categories = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const largest = categories[0]?.[1] || 0;
  const chart = document.querySelector("#spendingChart");
  chart.replaceChildren();
  if (!categories.length) {
    const empty = document.createElement("p");
    empty.className = "wallet-empty";
    empty.textContent = "Add expense records to see this month's categories.";
    chart.append(empty);
  } else {
    categories.slice(0, 6).forEach(([category, amount]) => {
      const row = document.createElement("div");
      row.className = "wallet-bar-row";
      const label = document.createElement("span");
      label.textContent = category;
      const track = document.createElement("span");
      track.className = "wallet-bar-track";
      const bar = document.createElement("span");
      bar.className = "wallet-bar";
      bar.style.width = `${Math.max(4, (amount / largest) * 100)}%`;
      track.append(bar);
      const value = document.createElement("strong");
      value.textContent = money.format(amount / 100);
      row.append(label, track, value);
      chart.append(row);
    });
  }
  document.querySelector("#walletInsight").textContent = categories.length
    ? `${categories[0][0]} is your highest recorded spending category this month.`
    : "Your monthly insight will appear when you record an expense.";

  const list = document.querySelector("#walletTransactions");
  list.replaceChildren();
  if (!ledger.transactions.length) {
    const empty = document.createElement("p");
    empty.className = "wallet-empty";
    empty.textContent = "No entries yet. Your records will appear here.";
    list.append(empty);
    return;
  }
  ledger.transactions.forEach((entry) => {
    const row = document.createElement("article");
    row.className = "wallet-transaction";
    const detail = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.description;
    const meta = document.createElement("small");
    meta.textContent = `${entry.category} · ${new Date(entry.created_at).toLocaleString()}`;
    detail.append(title, meta);
    const amount = document.createElement("strong");
    amount.className = entry.type === "income" ? "is-income" : "is-expense";
    amount.textContent = `${entry.type === "income" ? "+" : "−"}${money.format(entry.amount_minor / 100)}`;
    row.append(detail, amount);
    list.append(row);
  });
}

async function requestLedger(method, payload) {
  const { data: { session } } = await window.arraiSupabase.auth.getSession();
  if (!session?.access_token) throw new Error("Your sign-in expired. Please sign in again.");
  const response = await fetch("/api/wallet", {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(payload ? { "Content-Type": "application/json" } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The wallet service is unavailable.");
  return result;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = form.querySelector("button[type=submit]");
  const values = new FormData(form);
  const amount = Number(values.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) {
    return setStatus("Enter a positive amount with up to two decimal places.", "error");
  }
  submit.disabled = true;
  setStatus("Saving your record…");
  try {
    const result = await requestLedger("POST", {
      type: values.get("type"), amount, category: values.get("category"),
      description: String(values.get("description")).trim(), idempotencyKey: crypto.randomUUID(),
    });
    ledger = result;
    renderLedger();
    form.reset();
    setStatus("Entry saved to your private ledger.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    submit.disabled = false;
  }
});

const splitTotal = document.querySelector("#splitTotal");
const splitPeople = document.querySelector("#splitPeople");
const splitResult = document.querySelector("#splitResult");
const useSplit = document.querySelector("#useSplit");
function updateSplit() {
  const total = Number(splitTotal.value);
  const people = Number(splitPeople.value);
  const valid = Number.isFinite(total) && total > 0 && Number.isInteger(people) && people > 0 && people <= 100;
  useSplit.disabled = !valid;
  splitResult.textContent = valid ? `Each share: ${money.format(Math.round(total * 100 / people) / 100)}` : "Enter a bill amount to see each share.";
}
splitTotal.addEventListener("input", updateSplit);
splitPeople.addEventListener("input", updateSplit);
useSplit.addEventListener("click", () => {
  const share = Math.round(Number(splitTotal.value) * 100 / Number(splitPeople.value)) / 100;
  form.elements.amount.value = share.toFixed(2);
  form.elements.category.value = "Shared bill";
  form.elements.description.focus();
  setStatus("Your share is ready. Add a description, then save it as an expense.");
});

document.querySelector("#walletAgentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = document.querySelector("#walletAgentQuestion").value.trim();
  const answer = document.querySelector("#walletAgentAnswer");
  const button = event.currentTarget.querySelector("button[type=submit]");
  if (!question) return;
  button.disabled = true;
  answer.textContent = "Reviewing your recorded entries…";
  try {
    const { data: { session } } = await window.arraiSupabase.auth.getSession();
    const response = await fetch("/api/wallet-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
      body: JSON.stringify({ question, history: assistantHistory.slice(-8) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "The wallet guide is unavailable.");
    answer.textContent = result.answer;
    assistantHistory = [...assistantHistory, { role: "user", text: question }, { role: "assistant", text: result.answer }].slice(-8);
  } catch (error) {
    answer.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

const qrVideo = document.querySelector("#qrVideo");
const qrStatus = document.querySelector("#qrStatus");
const scanButton = document.querySelector("#scanButton");
const stopScanButton = document.querySelector("#stopScanButton");
const upiHandoff = document.querySelector("#upiHandoff");
function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  qrVideo.srcObject = null;
  qrVideo.hidden = true;
  stopScanButton.hidden = true;
  scanButton.disabled = false;
}

scanButton.addEventListener("click", async () => {
  if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
    qrStatus.textContent = "QR scanning is not supported in this browser. Open the QR with your UPI app instead.";
    return;
  }
  try {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    qrVideo.srcObject = cameraStream;
    qrVideo.hidden = false;
    await qrVideo.play();
    scanButton.disabled = true;
    stopScanButton.hidden = false;
    qrStatus.textContent = "Point the camera at a UPI QR code.";
    const scan = async () => {
      if (!cameraStream) return;
      try {
        const [code] = await detector.detect(qrVideo);
        if (code) {
          const parsed = new URL(code.rawValue);
          if (parsed.protocol !== "upi:") throw new Error("This QR is not a UPI payment code.");
          upiHandoff.href = parsed.href;
          upiHandoff.hidden = false;
          qrStatus.textContent = "QR decoded. Review the payee and amount in your UPI app; this ledger will not confirm settlement.";
          stopCamera();
          return;
        }
      } catch (error) {
        if (error instanceof TypeError || error instanceof Error && error.message !== "No barcode detected") {
          qrStatus.textContent = error.message || "Could not read that QR code.";
          stopCamera();
          return;
        }
      }
      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  } catch {
    qrStatus.textContent = "Camera access failed. Allow camera access and try again.";
    stopCamera();
  }
});
stopScanButton.addEventListener("click", stopCamera);
window.addEventListener("pagehide", stopCamera);

window.arraiAuth.then(async ({ isAuthenticated }) => {
  if (!isAuthenticated) return window.location.assign("auth.html");
  try {
    ledger = await requestLedger("GET");
    renderLedger();
    app.hidden = false;
    setStatus("Your private ledger is ready.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}).catch(() => setStatus("Could not verify your sign-in. Please try again.", "error"));

// Razorpay Checkout Integration
const rzpForm = document.querySelector("#razorpayPayForm");
const rzpStatus = document.querySelector("#rzpStatus");
if (rzpForm) {
  rzpForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amountVal = Number(document.querySelector("#rzpAmount")?.value || 500);
    const purposeVal = document.querySelector("#rzpPurpose")?.value || "ARRAI Studio Support";
    if (typeof Razorpay === "undefined") {
      if (rzpStatus) {
        rzpStatus.textContent = "Razorpay SDK could not be loaded. Please check your internet connection.";
        rzpStatus.style.color = "#fda4af";
      }
      return;
    }
    const options = {
      key: window.RAZORPAY_KEY_ID || "rzp_test_placeholder",
      amount: Math.round(amountVal * 100),
      currency: "INR",
      name: "ARRAI Studio",
      description: purposeVal,
      image: "assets/app-icon.svg",
      theme: { color: "#38bdf8" },
      handler: function (response) {
        if (rzpStatus) {
          rzpStatus.textContent = `Payment captured successfully! ID: ${response.razorpay_payment_id}`;
          rzpStatus.style.color = "#86efac";
        }
      },
      modal: {
        ondismiss: function () {
          if (rzpStatus) {
            rzpStatus.textContent = "Payment window closed.";
            rzpStatus.style.color = "#c4cbe0";
          }
        }
      }
    };
    try {
      const rzpInstance = new Razorpay(options);
      rzpInstance.open();
    } catch (err) {
      if (rzpStatus) {
        rzpStatus.textContent = err.message || "Failed to launch Razorpay checkout.";
        rzpStatus.style.color = "#fda4af";
      }
    }
  });
}
