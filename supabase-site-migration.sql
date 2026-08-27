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

create table if not exists public.founder_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  description text,
  order_index int default 0,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.site_settings enable row level security;
alter table public.founder_cards enable row level security;

-- Policies: anyone can read, only owner (service_role) can write
create policy "Anyone can read site settings" on public.site_settings for select using (true);
create policy "Anyone can read founder cards" on public.founder_cards for select using (true);

-- Themes expanded list (logic for this will be in JS/CSS mostly)
-- We might want to store theme definitions in JSON if we want them fully dynamic, 
-- but usually CSS classes are better for performance.
