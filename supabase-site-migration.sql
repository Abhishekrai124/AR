-- Migration for site settings and additional cards
create table if not exists public.site_settings (
  id text primary key default 'global',
  hero_image_url text default 'assets/founder.jpg',
  global_theme text default 'midnight',
  site_name text default 'arrai.in',
  site_description text default 'Digital experiences by Abhishek Rai.',
  updated_at timestamptz default now()
);

-- Insert default settings if not exists
insert into public.site_settings (id) values ('global') on conflict (id) do nothing;
alter table public.site_settings add column if not exists hero_image_url text default 'assets/founder.jpg';
alter table public.site_settings add column if not exists global_theme text default 'midnight';
alter table public.site_settings add column if not exists site_name text default 'arrai.in';
alter table public.site_settings add column if not exists site_description text default 'Digital experiences by Abhishek Rai.';

create table if not exists public.founder_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  description text,
  order_index int default 0,
  created_at timestamptz default now()
);
alter table public.site_settings add column if not exists founder_name text default 'Abhishek Rai';
alter table public.site_settings add column if not exists founder_role text default 'Founder & CEO';
alter table public.site_settings add column if not exists founder_note text default 'A little prince building big digital dreams ✿';
alter table public.site_settings add column if not exists founder_tags text default 'AR · Parent Company\nRaiGenZ Foundation\nAR Tech Solutions';
alter table public.site_settings add column if not exists founder_links text default '';
alter table public.site_settings add column if not exists founder_profile_id uuid;
alter table public.site_settings add column if not exists founder_username text;
alter table public.site_settings add column if not exists show_personal_contact boolean not null default false;
alter table public.site_settings add column if not exists special_day_enabled boolean not null default false;
alter table public.site_settings add column if not exists special_day_start date;
alter table public.site_settings add column if not exists special_day_end date;
alter table public.site_settings add column if not exists special_day_name text default '';
alter table public.site_settings add column if not exists special_day_title text default '';
alter table public.site_settings add column if not exists special_day_message text default '';
alter table public.site_settings add column if not exists special_day_theme text default 'sakura';
alter table public.site_settings add column if not exists special_day_image_url text default '';
alter table public.site_settings add column if not exists special_day_role text default '';
alter table public.site_settings add column if not exists special_day_tags text default '';
alter table public.site_settings add column if not exists special_day_links text default '';
alter table public.site_settings add column if not exists special_day_intro_title text default '';
alter table public.site_settings add column if not exists special_day_intro_text text default '';
alter table public.site_settings add column if not exists special_day_cta_title text default '';

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  event_date date not null,
  start_time time not null,
  end_time time,
  location text not null default 'Online' check (char_length(location) <= 180),
  meeting_url text,
  created_at timestamptz not null default now()
);
alter table public.calendar_events enable row level security;
drop policy if exists "Anyone can read calendar events" on public.calendar_events;
create policy "Anyone can read calendar events" on public.calendar_events for select using (true);
alter table public.founder_cards add column if not exists tags text default '';
alter table public.founder_cards add column if not exists links text default '';
alter table public.founder_cards add column if not exists date_of_birth date;
alter table public.founder_cards add column if not exists profile_id uuid;

-- Enable RLS
alter table public.site_settings enable row level security;
alter table public.founder_cards enable row level security;

-- Policies: anyone can read, only owner (service_role) can write
create policy "Anyone can read site settings" on public.site_settings for select using (true);
create policy "Anyone can read founder cards" on public.founder_cards for select using (true);

-- Themes expanded list (logic for this will be in JS/CSS mostly)
-- We might want to store theme definitions in JSON if we want them fully dynamic, 
-- but usually CSS classes are better for performance.
