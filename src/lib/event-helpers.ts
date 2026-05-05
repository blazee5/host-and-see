export function eventDateLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${s.toLocaleString(undefined, opts)} – ${e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  return `${s.toLocaleString(undefined, opts)} → ${e.toLocaleString(undefined, opts)}`;
}

export function isPast(end: string) {
  return new Date(end) < new Date();
}

export function googleCalUrl(e: { title: string; description?: string | null; start_at: string; end_at: string; venue?: string | null; online_url?: string | null }) {
  const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${fmt(e.start_at)}/${fmt(e.end_at)}`,
    details: e.description || "",
    location: e.venue || e.online_url || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}