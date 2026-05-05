import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Undo2, CheckCircle2, XCircle } from "lucide-react";

export default function CheckIn() {
  const { eventId } = useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [counters, setCounters] = useState({ checkedin: 0, going: 0 });
  const [code, setCode] = useState("");
  const [recent, setRecent] = useState<{ checkin_id: string; name: string; code: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!loading && !user) nav("/auth"); }, [user, loading, nav]);

  const refresh = async () => {
    if (!eventId) return;
    const { data: ev } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
    setEvent(ev);
    const { count: ci } = await supabase.from("checkins").select("*", { count: "exact", head: true }).eq("event_id", eventId);
    const { count: going } = await supabase.from("rsvps").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "confirmed");
    setCounters({ checkedin: ci || 0, going: going || 0 });
  };
  useEffect(() => { refresh(); }, [eventId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("checkin_by_code", { _event: eventId!, _code: code.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res.ok) {
      if (res.error === "already_checked_in") toast.error(`Already checked in: ${res.name || res.email}`);
      else toast.error("Invalid code");
    } else {
      toast.success(`Checked in: ${res.name || res.email}`);
      // get checkin id
      const { data: ci } = await supabase.from("checkins").select("id").eq("ticket_id", res.ticket_id).maybeSingle();
      setRecent((r) => [{ checkin_id: ci?.id || "", name: res.name || res.email, code: res.code }, ...r].slice(0, 10));
      refresh();
    }
    setCode("");
    inputRef.current?.focus();
  };

  const undo = async () => {
    const last = recent[0];
    if (!last?.checkin_id) return;
    const { error } = await supabase.rpc("checkin_undo", { _checkin: last.checkin_id });
    if (error) return toast.error(error.message);
    toast.success("Undone");
    setRecent((r) => r.slice(1));
    refresh();
  };

  if (!event) return <div className="container py-12 text-muted-foreground">Loading…</div>;

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-1">Check-in: {event.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">Enter the attendee's ticket code.</p>
      <Card className="p-6 mb-4">
        <div className="flex gap-4 mb-4 text-center">
          <div className="flex-1 border rounded-lg p-3"><div className="text-3xl font-bold">{counters.checkedin}</div><div className="text-xs text-muted-foreground">Checked in</div></div>
          <div className="flex-1 border rounded-lg p-3"><div className="text-3xl font-bold">{counters.going}</div><div className="text-xs text-muted-foreground">Going</div></div>
          <div className="flex-1 border rounded-lg p-3"><div className="text-3xl font-bold">{Math.max(0, counters.going - counters.checkedin)}</div><div className="text-xs text-muted-foreground">Remaining</div></div>
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <Input ref={inputRef} autoFocus placeholder="Ticket code (e.g. A4B7Z9KM)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono tracking-widest" />
          <Button type="submit" disabled={busy}>Check in</Button>
        </form>
      </Card>
      {recent.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Recent</h2>
            <Button variant="outline" size="sm" onClick={undo}><Undo2 className="h-3 w-3 mr-1" />Undo last</Button>
          </div>
          <ul className="space-y-2 text-sm">
            {recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between border-b last:border-0 py-1">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />{r.name}</span>
                <Badge variant="outline" className="font-mono">{r.code}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}