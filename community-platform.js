(() => {
  const $ = (selector) => document.querySelector(selector);
  let communities;
  let notifications;
  let reports;
  let viewer;
  let mine = [];
  let activeCommunity;
  let activeChannel;
  let channelSubscription;
  let searchTimer;

  const services = window.arraiCommunityServices;
  const text = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  };

  function report(message, type = "") {
    const status = $("#communityStatus");
    status.textContent = message;
    status.className = `community-status ${type}`;
  }

  function setBusy(form, busy) {
    form.querySelectorAll("button").forEach((button) => {
      button.disabled = busy;
    });
  }

  async function loadCommunities(query = $("#communitySearch").value) {
    const [joined, discover] = await Promise.all([
      communities.mine(viewer.sub),
      communities.discover(query),
    ]);
    mine = joined;
    const mineList = $("#myCommunities");
    mineList.replaceChildren();
    if (!mine.length) {
      mineList.append(text("p", "empty-state", "Join a community to get started."));
    } else {
      mine.forEach((community) => {
        const button = text(
          "button",
          "community-space-row",
          `${community.name} · ${community.role}`,
        );
        button.type = "button";
        button.dataset.community = community.id;
        button.append(text("small", "", `/${community.slug}`));
        mineList.append(button);
      });
    }

    const joinedIds = new Set(mine.map((community) => community.id));
    const discoverList = $("#discoverCommunities");
    discoverList.replaceChildren();
    const available = discover.filter((community) => !joinedIds.has(community.id));
    if (!available.length) {
      discoverList.append(
        text("p", "empty-state", "No other public communities found."),
      );
      return;
    }
    available.forEach((community) => {
      const row = text("article", "community-discovery-row");
      const details = text("div");
      details.append(
        text("b", "", community.name),
        text("small", "", `/${community.slug}`),
        text(
          "p",
          "",
          community.description || "A public ARRAI community.",
        ),
      );
      const join = text("button", "button", "Join");
      join.type = "button";
      join.dataset.joinCommunity = community.id;
      row.append(details, join);
      discoverList.append(row);
    });
  }

  async function openCommunity(community) {
    if (channelSubscription) {
      await window.arraiSupabase.removeChannel(channelSubscription);
      channelSubscription = null;
    }
    activeCommunity = community;
    activeChannel = null;
    $("#activeCommunityTitle").textContent = community.name;
    $("#activeCommunityDescription").textContent =
      community.description || `/${community.slug} · ${community.visibility}`;
    $("#leaveCommunity").hidden = community.role === "owner";
    $("#createChannelDetails").hidden = ![
      "owner",
      "admin",
      "moderator",
    ].includes(community.role);
    $("#communityChannelThread").hidden = true;
    const list = $("#communityChannels");
    list.replaceChildren(text("p", "empty-state", "Loading channels…"));
    const channels = await communities.channels(community.id);
    list.replaceChildren();
    if (!channels.length) {
      list.append(
        text(
          "p",
          "empty-state",
          "No channels are available to your account in this community.",
        ),
      );
      return;
    }
    channels.forEach((channel) => {
      const button = text(
        "button",
        "community-channel-row",
        `# ${channel.name}`,
      );
      button.type = "button";
      button.dataset.channel = channel.id;
      button.dataset.channelType = channel.channel_type;
      button.append(text("small", "", channel.channel_type));
      list.append(button);
    });
    const general = channels.find((channel) => channel.name === "general");
    if (general) await openChannel(general);
  }

  function renderChannelMessages(messages, append = false) {
    const container = $("#channelMessages");
    if (!append) container.replaceChildren();
    if (!messages.length && !append) {
      container.append(text("p", "empty-state", "No messages here yet."));
      return;
    }
    const existing = new Set(
      [...container.querySelectorAll("[data-message-id]")].map(
        (node) => node.dataset.messageId,
      ),
    );
    messages.forEach((message) => {
      if (existing.has(message.id)) return;
      const row = text("article", "community-channel-message");
      row.dataset.messageId = message.id;
      const profile = message.profiles || {};
      const heading = text("div", "community-channel-message-heading");
      heading.append(
        text("b", "", profile.display_name || "ARRAI member"),
        text(
          "small",
          "",
          `@${profile.username || "member"} · ${new Date(message.created_at).toLocaleString()}`,
        ),
      );
      row.append(heading, text("p", "", message.body));
      if (message.reply_to) row.prepend(text("small", "community-reply-ref", "↳ Reply"));
      container.append(row);
    });
    container.scrollTop = container.scrollHeight;
  }

  async function refreshChannelMessages() {
    if (!activeChannel) return;
    const messages = await communities.messages(activeChannel.id);
    renderChannelMessages(messages);
  }

  async function openChannel(channel) {
    activeChannel = channel;
    $("#communityChannelThread").hidden = false;
    $("#activeChannelTitle").textContent = `# ${channel.name}`;
    $("#activeChannelMode").textContent =
      channel.channel_type === "voice"
        ? "Voice provider pending"
        : channel.channel_type === "announcement"
          ? "Announcements · moderator posts only"
          : `#${channel.channel_type}`;
    const form = $("#channelMessageForm");
    const canPost = channel.channel_type !== "voice";
    form.hidden = !canPost;
    form.elements.body.disabled = !canPost;
    form.querySelector("button").disabled = !canPost;
    if (channelSubscription) {
      await window.arraiSupabase.removeChannel(channelSubscription);
      channelSubscription = null;
    }
    $("#channelMessages").replaceChildren(
      text("p", "empty-state", "Loading messages…"),
    );
    await refreshChannelMessages();
    if (channel.channel_type !== "voice") {
      channelSubscription = communities.subscribe(channel.id, (message) => {
        if (activeChannel?.id !== channel.id) return;
        communities
          .messages(channel.id, 0, 1)
          .then((latest) => {
            if (!latest.some((item) => item.id === message.id)) {
              const plainMessage = {
                ...message,
                profiles: { display_name: "ARRAI member", username: "member" },
              };
              renderChannelMessages([plainMessage], true);
            } else {
              return refreshChannelMessages();
            }
          })
          .catch((error) => report(error.message, "error"));
      });
    }
  }

  function renderNotifications(rows) {
    const list = $("#communityNotifications");
    list.replaceChildren();
    if (!rows.length) {
      list.append(text("p", "empty-state", "You’re all caught up."));
      return;
    }
    rows.forEach((notification) => {
      const button = text(
        "button",
        `community-notification ${notification.read_at ? "" : "unread"}`,
      );
      button.type = "button";
      button.dataset.notification = notification.id;
      button.append(
        text(
          "b",
          "",
          `${notification.actor_id === viewer.sub ? "You" : "A member"} ${notification.kind.replaceAll("_", " ")}${notification.kind === "reply" ? " to your post" : ""}`,
        ),
        text(
          "small",
          "",
          new Date(notification.created_at).toLocaleString(),
        ),
      );
      list.append(button);
    });
  }

  async function loadNotifications() {
    renderNotifications(await notifications.list(viewer.sub));
  }

  function renderReports(rows) {
    const list = $("#communityReports");
    list.replaceChildren();
    if (!rows.length) {
      list.append(text("p", "empty-state", "No reports need review."));
      return;
    }
    rows.forEach((item) => {
      const row = text("article", "community-report");
      const summary = text("div", "community-report-summary");
      summary.append(
        text("b", "", `${item.target_type} · ${item.reason}`),
        text("small", "", `Reported ${new Date(item.created_at).toLocaleString()} · ${item.status}`),
        text(
          "p",
          "",
          item.details
            ? `${item.details} · Target ID: ${item.target_id}`
            : `Target ID: ${item.target_id}`,
        ),
      );
      const actions = text("div", "community-report-actions");
      ["resolved", "dismissed"].forEach((status) => {
        const button = text("button", "follow-button", status === "resolved" ? "Resolve" : "Dismiss");
        button.type = "button";
        button.dataset.resolveReport = item.id;
        button.dataset.reportStatus = status;
        actions.append(button);
      });
      row.append(summary, actions);
      list.append(row);
    });
  }

  async function loadReports() {
    renderReports(await reports.queue());
  }

  async function start(detail) {
    if (!detail?.db || !detail?.user || !$("#communitySpaces")) return;
    viewer = detail.user;
    communities = new services.CommunityService(detail.db);
    notifications = new services.NotificationService(detail.db);
    reports = new services.ReportService(detail.db);
    const isStaff = ["moderator", "admin", "owner"].includes(
      detail.profile?.community_role,
    );
    $("#communityModerationPanel").hidden = !isStaff;
    try {
      await Promise.all([
        loadCommunities(),
        loadNotifications(),
        ...(isStaff ? [loadReports()] : []),
      ]);
    } catch (error) {
      report(
        `Community spaces could not load. Apply the community platform migration: ${error.message}`,
        "error",
      );
    }
  }

  $("#refreshCommunities").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try {
      await loadCommunities();
      report("Communities refreshed.", "success");
    } catch (error) {
      report(error.message, "error");
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  $("#refreshCommunityReports").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try {
      await loadReports();
      report("Report queue refreshed.", "success");
    } catch (error) {
      report(error.message, "error");
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  $("#communityReports").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-resolve-report]");
    if (!button) return;
    button.disabled = true;
    try {
      await reports.resolve(
        button.dataset.resolveReport,
        viewer.sub,
        button.dataset.reportStatus,
      );
      await loadReports();
      report("Report updated.", "success");
    } catch (error) {
      report(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  $("#communitySearch").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(
      () =>
        loadCommunities().catch((error) => report(error.message, "error")),
      250,
    );
  });

  $("#createCommunityForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(form, true);
    try {
      const community = await communities.create({
        name: String(values.get("name")).trim(),
        slug: String(values.get("slug")).trim().toLowerCase(),
        description: String(values.get("description") || "").trim(),
      });
      const created = Array.isArray(community) ? community[0] : community;
      form.reset();
      await loadCommunities();
      if (created?.id) {
        const [mineCommunity] = mine.filter((item) => item.id === created.id);
        if (mineCommunity) await openCommunity(mineCommunity);
      }
      report("Community created with a #general channel.", "success");
    } catch (error) {
      report(
        error.code === "23505"
          ? "That community address is already taken."
          : error.message,
        "error",
      );
    } finally {
      setBusy(form, false);
    }
  });

  $("#myCommunities").addEventListener("click", (event) => {
    const button = event.target.closest("[data-community]");
    if (!button) return;
    const community = mine.find((item) => item.id === button.dataset.community);
    if (community)
      openCommunity(community).catch((error) => report(error.message, "error"));
  });

  $("#discoverCommunities").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-join-community]");
    if (!button) return;
    button.disabled = true;
    try {
      await communities.join(button.dataset.joinCommunity);
      await loadCommunities();
      const community = mine.find(
        (item) => item.id === button.dataset.joinCommunity,
      );
      if (community) await openCommunity(community);
      report("You joined the community.", "success");
    } catch (error) {
      report(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  $("#communityChannels").addEventListener("click", (event) => {
    const button = event.target.closest("[data-channel]");
    if (!button) return;
    const channel = {
      id: button.dataset.channel,
      name: button.firstChild.textContent.replace(/^#\s*/, ""),
      channel_type: button.dataset.channelType,
      replies_enabled: true,
    };
    openChannel(channel).catch((error) => report(error.message, "error"));
  });

  $("#leaveCommunity").addEventListener("click", async () => {
    if (!activeCommunity) return;
    if (!window.confirm(`Leave ${activeCommunity.name}?`)) return;
    try {
      if (channelSubscription) {
        await window.arraiSupabase.removeChannel(channelSubscription);
        channelSubscription = null;
      }
      await communities.leave(activeCommunity.id);
      activeCommunity = null;
      $("#activeCommunityTitle").textContent = "Choose a community";
      $("#activeCommunityDescription").textContent =
        "Join a public community to explore its channels.";
      $("#communityChannels").replaceChildren(
        text("p", "empty-state", "Your selected community’s channels will appear here."),
      );
      $("#communityChannelThread").hidden = true;
      await loadCommunities();
      report("You left the community.", "success");
    } catch (error) {
      report(error.message, "error");
    }
  });

  $("#createChannelForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeCommunity) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(form, true);
    try {
      await communities.createChannel(activeCommunity.id, {
        name: String(values.get("name")).trim().toLowerCase(),
        type: values.get("type"),
        description: String(values.get("description") || "").trim(),
      });
      form.reset();
      await openCommunity(activeCommunity);
      report("Channel created.", "success");
    } catch (error) {
      report(error.message, "error");
    } finally {
      setBusy(form, false);
    }
  });

  $("#channelMessageForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeChannel) return;
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") || "").trim();
    if (!body) return;
    setBusy(form, true);
    try {
      await communities.sendMessage(activeChannel.id, body);
      form.reset();
      await refreshChannelMessages();
    } catch (error) {
      report(
        error.message.includes("CHANNEL_SLOW_MODE")
          ? "Slow mode is on. Please wait before sending another message."
          : error.message.includes("ANNOUNCEMENT_CHANNEL_READ_ONLY")
            ? "Only community moderators can post in announcement channels."
            : error.message,
        "error",
      );
    } finally {
      setBusy(form, false);
    }
  });

  $("#markNotificationsRead").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try {
      await notifications.markAllRead(viewer.sub);
      await loadNotifications();
      report("Notifications marked as read.", "success");
    } catch (error) {
      report(error.message, "error");
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  $("#communityNotifications").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-notification]");
    if (!button) return;
    try {
      await notifications.markRead(viewer.sub, button.dataset.notification);
      await loadNotifications();
    } catch (error) {
      report(error.message, "error");
    }
  });

  window.addEventListener("arrai:profile-ready", (event) => {
    start(event.detail);
  });
})();
