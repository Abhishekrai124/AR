const familyStatus = document.querySelector("#familyDonationStatus");
const familyRazorpayButton = document.querySelector("#familyRazorpayButton");
const familyUpiButton = document.querySelector("#familyUpiButton");
const familyUpiPayment = document.querySelector("#familyUpiPayment");
let familyUser = null;
let familyAccessToken = "";
let pendingUpiDonationId = "";

const familyMoney = (paise) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(paise || 0) / 100);
const familySay = (message, type = "") => {
  familyStatus.textContent = message;
  familyStatus.className = `community-status ${type}`;
};
const familyRequest = async (action, payload = {}, method = "POST") => {
  const response = await fetch(`/api/family?action=${encodeURIComponent(action)}`, {
    method,
    headers: {
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      ...(familyAccessToken ? { Authorization: `Bearer ${familyAccessToken}` } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      result?.error || `ARRAI Family service returned HTTP ${response.status}.`,
    );
  if (!result) throw new Error("ARRAI Family service returned an invalid response.");
  return result;
};
const familyAmount = () => {
  const amount = document.querySelector("#familyAmount").value;
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(amount) || Number(amount) < 1 || Number(amount) > 100000)
    throw new Error("Enter an amount between ₹1 and ₹1,00,000.");
  return amount;
};

async function loadFamilyLeaderboard() {
  const list = document.querySelector("#familyLeaderboard");
  const status = document.querySelector("#familyBoardStatus");
  status.textContent = "";
  try {
    const board = await familyRequest("leaderboard", {}, "GET");
    document.querySelector("#familyTotal").textContent = familyMoney(board.total_donated_paise);
    document.querySelector("#familyGiftCount").textContent = Number(
      board.verified_donations || 0,
    ).toLocaleString("en-IN");
    list.replaceChildren();
    if (!board.top_donors?.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "Your name could be the first here—public sharing is optional.";
      list.append(empty);
      return;
    }
    board.top_donors.forEach((donor, index) => {
      const row = document.createElement("li");
      row.className = "family-donor";
      const rank = document.createElement("span");
      rank.className = "family-donor-rank";
      rank.textContent = String(index + 1).padStart(2, "0");
      const avatar = document.createElement("span");
      avatar.className = "family-donor-avatar";
      avatar.textContent = (donor.display_name || "A").trim().slice(0, 1).toUpperCase();
      if (donor.avatar_url) {
        const image = document.createElement("img");
        try {
          const avatarUrl = new URL(donor.avatar_url);
          if (avatarUrl.protocol === "https:") {
            image.src = avatarUrl.href;
            image.alt = "";
            image.addEventListener("error", () => image.remove(), { once: true });
            avatar.append(image);
          }
        } catch {
          // Invalid profile image URLs fall back to the donor initial.
        }
      }
      const name = document.createElement("span");
      name.className = "family-donor-name";
      name.textContent = donor.display_name || "ARRAI supporter";
      const amount = document.createElement("strong");
      amount.textContent = familyMoney(donor.amount_paise);
      row.append(rank, avatar, name, amount);
      list.append(row);
    });
  } catch (error) {
    document.querySelector("#familyTotal").textContent = "Unavailable";
    document.querySelector("#familyGiftCount").textContent = "—";
    list.replaceChildren();
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Verified giving data could not be loaded right now.";
    list.append(empty);
    status.textContent = error.message;
  }
}

async function ensureRazorpay() {
  if (window.Razorpay) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Razorpay checkout could not load."));
    document.head.append(script);
  });
}

familyRazorpayButton.addEventListener("click", async () => {
  if (!familyUser) return familySay("Sign in before starting a donation.", "error");
  familyRazorpayButton.disabled = true;
  familySay("Preparing secure Razorpay checkout…");
  try {
    const order = await familyRequest("create-order", {
      amount: familyAmount(),
      displayPublic: document.querySelector("#familyPublicConsent").checked,
    });
    if (
      order.currency !== "INR" ||
      !Number.isSafeInteger(order.amount) ||
      !order.order_id ||
      !order.donation_id ||
      !order.key_id
    )
      throw new Error("Razorpay returned an invalid donation order.");
    await ensureRazorpay();
    const checkout = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: "ARRAI Family",
      description: `Community donation · ${familyMoney(order.amount)}`,
      order_id: order.order_id,
      prefill: {
        name: familyUser.user_metadata?.full_name || familyUser.user_metadata?.name || familyUser.name || "",
        email: familyUser.email || "",
      },
      theme: { color: "#38bdf8" },
      handler: async (payment) => {
        familySay("Verifying payment securely with Razorpay…");
        try {
          await familyRequest("verify", {
            donationId: order.donation_id,
            orderId: payment.razorpay_order_id,
            paymentId: payment.razorpay_payment_id,
            signature: payment.razorpay_signature,
          });
          familySay("Donation verified. Thank you for supporting ARRAI Family!", "success");
          await loadFamilyLeaderboard();
        } catch (error) {
          familySay(
            `${error.message} If charged, keep payment ID ${payment.razorpay_payment_id} and contact ARRAI support.`,
            "error",
          );
        } finally {
          familyRazorpayButton.disabled = false;
        }
      },
      modal: {
        ondismiss: () => {
          familyRazorpayButton.disabled = false;
          familySay("Checkout closed. No donation was confirmed.");
        },
      },
    });
    checkout.on("payment.failed", (event) => {
      familyRazorpayButton.disabled = false;
      familySay(event.error?.description || "Razorpay payment did not complete.", "error");
    });
    checkout.open();
  } catch (error) {
    familySay(error.message, "error");
    familyRazorpayButton.disabled = false;
  }
});

familyUpiButton.addEventListener("click", async () => {
  if (!familyUser) return familySay("Sign in before starting a donation.", "error");
  familyUpiButton.disabled = true;
  familySay("Creating your direct UPI payment QR…");
  try {
    const result = await familyRequest("upi-start", {
      amount: familyAmount(),
      displayPublic: document.querySelector("#familyPublicConsent").checked,
    });
    pendingUpiDonationId = result.donation_id;
    const qr = document.querySelector("#familyUpiQr");
    qr.replaceChildren();
    if (window.QRCode) {
      new window.QRCode(qr, {
        text: result.upi_uri,
        width: 220,
        height: 220,
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    } else {
      qr.textContent = "QR could not load. Use the UPI app link below.";
    }
    document.querySelector("#familyUpiAmount").textContent = familyMoney(result.amount_paise);
    const upiLink = document.querySelector("#familyUpiLink");
    upiLink.href = result.upi_uri;
    familyUpiPayment.hidden = false;
    familyUpiPayment.scrollIntoView({ behavior: "smooth", block: "center" });
    familySay("Scan the QR or open your UPI app. Submit the UTR after payment.", "success");
  } catch (error) {
    familySay(error.message, "error");
  } finally {
    familyUpiButton.disabled = false;
  }
});

document.querySelector("#familyUtrForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await familyRequest("upi-submit", {
      donationId: pendingUpiDonationId,
      reference: document.querySelector("#familyUtr").value,
    });
    familySay("UTR submitted. It will count on the board after owner verification.", "success");
    event.currentTarget.reset();
  } catch (error) {
    familySay(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#familyRefreshBoard").addEventListener("click", loadFamilyLeaderboard);
window.arraiAuth
  .then(({ isAuthenticated, user }) => {
    if (!isAuthenticated) {
      document.querySelector("#familyAuthPrompt").hidden = false;
      familyRazorpayButton.disabled = true;
      familyUpiButton.disabled = true;
      return;
    }
    familyUser = user;
    return window.arraiSupabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      familyAccessToken = data.session?.access_token || "";
      if (!familyAccessToken) throw new Error("Sign in again before donating.");
      document.querySelector("#familyAuthPrompt").hidden = true;
      familyRazorpayButton.disabled = false;
      familyUpiButton.disabled = false;
    });
  })
  .catch((error) => familySay(error.message || "Sign in before donating.", "error"));
loadFamilyLeaderboard();
