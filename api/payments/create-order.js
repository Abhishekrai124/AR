import crypto from "node:crypto";

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return response.status(500).json({ error: "Razorpay is not configured yet." });

  const amount = Number(request.body?.amount);
  if (!Number.isInteger(amount) || amount < 10 || amount > 10000) {
    return response.status(400).json({ error: "Choose an amount between ₹10 and ₹10,000." });
  }

  try {
    const upstream = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: amount * 100, currency: "INR", receipt: `ar_${crypto.randomUUID().replaceAll("-", "").slice(0, 28)}`, notes: { product: "arrai_test_payment" } }),
    });
    const order = await upstream.json();
    if (!upstream.ok) throw new Error(order.error?.description || "Could not create order.");
    return response.status(200).json({ id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) { return response.status(502).json({ error: error.message }); }
}
