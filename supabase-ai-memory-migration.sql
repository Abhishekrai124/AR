create table if not exists public.ai_memories (
  user_id text primary key references public.profiles(id) on delete cascade,
  memories jsonb not null default '[]'::jsonb check (jsonb_typeof(memories) = 'array' and jsonb_array_length(memories) <= 12),
  updated_at timestamptz not null default now()
);

alter table public.ai_memories enable row level security;
revoke all on public.ai_memories from anon, authenticated;
grant select, insert, update, delete on public.ai_memories to authenticated;

drop policy if exists "Users read their AI memory" on public.ai_memories;
drop policy if exists "Users create their AI memory" on public.ai_memories;
drop policy if exists "Users update their AI memory" on public.ai_memories;
drop policy if exists "Users clear their AI memory" on public.ai_memories;
create policy "Users read their AI memory" on public.ai_memories for select to authenticated using (user_id = auth.jwt() ->> 'sub');
create policy "Users create their AI memory" on public.ai_memories for insert to authenticated with check (user_id = auth.jwt() ->> 'sub');
create policy "Users update their AI memory" on public.ai_memories for update to authenticated using (user_id = auth.jwt() ->> 'sub') with check (user_id = auth.jwt() ->> 'sub');
create policy "Users clear their AI memory" on public.ai_memories for delete to authenticated using (user_id = auth.jwt() ->> 'sub');