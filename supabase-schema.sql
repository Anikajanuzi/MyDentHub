create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  records jsonb not null default '[]'::jsonb,
  doctors jsonb not null default '[]'::jsonb,
  technicians jsonb not null default '[]'::jsonb,
  profile jsonb not null default '{}'::jsonb,
  theme text not null default 'aqua',
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "Users can read their own data" on public.user_data;
create policy "Users can read their own data"
on public.user_data
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own data" on public.user_data;
create policy "Users can insert their own data"
on public.user_data
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own data" on public.user_data;
create policy "Users can update their own data"
on public.user_data
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own data" on public.user_data;
create policy "Users can delete their own data"
on public.user_data
for delete
to authenticated
using ((select auth.uid()) = user_id);
