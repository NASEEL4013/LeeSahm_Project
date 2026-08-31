create extension if not exists pgcrypto;

create table if not exists public.compositions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  title text not null check (char_length(title) between 1 and 80),
  description text not null check (char_length(description) between 1 and 2000),
  category smallint check (category between 1 and 6),
  composition jsonb not null,
  thumbnail_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.compositions add column if not exists category smallint check (category between 1 and 6);

alter table public.compositions enable row level security;
grant select on public.compositions to anon, authenticated;
grant insert, update, delete on public.compositions to authenticated;

create policy "compositions are public"
on public.compositions for select
to anon, authenticated
using (true);

create policy "users create their compositions"
on public.compositions for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update their compositions"
on public.compositions for update
to authenticated
using (
  (select auth.uid()) = user_id
  or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  (select auth.uid()) = user_id
  or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "users delete their compositions"
on public.compositions for delete
to authenticated
using (
  (select auth.uid()) = user_id
  or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('composition-thumbnails', 'composition-thumbnails', true, 5242880, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/webp'];

create policy "public reads composition thumbnails"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'composition-thumbnails');

create policy "users upload composition thumbnails"
on storage.objects for insert
to authenticated
with check (bucket_id = 'composition-thumbnails' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "users delete composition thumbnails"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'composition-thumbnails'
  and (
    owner_id = (select auth.uid()::text)
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
);
