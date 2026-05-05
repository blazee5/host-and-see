
-- 1) Profiles: drop public read; scope reads
DROP POLICY IF EXISTS "profiles readable by all" ON public.profiles;

CREATE POLICY "own profile readable"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "host reads relevant profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.host_members hm
    WHERE hm.user_id = auth.uid() AND hm.accepted_at IS NOT NULL
      AND (
        EXISTS (SELECT 1 FROM public.host_members hm2
                WHERE hm2.host_id = hm.host_id AND hm2.user_id = profiles.id)
        OR EXISTS (SELECT 1 FROM public.rsvps r
                   JOIN public.events e ON e.id = r.event_id
                   WHERE r.user_id = profiles.id AND e.host_id = hm.host_id)
      )
  )
);

-- helper to expose only display names (no email) for public UI like feedback
CREATE OR REPLACE FUNCTION public.get_display_names(_ids uuid[])
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, full_name FROM public.profiles WHERE id = ANY(_ids);
$$;
REVOKE ALL ON FUNCTION public.get_display_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_display_names(uuid[]) TO anon, authenticated;

-- 2) Storage: scope cover/logo uploads to user's own folder; add update policies
DROP POLICY IF EXISTS "auth upload covers" ON storage.objects;
DROP POLICY IF EXISTS "auth upload logos" ON storage.objects;

CREATE POLICY "auth upload covers" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth upload logos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='host-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "owner update covers" ON storage.objects FOR UPDATE
  USING (bucket_id='event-covers' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id='event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner update logos" ON storage.objects FOR UPDATE
  USING (bucket_id='host-logos' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id='host-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner update gallery" ON storage.objects FOR UPDATE
  USING (bucket_id='gallery' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id='gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3) Reports: require reporter & host
DELETE FROM public.reports WHERE reporter_id IS NULL OR host_id IS NULL;
ALTER TABLE public.reports ALTER COLUMN reporter_id SET NOT NULL;
ALTER TABLE public.reports ALTER COLUMN host_id SET NOT NULL;

DROP POLICY IF EXISTS "user creates report" ON public.reports;
CREATE POLICY "user creates report" ON public.reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid() AND host_id IS NOT NULL);

-- 4) Function search_path for gen_ticket_code
CREATE OR REPLACE FUNCTION public.gen_ticket_code()
RETURNS text LANGUAGE plpgsql SET search_path = public
AS $$
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

-- 5) Lock down EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.gen_ticket_code() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.rsvp_create(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rsvp_cancel(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.checkin_by_code(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.checkin_undo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_host_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rsvp_create(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rsvp_cancel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_by_code(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_undo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_host_invite(text) TO authenticated;

-- helper functions used only inside RLS / triggers — revoke from clients
REVOKE EXECUTE ON FUNCTION public.is_host_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_host_role(uuid, uuid, public.host_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_host() FROM PUBLIC, anon, authenticated;
