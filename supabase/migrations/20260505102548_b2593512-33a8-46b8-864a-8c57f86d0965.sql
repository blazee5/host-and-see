
DO $$
DECLARE
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_att   uuid := '22222222-2222-2222-2222-222222222222';
  v_chk   uuid := '33333333-3333-3333-3333-333333333333';
  v_host  uuid := '44444444-4444-4444-4444-444444444444';
  v_evup  uuid := '55555555-5555-5555-5555-555555555555';
  v_evpst uuid := '66666666-6666-6666-6666-666666666666';
  v_rsvp  uuid := '77777777-7777-7777-7777-777777777777';
  v_tkt   uuid := '88888888-8888-8888-8888-888888888888';
  v_pwd   text := crypt('demo1234', gen_salt('bf'));
  rec     record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      (v_owner, 'organizer@demo.local', 'Demo Organizer'),
      (v_att,   'attendee@demo.local',  'Sam Attendee'),
      (v_chk,   'checker@demo.local',   'Casey Checker')
    ) AS t(uid, em, nm)
  LOOP
    INSERT INTO auth.users(
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', rec.uid, 'authenticated', 'authenticated',
      rec.em, v_pwd, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', rec.nm),
      now(), now(), '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;
    INSERT INTO auth.identities(id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), rec.uid, rec.em, jsonb_build_object('sub', rec.uid::text, 'email', rec.em), 'email', now(), now(), now())
      ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.hosts(id, owner_id, name, slug, bio)
    VALUES (v_host, v_owner, 'Lovable Community', 'lovable-community', 'A demo host for community events.')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.host_members(host_id, user_id, role, accepted_at) VALUES
    (v_host, v_owner, 'host', now()),
    (v_host, v_chk,   'checker', now())
  ON CONFLICT DO NOTHING;

  INSERT INTO public.events(id, host_id, title, description, start_at, end_at, timezone, venue, capacity, visibility, status, location_text, cover_url) VALUES
    (v_evup, v_host, 'Community Coffee Meetup',
      E'Join us for coffee, conversation, and lightning talks from local makers.\n\nBring something to share!',
      now() + interval '7 days', now() + interval '7 days 2 hours', 'UTC',
      'The Roastery, 42 Main St', 50, 'public', 'published', 'San Francisco',
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=1200'),
    (v_evpst, v_host, 'Spring Hackathon Recap',
      'A recap of our recent 24h hackathon, with demos and prizes.',
      now() - interval '14 days', now() - interval '14 days' + interval '3 hours', 'UTC',
      'Civic Hall', 100, 'public', 'published', 'San Francisco',
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rsvps(id, event_id, user_id, status)
    VALUES (v_rsvp, v_evup, v_att, 'confirmed')
    ON CONFLICT (event_id, user_id) DO NOTHING;

  INSERT INTO public.tickets(id, rsvp_id, event_id, user_id, code)
    VALUES (v_tkt, v_rsvp, v_evup, v_att, 'DEMO2026')
    ON CONFLICT (rsvp_id) DO NOTHING;

  INSERT INTO public.gallery_uploads(event_id, user_id, image_url, approved)
    SELECT v_evpst, v_att, 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800', false
    WHERE NOT EXISTS (SELECT 1 FROM public.gallery_uploads WHERE event_id=v_evpst AND user_id=v_att);
END $$;
