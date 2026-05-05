import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMyHost } from "@/hooks/useMyHost";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { eventDateLabel, isPast } from "@/lib/event-helpers";
import { toast } from "sonner";
import { Plus, Copy, Download, ScanLine, Pencil, Eye, EyeOff, Files } from "lucide-react";

type EvRow = { id: string; title: string; start_at: string; end_at: string; status: string; visibility: string; capacity: number; venue: string | null; online_url: string | null; cover_url: string | null; description: string | null; timezone: string; is_paid: boolean; host_id: string; };

export default function HostDashboard() {
  const { user, loading } = useAuth();
  const { primaryHost, memberships, loading: hl } = useMyHost();
  const nav = useNavigate();
  const [events, setEvents] = useState<EvRow[]>([]);
  const [stats, setStats] = useState<Record<string, { going: number; waitlist: number; checkedin: number }>>({});
  const [members, setMembers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => { if (!loading && !user) nav("/auth?next=/host/dashboard"); }, [user, loading, nav]);
  useEffect(() => { if (!hl && !primaryHost) nav("/host/onboarding"); }, [primaryHost, hl, nav]);

  const isOwnerHost = memberships.some((m) => m.host_id === primaryHost?.id && m.role === "host");

  const load = async () => {
    if (!primaryHost) return;
    const { data: evs } = await supabase.from("events").select("*").eq("host_id", primaryHost.id).order("start_at", { ascending: false });
    setEvents((evs || []) as EvRow[]);
    const ids = (evs || []).map((e: any) => e.id);
    if (ids.length) {
      const { data: rsvps } = await supabase.from("rsvps").select("event_id,status").in("event_id", ids);
      const { data: ch } = await supabase.from("checkins").select("event_id").in("event_id", ids);
      const s: Record<string, any> = {};
      ids.forEach((id) => s[id] = { going: 0, waitlist: 0, checkedin: 0 });
      (rsvps || []).forEach((r: any) => {
        if (r.status === "confirmed") s[r.event_id].going++;
        if (r.status === "waitlist") s[r.event_id].waitlist++;
      });
      (ch || []).forEach((c: any) => s[c.event_id].checkedin++);
      setStats(s);
    }
    const { data: mems } = await supabase.from("host_members").select("*, profiles:user_id(full_name,email)").eq("host_id", primaryHost.id);
    setMembers(mems || []);
    const { data: reps } = await supabase.from("reports").select("*").eq("host_id", primaryHost.id).order("created_at", { ascending: false });
    setReports(reps || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [primaryHost?.id]);

  const exportCsv = async (eventId: string, title: string) => {
    const { data: rsvps } = await supabase.from("rsvps").select("user_id,status,profiles:user_id(full_name,email)").eq("event_id", eventId);
    const { data: tickets } = await supabase.from("tickets").select("id,user_id").eq("event_id", eventId);
    const { data: checkins } = await supabase.from("checkins").select("ticket_id,checked_in_at").eq("event_id", eventId);
    const ticketByUser: Record<string, string> = {};
    (tickets || []).forEach((t: any) => { ticketByUser[t.user_id] = t.id; });
    const ciByTicket: Record<string, string> = {};
    (checkins || []).forEach((c: any) => { ciByTicket[c.ticket_id] = c.checked_in_at; });
    const rows = [["name", "email", "rsvp_status", "checkin_time"]];
    (rsvps || []).forEach((r: any) => {
      const ci = ticketByUser[r.user_id] ? ciByTicket[ticketByUser[r.user_id]] || "" : "";
      rows.push([r.profiles?.full_name || "", r.profiles?.email || "", r.status, ci]);
    });
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title.replace(/[^\w]+/g, "_")}_attendance.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const togglePublish = async (e: EvRow) => {
    const next = e.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("events").update({ status: next }).eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success(next === "published" ? "Published" : "Unpublished");
    load();
  };

  const duplicate = async (e: EvRow) => {
    const { id, ...rest } = e as any;
    const { error } = await supabase.from("events").insert({ ...rest, title: e.title + " (copy)", status: "draft" });
    if (error) return toast.error(error.message);
    toast.success("Event duplicated");
    load();
  };

  const inviteChecker = async () => {
    if (!primaryHost) return;
    const token = crypto.randomUUID();
    const { error } = await supabase.from("host_members").insert({ host_id: primaryHost.id, role: "checker", invite_token: token });
    if (error) return toast.error(error.message);
    const link = `${window.location.origin}/host/invite/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard");
    load();
  };

  if (!primaryHost) return null;

  const upcoming = events.filter((e) => !isPast(e.end_at));
  const past = events.filter((e) => isPast(e.end_at));

  const renderList = (list: EvRow[]) => (
    <div className="space-y-3">
      {list.length === 0 ? <p className="text-muted-foreground text-sm py-8 text-center">No events.</p> : list.map((e) => {
        const s = stats[e.id] || { going: 0, waitlist: 0, checkedin: 0 };
        return (
          <Card key={e.id} className="p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Link to={`/events/${e.id}`} className="font-semibold hover:underline">{e.title}</Link>
                  {e.status === "draft" && <Badge>Draft</Badge>}
                  {e.visibility === "unlisted" && <Badge variant="outline">Unlisted</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{eventDateLabel(e.start_at, e.end_at)}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  Going <span className="text-foreground font-medium">{s.going}/{e.capacity}</span> · Waitlist <span className="text-foreground font-medium">{s.waitlist}</span> · Checked-in <span className="text-foreground font-medium">{s.checkedin}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {isOwnerHost && <Button size="sm" variant="outline" onClick={() => nav(`/host/events/${e.id}/edit`)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>}
                {isOwnerHost && <Button size="sm" variant="outline" onClick={() => togglePublish(e)}>{e.status === "published" ? <><EyeOff className="h-3 w-3 mr-1" />Unpublish</> : <><Eye className="h-3 w-3 mr-1" />Publish</>}</Button>}
                {isOwnerHost && <Button size="sm" variant="outline" onClick={() => duplicate(e)}><Files className="h-3 w-3 mr-1" />Duplicate</Button>}
                <Button size="sm" variant="outline" onClick={() => nav(`/host/checkin/${e.id}`)}><ScanLine className="h-3 w-3 mr-1" />Check-in</Button>
                {isOwnerHost && <Button size="sm" variant="outline" onClick={() => exportCsv(e.id, e.title)}><Download className="h-3 w-3 mr-1" />CSV</Button>}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="container py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">{primaryHost.name}</h1>
          <p className="text-sm text-muted-foreground">Host dashboard · <Link to={`/h/${primaryHost.slug}`} className="text-primary hover:underline">public page</Link></p>
        </div>
        {isOwnerHost && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={inviteChecker}><Copy className="h-4 w-4 mr-1" />Invite checker link</Button>
            <Button onClick={() => nav("/host/events/new")}><Plus className="h-4 w-4 mr-1" />New event</Button>
          </div>
        )}
      </div>
      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="team">Team ({members.length})</TabsTrigger>
          <TabsTrigger value="reports">Reports ({reports.filter((r:any)=>r.status==='open').length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">{renderList(upcoming)}</TabsContent>
        <TabsContent value="past" className="mt-4">{renderList(past)}</TabsContent>
        <TabsContent value="team" className="mt-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-3">Team members & invites</p>
            <div className="space-y-2">
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                  <div>
                    <span className="font-medium">{m.profiles?.full_name || m.invited_email || "Pending invite"}</span>
                    <span className="text-muted-foreground ml-2">{m.profiles?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{m.role}</Badge>
                    {!m.accepted_at && m.invite_token && (
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/host/invite/${m.invite_token}`); toast.success("Copied"); }}>
                        <Copy className="h-3 w-3 mr-1" />Copy link
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <Card className="p-4">
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No reports.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-sm border-b last:border-0 py-2 gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{r.target_type}</Badge>
                        <Badge variant={r.status === "open" ? "destructive" : "secondary"}>{r.status}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 break-words">{r.reason}</p>
                      <p className="text-xs text-muted-foreground">target id: {r.target_id}</p>
                    </div>
                    {r.status === "open" && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        const { error } = await supabase.from("reports").update({ status: "resolved" }).eq("id", r.id);
                        if (error) toast.error(error.message); else { toast.success("Resolved"); load(); }
                      }}>Mark resolved</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}