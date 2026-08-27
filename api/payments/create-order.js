import crypto from "node:crypto";

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const keyId = String(process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || "").trim();
  if (!keyId || !keySecret) return response.status(500).json({ error: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel Production environment, then redeploy." });

  const body = typeof request.body === "string" ? (() => { try { return JSON.parse(request.body); } catch { return {}; } })() : (request.body || {});
  const amount = Number(body.amount);
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
      body: JSON.stringify({ amount: amount * 100, currency: "INR", receipt: `ar_${crypto.randomUUID().replaceAll("-", "").slice(0, 28)}`, notes: { product: body.product === "vip" ? "arrai_gold_vip" : "arrai_payment" } }),
    });
    const raw = await upstream.text(); let order; try { order = JSON.parse(raw); } catch { order = {}; }
    if (!upstream.ok) throw new Error(`Razorpay rejected the order (${upstream.status}): ${order.error?.description || raw.slice(0, 180) || "check your live/test key pair"}`);
    return response.status(200).json({ id: order.id, amount: order.amount, currency: order.currency, key: keyId });
  } catch (error) { return response.status(502).json({ error: error.message }); }
}
