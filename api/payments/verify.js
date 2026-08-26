import crypto from "node:crypto";

export default function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const { orderId, paymentId, signature } = request.body || {};
  if (!secret || !orderId || !paymentId || !signature) return response.status(400).json({ error: "Invalid payment response." });
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const valid = crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  return valid ? response.status(200).json({ verified: true }) : response.status(400).json({ error: "Payment verification failed." });
}
