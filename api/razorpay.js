export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") return response.status(200).end();

  const keyId =
    process.env.RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_LIVE_KEY_ID ||
    "";

  if (request.method === "GET") {
    return response.status(200).json({
      keyId: keyId.trim(),
      configured: Boolean(keyId.trim()),
    });
  }

  return response.status(405).json({ error: "Method not allowed" });
}
