import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMyHost } from "@/hooks/useMyHost";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { eventDateLabel, isPast } from "@/lib/event-helpers";
import { toast } from "sonner";
import { Plus, Copy, Download, ScanLine, Pencil, Eye, EyeOff, Files, Trash2 } from "lucide-react";

type EvRow = { id: string; title: string; start_at: string; end_at: string; status: string; visibility: string; capacity: number; venue: string | null; online_url: string | null; cover_url: string | null; description: string | null; timezone: string; is_paid: boolean; host_id: string; };

export default function HostDashboard() {
  const { user, loading } = useAuth();
  const { primaryHost, memberships, loading: hl } = useMyHost();
  const nav = useNavigate();
  const [events, setEvents] = useState<EvRow[]>([]);
  const [stats, setStats] = useState<Record<string, { going: number; waitlist: number; checkedin: number }>>({});
  const [members, setMembers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reportTargets, setReportTargets] = useState<Record<string, any>>({});
  const [inviteRole, setInviteRole] = useState<"host" | "checker">("checker");
  const [profileForm, setProfileForm] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);

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
    const targets: Record<string, any> = {};
    const evIds = (reps || []).filter((r: any) => r.target_type === "event").map((r: any) => r.target_id);
    const galIds = (reps || []).filter((r: any) => r.target_type === "gallery").map((r: any) => r.target_id);
    const fbIds = (reps || []).filter((r: any) => r.target_type === "feedback").map((r: any) => r.target_id);
    if (evIds.length) { const { data } = await supabase.from("events").select("id,title,status").in("id", evIds); (data || []).forEach((d: any) => targets["event:" + d.id] = d); }
    if (galIds.length) { const { data } = await supabase.from("gallery_uploads").select("id,image_url,hidden").in("id", galIds); (data || []).forEach((d: any) => targets["gallery:" + d.id] = d); }
    if (fbIds.length) { const { data } = await supabase.from("feedback").select("id,comment,rating,hidden").in("id", fbIds); (data || []).forEach((d: any) => targets["feedback:" + d.id] = d); }
    setReportTargets(targets);
    setProfileForm({
      name: primaryHost.name, bio: (primaryHost as any).bio || "",
      contact_email: (primaryHost as any).contact_email || "",
      website: (primaryHost as any).website || "",
      logo_url: primaryHost.logo_url || null,
    });
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

  const sendInvite = async () => {
    if (!primaryHost) return;
    const token = crypto.randomUUID();
    const { error } = await supabase.from("host_members").insert({ host_id: primaryHost.id, role: inviteRole, invite_token: token });
    if (error) return toast.error(error.message);
    const link = `${window.location.origin}/host/invite/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success(`${inviteRole} invite link copied`);
    load();
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("host_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const hideTarget = async (r: any) => {
    if (r.target_type === "gallery") {
      await supabase.from("gallery_uploads").update({ hidden: true }).eq("id", r.target_id);
    } else if (r.target_type === "feedback") {
      await supabase.from("feedback").update({ hidden: true }).eq("id", r.target_id);
    } else if (r.target_type === "event") {
      await supabase.from("events").update({ status: "draft" }).eq("id", r.target_id);
    }
    await supabase.from("reports").update({ status: "resolved" }).eq("id", r.id);
    toast.success("Hidden & resolved");
    load();
  };

  const uploadLogo = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("host-logos").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("host-logos").getPublicUrl(path);
    setProfileForm((p: any) => ({ ...p, logo_url: data.publicUrl }));
  };

  const saveProfile = async () => {
    if (!primaryHost || !profileForm) return;
    setSavingProfile(true);
    const { error } = await supabase.from("hosts").update({
      name: profileForm.name, bio: profileForm.bio || null,
      contact_email: profileForm.contact_email || null,
      website: profileForm.website || null, logo_url: profileForm.logo_url,
    }).eq("id", primaryHost.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
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
            <Button onClick={() => nav("/host/events/new")}><Plus className="h-4 w-4 mr-1" />New event</Button>
          </div>
        )}
      </div>
      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          {isOwnerHost && <TabsTrigger value="team">Team ({members.length})</TabsTrigger>}
          {isOwnerHost && <TabsTrigger value="reports">Reports ({reports.filter((r:any)=>r.status==='open').length})</TabsTrigger>}
          {isOwnerHost && <TabsTrigger value="profile">Profile</TabsTrigger>}
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">{renderList(upcoming)}</TabsContent>
        <TabsContent value="past" className="mt-4">{renderList(past)}</TabsContent>
        {isOwnerHost && <TabsContent value="team" className="mt-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-2 mb-4">
              <div>
                <Label className="text-xs">Invite as</Label>
                <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checker">Checker (check-in only)</SelectItem>
                    <SelectItem value="host">Host (full access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={sendInvite}><Copy className="h-4 w-4 mr-1" />Generate invite link</Button>
            </div>
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
                    {m.user_id !== user?.id && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeMember(m.id)}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>}
        {isOwnerHost && <TabsContent value="reports" className="mt-4">
          <Card className="p-4">
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No reports.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((r: any) => {
                  const t = reportTargets[`${r.target_type}:${r.target_id}`];
                  const alreadyHidden = t && (t.hidden === true || (r.target_type === "event" && t.status === "draft"));
                  return (
                  <div key={r.id} className="flex items-start justify-between text-sm border-b last:border-0 py-3 gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{r.target_type}</Badge>
                        <Badge variant={r.status === "open" ? "destructive" : "secondary"}>{r.status}</Badge>
                        {alreadyHidden && <Badge variant="secondary">Hidden</Badge>}
                      </div>
                      <p className="text-muted-foreground mt-1 break-words">{r.reason}</p>
                      {t && r.target_type === "event" && <Link to={`/events/${t.id}`} className="text-xs text-primary hover:underline">{t.title}</Link>}
                      {t && r.target_type === "gallery" && <img src={t.image_url} alt="" className="mt-1 h-20 w-20 object-cover rounded" />}
                      {t && r.target_type === "feedback" && <p className="text-xs mt-1">★{t.rating} — {t.comment}</p>}
                      {!t && <p className="text-xs text-muted-foreground">target deleted or not found</p>}
                    </div>
                    {r.status === "open" && (
                      <div className="flex flex-col gap-1">
                        {t && !alreadyHidden && (
                          <Button size="sm" variant="destructive" onClick={() => hideTarget(r)}>
                            <EyeOff className="h-3 w-3 mr-1" />Hide & resolve
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={async () => {
                          await supabase.from("reports").update({ status: "resolved" }).eq("id", r.id);
                          toast.success("Resolved"); load();
                        }}>Dismiss</Button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>}
        {isOwnerHost && profileForm && <TabsContent value="profile" className="mt-4">
          <Card className="p-4 space-y-3 max-w-xl">
            <div><Label>Host name</Label><Input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} /></div>
            <div><Label>Contact email</Label><Input type="email" value={profileForm.contact_email} onChange={(e) => setProfileForm({ ...profileForm, contact_email: e.target.value })} /></div>
            <div><Label>Website</Label><Input value={profileForm.website} onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })} /></div>
            <div><Label>Bio</Label><Textarea rows={3} value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} /></div>
            <div>
              <Label>Logo</Label>
              {profileForm.logo_url && <img src={profileForm.logo_url} alt="logo" className="mt-2 h-20 w-20 rounded-full object-cover" />}
              <Input type="file" accept="image/*" className="mt-2" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            </div>
            <Button onClick={saveProfile} disabled={savingProfile}>Save profile</Button>
          </Card>
        </TabsContent>}
      </Tabs>
    </div>
  );
}