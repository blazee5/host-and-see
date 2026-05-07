# Implementation report

## Tools & techniques
- **Frontend**: React 18, Vite, Tailwind, shadcn/ui, React Router, qrcode.react.
- **Backend**: Lovable Cloud (Supabase) — Postgres, Auth, Storage, RLS.
- **Server logic**: SECURITY DEFINER RPCs for atomic RSVP/waitlist/ticket creation, check-in, and invite acceptance (`rsvp_create`, `rsvp_cancel`, `checkin_by_code`, `checkin_undo`, `accept_host_invite`).
- **Role gating**: `host_members(host_id, user_id, role)` table + `has_host_role()` / `is_host_member()` helpers used inside RLS policies. Owner is auto-added as a host member via trigger.
- **CSV export**: client-side composition with UTF-8 BOM so Excel/Sheets recognise encoding; quoted cells. Columns: `name, email, rsvp_status, checkin_time`.

## What worked
- RPCs drastically simplify enforcing capacity + waitlist + ticket issuance in one transaction.
- Storing roles in a separate table (not on profiles) avoids privilege-escalation issues and lets us add roles like `checker` cleanly.
- shadcn primitives + a single `Layout` route gave consistent navigation everywhere with minimal code.
- Gallery moderation, feedback, and reports all reuse the same `is_host_member()` helper, keeping policies tight and consistent.

## What didn't (or partial)
- All originally-deferred items are now implemented: native camera QR scanning on the check-in page, transactional email notifications for invites/RSVPs, and multi-provider calendar export (Google + `.ics` for Apple/Outlook).

## Notable decisions
- Ticket codes are 8 chars, 32-symbol alphabet (no `0/1/I/O`), generated server-side and uniqueness-checked in a loop. Easy to read aloud.
- Capacity check happens inside the RPC after counting confirmed RSVPs; waitlist position is `MAX+1`. When a confirmed attendee cancels, the next waitlister is promoted and a ticket is issued in the same RPC.
- Past events are computed by `end_at < now()` everywhere (Explore filter, badges, "Ended" label, hidden RSVP button).
- Paid toggle is rendered but disabled with a "Coming soon" tooltip — visible per spec.
- Gallery uploads default `approved=false`; only the uploader, host members, and (after approval) the public can see them. Hosts approve/hide from the event page itself.
- Feedback opens only after `end_at < now()` AND the viewer holds a confirmed RSVP. Hosts can hide individual reviews.
- Reports table is generic (`target_type` + `target_id`) so events, gallery items, and feedback share one moderation queue in the host dashboard's Reports tab.
- Reports queue inlines a preview of the reported target (event title link / gallery thumbnail / feedback text + rating) with a single "Hide & resolve" action that hides the underlying record (or unpublishes the event) and marks the report resolved in one click. Hidden state is shown next to already-actioned reports.
- Per-page social meta (title / description / og:image / canonical / twitter card) is set imperatively from a tiny `useSeo` hook on event and host pages (titles capped at 60 chars, descriptions at 160).
- Roles are strictly separated in the UI: **Checker** members see only the upcoming/past lists and the Check-in button on each card; the Team / Reports / Profile tabs and Edit/Publish/Duplicate/CSV actions are gated to **Host** members. Gallery and feedback moderation also require the `host` role (not just any membership).
- Invites are role-selectable in the Team tab — a dropdown lets the owner generate a `host` or `checker` invite link.
- Capacity changes promote the waitlist automatically: an `AFTER UPDATE OF capacity` trigger on `events` calls a `SECURITY DEFINER` function that confirms the next FIFO waitlist entries and issues their tickets in the same transaction. EXECUTE on that function is revoked from clients.
- Host onboarding now collects logo (uploaded to the `host-logos` bucket), contact email (required), website, and bio. The dashboard has a Profile tab to edit these later.
- My Events shows two tabs (Attending / Hosting), with shared search + when (upcoming / past / all) + host filter, and role-appropriate quick actions (View ticket for attendees, Check-in / Edit for host-side roles).

## Recent updates
- **Mobile responsiveness**: Layout, Index, Explore, EventDetail, HostDashboard and MyEvents pages reworked with responsive grids, stacked nav, and mobile-friendly spacing for small viewports.
- **Host detection fix**: `useMyHost` now resolves host membership reliably so users who already created a host no longer see the "Become a host" CTA repeatedly (migration backfilled missing `host_members` rows for existing owners).
- **Slug sanitisation**: host onboarding splits slug handling into two helpers — `slugifyInput` allows hyphens and trims them sensibly during typing, while `slugify` finalises on save. Fixes "host" collapsing to "h" and rejection of dashes in manual edits.
- **Dark-mode date pickers**: `.dark` selector sets `color-scheme: dark` on native `date`/`time`/`datetime-local`/`month`/`week` inputs so picker icons render light instead of black.
- **CSV export fix**: `HostDashboard` no longer relies on the implicit `rsvps → profiles` embed (no FK declared). It fetches profiles separately via `select("id,full_name,email").in("id", userIds)` and merges them into the export, so the file always contains attendee names and emails.

## Pages delivered
| Spec page | Route |
|---|---|
| Landing | `/` |
| Explore events | `/explore` |
| Event detail (with gallery + feedback + report) | `/events/:id` |
| Host public page | `/h/:slug` |
| Host onboarding | `/host/onboarding` |
| Host dashboard (events, team, reports queue, CSV) | `/host/dashboard` |
| Event editor | `/host/events/new`, `/host/events/:id/edit` |
| My Tickets | `/me/tickets` |
| My Events | `/me/events` |
| Check-in | `/host/checkin/:eventId` |
| Gallery / review moderation | inline on `/events/:id` (host-only controls) |
| Reported items review | Reports tab on `/host/dashboard` |
| Invite acceptance | `/host/invite/:token` |

## File map
- `supabase/migrations/*` — schema, RLS, RPCs, storage buckets, seed data
- `src/pages/*` — all route components
- `src/components/EventGallery.tsx`, `src/components/EventFeedback.tsx` — community features
