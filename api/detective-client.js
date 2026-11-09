import { randomUUID } from "node:crypto";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  adminFetch,
  createPrivateSignedUrl,
  privateRateHash,
  safeText,
  uploadPrivateObject,
  verifyUser,
} from "../lib/detective-security.js";

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

const parseEvidence = (dataUrl, contentType) => {
  if (!new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]).has(contentType)) return null;
  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1] !== contentType || match[2].length > 2_900_000) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 16 || bytes.length > 2_097_152) return null;
  const valid = contentType === "application/pdf"
    ? bytes.subarray(0, 5).toString() === "%PDF-"
    : contentType === "image/jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : contentType === "image/png"
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) return null;
  const extension = contentType === "application/pdf" ? "pdf" : contentType === "image/jpeg" ? "jpg" : contentType.slice(6);
  return { bytes, extension };
};

const clientCases = async (email) => {
  const normalized = email.toLowerCase();
  const emailQuery = await adminFetch(
    `/rest/v1/detective_cases?client_email=eq.${encodeURIComponent(normalized)}&select=id,case_number,client_name,client_type,matter_category,service_name,organization,professional_role,professional_id_type,professional_id_reference,professional_verification_status,case_reference,country,state,district,city,area,postal_code,police_station,timing,non_sensitive_summary,status,progress_stage,retention_days,closed_at,purged_at,pdf_object_path,created_at,updated_at&order=created_at.desc&limit=100`,
  );
  const hash = privateRateHash(normalized);
  const hashQuery = await adminFetch(
    `/rest/v1/detective_cases?client_email_hash=eq.${hash}&select=id,case_number,client_name,client_type,matter_category,service_name,organization,professional_role,professional_id_type,professional_id_reference,professional_verification_status,case_reference,country,state,district,city,area,postal_code,police_station,timing,non_sensitive_summary,status,progress_stage,retention_days,closed_at,purged_at,pdf_object_path,created_at,updated_at&order=created_at.desc&limit=100`,
  );
  if (!emailQuery.ok || !hashQuery.ok) throw new Error("Your case list is temporarily unavailable.");
  const rows = [...await emailQuery.json(), ...await hashQuery.json()];
  return [...new Map(rows.map((item) => [item.id, item])).values()]
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
};

const caseDetails = async (item, email) => {
  if (item.status === "purged" || item.purged_at) {
    return {
      caseNumber: item.case_number,
      status: "purged",
      progressStage: "report_ready",
      purgedAt: item.purged_at,
      purgeMessage: "Case Closed. All sensitive data has been purged according to ARRAI security protocols.",
      timeline: [{ title: "Sensitive data purged", detail: "Case Closed. All sensitive data has been purged according to ARRAI security protocols.", created_at: item.purged_at }],
      evidence: [],
      invoices: [],
    };
  }
  const [timelineResponse, evidenceResponse, invoiceResponse] = await Promise.all([
    adminFetch(`/rest/v1/detective_case_timeline?case_id=eq.${item.id}&visible_to_client=eq.true&select=title,detail,created_at&order=created_at.asc`),
    adminFetch(`/rest/v1/detective_case_evidence?case_id=eq.${item.id}&uploaded_by_email_hash=eq.${privateRateHash(email.toLowerCase())}&select=id,object_path,original_name,content_type,byte_size,created_at&order=created_at.desc`),
    adminFetch(`/rest/v1/detective_case_invoices?case_id=eq.${item.id}&select=id,invoice_number,description,amount_minor,currency,payment_method,razorpay_order_id,status,paid_at,created_at&order=created_at.desc`),
  ]);
  if (!timelineResponse.ok || !evidenceResponse.ok || !invoiceResponse.ok)
    throw new Error("Case details are temporarily unavailable.");
  const [timeline, evidence, invoices] = await Promise.all([
    timelineResponse.json(),
    evidenceResponse.json(),
    invoiceResponse.json(),
  ]);
  const privateEvidence = await Promise.all(evidence.map(async (file) => ({
    ...file,
    downloadUrl: await createPrivateSignedUrl(file.object_path, 900).catch(() => null),
  })));
  return {
    caseNumber: item.case_number,
    clientName: item.client_name,
    clientType: item.client_type,
    matterCategory: item.matter_category,
    service: item.service_name,
    professionalIdentity: item.professional_id_reference ? `${item.professional_id_type}: ${item.professional_id_reference} (${item.professional_verification_status || "pending review"})` : "",
    location: [item.area, item.city, item.district, item.state, item.postal_code, item.country].filter(Boolean).join(", "),
    policeStation: item.police_station,
    timing: item.timing,
    summary: item.non_sensitive_summary,
    status: item.status,
    progressStage: item.progress_stage,
    retentionDays: item.retention_days,
    closedAt: item.closed_at,
    createdAt: item.created_at,
    pdfUrl: item.pdf_object_path ? await createPrivateSignedUrl(item.pdf_object_path, 3600).catch(() => null) : null,
    timeline,
    evidence: privateEvidence,
    invoices: invoices.map((invoice) => ({
      ...invoice,
      razorpay_key_id: invoice.payment_method === "razorpay" ? process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || null : null,
      usdt_address: invoice.payment_method === "usdt_manual" ? process.env.USDT_WALLET_ADDRESS || null : null,
      usdt_network: invoice.payment_method === "usdt_manual" ? process.env.USDT_NETWORK || null : null,
    })),
  };
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
    const user = await verifyUser(request);
    if (!user || !(user.email_confirmed_at || user.confirmed_at))
      return response.status(401).json({ error: "Verify your email with its one-time code first." });
    const email = user.email.toLowerCase();

    if (request.body?.action === "cases") {
      const cases = await clientCases(email);
      const details = await Promise.all(cases.map((item) => caseDetails(item, email)));
      return response.status(200).json({ cases: details });
    }

    if (request.body?.action === "verify-invoice-payment") {
      const invoiceId = String(request.body.invoiceId || "");
      const orderId = safeText(request.body.razorpay_order_id, 80);
      const paymentId = safeText(request.body.razorpay_payment_id, 80);
      const signature = safeText(request.body.razorpay_signature, 128);
      if (!uuidPattern.test(invoiceId) || !orderId || !paymentId || !/^[a-f0-9]{64}$/i.test(signature))
        return response.status(400).json({ error: "Razorpay payment response is invalid." });
      const invoiceResponse = await adminFetch(
        `/rest/v1/detective_case_invoices?id=eq.${invoiceId}&select=id,case_id,invoice_number,amount_minor,currency,payment_method,razorpay_order_id,status,razorpay_payment_id`,
      );
      if (!invoiceResponse.ok) throw new Error("Invoice could not be verified.");
      const [invoice] = await invoiceResponse.json();
      if (!invoice || invoice.payment_method !== "razorpay" || invoice.razorpay_order_id !== orderId)
        return response.status(404).json({ error: "Invoice does not match this payment." });
      const ownedCases = await clientCases(email);
      if (!ownedCases.some((item) => item.id === invoice.case_id))
        return response.status(404).json({ error: "Invoice not found for this verified email." });

      const secret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;
      const keyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY;
      if (!secret || !keyId) throw new Error("Razorpay payment verification is not configured.");
      const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest();
      const received = Buffer.from(signature, "hex");
      if (received.length !== expected.length || !timingSafeEqual(received, expected))
        return response.status(400).json({ error: "Razorpay payment signature is invalid." });
      const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}` },
      });
      const order = await orderResponse.json().catch(() => ({}));
      if (!orderResponse.ok || order.id !== orderId || order.status !== "paid" || Number(order.amount) !== Number(invoice.amount_minor) || order.currency !== invoice.currency || order.notes?.case_id !== invoice.case_id || order.notes?.invoice_id !== invoice.id)
        return response.status(400).json({ error: "Razorpay order does not match this paid case invoice." });

      if (invoice.status !== "paid") {
        const updated = await adminFetch(`/rest/v1/detective_case_invoices?id=eq.${invoice.id}&status=eq.unpaid&razorpay_order_id=eq.${encodeURIComponent(orderId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "paid", razorpay_payment_id: paymentId, paid_at: new Date().toISOString() }),
        });
        if (!updated.ok) throw new Error("Verified payment could not be recorded.");
        if (!(await updated.json()).length) {
          const latest = await adminFetch(`/rest/v1/detective_case_invoices?id=eq.${invoice.id}&select=status,razorpay_payment_id`);
          const [current] = latest.ok ? await latest.json() : [];
          if (current?.status !== "paid" || current.razorpay_payment_id !== paymentId)
            return response.status(409).json({ error: "Invoice payment status changed. Refresh the case dashboard." });
        }
        await adminFetch("/rest/v1/detective_case_timeline", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ case_id: invoice.case_id, title: "Invoice paid", detail: `${invoice.invoice_number} payment was verified.`, visible_to_client: true, actor: "system" }),
        });
      }
      return response.status(200).json({ ok: true, invoiceNumber: invoice.invoice_number, paymentId });
    }

    if (request.body?.action === "submit-usdt-reference") {
      const invoiceId = String(request.body.invoiceId || "");
      const reference = safeText(request.body.transactionReference, 160);
      if (!uuidPattern.test(invoiceId) || !/^[A-Za-z0-9:_-]{20,160}$/.test(reference))
        return response.status(400).json({ error: "Enter a valid transaction reference/hash." });
      const invoiceResponse = await adminFetch(`/rest/v1/detective_case_invoices?id=eq.${invoiceId}&select=id,case_id,invoice_number,payment_method,status`);
      if (!invoiceResponse.ok) throw new Error("Invoice could not be verified.");
      const [invoice] = await invoiceResponse.json();
      const ownedCases = await clientCases(email);
      if (!invoice || invoice.payment_method !== "usdt_manual" || !ownedCases.some((item) => item.id === invoice.case_id))
        return response.status(404).json({ error: "USDT invoice not found for this verified email." });
      if (invoice.status !== "unpaid") return response.status(409).json({ error: "This invoice is not awaiting payment." });
      const updated = await adminFetch(`/rest/v1/detective_case_invoices?id=eq.${invoice.id}&status=eq.unpaid`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "payment_submitted", payment_reference: reference }),
      });
      if (!updated.ok || !(await updated.json()).length) return response.status(409).json({ error: "Transaction reference was not accepted. Refresh and contact the agency." });
      await adminFetch("/rest/v1/detective_case_timeline", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ case_id: invoice.case_id, title: "USDT payment reference submitted", detail: `${invoice.invoice_number} is awaiting manual verification.`, visible_to_client: true, actor: "system" }),
      });
      return response.status(200).json({ ok: true, status: "payment_submitted" });
    }

    if (request.body?.action === "upload-evidence") {
      const caseId = String(request.body.caseId || "");
      const contentType = safeText(request.body.contentType, 40);
      const upload = parseEvidence(request.body.fileData, contentType);
      const fileName = safeText(request.body.fileName, 180).replace(/[\\/\0]/g, "_");
      if (!uuidPattern.test(caseId) || !upload || !fileName)
        return response.status(400).json({ error: "Choose a JPG, PNG, WebP or PDF file under 2 MB." });
      const caseResponse = await adminFetch(
        `/rest/v1/detective_cases?id=eq.${caseId}&client_email=eq.${encodeURIComponent(email)}&purged_at=is.null&select=id,case_number,status`,
      );
      if (!caseResponse.ok) throw new Error("The case could not be verified.");
      const [item] = await caseResponse.json();
      if (!item) return response.status(404).json({ error: "Case not found for this verified email." });
      if (["closed", "declined", "purged"].includes(item.status))
        return response.status(409).json({ error: "Evidence uploads are closed for this case." });
      const rateResponse = await adminFetch(
        `/rest/v1/detective_case_evidence?case_id=eq.${caseId}&select=id`,
      );
      if (!rateResponse.ok) throw new Error("Evidence upload is temporarily unavailable.");
      if ((await rateResponse.json()).length >= 10)
        return response.status(429).json({ error: "This case has reached its 10-file upload limit." });
      const objectPath = `evidence/${caseId}/${randomUUID()}.${upload.extension}`;
      await uploadPrivateObject(objectPath, upload.bytes, contentType);
      const metadata = await adminFetch("/rest/v1/detective_case_evidence", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          case_id: caseId,
          object_path: objectPath,
          original_name: fileName,
          content_type: contentType,
          byte_size: upload.bytes.length,
          uploaded_by_email_hash: privateRateHash(email),
        }),
      });
      if (!metadata.ok) throw new Error("Evidence metadata could not be saved securely.");
      await adminFetch("/rest/v1/detective_case_timeline", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          case_id: caseId,
          title: "Client evidence received",
          detail: "A private evidence file was added to the case workspace.",
          visible_to_client: true,
          actor: "system",
        }),
      });
      return response.status(201).json({ ok: true, caseNumber: item.case_number });
    }

    return response.status(400).json({ error: "Unknown client-case action." });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Client case request failed securely." });
  }
}
