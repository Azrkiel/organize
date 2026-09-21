-- Organize: initial schema. One user, everything scoped by user_id + RLS.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  archived boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  course_id uuid not null references courses on delete cascade,
  parent_id uuid references folders on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  course_id uuid references courses on delete set null,
  folder_id uuid references folders on delete set null,
  title text not null default 'Untitled',
  content jsonb not null default '{}'::jsonb,   -- TipTap JSON
  content_text text not null default '',        -- plain text for search
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(content_text,'')), 'B')
  ) stored,
  pinned boolean not null default false,
  onenote_page_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_search_idx on notes using gin (search);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  note_id uuid references notes on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  course_id uuid references courses on delete set null,
  note_id uuid references notes on delete set null,
  title text not null,
  details text,
  due_at timestamptz,
  priority smallint not null default 0,  -- 0 none, 1 low, 2 med, 3 high
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  course_id uuid references courses on delete set null,
  task_id uuid references tasks on delete cascade,
  kind text not null default 'other' check (kind in ('exam','class','deadline','study','other')),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  google_event_id text,
  outlook_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table integrations (
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('google','microsoft')),
  account_email text,
  refresh_token_enc text not null,   -- AES-256-GCM, base64
  access_token_enc text,             -- also encrypted; never store tokens in plaintext
  access_token_expires_at timestamptz,
  calendar_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  course_id uuid references courses on delete set null,
  note_id uuid references notes on delete set null,
  front text not null,
  back text not null,
  ease real not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  course_id uuid references courses on delete set null,
  started_at timestamptz not null,
  minutes int not null,
  created_at timestamptz not null default now()
);

create table lectures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  course_id uuid references courses on delete set null,
  note_id uuid references notes on delete set null,   -- the generated note
  title text not null,
  recorded_at timestamptz not null default now(),
  duration_seconds int,
  transcript_live text,        -- rough, from the browser during class
  transcript text,             -- accurate, from Whisper or an imported file
  transcript_source text check (transcript_source in ('live','whisper','import')),
  status text not null default 'recorded'
    check (status in ('recorded','transcribing','transcribed','notes_ready','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table settings (
  user_id uuid primary key references auth.users on delete cascade,
  timezone text not null default 'America/New_York',
  digest_enabled boolean not null default true,
  digest_email text,
  whisper_model_size text not null default 'base' check (whisper_model_size in ('tiny','base','small')),
  onenote_notebook_id text,
  onenote_section_id text,
  recording_policy_ack boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index tasks_user_due_idx on tasks (user_id, due_at);
create index events_user_starts_idx on events (user_id, starts_at);
create index flashcards_user_due_idx on flashcards (user_id, due_at);
create index notes_user_folder_idx on notes (user_id, folder_id);
create index folders_user_parent_idx on folders (user_id, parent_id);
create index lectures_user_course_idx on lectures (user_id, course_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_set_updated_at before update on notes
  for each row execute function set_updated_at();
create trigger tasks_set_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger events_set_updated_at before update on events
  for each row execute function set_updated_at();
create trigger lectures_set_updated_at before update on lectures
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- Every table except `integrations`: the owner can do everything to their own rows.
-- `(select auth.uid())` is evaluated once per query instead of once per row.
do $$
declare
  t text;
begin
  foreach t in array array[
    'courses', 'folders', 'notes', 'attachments', 'tasks',
    'events', 'flashcards', 'focus_sessions', 'lectures', 'settings'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for select using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on %I for insert with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on %I for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on %I for delete using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end;
$$;

-- `integrations` holds OAuth tokens: RLS on, deliberately NO policies. The anon and
-- authenticated roles can never read it. Only server code with the service role key can.
alter table integrations enable row level security;

-- ---------------------------------------------------------------------------
-- settings row for every user (sign-ups are off, but the trigger keeps this honest)
-- ---------------------------------------------------------------------------

create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.settings (user_id, digest_email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill: users that existed before this migration.
insert into settings (user_id, digest_email)
select id, email from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage: private `attachments` bucket, files live under `{user_id}/...`
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy attachments_select_own on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_update_own on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Search: ranked notes (full text) + tasks (title substring)
-- ---------------------------------------------------------------------------

create function search_all(q text)
returns table (
  kind text,
  id uuid,
  title text,
  snippet text,
  course_id uuid,
  score real
)
language sql
stable
security invoker
set search_path = public
as $$
  select r.kind, r.id, r.title, r.snippet, r.course_id, r.score
  from (
    select
      'note'::text as kind,
      n.id,
      n.title,
      ts_headline('english', n.content_text, websearch_to_tsquery('english', q),
                  'MaxFragments=1, MinWords=8, MaxWords=24') as snippet,
      n.course_id,
      ts_rank(n.search, websearch_to_tsquery('english', q)) as score
    from notes n
    where n.search @@ websearch_to_tsquery('english', q)

    union all

    select
      'task'::text,
      t.id,
      t.title,
      t.details,
      t.course_id,
      0::real
    from tasks t
    where btrim(q) <> ''
      and t.title ilike '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  ) r
  order by r.score desc, r.title
  limit 50;
$$;
