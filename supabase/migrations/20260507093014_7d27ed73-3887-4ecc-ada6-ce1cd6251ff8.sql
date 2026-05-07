
ALTER TABLE public.hosts ADD COLUMN IF NOT EXISTS contact_email text;

CREATE OR REPLACE FUNCTION public.promote_waitlist_on_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _confirmed_count INT;
  _slots INT;
  _next RECORD;
  _ticket_code TEXT;
BEGIN
  IF NEW.capacity <= OLD.capacity THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO _confirmed_count FROM public.rsvps
    WHERE event_id = NEW.id AND status = 'confirmed';
  _slots := NEW.capacity - _confirmed_count;
  IF _slots <= 0 THEN RETURN NEW; END IF;

  FOR _next IN
    SELECT * FROM public.rsvps
      WHERE event_id = NEW.id AND status = 'waitlist'
      ORDER BY waitlist_position ASC
      LIMIT _slots
  LOOP
    UPDATE public.rsvps
      SET status = 'confirmed', waitlist_position = NULL
      WHERE id = _next.id;
    LOOP
      _ticket_code := public.gen_ticket_code();
      EXIT WHEN NOT EXISTS(SELECT 1 FROM public.tickets WHERE code = _ticket_code);
    END LOOP;
    INSERT INTO public.tickets(rsvp_id, event_id, user_id, code)
      VALUES (_next.id, NEW.id, _next.user_id, _ticket_code)
      ON CONFLICT (rsvp_id) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_waitlist_on_capacity ON public.events;
CREATE TRIGGER trg_promote_waitlist_on_capacity
AFTER UPDATE OF capacity ON public.events
FOR EACH ROW
WHEN (NEW.capacity IS DISTINCT FROM OLD.capacity)
EXECUTE FUNCTION public.promote_waitlist_on_capacity();
