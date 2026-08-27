-- Run once when community shows "column profiles_1.blue_tick does not exist".
alter table public.profiles add column if not exists blue_tick boolean not null default false;
alter table public.profiles add column if not exists gold_tick boolean not null default false;
alter table public.profiles add column if not exists is_vip boolean not null default false;
alter table public.profiles add column if not exists community_role text not null default 'member';
alter table public.profiles add column if not exists privacy text not null default 'public';
alter table public.profiles add column if not exists theme text not null default 'midnight';
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.direct_messages add column if not exists attachment_url text;
alter table public.direct_messages add column if not exists attachment_type text;
alter table public.direct_messages add column if not exists status text not null default 'accepted';
create or replace function public.send_media_message(media_type text, media_url text, message_body text, recipient text)
returns public.direct_messages language plpgsql security definer set search_path = public as $$
declare result public.direct_messages;
begin
  if auth.jwt() ->> 'sub' is null then raise exception 'Please sign in first'; end if;
  if char_length(trim(coalesce(message_body, ''))) = 0 and media_url is null then raise exception 'Write a message or attach media'; end if;
  insert into public.direct_messages (sender_id, recipient_id, body, media_url, media_type, attachment_url, attachment_type, status)
  values (auth.jwt() ->> 'sub', recipient, trim(coalesce(message_body, '')), media_url, media_type, media_url, media_type, 'accepted')
  returning * into result;
  return result;
end; $$;
grant execute on function public.send_media_message(text, text, text, text) to authenticated;
