-- Phase 12 (iPhone slide capture) + groundwork for Phases 13-14 (syllabus import, topic map,
-- exam prep), so those phases don't touch the schema again. Numbered 0003, not 0002 as PLAN.md's
-- own sketch says, since 0002 was already taken by Phase 5's sync-status column.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

alter table lectures add column transcript_segments jsonb;  -- [{start, end, text}] in seconds

create table lecture_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  lecture_id uuid references lectures on delete cascade,
  course_id uuid references courses on delete set null,
  storage_path text not null,
  taken_at timestamptz not null default now(),
  offset_seconds int,            -- seconds since the lecture started
  slide_text text,               -- extracted text/description of the slide
  caption text,
  created_at timestamptz not null default now()
);

create table syllabi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  course_id uuid not null references courses on delete cascade,
  storage_path text,
  raw_text text not null,
  parsed jsonb,                  -- structured result, see Phase 13
  created_at timestamptz not null default now()
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  course_id uuid not null references courses on delete cascade,
  title text not null,
  description text,
  week int,
  scheduled_date date,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table lecture_topics (
  user_id uuid not null references auth.users on delete cascade,
  lecture_id uuid not null references lectures on delete cascade,
  topic_id uuid not null references topics on delete cascade,
  primary key (lecture_id, topic_id)
);

create table study_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  course_id uuid not null references courses on delete cascade,
  exam_event_id uuid references events on delete set null,
  title text not null,
  overview_md text not null default '',
  topic_ids uuid[] not null default '{}',
  source text not null default 'organize' check (source in ('organize','notebooklm','claude')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table practice_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  study_guide_id uuid references study_guides on delete cascade,
  course_id uuid not null references courses on delete cascade,
  topic_id uuid references topics on delete set null,
  source_lecture_id uuid references lectures on delete set null,
  type text not null check (type in ('multiple_choice','short_answer','calculation','true_false')),
  difficulty smallint not null default 2,   -- 1 easy, 2 medium, 3 hard
  question text not null,
  choices jsonb,                  -- for multiple_choice: ["A","B","C","D"]
  answer text not null,
  explanation text,
  created_at timestamptz not null default now()
);

create table question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  question_id uuid not null references practice_questions on delete cascade,
  correct boolean not null,
  response text,
  answered_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (Phase 12 only queries by course/lecture; Phases 13-14 add their own as needed)
-- ---------------------------------------------------------------------------

create index lecture_photos_user_lecture_idx on lecture_photos (user_id, lecture_id);
create index syllabi_user_course_idx on syllabi (user_id, course_id);
create index topics_user_course_idx on topics (user_id, course_id);
create index study_guides_user_course_idx on study_guides (user_id, course_id);
create index practice_questions_user_guide_idx on practice_questions (user_id, study_guide_id);
create index question_attempts_user_question_idx on question_attempts (user_id, question_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (only study_guides has the column among this migration's tables;
-- set_updated_at() already exists from 0001_init.sql)
-- ---------------------------------------------------------------------------

create trigger study_guides_set_updated_at before update on study_guides
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — same pattern as 0001_init.sql: owner can do everything to their own rows.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'lecture_photos', 'syllabi', 'topics', 'lecture_topics',
    'study_guides', 'practice_questions', 'question_attempts'
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

-- ---------------------------------------------------------------------------
-- Storage: private `lecture-photos` bucket, same pattern as 0001_init.sql's `attachments`
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('lecture-photos', 'lecture-photos', false)
on conflict (id) do nothing;

create policy lecture_photos_select_own on storage.objects for select to authenticated
  using (bucket_id = 'lecture-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy lecture_photos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'lecture-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy lecture_photos_update_own on storage.objects for update to authenticated
  using (bucket_id = 'lecture-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'lecture-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy lecture_photos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'lecture-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Realtime: only `lecture_photos` is added, not every new table — it's the only one this phase
-- (or 13/14's current task lists) actually needs the laptop to subscribe to. Adding tables to
-- this publication isn't free (extra WAL/replication overhead), so only enable what's used.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table lecture_photos;
