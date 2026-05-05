import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import EventCard from "@/components/EventCard";

export default function MyEvents() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => { if (!loading && !user) nav("/auth"); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("rsvps").select("events:event_id(*)").eq("user_id", user.id).neq("status", "cancelled");
      setEvents(((data || []) as any).map((r: any) => r.events).filter(Boolean));
    })();
  }, [user]);

  return (
    <div className="container py-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">My events</h1>
      {events.length === 0 ? <p className="text-muted-foreground">You haven't RSVP'd to anything yet.</p> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{events.map((e) => <EventCard key={e.id} event={e} />)}</div>
      )}
    </div>
  );
}