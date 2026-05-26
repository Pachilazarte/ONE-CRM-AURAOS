-- ============================================================
-- ONE CRM – Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────
create type user_role      as enum ('admin', 'vendedor');
create type contact_status as enum ('cold', 'warm', 'hot');
create type deal_stage     as enum (
  'nuevo', 'contactado', 'interesado',
  'propuesta', 'negociacion', 'ganado', 'perdido'
);
create type activity_type  as enum (
  'email_sent', 'email_received', 'call', 'meeting',
  'note', 'deal_stage_change', 'task_completed'
);
create type task_priority  as enum ('high', 'medium', 'low');

-- ────────────────────────────────────────────────────────────
-- USERS  (extends Supabase auth.users)
-- ────────────────────────────────────────────────────────────
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  auth_id       uuid unique references auth.users(id) on delete cascade,
  name          text        not null,
  email         text        not null unique,
  password_hash text,                        -- Argon2id, cost ≥ 12
  role          user_role   not null default 'vendedor',
  is_active     boolean     not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- CONTACTS
-- ────────────────────────────────────────────────────────────
create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  name          text          not null,
  email         text          not null,
  phone         text,
  company       text,
  position      text,
  source        text,                        -- e.g. 'instagram', 'linkedin'
  status        contact_status not null default 'cold',
  lead_score    smallint       not null default 0 check (lead_score between 0 and 100),
  notes         text,
  assigned_to   uuid references public.users(id) on delete set null,
  created_by    uuid references public.users(id) on delete set null,
  last_activity timestamptz    not null default now(),
  created_at    timestamptz    not null default now(),
  updated_at    timestamptz    not null default now(),
  unique(email, assigned_to)               -- same email can exist for different vendedores
);

-- ────────────────────────────────────────────────────────────
-- DEALS
-- ────────────────────────────────────────────────────────────
create table public.deals (
  id                 uuid primary key default gen_random_uuid(),
  contact_id         uuid not null references public.contacts(id) on delete cascade,
  assigned_to        uuid references public.users(id) on delete set null,
  title              text,
  amount             numeric(12, 2) not null default 0,
  currency           char(3)        not null default 'ARS',
  stage              deal_stage     not null default 'nuevo',
  probability        smallint       not null default 0 check (probability between 0 and 100),
  expected_close_date date,
  closed_at          timestamptz,
  notes              text,
  created_at         timestamptz    not null default now(),
  updated_at         timestamptz    not null default now()
);

-- ────────────────────────────────────────────────────────────
-- TASKS
-- ────────────────────────────────────────────────────────────
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text          not null,
  description text,
  contact_id  uuid references public.contacts(id) on delete set null,
  deal_id     uuid references public.deals(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  created_by  uuid references public.users(id) on delete set null,
  priority    task_priority not null default 'medium',
  due_date    date,
  completed   boolean       not null default false,
  completed_at timestamptz,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

-- ────────────────────────────────────────────────────────────
-- ACTIVITIES  (audit trail / timeline)
-- ────────────────────────────────────────────────────────────
create table public.activities (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id    uuid references public.deals(id) on delete set null,
  user_id    uuid references public.users(id) on delete set null,
  type       activity_type not null,
  content    text,
  metadata   jsonb,                         -- flexible: email subject, call duration, etc.
  occurred_at timestamptz  not null default now(),
  created_at  timestamptz  not null default now()
);

-- ────────────────────────────────────────────────────────────
-- EMAIL THREADS
-- ────────────────────────────────────────────────────────────
create table public.email_threads (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid references public.contacts(id) on delete cascade,
  assigned_to   uuid references public.users(id) on delete set null,
  subject       text    not null,
  direction     text    not null check (direction in ('in', 'out')),
  unread        boolean not null default true,
  last_message_at timestamptz not null default now(),
  created_at    timestamptz   not null default now()
);

create table public.email_messages (
  id        uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  from_addr text not null,
  to_addr   text not null,
  body      text not null,
  sent_at   timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- AUTOMATION RULES
-- ────────────────────────────────────────────────────────────
create table public.automation_rules (
  id            uuid primary key default gen_random_uuid(),
  name          text    not null,
  trigger_event text    not null,            -- e.g. 'contact.created', 'deal.stage_changed'
  conditions    jsonb   not null default '[]',
  actions       jsonb   not null default '[]',
  is_active     boolean not null default true,
  run_count     integer not null default 0,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- LEAD ROUTING CONFIG  (round-robin per team/role)
-- ────────────────────────────────────────────────────────────
create table public.routing_config (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.users(id) on delete cascade,
  is_available    boolean not null default true,
  last_assigned_at timestamptz,
  daily_cap       smallint,                  -- max new leads per day, null = unlimited
  created_at      timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- SCRAPER JOBS  (link raw extraction to CRM)
-- ────────────────────────────────────────────────────────────
create table public.scraper_jobs (
  id             uuid primary key default gen_random_uuid(),
  source_account text    not null,
  keyword        text,
  status         text    not null default 'pending' check (status in ('pending','running','done','error')),
  leads_found    integer not null default 0,
  leads_new      integer not null default 0,   -- after dedup
  started_at     timestamptz,
  finished_at    timestamptz,
  error_message  text,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
create index on public.contacts(assigned_to);
create index on public.contacts(status);
create index on public.contacts(email);
create index on public.contacts(created_at desc);
create index on public.deals(assigned_to);
create index on public.deals(stage);
create index on public.deals(contact_id);
create index on public.tasks(assigned_to);
create index on public.tasks(due_date);
create index on public.tasks(completed);
create index on public.activities(contact_id);
create index on public.activities(occurred_at desc);
create index on public.email_threads(assigned_to);
create index on public.email_threads(contact_id);

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER FUNCTION
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create trigger trg_deals_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger trg_automation_rules_updated_at
  before update on public.automation_rules
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (multi-tenancy)
-- ────────────────────────────────────────────────────────────
alter table public.users            enable row level security;
alter table public.contacts         enable row level security;
alter table public.deals            enable row level security;
alter table public.tasks            enable row level security;
alter table public.activities       enable row level security;
alter table public.email_threads    enable row level security;
alter table public.email_messages   enable row level security;
alter table public.automation_rules enable row level security;
alter table public.routing_config   enable row level security;
alter table public.scraper_jobs     enable row level security;

-- Helper: get the public.users row for the current auth session
create or replace function public.current_crm_user()
returns public.users language sql security definer stable as $$
  select * from public.users where auth_id = auth.uid() limit 1;
$$;

-- Helper: is current user an admin?
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select role = 'admin' from public.users where auth_id = auth.uid();
$$;

-- ── USERS ──
-- Admin sees all; vendedor sees only their own row
create policy "users_select" on public.users for select using (
  public.is_admin() or auth_id = auth.uid()
);
create policy "users_update_self" on public.users for update using (
  auth_id = auth.uid()
);
create policy "users_admin_all" on public.users for all using (
  public.is_admin()
);

-- ── CONTACTS ──
create policy "contacts_select" on public.contacts for select using (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);
create policy "contacts_insert" on public.contacts for insert with check (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);
create policy "contacts_update" on public.contacts for update using (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);
create policy "contacts_delete" on public.contacts for delete using (
  public.is_admin()
);

-- ── DEALS ──
create policy "deals_select" on public.deals for select using (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);
create policy "deals_insert" on public.deals for insert with check (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);
create policy "deals_update" on public.deals for update using (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);
create policy "deals_delete" on public.deals for delete using (
  public.is_admin()
);

-- ── TASKS ──
create policy "tasks_select" on public.tasks for select using (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);
create policy "tasks_insert" on public.tasks for insert with check (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);
create policy "tasks_update" on public.tasks for update using (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);
create policy "tasks_delete" on public.tasks for delete using (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);

-- ── ACTIVITIES ──
create policy "activities_select" on public.activities for select using (
  public.is_admin() or user_id = (select id from public.users where auth_id = auth.uid())
);
create policy "activities_insert" on public.activities for insert with check (true);

-- ── EMAIL THREADS ──
create policy "threads_select" on public.email_threads for select using (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);
create policy "threads_all_own" on public.email_threads for all using (
  public.is_admin() or assigned_to = (select id from public.users where auth_id = auth.uid())
);

-- ── EMAIL MESSAGES ──
create policy "messages_select" on public.email_messages for select using (
  public.is_admin() or
  exists (
    select 1 from public.email_threads t
    where t.id = thread_id
      and (t.assigned_to = (select id from public.users where auth_id = auth.uid()))
  )
);
create policy "messages_insert" on public.email_messages for insert with check (true);

-- ── AUTOMATION RULES (admin only) ──
create policy "automation_admin" on public.automation_rules for all using (
  public.is_admin()
);

-- ── ROUTING CONFIG (admin only) ──
create policy "routing_admin" on public.routing_config for all using (
  public.is_admin()
);

-- ── SCRAPER JOBS ──
create policy "jobs_select" on public.scraper_jobs for select using (
  public.is_admin() or created_by = (select id from public.users where auth_id = auth.uid())
);
create policy "jobs_insert" on public.scraper_jobs for insert with check (true);
create policy "jobs_update" on public.scraper_jobs for update using (
  public.is_admin() or created_by = (select id from public.users where auth_id = auth.uid())
);

-- ────────────────────────────────────────────────────────────
-- SEED: default admin user  (update password_hash after first login)
-- ────────────────────────────────────────────────────────────
-- insert into public.users (name, email, role) values
--   ('Admin', 'admin@one.com', 'admin');
