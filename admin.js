const adminStatus = document.querySelector("#adminStatus");
const adminDashboard = document.querySelector("#adminDashboard");
let adminToken = "";

const setAdminStatus = (message, type = "") => {
  adminStatus.textContent = message;
  adminStatus.className = `community-status ${type}`;
};
const adminText = (value, fallback = "—") =>
  value === null || value === undefined || value === "" ? fallback : String(value);
const adminEscape = (value) =>
  String(value || "").replace(/[&<>'"]/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[character],
  );
const adminDate = (value) =>
  value ? new Date(value).toLocaleString() : "—";
const adminMoney = (paise) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(paise || 0) / 100);
const adminRequest = async (action, values = {}) => {
  const response = await fetch("/api/owner", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ action, ...values }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Admin request failed.");
  return result;
};
const makeText = (tag, text, className) => {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
};

function renderMetrics(metrics) {
  const labels = [
    ["Members", metrics.members],
    ["Open reports", metrics.openReports],
    ["Recent wallet rows", metrics.walletTransactions],
    ["Recent VIP payments", metrics.vipPayments],
    ["Pending DM requests", metrics.pendingMessageRequests],
    ["Posts", metrics.posts],
  ];
  const root = document.querySelector("#adminMetrics");
  root.replaceChildren(
    ...labels.map(([label, value]) => {
      const card = document.createElement("article");
      card.className = "admin-metric";
      card.append(
        makeText("small", label),
        makeText("b", value === null ? "Unavailable" : String(value)),
      );
      return card;
    }),
  );
}

function renderServices(services) {
  const root = document.querySelector("#adminServices");
  root.replaceChildren(
    ...services.map((service) => {
      const card = document.createElement("article");
      card.className = "admin-service-card";
      card.dataset.status = service.status;
      card.append(
        makeText("b", service.name),
        makeText("span", service.status.replaceAll("_", " ")),
      );
      if (service.detail) card.append(makeText("small", service.detail));
      return card;
    }),
  );
}

function renderReports(reports) {
  const root = document.querySelector("#adminReports");
  root.replaceChildren();
  if (!reports.length) {
    root.append(makeText("p", "No open community reports.", "empty-state"));
    return;
  }
  reports.forEach((report) => {
    const row = document.createElement("article");
    row.className = "admin-report-row";
    const summary = document.createElement("div");
    summary.append(
      makeText("b", `${report.target_type} · ${report.reason}`),
      makeText(
        "small",
        `Target ${report.target_id} · received ${adminDate(report.created_at)}`,
      ),
      makeText("p", report.details || "No additional details."),
    );
    const open = document.createElement("a");
    open.className = "follow-button";
    open.href = "community.html#communityModerationPanel";
    open.textContent = "Review";
    row.append(summary, open);
    root.append(row);
  });
}

function renderTransactions(rows) {
  const root = document.querySelector("#adminWalletTransactions");
  root.replaceChildren();
  if (!rows.length) {
    root.append(makeText("p", "No wallet transactions found.", "empty-state"));
    return;
  }
  const table = document.createElement("table");
  table.className = "admin-table";
  const headings = ["When", "Member ID", "Type", "Status", "Provider", "Amount", "Reference"];
  const headerRow = document.createElement("tr");
  headings.forEach((label) => headerRow.append(makeText("th", label)));
  const thead = document.createElement("thead");
  thead.append(headerRow);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    [
      adminDate(row.created_at),
      row.user_id,
      row.transaction_type,
      row.status,
      row.provider,
      adminMoney(row.amount_paise),
      row.provider_reference,
    ].forEach((value) => tr.append(makeText("td", adminText(value))));
    tbody.append(tr);
  });
  table.append(thead, tbody);
  root.append(table);
}

function renderVipPayments(rows) {
  const root = document.querySelector("#adminVipPayments");
  root.replaceChildren();
  if (!rows.length) {
    root.append(makeText("p", "No VIP payments found.", "empty-state"));
    return;
  }
  const table = document.createElement("table");
  table.className = "admin-table";
  const headerRow = document.createElement("tr");
  ["When", "Member ID", "Provider", "Amount", "Payment reference"].forEach(
    (label) => headerRow.append(makeText("th", label)),
  );
  const thead = document.createElement("thead");
  thead.append(headerRow);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    [
      adminDate(row.created_at),
      row.user_id,
      row.payment_provider,
      adminMoney(row.amount_paise),
      row.razorpay_payment_id || row.wallet_transaction_id,
    ].forEach((value) => tr.append(makeText("td", adminText(value))));
    tbody.append(tr);
  });
  table.append(thead, tbody);
  root.append(table);
}

async function loadAdminOverview() {
  setAdminStatus("Loading the owner-only service overview…");
  const data = await adminRequest("admin-overview");
  renderMetrics(data.metrics);
  renderServices(data.services);
  renderReports(data.reports);
  renderTransactions(data.walletTransactions);
  renderVipPayments(data.vipPayments);
  const errors = document.querySelector("#adminErrors");
  errors.replaceChildren();
  errors.hidden = !data.errors.length;
  data.errors.forEach((message) => errors.append(makeText("p", message)));
  adminDashboard.hidden = false;
  setAdminStatus(`Secure overview refreshed ${adminDate(data.generatedAt)}.`, "success");
}

function renderMemberResults(profiles) {
  const root = document.querySelector("#adminMemberResults");
  root.replaceChildren();
  if (!profiles.length) {
    root.append(makeText("p", "No matching members.", "empty-state"));
    return;
  }
  profiles.forEach((profile) => {
    const row = document.createElement("article");
    row.className = "admin-member-row";
    const identity = document.createElement("div");
    identity.append(
      makeText(
        "b",
        `${profile.display_name || "ARRAI member"} · @${profile.username || "unknown"}`,
      ),
      makeText("small", `${profile.id} · ${profile.account_status || "unknown"}`),
    );
    const actions = document.createElement("div");
    actions.className = "admin-member-actions";
    if (profile.community_role !== "owner") {
      const status = profile.account_status === "active" ? "suspended" : "active";
      const action = document.createElement("button");
      action.type = "button";
      action.className = "follow-button";
      action.textContent =
        status === "active" ? "Restore account" : "Suspend account";
      action.addEventListener("click", async () => {
        const confirmed = await window.cuteConfirm(
          `${status === "active" ? "Restore" : "Suspend"} ${adminEscape(profile.display_name || profile.username)}'s account?`,
          {
            title: "Confirm account change",
            danger: status !== "active",
          },
        );
        if (!confirmed) return;
        try {
          await adminRequest("moderate", {
            id: profile.id,
            moderationAction: status,
          });
          await searchAdminMembers();
          setAdminStatus("Member account status updated.", "success");
        } catch (error) {
          setAdminStatus(error.message, "error");
        }
      });
      actions.append(action);
    }
    const ownerLink = document.createElement("a");
    ownerLink.className = "text-link";
    ownerLink.href = "owner.html";
    ownerLink.textContent = "Full controls in Owner Studio ↗";
    actions.append(ownerLink);
    row.append(identity, actions);
    root.append(row);
  });
}

async function searchAdminMembers(event) {
  if (event) event.preventDefault();
  const query = document.querySelector("#adminMemberQuery").value.trim();
  try {
    const result = await adminRequest("admin-profiles", { query });
    renderMemberResults(result.profiles);
  } catch (error) {
    setAdminStatus(error.message, "error");
  }
}

document
  .querySelector("#adminMemberSearch")
  .addEventListener("submit", searchAdminMembers);
document
  .querySelector("#refreshAdmin")
  .addEventListener("click", () =>
    loadAdminOverview().catch((error) => setAdminStatus(error.message, "error")),
  );

(async () => {
  try {
    const {
      data: { session },
      error,
    } = await window.arraiSupabase.auth.getSession();
    if (error) throw error;
    if (!session?.access_token) {
      window.location.replace("auth.html?next=admin");
      return;
    }
    adminToken = session.access_token;
    await loadAdminOverview();
  } catch (error) {
    setAdminStatus(error.message || "The owner console could not load.", "error");
  }
})();
