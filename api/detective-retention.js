import {
  adminFetch,
  deletePrivateObject,
} from "../lib/detective-security.js";

const purgedMessage = "Case Closed. All sensitive data has been purged according to ARRAI security protocols.";

const isAuthorizedCron = (request) => {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.authorization === `Bearer ${secret}`);
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }
  if (!isAuthorizedCron(request)) return response.status(401).json({ error: "Scheduled cleanup is not authorized." });

  try {
    const closed = await adminFetch(
      "/rest/v1/detective_cases?status=eq.closed&purged_at=is.null&select=id,retention_days,closed_at,pdf_object_path&limit=500",
    );
    if (!closed.ok) throw new Error("Closed cases could not be loaded for retention cleanup.");
    const now = Date.now();
    const eligible = (await closed.json()).filter((item) => {
      const closedAt = new Date(item.closed_at).getTime();
      return Number.isFinite(closedAt) && now >= closedAt + Number(item.retention_days || 7) * 86_400_000;
    });

    for (const item of eligible) {
      const evidenceResponse = await adminFetch(
        `/rest/v1/detective_case_evidence?case_id=eq.${item.id}&select=object_path`,
      );
      if (!evidenceResponse.ok) throw new Error("Case evidence could not be loaded for secure deletion.");
      const evidence = await evidenceResponse.json();
      await Promise.all([item.pdf_object_path, ...evidence.map((file) => file.object_path)].filter(Boolean).map(deletePrivateObject));

      const deleteChildren = await Promise.all([
        adminFetch(`/rest/v1/detective_case_evidence?case_id=eq.${item.id}`, { method: "DELETE" }),
        adminFetch(`/rest/v1/detective_case_invoices?case_id=eq.${item.id}`, { method: "DELETE" }),
        adminFetch(`/rest/v1/detective_case_timeline?case_id=eq.${item.id}`, { method: "DELETE" }),
      ]);
      if (deleteChildren.some((result) => !result.ok)) throw new Error("Case records could not be removed securely.");

      const purged = await adminFetch(`/rest/v1/detective_cases?id=eq.${item.id}&status=eq.closed&purged_at=is.null`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          client_name: "Purged client",
          client_email: null,
          // Retain only the one-way lookup hash so the verified email can display the
          // required purged notice; no email address or case content remains.
          client_type: "Purged",
          student_status: "",
          matter_category: "Purged",
          service_name: "Purged",
          organization: "",
          professional_role: "",
          case_reference: "",
          authorized_to_enquire: false,
          country: "",
          state: "",
          district: "",
          city: "",
          area: "",
          postal_code: "",
          police_station: "",
          non_sensitive_summary: purgedMessage,
          pdf_object_path: null,
          download_token_hash: null,
          assigned_member_id: null,
          status: "purged",
          purged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      if (!purged.ok) throw new Error("Case purge marker could not be saved.");
    }
    return response.status(200).json({ ok: true, purgedCases: eligible.length });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Scheduled retention cleanup failed." });
  }
}
