import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import EventCard, { EventCardData } from "@/components/EventCard";

export default function Explore() {
  const [events, setEvents] = useState<EventCardData[]>([]);
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includePast, setIncludePast] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase.from("events").select("id,title,start_at,end_at,venue,online_url,cover_url,location_text,status,visibility")
        .eq("status", "published").eq("visibility", "public");
      if (!includePast) query = query.gte("end_at", new Date().toISOString());
      if (from) query = query.gte("start_at", new Date(from).toISOString());
      if (to) query = query.lte("start_at", new Date(to).toISOString());
      query = query.order("start_at", { ascending: true });
      const { data } = await query;
      let rows = (data || []) as any[];
      if (q) rows = rows.filter((r) => (r.title + " " + (r.description || "")).toLowerCase().includes(q.toLowerCase()));
      if (loc) rows = rows.filter((r) => ((r.venue || "") + " " + (r.location_text || "")).toLowerCase().includes(loc.toLowerCase()));
      setEvents(rows);
      setLoading(false);
    })();
  }, [q, loc, from, to, includePast]);

  return (
    <div className="container py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Explore events</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-4 sm:mb-6">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="md:col-span-2" />
        <Input placeholder="Location" value={loc} onChange={(e) => setLoc(e.target.value)} />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="flex items-center gap-2 mb-6">
        <Switch id="past" checked={includePast} onCheckedChange={setIncludePast} />
        <Label htmlFor="past">Include past events</Label>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No events match your filters.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}