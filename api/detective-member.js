import { randomUUID } from "node:crypto";
import {
  adminFetch,
  createPrivateSignedUrl,
  safeText,
  uploadPrivateObject,
  verifyUser,
  matchesHash,
} from "../lib/detective-security.js";

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

const readPhoto = (dataUrl, declaredType) => {
  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1] !== declaredType || match[2].length > 2_800_000) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length < 16 || buffer.length > 2_000_000) return null;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (!(isJpeg || isPng || isWebp)) return null;
  const extension = declaredType === "image/jpeg" ? "jpg" : declaredType.slice(6);
  return { buffer, extension };
};

const getApprovedMember = async (user, memberId) => {
  const code = safeText(memberId, 40).toUpperCase();
  if (!/^DTA-[A-F0-9]{32}$/.test(code)) return null;
  const response = await adminFetch(
    `/rest/v1/detective_member_applications?user_id=eq.${encodeURIComponent(user.id)}&select=user_id,full_name,email,status,member_id_hash,member_id_suffix`,
  );
  if (!response.ok) throw new Error("Member access could not be verified.");
  const [member] = await response.json();
  if (!member || member.status !== "approved" || !matchesHash(code, member.member_id_hash)) return null;
  return member;
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
    if (!user) return response.status(401).json({ error: "Verify your email and sign in first." });
    const body = request.body || {};

    if (body.action === "application-status") {
      const result = await adminFetch(
        `/rest/v1/detective_member_applications?user_id=eq.${encodeURIComponent(user.id)}&select=status,member_id_suffix,created_at,reviewed_at`,
      );
      if (!result.ok) throw new Error("Application status is temporarily unavailable.");
      const [application] = await result.json();
      return response.status(200).json({ application: application || null });
    }

    if (body.action === "apply") {
      if (!user.email_confirmed_at && !user.confirmed_at)
        return response.status(403).json({ error: "Confirm your account email before submitting a detective application." });
      const fullName = safeText(body.fullName, 120);
      const phone = safeText(body.phone, 32);
      const country = safeText(body.country, 100);
      const applicantRole = safeText(body.applicantRole, 100);
      const motivation = safeText(body.motivation, 1200);
      const photoType = safeText(body.photoType, 32);
      const photo = readPhoto(body.photoData, photoType);
      const experience = Number(body.yearsExperience);
      const languages = Array.isArray(body.languages)
        ? [...new Set(body.languages.map((value) => safeText(value, 40)).filter(Boolean))].slice(0, 12)
        : [];
      const specialties = Array.isArray(body.specialties)
        ? [...new Set(body.specialties.map((value) => safeText(value, 160)).filter(Boolean))].slice(0, 30)
        : [];
      if (fullName.length < 2 || phone.length < 5 || country.length < 2 || applicantRole.length < 3 || motivation.length < 20 || !Number.isInteger(experience) || experience < 0 || experience > 60 || !photo || !specialties.length || specialties.length > 15)
        return response.status(400).json({ error: "Complete your name, contact details, role, motivation, experience, 1–15 specialties and a valid photo under 2 MB." });
      if (body.applicationConsent !== true)
        return response.status(400).json({ error: "Confirm the private membership-application notice to continue." });

      const previousResponse = await adminFetch(
        `/rest/v1/detective_member_applications?user_id=eq.${encodeURIComponent(user.id)}&select=status,profile_photo_path`,
      );
      if (!previousResponse.ok) throw new Error("Application status could not be checked.");
      const [previous] = await previousResponse.json();
      if (previous?.status === "approved" || previous?.status === "suspended")
        return response.status(409).json({ error: "This account already has a detective membership record." });
      if (previous?.status === "pending")
        return response.status(409).json({ error: "Your application is already awaiting owner review." });

      const photoPath = `applications/${user.id}/${randomUUID()}.${photo.extension}`;
      await uploadPrivateObject(photoPath, photo.buffer, photoType);
      const application = {
        user_id: user.id,
        full_name: fullName,
        email: user.email.toLowerCase(),
        phone,
        country,
        state: safeText(body.state, 100),
        city: safeText(body.city, 100),
        postal_code: safeText(body.postalCode, 24),
        address: safeText(body.address, 300),
        applicant_role: applicantRole,
        organization: safeText(body.organization, 160),
        role_credential: safeText(body.roleCredential, 400),
        languages,
        years_experience: experience,
        specialties,
        qualifications: safeText(body.qualifications, 1200),
        license_details: safeText(body.licenseDetails, 400),
        motivation,
        availability: safeText(body.availability, 500),
        profile_photo_path: photoPath,
        status: "pending",
        member_id_hash: null,
        member_id_suffix: null,
        reviewed_at: null,
      };
      const saved = await adminFetch("/rest/v1/detective_member_applications?on_conflict=user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(application),
      });
      if (!saved.ok) throw new Error("Your application could not be saved securely.");
      return response.status(201).json({ ok: true, status: "pending" });
    }

    if (body.action === "verify-member") {
      const member = await getApprovedMember(user, body.memberId);
      if (!member) return response.status(403).json({ error: "Member ID or owner approval could not be verified." });
      return response.status(200).json({
        ok: true,
        member: { fullName: member.full_name, memberIdSuffix: member.member_id_suffix },
      });
    }

    if (body.action === "member-profile") {
      const member = await getApprovedMember(user, body.memberId);
      if (!member) return response.status(403).json({ error: "Member ID or owner approval could not be verified." });
      const result = await adminFetch(`/rest/v1/detective_member_applications?user_id=eq.${encodeURIComponent(user.id)}&select=phone,country,state,city,postal_code,address,languages,qualifications,availability`);
      if (!result.ok) throw new Error("Your profile is temporarily unavailable.");
      const [profile] = await result.json();
      return response.status(200).json({ profile: {
        phone: profile?.phone || "", country: profile?.country || "", state: profile?.state || "", city: profile?.city || "",
        postalCode: profile?.postal_code || "", address: profile?.address || "", languages: profile?.languages || [],
        qualifications: profile?.qualifications || "", availability: profile?.availability || "",
      } });
    }

    if (body.action === "update-member-profile") {
      const member = await getApprovedMember(user, body.memberId);
      if (!member) return response.status(403).json({ error: "Member ID or owner approval could not be verified." });
      const phone = safeText(body.phone, 32);
      const country = safeText(body.country, 100);
      const languages = Array.isArray(body.languages) ? [...new Set(body.languages.map((value) => safeText(value, 40)).filter(Boolean))].slice(0, 12) : [];
      if (phone.length < 5 || country.length < 2) return response.status(400).json({ error: "Enter a valid phone number and country." });
      const updated = await adminFetch(`/rest/v1/detective_member_applications?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ phone, country, state: safeText(body.state, 100), city: safeText(body.city, 100), postal_code: safeText(body.postalCode, 24), address: safeText(body.address, 300), languages, qualifications: safeText(body.qualifications, 1200), availability: safeText(body.availability, 500) }),
      });
      if (!updated.ok) throw new Error("Your profile could not be saved securely.");
      return response.status(200).json({ ok: true });
    }

    if (body.action === "assigned-cases") {
      const member = await getApprovedMember(user, body.memberId);
      if (!member) return response.status(403).json({ error: "Member ID or owner approval could not be verified." });
      const result = await adminFetch(
        `/rest/v1/detective_cases?assigned_member_id=eq.${encodeURIComponent(user.id)}&select=id,case_number,client_name,client_type,matter_category,service_name,country,state,district,city,area,postal_code,police_station,timing,non_sensitive_summary,status,pdf_object_path,created_at,updated_at&order=created_at.desc&limit=100`,
      );
      if (!result.ok) throw new Error("Assigned cases are temporarily unavailable.");
      const cases = await result.json();
      const visibleCases = await Promise.all(cases.map(async (item) => ({
        ...item,
        documentUrl: item.pdf_object_path ? await createPrivateSignedUrl(item.pdf_object_path, 3600).catch(() => null) : null,
      })));
      return response.status(200).json({ cases: visibleCases });
    }

    return response.status(400).json({ error: "Unknown detective-member action." });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Detective-member request failed securely." });
  }
}
