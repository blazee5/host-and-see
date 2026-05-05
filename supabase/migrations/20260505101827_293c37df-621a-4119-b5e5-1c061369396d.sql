
-- ============ ENUMS ============
CREATE TYPE public.host_role AS ENUM ('host', 'checker');
CREATE TYPE public.event_status AS ENUM ('draft', 'published');
CREATE TYPE public.event_visibility AS ENUM ('public', 'unlisted');
CREATE TYPE public.rsvp_status AS ENUM ('confirmed', 'cancelled', 'waitlist');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ HOSTS ============
CREATE TABLE public.hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  bio TEXT,
  logo_url TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hosts ENABLE ROW LEVEL SECURITY;

-- ============ HOST MEMBERS ============
CREATE TABLE public.host_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.host_role NOT NULL,
  invite_token TEXT UNIQUE,
  invited_email TEXT,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(host_id, user_id, role)
);
ALTER TABLE public.host_members ENABLE ROW LEVEL SECURITY;

-- Helper: does user have role in host?
CREATE OR REPLACE FUNCTION public.has_host_role(_user UUID, _host UUID, _role public.host_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.host_members
    WHERE host_id = _host AND user_id = _user AND role = _role AND accepted_at IS NOT NULL
  ) OR EXISTS(
    SELECT 1 FROM public.hosts WHERE id = _host AND owner_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_host_member(_user UUID, _host UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.host_members
    WHERE host_id = _host AND user_id = _user AND accepted_at IS NOT NULL
  ) OR EXISTS(
    SELECT 1 FROM public.hosts WHERE id = _host AND owner_id = _user
  );
$$;

-- Hosts policies
CREATE POLICY "hosts public read" ON public.hosts FOR SELECT USING (true);
CREATE POLICY "anyone signed in can create host" ON public.hosts FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner updates host" ON public.hosts FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owner deletes host" ON public.hosts FOR DELETE USING (auth.uid() = owner_id);

-- Owner auto-added as host member
CREATE OR REPLACE FUNCTION public.handle_new_host()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.host_members (host_id, user_id, role, accepted_at)
  VALUES (NEW.id, NEW.owner_id, 'host', now())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_host_created AFTER INSERT ON public.hosts
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_host();

-- host_members policies
CREATE POLICY "members visible to host members" ON public.host_members FOR SELECT
  USING (public.is_host_member(auth.uid(), host_id) OR user_id = auth.uid());
CREATE POLICY "host can insert members" ON public.host_members FOR INSERT
  WITH CHECK (public.has_host_role(auth.uid(), host_id, 'host'));
CREATE POLICY "host can update members" ON public.host_members FOR UPDATE
  USING (public.has_host_role(auth.uid(), host_id, 'host') OR user_id = auth.uid());
CREATE POLICY "host can delete members" ON public.host_members FOR DELETE
  USING (public.has_host_role(auth.uid(), host_id, 'host'));

-- ============ EVENTS ============
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  venue TEXT,
  online_url TEXT,
  location_text TEXT,
  capacity INTEGER NOT NULL DEFAULT 50,
  cover_url TEXT,
  visibility public.event_visibility NOT NULL DEFAULT 'public',
  status public.event_status NOT NULL DEFAULT 'draft',
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_events_status_start ON public.events(status, start_at);
CREATE INDEX idx_events_host ON public.events(host_id);

CREATE POLICY "public events readable" ON public.events FOR SELECT
  USING (status = 'published' OR public.is_host_member(auth.uid(), host_id));
CREATE POLICY "host can create events" ON public.events FOR INSERT
  WITH CHECK (public.has_host_role(auth.uid(), host_id, 'host'));
CREATE POLICY "host can update events" ON public.events FOR UPDATE
  USING (public.has_host_role(auth.uid(), host_id, 'host'));
CREATE POLICY "host can delete events" ON public.events FOR DELETE
  USING (public.has_host_role(auth.uid(), host_id, 'host'));

-- ============ RSVPS ============
CREATE TABLE public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL DEFAULT 'confirmed',
  waitlist_position INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rsvps_event_status ON public.rsvps(event_id, status);

CREATE POLICY "user reads own rsvp" ON public.rsvps FOR SELECT
  USING (user_id = auth.uid() OR public.is_host_member(auth.uid(),
    (SELECT host_id FROM public.events WHERE id = event_id)));
CREATE POLICY "user creates own rsvp" ON public.rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user updates own rsvp" ON public.rsvps FOR UPDATE
  USING (user_id = auth.uid() OR public.is_host_member(auth.uid(),
    (SELECT host_id FROM public.events WHERE id = event_id)));

-- ============ TICKETS ============
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id UUID NOT NULL UNIQUE REFERENCES public.rsvps(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tickets_event ON public.tickets(event_id);

CREATE POLICY "user reads own ticket" ON public.tickets FOR SELECT
  USING (user_id = auth.uid() OR public.is_host_member(auth.uid(),
    (SELECT host_id FROM public.events WHERE id = event_id)));

-- ============ CHECKINS ============
CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL UNIQUE REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  checker_id UUID NOT NULL REFERENCES auth.users(id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "host members read checkins" ON public.checkins FOR SELECT
  USING (public.is_host_member(auth.uid(),
    (SELECT host_id FROM public.events WHERE id = event_id)));
CREATE POLICY "host members create checkins" ON public.checkins FOR INSERT
  WITH CHECK (public.is_host_member(auth.uid(),
    (SELECT host_id FROM public.events WHERE id = event_id)) AND checker_id = auth.uid());
CREATE POLICY "host members delete checkins" ON public.checkins FOR DELETE
  USING (public.is_host_member(auth.uid(),
    (SELECT host_id FROM public.events WHERE id = event_id)));

-- ============ FEEDBACK ============
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL,
  comment TEXT,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback public read" ON public.feedback FOR SELECT USING (NOT hidden);
CREATE POLICY "user creates own feedback" ON public.feedback FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user updates own feedback" ON public.feedback FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "host updates feedback" ON public.feedback FOR UPDATE
  USING (public.is_host_member(auth.uid(), (SELECT host_id FROM public.events WHERE id = event_id)));

-- ============ GALLERY ============
CREATE TABLE public.gallery_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gallery_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gallery public read approved" ON public.gallery_uploads FOR SELECT
  USING ((approved AND NOT hidden) OR user_id = auth.uid()
    OR public.is_host_member(auth.uid(), (SELECT host_id FROM public.events WHERE id = event_id)));
CREATE POLICY "user uploads gallery" ON public.gallery_uploads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "host moderates gallery" ON public.gallery_uploads FOR UPDATE
  USING (public.is_host_member(auth.uid(), (SELECT host_id FROM public.events WHERE id = event_id)));
CREATE POLICY "host or owner deletes gallery" ON public.gallery_uploads FOR DELETE
  USING (user_id = auth.uid() OR public.is_host_member(auth.uid(), (SELECT host_id FROM public.events WHERE id = event_id)));

-- ============ REPORTS ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  host_id UUID REFERENCES public.hosts(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user creates report" ON public.reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "host reads reports" ON public.reports FOR SELECT
  USING (public.is_host_member(auth.uid(), host_id));
CREATE POLICY "host updates reports" ON public.reports FOR UPDATE
  USING (public.is_host_member(auth.uid(), host_id));

-- ============ TICKET CODE GENERATOR ============
CREATE OR REPLACE FUNCTION public.gen_ticket_code() RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, 1 + floor(random()*length(chars))::int, 1);
  END LOOP;
  RETURN result;
END; $$;

-- ============ RSVP -> TICKET + CAPACITY/WAITLIST ============
CREATE OR REPLACE FUNCTION public.rsvp_create(_event UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _ev RECORD;
  _confirmed_count INT;
  _existing RECORD;
  _new_status public.rsvp_status;
  _rsvp_id UUID;
  _ticket_code TEXT;
  _ticket_id UUID;
  _wpos INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'must be signed in'; END IF;
  SELECT * INTO _ev FROM public.events WHERE id = _event;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;
  IF _ev.status <> 'published' THEN RAISE EXCEPTION 'event not published'; END IF;
  IF _ev.end_at < now() THEN RAISE EXCEPTION 'event has ended'; END IF;

  SELECT * INTO _existing FROM public.rsvps WHERE event_id=_event AND user_id=_uid;
  IF FOUND AND _existing.status IN ('confirmed','waitlist') THEN
    RETURN json_build_object('rsvp_id', _existing.id, 'status', _existing.status);
  END IF;

  SELECT count(*) INTO _confirmed_count FROM public.rsvps
    WHERE event_id=_event AND status='confirmed';

  IF _confirmed_count < _ev.capacity THEN
    _new_status := 'confirmed';
    _wpos := NULL;
  ELSE
    _new_status := 'waitlist';
    SELECT COALESCE(MAX(waitlist_position),0)+1 INTO _wpos FROM public.rsvps
      WHERE event_id=_event AND status='waitlist';
  END IF;

  IF FOUND THEN
    UPDATE public.rsvps SET status=_new_status, waitlist_position=_wpos, created_at=now()
      WHERE id=_existing.id RETURNING id INTO _rsvp_id;
  ELSE
    INSERT INTO public.rsvps(event_id, user_id, status, waitlist_position)
      VALUES (_event, _uid, _new_status, _wpos) RETURNING id INTO _rsvp_id;
  END IF;

  IF _new_status = 'confirmed' THEN
    -- create ticket if missing
    IF NOT EXISTS(SELECT 1 FROM public.tickets WHERE rsvp_id=_rsvp_id) THEN
      LOOP
        _ticket_code := public.gen_ticket_code();
        EXIT WHEN NOT EXISTS(SELECT 1 FROM public.tickets WHERE code=_ticket_code);
      END LOOP;
      INSERT INTO public.tickets(rsvp_id, event_id, user_id, code)
        VALUES (_rsvp_id, _event, _uid, _ticket_code) RETURNING id INTO _ticket_id;
    END IF;
  END IF;

  RETURN json_build_object('rsvp_id', _rsvp_id, 'status', _new_status, 'waitlist_position', _wpos);
END; $$;

CREATE OR REPLACE FUNCTION public.rsvp_cancel(_event UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _was_confirmed BOOLEAN := false;
  _next RECORD;
  _ticket_code TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'must be signed in'; END IF;
  UPDATE public.rsvps SET status='cancelled', waitlist_position=NULL
    WHERE event_id=_event AND user_id=_uid AND status IN ('confirmed','waitlist')
    RETURNING (status='confirmed') INTO _was_confirmed;
  -- delete ticket
  DELETE FROM public.tickets WHERE event_id=_event AND user_id=_uid;

  -- promote waitlist if a confirmed slot opened
  IF _was_confirmed THEN
    SELECT * INTO _next FROM public.rsvps
      WHERE event_id=_event AND status='waitlist'
      ORDER BY waitlist_position ASC LIMIT 1;
    IF FOUND THEN
      UPDATE public.rsvps SET status='confirmed', waitlist_position=NULL WHERE id=_next.id;
      LOOP
        _ticket_code := public.gen_ticket_code();
        EXIT WHEN NOT EXISTS(SELECT 1 FROM public.tickets WHERE code=_ticket_code);
      END LOOP;
      INSERT INTO public.tickets(rsvp_id, event_id, user_id, code)
        VALUES (_next.id, _event, _next.user_id, _ticket_code)
        ON CONFLICT (rsvp_id) DO NOTHING;
    END IF;
  END IF;
END; $$;

-- ============ CHECK-IN RPCs ============
CREATE OR REPLACE FUNCTION public.checkin_by_code(_event UUID, _code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _ev RECORD;
  _ticket RECORD;
  _profile RECORD;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'must be signed in'; END IF;
  SELECT * INTO _ev FROM public.events WHERE id=_event;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;
  IF NOT public.is_host_member(_uid, _ev.host_id) THEN
    RAISE EXCEPTION 'not authorized for this event';
  END IF;
  SELECT * INTO _ticket FROM public.tickets
    WHERE event_id=_event AND upper(code)=upper(_code);
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  IF EXISTS(SELECT 1 FROM public.checkins WHERE ticket_id=_ticket.id) THEN
    SELECT full_name, email INTO _profile FROM public.profiles WHERE id=_ticket.user_id;
    RETURN json_build_object('ok', false, 'error', 'already_checked_in',
      'name', _profile.full_name, 'email', _profile.email);
  END IF;
  INSERT INTO public.checkins(ticket_id, event_id, checker_id) VALUES (_ticket.id, _event, _uid);
  SELECT full_name, email INTO _profile FROM public.profiles WHERE id=_ticket.user_id;
  RETURN json_build_object('ok', true, 'ticket_id', _ticket.id,
    'name', _profile.full_name, 'email', _profile.email, 'code', _ticket.code);
END; $$;

CREATE OR REPLACE FUNCTION public.checkin_undo(_checkin UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _row RECORD;
BEGIN
  SELECT c.*, e.host_id INTO _row FROM public.checkins c
    JOIN public.events e ON e.id = c.event_id WHERE c.id=_checkin;
  IF NOT FOUND THEN RAISE EXCEPTION 'checkin not found'; END IF;
  IF NOT public.is_host_member(_uid, _row.host_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  DELETE FROM public.checkins WHERE id=_checkin;
END; $$;

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('event-covers','event-covers',true),
  ('host-logos','host-logos',true),
  ('gallery','gallery',true)
ON CONFLICT DO NOTHING;

-- public read
CREATE POLICY "public read covers" ON storage.objects FOR SELECT USING (bucket_id='event-covers');
CREATE POLICY "public read logos" ON storage.objects FOR SELECT USING (bucket_id='host-logos');
CREATE POLICY "public read gallery" ON storage.objects FOR SELECT USING (bucket_id='gallery');
-- authenticated upload
CREATE POLICY "auth upload covers" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='event-covers' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth upload logos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='host-logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth upload gallery" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='gallery' AND auth.uid() IS NOT NULL);
CREATE POLICY "owner delete covers" ON storage.objects FOR DELETE
  USING (bucket_id='event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner delete logos" ON storage.objects FOR DELETE
  USING (bucket_id='host-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner delete gallery" ON storage.objects FOR DELETE
  USING (bucket_id='gallery' AND auth.uid()::text = (storage.foldername(name))[1]);
