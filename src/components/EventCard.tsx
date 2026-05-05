import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { eventDateLabel, isPast } from "@/lib/event-helpers";
import { MapPin, Calendar } from "lucide-react";

export type EventCardData = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  venue: string | null;
  online_url: string | null;
  cover_url: string | null;
  status?: string;
  visibility?: string;
};

export default function EventCard({ event }: { event: EventCardData }) {
  const past = isPast(event.end_at);
  return (
    <Link to={`/events/${event.id}`}>
      <Card className="overflow-hidden h-full hover:shadow-md transition-shadow">
        <div className="aspect-video bg-muted relative">
          {event.cover_url ? (
            <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-muted-foreground"><Calendar className="h-10 w-10" /></div>
          )}
          {past && <Badge className="absolute top-2 left-2" variant="secondary">Ended</Badge>}
          {event.status === "draft" && <Badge className="absolute top-2 right-2">Draft</Badge>}
        </div>
        <div className="p-4">
          <h3 className="font-semibold line-clamp-1">{event.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{eventDateLabel(event.start_at, event.end_at)}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" />{event.venue || (event.online_url ? "Online" : "TBA")}
          </p>
        </div>
      </Card>
    </Link>
  );
}