import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const supabaseUrl =
  process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
export const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

export const adminHeaders = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Detective services need server-side Supabase configuration.");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
};

export const adminFetch = (path, options = {}) =>
  fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: { ...adminHeaders(), ...options.headers },
  });

export const verifyUser = async (request) => {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: authorization },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id && user.email ? user : null;
};

export const isOwner = (user) =>
  Boolean(
    user?.email &&
      user.email.toLowerCase() ===
        (process.env.OWNER_EMAIL || "abhishekrai6897@gmail.com").toLowerCase(),
  );

export const sha256 = (value) =>
  createHash("sha256").update(String(value)).digest("hex");

export const privateRateHash = (value) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Detective services need server-side Supabase configuration.");
  return createHmac("sha256", key).update(String(value)).digest("hex");
};

export const matchesHash = (value, expectedHex) => {
  if (!/^[a-f0-9]{64}$/i.test(expectedHex || "")) return false;
  const actual = Buffer.from(sha256(value), "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const encodeStoragePath = (path) =>
  path.split("/").map(encodeURIComponent).join("/");

export const uploadPrivateObject = async (path, bytes, contentType) => {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/detective-private/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
    },
  );
  if (!response.ok) throw new Error("The private case document could not be stored.");
};

export const deletePrivateObject = async (path) => {
  if (!path) return;
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/detective-private/${encodeStoragePath(path)}`,
    {
      method: "DELETE",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!response.ok && response.status !== 404)
    throw new Error("A private case file could not be removed.");
};

export const createPrivateSignedUrl = async (path, expiresIn = 604800) => {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/detective-private/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn }),
    },
  );
  if (!response.ok) throw new Error("A temporary document link could not be created.");
  const result = await response.json();
  const signedPath = result.signedURL || result.signedUrl;
  if (!signedPath) throw new Error("A temporary document link could not be created.");
  return signedPath.startsWith("http") ? signedPath : `${supabaseUrl}/storage/v1${signedPath}`;
};

export const sendTransactionalEmail = async ({ to, subject, text, html }) => {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
    return { sent: false, reason: "email_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      text,
      html,
    }),
  });
  if (!response.ok) return { sent: false, reason: "email_delivery_failed" };
  return { sent: true };
};

export const safeText = (value, maxLength = 500) =>
  String(value ?? "").trim().slice(0, maxLength);
