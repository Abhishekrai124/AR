const supabaseUrl =
  process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";
import { adminFetch, privateRateHash, safeText, sendTransactionalEmail } from "../lib/detective-security.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Personal contact details require a real Supabase session, never a magic URL.
// Cute website, serious boundary.

export default async function handler(request, response) {
  if (request.method === "POST") {
    try {
      const name = safeText(request.body?.name, 120);
      const email = safeText(request.body?.email, 254).toLowerCase();
      const topic = safeText(request.body?.topic, 80);
      const message = safeText(request.body?.message, 1000);
      if (name.length < 2 || !emailPattern.test(email) || topic.length < 2 || message.length < 2)
        return response.status(400).json({ error: "Enter your name, a valid email and a short message." });
      const ip = String(request.headers["x-forwarded-for"] || "unknown").split(",")[0].trim().slice(0, 80);
      const allowed = await adminFetch("/rest/v1/rpc/consume_detective_intake_limits", { method: "POST", body: JSON.stringify({ p_ip_hash: privateRateHash(ip), p_email_hash: privateRateHash(email) }) });
      if (!allowed.ok) throw new Error("Inquiry service is temporarily unavailable.");
      if (!(await allowed.json())) return response.status(429).json({ error: "Too many messages. Please try again in a few minutes." });
      const saved = await adminFetch("/rest/v1/detective_inquiries", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ name, email, topic, message }) });
      if (!saved.ok) throw new Error("Your inquiry could not be saved.");
      const sent = await sendTransactionalEmail({ to: process.env.ROUTINE_CASE_EMAIL || "arraidetectiveagency@gmail.com", subject: `ARRAI inquiry · ${topic}`, text: `New inquiry received. Review the private register.`, html: `<p>A new ARRAI inquiry was received. Review the private register.</p>` });
      return response.status(201).json({ ok: true, emailSent: sent.sent === true });
    } catch (error) { return response.status(500).json({ error: error.message || "Inquiry service failed." }); }
  }
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const bearer = request.headers.authorization || "";
  if (!bearer.startsWith("Bearer "))
    return response
      .status(401)
      .json({ error: "Sign in to view personal contact details." });
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: bearer },
    });
    const user = await userResponse.json();
    if (!userResponse.ok || !user.email)
      return response
        .status(401)
        .json({ error: "Your session could not be verified." });
    return response.status(200).json({
      email: process.env.OWNER_PRIVATE_EMAIL || "",
      phones: [
        process.env.OWNER_PRIVATE_PHONE_PRIMARY,
        process.env.OWNER_PRIVATE_PHONE_SECONDARY,
      ].filter(Boolean),
    });
  } catch {
    return response
      .status(502)
      .json({ error: "Personal contact details are temporarily unavailable." });
  }
}
