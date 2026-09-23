const db = window.arraiSupabase;
const grid = document.querySelector("#musicGrid");
const status = document.querySelector("#musicStatus");
const player = document.querySelector("#musicPlayer");
const audio = document.querySelector("#audioPlayer");

let tracks = [];

// Safety first: even a love song needs boundaries. This keeps user text as text,
// so a dramatic title cannot accidentally become executable HTML.
const escapeHtml = (value) => {
	const element = document.createElement("div");
	element.textContent = value || "";
	return element.innerHTML;
};

const setStatus = (message, type = "") => {
	status.textContent = message;
	status.className = `community-status ${type}`;
};

// Search is deliberately small and forgiving: title, artist, team and uploader
// all get a chance to be found, like friends looking for each other in a crowd.
const currentSearch = () => document.querySelector("#musicSearch").value.trim().toLowerCase();

const searchableTrackText = (track) => [
	track.title,
	track.artist,
	track.team,
	track.uploader?.display_name,
	track.uploader?.username,
].join(" ").toLowerCase();

function renderTracks() {
	const query = currentSearch();
	const visibleTracks = tracks.filter((track) => searchableTrackText(track).includes(query));

	// Rebuild only the cards that match the search. Empty results get a little
	// kindness instead of a cold database error: rejection is already hard enough.
	grid.innerHTML = visibleTracks.length
		? visibleTracks.map((track) => {
			const kind = track.media_type?.startsWith("video") ? "Music video" : "Song";
			const credits = track.team ? ` · ${escapeHtml(track.team)}` : "";
			const ownerTools = track.owner_id === window.currentMusicUser
				? `<div class="music-manage"><button class="follow-button edit-track" data-id="${track.id}">Edit</button><button class="follow-button delete-track" data-id="${track.id}">Delete</button></div>`
				: "";

			return `<article class="music-card">
				<div class="music-art">♫</div>
				<div>
					<p class="eyebrow">${kind}</p>
					<h2>${escapeHtml(track.title)}</h2>
					<p>${escapeHtml(track.artist)}${credits}</p>
					<small>${escapeHtml(track.description || "A little sound, sent into the world with hope.")}</small>
					<small>Uploaded by @${escapeHtml(track.uploader?.username || "member")}</small>
					<button class="button play-track" data-url="${escapeHtml(track.media_url)}" data-title="${escapeHtml(track.title)}" data-artist="${escapeHtml(track.artist)}">Play ♫</button>
					${ownerTools}
				</div>
			</article>`;
	}).join("")
	: "<p class=empty-state>No music found yet. The room is quiet, not empty.</p>";
}

async function loadTracks() {
	// One gentle request fills the room. Keeping it here makes refreshes after
	// upload, edit or delete predictable instead of scattering fetches everywhere.
	const { data, error } = await db
		.from("music_tracks")
		.select("*, uploader:profiles(display_name,username)")
		.order("created_at", { ascending: false });

	if (error) {
		setStatus(error.message, "error");
		return;
	}

	tracks = data || [];
	setStatus(`${tracks.length} tracks in the room · some feelings included for free`);
	renderTracks();
}

function playTrack(track) {
	// The player is the emotional centre of this page: give it the song and the
	// two credits it needs to tell the listener who is singing.
	audio.src = track.media_url;
	document.querySelector("#playerTitle").textContent = track.title;
	document.querySelector("#playerArtist").textContent = track.artist;
	audio.play().catch(() => setStatus("The browser is being shy. Press play once more.", "error"));
}

async function editTrack(track) {
	// Editing changes credits only. The audio stays untouched, because we respect
	// the song even when its title once had a questionable haircut.
	const title = window.prompt("Song title — give it a name it deserves", track.title);
	const artist = window.prompt("Artist name — credit the beautiful human behind it", track.artist);
	if (!title?.trim() || !artist?.trim()) return;

	const { error } = await db
	.from("music_tracks")
	.update({ title: title.trim(), artist: artist.trim() })
	.eq("id", track.id)
		.eq("owner_id", window.currentMusicUser);

	if (error) setStatus(error.message, "error");
	else {
		setStatus("Credits updated. The song is feeling seen. ✦");
		await loadTracks();
	}
}

async function deleteTrack(trackId) {
	// Deleting is owner-scoped in the query as well as the button, so one friend
	// cannot accidentally tidy up another friend's playlist.
	const confirmed = window.confirm("Delete this upload? It will leave the music room very quietly.");
	if (!confirmed) return;

	const { error } = await db
		.from("music_tracks")
	.delete()
	.eq("id", trackId)
	.eq("owner_id", window.currentMusicUser);

	if (error) setStatus(error.message, "error");
	else {
		setStatus("Upload removed. No hard feelings, probably.");
		await loadTracks();
	}
}

grid.addEventListener("click", (event) => {
	// One listener handles dynamic cards created by renderTracks. It is less code,
	// and the buttons still know whether they are here to play, edit or say goodbye.
	const playButton = event.target.closest(".play-track");
	if (playButton) {
		playTrack({ media_url: playButton.dataset.url, title: playButton.dataset.title, artist: playButton.dataset.artist });
		return;
	}
	const deleteButton = event.target.closest(".delete-track");
	if (deleteButton) {
		deleteTrack(deleteButton.dataset.id);
		return;
	}

	const editButton = event.target.closest(".edit-track");
	if (editButton) {
		const track = tracks.find((item) => item.id === editButton.dataset.id);
		if (track) editTrack(track);
	}
});

document.querySelector("#musicSearch").addEventListener("input", renderTracks);
document.querySelector("#stopMusic").addEventListener("click", () => {
	audio.pause();
	audio.currentTime = 0;
	setStatus("Music stopped. The silence is temporary, promise.");
});
document.querySelector("#closePlayer").addEventListener("click", () => audio.pause());
audio.addEventListener("play", () => { player.hidden = false; });
audio.addEventListener("pause", () => { player.hidden = true; });
audio.addEventListener("ended", () => { player.hidden = true; });

async function uploadTrack(event) {
	// Upload accepts either a file or a public URL. A creator can bring a finished
	// song, a video, or just a tiny first demo that is still finding its courage.
	event.preventDefault();
	const auth = await window.arraiAuth;
	if (!auth.isAuthenticated) return location.assign("auth.html");

	const formData = new FormData(event.currentTarget);
	const file = formData.get("file");
	const externalUrl = String(formData.get("mediaUrl") || "").trim();

	if (!file?.size && !externalUrl) return setStatus("Choose a file or paste a URL. The music needs a little doorway.", "error");
	if (file?.size > 75 * 1024 * 1024) return setStatus("File must be 75 MB or smaller. Even songs need boundaries.", "error");

	setStatus("Uploading… the tiny stage is being prepared.");
	let mediaUrl = externalUrl;
	let mediaType = "audio/*";

	if (file?.size) {
		const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-");
		const path = `${auth.user.id}/${crypto.randomUUID()}-${safeName}`;
		const upload = await db.storage.from("music-media").upload(path, file);
		if (upload.error) return setStatus(upload.error.message, "error");
		mediaUrl = db.storage.from("music-media").getPublicUrl(path).data.publicUrl;
		mediaType = file.type;
	}

	const row = {
		owner_id: auth.user.id,
		title: String(formData.get("title") || "").trim(),
		artist: String(formData.get("artist") || "").trim(),
		team: String(formData.get("team") || "").trim(),
		description: String(formData.get("description") || "").trim(),
		media_url: mediaUrl,
		media_type: mediaType,
	};
	const { error } = await db.from("music_tracks").insert(row);
	if (error) return setStatus(error.message, "error");

	event.currentTarget.reset();
	setStatus("Uploaded to the music room. Go on, make someone’s headphones blush. ✦");
	await loadTracks();
}

document.querySelector("#musicForm").addEventListener("submit", (event) => uploadTrack(event).catch((error) => setStatus(error.message, "error")));

function playAt(index) {
	// Previous and next wrap around. When the playlist ends, it does not abandon
	// us like a one-sided crush; it comes back around with another song.
	if (!tracks.length) return;
	const track = tracks[(index + tracks.length) % tracks.length];
	playTrack(track);
}

function setupPlayerEnhancements() {
	// These controls are created here because the player is shared markup and the
	// music page owns its little collection of moods: aurora, sakura, ocean and gold.
	const controls = document.createElement("div");
	controls.className = "player-enhancements";
	controls.innerHTML = '<button type="button" id="prevTrack" aria-label="Previous track">⏮</button><button type="button" id="nextTrack" aria-label="Next track">⏭</button><select id="playerTheme" aria-label="Player theme"><option value="aurora">Aurora</option><option value="sakura">Sakura</option><option value="ocean">Ocean</option><option value="gold">Gold</option><option value="midnight">Midnight</option></select><button type="button" id="minPlayer" aria-label="Minimize player">⌃</button>';
	player.querySelector("audio").before(controls);
	player.dataset.theme = localStorage.getItem("arraiPlayerTheme") || "aurora";
	document.querySelector("#playerTheme").value = player.dataset.theme;
	document.querySelector("#nextTrack").addEventListener("click", () => playAt(tracks.findIndex((track) => track.media_url === audio.src) + 1));
	document.querySelector("#prevTrack").addEventListener("click", () => playAt(tracks.findIndex((track) => track.media_url === audio.src) - 1));
	document.querySelector("#playerTheme").addEventListener("change", (event) => {
		player.dataset.theme = event.target.value;
		localStorage.setItem("arraiPlayerTheme", event.target.value);
	});
	document.querySelector("#minPlayer").addEventListener("click", (event) => {
		player.classList.toggle("is-minimized");
		event.currentTarget.textContent = player.classList.contains("is-minimized") ? "⌄" : "⌃";
	});
}

function setupPlayerDragging() {
	// The player can travel with the listener, like a song following you around the room.
	let drag = null;
	player.addEventListener("pointerdown", (event) => {
		if (event.target.closest("button, select, a, audio")) return;
		drag = { x: event.clientX - player.offsetLeft, y: event.clientY - player.offsetTop };
		player.setPointerCapture(event.pointerId);
	});
	player.addEventListener("pointermove", (event) => {
		if (!drag) return;
		player.style.left = `${Math.max(6, Math.min(innerWidth - player.offsetWidth - 6, event.clientX - drag.x))}px`;
		player.style.top = `${Math.max(6, Math.min(innerHeight - player.offsetHeight - 6, event.clientY - drag.y))}px`;
		player.style.right = "auto";
		player.style.bottom = "auto";
	});
	player.addEventListener("pointerup", () => { drag = null; });
}

window.arraiAuth
	// Listening is public; uploading is a logged-in privilege. The room welcomes
	// everyone, while ownership keeps edits and deletions politely contained.
	.then(({ isAuthenticated, user }) => {
		window.currentMusicUser = isAuthenticated ? user.id : null;
		if (!isAuthenticated) {
			status.innerHTML = 'Listening is open to everyone. <a href="auth.html?next=music">Sign in to upload, like or manage your music →</a>';
			document.querySelector("#musicForm button").textContent = "Sign in to upload ↗";
		}
		return loadTracks();
	})
	.catch(() => loadTracks());

setupPlayerEnhancements();
setupPlayerDragging();
