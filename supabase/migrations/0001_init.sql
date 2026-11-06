create type role_t as enum ('lekhpal','kanungo','tehsildar','admin');
create type case_type_t as enum ('sale','inheritance');
create type stage_t as enum ('step1_intake','step2_field','step3_review','step4_decision');
create type outcome_t as enum ('approved','rejected');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null, name_hi text,
  role role_t not null,
  tehsil text not null
);

create table land_records (
  id uuid primary key default gen_random_uuid(),
  village text not null, khata_no text not null, gata_no text not null,
  area_sqm numeric not null,
  owner_name text not null,
  tehsil text not null
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  ref_no text unique not null,
  case_type case_type_t not null,
  tehsil text not null, village text not null,
  applicant_name text not null,
  transferor_name text not null,
  land_record_id uuid references land_records,
  claimed_gata_no text, claimed_area_sqm numeric,
  stage stage_t not null default 'step1_intake',
  outcome outcome_t,
  return_count int not null default 0,
  submitted_at timestamptz not null default now(),
  sla_days int not null default 45,
  assigned_to uuid references profiles,
  flags_summary jsonb default '[]'::jsonb,
  decided_at timestamptz
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  doc_type text not null,
  file_path text,
  extracted_text text
);

create table step_data (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  stage stage_t not null,
  data jsonb not null,
  saved_by uuid references profiles,
  saved_at timestamptz default now(),
  unique (application_id, stage)
);

create table ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  stage stage_t not null,
  kind text not null,
  output jsonb not null,
  used_fallback boolean default false,
  latency_ms int,
  status text not null default 'shown',
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table application_events (
  id bigserial primary key,
  application_id uuid references applications on delete cascade,
  at timestamptz default now(),
  actor uuid references profiles,
  actor_role role_t,
  action text not null,
  from_stage stage_t, to_stage stage_t,
  reason text,
  meta jsonb default '{}'::jsonb
);

create index on applications (tehsil, stage);
create index on application_events (application_id, at);

-- RLS: read scoped to own tehsil; writes only via service role (bypasses RLS).
create function my_tehsil() returns text language sql stable security definer
  set search_path = public as $$ select tehsil from profiles where id = auth.uid() $$;

alter table profiles enable row level security;
alter table land_records enable row level security;
alter table applications enable row level security;
alter table documents enable row level security;
alter table step_data enable row level security;
alter table ai_suggestions enable row level security;
alter table application_events enable row level security;

create policy p_profiles on profiles for select using (tehsil = my_tehsil());
create policy p_land on land_records for select using (tehsil = my_tehsil());
create policy p_apps on applications for select using (tehsil = my_tehsil());
create policy p_docs on documents for select using (
  application_id in (select id from applications where tehsil = my_tehsil()));
create policy p_steps on step_data for select using (
  application_id in (select id from applications where tehsil = my_tehsil()));
create policy p_ai on ai_suggestions for select using (
  application_id in (select id from applications where tehsil = my_tehsil()));
create policy p_events on application_events for select using (
  application_id in (select id from applications where tehsil = my_tehsil()));
-- application_events: no update/delete policy; also revoke for safety.
revoke update, delete on application_events from anon, authenticated;
