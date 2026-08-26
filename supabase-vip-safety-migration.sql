-- Run AFTER supabase-schema.sql in Supabase Dashboard > SQL Editor.
-- This is additive: it does not erase existing members or messages.

alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists gender text check (gender in ('woman', 'man', 'non_binary', 'prefer_not_to_say')),
  add column if not exists privacy text not null default 'public' check (privacy in ('public', 'private')),
  add column if not exists theme text not null default 'midnight' check (theme in ('midnight', 'sakura', 'ocean', 'royal')),
  add column if not exists is_vip boolean not null default false,
  add column if not exists vip_badge text not null default 'none' check (vip_badge in ('none', 'owner_granted', 'purchased', 'black')),
  add column if not exists vip_granted_at timestamptz,
  add column if not exists account_status text not null default 'active' check (account_status in ('active', 'suspended', 'banned', 'dismissed')),
  add column if not exists identity_locked boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- New sign-ups must complete all identity fields. Existing members stay valid.
alter table public.profiles drop constraint if exists profiles_identity_complete;
alter table public.profiles add constraint profiles_identity_complete check (
  identity_locked = false or (date_of_birth is not null and gender is not null)
);

-- The server enforces standard usernames for members. The owner account is intentionally unrestricted.
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check check (account_status in ('active', 'suspended', 'banned', 'dismissed'));
alter table public.profiles drop constraint if exists profiles_vip_badge_check;
alter table public.profiles add constraint profiles_vip_badge_check check (vip_badge in ('none', 'owner_granted', 'purchased', 'black'));

alter table public.direct_messages
  add column if not exists status text not null default 'request' check (status in ('request', 'accepted', 'declined')),
  add column if not exists responded_at timestamptz;
-- Chat is text-based and intentionally has no length cap. Empty messages remain invalid.
alter table public.direct_messages drop constraint if exists direct_messages_body_check;

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null,
  action text not null check (action in ('profile_updated', 'vip_granted', 'suspended', 'banned', 'dismissed', 'deleted')),
  note text not null default '',
  actor_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(), author_id text not null references public.profiles(id) on delete cascade,
  video_url text not null, caption text not null default '', created_at timestamptz not null default now()
);
alter table public.reels enable row level security;
create policy "Reels visible to signed-in users" on public.reels for select to authenticated using (true);
create policy "Users create their own reels" on public.reels for insert to authenticated with check (author_id = auth.jwt() ->> 'sub');
create policy "Users delete their own reels" on public.reels for delete to authenticated using (author_id = auth.jwt() ->> 'sub');
insert into storage.buckets (id, name, public) values ('reel-media', 'reel-media', true) on conflict (id) do nothing;
create policy "Signed-in users view reels" on storage.objects for select to authenticated using (bucket_id = 'reel-media');
create policy "Users upload their reels" on storage.objects for insert to authenticated with check (bucket_id = 'reel-media' and (storage.foldername(name))[1] = auth.jwt() ->> 'sub');

create or replace function public.lock_profile_identity()
returns trigger language plpgsql as $$
begin
  -- Browser clients always keep the member rules. Owner Studio runs through service_role.
  if current_user <> 'service_role' and
     (new.username !~ '^[a-z0-9_]{3,20}$' or char_length(new.display_name) not between 1 and 50 or char_length(new.bio) > 180) then
    raise exception 'This profile does not meet normal member field rules';
  end if;
  if tg_op = 'INSERT' then
    if current_user <> 'service_role' then
      new.is_vip := false;
      new.account_status := 'active';
      new.theme := 'midnight';
    end if;
    new.identity_locked := true;
    return new;
  end if;
  if current_user <> 'service_role' and old.identity_locked and
     (new.username is distinct from old.username or new.display_name is distinct from old.display_name or
      new.date_of_birth is distinct from old.date_of_birth or new.gender is distinct from old.gender or
      new.is_vip is distinct from old.is_vip or new.account_status is distinct from old.account_status) then
    raise exception 'Identity and membership fields can only be changed by Owner Studio';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists lock_profile_identity on public.profiles;
create trigger lock_profile_identity before insert or update on public.profiles for each row execute function public.lock_profile_identity();

-- A non-mutual contact creates a request. Mutual followers chat immediately.
create or replace function public.send_message_request(recipient text, message_body text)
returns public.direct_messages language plpgsql security definer set search_path = public as $$
declare sender text := auth.jwt() ->> 'sub'; result public.direct_messages; mutual boolean;
begin
  if sender is null then raise exception 'Please sign in first'; end if;
  if not exists (select 1 from profiles where id = sender and account_status = 'active') then raise exception 'This account cannot send messages'; end if;
  if not exists (select 1 from profiles where id = recipient and account_status = 'active') then raise exception 'This member is unavailable'; end if;
  if char_length(trim(message_body)) = 0 then raise exception 'Message cannot be empty'; end if;
  select exists(select 1 from follows a join follows b on b.follower_id = a.following_id and b.following_id = a.follower_id where a.follower_id = sender and a.following_id = recipient) into mutual;
  insert into direct_messages (sender_id, recipient_id, body, status)
  values (sender, recipient, trim(message_body), case when mutual then 'accepted' else 'request' end)
  returning * into result;
  return result;
end $$;
revoke all on function public.send_message_request(text, text) from public;
grant execute on function public.send_message_request(text, text) to authenticated;

-- Direct client inserts would bypass the request rule, so only the protected RPC above may create messages.
drop policy if exists "Users send their own DMs" on public.direct_messages;

-- Only the recipient can accept/decline an incoming request.
create or replace function public.respond_to_message_request(message_id uuid, decision text)
returns void language sql security definer set search_path = public as $$
  update direct_messages set status = decision, responded_at = now()
  where id = message_id and recipient_id = auth.jwt() ->> 'sub' and status = 'request'
$$;
revoke all on function public.respond_to_message_request(uuid, text) from public;
grant execute on function public.respond_to_message_request(uuid, text) to authenticated;
