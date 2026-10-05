(() => {
  const OWNER_EMAIL = "abhishekrai6897@gmail.com";
  const PAGE_ID = "abhishek-rai";
  const DEFAULT_PAGE = {
    name: "Abhishek Rai",
    username: "abhishekyadav312_",
    title: "A little corner of the internet",
    crown: "♛",
    bio: "Building meaningful digital spaces and collecting little moments along the way. ✨",
    description: "Founder of ARRAI · Digital creator · Music, ideas, and everyday stories.",
    avatar_url: "/assets/abhishek-rai.jpg",
    location: "",
    links: {
      instagram: "https://instagram.com/abhishekyadav312_",
      threads: "",
      x: "https://x.com/abhishekrai781",
      linkedin: "https://linkedin.com/in/abhishekrai1576",
      facebook: "https://facebook.com/iiabhishekrai",
      github: "",
      youtube: "https://youtube.com/@abhishekyadavrai",
      website: "https://arrai.in",
      email: "abhishekrai6897@gmail.com",
    },
    music: { title: "", artist: "", url: "" },
    stories: [],
    posts: [
      {
        id: "first-chord",
        text: "Finding my own rhythm — one little idea and one chord at a time. 🎸",
        image_url: "/assets/abhishek-rai.jpg",
        location: "",
        music_title: "",
        music_url: "",
        created_at: "2026-10-05T00:00:00.000Z",
      },
    ],
  };
  const linkDetails = [
    ["instagram", "Instagram", "◎"],
    ["threads", "Threads", "＠"],
    ["x", "X", "𝕏"],
    ["linkedin", "LinkedIn", "in"],
    ["facebook", "Facebook", "f"],
    ["github", "GitHub", "⌘"],
    ["youtube", "YouTube", "▶"],
    ["website", "Website", "↗"],
    ["email", "Email", "✉"],
  ];
  const uploadTypes = {
    image: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    },
    audio: {
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/ogg": "ogg",
      "audio/wav": "wav",
      "audio/aac": "aac",
      "audio/x-m4a": "m4a",
    },
  };
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const safeUrl = (value = "") => {
    const url = String(value).trim();
    if (!url) return "";
    if (url.startsWith("/assets/") && !url.startsWith("//")) return url;
    try {
      const parsed = new URL(url, location.origin);
      return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
      return "";
    }
  };
  const authPromise = window.arraiAuth;
  let auth = { isAuthenticated: false, user: null };
  let databaseReady = false;
  let page = structuredClone(DEFAULT_PAGE);
  let comments = [];
  let reactions = [];
  let publicMusicTracks = [];
  let editingPostId = "";
  let randomTrack = null;

  function showStatus(message, type = "info") {
    const status = byId("founderStatus");
    status.textContent = message;
    status.dataset.type = type;
    status.hidden = false;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "A little while ago"
      : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function postComments(postId) {
    return comments.filter((comment) => comment.post_id === postId);
  }

  function postReactions(postId, kind) {
    return reactions.filter((reaction) => reaction.post_id === postId && reaction.kind === kind);
  }

  function chooseRandomTrack() {
    const tracks = [
      ...publicMusicTracks,
      page.music,
      ...(page.posts || []).map((post) => ({
        title: post.music_title,
        artist: page.name,
        url: post.music_url,
      })),
    ].filter((track) => {
      const url = safeUrl(track?.url);
      if (!url || /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|spotify\.com|soundcloud\.com)\//i.test(url)) {
        return false;
      }
      return /\.(mp3|m4a|ogg|wav|aac)$/i.test(new URL(url).pathname) ||
        track?.media_type?.startsWith("audio/");
    });
    randomTrack = tracks.length
      ? tracks[Math.floor(Math.random() * tracks.length)]
      : null;
  }

  async function playRandomTrack() {
    const audio = byId("founderRandomAudio");
    if (!audio) return;
    try {
      audio.volume = 0.38;
      await audio.play();
      byId("founderMusicPlay").hidden = true;
    } catch {
      byId("founderMusicPlay").hidden = false;
      byId("founderMusicPlay").textContent = "▶ Tap to play";
    }
  }

  function renderLinks() {
    byId("creatorLinks").innerHTML = linkDetails
      .map(([key, label, icon]) => {
        const raw = key === "email" && page.links?.email
          ? `mailto:${page.links.email}`
          : page.links?.[key];
        const href = key === "email"
          ? (page.links?.email ? `mailto:${escapeHtml(page.links.email)}` : "")
          : safeUrl(raw);
        if (!href) return "";
        return `<a href="${escapeHtml(href)}" ${key === "email" ? "" : 'target="_blank" rel="noopener noreferrer"'}><span aria-hidden="true">${icon}</span>${label}</a>`;
      })
      .join("");
  }

  function renderProfile() {
    const avatar = safeUrl(page.avatar_url) || DEFAULT_PAGE.avatar_url;
    byId("creatorAvatar").src = avatar;
    byId("creatorAvatar").alt = page.name || DEFAULT_PAGE.name;
    byId("creatorCrown").textContent = page.crown || "";
    byId("creatorCrown").hidden = !page.crown;
    byId("creatorTitle").textContent = page.title || "";
    byId("creatorName").textContent = page.name || DEFAULT_PAGE.name;
    byId("creatorHandle").textContent = `@${page.username || DEFAULT_PAGE.username}`;
    byId("creatorBio").textContent = page.bio || "";
    byId("creatorDescription").textContent = page.description || "";
    const locationText = page.location?.trim();
    byId("creatorLocation").hidden = !locationText;
    byId("creatorLocation").innerHTML = locationText
      ? `📍 ${escapeHtml(locationText)} · <a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(locationText)}" target="_blank" rel="noopener noreferrer">view map</a>`
      : "";
    renderLinks();

    const musicBox = byId("creatorMusic");
    const musicUrl = safeUrl(randomTrack?.url);
    const trackKey = `${musicUrl}|${randomTrack?.title || ""}|${randomTrack?.artist || ""}`;
    musicBox.hidden = false;
    if (!randomTrack) {
      musicBox.dataset.trackKey = "no-track";
      musicBox.innerHTML = `<span class="creator-music-icon" aria-hidden="true">♫</span><span><b>Random soundtrack, coming soon</b><small>Add an audio track to the public music room to turn on random play.</small></span><a class="creator-music-link" href="/music">Music room ↗</a>`;
    } else if (musicBox.dataset.trackKey !== trackKey) {
      musicBox.dataset.trackKey = trackKey;
      musicBox.innerHTML = `
        <span class="creator-music-icon" aria-hidden="true">♫</span>
        <span><b>${escapeHtml(randomTrack.title || "A little soundtrack")}</b><small>${escapeHtml(randomTrack.artist || page.name)} · picked at random</small></span>
        <div class="creator-random-controls"><audio id="founderRandomAudio" controls autoplay preload="auto" src="${escapeHtml(musicUrl)}" aria-label="Random song: ${escapeHtml(randomTrack.title || "Abhishek's music")}"></audio><button id="founderMusicPlay" class="founder-button founder-button-light" type="button" hidden>▶ Tap to play</button></div>`;
      byId("founderRandomAudio").addEventListener("error", () => {
        byId("founderMusicPlay").hidden = false;
        byId("founderMusicPlay").textContent = "Track unavailable — tap to retry";
      });
      byId("founderMusicPlay").addEventListener("click", () => {
        playRandomTrack().catch((error) => showStatus(error.message, "error"));
      });
    }

    const stories = (page.stories || []).filter((story) => story.title && safeUrl(story.image_url));
    byId("creatorStoriesSection").hidden = !stories.length;
    byId("creatorStories").innerHTML = stories.map((story) =>
      `<div class="creator-story"><img src="${escapeHtml(safeUrl(story.image_url))}" alt="" loading="lazy" /><span>${escapeHtml(story.title)}</span></div>`,
    ).join("");
    byId("postCount").textContent = page.posts?.length || 0;
    byId("likeCount").textContent = reactions.filter((reaction) => reaction.kind === "like").length;
    byId("commentCount").textContent = comments.length;
  }

  function renderPosts() {
    const container = byId("creatorPosts");
    if (!page.posts?.length) {
      container.innerHTML = `<p class="creator-empty">${auth.user?.email?.toLowerCase() === OWNER_EMAIL
        ? "Your page is ready. Add a note, photo, music link, or location when you feel like sharing."
        : "No moments shared just yet. Come back soon for a new little story."}</p>`;
      return;
    }
    container.innerHTML = page.posts.map((post) => {
      const id = String(post.id || "");
      const image = safeUrl(post.image_url);
      const audioUrl = safeUrl(post.music_url);
      const liked = reactions.some((reaction) => reaction.post_id === id && reaction.kind === "like" && reaction.user_id === auth.user?.sub);
      const reposted = reactions.some((reaction) => reaction.post_id === id && reaction.kind === "repost" && reaction.user_id === auth.user?.sub);
      const postNotes = postComments(id);
      const ownerEdit = auth.user?.email?.toLowerCase() === OWNER_EMAIL
        ? `<button class="creator-post-edit" data-action="edit-post" data-post="${escapeHtml(id)}" type="button">Edit</button>`
        : "";
      const location = post.location?.trim()
        ? `<p class="creator-post-location">📍 ${escapeHtml(post.location)}</p>`
        : "";
      const media = image ? `<img class="creator-post-media" src="${escapeHtml(image)}" alt="Moment shared by ${escapeHtml(page.name)}" loading="lazy" />` : "";
      const audio = audioUrl
        ? `<div class="creator-post-audio"><span>♫ ${escapeHtml(post.music_title || "A little soundtrack")}</span>${/\.(mp3|m4a|ogg|wav|aac)(\?.*)?$/i.test(audioUrl)
          ? `<audio controls preload="none" src="${escapeHtml(audioUrl)}"></audio>`
          : `<a class="creator-music-link" href="${escapeHtml(audioUrl)}" target="_blank" rel="noopener noreferrer">Open track ↗</a>`}</div>`
        : "";
      const renderedComments = postNotes.map((comment) =>
        `<article class="creator-comment"><div class="creator-comment-head"><b>${escapeHtml(comment.display_name || "Community member")}</b>${auth.user?.email?.toLowerCase() === OWNER_EMAIL ? `<button data-action="delete-comment" data-comment="${escapeHtml(comment.id)}" type="button" aria-label="Delete note">Delete</button>` : ""}</div><p>${escapeHtml(comment.body)}</p><time>${formatDate(comment.created_at)}</time></article>`,
      ).join("");
      return `<article class="creator-post" id="post-${escapeHtml(id)}">
        <header class="creator-post-head"><div class="creator-post-author"><img src="${escapeHtml(safeUrl(page.avatar_url) || DEFAULT_PAGE.avatar_url)}" alt="" loading="lazy" /><span><b>${escapeHtml(page.name)}</b><time>${formatDate(post.created_at)}</time></span></div>${ownerEdit}</header>
        <p class="creator-post-copy">${escapeHtml(post.text || "")}</p>${location}${media}${audio}
        <div class="creator-post-actions">
          <button data-action="like" data-post="${escapeHtml(id)}" class="${liked ? "is-active" : ""}" type="button" aria-pressed="${liked}">♡ <span>${postReactions(id, "like").length}</span> Appreciate</button>
          <button data-action="comments" data-post="${escapeHtml(id)}" type="button">☷ <span>${postNotes.length}</span> Notes</button>
          <button data-action="repost" data-post="${escapeHtml(id)}" class="${reposted ? "is-active" : ""}" type="button" aria-pressed="${reposted}">⟳ <span>${postReactions(id, "repost").length}</span> Repost</button>
        </div>
        <div class="creator-comments" id="comments-${escapeHtml(id)}" ${postNotes.length ? "" : "hidden"}>${renderedComments}</div>
        <form class="creator-comment-form" data-post="${escapeHtml(id)}"><input name="body" maxlength="500" aria-label="Write a note" placeholder="Leave a kind note…" required /><button type="submit">Send</button></form>
      </article>`;
    }).join("");
  }

  function render() {
    renderProfile();
    renderPosts();
  }

  async function loadInteractions() {
    if (!databaseReady || !page.posts?.length) return;
    const postIds = page.posts.map((post) => String(post.id)).filter(Boolean);
    if (!postIds.length) return;
    const [commentResult, reactionResult] = await Promise.all([
      window.arraiSupabase.from("founder_page_comments").select("id,post_id,display_name,body,created_at").in("post_id", postIds).order("created_at", { ascending: true }),
      window.arraiSupabase.from("founder_page_reactions").select("post_id,user_id,kind").in("post_id", postIds),
    ]);
    if (commentResult.error) throw commentResult.error;
    if (reactionResult.error) throw reactionResult.error;
    comments = commentResult.data || [];
    reactions = reactionResult.data || [];
  }

  async function loadPublicMusic() {
    if (!window.arraiSupabase) return;
    const { data, error } = await window.arraiSupabase
      .from("music_tracks")
      .select("title,artist,media_url,media_type")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      console.error("Could not load public songs for the random soundtrack:", error);
      return;
    }
    publicMusicTracks = (data || []).map((track) => ({
      title: track.title,
      artist: track.artist,
      url: track.media_url,
      media_type: track.media_type,
    }));
  }

  function setOwnerControls() {
    const isOwner = auth.user?.email?.toLowerCase() === OWNER_EMAIL;
    byId("editProfileButton").hidden = !isOwner || !databaseReady;
    byId("newPostButton").hidden = !isOwner || !databaseReady;
    byId("ownerSignIn").hidden = auth.isAuthenticated;
    byId("creatorPosts").dataset.owner = String(isOwner);
  }

  function openProfileEditor() {
    const form = byId("founderProfileForm");
    for (const key of ["name", "username", "title", "crown", "bio", "description", "avatar_url", "location"]) {
      form.elements.namedItem(key).value = page[key] || "";
    }
    for (const key of ["title", "artist", "url"]) {
      form.elements.namedItem(`music_${key}`).value = page.music?.[key] || "";
    }
    for (const [key] of linkDetails) form.elements.namedItem(key).value = page.links?.[key] || "";
    form.elements.namedItem("stories").value = (page.stories || [])
      .map((story) => `${story.title} | ${story.image_url}`).join("\n");
    byId("profileFormError").hidden = true;
    byId("founderProfileDialog").showModal();
  }

  function openPostEditor(post = null) {
    const form = byId("founderPostForm");
    editingPostId = post?.id || "";
    byId("postDialogTitle").textContent = post ? "Edit a moment" : "Add a moment";
    byId("deletePostButton").hidden = !post;
    byId("postFormError").hidden = true;
    for (const key of ["text", "image_url", "location", "music_title", "music_url"]) {
      form.elements.namedItem(key).value = post?.[key] || "";
    }
    const postDate = post?.created_at ? new Date(post.created_at) : new Date();
    form.elements.namedItem("created_at").value = Number.isNaN(postDate.getTime())
      ? ""
      : new Date(postDate.getTime() - postDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    byId("founderPostDialog").showModal();
  }

  function reportFormError(id, message) {
    const element = byId(id);
    element.textContent = message;
    element.hidden = false;
  }

  async function persistPage(nextPage) {
    const { data, error } = await window.arraiSupabase
      .from("founder_page_content")
      .update({ content: nextPage })
      .eq("id", PAGE_ID)
      .select("id")
      .single();
    if (error) throw error;
    if (!data) throw new Error("The owner-only page record was not updated.");
    page = nextPage;
    render();
  }

  async function uploadOwnerFile(file, bucket, kind, maximumBytes) {
    if (!file) return "";
    if (auth.user?.email?.toLowerCase() !== OWNER_EMAIL) {
      throw new Error("Only the page owner can upload files here.");
    }
    if (file.size > maximumBytes) {
      throw new Error(`That file is too large. The limit is ${Math.round(maximumBytes / 1024 / 1024)} MB.`);
    }
    const extension = uploadTypes[kind][file.type];
    if (!extension) throw new Error(`Please choose a supported ${kind} file.`);
    const objectPath = `${auth.user.sub}/founder-${crypto.randomUUID()}.${extension}`;
    const storage = window.arraiSupabase.storage.from(bucket);
    const { error } = await storage.upload(objectPath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data } = storage.getPublicUrl(objectPath);
    if (!data?.publicUrl) throw new Error("The upload completed, but its public URL could not be created.");
    return data.publicUrl;
  }

  async function requireMember() {
    if (!auth.isAuthenticated) {
      location.href = "/auth?next=founder";
      return false;
    }
    return true;
  }

  async function toggleReaction(postId, kind) {
    if (!(await requireMember())) return;
    const userId = auth.user.sub;
    const existing = reactions.find((reaction) => reaction.post_id === postId && reaction.kind === kind && reaction.user_id === userId);
    const request = existing
      ? window.arraiSupabase.from("founder_page_reactions").delete().eq("post_id", postId).eq("kind", kind).eq("user_id", userId)
      : window.arraiSupabase.from("founder_page_reactions").insert({ post_id: postId, kind, user_id: userId });
    const { error } = await request;
    if (error) throw error;
    await loadInteractions();
    render();
  }

  function installEvents() {
    byId("editProfileButton").addEventListener("click", openProfileEditor);
    byId("newPostButton").addEventListener("click", () => openPostEditor());
    document.querySelectorAll("[data-close-dialog]").forEach((button) =>
      button.addEventListener("click", () => button.closest("dialog").close()),
    );

    byId("founderProfileForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (auth.user?.email?.toLowerCase() !== OWNER_EMAIL) return;
      const form = event.currentTarget;
      const values = new FormData(form);
      const links = {};
      for (const [key] of linkDetails) {
        const value = String(values.get(key) || "").trim();
        if (key === "email") {
          if (value) links[key] = value;
        } else if (value) {
          const safe = safeUrl(value);
          if (!safe) return reportFormError("profileFormError", `Please use a valid http(s) URL for ${key}.`);
          links[key] = safe;
        }
      }
      const stories = String(values.get("stories") || "").split("\n").map((line) => {
        const [title, ...urlParts] = line.split("|");
        return { title: title.trim(), image_url: urlParts.join("|").trim() };
      }).filter((story) => story.title && story.image_url);
      if (stories.some((story) => !safeUrl(story.image_url))) {
        return reportFormError("profileFormError", "Each highlight needs a valid http(s) image URL.");
      }
      const nextPage = {
        ...page,
        name: String(values.get("name") || "").trim(),
        username: String(values.get("username") || "").trim().replace(/^@/, ""),
        title: String(values.get("title") || "").trim(),
        crown: String(values.get("crown") || "").trim(),
        bio: String(values.get("bio") || "").trim(),
        description: String(values.get("description") || "").trim(),
        avatar_url: String(values.get("avatar_url") || "").trim() || DEFAULT_PAGE.avatar_url,
        location: String(values.get("location") || "").trim(),
        music: {
          title: String(values.get("music_title") || "").trim(),
          artist: String(values.get("music_artist") || "").trim(),
          url: String(values.get("music_url") || "").trim(),
        },
        links,
        stories,
      };
      const avatarFile = values.get("avatar_file");
      const musicFile = values.get("music_file");
      try {
        if (avatarFile?.size) {
          nextPage.avatar_url = await uploadOwnerFile(avatarFile, "avatars", "image", 8 * 1024 * 1024);
        }
        if (musicFile?.size) {
          nextPage.music.url = await uploadOwnerFile(musicFile, "music-media", "audio", 25 * 1024 * 1024);
        }
      } catch (error) {
        return reportFormError("profileFormError", error.message || "Could not upload this file.");
      }
      if (nextPage.avatar_url && !safeUrl(nextPage.avatar_url)) return reportFormError("profileFormError", "Profile photo must be a valid http(s) URL.");
      if (nextPage.music.url && !safeUrl(nextPage.music.url)) return reportFormError("profileFormError", "Music link must be a valid http(s) URL.");
      try {
        await persistPage(nextPage);
        chooseRandomTrack();
        byId("creatorMusic").dataset.trackKey = "";
        renderProfile();
        playRandomTrack();
        byId("founderProfileDialog").close();
        showStatus("Your public page has been updated.", "success");
      } catch (error) {
        reportFormError("profileFormError", error.message || "Could not save your page.");
      }
    });

    byId("founderPostForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (auth.user?.email?.toLowerCase() !== OWNER_EMAIL) return;
      const values = new FormData(event.currentTarget);
      const imageUrl = String(values.get("image_url") || "").trim();
      const musicUrl = String(values.get("music_url") || "").trim();
      if (imageUrl && !safeUrl(imageUrl)) return reportFormError("postFormError", "Photo URL must be a valid http(s) URL.");
      if (musicUrl && !safeUrl(musicUrl)) return reportFormError("postFormError", "Music URL must be a valid http(s) URL.");
      const post = {
        id: editingPostId || crypto.randomUUID(),
        text: String(values.get("text") || "").trim(),
        image_url: imageUrl,
        location: String(values.get("location") || "").trim(),
        music_title: String(values.get("music_title") || "").trim(),
        music_url: musicUrl,
        created_at: values.get("created_at")
          ? new Date(values.get("created_at")).toISOString()
          : new Date().toISOString(),
      };
      try {
        const imageFile = values.get("image_file");
        const musicFile = values.get("music_file");
        if (imageFile?.size) {
          post.image_url = await uploadOwnerFile(imageFile, "post-media", "image", 8 * 1024 * 1024);
        }
        if (musicFile?.size) {
          post.music_url = await uploadOwnerFile(musicFile, "music-media", "audio", 25 * 1024 * 1024);
        }
        const posts = editingPostId
          ? page.posts.map((item) => item.id === editingPostId ? post : item)
          : [post, ...(page.posts || [])];
        await persistPage({ ...page, posts });
        chooseRandomTrack();
        byId("creatorMusic").dataset.trackKey = "";
        renderProfile();
        playRandomTrack();
        byId("founderPostDialog").close();
        showStatus(editingPostId ? "Your moment has been updated." : "Your new moment is now public.", "success");
      } catch (error) {
        reportFormError("postFormError", error.message || "Could not publish this moment.");
      }
    });

    byId("deletePostButton").addEventListener("click", async () => {
      if (!editingPostId || auth.user?.email?.toLowerCase() !== OWNER_EMAIL) return;
      const deletedId = editingPostId;
      try {
        await persistPage({ ...page, posts: page.posts.filter((post) => post.id !== deletedId) });
        const [{ error: commentError }, { error: reactionError }] = await Promise.all([
          window.arraiSupabase.from("founder_page_comments").delete().eq("post_id", deletedId),
          window.arraiSupabase.from("founder_page_reactions").delete().eq("post_id", deletedId),
        ]);
        if (commentError) throw commentError;
        if (reactionError) throw reactionError;
        await loadInteractions();
        render();
        byId("founderPostDialog").close();
        showStatus("Moment and its public interactions were removed.", "success");
      } catch (error) {
        showStatus(error.message || "Could not remove this moment.", "error");
      }
    });

    byId("creatorPosts").addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const { action, post } = button.dataset;
      try {
        if (action === "edit-post") {
          if (auth.user?.email?.toLowerCase() !== OWNER_EMAIL) return;
          openPostEditor(page.posts.find((item) => String(item.id) === post));
        } else if (action === "delete-comment") {
          if (auth.user?.email?.toLowerCase() !== OWNER_EMAIL) return;
          const { error } = await window.arraiSupabase.from("founder_page_comments").delete().eq("id", button.dataset.comment);
          if (error) throw error;
          await loadInteractions();
          render();
        } else if (action === "like" || action === "repost") {
          await toggleReaction(post, action);
        } else if (action === "comments") {
          const notes = byId(`comments-${post}`);
          notes.hidden = !notes.hidden;
          if (!notes.hidden) notes.nextElementSibling?.querySelector("input")?.focus();
        }
      } catch (error) {
        showStatus(error.message || "That action could not be completed.", "error");
      }
    });

    byId("creatorPosts").addEventListener("submit", async (event) => {
      if (!event.target.matches(".creator-comment-form")) return;
      event.preventDefault();
      if (!(await requireMember())) return;
      const postId = event.target.dataset.post;
      const body = String(new FormData(event.target).get("body") || "").trim();
      if (!body) return;
      const { error } = await window.arraiSupabase.from("founder_page_comments").insert({
        post_id: postId,
        author_id: auth.user.sub,
        display_name: auth.user.name || auth.user.email?.split("@")[0] || "Community member",
        body,
      });
      if (error) {
        showStatus(error.message || "Your note could not be shared.", "error");
        return;
      }
      try {
        await loadInteractions();
        render();
        byId(`comments-${postId}`).hidden = false;
        byId(`comments-${postId}`).nextElementSibling?.querySelector("input")?.focus();
      } catch (error) {
        showStatus(error.message || "The note was saved, but the conversation could not be refreshed.", "error");
      }
    });
  }

  async function initialize() {
    try {
      auth = await authPromise;
    } catch (error) {
      showStatus("Sign-in status could not be checked. Public page editing and interactions are unavailable.", "error");
    }
    try {
      const { data, error } = await window.arraiSupabase
        .from("founder_page_content")
        .select("content")
        .eq("id", PAGE_ID)
        .maybeSingle();
      if (error) throw error;
      if (!data?.content) throw new Error("The public page has not been initialized in the database.");
      page = { ...DEFAULT_PAGE, ...data.content, links: { ...DEFAULT_PAGE.links, ...data.content.links } };
      databaseReady = true;
      await loadInteractions();
    } catch (error) {
      showStatus(`Showing a preview because the public page database is not ready: ${error.message} Apply supabase-founder-page-migration.sql to enable shared edits and interactions.`, "error");
    }
    await loadPublicMusic();
    chooseRandomTrack();
    setOwnerControls();
    render();
    playRandomTrack();
    installEvents();
  }

  initialize().catch((error) => {
    showStatus(error.message || "The public profile could not be loaded.", "error");
  });
})();
