import crypto from "node:crypto";

const supabaseUrl =
  process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

const serviceHeaders = () => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
});

const readBody = (body) => {
  if (body && typeof body === "object") return body;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return {};
};
const requestError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getAction = (request) =>
  request.query?.action ||
  new URL(request.url, "http://localhost").searchParams.get("action");

async function authenticatedUser(request) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? { ...user, authorization } : null;
}

async function requireOwner(user) {
  const ownerEmail = process.env.OWNER_EMAIL || "abhishekrai6897@gmail.com";
  if (user.email?.toLowerCase() !== ownerEmail.toLowerCase())
    throw requestError(403, "Only the verified ARRAI owner can review donations.");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw requestError(503, "Donation review needs secure server configuration.");
}

async function activeProfile(user) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,account_status,display_name`,
    { headers: serviceHeaders() },
  );
  if (!response.ok)
    throw requestError(503, "Could not verify your ARRAI profile.");
  const [profile] = await response.json();
  if (!profile || profile.account_status !== "active")
    throw requestError(403, "An active ARRAI account is required to donate.");
  return profile;
}

function donationAmount(value) {
  const amount = String(value ?? "").trim();
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(amount))
    throw requestError(400, "Enter a donation between ₹1 and ₹1,00,000.");
  const paise = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(paise) || paise < 100 || paise > 10000000)
    throw requestError(400, "Enter a donation between ₹1 and ₹1,00,000.");
  return paise;
}

async function insertDonation(user, amountPaise, paymentProvider, displayPublic) {
  const response = await fetch(`${supabaseUrl}/rest/v1/family_donations`, {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      amount_paise: amountPaise,
      payment_provider: paymentProvider,
      display_public: displayPublic === true,
    }),
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok || !rows[0])
    throw new Error("Could not start the donation. Apply the ARRAI Family database migration.");
  return rows[0];
}

async function updateDonation(id, filters, changes) {
  const query = new URLSearchParams({ id: `eq.${id}`, ...filters });
  const response = await fetch(
    `${supabaseUrl}/rest/v1/family_donations?${query}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(changes),
    },
  );
  const rows = await response.json().catch(() => []);
  if (!response.ok || !rows.length)
    throw new Error("Donation record could not be updated.");
  return rows;
}

async function createRazorpayOrder(user, body, response) {
  await activeProfile(user);
  const amountPaise = donationAmount(body.amount);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return response.status(503).json({ error: "Donation checkout is not configured." });
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !keySecret)
    return response.status(503).json({ error: "Razorpay checkout is not configured." });

  const donation = await insertDonation(user, amountPaise, "razorpay", body.displayPublic);
  const upstream = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: `arf_${donation.id.replaceAll("-", "").slice(0, 24)}`,
      notes: {
        product: "arrai_family_donation",
        donation_id: donation.id,
        user_id: user.id,
      },
    }),
  });
  const order = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !order.id) {
    await updateDonation(donation.id, {}, { payment_status: "failed" });
    return response.status(502).json({
      error: order.error?.description || "Razorpay could not start checkout.",
    });
  }
  await updateDonation(donation.id, {}, { razorpay_order_id: order.id });
  return response.status(200).json({
    donation_id: donation.id,
    order_id: order.id,
    amount: amountPaise,
    currency: "INR",
    key_id: keyId,
  });
}

async function verifyRazorpayDonation(user, body, response) {
  const { donationId, orderId, paymentId, signature } = body;
  if (
    typeof donationId !== "string" ||
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string" ||
    !/^[a-f\d]{64}$/i.test(signature)
  )
    return response.status(400).json({ error: "Invalid Razorpay payment response." });

  const secret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  if (!secret || !keyId)
    return response.status(503).json({ error: "Razorpay verification is not configured." });
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, "hex");
  if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received))
    return response.status(400).json({ error: "Razorpay payment signature is invalid." });

  const donationResponse = await fetch(
    `${supabaseUrl}/rest/v1/family_donations?id=eq.${encodeURIComponent(donationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,amount_paise,payment_status,razorpay_order_id`,
    { headers: serviceHeaders() },
  );
  if (!donationResponse.ok)
    throw requestError(503, "Could not load the donation record for verification.");
  const [donation] = await donationResponse.json();
  if (!donation || donation.razorpay_order_id !== orderId)
    return response.status(404).json({ error: "Donation order was not found for this account." });
  if (donation.payment_status === "verified")
    return response.status(200).json({ verified: true, alreadyVerified: true });

  const orderResponse = await fetch(
    `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,
    { headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}` } },
  );
  const order = await orderResponse.json().catch(() => ({}));
  const paymentResponse = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}` } },
  );
  const payment = await paymentResponse.json().catch(() => ({}));
  if (!orderResponse.ok || !paymentResponse.ok)
    return response.status(502).json({
      error: "Razorpay could not confirm this payment right now. Please retry safely.",
    });
  if (
    order.status !== "paid" ||
    order.currency !== "INR" ||
    Number(order.amount) !== donation.amount_paise ||
    order.notes?.product !== "arrai_family_donation" ||
    order.notes?.donation_id !== donation.id ||
    order.notes?.user_id !== user.id ||
    payment.order_id !== orderId ||
    Number(payment.amount) !== donation.amount_paise ||
    payment.currency !== "INR" ||
    payment.status !== "captured"
  )
    return response.status(400).json({ error: "Razorpay payment could not be verified." });

  await updateDonation(donation.id, { payment_status: "eq.pending" }, {
    payment_status: "verified",
    razorpay_payment_id: paymentId,
    verified_at: new Date().toISOString(),
  });
  return response.status(200).json({ verified: true });
}

async function startUpiDonation(user, body, response) {
  await activeProfile(user);
  const amountPaise = donationAmount(body.amount);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return response.status(503).json({ error: "Direct UPI donations are not configured." });
  const donation = await insertDonation(user, amountPaise, "direct_upi", body.displayPublic);
  const txnRef = `ARF${donation.id.replaceAll("-", "").slice(0, 20)}`;
  const upi = new URLSearchParams({
    pa: "kuzu@ptyes",
    pn: "ARRAI Family",
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: `ARRAI Family donation ${txnRef}`,
    tr: txnRef,
  });
  return response.status(200).json({
    donation_id: donation.id,
    amount_paise: amountPaise,
    upi_uri: `upi://pay?${upi.toString()}`,
  });
}

async function submitUpiReference(user, body, response) {
  const donationId = String(body.donationId || "");
  const reference = String(body.reference || "").trim().replace(/\s/g, "");
  if (!/^[A-Za-z0-9-]{6,35}$/.test(reference))
    return response.status(400).json({ error: "Enter the UPI transaction reference/UTR from your payment app." });
  const existingResponse = await fetch(
    `${supabaseUrl}/rest/v1/family_donations?id=eq.${encodeURIComponent(donationId)}&user_id=eq.${encodeURIComponent(user.id)}&payment_provider=eq.direct_upi&select=id,payment_status`,
    { headers: serviceHeaders() },
  );
  const [donation] = existingResponse.ok ? await existingResponse.json() : [];
  if (!donation)
    return response.status(404).json({ error: "UPI donation was not found for this account." });
  if (donation.payment_status === "review")
    return response.status(200).json({ submitted: true, alreadySubmitted: true });
  if (donation.payment_status !== "pending")
    return response.status(409).json({ error: "This UPI donation is no longer awaiting a transaction reference." });
  try {
    await updateDonation(
      donation.id,
      { user_id: `eq.${user.id}`, payment_status: "eq.pending" },
      { upi_reference: reference, payment_status: "review", utr_submitted_at: new Date().toISOString() },
    );
  } catch {
    return response.status(409).json({ error: "That UPI reference is already submitted or could not be saved." });
  }
  return response.status(200).json({ submitted: true, pendingReview: true });
}

async function listUpiReviews(user, response) {
  await requireOwner(user);
  const reviewsResponse = await fetch(
    `${supabaseUrl}/rest/v1/family_donations?select=id,user_id,amount_paise,display_public,upi_reference,created_at,utr_submitted_at,profiles!family_donations_user_id_fkey(display_name,username,avatar_url)&payment_provider=eq.direct_upi&payment_status=eq.review&order=utr_submitted_at.asc&limit=100`,
    { headers: serviceHeaders() },
  );
  if (!reviewsResponse.ok)
    throw new Error("Could not load UPI donations awaiting review.");
  return response.status(200).json({ donations: await reviewsResponse.json() });
}

async function reviewUpiDonation(user, body, response) {
  await requireOwner(user);
  const id = String(body.id || "");
  const decision = body.decision;
  if (!id || !["verify", "reject"].includes(decision))
    return response.status(400).json({ error: "Invalid UPI review decision." });
  await updateDonation(
    id,
    { payment_provider: "eq.direct_upi", payment_status: "eq.review" },
    {
      payment_status: decision === "verify" ? "verified" : "rejected",
      verified_at: decision === "verify" ? new Date().toISOString() : null,
    },
  );
  return response.status(200).json({ reviewed: true });
}

export default async function handler(request, response) {
  const action = getAction(request);
  if (action === "leaderboard" && request.method === "GET") {
    try {
      const result = await fetch(`${supabaseUrl}/rest/v1/rpc/arrai_family_leaderboard`, {
        method: "POST",
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: "{}",
      });
      if (!result.ok)
        return response.status(503).json({
          error: "The ARRAI Family board is not ready. Apply its database migration.",
        });
      response.setHeader("Cache-Control", "private, no-store");
      return response.status(200).json(await result.json());
    } catch {
      return response.status(502).json({ error: "ARRAI Family leaderboard is unavailable." });
    }
  }

  const adminAction = action === "admin-list" || action === "admin-review";
  const methodIsValid =
    action === "admin-list"
      ? request.method === "GET"
      : request.method === "POST";
  if (!methodIsValid)
    return response.status(405).json({ error: "Method not allowed." });

  try {
    const user = await authenticatedUser(request);
    if (!user) return response.status(401).json({ error: "Sign in to continue." });
    if (adminAction) {
      if (action === "admin-list") return await listUpiReviews(user, response);
      return await reviewUpiDonation(user, readBody(request.body), response);
    }
    const body = readBody(request.body);
    if (action === "create-order") return await createRazorpayOrder(user, body, response);
    if (action === "verify") return await verifyRazorpayDonation(user, body, response);
    if (action === "upi-start") return await startUpiDonation(user, body, response);
    if (action === "upi-submit") return await submitUpiReference(user, body, response);
    return response.status(404).json({ error: "Unknown ARRAI Family action." });
  } catch (error) {
    console.error("ARRAI Family request failed:", error.message);
    return response.status(error.statusCode || 502).json({
      error: error.message || "ARRAI Family request could not be completed.",
    });
  }
}
