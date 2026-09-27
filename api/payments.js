import crypto from "node:crypto";

const parsedBody = (body) => {
  if (typeof body !== "string") return body && typeof body === "object" ? body : {};
  try { return JSON.parse(body); } catch { return {}; }
};

const createOrder = async (request, response) => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || "").trim();
  if (!keyId || !keySecret) return response.status(500).json({ error: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel Production environment, then redeploy." });
  const body = parsedBody(request.body);
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < 10 || amount > 10000)
    return response.status(400).json({ error: "Choose an amount between ₹10 and ₹10,000." });
  const product = ["vip", "recharge"].includes(body.product) ? body.product : "payment";
  if (product === "vip" && amount !== 45) return response.status(400).json({ error: "VIP membership costs ₹45." });
  try {
    const upstream = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amount * 100, currency: "INR", receipt: `ar_${crypto.randomUUID().replaceAll("-", "").slice(0, 28)}`, notes: { product: product === "vip" ? "arrai_gold_vip" : product === "recharge" ? "arrai_recharge" : "arrai_payment" } }),
    });
    const raw = await upstream.text();
    let order;
    try { order = JSON.parse(raw); } catch { order = {}; }
    if (!upstream.ok) return response.status(upstream.status === 401 ? 401 : 500).json({ error: `Razorpay rejected the order: ${order.error?.description || raw.slice(0, 180) || "check your test key pair"}` });
    return response.status(200).json({ order_id: order.id, amount: order.amount, currency: order.currency, key_id: keyId });
  } catch (error) { return response.status(500).json({ error: error.message }); }
};

const verifyPayment = async (request, response) => {
  const secret = String(process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || "").trim();
  const keyId = String(process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || "").trim();
  if (!secret || !keyId) return response.status(500).json({ error: "Razorpay is not configured." });
  const { orderId, paymentId, signature, product = "payment" } = parsedBody(request.body);
  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string" || !orderId || !paymentId || !signature || !["payment", "vip", "recharge"].includes(product)) return response.status(400).json({ error: "Invalid payment response." });
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  if (!/^[a-f\d]{64}$/i.test(signature)) return response.status(400).json({ error: "Payment verification failed." });
  const received = Buffer.from(signature, "hex");
  if (received.length !== 32 || !crypto.timingSafeEqual(Buffer.from(expected, "hex"), received)) return response.status(400).json({ error: "Payment verification failed." });
  try {
    const orderCheck = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}` } });
    const order = await orderCheck.json().catch(() => ({}));
    if (orderCheck.status === 401) return response.status(401).json({ error: "Razorpay authentication failed." });
    const expectedProduct = product === "vip" ? "arrai_gold_vip" : product === "recharge" ? "arrai_recharge" : "arrai_payment";
    if (!orderCheck.ok || order.id !== orderId || Number(order.amount) < 1000 || Number(order.amount) > 1000000 || order.status !== "paid" || order.notes?.product !== expectedProduct || (product === "vip" && Number(order.amount) !== 4500)) return response.status(400).json({ error: "Order could not be confirmed." });
  } catch { return response.status(500).json({ error: "Could not confirm the Razorpay order." }); }
  const bearer = request.headers.authorization || "";
  const supabaseUrl = process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!bearer.startsWith("Bearer ") || !serviceKey) return response.status(200).json({ verified: true, activation: "pending" });
  const auth = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY || "", Authorization: bearer } });
  const user = await auth.json();
  if (product === "vip" && auth.ok && user.id) await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ is_vip: true, vip_badge: "purchased", gold_tick: true, vip_granted_at: new Date().toISOString() }) });
  return response.status(200).json({ verified: true, activation: "complete" });
};

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const action = request.query?.action || new URL(request.url, "http://localhost").searchParams.get("action");
  if (action === "create-order") return createOrder(request, response);
  if (action === "verify") return verifyPayment(request, response);
  return response.status(404).json({ error: "Unknown payment endpoint." });
}
