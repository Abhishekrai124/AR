const paymentStatus = document.querySelector("#paymentStatus");
const paymentApp = document.querySelector("#paymentApp");
const payButton = document.querySelector("#payButton");
let selectedAmount = 49;

function setStatus(message, type = "") { paymentStatus.textContent = message; paymentStatus.className = `community-status ${type}`; }

document.querySelectorAll("[data-amount]").forEach((button) => button.addEventListener("click", () => {
  selectedAmount = Number(button.dataset.amount);
  document.querySelectorAll("[data-amount]").forEach((item) => item.classList.toggle("selected-amount", item === button));
}));

payButton.addEventListener("click", async () => {
  try {
    payButton.disabled = true;
    setStatus("Creating your secure test payment…");
    const orderResponse = await fetch("/api/payments/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: selectedAmount }) });
    const order = await orderResponse.json();
    if (!orderResponse.ok) throw new Error(order.error);
    const checkout = new Razorpay({
      key: "rzp_test_TUJkYyPOllTD2q",
      amount: order.amount,
      currency: order.currency,
      name: "arrai.in",
      description: "Test payment",
      order_id: order.id,
      handler: async (payment) => {
        const verified = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: payment.razorpay_order_id, paymentId: payment.razorpay_payment_id, signature: payment.razorpay_signature }) });
        const result = await verified.json();
        setStatus(verified.ok && result.verified ? "Test payment verified successfully." : result.error, verified.ok ? "success" : "error");
      },
      theme: { color: "#0284c7" },
    });
    checkout.on("payment.failed", (response) => setStatus(response.error.description || "Payment failed.", "error"));
    checkout.open();
  } catch (error) { setStatus(error.message || "Could not start payment.", "error"); }
  finally { payButton.disabled = false; }
});

window.arraiAuth.then(({ isAuthenticated }) => {
  if (!isAuthenticated) return window.location.assign("auth.html");
  paymentApp.hidden = false;
  setStatus("Test Mode: do not use real money.", "success");
}).catch(() => setStatus("Could not check your sign-in.", "error"));
