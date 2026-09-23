const calendarStatus = document.querySelector("#calendarStatus");
const eventList = document.querySelector("#eventList");
const calendarEscape = (value) => { const element = document.createElement("div"); element.textContent = value || ""; return element.innerHTML; };
const formatEventDate = (value) => new Intl.DateTimeFormat([], { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`));
const formatEventTime = (start, end) => `${new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(`2000-01-01T${start}`))}${end ? ` - ${new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(`2000-01-01T${end}`))}` : ""}`;

async function loadEvents() {
  const { data, error } = await window.arraiSupabase.from("calendar_events").select("id,title,description,event_date,start_time,end_time,location,meeting_url").gte("event_date", new Date().toISOString().slice(0, 10)).order("event_date").order("start_time");
  if (error) throw error;
  if (!data?.length) { calendarStatus.textContent = "No plans on the calendar yet. The good stuff is probably getting ready in secret."; return; }
  calendarStatus.hidden = true;
  eventList.innerHTML = data.map((event) => `<article class="event-card"><div class="event-date"><b>${new Date(`${event.event_date}T00:00:00`).getDate()}</b><span>${new Date(`${event.event_date}T00:00:00`).toLocaleDateString([], { month: "short" })}</span></div><div><p class="eyebrow">${formatEventDate(event.event_date)}</p><h2>${calendarEscape(event.title)}</h2><p>${calendarEscape(event.description || "Join us for a thoughtful AR moment.")}</p><p class="event-meta"><span>◷ ${formatEventTime(event.start_time, event.end_time)}</span><span>⌖ ${calendarEscape(event.location || "Online")}</span></p>${event.meeting_url ? `<a class="text-link" href="${calendarEscape(event.meeting_url)}" target="_blank" rel="noreferrer">Open event link ↗</a>` : ""}</div></article>`).join("");
}
loadEvents().catch((error) => { calendarStatus.textContent = error.message || "The calendar tripped over its shoelaces. Try again in a moment."; calendarStatus.classList.add("error"); });
