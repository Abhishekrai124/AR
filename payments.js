const paymentStatus = document.querySelector("#paymentStatus");
const paymentApp = document.querySelector("#paymentApp");
const payButton = document.querySelector("#payButton");
let selectedAmount = 49;
const vipPayButton = document.querySelector("#vipPayButton");

function setStatus(message, type = "") { paymentStatus.textContent = message; paymentStatus.className = `community-status ${type}`; }

document.querySelectorAll("[data-amount]").forEach((button) => button.addEventListener("click", () => {
  selectedAmount = Number(button.dataset.amount);
  document.querySelectorAll("[data-amount]").forEach((item) => item.classList.toggle("selected-amount", item === button));
}));

async function startCheckout(product = "payment") {
  try {
    payButton.disabled = true;
    setStatus("Creating your secure test payment…");
    const orderResponse = await fetch("/api/payments/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: product === "vip" ? 45 : selectedAmount, product }) });
    const order = await orderResponse.json();
    if (!orderResponse.ok) throw new Error(order.error);
    const checkout = new Razorpay({
      key: order.key,
      amount: order.amount,
      currency: order.currency,
      name: "arrai.in",
      description: product === "vip" ? "Arrai Gold VIP membership" : "Arrai payment",
      order_id: order.id,
      handler: async (payment) => {
        const session = (await window.arraiSupabase.auth.getSession()).data.session;
        const verified = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify({ orderId: payment.razorpay_order_id, paymentId: payment.razorpay_payment_id, signature: payment.razorpay_signature, product }) });
        const result = await verified.json();
        setStatus(verified.ok && result.verified ? (product === "vip" ? "Payment verified. VIP activation is processing." : "Payment verified successfully.") : result.error, verified.ok ? "success" : "error");
      },
      theme: { color: "#0284c7" },
    });
    checkout.on("payment.failed", (response) => setStatus(response.error.description || "Payment failed.", "error"));
    checkout.open();
  } catch (error) { setStatus(error.message || "Could not start payment.", "error"); }
  finally { payButton.disabled = false; }
}
payButton.addEventListener("click", () => startCheckout());
document.querySelector("#customAmount")?.addEventListener("input", (event) => { const value = Number(event.target.value); if (value >= 10) selectedAmount = value; });
vipPayButton?.addEventListener("click", () => startCheckout("vip"));
document.querySelector("#generateUpi")?.addEventListener("click", () => { const amount = Number(document.querySelector("#upiAmount").value); const upi = document.querySelector("#upiId").value.trim(); if (!amount || !upi.includes("@")) return setStatus("Enter a valid amount and UPI ID.", "error"); const data = `upi://pay?pa=${encodeURIComponent(upi)}&pn=Arrai%20VIP&am=${amount.toFixed(2)}&cu=INR`; const qr = document.querySelector("#upiQr"); qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data)}`; qr.hidden = false; setStatus("UPI QR ready. Confirm payment in your UPI app.", "success"); });

window.arraiAuth.then(({ isAuthenticated }) => {
  if (!isAuthenticated) return window.location.assign("auth.html");
  paymentApp.hidden = false;
  setStatus("Razorpay checkout ready. Configure live keys before accepting real money.", "success");
}).catch(() => setStatus("Could not check your sign-in.", "error"));
