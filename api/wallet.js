import crypto from "node:crypto";

const supabaseUrl =
  process.env.SUPABASE_URL || "https://atphyjukjgnnbfbnizyx.supabase.co";
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_1mRpCP5-rupEHnhOV3aK1w_lhFwAo6l";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const walletMode = process.env.ARRAI_WALLET_MODE;

class WalletError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const readBody = (body) => {
  if (typeof body !== "string") return body && typeof body === "object" ? body : {};
  try {
    return JSON.parse(body);
  } catch {
    throw new WalletError("Invalid request body.");
  }
};

const requestAction = (request) =>
  request.query?.action ||
  new URL(request.url, "http://localhost").searchParams.get("action");

const serviceHeaders = (extra = {}) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
  ...extra,
});

async function supabase(path, options = {}) {
  let result;
  try {
    result = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...options,
      headers: serviceHeaders(options.headers),
    });
  } catch {
    throw new WalletError("Could not reach the Supabase wallet service.", 503);
  }
  const text = await result.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!result.ok) {
    const detail = data?.message || data?.hint;
    throw new WalletError(
      detail
        ? `Wallet database error: ${detail}`
        : "Wallet database request failed. Check the wallet migration and server configuration.",
      result.status >= 500 ? 503 : 400,
    );
  }
  return data;
}

async function authenticate(request) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer "))
    throw new WalletError("Sign in to use your ARRAI wallet.", 401);
  if (!serviceKey)
    throw new WalletError(
      "Wallet is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
      503,
    );
  let result;
  try {
    result = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
    });
  } catch {
    throw new WalletError("Could not verify your ARRAI sign-in.", 503);
  }
  const user = await result.json().catch(() => null);
  if (!result.ok || !user?.id)
    throw new WalletError("Your sign-in has expired. Please sign in again.", 401);
  return user;
}

function ensureDemoMode() {
  if (walletMode !== "demo")
    throw new WalletError(
      "Wallet money movement is in demo mode only. Live stored-value transfers are disabled until an approved provider and required compliance are in place.",
      403,
    );
}

async function ensureProfile(user) {
  const query = new URLSearchParams({
    id: `eq.${user.id}`,
    select: "id,username,display_name",
    limit: "1",
  });
  const profiles = await supabase(`profiles?${query}`);
  if (profiles?.[0]) return profiles[0];

  const compactId = user.id.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const username = `ar${compactId.slice(0, 8)}${compactId.slice(-6)}`;
  const displayName = String(
    user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "ARRAI member",
  )
    .trim()
    .slice(0, 50);
  const created = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: "POST",
    headers: serviceHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({
      id: user.id,
      username,
      display_name: displayName || "ARRAI member",
    }),
  });
  if (!created.ok) {
    const failure = await created.json().catch(() => ({}));
    if (failure.code === "23505")
      throw new WalletError(
        "Your ARRAI profile needs a unique username before you can use the wallet. Open Community to choose one.",
        409,
      );
    throw new WalletError(
      "Could not set up your ARRAI profile for wallet use. Check the profile database migration.",
      503,
    );
  }
  return (await created.json())[0];
}

async function rpc(name, args) {
  return supabase(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

async function getWallet(user) {
  const wallet = await rpc("arrai_wallet_ensure", { p_user: user.id });
  const walletQuery = new URLSearchParams({
    user_id: `eq.${user.id}`,
    select:
      "user_id,balance_paise,total_added_paise,total_spent_paise,reward_paise,status,kyc_status,referral_code,created_at",
    limit: "1",
  });
  const [walletRows, transactions, requests] = await Promise.all([
    supabase(`wallets?${walletQuery}`),
    supabase(
      `wallet_transactions?${new URLSearchParams({
        user_id: `eq.${user.id}`,
        select:
          "id,direction,amount_paise,balance_after_paise,kind,status,counterparty_name,counterparty_ref,description,created_at",
        order: "created_at.desc",
        limit: "40",
      })}`,
    ),
    supabase(
      `wallet_requests?${new URLSearchParams({
        or: `(requester_id.eq.${user.id},payer_id.eq.${user.id})`,
        select:
          "id,token,requester_id,payer_id,amount_paise,note,status,created_at,expires_at,settled_at",
        order: "created_at.desc",
        limit: "30",
      })}`,
    ),
  ]);
  if (!wallet || !walletRows?.[0])
    throw new WalletError("Could not load your wallet.", 503);
  return {
    wallet: walletRows[0],
    transactions: transactions || [],
    requests: requests || [],
    profile: await ensureProfile(user),
    mode: "demo",
  };
}

async function lookupMember(identifier) {
  const query = String(identifier || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(query) && !/^ar[a-z0-9]{8,18}$/i.test(query))
    throw new WalletError("Enter a valid ARRAI username or wallet code.");

  let profile;
  if (/^ar[a-z0-9]{8,18}$/i.test(query)) {
    const walletQuery = new URLSearchParams({
      referral_code: `eq.${query.toUpperCase()}`,
      select: "user_id",
      limit: "1",
    });
    const wallets = await supabase(`wallets?${walletQuery}`);
    if (wallets?.[0]) {
      const profileQuery = new URLSearchParams({
        id: `eq.${wallets[0].user_id}`,
        select: "id,username,display_name",
        limit: "1",
      });
      profile = (await supabase(`profiles?${profileQuery}`))?.[0];
    }
  } else {
    const profileQuery = new URLSearchParams({
      username: `eq.${query}`,
      select: "id,username,display_name",
      limit: "1",
    });
    profile = (await supabase(`profiles?${profileQuery}`))?.[0];
  }
  if (!profile) throw new WalletError("No ARRAI member matches that username or wallet code.", 404);
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
  };
}

async function createTopupOrder(user, body, response) {
  ensureDemoMode();
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !keySecret)
    throw new WalletError(
      "Wallet test top-ups are not configured. Add Razorpay test keys on the server.",
      503,
    );
  if (!keyId.startsWith("rzp_test_"))
    throw new WalletError(
      "Wallet top-ups accept test keys only. Live wallet funding is disabled.",
      403,
    );
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < 10 || amount > 50000)
    throw new WalletError("Choose a test top-up between ₹10 and ₹50,000.");

  const receipt = `aw_${crypto.randomUUID().replaceAll("-", "").slice(0, 28)}`;
  let upstream;
  try {
    upstream = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount * 100,
        currency: "INR",
        receipt,
        notes: { product: "arrai_wallet_topup", user_id: user.id },
      }),
    });
  } catch {
    throw new WalletError("Could not reach Razorpay test checkout.", 502);
  }
  const order = await upstream.json().catch(() => ({}));
  if (!upstream.ok)
    throw new WalletError(
      `Razorpay rejected the test order: ${order.error?.description || "check your test keys."}`,
      upstream.status === 401 ? 401 : 502,
    );

  await supabase("wallet_orders", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: user.id,
      razorpay_order_id: order.id,
      receipt,
      amount_paise: amount * 100,
      credit_paise: amount * 100,
      bonus_paise: 0,
      purpose: "wallet_topup",
    }),
  });
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: keyId,
  });
}

async function verifyTopup(user, body) {
  ensureDemoMode();
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const secret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !secret || !keyId.startsWith("rzp_test_"))
    throw new WalletError("Wallet test top-ups are not configured.", 503);
  const { orderId, paymentId, signature } = body;
  if (
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string" ||
    !orderId ||
    !paymentId ||
    !/^[a-f\d]{64}$/i.test(signature)
  )
    throw new WalletError("Invalid test payment response.");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const received = Buffer.from(signature, "hex");
  if (
    received.length !== 32 ||
    !crypto.timingSafeEqual(Buffer.from(expected, "hex"), received)
  )
    throw new WalletError("Payment verification failed.", 400);

  const walletOrderQuery = new URLSearchParams({
    razorpay_order_id: `eq.${orderId}`,
    user_id: `eq.${user.id}`,
    purpose: "eq.wallet_topup",
    select: "id,razorpay_order_id,amount_paise,credit_paise,status",
    limit: "1",
  });
  const [walletOrder] = (await supabase(`wallet_orders?${walletOrderQuery}`)) || [];
  if (!walletOrder)
    throw new WalletError("That test order does not belong to your account.", 403);

  let upstream;
  try {
    upstream = await fetch(
      `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
        },
      },
    );
  } catch {
    throw new WalletError("Could not reach Razorpay to verify the test top-up.", 502);
  }
  const order = await upstream.json().catch(() => ({}));
  if (
    !upstream.ok ||
    order.id !== orderId ||
    order.status !== "paid" ||
    Number(order.amount) !== Number(walletOrder.amount_paise) ||
    order.notes?.product !== "arrai_wallet_topup" ||
    order.notes?.user_id !== user.id
  )
    throw new WalletError("Razorpay could not confirm this test top-up.", 400);

  const transaction = await rpc("arrai_wallet_credit", {
    p_user: user.id,
    p_amount: Number(walletOrder.credit_paise),
    p_kind: "topup",
    p_reference: `topup:${orderId}`,
    p_description: "Razorpay test wallet top-up",
    p_metadata: { mode: "demo" },
    p_razorpay_order: orderId,
    p_razorpay_payment: paymentId,
  });
  const updated = await supabase(
    `wallet_orders?razorpay_order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(user.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString() }),
    },
  );
  return { verified: true, mode: "demo", transaction, updated };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  try {
    const action = requestAction(request);
    const user = await authenticate(request);
    if (action !== "lookup") {
      ensureDemoMode();
      await ensureProfile(user);
    }

    if (request.method === "GET" && action === "overview") {
      ensureDemoMode();
      return response.status(200).json(await getWallet(user));
    }
    if (request.method === "GET" && action === "lookup") {
      const query = new URL(request.url, "http://localhost").searchParams.get("q");
      return response.status(200).json({ member: await lookupMember(query) });
    }
    if (request.method === "GET" && action === "payment-request") {
      ensureDemoMode();
      const token = new URL(request.url, "http://localhost").searchParams.get("token");
      if (!token || !/^[A-Za-z0-9_-]{24,64}$/.test(token))
        throw new WalletError("Invalid money request.");
      const requestQuery = new URLSearchParams({
        token: `eq.${token}`,
        select:
          "id,token,requester_id,amount_paise,note,status,created_at,expires_at",
        limit: "1",
      });
      const [moneyRequest] = (await supabase(`wallet_requests?${requestQuery}`)) || [];
      if (!moneyRequest)
        throw new WalletError("This money request could not be found.", 404);
      const profileQuery = new URLSearchParams({
        id: `eq.${moneyRequest.requester_id}`,
        select: "username,display_name",
        limit: "1",
      });
      const [requester] = (await supabase(`profiles?${profileQuery}`)) || [];
      return response.status(200).json({ request: moneyRequest, requester });
    }
    if (request.method === "POST") {
      const body = readBody(request.body);
      if (action === "topup-order")
        return await createTopupOrder(user, body, response);
      if (action === "verify-topup")
        return response.status(200).json(await verifyTopup(user, body));
      ensureDemoMode();

      if (action === "transfer") {
        const member = await lookupMember(body.recipient);
        if (member.id === user.id)
          throw new WalletError("You cannot send money to your own wallet.");
        const amountPaise = Number(body.amountPaise);
        if (
          !Number.isSafeInteger(amountPaise) ||
          amountPaise < 100 ||
          amountPaise > 1000000
        )
          throw new WalletError("Transfers must be between ₹1 and ₹10,000.");
        const reference = String(body.reference || crypto.randomUUID());
        if (!/^[a-f\d-]{36}$/i.test(reference))
          throw new WalletError("Invalid transfer reference.");
        const result = await rpc("arrai_wallet_transfer", {
          p_sender: user.id,
          p_recipient: member.id,
          p_amount: amountPaise,
          p_note: String(body.note || "").trim().slice(0, 200),
          p_reference: `transfer:${reference}`,
        });
        return response.status(200).json({ ...result, member });
      }

      if (action === "create-request") {
        const amountPaise = Number(body.amountPaise);
        if (!Number.isSafeInteger(amountPaise) || amountPaise < 100 || amountPaise > 1000000)
          throw new WalletError("Money requests must be between ₹1 and ₹10,000.");
        const token = crypto.randomBytes(24).toString("base64url");
        const [moneyRequest] =
          (await supabase("wallet_requests", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              token,
              requester_id: user.id,
              amount_paise: amountPaise,
              note: String(body.note || "").trim().slice(0, 200),
            }),
          })) || [];
        if (!moneyRequest)
          throw new WalletError("Could not create the money request.", 503);
        return response.status(201).json({
          request: moneyRequest,
          shareUrl: `https://pay.arrai.in/?request=${encodeURIComponent(token)}`,
        });
      }

      if (action === "pay-request") {
        if (typeof body.token !== "string")
          throw new WalletError("Invalid payment request.");
        const reference = String(body.reference || crypto.randomUUID());
        if (!/^[a-f\d-]{36}$/i.test(reference))
          throw new WalletError("Invalid payment reference.");
        const result = await rpc("arrai_wallet_pay_request", {
          p_payer: user.id,
          p_token: body.token,
          p_reference: `request:${reference}`,
        });
        return response.status(200).json(result);
      }

      if (action === "cancel-request") {
        if (typeof body.id !== "string")
          throw new WalletError("Invalid money request.");
        const result = await supabase(
          `wallet_requests?id=eq.${encodeURIComponent(body.id)}&requester_id=eq.${encodeURIComponent(user.id)}&status=eq.open`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ status: "cancelled" }),
          },
        );
        if (!result?.length)
          throw new WalletError("This open request could not be cancelled.", 404);
        return response.status(200).json({ request: result[0] });
      }
    }
    if (request.method !== "GET" && request.method !== "POST")
      return response.status(405).json({ error: "Method not allowed." });
    return response.status(404).json({ error: "Unknown wallet action." });
  } catch (error) {
    const status = error instanceof WalletError ? error.status : 500;
    return response.status(status).json({
      error:
        error instanceof WalletError
          ? error.message
          : "Wallet request failed. Please try again or contact support.",
    });
  }
}
