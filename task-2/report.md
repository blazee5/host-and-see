# Implementation report

## Tools & techniques
- **Frontend**: React 18, Vite, Tailwind, shadcn/ui, React Router, qrcode.react.
- **Backend**: Lovable Cloud (Supabase) — Postgres, Auth, Storage, RLS.
- **Server logic**: SECURITY DEFINER RPCs for atomic RSVP/waitlist/ticket creation and check-in (`rsvp_create`, `rsvp_cancel`, `checkin_by_code`, `checkin_undo`). This avoids race conditions when capacity is at the boundary.
- **Role gating**: `host_members(host_id, user_id, role)` table + `has_host_role()` / `is_host_member()` helpers used inside RLS policies. Owner is auto-added as a host member via trigger.
- **CSV export**: client-side composition with UTF-8 BOM so Excel/Sheets recognise encoding; quoted cells.

## What worked
- RPCs drastically simplify enforcing capacity + waitlist + ticket issuance in one transaction.
- Storing roles in a separate table (not on profiles) avoids privilege-escalation issues and lets us add roles like `checker` cleanly.
- shadcn primitives + a single `Layout` route gave consistent navigation everywhere with minimal code.
- Auto-confirm email signups was enabled so demo accounts can be used immediately.

## What didn't (or partial)
- Native camera QR scanning is not included — manual code entry only, as permitted by spec.
- Gallery moderation, feedback, and report-review pages were scoped out of stage 1 (tables + RLS exist; UI to follow).
- Invite-link acceptance page (`/host/invite/:token`) is not yet implemented; the dashboard generates and copies invite links but they currently need to be redeemed manually (e.g. by a host updating `host_members.user_id` + `accepted_at`). The seed data already creates a Checker member so the flow is fully demo-able.
- Email transactional notifications are not wired up.

## Notable decisions
- Ticket codes are 8 chars, 32-symbol alphabet (no `0/1/I/O`), generated server-side and uniqueness-checked in a loop. Easy to read aloud.
- Capacity check happens inside the RPC after counting confirmed RSVPs; waitlist position is `MAX+1`. When a confirmed attendee cancels, the next waitlister is promoted and a ticket is issued in the same RPC.
- Past events are computed by `end_at < now()` everywhere (Explore filter, badges, "Ended" label, hidden RSVP button).
- Paid toggle is rendered but disabled with a "Coming soon" tooltip — visible per spec.

## File map
- `supabase/migrations/*` — schema, RLS, RPCs, storage buckets, seed data
- `src/pages/*` — all route components
- `src/components/Layout.tsx`, `EventCard.tsx` — shared UI
- `src/hooks/useAuth.tsx`, `useMyHost.tsx` — session + host membership
- `src/lib/event-helpers.ts` — formatting, calendar URL, past-detection
- `task-2/example_attendance.csv` — sample CSV export