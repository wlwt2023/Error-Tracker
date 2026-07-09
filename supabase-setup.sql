-- ─────────────────────────────────────────────────────────────
-- Run this whole file once in Supabase → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

create table if not exists errors (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('ASRS','Infolog','AMR','Other')),
  description text not null,
  notes text,
  status text not null default 'open' check (status in ('open','solved')),
  created_at timestamptz not null default now(),
  solved_at timestamptz,
  photo_url text
);

alter table errors enable row level security;

-- This app has no login system — anyone with the link can read/write.
-- That's fine for an internal team tool on a private link. If you need
-- real access control later, replace these policies with auth-based ones.
create policy "public can read errors" on errors for select using (true);
create policy "public can insert errors" on errors for insert with check (true);
create policy "public can update errors" on errors for update using (true);
create policy "public can delete errors" on errors for delete using (true);

-- Storage policies for the photo bucket.
-- First create a bucket named "error-photos" (Public) in Storage → New bucket,
-- THEN run the statements below.
create policy "public can upload photos"
on storage.objects for insert
with check (bucket_id = 'error-photos');

create policy "public can view photos"
on storage.objects for select
using (bucket_id = 'error-photos');

create policy "public can delete photos"
on storage.objects for delete
using (bucket_id = 'error-photos');
