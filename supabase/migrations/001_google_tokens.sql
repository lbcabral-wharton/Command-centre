-- google_tokens: stores OAuth tokens for the single owner
-- Run once in the Supabase SQL editor before deploying the app

create table if not exists google_tokens (
  owner          uuid primary key default 'a0000000-0000-4000-8000-000000000001'::uuid,
  refresh_token  text not null,
  access_token   text,
  expires_at     timestamptz,
  updated_at     timestamptz default now()
);

alter table google_tokens enable row level security;
-- Server uses service role key (bypasses RLS); no user-facing policy needed.
