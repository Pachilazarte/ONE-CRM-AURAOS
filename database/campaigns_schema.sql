-- ============================================================
-- ONE CRM – Campaigns Schema Extension
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Run AFTER schema.sql has been applied
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- CAMPAIGNS
-- ────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  subject       text        not null,
  html          text        not null default '',
  total         integer     not null default 0,
  sent          integer     not null default 0,
  failed        integer     not null default 0,
  status        text        not null default 'pending'
                check (status in ('pending', 'sending', 'done', 'failed')),
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

-- ────────────────────────────────────────────────────────────
-- CAMPAIGN CONTACTS (individual email recipients)
-- ────────────────────────────────────────────────────────────
create table if not exists public.campaign_contacts (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  email         text not null,
  name          text,
  status        text not null default 'pending'
                check (status in ('pending', 'sent', 'failed')),
  error         text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
create index if not exists idx_campaigns_status      on public.campaigns(status);
create index if not exists idx_campaigns_created_at  on public.campaigns(created_at desc);
create index if not exists idx_campaign_contacts_cid on public.campaign_contacts(campaign_id);
create index if not exists idx_campaign_contacts_status on public.campaign_contacts(status);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
alter table public.campaigns        enable row level security;
alter table public.campaign_contacts enable row level security;

-- Campaigns: creator or admin can see/modify
create policy "campaigns_select" on public.campaigns for select using (
  public.is_admin() or created_by = (select id from public.users where auth_id = auth.uid())
);
create policy "campaigns_insert" on public.campaigns for insert with check (true);
create policy "campaigns_update" on public.campaigns for update using (
  public.is_admin() or created_by = (select id from public.users where auth_id = auth.uid())
);

-- Campaign contacts: visible if parent campaign is visible
create policy "campaign_contacts_select" on public.campaign_contacts for select using (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_id
      and (public.is_admin() or c.created_by = (select id from public.users where auth_id = auth.uid()))
  )
);
create policy "campaign_contacts_insert" on public.campaign_contacts for insert with check (true);
create policy "campaign_contacts_update" on public.campaign_contacts for update using (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_id
      and (public.is_admin() or c.created_by = (select id from public.users where auth_id = auth.uid()))
  )
);
