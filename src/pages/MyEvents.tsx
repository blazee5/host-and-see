import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyHost } from "@/hooks/useMyHost";
import EventCard from "@/components/EventCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { eventDateLabel, isPast } from "@/lib/event-helpers";
import { ScanLine, Pencil, Ticket } from "lucide-react";

export default function MyEvents() {
  const { user, loading } = useAuth();
  const { memberships } = useMyHost();
  const nav = useNavigate();
  const [attending, setAttending] = useState<any[]>([]);
  const [hosting, setHosting] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [when, setWhen] = useState<"upcoming" | "past" | "all">("upcoming");
  const [hostFilter, setHostFilter] = useState<string>("all");

  useEffect(() => { if (!loading && !user) nav("/auth"); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: rs } = await supabase.from("rsvps").select("status,events:event_id(*, hosts:host_id(name,slug))").eq("user_id", user.id).neq("status", "cancelled");
      setAttending(((rs || []) as any).map((r: any) => ({ ...r.events, _rsvp: r.status })).filter(Boolean));
      if (memberships.length) {
        const hostIds = memberships.map((m) => m.host_id);
        const { data: ev } = await supabase.from("events").select("*, hosts:host_id(name,slug)").in("host_id", hostIds).order("start_at", { ascending: false });
        const roleByHost: Record<string, string> = {};
        memberships.forEach((m) => { roleByHost[m.host_id] = m.role; });
        setHosting(((ev || []) as any).map((e: any) => ({ ...e, _role: roleByHost[e.host_id] })));
      } else {
        setHosting([]);
      }
    })();
  }, [user, memberships.length]);

  const matches = (e: any) => {
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (when === "upcoming" && isPast(e.end_at)) return false;
    if (when === "past" && !isPast(e.end_at)) return false;
    if (hostFilter !== "all" && e.host_id !== hostFilter) return false;
    return true;
  };

  const hostOptions = useMemo(() => {
    const seen = new Map<string, string>();
    [...attending, ...hosting].forEach((e) => { if (e.hosts?.name) seen.set(e.host_id, e.hosts.name); });
    return Array.from(seen.entries());
  }, [attending, hosting]);

  const att = attending.filter(matches);
  const hst = hosting.filter(matches);

  return (
    <div className="container py-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">My events</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        <Input placeholder="Search by title…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={when} onValueChange={(v: any) => setWhen(v)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={hostFilter} onValueChange={setHostFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Host" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All hosts</SelectItem>
            {hostOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Tabs defaultValue="attending">
        <TabsList>
          <TabsTrigger value="attending">Attending ({att.length})</TabsTrigger>
          {hosting.length > 0 && <TabsTrigger value="hosting">Hosting ({hst.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="attending" className="mt-4">
          {att.length === 0 ? <p className="text-muted-foreground">Nothing matches.</p> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {att.map((e) => (
                <div key={e.id} className="space-y-2">
                  <EventCard event={e} />
                  <div className="flex gap-1 px-1">
                    <Badge variant={e._rsvp === "confirmed" ? "default" : "outline"}>{e._rsvp}</Badge>
                    {e._rsvp === "confirmed" && !isPast(e.end_at) && (
                      <Button asChild size="sm" variant="ghost" className="ml-auto h-7"><Link to="/me/tickets"><Ticket className="h-3 w-3 mr-1" />Ticket</Link></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        {hosting.length > 0 && <TabsContent value="hosting" className="mt-4">
          {hst.length === 0 ? <p className="text-muted-foreground">Nothing matches.</p> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {hst.map((e) => (
                <Card key={e.id} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Link to={`/events/${e.id}`} className="font-semibold hover:underline">{e.title}</Link>
                    {e.status === "draft" && <Badge>Draft</Badge>}
                    <Badge variant="outline" className="ml-auto">{e._role}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{eventDateLabel(e.start_at, e.end_at)}</p>
                  <p className="text-xs text-muted-foreground">{e.hosts?.name}</p>
                  <div className="flex gap-1 mt-3 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => nav(`/host/checkin/${e.id}`)}><ScanLine className="h-3 w-3 mr-1" />Check-in</Button>
                    {e._role === "host" && <Button size="sm" variant="outline" onClick={() => nav(`/host/events/${e.id}/edit`)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>}
      </Tabs>
    </div>
  );
}