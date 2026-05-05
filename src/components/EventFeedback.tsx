import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Star, EyeOff, Flag } from "lucide-react";

type FB = { id: string; user_id: string; rating: number; comment: string | null; hidden: boolean; created_at: string; profiles?: { full_name: string | null } };

export function EventFeedback({ eventId, hostId, hasEnded, attended }: { eventId: string; hostId: string; hasEnded: boolean; attended: boolean }) {
  const { user } = useAuth();
  const [items, setItems] = useState<FB[]>([]);
  const [mine, setMine] = useState<FB | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("feedback").select("*, profiles:user_id(full_name)").eq("event_id", eventId).order("created_at", { ascending: false });
    const list = (data || []) as FB[];
    setItems(list);
    if (user) {
      const m = list.find((f) => f.user_id === user.id) || null;
      setMine(m);
      if (m) { setRating(m.rating); setComment(m.comment || ""); }
      const { data: hm } = await supabase.from("host_members").select("role").eq("host_id", hostId).eq("user_id", user.id).not("accepted_at", "is", null).maybeSingle();
      setIsHost(!!hm);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eventId, user?.id]);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    if (mine) {
      const { error } = await supabase.from("feedback").update({ rating, comment }).eq("id", mine.id);
      if (error) { setBusy(false); return toast.error(error.message); }
    } else {
      const { error } = await supabase.from("feedback").insert({ event_id: eventId, user_id: user.id, rating, comment });
      if (error) { setBusy(false); return toast.error(error.message); }
    }
    setBusy(false);
    toast.success("Thanks for your feedback!");
    load();
  };

  const hide = async (id: string, hidden: boolean) => {
    const { error } = await supabase.from("feedback").update({ hidden }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const report = async (id: string) => {
    if (!user) return;
    const reason = prompt("Reason?");
    if (!reason) return;
    await supabase.from("reports").insert({ target_type: "feedback", target_id: id, host_id: hostId, reporter_id: user.id, reason });
    toast.success("Reported");
  };

  const visible = items.filter((i) => isHost || i.user_id === user?.id || !i.hidden);
  const avg = items.filter(i => !i.hidden).reduce((a, b) => a + b.rating, 0) / Math.max(1, items.filter(i => !i.hidden).length);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Feedback</h2>
        {items.length > 0 && <span className="text-sm text-muted-foreground">★ {avg.toFixed(1)} · {items.filter(i=>!i.hidden).length}</span>}
      </div>
      {hasEnded && attended && user && (
        <div className="border rounded p-3 mb-4 space-y-2">
          <div className="flex gap-1">
            {[1,2,3,4,5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)}>
                <Star className={`h-6 w-6 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <Textarea placeholder="Share your experience (optional)" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          <Button size="sm" onClick={submit} disabled={busy}>{mine ? "Update review" : "Submit review"}</Button>
        </div>
      )}
      {!hasEnded && <p className="text-xs text-muted-foreground mb-3">Reviews open after the event ends.</p>}
      {hasEnded && !attended && user && <p className="text-xs text-muted-foreground mb-3">Only attendees can review.</p>}
      <div className="space-y-3">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No reviews yet.</p>
        ) : visible.map((f) => (
          <div key={f.id} className="border-b last:border-0 pb-3 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{f.profiles?.full_name || "Attendee"}</span>
                <span className="text-primary text-sm">{"★".repeat(f.rating)}{"☆".repeat(5-f.rating)}</span>
                {f.hidden && <Badge variant="destructive" className="text-xs">Hidden</Badge>}
              </div>
              <div className="flex gap-1">
                {isHost && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => hide(f.id, !f.hidden)}><EyeOff className="h-3 w-3" /></Button>}
                {!isHost && user && f.user_id !== user.id && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => report(f.id)}><Flag className="h-3 w-3" /></Button>}
              </div>
            </div>
            {f.comment && <p className="text-sm mt-1 text-muted-foreground">{f.comment}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
