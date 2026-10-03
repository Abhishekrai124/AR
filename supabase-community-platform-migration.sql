-- ARRAI Community capabilities.
-- Apply after supabase-schema.sql, supabase-social-migration.sql, and
-- supabase-vip-safety-migration.sql.
-- Existing ARRAI layout and account/profile tables are intentionally retained.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists who_can_follow text not null default 'everyone'
    check (who_can_follow in ('everyone', 'nobody')),
  add column if not exists who_can_message text not null default 'everyone'
    check (who_can_message in ('everyone', 'followers'));

-- ── Extend the existing feed without replacing it ────────────────────
alter table public.posts
  add column if not exists post_type text not null default 'text'
    check (post_type in ('text', 'image', 'link', 'poll', 'question', 'announcement', 'event', 'code')),
  add column if not exists reply_to uuid references public.posts(id) on delete set null,
  add column if not exists reply_policy text not null default 'everyone'
    check (reply_policy in ('everyone', 'followers', 'mentioned', 'community')),
  add column if not exists quote_post_id uuid references public.posts(id) on delete set null,
  add column if not exists updated_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists posts_reply_to_created_idx
  on public.posts(reply_to, created_at desc) where reply_to is not null;
create index if not exists posts_author_created_idx
  on public.posts(author_id, created_at desc);

alter table public.comments
  add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_post_created_idx
  on public.comments(post_id, created_at);

create table if not exists public.post_bookmarks (
  user_id text not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.post_bookmarks enable row level security;
drop policy if exists "Users manage their own post bookmarks" on public.post_bookmarks;
create policy "Users manage their own post bookmarks"
  on public.post_bookmarks for all to authenticated
  using (user_id = auth.jwt() ->> 'sub')
  with check (user_id = auth.jwt() ->> 'sub');

create table if not exists public.post_reposts (
  user_id text not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  quote text not null default '' check (char_length(quote) <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.post_reposts enable row level security;
drop policy if exists "Reposts are visible to signed-in users" on public.post_reposts;
create policy "Reposts are visible to signed-in users"
  on public.post_reposts for select to authenticated using (true);
drop policy if exists "Users manage their own reposts" on public.post_reposts;
create policy "Users manage their own reposts"
  on public.post_reposts for insert to authenticated
  with check (user_id = auth.jwt() ->> 'sub');
drop policy if exists "Users remove their own reposts" on public.post_reposts;
create policy "Users remove their own reposts"
  on public.post_reposts for delete to authenticated
  using (user_id = auth.jwt() ->> 'sub');

-- ── Member safety and privacy controls ────────────────────────────────
alter table public.profiles
  add column if not exists who_can_mention text not null default 'everyone'
    check (who_can_mention in ('everyone', 'following', 'nobody'));

create table if not exists public.member_blocks (
  blocker_id text not null references public.profiles(id) on delete cascade,
  blocked_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table if not exists public.member_mutes (
  muter_id text not null references public.profiles(id) on delete cascade,
  muted_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
alter table public.member_blocks enable row level security;
alter table public.member_mutes enable row level security;
drop policy if exists "Members manage their own blocks" on public.member_blocks;
create policy "Members manage their own blocks"
  on public.member_blocks for all to authenticated
  using (blocker_id = auth.jwt() ->> 'sub')
  with check (blocker_id = auth.jwt() ->> 'sub');
drop policy if exists "Members manage their own mutes" on public.member_mutes;
create policy "Members manage their own mutes"
  on public.member_mutes for all to authenticated
  using (muter_id = auth.jwt() ->> 'sub')
  with check (muter_id = auth.jwt() ->> 'sub');

create or replace function public.arrai_members_are_blocked(
  p_first text,
  p_second text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_first = auth.jwt() ->> 'sub' or p_second = auth.jwt() ->> 'sub')
    and exists (
      select 1 from public.member_blocks b
      where (b.blocker_id = p_first and b.blocked_id = p_second)
         or (b.blocker_id = p_second and b.blocked_id = p_first)
    );
$$;

create or replace function public.arrai_member_blocked_ids()
returns table(member_id text)
language sql
stable
security definer
set search_path = public
as $$
  select b.blocked_id from public.member_blocks b
  where b.blocker_id = auth.jwt() ->> 'sub'
  union
  select b.blocker_id from public.member_blocks b
  where b.blocked_id = auth.jwt() ->> 'sub';
$$;

-- ── Communities, roles, channels and discussion ───────────────────────
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  visibility text not null default 'public'
    check (visibility in ('public', 'private', 'invite_only')),
  created_by text not null references public.profiles(id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_memberships (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'moderator', 'member')),
  status text not null default 'active'
    check (status in ('active', 'muted', 'banned')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_memberships_user_idx
  on public.community_memberships(user_id, joined_at desc);

create table if not exists public.community_channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9][a-z0-9_-]{1,47}$'),
  description text not null default '' check (char_length(description) <= 240),
  channel_type text not null default 'text'
    check (channel_type in ('announcement', 'text', 'discussion', 'media', 'forum', 'event', 'voice')),
  visibility text not null default 'community'
    check (visibility in ('community', 'private')),
  replies_enabled boolean not null default true,
  slow_mode_seconds integer not null default 0
    check (slow_mode_seconds between 0 and 3600),
  created_by text not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (community_id, name)
);
create index if not exists community_channels_community_idx
  on public.community_channels(community_id, created_at);

create table if not exists public.community_channel_members (
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  granted_by text not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table if not exists public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  author_id text not null references public.profiles(id) on delete cascade,
  reply_to uuid references public.channel_messages(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists channel_messages_channel_created_idx
  on public.channel_messages(channel_id, created_at desc);
create index if not exists channel_messages_reply_idx
  on public.channel_messages(reply_to, created_at) where reply_to is not null;

create table if not exists public.channel_message_reactions (
  message_id uuid not null references public.channel_messages(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '👍', '😂', '🎉', '✨', '👀')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.community_channel_pins (
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  message_id uuid not null references public.channel_messages(id) on delete cascade,
  pinned_by text not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (channel_id, message_id)
);

create or replace function public.arrai_community_has_permission(
  p_community uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when m.status = 'banned' then false
      when m.status = 'muted' then p_permission = 'view_channel'
      when m.role in ('owner', 'admin') then true
      when m.role = 'moderator' then p_permission in (
        'view_channel', 'send_messages', 'create_post', 'reply',
        'upload_media', 'manage_messages', 'manage_channels',
        'manage_members', 'mute_members'
      )
      when m.role = 'member' then p_permission in (
        'view_channel', 'send_messages', 'create_post', 'reply', 'upload_media'
      )
      else false
    end
    from public.community_memberships m
    where m.community_id = p_community
      and m.user_id = auth.jwt() ->> 'sub'
  ), false);
$$;

create or replace function public.arrai_community_can_view_channel(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_channels c
    where c.id = p_channel
      and public.arrai_community_has_permission(c.community_id, 'view_channel')
      and (
        c.visibility = 'community'
        or exists (
          select 1 from public.community_channel_members cm
          where cm.channel_id = c.id
            and cm.user_id = auth.jwt() ->> 'sub'
        )
      )
  );
$$;

create or replace function public.arrai_community_create(
  p_name text,
  p_slug text,
  p_description text default ''
)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := auth.jwt() ->> 'sub';
  v_community public.communities;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 80
     or coalesce(p_slug, '') !~ '^[a-z0-9][a-z0-9-]{2,39}$'
     or length(coalesce(p_description, '')) > 500 then
    raise exception 'COMMUNITY_INVALID_INPUT';
  end if;

  insert into public.communities (name, slug, description, created_by)
  values (trim(p_name), p_slug, coalesce(p_description, ''), v_user)
  returning * into v_community;

  insert into public.community_memberships (community_id, user_id, role)
  values (v_community.id, v_user, 'owner');

  insert into public.community_channels (
    community_id, name, description, channel_type, created_by
  ) values (
    v_community.id, 'general', 'The community’s shared conversation.',
    'text', v_user
  );
  return v_community;
end;
$$;

create or replace function public.arrai_community_join(p_community uuid)
returns public.community_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := auth.jwt() ->> 'sub';
  v_visibility text;
  v_membership public.community_memberships;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select visibility into v_visibility from public.communities
  where id = p_community and archived_at is null;
  if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
  if v_visibility <> 'public' then raise exception 'COMMUNITY_INVITE_REQUIRED'; end if;

  insert into public.community_memberships (community_id, user_id)
  values (p_community, v_user)
  on conflict (community_id, user_id) do nothing;
  select * into v_membership from public.community_memberships
  where community_id = p_community and user_id = v_user;
  if v_membership.status = 'banned' then raise exception 'COMMUNITY_MEMBER_BANNED'; end if;
  return v_membership;
end;
$$;

create or replace function public.arrai_community_leave(p_community uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := auth.jwt() ->> 'sub';
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists (
    select 1 from public.community_memberships
    where community_id = p_community and user_id = v_user and role = 'owner'
  ) then raise exception 'COMMUNITY_OWNER_CANNOT_LEAVE'; end if;
  delete from public.community_memberships
  where community_id = p_community and user_id = v_user;
  return found;
end;
$$;

create or replace function public.arrai_community_create_channel(
  p_community uuid,
  p_name text,
  p_channel_type text default 'text',
  p_visibility text default 'community',
  p_description text default '',
  p_slow_mode_seconds integer default 0,
  p_replies_enabled boolean default true
)
returns public.community_channels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := auth.jwt() ->> 'sub';
  v_channel public.community_channels;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.arrai_community_has_permission(p_community, 'manage_channels') then
    raise exception 'COMMUNITY_PERMISSION_DENIED';
  end if;
  if coalesce(p_name, '') !~ '^[a-z0-9][a-z0-9_-]{1,47}$'
     or p_channel_type not in ('announcement', 'text', 'discussion', 'media', 'forum', 'event', 'voice')
     or p_visibility not in ('community', 'private')
     or coalesce(p_slow_mode_seconds, 0) not between 0 and 3600
     or length(coalesce(p_description, '')) > 240 then
    raise exception 'CHANNEL_INVALID_INPUT';
  end if;

  insert into public.community_channels (
    community_id, name, channel_type, visibility, description,
    slow_mode_seconds, replies_enabled, created_by
  ) values (
    p_community, p_name, p_channel_type, p_visibility,
    coalesce(p_description, ''), coalesce(p_slow_mode_seconds, 0),
    coalesce(p_replies_enabled, true), v_user
  )
  returning * into v_channel;

  if p_visibility = 'private' then
    insert into public.community_channel_members (channel_id, user_id, granted_by)
    values (v_channel.id, v_user, v_user);
  end if;
  return v_channel;
end;
$$;

create or replace function public.arrai_community_send_message(
  p_channel uuid,
  p_body text,
  p_reply_to uuid default null
)
returns public.channel_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := auth.jwt() ->> 'sub';
  v_channel public.community_channels;
  v_last_message timestamptz;
  v_message public.channel_messages;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.arrai_community_can_view_channel(p_channel)
     or not public.arrai_community_has_permission(
       (select community_id from public.community_channels where id = p_channel),
       'send_messages'
     ) then
    raise exception 'COMMUNITY_PERMISSION_DENIED';
  end if;

  select * into v_channel from public.community_channels
  where id = p_channel;
  if v_channel.channel_type = 'announcement'
     and not public.arrai_community_has_permission(v_channel.community_id, 'manage_messages') then
    raise exception 'ANNOUNCEMENT_CHANNEL_READ_ONLY';
  end if;
  if length(trim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'MESSAGE_INVALID_INPUT';
  end if;
  if p_reply_to is not null then
    if not v_channel.replies_enabled then raise exception 'CHANNEL_REPLIES_DISABLED'; end if;
    if not exists (
      select 1 from public.channel_messages
      where id = p_reply_to and channel_id = p_channel and deleted_at is null
    ) then raise exception 'MESSAGE_REPLY_NOT_FOUND'; end if;
  end if;

  if v_channel.slow_mode_seconds > 0 then
    select max(created_at) into v_last_message
    from public.channel_messages
    where channel_id = p_channel and author_id = v_user and deleted_at is null;
    if v_last_message is not null
       and v_last_message + make_interval(secs => v_channel.slow_mode_seconds) > now() then
      raise exception 'CHANNEL_SLOW_MODE';
    end if;
  end if;

  insert into public.channel_messages (channel_id, author_id, body, reply_to)
  values (p_channel, v_user, trim(p_body), p_reply_to)
  returning * into v_message;
  return v_message;
end;
$$;

alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_channels enable row level security;
alter table public.community_channel_members enable row level security;
alter table public.channel_messages enable row level security;
alter table public.channel_message_reactions enable row level security;
alter table public.community_channel_pins enable row level security;

drop policy if exists "Communities are discoverable by visibility" on public.communities;
create policy "Communities are discoverable by visibility"
  on public.communities for select to authenticated
  using (
    archived_at is null
    and (
      visibility = 'public'
      or exists (
        select 1 from public.community_memberships m
        where m.community_id = id and m.user_id = auth.jwt() ->> 'sub'
      )
    )
  );
drop policy if exists "Members view community memberships" on public.community_memberships;
create policy "Members view community memberships"
  on public.community_memberships for select to authenticated
  using (
    user_id = auth.jwt() ->> 'sub'
    or public.arrai_community_has_permission(community_id, 'manage_members')
  );
drop policy if exists "Members view permitted channels" on public.community_channels;
create policy "Members view permitted channels"
  on public.community_channels for select to authenticated
  using (public.arrai_community_can_view_channel(id));
drop policy if exists "Members manage private channel access" on public.community_channel_members;
create policy "Members manage private channel access"
  on public.community_channel_members for select to authenticated
  using (
    user_id = auth.jwt() ->> 'sub'
    or public.arrai_community_has_permission(
      (select community_id from public.community_channels c where c.id = channel_id),
      'manage_channels'
    )
  );
drop policy if exists "Members read permitted channel messages" on public.channel_messages;
create policy "Members read permitted channel messages"
  on public.channel_messages for select to authenticated
  using (
    public.arrai_community_can_view_channel(channel_id)
    and deleted_at is null
  );
drop policy if exists "Authors edit their permitted channel messages" on public.channel_messages;
create policy "Authors edit their permitted channel messages"
  on public.channel_messages for update to authenticated
  using (
    author_id = auth.jwt() ->> 'sub'
    and public.arrai_community_can_view_channel(channel_id)
  )
  with check (
    author_id = auth.jwt() ->> 'sub'
    and public.arrai_community_can_view_channel(channel_id)
  );
drop policy if exists "Members view channel reactions" on public.channel_message_reactions;
create policy "Members view channel reactions"
  on public.channel_message_reactions for select to authenticated
  using (
    exists (
      select 1 from public.channel_messages m
      where m.id = message_id and public.arrai_community_can_view_channel(m.channel_id)
    )
  );
drop policy if exists "Members react in permitted channels" on public.channel_message_reactions;
create policy "Members react in permitted channels"
  on public.channel_message_reactions for insert to authenticated
  with check (
    user_id = auth.jwt() ->> 'sub'
    and exists (
      select 1 from public.channel_messages m
      where m.id = message_id
        and public.arrai_community_can_view_channel(m.channel_id)
        and public.arrai_community_has_permission(
          (select c.community_id from public.community_channels c where c.id = m.channel_id),
          'reply'
        )
    )
  );
drop policy if exists "Members remove their channel reactions" on public.channel_message_reactions;
create policy "Members remove their channel reactions"
  on public.channel_message_reactions for delete to authenticated
  using (user_id = auth.jwt() ->> 'sub');
drop policy if exists "Members read channel pins" on public.community_channel_pins;
create policy "Members read channel pins"
  on public.community_channel_pins for select to authenticated
  using (public.arrai_community_can_view_channel(channel_id));
drop policy if exists "Moderators manage channel pins" on public.community_channel_pins;
create policy "Moderators manage channel pins"
  on public.community_channel_pins for all to authenticated
  using (
    public.arrai_community_has_permission(
      (select community_id from public.community_channels c where c.id = channel_id),
      'manage_messages'
    )
  )
  with check (
    pinned_by = auth.jwt() ->> 'sub'
    and public.arrai_community_has_permission(
      (select community_id from public.community_channels c where c.id = channel_id),
      'manage_messages'
    )
  );

revoke all on function public.arrai_community_has_permission(uuid, text) from public, anon;
revoke all on function public.arrai_community_can_view_channel(uuid) from public, anon;
revoke all on function public.arrai_members_are_blocked(text, text) from public, anon;
revoke all on function public.arrai_member_blocked_ids() from public, anon;
revoke all on function public.arrai_community_create(text, text, text) from public, anon;
revoke all on function public.arrai_community_join(uuid) from public, anon;
revoke all on function public.arrai_community_leave(uuid) from public, anon;
revoke all on function public.arrai_community_create_channel(uuid, text, text, text, text, integer, boolean) from public, anon;
revoke all on function public.arrai_community_send_message(uuid, text, uuid) from public, anon;
grant execute on function public.arrai_community_has_permission(uuid, text) to authenticated;
grant execute on function public.arrai_community_can_view_channel(uuid) to authenticated;
grant execute on function public.arrai_members_are_blocked(text, text) to authenticated;
grant execute on function public.arrai_member_blocked_ids() to authenticated;
grant execute on function public.arrai_community_create(text, text, text) to authenticated;
grant execute on function public.arrai_community_join(uuid) to authenticated;
grant execute on function public.arrai_community_leave(uuid) to authenticated;
grant execute on function public.arrai_community_create_channel(uuid, text, text, text, text, integer, boolean) to authenticated;
grant execute on function public.arrai_community_send_message(uuid, text, uuid) to authenticated;

-- Keep existing follow/DM entry points, but enforce account privacy and blocks
-- in RLS so the browser cannot bypass these controls.
drop policy if exists "Users follow from their own account" on public.follows;
create policy "Users follow permitted accounts"
  on public.follows for insert to authenticated
  with check (
    follower_id = auth.jwt() ->> 'sub'
    and not public.arrai_members_are_blocked(follower_id, following_id)
    and exists (
      select 1 from public.profiles p
      where p.id = following_id
        and p.privacy = 'public'
        and p.who_can_follow = 'everyone'
    )
  );

drop policy if exists "Users send their own DMs" on public.direct_messages;
create policy "Users send permitted DMs"
  on public.direct_messages for insert to authenticated
  with check (
    sender_id = auth.jwt() ->> 'sub'
    and sender_id <> recipient_id
    and not public.arrai_members_are_blocked(sender_id, recipient_id)
    and exists (
      select 1 from public.profiles recipient
      where recipient.id = recipient_id
        and (
          recipient.who_can_message = 'everyone'
          or (
            recipient.who_can_message = 'followers'
            and exists (
              select 1 from public.follows f
              where f.follower_id = sender_id
                and f.following_id = recipient_id
            )
          )
        )
    )
  );

drop policy if exists "Participants read their DMs" on public.direct_messages;
create policy "Unblocked participants read their DMs"
  on public.direct_messages for select to authenticated
  using (
    (sender_id = auth.jwt() ->> 'sub' or recipient_id = auth.jwt() ->> 'sub')
    and not public.arrai_members_are_blocked(sender_id, recipient_id)
  );
drop policy if exists "Call participants read signals" on public.call_signals;
create policy "Unblocked call participants read signals"
  on public.call_signals for select to authenticated
  using (
    (sender_id = auth.jwt() ->> 'sub' or recipient_id = auth.jwt() ->> 'sub')
    and not public.arrai_members_are_blocked(sender_id, recipient_id)
  );
drop policy if exists "Users send their own call signals" on public.call_signals;
create policy "Users send unblocked call signals"
  on public.call_signals for insert to authenticated
  with check (
    sender_id = auth.jwt() ->> 'sub'
    and sender_id <> recipient_id
    and not public.arrai_members_are_blocked(sender_id, recipient_id)
  );

-- Enforce private-profile visibility and blocks at the database boundary, not
-- only in the feed's client-side filters.
drop policy if exists "Posts are visible to signed-in users" on public.posts;
drop policy if exists "Visible posts respect profile privacy" on public.posts;
drop policy if exists "Public posts are visible to everyone" on public.posts;
create policy "Public posts are visible to everyone"
  on public.posts for select to anon
  using (
    exists (
      select 1 from public.profiles p
      where p.id = posts.author_id and p.privacy = 'public'
    )
  );
create policy "Visible posts respect profile privacy"
  on public.posts for select to authenticated
  using (
    not public.arrai_members_are_blocked(auth.jwt() ->> 'sub', posts.author_id)
    and (
      posts.author_id = auth.jwt() ->> 'sub'
      or exists (
        select 1 from public.profiles p
        where p.id = posts.author_id and p.privacy = 'public'
      )
      or exists (
        select 1 from public.follows f
        where f.follower_id = auth.jwt() ->> 'sub'
          and f.following_id = posts.author_id
      )
    )
  );

drop policy if exists "Comments are visible to signed-in users" on public.comments;
create policy "Comments follow post visibility"
  on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = comments.post_id));
drop policy if exists "Users create their own comments" on public.comments;
create policy "Users comment on visible posts"
  on public.comments for insert to authenticated
  with check (
    author_id = auth.jwt() ->> 'sub'
    and exists (select 1 from public.posts p where p.id = comments.post_id)
  );
drop policy if exists "Post authors remove comments" on public.comments;
create policy "Post authors remove comments"
  on public.comments for delete to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and p.author_id = auth.jwt() ->> 'sub'
    )
  );

drop policy if exists "Reactions are visible to signed-in users" on public.post_reactions;
create policy "Reactions follow post visibility"
  on public.post_reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_reactions.post_id));
drop policy if exists "Users add their own reactions" on public.post_reactions;
create policy "Users react to visible posts"
  on public.post_reactions for insert to authenticated
  with check (
    user_id = auth.jwt() ->> 'sub'
    and exists (select 1 from public.posts p where p.id = post_reactions.post_id)
  );

drop policy if exists "Users manage their own post bookmarks" on public.post_bookmarks;
create policy "Users bookmark visible posts"
  on public.post_bookmarks for all to authenticated
  using (user_id = auth.jwt() ->> 'sub')
  with check (
    user_id = auth.jwt() ->> 'sub'
    and exists (select 1 from public.posts p where p.id = post_bookmarks.post_id)
  );
drop policy if exists "Reposts are visible to signed-in users" on public.post_reposts;
create policy "Reposts follow post visibility"
  on public.post_reposts for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_reposts.post_id));
drop policy if exists "Users manage their own reposts" on public.post_reposts;
create policy "Users repost visible posts"
  on public.post_reposts for insert to authenticated
  with check (
    user_id = auth.jwt() ->> 'sub'
    and exists (select 1 from public.posts p where p.id = post_reposts.post_id)
  );

-- ── Reports and in-app notifications ──────────────────────────────────
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text not null references public.profiles(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  target_type text not null
    check (target_type in ('post', 'comment', 'message', 'community', 'channel', 'user')),
  target_id text not null check (char_length(target_id) between 1 and 100),
  reason text not null
    check (reason in ('spam', 'harassment', 'scam', 'impersonation', 'illegal', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by text references public.profiles(id) on delete set null,
  resolution_note text not null default '' check (char_length(resolution_note) <= 500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists community_reports_queue_idx
  on public.community_reports(status, created_at);
alter table public.community_reports enable row level security;
drop policy if exists "Members create their own reports" on public.community_reports;
create policy "Members create their own reports"
  on public.community_reports for insert to authenticated
  with check (
    reporter_id = auth.jwt() ->> 'sub'
    and status = 'open'
    and reviewed_by is null
  );
drop policy if exists "Reporters and moderators view reports" on public.community_reports;
create policy "Reporters and moderators view reports"
  on public.community_reports for select to authenticated
  using (
    reporter_id = auth.jwt() ->> 'sub'
    or (community_id is not null
      and public.arrai_community_has_permission(community_id, 'manage_messages'))
    or exists (
      select 1 from public.profiles p
      where p.id = auth.jwt() ->> 'sub'
        and p.community_role in ('moderator', 'admin', 'owner')
    )
  );
drop policy if exists "Moderators resolve reports" on public.community_reports;
create policy "Moderators resolve reports"
  on public.community_reports for update to authenticated
  using (
    (community_id is not null
      and public.arrai_community_has_permission(community_id, 'manage_messages'))
    or exists (
      select 1 from public.profiles p
      where p.id = auth.jwt() ->> 'sub'
        and p.community_role in ('moderator', 'admin', 'owner')
    )
  )
  with check (
    reviewed_by = auth.jwt() ->> 'sub'
    and status in ('reviewing', 'resolved', 'dismissed')
    and (
      (community_id is not null
        and public.arrai_community_has_permission(community_id, 'manage_messages'))
      or exists (
        select 1 from public.profiles p
        where p.id = auth.jwt() ->> 'sub'
          and p.community_role in ('moderator', 'admin', 'owner')
      )
    )
  );

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  actor_id text references public.profiles(id) on delete set null,
  kind text not null check (kind in (
    'like', 'reaction', 'reply', 'mention', 'repost', 'follow', 'message',
    'community_invite', 'announcement', 'event', 'moderation'
  )),
  object_type text not null default '',
  object_id text not null default '',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_notifications_inbox_idx
  on public.user_notifications(user_id, created_at desc);
alter table public.user_notifications enable row level security;
drop policy if exists "Members read their notifications" on public.user_notifications;
create policy "Members read their notifications"
  on public.user_notifications for select to authenticated
  using (user_id = auth.jwt() ->> 'sub');
drop policy if exists "Members mark their notifications read" on public.user_notifications;
create policy "Members mark their notifications read"
  on public.user_notifications for update to authenticated
  using (user_id = auth.jwt() ->> 'sub')
  with check (user_id = auth.jwt() ->> 'sub');
revoke insert, delete on public.user_notifications from anon, authenticated;

create or replace function public.arrai_notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner text;
begin
  select author_id into v_owner from public.posts where id = new.post_id;
  if v_owner is not null and v_owner <> new.author_id
     and not exists (
       select 1 from public.member_mutes
       where muter_id = v_owner and muted_id = new.author_id
     ) then
    insert into public.user_notifications (
      user_id, actor_id, kind, object_type, object_id, payload
    ) values (
      v_owner, new.author_id, 'reply', 'post', new.post_id::text,
      jsonb_build_object('comment_id', new.id)
    );
  end if;
  return new;
end;
$$;
drop trigger if exists arrai_post_comment_notification on public.comments;
create trigger arrai_post_comment_notification
  after insert on public.comments
  for each row execute function public.arrai_notify_post_comment();

create or replace function public.arrai_notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_notifications (
    user_id, actor_id, kind, object_type, object_id
  )
  select new.following_id, new.follower_id, 'follow', 'profile', new.follower_id
  where not exists (
    select 1 from public.member_mutes
    where muter_id = new.following_id and muted_id = new.follower_id
  );
  return new;
end;
$$;
drop trigger if exists arrai_follow_notification on public.follows;
create trigger arrai_follow_notification
  after insert on public.follows
  for each row execute function public.arrai_notify_follow();

-- ── Events, polls and expiring stories: persistence groundwork ────────
create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid references public.community_channels(id) on delete set null,
  host_id text not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'UTC' check (char_length(timezone) <= 80),
  location text not null default '' check (char_length(location) <= 240),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create table if not exists public.community_event_responses (
  event_id uuid not null references public.community_events(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  response text not null check (response in ('interested', 'going', 'not_going')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists community_events_upcoming_idx
  on public.community_events(community_id, starts_at);

create table if not exists public.community_polls (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) on delete cascade,
  channel_id uuid references public.community_channels(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  created_by text not null references public.profiles(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 2 and 300),
  allow_multiple boolean not null default false,
  anonymous boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(community_id, channel_id, post_id) = 1)
);
create table if not exists public.community_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.community_polls(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 160),
  position smallint not null check (position between 0 and 19),
  unique (poll_id, position)
);
create table if not exists public.community_poll_votes (
  poll_id uuid not null references public.community_polls(id) on delete cascade,
  option_id uuid not null references public.community_poll_options(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);
create index if not exists community_poll_options_poll_idx
  on public.community_poll_options(poll_id, position);

create table if not exists public.user_stories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  media_url text not null check (char_length(media_url) <= 2048),
  media_type text not null check (media_type in ('image', 'video', 'text')),
  caption text not null default '' check (char_length(caption) <= 500),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '7 days')
);
create index if not exists user_stories_active_idx
  on public.user_stories(expires_at desc);

alter table public.community_events enable row level security;
alter table public.community_event_responses enable row level security;
alter table public.community_polls enable row level security;
alter table public.community_poll_options enable row level security;
alter table public.community_poll_votes enable row level security;
alter table public.user_stories enable row level security;

drop policy if exists "Members view community events" on public.community_events;
create policy "Members view community events"
  on public.community_events for select to authenticated
  using (public.arrai_community_has_permission(community_id, 'view_channel'));
drop policy if exists "Members respond to community events" on public.community_event_responses;
create policy "Members respond to community events"
  on public.community_event_responses for all to authenticated
  using (
    user_id = auth.jwt() ->> 'sub'
    and exists (
      select 1 from public.community_events e
      where e.id = event_id
        and public.arrai_community_has_permission(e.community_id, 'view_channel')
    )
  )
  with check (
    user_id = auth.jwt() ->> 'sub'
    and exists (
      select 1 from public.community_events e
      where e.id = event_id
        and public.arrai_community_has_permission(e.community_id, 'view_channel')
    )
  );
drop policy if exists "Members read permitted polls" on public.community_polls;
create policy "Members read permitted polls"
  on public.community_polls for select to authenticated
  using (
    (community_id is not null and public.arrai_community_has_permission(community_id, 'view_channel'))
    or (channel_id is not null and public.arrai_community_can_view_channel(channel_id))
    or (post_id is not null and exists (select 1 from public.posts p where p.id = post_id))
  );
drop policy if exists "Members read permitted poll options" on public.community_poll_options;
create policy "Members read permitted poll options"
  on public.community_poll_options for select to authenticated
  using (exists (
    select 1 from public.community_polls p where p.id = poll_id
      and (
        (p.community_id is not null and public.arrai_community_has_permission(p.community_id, 'view_channel'))
        or (p.channel_id is not null and public.arrai_community_can_view_channel(p.channel_id))
        or (p.post_id is not null and exists (select 1 from public.posts post where post.id = p.post_id))
      )
  ));
drop policy if exists "Members vote in permitted polls" on public.community_poll_votes;
create policy "Members vote in permitted polls"
  on public.community_poll_votes for all to authenticated
  using (user_id = auth.jwt() ->> 'sub')
  with check (
    user_id = auth.jwt() ->> 'sub'
    and exists (
      select 1 from public.community_polls p
      where p.id = poll_id
        and (p.expires_at is null or p.expires_at > now())
        and (
          (p.community_id is not null and public.arrai_community_has_permission(p.community_id, 'reply'))
          or (p.channel_id is not null and public.arrai_community_can_view_channel(p.channel_id))
          or (p.post_id is not null and exists (select 1 from public.posts post where post.id = p.post_id))
        )
        and exists (
          select 1 from public.community_poll_options o
          where o.id = option_id and o.poll_id = p.id
        )
    )
  );
drop policy if exists "Members view unexpired stories" on public.user_stories;
create policy "Members view unexpired stories"
  on public.user_stories for select to authenticated
  using (
    expires_at > now()
    and not public.arrai_members_are_blocked(auth.jwt() ->> 'sub', user_id)
  );
drop policy if exists "Members manage their own stories" on public.user_stories;
create policy "Members manage their own stories"
  on public.user_stories for all to authenticated
  using (user_id = auth.jwt() ->> 'sub')
  with check (user_id = auth.jwt() ->> 'sub' and expires_at > now());

-- Keep broadcasts narrow and make repeated migration runs safe.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'channel_messages'
  ) then
    alter publication supabase_realtime add table public.channel_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end;
$$;

comment on table public.direct_messages is
  'Current private messages are plaintext at rest and are NOT end-to-end encrypted. Do not advertise E2EE until a vetted protocol is integrated.';
comment on table public.user_stories is
  'Story visibility is time-bounded by expires_at; storage cleanup must remove expired media as a separate scheduled provider task.';
