import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Check, EyeOff, Flag, Trash2 } from "lucide-react";

type Item = { id: string; image_url: string; user_id: string; approved: boolean; hidden: boolean; created_at: string };

export function EventGallery({ eventId, hostId }: { eventId: string; hostId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("gallery_uploads").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
    setItems((data || []) as Item[]);
    if (user) {
      const { data: m } = await supabase.from("host_members").select("role").eq("host_id", hostId).eq("user_id", user.id).eq("role", "host").not("accepted_at", "is", null).maybeSingle();
      setIsHost(!!m);
    } else setIsHost(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eventId, user?.id]);

  const upload = async (file: File) => {
    if (!user) return;
    setBusy(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${eventId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("gallery").upload(path, file);
    if (upErr) { setBusy(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);
    const { error } = await supabase.from("gallery_uploads").insert({ event_id: eventId, user_id: user.id, image_url: pub.publicUrl });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Photo submitted for approval");
    load();
  };

  const moderate = async (id: string, patch: Partial<Item>) => {
    const { error } = await supabase.from("gallery_uploads").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("gallery_uploads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const report = async (id: string) => {
    if (!user) return toast.error("Sign in to report");
    const reason = prompt("Reason for reporting?");
    if (!reason) return;
    const { error } = await supabase.from("reports").insert({ target_type: "gallery", target_id: id, host_id: hostId, reporter_id: user.id, reason });
    if (error) return toast.error(error.message);
    toast.success("Reported");
  };

  const visible = items.filter((i) => isHost || i.user_id === user?.id || (i.approved && !i.hidden));

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Photo gallery</h2>
        {user && (
          <>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" />Upload photo
            </Button>
          </>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {visible.map((i) => (
            <div key={i.id} className="relative group">
              <img src={i.image_url} alt="" className={`w-full aspect-square object-cover rounded ${i.hidden ? "opacity-40" : ""}`} />
              <div className="absolute top-1 left-1 flex gap-1">
                {!i.approved && <Badge variant="secondary" className="text-xs">Pending</Badge>}
                {i.hidden && <Badge variant="destructive" className="text-xs">Hidden</Badge>}
              </div>
              <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                {isHost && !i.approved && <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => moderate(i.id, { approved: true })}><Check className="h-3 w-3" /></Button>}
                {isHost && <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => moderate(i.id, { hidden: !i.hidden })}><EyeOff className="h-3 w-3" /></Button>}
                {(isHost || i.user_id === user?.id) && <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => remove(i.id)}><Trash2 className="h-3 w-3" /></Button>}
                {!isHost && i.user_id !== user?.id && <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => report(i.id)}><Flag className="h-3 w-3" /></Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
