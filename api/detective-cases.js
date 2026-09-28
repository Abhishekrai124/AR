import { randomBytes } from "node:crypto";
import {
  adminFetch,
  createPrivateSignedUrl,
  matchesHash,
  privateRateHash,
  safeText,
  sendTransactionalEmail,
  sha256,
  supabaseUrl,
  uploadPrivateObject,
} from "../lib/detective-security.js";

const agreementVersion = "DTA-INTAKE-DRAFT-2026-01";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isSameOrigin = (request) => {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return true;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
};

const parsePdf = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1].length > 3_500_000) return null;
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 8 || bytes.length > 2_500_000 || bytes.subarray(0, 5).toString() !== "%PDF-") return null;
  return bytes;
};

const caseRegisterError = async (response) => {
  const details = await response.text().catch(() => "");
  // Do not expose database internals to a public intake form. These common
  // responses mean the production database has not received the required
  // detective migration or the server is using the wrong Supabase key.
  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 404 ||
    /detective_cases|detective_case_number_seq|client_email_hash|permission denied|schema cache/i.test(details)
  ) {
    return "Case intake is not configured yet. The site owner must run supabase-detective-migration.sql in Supabase and set SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.";
  }
  return "The case register is temporarily unavailable. Please try again shortly or contact the agency.";
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  if (!isSameOrigin(request)) return response.status(403).json({ error: "Request origin is not allowed." });
  if (Buffer.byteLength(JSON.stringify(request.body || {}), "utf8") > 3_000_000)
    return response.status(413).json({ error: "The request is too large." });

  try {
    if (request.body?.action === "create-case") {
      const body = request.body;
      const clientName = safeText(body.clientName, 120);
      const clientEmail = safeText(body.clientEmail, 254).toLowerCase();
      const clientPhone = safeText(body.clientPhone, 32);
      const clientType = safeText(body.clientType, 100);
      const studentStatus = safeText(body.studentStatus, 40);
      const agreementName = safeText(body.agreementName, 120);
      const summary = safeText(body.summary, 2000);
      if (clientName.length < 2 || !emailPattern.test(clientEmail) || clientPhone.length < 5 || clientType.length < 2 || summary.length < 10)
        return response.status(400).json({ error: "Name, valid email, phone number, client type and a short non-sensitive summary are required." });
      if (body.agreementAccepted !== true || agreementName.toLowerCase() !== clientName.toLowerCase())
        return response.status(400).json({ error: "Confirm the draft intake acknowledgement using the same name entered on the form." });
      const professionals = new Set([
        "Lawyer or legal professional",
        "Police or law-enforcement official",
        "Public authority or government body",
        "Cybercrime or IT-security professional",
        "Doctor or licensed healthcare professional",
        "Forensic or security specialist",
        "Business or employer",
        "Insurer or claims professional",
        "Nonprofit or community organization",
      ]);
      const isProfessionalCase = professionals.has(clientType) && body.requestType === "Private investigation enquiry";
      if (isProfessionalCase && (body.authorizedToEnquire !== true || !safeText(body.organization, 160) || !safeText(body.professionalRole, 120) || !safeText(body.professionalIdType, 80) || !safeText(body.professionalIdReference, 120)))
        return response.status(400).json({ error: "Professional cases need organization, role, professional ID/reference and authorization confirmation. General enquiries remain open to everyone." });
      if (clientType === "Student" && !["adult", "minor_guardian"].includes(studentStatus))
        return response.status(400).json({ error: "Student enquiries require adult confirmation or a parent/guardian." });

      const forwardedFor = request.headers["x-forwarded-for"] || "unknown";
      const ip = String(forwardedFor).split(",")[0].trim().slice(0, 80);
      const ipHash = privateRateHash(ip);
      const emailHash = privateRateHash(clientEmail);
      const quotaResponse = await adminFetch("/rest/v1/rpc/consume_detective_intake_limits", {
        method: "POST",
        body: JSON.stringify({ p_ip_hash: ipHash, p_email_hash: emailHash }),
      });
      if (!quotaResponse.ok) throw new Error("Secure case intake is not configured. Please contact the agency.");
      if (!(await quotaResponse.json())) return response.status(429).json({ error: "Too many enquiries from this network or email. Please try again later." });

      const downloadToken = randomBytes(32).toString("base64url");
      const retentionDays = Number(body.retentionDays) === 14 ? 14 : 7;
      const caseRecord = {
        request_type: safeText(body.requestType, 80) || "Private investigation enquiry",
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        client_email_hash: emailHash,
        client_type: clientType,
        student_status: studentStatus,
        matter_category: safeText(body.matterCategory, 120),
        service_name: safeText(body.service, 160),
        organization: safeText(body.organization, 160),
        professional_role: safeText(body.professionalRole, 120),
        professional_id_type: safeText(body.professionalIdType, 80),
        professional_id_reference: safeText(body.professionalIdReference, 120),
        professional_verification_status: professionals.has(clientType) ? "pending_review" : "not_required",
        case_reference: safeText(body.caseReference, 80),
        authorized_to_enquire: body.authorizedToEnquire === true,
        country: safeText(body.country, 100),
        state: safeText(body.state, 100),
        district: safeText(body.district, 100),
        city: safeText(body.city, 100),
        area: safeText(body.area, 100),
        postal_code: safeText(body.postalCode, 24),
        police_station: safeText(body.policeStation, 140),
        timing: body.timing === "Time-sensitive" ? "Time-sensitive" : "Routine",
        non_sensitive_summary: summary,
        agreement_version: agreementVersion,
        agreement_accepted_name: agreementName,
        agreement_accepted_at: new Date().toISOString(),
        progress_stage: "case_received",
        retention_days: retentionDays,
        download_token_hash: sha256(downloadToken),
        ip_rate_hash: ipHash,
        email_rate_hash: emailHash,
      };
      if (!caseRecord.matter_category || !caseRecord.service_name)
        return response.status(400).json({ error: "Choose a matter category and service, or select the unlisted enquiry option." });

      const created = await adminFetch("/rest/v1/detective_cases?select=id,case_number,created_at", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(caseRecord),
      });
      if (!created.ok) throw new Error(await caseRegisterError(created));
      const [saved] = await created.json();
      await adminFetch("/rest/v1/detective_case_timeline", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          case_id: saved.id,
          title: "Case Received",
          detail: "Your enquiry is recorded. The agency will review scope and next steps.",
          visible_to_client: true,
          actor: "system",
        }),
      });
      // Time-sensitive requests are treated as high priority. Only a minimal alert is emailed;
      // private details remain in the protected case register for owner review.
      const isHighPriority = caseRecord.timing === "Time-sensitive";
      const ownerEmail = isHighPriority
        ? (process.env.HIGH_PRIORITY_CASE_EMAIL || "arraidetectiveagency@proton.me")
        : (process.env.ROUTINE_CASE_EMAIL || "arraidetectiveagency@gmail.com");
      const ownerNotification = await sendTransactionalEmail({
        to: ownerEmail,
        subject: `${isHighPriority ? "High-priority" : "New routine"} ARRAI case · ${saved.case_number}`,
        text: `A ${isHighPriority ? "high-priority" : "routine"} ARRAI case was received.\n\nCase: ${saved.case_number}\nTiming: ${caseRecord.timing}\n\nReview the private owner panel for the protected application details.`,
        html: `<h2>${isHighPriority ? "High-priority" : "New routine"} ARRAI case</h2><p><b>Case:</b> ${saved.case_number}<br><b>Timing:</b> ${caseRecord.timing}</p><p>Review the private owner panel for protected application details.</p>`,
      });
      return response.status(201).json({
        caseId: saved.id,
        caseNumber: saved.case_number,
        createdAt: saved.created_at,
        uploadToken: downloadToken,
        agreementVersion,
        ownerNotified: ownerNotification.sent === true,
      });
    }

    if (request.body?.action === "attach-pdf") {
      const caseId = String(request.body.caseId || "");
      const caseNumber = safeText(request.body.caseNumber, 32);
      const uploadToken = String(request.body.uploadToken || "");
      const pdfBytes = parsePdf(request.body.pdfData);
      if (!uuidPattern.test(caseId) || !/^ARRAI-IN-\d{6,}$/.test(caseNumber) || uploadToken.length < 30 || !pdfBytes)
        return response.status(400).json({ error: "The case PDF details are invalid." });
      const lookup = await adminFetch(`/rest/v1/detective_cases?id=eq.${caseId}&case_number=eq.${encodeURIComponent(caseNumber)}&select=id,case_number,client_name,client_email,download_token_hash`);
      if (!lookup.ok) throw new Error("The case record could not be verified.");
      const [caseRecord] = await lookup.json();
      if (!caseRecord || !matchesHash(uploadToken, caseRecord.download_token_hash))
        return response.status(403).json({ error: "The case document authorization is invalid." });

      const objectPath = `cases/${caseId}/${caseNumber}.pdf`;
      await uploadPrivateObject(objectPath, pdfBytes, "application/pdf");
      const updated = await adminFetch(`/rest/v1/detective_cases?id=eq.${caseId}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ pdf_object_path: objectPath, download_token_hash: null }),
      });
      if (!updated.ok) throw new Error("The case PDF was saved but its register link could not be updated.");

      let email = { sent: false, reason: "email_not_configured" };
      try {
        const signedUrl = await createPrivateSignedUrl(objectPath);
        email = await sendTransactionalEmail({
          to: caseRecord.client_email,
          subject: `ARRAI enquiry ${caseRecord.case_number}: private PDF link`,
          text: `Hello ${caseRecord.client_name},\n\nYour case intake acknowledgement PDF is ready. Case number: ${caseRecord.case_number}.\nDownload link (expires in 7 days): ${signedUrl}\n\nThis is an enquiry acknowledgement, not a final service contract or official police/court filing.\n\nARRAI Detective Agency`,
          html: `<p>Hello ${caseRecord.client_name.replace(/[&<>"']/g, "")},</p><p>Your case intake acknowledgement PDF is ready.</p><p><strong>Case number:</strong> ${caseRecord.case_number}</p><p><a href="${signedUrl}">Download the private PDF (link expires in 7 days)</a></p><p>This is an enquiry acknowledgement, not a final service contract or official police/court filing.</p><p>ARRAI Detective Agency</p>`,
        });
      } catch {
        email = { sent: false, reason: "email_delivery_failed" };
      }
      return response.status(200).json({ ok: true, emailSent: email.sent, emailReason: email.reason });
    }

    return response.status(400).json({ error: "Unknown case action." });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Case intake failed securely." });
  }
}
