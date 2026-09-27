create extension if not exists pgcrypto;

create sequence if not exists public.detective_case_number_seq;

create table if not exists public.detective_member_applications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null,
  phone text not null check (char_length(trim(phone)) between 5 and 32),
  country text not null check (char_length(trim(country)) between 2 and 100),
  state text not null default '',
  city text not null default '',
  languages text[] not null default '{}',
  years_experience smallint not null check (years_experience between 0 and 60),
  specialties text[] not null default '{}',
  qualifications text not null default '' check (char_length(qualifications) <= 1200),
  license_details text not null default '' check (char_length(license_details) <= 400),
  profile_photo_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  member_id_hash text unique,
  member_id_suffix text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check ((status in ('approved', 'suspended')) = (member_id_hash is not null))
);

create table if not exists public.detective_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique default (
    'DTA-' || to_char(timezone('utc', now()), 'YYYY') || '-' || lpad(nextval('public.detective_case_number_seq')::text, 7, '0')
  ),
  request_type text not null check (request_type in ('Private investigation enquiry', 'General agency enquiry')),
  client_name text not null check (char_length(trim(client_name)) between 2 and 120),
  client_email text not null check (char_length(client_email) between 5 and 254),
  client_type text not null check (char_length(trim(client_type)) between 2 and 100),
  student_status text not null default '' check (student_status in ('', 'adult', 'minor_guardian')),
  matter_category text not null check (char_length(trim(matter_category)) between 2 and 120),
  service_name text not null check (char_length(trim(service_name)) between 2 and 160),
  organization text not null default '' check (char_length(organization) <= 160),
  professional_role text not null default '' check (char_length(professional_role) <= 120),
  case_reference text not null default '' check (char_length(case_reference) <= 80),
  authorized_to_enquire boolean not null default false,
  country text not null default '' check (char_length(country) <= 100),
  state text not null default '' check (char_length(state) <= 100),
  district text not null default '' check (char_length(district) <= 100),
  city text not null default '' check (char_length(city) <= 100),
  area text not null default '' check (char_length(area) <= 100),
  postal_code text not null default '' check (char_length(postal_code) <= 24),
  police_station text not null default '' check (char_length(police_station) <= 140),
  timing text not null check (timing in ('Routine', 'Time-sensitive')),
  non_sensitive_summary text not null check (char_length(trim(non_sensitive_summary)) between 10 and 2000),
  agreement_version text not null,
  agreement_accepted_name text not null,
  agreement_accepted_at timestamptz not null,
  assigned_member_id uuid references public.detective_member_applications(user_id) on delete set null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'assigned', 'in_progress', 'closed', 'declined')),
  pdf_object_path text,
  download_token_hash text,
  ip_rate_hash text not null,
  email_rate_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.keep_detective_case_number_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.case_number is distinct from old.case_number then
    raise exception 'Case numbers are permanent and cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists detective_case_number_immutable on public.detective_cases;
create trigger detective_case_number_immutable
before update on public.detective_cases
for each row execute function public.keep_detective_case_number_immutable();

create index if not exists detective_cases_assigned_member_idx on public.detective_cases(assigned_member_id, created_at desc);
create index if not exists detective_cases_created_at_idx on public.detective_cases(created_at desc);

create table if not exists public.detective_intake_limits (
  identifier_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0)
);

create or replace function public.consume_detective_intake_limits(p_ip_hash text, p_email_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service access required';
  end if;
  foreach v_hash in array array[p_ip_hash, p_email_hash]
  loop
    insert into public.detective_intake_limits as current_limit (identifier_hash, window_started_at, request_count)
    values (v_hash, now(), 1)
    on conflict (identifier_hash) do update
      set request_count = case
            when current_limit.window_started_at < now() - interval '15 minutes' then 1
            else current_limit.request_count + 1
          end,
          window_started_at = case
            when current_limit.window_started_at < now() - interval '15 minutes' then now()
            else current_limit.window_started_at
          end
    returning request_count into v_count;
    if v_count > 5 then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.consume_detective_intake_limits(text, text) from public, anon, authenticated;
grant execute on function public.consume_detective_intake_limits(text, text) to service_role;

alter table public.detective_member_applications enable row level security;
alter table public.detective_cases enable row level security;
alter table public.detective_intake_limits enable row level security;

revoke all on public.detective_member_applications from anon, authenticated;
revoke all on public.detective_cases from anon, authenticated;
revoke all on public.detective_intake_limits from anon, authenticated;
grant all on public.detective_member_applications to service_role;
grant all on public.detective_cases to service_role;
grant all on public.detective_intake_limits to service_role;
grant usage, select on sequence public.detective_case_number_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('detective-private', 'detective-private', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;