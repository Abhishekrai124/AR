import crypto from "node:crypto";

const supabaseUrl =
  process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";

function readBody(body) {
  if (body && typeof body === "object") return body;
  if (typeof body !== "string") return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

async function authenticate(request) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? user : null;
}

function razorpayCredentials() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay membership checkout is not configured.");
  }
  return { keyId, keySecret };
}

async function createOrder(user, authorization, response) {
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,account_status`,
    {
      headers: { apikey: anonKey, Authorization: authorization },
    },
  );
  if (!profileResponse.ok) {
    return response.status(503).json({
      error: "Your ARRAI community profile could not be checked. Try again later.",
    });
  }
  const profiles = await profileResponse.json();
  if (!Array.isArray(profiles) || profiles.length !== 1) {
    return response.status(409).json({
      error: "Complete your ARRAI community profile before purchasing VIP.",
    });
  }
  if (profiles[0].account_status !== "active") {
    return response.status(403).json({
      error: "This account is not eligible to purchase VIP right now.",
    });
  }
  const { keyId, keySecret } = razorpayCredentials();
  const upstream = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: 4500,
      currency: "INR",
      receipt: `vip_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`,
      notes: {
        product: "arrai_annual_vip",
        user_id: user.id,
      },
    }),
  });
  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !result.id) {
    return response.status(502).json({
      error:
        result.error?.description ||
        "Razorpay could not create the membership checkout.",
    });
  }
  return response.status(200).json({
    order_id: result.id,
    amount: result.amount,
    currency: result.currency,
    key_id: keyId,
  });
}

async function readWalletBalance(user, authorization, response) {
  const walletResponse = await fetch(
    `${supabaseUrl}/rest/v1/wallet_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=balance_paise`,
    { headers: { apikey: anonKey, Authorization: authorization } },
  );
  if (!walletResponse.ok) {
    return response.status(503).json({
      error:
        "ARRAI Wallet balance could not be read. Check that Pay and ARRAI use the same Supabase project.",
    });
  }
  const wallets = await walletResponse.json();
  if (!Array.isArray(wallets) || wallets.length > 1) {
    return response.status(502).json({
      error: "ARRAI Wallet returned an invalid balance response.",
    });
  }
  const balancePaise = wallets.length ? Number(wallets[0].balance_paise) : 0;
  if (!Number.isSafeInteger(balancePaise) || balancePaise < 0) {
    return response.status(502).json({
      error: "ARRAI Wallet returned an invalid balance.",
    });
  }
  return response.status(200).json({
    wallet_exists: wallets.length === 1,
    balance_paise: balancePaise,
    required_paise: 4500,
  });
}

async function payWithWallet(user, body, response) {
  const idempotencyKey = body.idempotencyKey;
  if (
    typeof idempotencyKey !== "string" ||
    !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(
      idempotencyKey,
    )
  ) {
    return response.status(400).json({
      error: "Invalid wallet payment reference. Please try again.",
    });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return response.status(503).json({
      error: "ARRAI Wallet checkout is not configured. Contact support.",
    });
  }
  const payment = await fetch(
    `${supabaseUrl}/rest/v1/rpc/arrai_purchase_vip_with_wallet`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_user_id: user.id,
        p_idempotency_key: idempotencyKey,
      }),
    },
  );
  const result = await payment.json().catch(() => null);
  if (!payment.ok) {
    const databaseMessage = String(result?.message || "");
    if (databaseMessage.includes("WALLET_NOT_FOUND")) {
      return response.status(409).json({
        error: "Set up your ARRAI Wallet at pay.arrai.in before purchasing VIP.",
      });
    }
    if (databaseMessage.includes("WALLET_INSUFFICIENT")) {
      return response.status(402).json({
        error: "Your ARRAI Wallet needs at least ₹45. Add money at pay.arrai.in and try again.",
      });
    }
    if (databaseMessage.includes("VIP_PROFILE_NOT_FOUND")) {
      return response.status(409).json({
        error: "Complete your ARRAI Community profile before purchasing VIP.",
      });
    }
    console.error("ARRAI Wallet VIP purchase failed:", payment.status, result);
    return response.status(502).json({
      error:
        "ARRAI Wallet could not complete this purchase. Your balance was not changed unless a successful receipt was returned; retry safely or contact support.",
    });
  }
  if (
    !Array.isArray(result) ||
    !result[0] ||
    typeof result[0].activated !== "boolean" ||
    !result[0].expires_at ||
    !Number.isSafeInteger(Number(result[0].balance_after_paise))
  ) {
    console.error("ARRAI Wallet VIP purchase returned an invalid result:", result);
    return response.status(502).json({
      error: "ARRAI Wallet returned an invalid membership receipt. Contact support.",
    });
  }
  return response.status(200).json({
    paid: true,
    provider: "arrai_wallet",
    amount_paise: 4500,
    activated: result[0].activated,
    expires_at: result[0].expires_at,
    balance_after_paise: Number(result[0].balance_after_paise),
  });
}

async function verifyPayment(user, body, response) {
  const { keyId, keySecret } = razorpayCredentials();
  const { orderId, paymentId, signature } = body;
  if (
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string" ||
    !orderId ||
    !paymentId ||
    !/^[a-f\d]{64}$/i.test(signature)
  ) {
    return response.status(400).json({ error: "Invalid Razorpay payment response." });
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, "hex");
  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(expected, received)
  ) {
    return response.status(400).json({ error: "Payment verification failed." });
  }

  const upstream = await fetch(
    `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
    },
  );
  const order = await upstream.json().catch(() => ({}));
  if (
    !upstream.ok ||
    order.id !== orderId ||
    order.status !== "paid" ||
    order.currency !== "INR" ||
    Number(order.amount) !== 4500 ||
    order.notes?.product !== "arrai_annual_vip" ||
    order.notes?.user_id !== user.id
  ) {
    return response.status(400).json({
      error: "Paid order does not match this account's ₹45 annual membership.",
    });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return response.status(503).json({
      error: "Payment verified, but VIP activation is not configured. Contact support.",
    });
  }
  const activation = await fetch(
    `${supabaseUrl}/rest/v1/rpc/arrai_activate_vip_membership`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_user_id: user.id,
        p_order_id: orderId,
        p_payment_id: paymentId,
      }),
    },
  );
  const result = await activation.json().catch(() => null);
  if (!activation.ok || !Array.isArray(result) || !result[0]) {
    return response.status(502).json({
      error:
        "Payment was verified, but membership activation failed. Contact support with your payment ID.",
    });
  }
  return response.status(200).json({
    verified: true,
    activated: result[0].activated,
    expires_at: result[0].expires_at,
  });
}

export default async function handler(request, response) {
  try {
    const action =
      request.query?.action ||
      new URL(request.url, "http://localhost").searchParams.get("action");
    if (
      (action === "wallet-balance" && request.method !== "GET") ||
      (action !== "wallet-balance" && request.method !== "POST")
    ) {
      return response.status(405).json({ error: "Method not allowed." });
    }
    const user = await authenticate(request);
    if (!user) return response.status(401).json({ error: "Sign in to continue." });

    if (action === "wallet-balance")
      return await readWalletBalance(user, request.headers.authorization, response);
    if (action === "wallet-pay")
      return await payWithWallet(user, readBody(request.body), response);
    if (action === "create-order")
      return await createOrder(
        user,
        request.headers.authorization,
        response,
      );
    if (action === "verify") {
      return await verifyPayment(user, readBody(request.body), response);
    }
    return response.status(404).json({ error: "Unknown membership action." });
  } catch (error) {
    console.error("VIP membership request failed:", error);
    return response.status(502).json({
      error: error.message || "Membership checkout could not be completed.",
    });
  }
}
