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
        "/rest/v1/detective_member_applications?select=user_id,full_name,email,phone,country,state,city,languages,years_experience,specialties,qualifications,license_details,profile_photo_path,status,member_id_suffix,created_at,reviewed_at&order=created_at.desc&limit=200",
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
        "/rest/v1/detective_cases?select=id,case_number,client_name,client_email,client_type,matter_category,service_name,country,state,district,city,area,postal_code,police_station,organization,professional_role,case_reference,authorized_to_enquire,timing,non_sensitive_summary,status,assigned_member_id,pdf_object_path,created_at,updated_at&order=created_at.desc&limit=500",
      );
      if (!result.ok) throw new Error("The case register could not be loaded.");
      const cases = await result.json();
      const withDocuments = await Promise.all(cases.map(async (item) => ({
        ...item,
        documentUrl: item.pdf_object_path ? await createPrivateSignedUrl(item.pdf_object_path, 900).catch(() => null) : null,
      })));
      return response.status(200).json({ cases: withDocuments });
    }

    if (body.action === "assign-case") {
      const caseId = String(body.caseId || "");
      const memberId = String(body.memberUserId || "");
      if (!uuidPattern.test(caseId) || !uuidPattern.test(memberId))
        return response.status(400).json({ error: "Choose a valid case and detective member." });
      const memberResponse = await adminFetch(
        `/rest/v1/detective_member_applications?user_id=eq.${memberId}&status=eq.approved&select=user_id`,
      );
      if (!memberResponse.ok || !(await memberResponse.json()).length)
        return response.status(409).json({ error: "Cases can only be assigned to an approved detective member." });
      const updated = await adminFetch(`/rest/v1/detective_cases?id=eq.${caseId}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ assigned_member_id: memberId, status: "assigned", updated_at: new Date().toISOString() }),
      });
      if (!updated.ok) throw new Error("Case assignment could not be saved.");
      return response.status(200).json({ ok: true });
    }

    if (body.action === "update-case-status") {
      const caseId = String(body.caseId || "");
      const status = safeText(body.status, 30);
      if (!uuidPattern.test(caseId) || !["new", "reviewing", "assigned", "in_progress", "closed", "declined"].includes(status))
        return response.status(400).json({ error: "Choose a valid case status." });
      const updated = await adminFetch(`/rest/v1/detective_cases?id=eq.${caseId}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      });
      if (!updated.ok) throw new Error("Case status could not be updated.");
      return response.status(200).json({ ok: true });
    }

    return response.status(400).json({ error: "Unknown detective-owner action." });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Detective-owner action failed securely." });
  }
}