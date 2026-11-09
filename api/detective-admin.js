import { randomBytes } from "node:crypto";
import {
  adminFetch,
  createPrivateSignedUrl,
  isOwner,
  safeText,
  sendTransactionalEmail,
  sha256,
  verifyUser,
} from "../lib/detective-security.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  try {
    const owner = await verifyUser(request);
    if (!owner || !isOwner(owner)) return response.status(403).json({ error: "Verified owner access is required." });
    const body = request.body || {};

    if (body.action === "applications") {
      const result = await adminFetch(
        "/rest/v1/detective_member_applications?select=user_id,full_name,email,phone,country,state,city,postal_code,address,applicant_role,organization,role_credential,languages,years_experience,specialties,qualifications,license_details,motivation,availability,profile_photo_path,status,member_id_suffix,created_at,reviewed_at&order=created_at.desc&limit=200",
      );
      if (!result.ok) throw new Error("Detective applications could not be loaded.");
      const applications = await result.json();
      const withPhoto = await Promise.all(applications.map(async (application) => ({
        ...application,
        photoUrl: await createPrivateSignedUrl(application.profile_photo_path, 900).catch(() => null),
      })));
      return response.status(200).json({ applications: withPhoto });
    }

    if (body.action === "review-application") {
      const userId = String(body.userId || "");
      const decision = body.decision;
      if (!uuidPattern.test(userId) || !["approve", "reject", "suspend", "restore", "rotate-id"].includes(decision))
        return response.status(400).json({ error: "Choose a valid application and review action." });
      const currentResponse = await adminFetch(
        `/rest/v1/detective_member_applications?user_id=eq.${userId}&select=user_id,full_name,email,status`,
      );
      if (!currentResponse.ok) throw new Error("The application could not be verified.");
      const [application] = await currentResponse.json();
      if (!application) return response.status(404).json({ error: "Application not found." });

      const changes = { reviewed_at: new Date().toISOString() };
      let memberId = "";
      if (decision === "approve") {
        if (application.status !== "pending" && application.status !== "rejected")
          return response.status(409).json({ error: "Only a pending or rejected application can be approved." });
        memberId = `DTA-${randomBytes(16).toString("hex").toUpperCase()}`;
        changes.status = "approved";
        changes.member_id_hash = sha256(memberId);
        changes.member_id_suffix = memberId.slice(-4);
      } else if (decision === "reject") {
        if (application.status !== "pending") return response.status(409).json({ error: "Only a pending application can be rejected." });
        changes.status = "rejected";
        changes.member_id_hash = null;
        changes.member_id_suffix = null;
      } else if (decision === "suspend") {
        if (application.status !== "approved") return response.status(409).json({ error: "Only an approved member can be suspended." });
        changes.status = "suspended";
      } else if (decision === "rotate-id") {
        if (application.status !== "approved") return response.status(409).json({ error: "Only an approved member can receive a replacement ID." });
        memberId = `DTA-${randomBytes(16).toString("hex").toUpperCase()}`;
        changes.member_id_hash = sha256(memberId);
        changes.member_id_suffix = memberId.slice(-4);
      } else {
        if (application.status !== "suspended") return response.status(409).json({ error: "Only a suspended member can be restored." });
        changes.status = "approved";
      }
      const updated = await adminFetch(
        `/rest/v1/detective_member_applications?user_id=eq.${userId}&status=eq.${encodeURIComponent(application.status)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(changes),
        },
      );
      if (!updated.ok) throw new Error("The application review could not be saved.");
      if (!(await updated.json()).length)
        return response.status(409).json({ error: "This application changed during review. Refresh the owner register and try again." });
      let memberEmailSent = false;
      if (memberId) {
        const notification = await sendTransactionalEmail({
          to: application.email,
          subject: decision === "rotate-id" ? "Replacement ARRAI Detective Member ID" : "ARRAI Detective Member ID",
          text: `Hello ${application.full_name},\n\n${decision === "rotate-id" ? "Your previous member ID has been replaced." : "Your detective membership application was approved."} Your member ID is ${memberId}. Keep it private; it is required along with your account password to open the member portal.\n\nARRAI Detective Agency`,
          html: `<p>Hello ${application.full_name.replace(/[&<>"']/g, "")},</p><p>${decision === "rotate-id" ? "Your previous member ID has been replaced." : "Your detective membership application was approved."}</p><p>Your member ID: <strong>${memberId}</strong></p><p>Keep this ID private. It is required alongside your account password to open the detective member portal.</p><p>ARRAI Detective Agency</p>`,
        }).catch(() => ({ sent: false }));
        memberEmailSent = notification.sent === true;
      }
      return response.status(200).json({ ok: true, decision, memberId: memberId || undefined, memberEmailSent });
    }

    if (body.action === "cases") {
      const result = await adminFetch(
        "/rest/v1/detective_cases?select=id,case_number,client_name,client_email,client_type,matter_category,service_name,country,state,district,city,area,postal_code,police_station,organization,professional_role,professional_id_type,professional_id_reference,professional_verification_status,case_reference,authorized_to_enquire,timing,non_sensitive_summary,status,progress_stage,retention_days,closed_at,purged_at,assigned_member_id,pdf_object_path,created_at,updated_at&order=created_at.desc&limit=500",
      );
      if (!result.ok) throw new Error("The case register could not be loaded.");
      const cases = await result.json();
      const ids = cases.map((item) => item.id);
      let evidence = [];
      let invoices = [];
      if (ids.length) {
        const filter = encodeURIComponent(`(${ids.join(",")})`);
        const [evidenceResponse, invoiceResponse] = await Promise.all([
          adminFetch(`/rest/v1/detective_case_evidence?case_id=in.${filter}&select=id,case_id,object_path,original_name,content_type,byte_size,created_at&order=created_at.desc`),
          adminFetch(`/rest/v1/detective_case_invoices?case_id=in.${filter}&select=id,case_id,invoice_number,description,amount_minor,currency,payment_method,payment_reference,razorpay_order_id,status,paid_at,created_at&order=created_at.desc`),
        ]);
        if (!evidenceResponse.ok || !invoiceResponse.ok) throw new Error("Case evidence or invoices could not be loaded.");
        [evidence, invoices] = await Promise.all([evidenceResponse.json(), invoiceResponse.json()]);
      }
      const withDocuments = await Promise.all(cases.map(async (item) => ({
        ...item,
        documentUrl: item.pdf_object_path ? await createPrivateSignedUrl(item.pdf_object_path, 900).catch(() => null) : null,
        evidence: await Promise.all(evidence.filter((file) => file.case_id === item.id).map(async (file) => ({
          ...file,
          downloadUrl: await createPrivateSignedUrl(file.object_path, 900).catch(() => null),
        }))),
        invoices: invoices.filter((invoice) => invoice.case_id === item.id),
      })));
      return response.status(200).json({ cases: withDocuments });
    }

    if (body.action === "assign-case") {
      const caseId = String(body.caseId || "");
      const memberId = String(body.memberUserId || "");
      if (!uuidPattern.test(caseId) || (memberId && !uuidPattern.test(memberId)))
        return response.status(400).json({ error: "Choose a valid case and detective member." });
      const caseResponse = await adminFetch(
        `/rest/v1/detective_cases?id=eq.${caseId}&status=neq.purged&select=id,case_number,pdf_object_path`,
      );
      if (!caseResponse.ok) throw new Error("The case could not be loaded.");
      const [caseRecord] = await caseResponse.json();
      if (!caseRecord) return response.status(404).json({ error: "Open case not found." });
      let member = null;
      if (memberId) {
        const memberResponse = await adminFetch(
          `/rest/v1/detective_member_applications?user_id=eq.${memberId}&status=eq.approved&select=user_id,full_name,email`,
        );
        if (!memberResponse.ok) throw new Error("Detective membership could not be verified.");
        [member] = await memberResponse.json();
        if (!member) return response.status(409).json({ error: "Cases can only be assigned to an approved detective member." });
      }
      const updated = await adminFetch(`/rest/v1/detective_cases?id=eq.${caseId}&status=neq.purged`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ assigned_member_id: memberId || null, status: member ? "assigned" : "reviewing", updated_at: new Date().toISOString() }),
      });
      if (!updated.ok) throw new Error("Case assignment could not be saved.");
      await adminFetch("/rest/v1/detective_case_timeline", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ case_id: caseId, title: member ? "Investigator assigned" : "Investigator assignment updated", detail: member ? "The agency assigned an approved investigator to this case." : "The agency is reviewing investigator assignment.", visible_to_client: true, actor: "owner" }),
      });
      let memberEmailSent = false;
      if (member) {
        const documentUrl = caseRecord.pdf_object_path
          ? await createPrivateSignedUrl(caseRecord.pdf_object_path, 3600).catch(() => null)
          : null;
        const notification = await sendTransactionalEmail({
          to: member.email,
          subject: `ARRAI case assigned · ${caseRecord.case_number}`,
          text: `Hello ${member.full_name},\n\nYou have been assigned case ${caseRecord.case_number}. Sign in to the Detective Member Portal with your approved account and owner-issued member ID to review it.${documentUrl ? `\n\nPrivate case PDF (expires in 1 hour): ${documentUrl}` : "\n\nThe case PDF is being prepared and will appear in your portal."}\n\nARRAI Detective Agency`,
          html: `<p>Hello ${member.full_name.replace(/[&<>"']/g, "")},</p><p>You have been assigned case <strong>${caseRecord.case_number}</strong>. Sign in to the Detective Member Portal with your approved account and owner-issued member ID to review it.</p>${documentUrl ? `<p><a href="${documentUrl}">Open the private case PDF</a> <small>(link expires in 1 hour)</small></p>` : "<p>The case PDF is being prepared and will appear in your portal.</p>"}<p>ARRAI Detective Agency</p>`,
        }).catch(() => ({ sent: false }));
        memberEmailSent = notification.sent === true;
      }
      return response.status(200).json({ ok: true, memberEmailSent });
    }

    if (body.action === "update-case-status") {
      const caseId = String(body.caseId || "");
      const status = safeText(body.status, 30);
      const progressStage = safeText(body.progressStage, 40);
      const retentionDays = Number(body.retentionDays) === 14 ? 14 : 7;
      if (!uuidPattern.test(caseId) || !["new", "reviewing", "assigned", "in_progress", "closed", "declined"].includes(status) || !["case_received", "osint_analysis_active", "compiling_intelligence", "report_ready"].includes(progressStage))
        return response.status(400).json({ error: "Choose a valid case status." });
      const updated = await adminFetch(`/rest/v1/detective_cases?id=eq.${caseId}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status,
          progress_stage: progressStage,
          retention_days: retentionDays,
          closed_at: status === "closed" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!updated.ok) throw new Error("Case status could not be updated.");
      await adminFetch("/rest/v1/detective_case_timeline", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ case_id: caseId, title: status === "closed" ? "Case closed" : "Case progress updated", detail: "The agency updated the case status and investigation progress.", visible_to_client: true, actor: "owner" }),
      });
      return response.status(200).json({ ok: true });
    }

    if (body.action === "add-timeline-event") {
      const caseId = String(body.caseId || "");
      const title = safeText(body.title, 120);
      const detail = safeText(body.detail, 500);
      if (!uuidPattern.test(caseId) || title.length < 2)
        return response.status(400).json({ error: "A case and short timeline title are required." });
      const result = await adminFetch("/rest/v1/detective_case_timeline", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ case_id: caseId, title, detail, visible_to_client: body.visibleToClient !== false, actor: "owner" }),
      });
      if (!result.ok) throw new Error("Timeline update could not be saved.");
      return response.status(200).json({ ok: true });
    }

    if (body.action === "create-invoice") {
      const caseId = String(body.caseId || "");
      const description = safeText(body.description, 160);
      const paymentMethod = body.paymentMethod;
      const currency = body.currency;
      const amount = Number(body.amount);
      if (!uuidPattern.test(caseId) || description.length < 2 || !Number.isFinite(amount) || amount <= 0 || amount > 1000000)
        return response.status(400).json({ error: "Enter a valid case, description and amount (maximum 1,000,000)." });
      if (!((paymentMethod === "razorpay" && currency === "INR") || (paymentMethod === "usdt_manual" && currency === "USDT")))
        return response.status(400).json({ error: "Use Razorpay for INR or manual confirmation for USDT." });
      if (paymentMethod === "usdt_manual" && (!process.env.USDT_WALLET_ADDRESS || !process.env.USDT_NETWORK))
        return response.status(503).json({ error: "Set USDT_WALLET_ADDRESS and USDT_NETWORK on the server before issuing a crypto invoice." });
      const caseLookup = await adminFetch(`/rest/v1/detective_cases?id=eq.${caseId}&status=neq.purged&select=id,case_number`);
      if (!caseLookup.ok || !(await caseLookup.json()).length)
        return response.status(404).json({ error: "Open case not found." });
      const created = await adminFetch("/rest/v1/detective_case_invoices?select=id,invoice_number,amount_minor,currency,payment_method", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ case_id: caseId, description, amount_minor: Math.round(amount * 100), currency, payment_method: paymentMethod }),
      });
      if (!created.ok) throw new Error("Invoice could not be created.");
      const [invoice] = await created.json();
      if (paymentMethod === "razorpay") {
        const keyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY;
        const secret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;
        if (!keyId || !secret) {
          await adminFetch(`/rest/v1/detective_case_invoices?id=eq.${invoice.id}`, { method: "DELETE" });
          return response.status(503).json({ error: "Razorpay is not configured on the server." });
        }
        const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ amount: invoice.amount_minor, currency: "INR", receipt: invoice.invoice_number, notes: { case_id: caseId, invoice_id: invoice.id } }),
        });
        const order = await orderResponse.json().catch(() => ({}));
        if (!orderResponse.ok || !order.id) {
          await adminFetch(`/rest/v1/detective_case_invoices?id=eq.${invoice.id}`, { method: "DELETE" });
          return response.status(502).json({ error: "Razorpay could not create this invoice order." });
        }
        const saved = await adminFetch(`/rest/v1/detective_case_invoices?id=eq.${invoice.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ razorpay_order_id: order.id }),
        });
        if (!saved.ok) throw new Error("Razorpay order was created but the invoice link could not be saved.");
      }
      await adminFetch("/rest/v1/detective_case_timeline", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ case_id: caseId, title: "Invoice issued", detail: `${invoice.invoice_number} was added to the case payment history.`, visible_to_client: true, actor: "owner" }),
      });
      return response.status(201).json({ ok: true, invoiceNumber: invoice.invoice_number });
    }

    if (body.action === "review-usdt-payment") {
      const invoiceId = String(body.invoiceId || "");
      const decision = body.decision;
      if (!uuidPattern.test(invoiceId) || !["approve", "reject"].includes(decision))
        return response.status(400).json({ error: "Choose a valid USDT invoice review action." });
      const invoiceResponse = await adminFetch(`/rest/v1/detective_case_invoices?id=eq.${invoiceId}&payment_method=eq.usdt_manual&select=id,case_id,invoice_number,status`);
      if (!invoiceResponse.ok) throw new Error("Invoice could not be loaded.");
      const [invoice] = await invoiceResponse.json();
      if (!invoice || invoice.status !== "payment_submitted") return response.status(409).json({ error: "This invoice is not awaiting manual payment verification." });
      const updated = await adminFetch(`/rest/v1/detective_case_invoices?id=eq.${invoice.id}&status=eq.payment_submitted`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(decision === "approve"
          ? { status: "paid", paid_at: new Date().toISOString() }
          : { status: "unpaid", payment_reference: "" }),
      });
      if (!updated.ok || !(await updated.json()).length) return response.status(409).json({ error: "Invoice changed during review. Refresh and try again." });
      await adminFetch("/rest/v1/detective_case_timeline", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ case_id: invoice.case_id, title: decision === "approve" ? "USDT payment verified" : "USDT reference rejected", detail: `${invoice.invoice_number} manual payment review completed.`, visible_to_client: true, actor: "owner" }),
      });
      return response.status(200).json({ ok: true, decision });
    }

    return response.status(400).json({ error: "Unknown detective-owner action." });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Detective-owner action failed securely." });
  }
}
