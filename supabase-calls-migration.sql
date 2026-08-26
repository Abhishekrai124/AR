-- Run this only if you already ran supabase-schema.sql before call support was added.
create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null,
  sender_id text not null references public.profiles(id) on delete cascade,
  recipient_id text not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('offer', 'answer', 'candidate', 'hangup')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.call_signals enable row level security;

create policy "Call participants read signals" on public.call_signals for select to authenticated using (sender_id = auth.jwt() ->> 'sub' or recipient_id = auth.jwt() ->> 'sub');
create policy "Users send their own call signals" on public.call_signals for insert to authenticated with check (sender_id = auth.jwt() ->> 'sub');
create policy "Call participants remove signals" on public.call_signals for delete to authenticated using (sender_id = auth.jwt() ->> 'sub' or recipient_id = auth.jwt() ->> 'sub');

alter publication supabase_realtime add table public.call_signals;
