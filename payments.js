const paymentStatus = document.querySelector("#paymentStatus");
const paymentApp = document.querySelector("#paymentApp");
const payButton = document.querySelector("#payButton");
let selectedAmount = 49;
const vipPayButton = document.querySelector("#vipPayButton");
const walletPanel = document.querySelector("#walletPanel");
const walletBalance = document.querySelector("#walletBalance");
const walletFundId = document.querySelector("#walletFundId");
const walletLedger = document.querySelector("#walletLedger");

async function loadWallet() {
  const session = (await window.arraiSupabase.auth.getSession()).data.session;
  const result = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${session?.access_token || ""}` } });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.error || "Wallet is unavailable.");
  walletPanel.hidden = false;
  walletBalance.textContent = `₹${(payload.wallet.balance_paise / 100).toFixed(2)}`;
  walletFundId.textContent = `Fund ID: ${payload.wallet.fund_id}`;
  walletLedger.innerHTML = payload.transactions.length
    ? payload.transactions.map((tx) => `<div class="wallet-entry"><span>${tx.direction === "credit" ? "+" : "−"} ₹${(Number(tx.amount_paise) / 100).toFixed(2)}<small>${escapeHtml(tx.description || tx.kind)}</small></span><time datetime="${escapeHtml(tx.created_at)}">${new Date(tx.created_at).toLocaleDateString()}</time></div>`).join("")
    : "<p>No ledger activity yet.</p>";
}

// Payment UI can be warm and playful, but verification must stay boringly exact.
// Romance belongs in the copy; money belongs behind server-side checks. 💳
const notify = (text) => {
  if ("Notification" in window && Notification.permission === "granted")
    new Notification("Arrai Pay", { body: text });
};

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

function setStatus(message, type = "") {
  paymentStatus.textContent = message;
  paymentStatus.className = `community-status ${type}`;
}

document.querySelectorAll("[data-amount]").forEach((button) =>
  button.addEventListener("click", () => {
    selectedAmount = Number(button.dataset.amount);
    document
      .querySelectorAll("[data-amount]")
      .forEach((item) =>
        item.classList.toggle("selected-amount", item === button),
      );
  }),
);

async function startCheckout(
  product = "payment",
  amount = selectedAmount,
  button = payButton,
) {
  try {
    button.disabled = true;
    setStatus("Creating your secure test payment…");
    const orderResponse = await fetch("/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        product,
      }),
    });
    const order = await orderResponse.json();
    if (!orderResponse.ok) throw new Error(order.error);
    let paymentCompleted = false;
    const checkout = new Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: "arrai.in",
      description:
        product === "vip" ? "Arrai Gold VIP membership" : "Arrai payment",
      order_id: order.order_id,
      handler: async (payment) => {
        paymentCompleted = true;
        try {
          const session = (await window.arraiSupabase.auth.getSession()).data
            .session;
          const verified = await fetch("/api/payments/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token || ""}`,
            },
            body: JSON.stringify({
              orderId: payment.razorpay_order_id,
              paymentId: payment.razorpay_payment_id,
              signature: payment.razorpay_signature,
              product,
            }),
          });
          const result = await verified.json();
          const text =
            verified.ok && result.verified
              ? product === "vip"
                ? "Payment verified. VIP activation is processing."
                : product === "recharge"
                  ? "Payment verified. Recharge request is queued."
                  : "Payment verified successfully."
              : result.error || "Payment is pending verification.";
          setStatus(text, verified.ok ? "success" : "error");
          notify(text);
          if (verified.ok) {
            loadWallet().catch(() => {
              // Payment verification remains authoritative if the wallet refresh is unavailable.
            });
          }
        } catch {
          setStatus(
            "Payment received, but verification could not be completed. Contact support.",
            "error",
          );
        }
      },
      modal: {
        ondismiss: () => {
          if (!paymentCompleted) setStatus("Payment cancelled.");
        },
      },
      theme: { color: "#0284c7" },
    });
    checkout.on("payment.failed", (response) =>
      setStatus(response.error.description || "Payment failed.", "error"),
    );
    checkout.open();
  } catch (error) {
    setStatus(error.message || "Could not start payment.", "error");
  } finally {
    button.disabled = false;
  }
}
payButton.addEventListener("click", () => startCheckout());
document.querySelector("#customAmount")?.addEventListener("input", (event) => {
  const value = Number(event.target.value);
  if (value >= 10) selectedAmount = value;
});
vipPayButton?.addEventListener("click", () =>
  startCheckout("vip", 45, vipPayButton),
);
document.querySelector("#rechargeButton")?.addEventListener("click", () => {
  const phone = document
    .querySelector("#rechargePhone")
    .value.replace(/\D/g, "");
  const amount = Number(document.querySelector("#rechargeAmount").value);
  if (!/^\d{10}$/.test(phone))
    return setStatus("Enter a valid 10-digit mobile number.", "error");
  if (amount < 10 || amount > 5000)
    return setStatus(
      "Recharge amount must be between ₹10 and ₹5,000.",
      "error",
    );
  startCheckout("recharge", amount, document.querySelector("#rechargeButton"));
});
document.querySelector("#generateUpi")?.addEventListener("click", () => {
  const amount = Number(document.querySelector("#upiAmount").value);
  const upi = document.querySelector("#upiId").value.trim();
  if (!amount || !upi.includes("@"))
    return setStatus("Enter a valid amount and UPI ID.", "error");
  const data = `upi://pay?pa=${encodeURIComponent(upi)}&pn=Arrai%20VIP&am=${amount.toFixed(2)}&cu=INR`;
  const qr = document.querySelector("#upiQr");
  qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data)}`;
  qr.hidden = false;
  setStatus("UPI QR ready. Confirm payment in your UPI app.", "success");
});

window.arraiAuth
  .then(({ isAuthenticated }) => {
    if (!isAuthenticated) return window.location.assign("auth.html");
    paymentApp.hidden = false;
    loadWallet().catch((error) => {
      walletPanel.hidden = false;
      walletLedger.innerHTML = `<p>${error.message || "Wallet is unavailable."}</p>`;
    });
    if ("Notification" in window && Notification.permission === "default")
      Notification.requestPermission().catch(() => {});
    setStatus(
      "Razorpay checkout ready. Configure live keys before accepting real money.",
      "success",
    );
  })
  .catch(() => setStatus("Could not check your sign-in.", "error"));
