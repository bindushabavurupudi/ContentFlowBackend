create extension if not exists "pgcrypto";

-- Core profile/settings data used by frontend AuthContext.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'team' check (role in ('admin', 'team')),
  auto_logout_enabled boolean not null default false,
  two_factor_enabled boolean not null default false,
  notifications jsonb not null default '{"email": true, "push": true, "digest": false, "alerts": true}'::jsonb
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  platforms text[] not null default '{}',
  date text not null,
  time text not null,
  status text not null check (status in ('scheduled', 'draft')),
  scheduled_at timestamptz,
  media_files text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists posts_created_at_idx on public.posts(created_at desc);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day integer not null,
  title text not null,
  platform text not null,
  time text not null,
  campaign text
);

create index if not exists calendar_events_user_id_idx on public.calendar_events(user_id);

create table if not exists public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  assignee text not null,
  status text not null,
  priority text not null
);

create index if not exists team_tasks_user_id_idx on public.team_tasks(user_id);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.calendar_events enable row level security;
alter table public.team_tasks enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "posts_select_own" on public.posts;
drop policy if exists "posts_insert_own" on public.posts;
drop policy if exists "posts_update_own" on public.posts;
create policy "posts_select_own" on public.posts for select using (auth.uid() = user_id);
create policy "posts_insert_own" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_update_own" on public.posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "calendar_select_own" on public.calendar_events;
drop policy if exists "calendar_insert_own" on public.calendar_events;
drop policy if exists "calendar_update_own" on public.calendar_events;
create policy "calendar_select_own" on public.calendar_events for select using (auth.uid() = user_id);
create policy "calendar_insert_own" on public.calendar_events for insert with check (auth.uid() = user_id);
create policy "calendar_update_own" on public.calendar_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks_select_own" on public.team_tasks;
drop policy if exists "tasks_insert_own" on public.team_tasks;
drop policy if exists "tasks_update_own" on public.team_tasks;
create policy "tasks_select_own" on public.team_tasks for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.team_tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.team_tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

drop policy if exists "public_read_post_media" on storage.objects;
create policy "public_read_post_media"
on storage.objects for select
using (bucket_id = 'post-media');

drop policy if exists "authenticated_upload_post_media" on storage.objects;
create policy "authenticated_upload_post_media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'post-media');
