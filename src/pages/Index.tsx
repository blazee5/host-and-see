import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Ticket, ScanLine } from "lucide-react";

export default function Index() {
  return (
    <div>
      <section className="container py-12 sm:py-20 text-center max-w-3xl">
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
          Host & attend community events, the simple way.
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground mb-8">
          Free, fast event hosting with RSVPs, tickets, and check-ins. Built for community organizers.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg"><Link to="/explore">Explore events</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/host/onboarding">Host an event</Link></Button>
        </div>
      </section>
      <section className="container grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 pb-12 sm:pb-20">
        {[
          { icon: Calendar, title: "Create & publish", text: "Draft, edit, and publish events with cover images." },
          { icon: Ticket, title: "RSVP & tickets", text: "Capacity-aware RSVPs with FIFO waitlist & QR tickets." },
          { icon: ScanLine, title: "Check in fast", text: "Manual code entry, live counters, undo last check-in." },
        ].map((f, i) => (
          <div key={i} className="rounded-lg border p-6 bg-card">
            <f.icon className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
