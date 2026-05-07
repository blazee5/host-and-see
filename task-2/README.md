# Gather — Community Events MVP

A lightweight platform to host and attend free community events. Built with React + Vite + Lovable Cloud (Supabase).

## Demo accounts (password: `demo1234`)

| Role | Email |
|---|---|
| Host owner | `organizer@demo.local` |
| Attendee   | `attendee@demo.local` |
| Checker    | `checker@demo.local` |

Demo ticket code: **`DEMO2026`** (issued to the attendee for the upcoming demo event).

## Step-by-step: Publish → RSVP → Ticket → Check-in

1. **Publish** — Sign in as `organizer@demo.local`. Open **Host → Dashboard**. Either edit the existing "Community Coffee Meetup" or click **+ New event**, fill in title/start/end/venue/capacity, optionally upload a cover, and click **Publish**.
2. **RSVP** — Sign out, then sign in as `attendee@demo.local` (or sign up a fresh account). Open **Explore**, pick the event, click **RSVP**. If capacity is full you'll be added to the FIFO waitlist; cancellations auto-promote the next person.
3. **Ticket** — Open **My Tickets** to see your QR code and the unique 8-character ticket code (e.g. `DEMO2026` for the seed attendee).
4. **Check-in** — Sign in as `checker@demo.local` (or any host member). From the host dashboard click **Check-in** on the event, type the ticket code into the box, press Enter. The live counters update; press **Undo last** to revert.

## Roles & permissions

- **Host** — create/edit/publish events, invite members, view/export RSVPs, run check-in, moderate gallery.
- **Checker** — read-only access to event details + the check-in page for that host's events.
- Permissions are enforced both in the UI and by Postgres RLS policies and SECURITY DEFINER RPCs (`rsvp_create`, `rsvp_cancel`, `checkin_by_code`, `checkin_undo`).

## CSV export

From the host dashboard, click **CSV** on any event. The file uses the required columns and is UTF-8 BOM encoded for Excel/Google Sheets compatibility:

```
name,email,rsvp_status,checkin_time
```

An example file is included at `task-2/example_attendance.csv`.

## Routes

- `/` landing
- `/explore` browse events (search + date + location + include past)
- `/events/:id` event detail + RSVP
- `/h/:slug` host public page
- `/host/onboarding` become a host
- `/host/dashboard` host dashboard (events, team, exports)
- `/host/events/new` and `/host/events/:id/edit` event editor
- `/host/checkin/:eventId` check-in console
- `/me/tickets` my tickets (QR + code)
- `/me/events` my RSVPs
- `/auth` sign in / sign up

## Tech

React 18 · Vite 5 · Tailwind · shadcn/ui · React Router · @tanstack/react-query · qrcode.react · Lovable Cloud (Supabase: Postgres + Auth + Storage + RLS).