(() => {
  const $ = (selector) => document.querySelector(selector);
  let checkoutScript;
  const chatHistory = [];

  async function loadRazorpay() {
    if (window.Razorpay) return;
    if (!checkoutScript) {
      checkoutScript = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Razorpay checkout did not load. Please try again."));
        document.head.append(script);
      });
    }
    await checkoutScript;
  }

  async function startSupportCheckout(button) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Opening secure checkout…";
    try {
      const response = await fetch("/api/vip-membership?action=create-donation-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order.error || "Razorpay could not start checkout.");
      if (
        order.amount !== 4500 ||
        order.currency !== "INR" ||
        typeof order.order_id !== "string" ||
        typeof order.key_id !== "string"
      ) throw new Error("The secure checkout returned an invalid support order.");
      await loadRazorpay();
      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "ARRAI",
        description: "One-time ARRAI support",
        order_id: order.order_id,
        theme: { color: "#f4a9c8" },
        handler: async (payment) => {
          try {
            const verify = await fetch("/api/vip-membership?action=verify-donation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: payment.razorpay_order_id,
                paymentId: payment.razorpay_payment_id,
                signature: payment.razorpay_signature,
              }),
            });
            const result = await verify.json();
            if (!verify.ok) throw new Error(result.error || "Support payment could not be verified.");
            const status = $("#founderStatus");
            status.textContent = "Your ₹45 support was verified. Thank you for leaving a little light here. ✨";
            status.dataset.type = "success";
            status.hidden = false;
          } catch (error) {
            const status = $("#founderStatus");
            status.textContent = `${error.message} If you were charged, please contact support with payment ID ${payment.razorpay_payment_id}.`;
            status.dataset.type = "error";
            status.hidden = false;
          } finally {
            button.disabled = false;
            button.textContent = label;
          }
        },
        modal: {
          ondismiss: () => {
            button.disabled = false;
            button.textContent = label;
          },
        },
      });
      checkout.on("payment.failed", (event) => {
        button.disabled = false;
        button.textContent = label;
        const status = $("#founderStatus");
        status.textContent = event.error?.description || "The Razorpay payment did not complete.";
        status.dataset.type = "error";
        status.hidden = false;
      });
      checkout.open();
    } catch (error) {
      button.disabled = false;
      button.textContent = label;
      const status = $("#founderStatus");
      status.textContent = error.message || "Secure support checkout could not be opened.";
      status.dataset.type = "error";
      status.hidden = false;
    }
  }

  async function startMembershipCheckout(button) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Preparing VIP checkout…";
    try {
      const auth = await window.arraiAuth;
      if (!auth?.isAuthenticated) {
        window.location.assign("/auth?next=membership");
        return;
      }
      const { data: { session }, error: sessionError } =
        await window.arraiSupabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error("Sign in again to continue to VIP checkout.");
      const response = await fetch("/api/vip-membership?action=create-order", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const order = await response.json();
      if (response.status === 409) {
        window.location.assign("/community?membership=1");
        return;
      }
      if (!response.ok) throw new Error(order.error || "Razorpay could not start VIP checkout.");
      if (
        order.amount !== 4500 ||
        order.currency !== "INR" ||
        typeof order.order_id !== "string" ||
        typeof order.key_id !== "string"
      ) throw new Error("The secure checkout returned an invalid membership order.");
      await loadRazorpay();
      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "ARRAI",
        description: "One-year VIP membership",
        order_id: order.order_id,
        prefill: { name: auth.user?.name || "", email: auth.user?.email || "" },
        theme: { color: "#f4a9c8" },
        handler: async (payment) => {
          try {
            const verify = await fetch("/api/vip-membership?action=verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                orderId: payment.razorpay_order_id,
                paymentId: payment.razorpay_payment_id,
                signature: payment.razorpay_signature,
              }),
            });
            const result = await verify.json();
            if (!verify.ok) throw new Error(result.error || "VIP payment could not be verified.");
            const status = $("#founderStatus");
            status.textContent = `VIP is active until ${new Date(result.expires_at).toLocaleDateString()}. Welcome to the softer side of ARRAI. ✨`;
            status.dataset.type = "success";
            status.hidden = false;
          } catch (error) {
            const status = $("#founderStatus");
            status.textContent = `${error.message} If you were charged, contact support with payment ID ${payment.razorpay_payment_id}.`;
            status.dataset.type = "error";
            status.hidden = false;
          } finally {
            button.disabled = false;
            button.textContent = label;
          }
        },
        modal: {
          ondismiss: () => {
            button.disabled = false;
            button.textContent = label;
          },
        },
      });
      checkout.on("payment.failed", (event) => {
        button.disabled = false;
        button.textContent = label;
        const status = $("#founderStatus");
        status.textContent = event.error?.description || "The Razorpay payment did not complete.";
        status.dataset.type = "error";
        status.hidden = false;
      });
      checkout.open();
    } catch (error) {
      button.disabled = false;
      button.textContent = label;
      const status = $("#founderStatus");
      status.textContent = error.message || "VIP checkout could not be opened.";
      status.dataset.type = "error";
      status.hidden = false;
    }
  }

  async function ask(question, webSearch = false) {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, webSearch }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "ARRAI could not answer just now.");
    return result;
  }

  function renderNews(result) {
    const content = $("#founderNewsResult");
    const sources = (result.sources || []).filter((source) => {
      try {
        return new URL(source.url).protocol === "https:";
      } catch {
        return false;
      }
    });
    content.replaceChildren();
    const summary = document.createElement("p");
    summary.textContent = result.answer;
    content.append(summary);
    if (sources.length) {
      const list = document.createElement("ul");
      list.className = "founder-news-sources";
      sources.forEach((source) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = source.title;
        item.append(link);
        list.append(item);
      });
      content.append(list);
    } else {
      const notice = document.createElement("small");
      notice.textContent = "No source links came back with this result. Please verify headlines before sharing.";
      content.append(notice);
    }
  }

  $("#founderDonateButton")?.addEventListener("click", (event) => {
    startSupportCheckout(event.currentTarget);
  });
  $("#founderVipButton")?.addEventListener("click", (event) => {
    startMembershipCheckout(event.currentTarget);
  });
  if (
    document.body.classList.contains("membership-page") &&
    new URLSearchParams(window.location.search).get("checkout") === "1"
  ) {
    const checkoutUrl = new URL(window.location.href);
    checkoutUrl.searchParams.delete("checkout");
    window.history.replaceState({}, "", checkoutUrl);
    window.setTimeout(() => {
      const button = $("#founderVipButton");
      if (button) startMembershipCheckout(button);
    }, 0);
  }

  $("#founderNewsButton")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const original = button.textContent;
    const result = $("#founderNewsResult");
    button.disabled = true;
    button.textContent = "Looking for reliable sources…";
    result.textContent = "A moment while Gemini checks current headlines…";
    try {
      const headlines = await ask(
        "Find three important current world news headlines from the last 24 hours. Summarize each in one short neutral sentence, include date/time context when available, avoid sensationalism, and use only the web sources you can cite. If current news cannot be verified, say so plainly.",
        true,
      );
      renderNews(headlines);
    } catch (error) {
      result.textContent = `${error.message} Try again later; no headlines are invented or shown as live news.`;
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });

  $("#founderChatForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.question;
    const question = input.value.trim();
    if (!question) return;
    const messages = $("#founderChatMessages");
    const userMessage = document.createElement("p");
    userMessage.className = "founder-chat-bubble is-user";
    userMessage.textContent = question;
    messages.append(userMessage);
    input.value = "";
    const pending = document.createElement("p");
    pending.className = "founder-chat-bubble is-assistant";
    pending.textContent = "One soft second… ✨";
    messages.append(pending);
    form.querySelector("button[type=submit]").disabled = true;
    const recentConversation = chatHistory
      .slice(-4)
      .map((entry) => `${entry.role}: ${entry.text.slice(0, 280)}`)
      .join("\n");
    try {
      const result = await ask(
        `${recentConversation ? `Recent conversation:\n${recentConversation}\n\n` : ""}Visitor: ${question}`,
      );
      pending.textContent = result.answer;
      chatHistory.push({ role: "visitor", text: question }, { role: "ARRAI", text: result.answer });
      if (chatHistory.length > 12) chatHistory.splice(0, chatHistory.length - 12);
    } catch (error) {
      pending.textContent = `${error.message} Please try again in a little while.`;
    } finally {
      form.querySelector("button[type=submit]").disabled = false;
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }
  });
})();
