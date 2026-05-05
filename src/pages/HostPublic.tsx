import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import EventCard from "@/components/EventCard";

export default function HostPublic() {
  const { slug } = useParams();
  const [host, setHost] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: h } = await supabase.from("hosts").select("*").eq("slug", slug!).maybeSingle();
      setHost(h);
      if (h) {
        const { data: ev } = await supabase.from("events").select("*")
          .eq("host_id", h.id).eq("status", "published").eq("visibility", "public")
          .order("start_at", { ascending: false });
        setEvents(ev || []);
      }
    })();
  }, [slug]);

  if (!host) return <div className="container py-12 text-muted-foreground">Loading…</div>;
  return (
    <div className="container py-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-8">
        {host.logo_url && <img src={host.logo_url} alt={host.name} className="h-16 w-16 rounded-full object-cover" />}
        <div>
          <h1 className="text-3xl font-bold">{host.name}</h1>
          {host.bio && <p className="text-muted-foreground mt-1">{host.bio}</p>}
        </div>
      </div>
      <h2 className="font-semibold mb-3">Events</h2>
      {events.length === 0 ? (
        <p className="text-muted-foreground">No published events yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}