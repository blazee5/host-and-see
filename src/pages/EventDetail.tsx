import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { eventDateLabel, isPast, googleCalUrl } from "@/lib/event-helpers";
import { Calendar, MapPin, Users, Link as LinkIcon } from "lucide-react";

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [host, setHost] = useState<any>(null);
  const [counts, setCounts] = useState({ confirmed: 0, waitlist: 0 });
  const [myRsvp, setMyRsvp] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    setEvent(ev);
    if (ev) {
      const { data: h } = await supabase.from("hosts").select("*").eq("id", ev.host_id).maybeSingle();
      setHost(h);
      const { data: rsvps } = await supabase.from("rsvps").select("status,user_id").eq("event_id", id);
      const confirmed = (rsvps || []).filter((r: any) => r.status === "confirmed").length;
      const wait = (rsvps || []).filter((r: any) => r.status === "waitlist").length;
      setCounts({ confirmed, waitlist: wait });
      if (user) {
        const mine = (rsvps || []).find((r: any) => r.user_id === user.id);
        setMyRsvp(mine || null);
      } else { setMyRsvp(null); }
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, user?.id]);

  if (!event) return <div className="container py-12 text-muted-foreground">Loading…</div>;
  const past = isPast(event.end_at);
  const full = counts.confirmed >= event.capacity;

  const rsvp = async () => {
    if (!user) { nav(`/auth?next=/events/${id}`); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("rsvp_create", { _event: id! });
    setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as any;
    if (res.status === "waitlist") toast.success(`You're on the waitlist (#${res.waitlist_position})`);
    else toast.success("You're going! Ticket created.");
    load();
  };

  const cancel = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("rsvp_cancel", { _event: id! });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("RSVP cancelled");
    load();
  };

  return (
    <div className="container py-8 max-w-4xl">
      <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-6">
        {event.cover_url ? (
          <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
        ) : <div className="w-full h-full grid place-items-center"><Calendar className="h-16 w-16 text-muted-foreground" /></div>}
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="flex gap-2 mb-2">
            {past && <Badge variant="secondary">Ended</Badge>}
            {event.status === "draft" && <Badge>Draft</Badge>}
            {event.visibility === "unlisted" && <Badge variant="outline">Unlisted</Badge>}
          </div>
          <h1 className="text-3xl font-bold">{event.title}</h1>
          {host && (
            <p className="text-sm text-muted-foreground mt-1">
              by <Link to={`/h/${host.slug}`} className="text-primary hover:underline">{host.name}</Link>
            </p>
          )}
          <div className="prose prose-sm max-w-none mt-6 whitespace-pre-wrap">{event.description}</div>
        </div>
        <Card className="p-5 h-fit space-y-4">
          <div className="text-sm space-y-2">
            <div className="flex gap-2"><Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" /><span>{eventDateLabel(event.start_at, event.end_at)}<br/><span className="text-xs text-muted-foreground">{event.timezone}</span></span></div>
            {event.venue && <div className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" /><span>{event.venue}</span></div>}
            {event.online_url && <div className="flex gap-2"><LinkIcon className="h-4 w-4 mt-0.5 text-muted-foreground" /><a className="text-primary hover:underline break-all" href={event.online_url} target="_blank" rel="noreferrer">{event.online_url}</a></div>}
            <div className="flex gap-2"><Users className="h-4 w-4 mt-0.5 text-muted-foreground" /><span>{counts.confirmed} / {event.capacity} going{counts.waitlist > 0 && ` · ${counts.waitlist} waitlisted`}</span></div>
          </div>
          {past ? (
            <div className="text-sm text-muted-foreground">This event has ended.</div>
          ) : myRsvp && myRsvp.status !== "cancelled" ? (
            <>
              <div className="text-sm font-medium text-primary">
                {myRsvp.status === "confirmed" ? "✓ You're going" : "On waitlist"}
              </div>
              <Button variant="outline" className="w-full" onClick={cancel} disabled={busy}>Cancel RSVP</Button>
              {myRsvp.status === "confirmed" && (
                <Button asChild variant="ghost" className="w-full"><Link to="/me/tickets">View ticket</Link></Button>
              )}
            </>
          ) : (
            <Button className="w-full" onClick={rsvp} disabled={busy}>
              {full ? "Join waitlist" : "RSVP"}
            </Button>
          )}
          <Button variant="ghost" className="w-full" asChild>
            <a href={googleCalUrl(event)} target="_blank" rel="noreferrer">Add to Google Calendar</a>
          </Button>
        </Card>
      </div>
    </div>
  );
}