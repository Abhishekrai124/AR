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
