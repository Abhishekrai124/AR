const paymentStatus = document.querySelector("#paymentStatus");
const paymentApp = document.querySelector("#paymentApp");
const state = { user: null, wallet: null };

function setStatus(message, type = "") {
  paymentStatus.textContent = message;
  paymentStatus.className = `community-status ${type}`;
}

async function walletRequest(action, method = "GET", body, query = {}) {
  const { data } = await window.arraiSupabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your sign-in expired. Please sign in again.");
  const url = new URL("/api/wallet", location.origin);
  url.searchParams.set("action", action);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Wallet request failed.");
  return result;
}

function money(paise) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(paise || 0) / 100);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTransactions(transactions) {
  const list = document.querySelector("#walletTransactions");
  list.replaceChildren();
  if (!transactions.length) {
    list.append(element("p", "empty-state", "No wallet activity yet."));
    return;
  }
  for (const transaction of transactions) {
    const row = element("article", "wallet-transaction");
    const details = element("div");
    details.append(
      element(
        "b",
        "",
        transaction.description || transaction.kind.replaceAll("_", " "),
      ),
      element(
        "small",
        "",
        `${transaction.counterparty_name || transaction.kind.replaceAll("_", " ")} · ${new Date(transaction.created_at).toLocaleString()}`,
      ),
    );
    const amount = element(
      "strong",
      transaction.direction === "credit" ? "wallet-credit" : "wallet-debit",
      `${transaction.direction === "credit" ? "+" : "−"}${money(transaction.amount_paise)}`,
    );
    row.append(details, amount);
    list.append(row);
  }
}

function renderRequests(requests) {
  const list = document.querySelector("#walletRequests");
  list.replaceChildren();
  if (!requests.length) {
    list.append(element("p", "empty-state", "You have no payment requests yet."));
    return;
  }
  for (const request of requests) {
    const row = element("article", "wallet-request-row");
    const description =
      request.requester_id === state.user.id
        ? request.note || "Money you requested"
        : request.note || "Member payment request";
    const details = element("div");
    details.append(
      element("b", "", description),
      element(
        "small",
        "",
        `${request.status} · ${new Date(request.created_at).toLocaleDateString()}`,
      ),
    );
    row.append(details, element("strong", "", money(request.amount_paise)));
    if (request.requester_id === state.user.id && request.status === "open") {
      const cancel = element("button", "button wallet-cancel", "Cancel");
      cancel.type = "button";
      cancel.addEventListener("click", async () => {
        cancel.disabled = true;
        try {
          await walletRequest("cancel-request", "POST", { id: request.id });
          await refreshWallet();
          setStatus("Payment request cancelled.", "success");
        } catch (error) {
          cancel.disabled = false;
          setStatus(error.message, "error");
        }
      });
      row.append(cancel);
    }
    list.append(row);
  }
}

async function refreshWallet() {
  const result = await walletRequest("overview");
  state.wallet = result.wallet;
  document.querySelector("#walletBalance").textContent = money(
    result.wallet.balance_paise,
  );
  document.querySelector("#walletUsername").textContent =
    `@${result.profile.username}`;
  document.querySelector("#walletCode").textContent =
    result.wallet.referral_code || "Not available";
  renderTransactions(result.transactions);
  renderRequests(result.requests);
  return result;
}

function amountToPaise(value) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!match)
    throw new Error("Enter a valid amount with up to two decimal places.");
  const amount = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("Enter a valid amount with up to two decimal places.");
  return amount;
}

function setBusy(form, busy) {
  form.querySelectorAll("button").forEach((button) => {
    button.disabled = busy;
  });
}

document.querySelector("#copyWalletCode").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(
      document.querySelector("#walletCode").textContent,
    );
    setStatus("Wallet code copied.", "success");
  } catch {
    setStatus("Could not copy the wallet code. Select and copy it instead.", "error");
  }
});

document.querySelector("#refreshWallet").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  try {
    await refreshWallet();
    setStatus("Wallet activity refreshed.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    event.currentTarget.disabled = false;
  }
});

document
  .querySelector('#sendForm [name="recipient"]')
  .addEventListener("blur", async (event) => {
    const identifier = event.currentTarget.value.trim();
    const preview = document.querySelector("#recipientPreview");
    if (!identifier) {
      preview.textContent = "Verify the member name before you send.";
      preview.classList.remove("is-error");
      return;
    }
    preview.textContent = "Checking ARRAI member…";
    preview.classList.remove("is-error");
    try {
      const result = await walletRequest("lookup", "GET", undefined, {
        q: identifier,
      });
      preview.textContent = `Recipient: ${result.member.displayName} · @${result.member.username}`;
    } catch (error) {
      preview.textContent = error.message;
      preview.classList.add("is-error");
    }
  });

document.querySelector("#topupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  setBusy(form, true);
  try {
    const amount = Number(new FormData(form).get("amount"));
    const order = await walletRequest("topup-order", "POST", { amount });
    if (!window.Razorpay) throw new Error("Secure checkout did not load. Refresh and try again.");
    let finished = false;
    const checkout = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: "ARRAI Pay Demo",
      description: "Test wallet top-up · no cash value",
      order_id: order.order_id,
      handler: async (payment) => {
        finished = true;
        try {
          await walletRequest("verify-topup", "POST", {
            orderId: payment.razorpay_order_id,
            paymentId: payment.razorpay_payment_id,
            signature: payment.razorpay_signature,
          });
          await refreshWallet();
          setStatus("Test payment verified. Demo balance updated.", "success");
        } catch (error) {
          setStatus(
            `Payment returned, but wallet verification did not finish: ${error.message}`,
            "error",
          );
        } finally {
          setBusy(form, false);
        }
      },
      modal: {
        ondismiss: () => {
          if (!finished) {
            setStatus("Test checkout closed. No demo balance was added.");
            setBusy(form, false);
          }
        },
      },
      theme: { color: "#38bdf8" },
    });
    checkout.on("payment.failed", (failure) => {
      finished = true;
      setStatus(failure.error?.description || "Test checkout failed.", "error");
      setBusy(form, false);
    });
    checkout.open();
    setStatus("Secure test checkout opened. No real funds are being added.");
  } catch (error) {
    setStatus(error.message, "error");
    setBusy(form, false);
  }
});

document.querySelector("#sendForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const recipient = String(values.get("recipient")).trim();
  const amount = Number(values.get("amount"));
  const note = String(values.get("note") || "").trim();
  let amountPaise;
  try {
    amountPaise = amountToPaise(amount);
    if (amountPaise < 100 || amountPaise > 1000000)
      throw new Error("Transfers must be between ₹1 and ₹10,000.");
  } catch (error) {
    setStatus(error.message, "error");
    return;
  }
  if (!window.confirm(`Send ${money(amountPaise)} to ${recipient}? This demo transfer cannot be reversed in the app.`))
    return;
  const pendingKey = "arraiWalletPendingTransfer";
  const previous = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
  const sameTransfer =
    previous?.recipient === recipient &&
    previous?.amountPaise === amountPaise &&
    previous?.note === note;
  const reference = sameTransfer ? previous.reference : crypto.randomUUID();
  sessionStorage.setItem(
    pendingKey,
    JSON.stringify({ recipient, amountPaise, note, reference }),
  );
  setBusy(form, true);
  try {
    await walletRequest("transfer", "POST", {
      recipient,
      amountPaise,
      note,
      reference,
    });
    sessionStorage.removeItem(pendingKey);
    await refreshWallet();
    form.reset();
    setStatus(`Demo transfer of ${money(amountPaise)} sent to ${recipient}.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(form, false);
  }
});

document.querySelector("#requestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  let amountPaise;
  try {
    amountPaise = amountToPaise(values.get("amount"));
    if (amountPaise < 100 || amountPaise > 1000000)
      throw new Error("Requests must be between ₹1 and ₹10,000.");
  } catch (error) {
    setStatus(error.message, "error");
    return;
  }
  setBusy(form, true);
  try {
    const result = await walletRequest("create-request", "POST", {
      amountPaise,
      note: String(values.get("note") || "").trim(),
    });
    const share = document.querySelector("#requestShare");
    document.querySelector("#requestLink").value = result.shareUrl;
    document.querySelector("#requestQr").hidden = true;
    document.querySelector("#requestQr").removeAttribute("src");
    share.hidden = false;
    await refreshWallet();
    setStatus("Payment link created. Share it with the ARRAI member who owes you.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(form, false);
  }
});

document.querySelector("#copyRequestLink").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(document.querySelector("#requestLink").value);
    setStatus("Payment link copied.", "success");
  } catch {
    setStatus("Could not copy the link. Select and copy it instead.", "error");
  }
});

document.querySelector("#showRequestQr").addEventListener("click", () => {
  const qr = document.querySelector("#requestQr");
  const link = document.querySelector("#requestLink").value;
  if (!link) return setStatus("Create a payment link first.", "error");
  qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;
  qr.hidden = false;
});

async function loadPaymentRequest() {
  const token = new URLSearchParams(location.search).get("request");
  if (!token) return;
  const card = document.querySelector("#payRequestCard");
  card.hidden = false;
  try {
    const result = await walletRequest(
      "payment-request",
      "GET",
      undefined,
      { token },
    );
    const request = result.request;
    document.querySelector("#payRequestTitle").textContent =
      `${money(request.amount_paise)} requested by @${result.requester?.username || "ARRAI member"}`;
    document.querySelector("#payRequestDescription").textContent =
      request.note || "ARRAI Pay member request";
    const button = document.querySelector("#payRequestButton");
    if (request.status !== "open" || new Date(request.expires_at) <= new Date()) {
      button.disabled = true;
      button.textContent =
        request.status === "paid" ? "Already paid" : "Request unavailable";
    } else if (request.requester_id === state.user.id) {
      button.disabled = true;
      button.textContent = "This is your request";
    } else {
      button.addEventListener("click", async () => {
        if (
          !window.confirm(
            `Pay ${money(request.amount_paise)} from your demo wallet to @${result.requester?.username || "this member"}?`,
          )
        )
          return;
        button.disabled = true;
        const key = `arraiWalletRequest:${token}`;
        const reference = sessionStorage.getItem(key) || crypto.randomUUID();
        sessionStorage.setItem(key, reference);
        try {
          await walletRequest("pay-request", "POST", { token, reference });
          sessionStorage.removeItem(key);
          await refreshWallet();
          button.textContent = "Paid from demo wallet";
          setStatus("Payment request paid. Demo balances were updated.", "success");
        } catch (error) {
          button.disabled = false;
          setStatus(error.message, "error");
        }
      });
    }
  } catch (error) {
    document.querySelector("#payRequestTitle").textContent = "Request unavailable";
    document.querySelector("#payRequestDescription").textContent = error.message;
    document.querySelector("#payRequestButton").hidden = true;
  }
}

document.querySelector("#vipPayButton").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const orderResponse = await fetch("/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 45, product: "vip" }),
    });
    const order = await orderResponse.json();
    if (!orderResponse.ok) throw new Error(order.error || "Could not start checkout.");
    const checkout = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: "ARRAI",
      description: "Gold VIP membership",
      order_id: order.order_id,
      handler: async (payment) => {
        try {
          const { data } = await window.arraiSupabase.auth.getSession();
          const verified = await fetch("/api/payments/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session?.access_token || ""}`,
            },
            body: JSON.stringify({
              orderId: payment.razorpay_order_id,
              paymentId: payment.razorpay_payment_id,
              signature: payment.razorpay_signature,
              product: "vip",
            }),
          });
          const result = await verified.json();
          if (!verified.ok || !result.verified)
            throw new Error(result.error || "VIP payment is pending verification.");
          setStatus("Payment verified. VIP activation is processing.", "success");
        } catch (error) {
          setStatus(
            `Payment received, but VIP verification could not be completed: ${error.message}`,
            "error",
          );
        } finally {
          button.disabled = false;
        }
      },
      modal: { ondismiss: () => (button.disabled = false) },
      theme: { color: "#38bdf8" },
    });
    checkout.on("payment.failed", (failure) => {
      setStatus(failure.error?.description || "Payment failed.", "error");
      button.disabled = false;
    });
    checkout.open();
  } catch (error) {
    setStatus(error.message, "error");
    button.disabled = false;
  }
});

window.arraiAuth
  .then(async ({ isAuthenticated, user }) => {
    if (!isAuthenticated) {
      const next = new URLSearchParams(location.search).get("request");
      const returnQuery = next ? `&request=${encodeURIComponent(next)}` : "";
      window.location.assign(`auth.html?next=payments${returnQuery}`);
      return;
    }
    state.user = user;
    paymentApp.hidden = false;
    await refreshWallet();
    await loadPaymentRequest();
    setStatus("Demo wallet ready. Demo balances have no cash value.");
  })
  .catch((error) =>
    setStatus(error.message || "Could not check your sign-in.", "error"),
  );
