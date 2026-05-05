import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { eventDateLabel, isPast } from "@/lib/event-helpers";

export default function MyTickets() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => { if (!loading && !user) nav("/auth?next=/me/tickets"); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("tickets")
        .select("id,code,events:event_id(id,title,start_at,end_at,venue,online_url,cover_url)")
        .eq("user_id", user.id);
      setTickets((data || []).filter((t: any) => !isPast(t.events.end_at)));
    })();
  }, [user]);

  return (
    <div className="container py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">My tickets</h1>
      {tickets.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No upcoming tickets. <Link to="/explore" className="text-primary hover:underline">Find events</Link></Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => (
            <Card key={t.id} className="p-4 flex gap-4 items-center flex-wrap">
              <div className="bg-white p-2 rounded border">
                <QRCodeSVG value={t.code} size={120} />
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/events/${t.events.id}`} className="font-semibold text-lg hover:underline">{t.events.title}</Link>
                <p className="text-sm text-muted-foreground">{eventDateLabel(t.events.start_at, t.events.end_at)}</p>
                <p className="text-sm text-muted-foreground">{t.events.venue || t.events.online_url || "TBA"}</p>
                <div className="mt-2"><Badge className="text-base font-mono tracking-widest">{t.code}</Badge></div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}