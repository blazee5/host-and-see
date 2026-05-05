import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMyHost } from "@/hooks/useMyHost";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

const toLocal = (iso?: string | null) => iso ? new Date(iso).toISOString().slice(0, 16) : "";

export default function EventEditor() {
  const { id } = useParams();
  const editing = !!id;
  const { user, loading } = useAuth();
  const { primaryHost } = useMyHost();
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [venue, setVenue] = useState("");
  const [onlineUrl, setOnlineUrl] = useState("");
  const [locationText, setLocationText] = useState("");
  const [capacity, setCapacity] = useState(50);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (!loading && !user) nav("/auth"); }, [user, loading, nav]);

  useEffect(() => {
    if (!editing) return;
    (async () => {
      const { data } = await supabase.from("events").select("*").eq("id", id!).maybeSingle();
      if (data) {
        setTitle(data.title); setDescription(data.description || ""); setStartAt(toLocal(data.start_at)); setEndAt(toLocal(data.end_at));
        setTimezone(data.timezone); setVenue(data.venue || ""); setOnlineUrl(data.online_url || ""); setLocationText(data.location_text || "");
        setCapacity(data.capacity); setCoverUrl(data.cover_url); setVisibility(data.visibility as any);
      }
    })();
  }, [id, editing]);

  const upload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("event-covers").upload(path, file);
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("event-covers").getPublicUrl(path);
    setCoverUrl(data.publicUrl);
    setUploading(false);
  };

  const save = async (publish: boolean) => {
    if (!primaryHost) return toast.error("Create a host first");
    if (!title || !startAt || !endAt) return toast.error("Title, start and end are required");
    setBusy(true);
    const payload = {
      host_id: primaryHost.id, title, description, start_at: new Date(startAt).toISOString(), end_at: new Date(endAt).toISOString(),
      timezone, venue: venue || null, online_url: onlineUrl || null, location_text: locationText || null, capacity, cover_url: coverUrl,
      visibility, status: publish ? "published" as const : "draft" as const, is_paid: false,
    };
    let error;
    if (editing) ({ error } = await supabase.from("events").update(payload).eq("id", id!));
    else ({ error } = await supabase.from("events").insert(payload));
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(publish ? "Published!" : "Saved as draft");
    nav("/host/dashboard");
  };

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="text-3xl font-bold mb-6">{editing ? "Edit event" : "New event"}</h1>
      <Card className="p-6 space-y-4">
        <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Start *</Label><Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></div>
          <div><Label>End *</Label><Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></div>
        </div>
        <div><Label>Time zone</Label><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} /></div>
        <div><Label>Venue address</Label><Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="123 Main St, City" /></div>
        <div><Label>Online link (optional)</Label><Input value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} placeholder="https://…" /></div>
        <div><Label>Location label (city / region for filtering)</Label><Input value={locationText} onChange={(e) => setLocationText(e.target.value)} /></div>
        <div><Label>Capacity</Label><Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value) || 1)} /></div>
        <div>
          <Label>Cover image</Label>
          {coverUrl && <img src={coverUrl} alt="cover" className="mt-2 w-full max-h-48 object-cover rounded" />}
          <Input type="file" accept="image/*" className="mt-2" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={visibility === "public"} onCheckedChange={(v) => setVisibility(v ? "public" : "unlisted")} />
          <Label>Public (off = unlisted)</Label>
        </div>
        <div className="flex items-center gap-3 opacity-60">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3">
                <Switch disabled />
                <Label>Paid event</Label>
              </div>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => save(false)} disabled={busy}>Save draft</Button>
          <Button onClick={() => save(true)} disabled={busy}>{editing ? "Save & publish" : "Publish"}</Button>
        </div>
      </Card>
    </div>
  );
}