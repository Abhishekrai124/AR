import crypto from "node:crypto";

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const { orderId, paymentId, signature, product } = request.body || {};
  if (!secret || !orderId || !paymentId || !signature) return response.status(400).json({ error: "Invalid payment response." });
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const received = Buffer.from(String(signature), "hex");
  const valid = received.length === 32 && crypto.timingSafeEqual(Buffer.from(expected, "hex"), received);
  if (!valid) return response.status(400).json({ error: "Payment verification failed." });
  const bearer = request.headers.authorization || "";
  const supabaseUrl = process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!bearer.startsWith("Bearer ") || !serviceKey) return response.status(200).json({ verified: true, activation: "pending" });
  const auth = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY || "", Authorization: bearer } });
  const user = await auth.json();
  if (product === "vip" && auth.ok && user.id) await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ is_vip: true, vip_badge: "purchased", gold_tick: true, vip_granted_at: new Date().toISOString() }) });
  return response.status(200).json({ verified: true, activation: "complete" });
}
