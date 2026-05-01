-- ============================================
-- Signal/AI — Projects & Portfolio schema (v2)
-- Run this in Supabase SQL Editor after the initial schema
-- ============================================

-- Ongoing contracted work (private — only visible to you in admin)
-- Public projects.html shows a limited view (no client names, no sensitive details)
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  client_name     text,                    -- hidden on public page by default
  description     text,
  status          text default 'in_progress', -- 'planning' | 'in_progress' | 'review' | 'blocked' | 'completed'
  progress        integer default 0,       -- 0-100
  start_date      date,
  due_date        date,
  hourly_rate     numeric,                 -- private only
  budget          numeric,                 -- private only
  hours_logged    numeric default 0,
  tags            text[] default '{}',
  show_publicly   boolean default false,   -- if true, appears on public projects.html (anonymized)
  notes           text,                    -- private notes
  repo_url        text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_projects_status on projects(status);
create index if not exists idx_projects_public on projects(show_publicly) where show_publicly = true;

alter table projects enable row level security;
-- Public can only read projects with show_publicly = true
create policy "Public read for public projects"
  on projects for select
  using (show_publicly = true);


-- Completed work / portfolio (GitHub-style grid — publicly visible)
create table if not exists portfolio_items (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  repo_url        text,
  live_url        text,
  language        text,                    -- primary language (for GitHub-style badge)
  language_color  text default '#4d8dff',  -- hex color for lang badge
  tech_stack      text[] default '{}',     -- array of tech tags
  stars           integer default 0,       -- fake/optional vanity metric
  completed_date  date,
  category        text default 'Web',      -- 'Web' | 'AI' | 'Infrastructure' | 'Mobile' | 'Other'
  pinned          boolean default false,   -- pinned items appear first
  created_at      timestamptz default now()
);

create index if not exists idx_portfolio_pinned on portfolio_items(pinned);
create index if not exists idx_portfolio_completed on portfolio_items(completed_date desc);

alter table portfolio_items enable row level security;
create policy "Public read access"
  on portfolio_items for select
  using (true);


-- Social / business links (single-row key-value, or ordered list)
create table if not exists links (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null,   -- 'github' | 'linkedin' | 'twitter' | 'email' | etc
  url         text not null,
  label       text,            -- optional custom display text
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table links enable row level security;
create policy "Public read access"
  on links for select
  using (true);


-- Seed a few example links you can edit in the admin panel
insert into links (platform, url, label, sort_order) values
  ('github', 'https://github.com/yourusername', 'GitHub', 1),
  ('linkedin', 'https://linkedin.com/in/yourusername', 'LinkedIn', 2),
  ('email', 'mailto:hello@yoursite.com', 'Email', 3)
on conflict do nothing;
