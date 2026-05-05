
-- Accept a host invite by token: binds current user to the pending host_member row.
CREATE OR REPLACE FUNCTION public.accept_host_invite(_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row RECORD;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'must be signed in'; END IF;
  SELECT * INTO _row FROM public.host_members WHERE invite_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid invite'; END IF;
  IF _row.accepted_at IS NOT NULL THEN
    RETURN json_build_object('host_id', _row.host_id, 'already', true);
  END IF;
  UPDATE public.host_members
    SET user_id = _uid, accepted_at = now(), invite_token = NULL
    WHERE id = _row.id;
  RETURN json_build_object('host_id', _row.host_id, 'role', _row.role);
END; $$;

-- Storage policies for gallery bucket: any signed-in user can upload to their own folder; public read; host or owner delete.
CREATE POLICY "gallery public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

CREATE POLICY "gallery user upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gallery'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "gallery user delete own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'gallery'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
