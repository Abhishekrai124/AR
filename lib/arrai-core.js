(() => {
  const memoryFallback = new Map();
  const intentTerms = {
    wallet: ["wallet", "balance", "paisa", "paise", "kharch", "kharcha", "spending", "expense", "income", "ledger", "transaction", "transactions", "burn", "forecast", "anomaly"],
    profile: ["profile", "profiles", "portfolio", "portfolios", "bio", "username", "account"],
    posts: ["post", "posts", "feed", "social", "update"],
    messages: ["message", "messages", "dm", "chat", "chats", "whatsapp", "conversation", "inbox"],
    cases: ["case", "cases", "clue", "clues", "detective", "investigation", "evidence", "saboot"],
  };
  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9@._\s₹-]/g, " ").replace(/\s+/g, " ").trim();

  function classify(question) {
    const text = normalize(question);
    const tokens = new Set(text.split(/\s+/));
    const scores = Object.fromEntries(Object.entries(intentTerms).map(([intent, terms]) => [intent, terms.reduce((score, term) => score + (tokens.has(term) ? 2 : text.includes(term) ? 1 : 0), 0)]));
    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    if (winner?.[1]) return winner[0];
    if (/\b(today|latest|current|weather|news|live|right now|aaj|abhi|taaza)\b/.test(text)) return "external";
    return "general";
  }

  function latestUserTurn(history) {
    return [...history].reverse().find((turn) => turn.role === "user")?.text || "";
  }

  async function getMemory(db, userId) {
    if (!db || !userId) return memoryFallback.get(userId) || [];
    try {
      const { data, error } = await db.from("ai_memories").select("memories").eq("user_id", userId).maybeSingle();
      if (error) return memoryFallback.get(userId) || [];
      const history = Array.isArray(data?.memories) ? data.memories.slice(-12) : [];
      memoryFallback.set(userId, history);
      return history;
    } catch {
      return memoryFallback.get(userId) || [];
    }
  }

  async function saveMemory(db, userId, history) {
    const recent = history.slice(-12).map((turn) => ({ role: turn.role === "assistant" ? "assistant" : "user", text: String(turn.text || "").slice(0, 500) }));
    if (userId) memoryFallback.set(userId, recent);
    if (!db || !userId) return;
    try {
      await db.from("ai_memories").upsert({ user_id: userId, memories: recent, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    } catch { /* The local session cache remains available if memory storage is not configured. */ }
  }

  async function walletSnapshot(db) {
    const { data: { session } } = await db.auth.getSession();
    if (!session?.access_token) throw new Error("Sign in to read your private wallet records.");
    const response = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Your ledger is unavailable.");
    return result;
  }

  function analyzeWallet(snapshot) {
    const entries = Array.isArray(snapshot.transactions) ? snapshot.transactions : [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthExpenses = entries.filter((entry) => entry.type === "expense" && new Date(entry.created_at) >= monthStart);
    const monthIncome = entries.filter((entry) => entry.type === "income" && new Date(entry.created_at) >= monthStart);
    const total = (list) => list.reduce((sum, entry) => sum + Number(entry.amount_minor || 0), 0);
    const categoryTotals = monthExpenses.reduce((groups, entry) => {
      groups[entry.category] = (groups[entry.category] || 0) + Number(entry.amount_minor || 0);
      return groups;
    }, Object.create(null));
    const expenses = entries.filter((entry) => entry.type === "expense").map((entry) => Number(entry.amount_minor || 0)).filter(Number.isFinite);
    const mean = expenses.length ? expenses.reduce((sum, amount) => sum + amount, 0) / expenses.length : 0;
    const variance = expenses.length ? expenses.reduce((sum, amount) => sum + (amount - mean) ** 2, 0) / expenses.length : 0;
    const deviation = Math.sqrt(variance);
    const unusual = expenses.length >= 5 && deviation > 0 ? entries.filter((entry) => entry.type === "expense" && Number(entry.amount_minor) > mean + deviation * 2.5) : [];
    const elapsedDays = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailySpend = elapsedDays ? total(monthExpenses) / 100 / elapsedDays : 0;
    const forecast = Number(snapshot.balanceMinor) / 100 - dailySpend * (daysInMonth - elapsedDays);
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    return {
      balance: Number(snapshot.balanceMinor) / 100,
      income: total(monthIncome) / 100,
      spending: total(monthExpenses) / 100,
      dailySpend,
      forecast,
      topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] / 100 } : null,
      unusual: unusual.slice(0, 3).map((entry) => ({ description: entry.description, amount: Number(entry.amount_minor) / 100 })),
      sampleCount: entries.length,
      note: "These are user-entered records, not verified bank transactions. Analytics use up to 200 recent entries.",
    };
  }

  async function recallOwnerLearning(question, context) {
    if (!context.isOwner || !context.db) return "";
    const { data: { session } } = await context.db.auth.getSession();
    if (!session?.access_token) return "";
    const response = await fetch("/api/makima-core", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "recall", text: question }),
    });
    if (!response.ok) return "";
    const result = await response.json();
    const episodes = Array.isArray(result.episodes) ? result.episodes : [];
    const nodes = Array.isArray(result.nodes) ? result.nodes : [];
    const edges = Array.isArray(result.edges) ? result.edges : [];
    if (!episodes.length && !nodes.length) return "";
    const concepts = nodes.slice(0, 5).map((node) => node.token).join(", ");
    const links = edges.slice(0, 4).map((edge) => `${edge.source_token} ↔ ${edge.target_token} (${Number(edge.weight).toFixed(2)})`).join(", ");
    const memory = episodes[0]?.content;
    return `From your owner-taught graph${concepts ? `, related concepts are ${concepts}` : ""}${links ? `; strongest links are ${links}` : ""}.${memory ? ` Closest training note: “${memory.slice(0, 300)}”.` : ""} This is retrieved training context, not a hidden reasoning trace.`;
  }

  async function readIntent(intent, question, context, history) {
    const { db, user } = context;
    if (intent === "wallet") {
      const snapshot = await walletSnapshot(db);
      const stats = analyzeWallet(snapshot);
      const text = normalize(question);
      if (/\b(anomaly|unusual|suspicious|odd|weird|asaman|ajeeb)\b/.test(text)) {
        return stats.unusual.length
          ? `I found ${stats.unusual.length} unusually large recorded expense(s): ${stats.unusual.map((entry) => `${entry.description} (${currency(entry.amount)})`).join(", ")}. This is a statistical flag only, not a fraud finding. ${stats.note}`
          : `There is not enough evidence for an unusual-spend flag in the recent records, or no entry crossed the threshold. ${stats.note}`;
      }
      if (/\b(forecast|predict|end.?of.?month|month end|velocity|burn|pace)\b/.test(text)) {
        return `Recorded balance: ${currency(stats.balance)}. This month's recorded spending pace is about ${currency(stats.dailySpend)} per day; a straight-line month-end estimate is ${currency(stats.forecast)} if that pace continues and no new income is recorded. ${stats.note}`;
      }
      if (/\b(category|categories|where|breakdown|food|travel|shopping|bills)\b/.test(text) && stats.topCategory) {
        return `This month's largest recorded category is ${stats.topCategory.name} at ${currency(stats.topCategory.amount)}. Total recorded spending is ${currency(stats.spending)}; recorded income is ${currency(stats.income)}. ${stats.note}`;
      }
      return `Your recorded balance is ${currency(stats.balance)}. This month: ${currency(stats.income)} income recorded and ${currency(stats.spending)} expenses recorded. ${stats.note}`;
    }
    if (!db || !user?.sub) return "Sign in to let me read your private account records.";
    if (intent === "profile") {
      const { data, error } = await db.from("profiles").select("display_name,username,bio,is_vip,created_at").eq("id", user.sub).maybeSingle();
      if (error) throw new Error("I could not read your profile right now.");
      return data ? `Your profile is ${data.display_name} (@${data.username}).${data.bio ? ` Bio: ${data.bio}` : " No bio is set."} ${data.is_vip ? "VIP is active." : "VIP is not active."}` : "Your profile has not been set up yet.";
    }
    if (intent === "posts") {
      if (/\b(feed|public|everyone|trending|latest)\b/i.test(question)) {
        const { data, error } = await db.from("posts").select("body,created_at,profiles!posts_author_id_fkey(display_name,username,privacy)").eq("profiles.privacy", "public").order("created_at", { ascending: false }).limit(5);
        if (error) throw new Error("I could not read the public feed right now.");
        if (!data?.length) return "There are no recent public posts to show.";
        return `Here are ${data.length} recent public posts: ${data.map((post) => `@${post.profiles?.username || "member"}: ${post.body.slice(0, 100)}`).join(" | ")}`;
      }
      const { data, error } = await db.from("posts").select("body,created_at").eq("author_id", user.sub).order("created_at", { ascending: false }).limit(20);
      if (error) throw new Error("I could not read your posts right now.");
      if (!data?.length) return "I could not find posts on your account in the latest 20 records.";
      const recent = data[0];
      return `I found ${data.length} recent posts on your account. Your latest, from ${new Date(recent.created_at).toLocaleDateString()}, says: “${recent.body.slice(0, 180)}”.`;
    }
    if (intent === "messages") {
      const { data, error } = await db.from("direct_messages").select("sender_id,recipient_id,body,created_at").or(`sender_id.eq.${user.sub},recipient_id.eq.${user.sub}`).order("created_at", { ascending: false }).limit(20);
      if (error) throw new Error("I could not read your private messages right now.");
      if (!data?.length) return "There are no recent direct messages on your account.";
      const text = normalize(question);
      if (/\b(read|show|what did|message said|last message|kya bola)\b/.test(text)) return `Your latest message, recorded ${new Date(data[0].created_at).toLocaleString()}, says: “${String(data[0].body).slice(0, 180)}”. This was read only from your account's RLS-protected conversation records.`;
      return `I found ${data.length} recent messages involving your account. The latest was recorded ${new Date(data[0].created_at).toLocaleString()}. I won't expose message contents unless you ask for them.`;
    }
    if (intent === "cases") return "There is no detective case or clue-log module in ARRAI.in yet, so I don't have case records to inspect.";
    if (intent === "external") return "That needs live outside-world information. I can try the optional external search bridge; otherwise I can only answer from ARRAI.in's local data.";
    if (/\b(hello|hi|hey|namaste|sat sri akal)\b/.test(normalize(question))) return "Hello. I’m Miss Makima, ARRAI.in’s composed, perceptive guide. I can look up your own wallet, profile, posts, or private messages, and explain what the site can do.";
    if (history.length && /\b(that|it|this|iska|uska|aur|more|explain)\b/.test(normalize(question))) {
      const previous = latestUserTurn(history);
      const priorIntent = classify(previous);
      if (priorIntent !== "general") return `I’ll take that as a follow-up to your earlier ${priorIntent} question. ${await readIntent(priorIntent, question, context, history)}`;
    }
    if (/\b(contact|email|hire)\b/.test(normalize(question))) return "You can reach Abhishek at abhishekrai@arrai.in, or open the Contact page.";
    if (/\b(service|work|website|project|portfolio)\b/.test(normalize(question))) return "AR offers web design, visual direction, and practical digital strategy. The Services and Projects pages have the current details.";
    const learned = await recallOwnerLearning(question, context);
    if (learned) return learned;
    return "I can answer using ARRAI.in's local data: your wallet ledger, profile, your own posts, and your private messages. Detective cases are not implemented. Ask for live outside information only when you need the optional external bridge.";
  }

  function currency(amount) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount || 0);
  }

  async function prepareAction(question, context) {
    const text = String(question || "").trim();
    const { db, user } = context;
    const dm = text.match(/^\s*(?:dm|message|send message to)\s+@?([a-z0-9_.-]{3,40})\s*(?::|that says|saying)?\s+(.{1,500})$/i);
    if (dm) {
      if (!db || !user?.sub) return { text: "Sign in before sending a direct message." };
      const { data: recipient, error } = await db.from("profiles").select("id,username,display_name").eq("username", dm[1].toLowerCase()).maybeSingle();
      if (error || !recipient) return { text: `I could not find the exact username @${dm[1]}. No message was sent.` };
      return { text: `I drafted a direct message to ${recipient.display_name} (@${recipient.username}). Review it and confirm before it is sent.`, action: { type: "send_dm", recipientId: recipient.id, recipientName: recipient.display_name, username: recipient.username, body: dm[2].trim() } };
    }
    const post = text.match(/^\s*(?:post|publish|share)\s+(.{2,500})$/i);
    if (post) return user?.sub ? { text: "I drafted this post. Confirm before publishing it to the community feed.", action: { type: "publish_post", body: post[1].trim() } } : { text: "Sign in before publishing a post." };
    const entry = text.match(/^\s*(?:add|record|log|track|save|likho|darj(?:\s+karo)?)\s+(income|expense|spending|kharch)\s+(?:of\s+)?(?:₹|rs\.?\s*)?(\d+(?:\.\d{1,2})?)(?:\s+(?:for|on|in|ka|ke|ki)\s+(.+))?$/i);
    if (entry) {
      const kind = /income/i.test(entry[1]) ? "income" : "expense";
      return user?.sub
        ? { text: `I prepared a ${kind} ledger entry for ${currency(Number(entry[2]))}${entry[3] ? ` (${entry[3].trim()})` : ""}. This is bookkeeping only, not a payment. Confirm to save it.`, action: { type: "ledger_entry", entryType: kind, amount: Number(entry[2]), description: (entry[3] || `${kind} entry`).trim().slice(0, 100), category: /food|khana/i.test(entry[3] || "") ? "Food" : "General" } }
        : { text: "Sign in before changing your ledger." };
    }
    if (/\b(send|transfer|pay|bhej|bhejo|freeze my card|block my card)\b/i.test(text)) return { text: "I can’t transfer money or freeze a payment card: ARRAI.in has no licensed payment rail or card controls. I have not taken any action." };
    const open = text.match(/^\s*(?:open|go to|show|kholo)\s+(wallet|profile|community|feed|messages|music|projects|contact)\s*$/i);
    if (open) {
      const pages = { wallet: "payments.html", profile: "community.html", community: "community.html", feed: "community.html", messages: "dm.html", music: "music.html", projects: "projects.html", contact: "contact.html" };
      return { text: `I can open the ${open[1]} page.`, action: { type: "navigate", href: pages[open[1].toLowerCase()] } };
    }
    return null;
  }

  async function respond(question, context = {}) {
    const { db, user } = context;
    const userId = user?.sub || null;
    const history = await getMemory(db, userId);
    try {
      const action = await prepareAction(question, context);
      if (action) {
        await saveMemory(db, userId, [...history, { role: "user", text: question }, { role: "assistant", text: action.text }]);
        return action;
      }
      let intent = classify(question);
      if (intent === "general" && history.length && /\b(that|it|this|iska|uska|aur|more|explain)\b/i.test(question)) intent = classify(latestUserTurn(history));
      const text = await readIntent(intent, question, context, history);
      await saveMemory(db, userId, [...history, { role: "user", text: question }, { role: "assistant", text }]);
      return { text, external: intent === "external" };
    } catch (error) {
      return { text: error.message || "I couldn't read that ARRAI.in data right now." };
    }
  }

  async function execute(action, context = {}) {
    const { db, user } = context;
    if (!user?.sub) throw new Error("Sign in before I can do that.");
    if (action?.type === "navigate" && ["payments.html", "community.html", "dm.html", "music.html", "projects.html", "contact.html"].includes(action.href)) {
      window.location.assign(action.href);
      return "Opening the page.";
    }
    if (action?.type === "ledger_entry" && ["income", "expense"].includes(action.entryType)) {
      const { data: { session } } = await db.auth.getSession();
      const response = await fetch("/api/wallet", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify({ type: action.entryType, amount: action.amount, category: action.category, description: action.description, idempotencyKey: crypto.randomUUID() }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save this ledger entry.");
      return `Confirmed. The ${action.entryType} record was saved. No money was transferred.`;
    }
    if (action?.type === "publish_post" && typeof action.body === "string" && action.body.length <= 500) {
      const { error } = await db.from("posts").insert({ author_id: user.sub, body: action.body });
      if (error) throw new Error("The post could not be published.");
      return "Confirmed. Your post was published to the community feed.";
    }
    if (action?.type === "send_dm" && typeof action.body === "string" && action.body.length <= 1500) {
      const { error } = await db.from("direct_messages").insert({ sender_id: user.sub, recipient_id: action.recipientId, body: action.body });
      if (error) throw new Error("The direct message could not be sent.");
      return `Confirmed. Your message was sent to ${action.recipientName}.`;
    }
    throw new Error("That action is not available.");
  }

  async function clearMemory(db, userId) {
    memoryFallback.delete(userId);
    if (!db || !userId) return;
    const { error } = await db.from("ai_memories").delete().eq("user_id", userId);
    if (error) throw new Error("Memory could not be cleared. Check the AI memory migration.");
  }

  window.arraiMakima = { respond, execute, clearMemory };
})();