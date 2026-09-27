import { adminFetch, privateRateHash, safeText, sendTransactionalEmail } from "../lib/detective-security.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isSameOrigin = (request) => {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return true;
  try { return new URL(origin).host.toLowerCase() === host.toLowerCase(); } catch { return false; }
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  if (!isSameOrigin(request)) return response.status(403).json({ error: "Request origin is not allowed." });
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
    const sent = await sendTransactionalEmail({ to: process.env.OWNER_EMAIL || "abhishekrai6897@gmail.com", subject: `ARRAI inquiry · ${topic}`, text: `From: ${name} <${email}>\nTopic: ${topic}\n\n${message}`, html: `<p><b>From:</b> ${name.replace(/[&<>"']/g, "")} &lt;${email.replace(/[&<>"']/g, "")}&gt;</p><p><b>Topic:</b> ${topic.replace(/[&<>"']/g, "")}</p><p>${message.replace(/[&<>"']/g, "").replace(/\n/g, "<br>")}</p>` });
    return response.status(201).json({ ok: true, emailSent: sent.sent === true });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Inquiry service failed." });
  }
}
