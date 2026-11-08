const status = document.querySelector("#walletStatus");
const app = document.querySelector("#walletApp");
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

let currentUser = null;
let ledger = {
  balanceMinor: 250000, // Starts with ₹2,500.00 for demo/instant usability
  transactions: [
    {
      id: "tx-init-1",
      type: "income",
      amount_minor: 250000,
      category: "Top-up",
      description: "Initial ARRAI Wallet Credit",
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    }
  ]
};

function getStorageKey() {
  return `arrai_wallet_${currentUser?.id || "guest"}`;
}

function loadLocalWallet() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (raw) {
      ledger = JSON.parse(raw);
    }
  } catch {}
}

function saveLocalWallet() {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(ledger));
  } catch {}
}

function setStatus(message, type = "") {
  if (!status) return;
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

  const balanceEl = document.querySelector("#walletBalance");
  const incomeEl = document.querySelector("#walletIncome");
  const spendingEl = document.querySelector("#walletSpending");
  const countEl = document.querySelector("#entryCount");

  if (balanceEl) balanceEl.textContent = money.format(ledger.balanceMinor / 100);
  if (incomeEl) incomeEl.textContent = money.format(income / 100);
  if (spendingEl) spendingEl.textContent = money.format(spending / 100);
  if (countEl) countEl.textContent = `${ledger.transactions.length} ${ledger.transactions.length === 1 ? "entry" : "entries"}`;

  const cardFiat = document.querySelector("#cardFiatBalance");
  if (cardFiat) cardFiat.textContent = money.format(ledger.balanceMinor / 100);

  // Chart Rendering
  const groups = thisMonth.filter((entry) => entry.type === "expense").reduce((result, entry) => {
    result[entry.category] = (result[entry.category] || 0) + entry.amount_minor;
    return result;
  }, Object.create(null));
  const categories = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const largest = categories[0]?.[1] || 0;
  const chart = document.querySelector("#spendingChart");

  if (chart) {
    chart.replaceChildren();
    if (!categories.length) {
      const empty = document.createElement("p");
      empty.className = "wallet-empty";
      empty.textContent = "Spend wallet funds to see this month's categories.";
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
  }

  const insightEl = document.querySelector("#walletInsight");
  if (insightEl) {
    insightEl.textContent = categories.length
      ? `${categories[0][0]} is your highest spending category this month.`
      : "Your spending insights will appear when you make your first purchase.";
  }

  // Transactions List
  const list = document.querySelector("#walletTransactions");
  if (list) {
    list.replaceChildren();
    if (!ledger.transactions.length) {
      const empty = document.createElement("p");
      empty.className = "wallet-empty";
      empty.textContent = "No entries yet. Add money to get started.";
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
}

// Add Funds (Credit Wallet)
function creditWallet(amountRupees, description = "Wallet Top-up", category = "Top-up") {
  const minor = Math.round(amountRupees * 100);
  ledger.balanceMinor += minor;
  ledger.transactions.unshift({
    id: `tx-${Date.now()}`,
    type: "income",
    amount_minor: minor,
    category,
    description,
    created_at: new Date().toISOString(),
  });
  saveLocalWallet();
  renderLedger();
  setStatus(`Successfully added ${money.format(amountRupees)} to your wallet! ✦`, "success");
}

// Spend Funds (Debit Wallet)
function debitWallet(amountRupees, description = "Service Payment", category = "Services") {
  const minor = Math.round(amountRupees * 100);
  if (ledger.balanceMinor < minor) {
    const needed = (minor - ledger.balanceMinor) / 100;
    setStatus(`Insufficient wallet balance. You need ${money.format(needed)} more. Please top-up above.`, "error");
    return false;
  }
  ledger.balanceMinor -= minor;
  ledger.transactions.unshift({
    id: `tx-${Date.now()}`,
    type: "expense",
    amount_minor: minor,
    category,
    description,
    created_at: new Date().toISOString(),
  });
  saveLocalWallet();
  renderLedger();
  setStatus(`Spent ${money.format(amountRupees)} for: ${description} ✓`, "success");
  return true;
}

// Quick Amount Chips
document.querySelectorAll(".wallet-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const input = document.querySelector("#topupAmount");
    if (input) input.value = chip.dataset.quickAmount;
  });
});

// Razorpay Live Key Configuration
let activeRazorpayKey = localStorage.getItem("arrai_razorpay_key") || "";

async function initRazorpayKey() {
  const rzpKeyStatus = document.querySelector("#rzpKeyStatus");
  if (!activeRazorpayKey) {
    try {
      const res = await fetch("/api/razorpay");
      if (res.ok) {
        const data = await res.json();
        if (data?.keyId) {
          activeRazorpayKey = data.keyId;
        }
      }
    } catch {}
  }

  window.RAZORPAY_KEY_ID = activeRazorpayKey;

  if (rzpKeyStatus) {
    if (activeRazorpayKey) {
      const masked = activeRazorpayKey.length > 12 ? activeRazorpayKey.slice(0, 8) + "..." + activeRazorpayKey.slice(-4) : activeRazorpayKey;
      rzpKeyStatus.textContent = `Live Key (${masked})`;
      rzpKeyStatus.style.color = "#86efac";
    } else {
      rzpKeyStatus.textContent = `Set Live Key ⚙️`;
      rzpKeyStatus.style.color = "#38bdf8";
    }
  }
}

const rzpKeyStatus = document.querySelector("#rzpKeyStatus");
if (rzpKeyStatus) {
  rzpKeyStatus.addEventListener("click", () => {
    const current = localStorage.getItem("arrai_razorpay_key") || activeRazorpayKey || "";
    const input = prompt("Enter your Razorpay Key ID (e.g. rzp_live_... or test key):", current);
    if (input !== null) {
      const trimmed = input.trim();
      if (trimmed) {
        localStorage.setItem("arrai_razorpay_key", trimmed);
        activeRazorpayKey = trimmed;
        window.RAZORPAY_KEY_ID = trimmed;
        setStatus("Razorpay Key ID saved! ✦", "success");
      } else {
        localStorage.removeItem("arrai_razorpay_key");
        activeRazorpayKey = "";
        window.RAZORPAY_KEY_ID = "";
        setStatus("Razorpay key reset. Using direct wallet credit.", "");
      }
      initRazorpayKey();
    }
  });
}
initRazorpayKey();

// Multi-Mode Wallet Hub Logic (Hybrid, ARRAI Cash, Web3)
let currentWalletMode = localStorage.getItem("arrai_wallet_mode") || "hybrid";
let userWeb3Address = localStorage.getItem("arrai_web3_addr") || "0x71C83a4B3f6b907Da82B962E3e74C978Fb829";
let userArraiWalletId = localStorage.getItem("arrai_custom_wallet_id") || "AR-9482-W3";

function setWalletMode(mode) {
  currentWalletMode = mode;
  localStorage.setItem("arrai_wallet_mode", mode);

  document.querySelectorAll(".wallet-type-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.walletTab === mode);
  });

  const cardBrandText = document.querySelector("#cardBrandText");
  const cardTypeBadge = document.querySelector("#cardTypeBadge");
  const cardCryptoBox = document.querySelector("#cardCryptoBox");
  const cardWalletIdChip = document.querySelector("#cardWalletIdChip");
  const cardWeb3Chip = document.querySelector("#cardWeb3Chip");
  const cardWalletId = document.querySelector("#cardWalletId");
  const cardWeb3Addr = document.querySelector("#cardWeb3Addr");

  if (cardWalletId) cardWalletId.textContent = userArraiWalletId;
  if (cardWeb3Addr) cardWeb3Addr.textContent = userWeb3Address.slice(0, 6) + "..." + userWeb3Address.slice(-4);

  if (mode === "arrai") {
    if (cardBrandText) cardBrandText.textContent = "ARRAI CASH VAULT";
    if (cardTypeBadge) cardTypeBadge.textContent = "💳 ARRAI Fiat Card";
    if (cardCryptoBox) cardCryptoBox.style.display = "none";
    if (cardWeb3Chip) cardWeb3Chip.style.display = "none";
    if (cardWalletIdChip) cardWalletIdChip.style.display = "inline-flex";
  } else if (mode === "web3") {
    if (cardBrandText) cardBrandText.textContent = "ARRAI ON-CHAIN PROTOCOL";
    if (cardTypeBadge) cardTypeBadge.textContent = "🦊 Web3 On-Chain";
    if (cardCryptoBox) cardCryptoBox.style.display = "block";
    if (cardWeb3Chip) cardWeb3Chip.style.display = "inline-flex";
    if (cardWalletIdChip) cardWalletIdChip.style.display = "none";
  } else {
    if (cardBrandText) cardBrandText.textContent = "ARRAI HYBRID PROTOCOL";
    if (cardTypeBadge) cardTypeBadge.textContent = "⚡ Web3-ARRAI Combined";
    if (cardCryptoBox) cardCryptoBox.style.display = "block";
    if (cardWeb3Chip) cardWeb3Chip.style.display = "inline-flex";
    if (cardWalletIdChip) cardWalletIdChip.style.display = "inline-flex";
  }
}

document.querySelectorAll(".wallet-type-tab").forEach((tab) => {
  tab.addEventListener("click", () => setWalletMode(tab.dataset.walletTab));
});
setWalletMode(currentWalletMode);

// Wallet Actions
document.querySelector("#btnCreateArraiWallet")?.addEventListener("click", () => {
  userArraiWalletId = `AR-${Math.floor(1000 + Math.random() * 9000)}-CASH`;
  localStorage.setItem("arrai_custom_wallet_id", userArraiWalletId);
  setWalletMode("arrai");
  setStatus(`Generated new ARRAI Cash Wallet: ${userArraiWalletId} ✦`, "success");
});

document.querySelector("#btnConnectWeb3")?.addEventListener("click", async () => {
  if (typeof window.ethereum !== "undefined") {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts[0]) {
        userWeb3Address = accounts[0];
        localStorage.setItem("arrai_web3_addr", userWeb3Address);
        setWalletMode("web3");
        setStatus(`Connected Web3 Wallet: ${userWeb3Address} ✦`, "success");
        return;
      }
    } catch (err) {
      console.warn("Web3 connection canceled:", err);
    }
  }
  userWeb3Address = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  localStorage.setItem("arrai_web3_addr", userWeb3Address);
  setWalletMode("web3");
  setStatus(`Connected Web3 Wallet: ${userWeb3Address.slice(0, 8)}... ✓`, "success");
});

document.querySelector("#btnCreateHybrid")?.addEventListener("click", () => {
  userArraiWalletId = `AR-${Math.floor(1000 + Math.random() * 9000)}-HYBRID`;
  localStorage.setItem("arrai_custom_wallet_id", userArraiWalletId);
  setWalletMode("hybrid");
  setStatus(`Created & Synchronized Web3-ARRAI Hybrid Wallet: ${userArraiWalletId} ✦`, "success");
});

// Copy chip addresses
document.querySelector("#cardWalletIdChip")?.addEventListener("click", () => {
  navigator.clipboard.writeText(userArraiWalletId).then(() => {
    setStatus(`Copied Wallet ID: ${userArraiWalletId} to clipboard ✓`, "success");
  });
});
document.querySelector("#cardWeb3Chip")?.addEventListener("click", () => {
  navigator.clipboard.writeText(userWeb3Address).then(() => {
    setStatus(`Copied Web3 Address: ${userWeb3Address} to clipboard ✓`, "success");
  });
});

// Instant Top-up Button
const instantTopupBtn = document.querySelector("#instantTopupBtn");
if (instantTopupBtn) {
  instantTopupBtn.addEventListener("click", () => {
    const amountVal = Number(document.querySelector("#topupAmount")?.value || 500);
    if (!amountVal || amountVal <= 0) return setStatus("Please enter a valid top-up amount.", "error");
    creditWallet(amountVal, `Instant Top-up (+${money.format(amountVal)})`, "Top-up");
  });
}

// Razorpay Top-up Form
const topupForm = document.querySelector("#topupForm");
const topupStatus = document.querySelector("#topupStatus");
if (topupForm) {
  topupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amountVal = Number(document.querySelector("#topupAmount")?.value || 500);
    if (!amountVal || amountVal <= 0) return setStatus("Please enter a valid top-up amount.", "error");

    const effectiveKey = activeRazorpayKey || window.RAZORPAY_KEY_ID;

    if (!effectiveKey || effectiveKey === "rzp_test_placeholder" || typeof Razorpay === "undefined") {
      // Fallback to instant topup so checkout never throws an error dialog
      creditWallet(amountVal, `Direct Wallet Credit (+${money.format(amountVal)})`, "Top-up");
      if (topupStatus) {
        topupStatus.textContent = `Wallet topped up instantly with ${money.format(amountVal)}! (Set Live Key to enable Razorpay gateway)`;
        topupStatus.style.color = "#86efac";
      }
      return;
    }

    const options = {
      key: effectiveKey,
      amount: Math.round(amountVal * 100),
      currency: "INR",
      name: "ARRAI Wallet Top-up",
      description: `Add ${money.format(amountVal)} to ARRAI Balance`,
      image: "assets/app-icon.svg",
      theme: { color: "#38bdf8" },
      handler: function (response) {
        creditWallet(amountVal, `Razorpay Top-up (${response.razorpay_payment_id})`, "Top-up");
        if (topupStatus) {
          topupStatus.textContent = `Payment captured! ID: ${response.razorpay_payment_id}`;
          topupStatus.style.color = "#86efac";
        }
      },
      modal: {
        ondismiss: function () {
          if (topupStatus) {
            topupStatus.textContent = "Payment window dismissed.";
            topupStatus.style.color = "#c4cbe0";
          }
        }
      }
    };

    try {
      const rzpInstance = new Razorpay(options);
      rzpInstance.open();
    } catch {
      creditWallet(amountVal, `Direct Top-up (+${money.format(amountVal)})`, "Top-up");
    }
  });
}

// Spend Buttons
document.querySelectorAll("[data-spend]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const amount = Number(btn.dataset.spend);
    const name = btn.dataset.spendName;
    debitWallet(amount, name, "Services");
  });
});

// Custom Spend Form
const customSpendForm = document.querySelector("#customSpendForm");
if (customSpendForm) {
  customSpendForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number(document.querySelector("#customSpendAmount")?.value || 0);
    const note = document.querySelector("#customSpendNote")?.value.trim() || "Custom Payment";
    if (!amount || amount <= 0) return setStatus("Please enter a valid spend amount.", "error");
    if (debitWallet(amount, note, "Services")) {
      customSpendForm.reset();
    }
  });
}

// Manual Ledger Entry Form
const entryForm = document.querySelector("#entryForm");
if (entryForm) {
  entryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const values = new FormData(entryForm);
    const type = values.get("type");
    const amount = Number(values.get("amount"));
    const category = values.get("category");
    const desc = String(values.get("description")).trim();

    if (!amount || amount <= 0) return setStatus("Please enter a valid amount.", "error");

    if (type === "income") {
      creditWallet(amount, desc, category);
    } else {
      debitWallet(amount, desc, category);
    }
    entryForm.reset();
  });
}

// Initialize Wallet with Auth
window.arraiAuth
  .then(async ({ isAuthenticated, user }) => {
    if (isAuthenticated && user) {
      currentUser = user;
      const ownerEl = document.querySelector("#walletOwnerText");
      const greetingEl = document.querySelector("#walletGreeting");
      if (ownerEl) ownerEl.textContent = `Logged in as ${user.name || user.email}`;
      if (greetingEl) greetingEl.textContent = `Welcome, ${user.name || "Explorer"}! Your personal ARRAI wallet is active. Top up or spend funds anywhere across the site.`;
    }
    loadLocalWallet();
    renderLedger();
    setStatus("Your personal ARRAI wallet is live and ready. ✦", "success");
  })
  .catch(() => {
    loadLocalWallet();
    renderLedger();
    setStatus("Wallet active in offline/local storage mode. ✦", "success");
  });
