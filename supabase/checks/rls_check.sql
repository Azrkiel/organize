-- RLS check for Phase 2. Paste into the Supabase SQL editor and run it.
-- Everything happens inside a transaction that is rolled back, so no test users or rows remain.
-- Any failed check raises an exception (red error). If you see "RLS checks passed", all is well.

begin;

-- Two throwaway users (the on_auth_user_created trigger gives each a settings row).
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-a@example.invalid'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'rls-b@example.invalid');

-- One row per table per user, inserted as the table owner (bypasses RLS).
do $$
declare
  u uuid;
  c uuid;
  n uuid;
begin
  foreach u in array array[
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
  ]
  loop
    insert into courses (user_id, name) values (u, 'course') returning id into c;
    insert into folders (user_id, course_id, name) values (u, c, 'folder');
    insert into notes (user_id, course_id, title) values (u, c, 'note') returning id into n;
    insert into attachments (user_id, note_id, storage_path, file_name) values (u, n, u || '/f.txt', 'f.txt');
    insert into tasks (user_id, course_id, title) values (u, c, 'task');
    insert into events (user_id, course_id, title, starts_at) values (u, c, 'event', now());
    insert into flashcards (user_id, course_id, front, back) values (u, c, 'q', 'a');
    insert into focus_sessions (user_id, course_id, started_at, minutes) values (u, c, now(), 25);
    insert into lectures (user_id, course_id, title) values (u, c, 'lecture');
    insert into integrations (user_id, provider, refresh_token_enc) values (u, 'google', 'x');
  end loop;
end;
$$;

-- Act as user A through the same path the browser uses (authenticated role + JWT claims).
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$
declare
  t text;
  total bigint;
  mine bigint;
  affected bigint;
begin
  -- 1. A sees exactly their own single row in every table, none of B's.
  foreach t in array array[
    'courses', 'folders', 'notes', 'attachments', 'tasks',
    'events', 'flashcards', 'focus_sessions', 'lectures', 'settings'
  ]
  loop
    execute format('select count(*), count(*) filter (where user_id = auth.uid()) from %I', t)
      into total, mine;
    if total <> 1 or mine <> 1 then
      raise exception 'RLS FAIL: % returned % rows (% are A''s), expected exactly A''s 1', t, total, mine;
    end if;
  end loop;

  -- 2. integrations: A has a row, but no policy exists, so A must see nothing.
  select count(*) into total from integrations;
  if total <> 0 then
    raise exception 'RLS FAIL: integrations returned % rows to an authenticated user', total;
  end if;

  -- 3. A cannot update or delete B's rows (silently affects 0 rows).
  update courses set name = 'hacked' where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS FAIL: A updated % of B''s courses', affected;
  end if;
  delete from tasks where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS FAIL: A deleted % of B''s tasks', affected;
  end if;

  -- 4. A cannot insert a row owned by B.
  begin
    insert into courses (user_id, name) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'planted');
    raise exception 'RLS FAIL: A inserted a course owned by B';
  exception when insufficient_privilege then
    null; -- expected: new row violates row-level security policy
  end;

  -- 5. Storage: A can write under A's folder, not under B's.
  insert into storage.objects (bucket_id, name)
    values ('attachments', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/ok.txt');
  begin
    insert into storage.objects (bucket_id, name)
      values ('attachments', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/nope.txt');
    raise exception 'RLS FAIL: A wrote into B''s storage folder';
  exception when insufficient_privilege then
    null; -- expected
  end;

  -- 6. search_all runs under RLS: finds A's note and task only.
  select count(*) into total from search_all('note');
  if total <> 1 then
    raise exception 'RLS FAIL: search_all(''note'') returned % rows, expected 1', total;
  end if;
  select count(*) into total from search_all('task');
  if total <> 1 then
    raise exception 'RLS FAIL: search_all(''task'') returned % rows, expected 1', total;
  end if;
end;
$$;

reset role;
rollback;

select 'RLS checks passed' as result;
