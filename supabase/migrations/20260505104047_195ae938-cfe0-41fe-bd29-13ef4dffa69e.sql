
CREATE OR REPLACE FUNCTION public.rsvp_create(_event uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _ev RECORD;
  _confirmed_count INT;
  _existing RECORD;
  _has_existing BOOLEAN := false;
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
  _has_existing := FOUND;
  IF _has_existing AND _existing.status IN ('confirmed','waitlist') THEN
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

  IF _has_existing THEN
    UPDATE public.rsvps SET status=_new_status, waitlist_position=_wpos, created_at=now()
      WHERE id=_existing.id RETURNING id INTO _rsvp_id;
  ELSE
    INSERT INTO public.rsvps(event_id, user_id, status, waitlist_position)
      VALUES (_event, _uid, _new_status, _wpos) RETURNING id INTO _rsvp_id;
  END IF;

  IF _new_status = 'confirmed' THEN
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
END; $function$;
