
-- Habilita a geração de UUIDs se ainda não estiver ativa
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. TABELA DE INTEGRAÇÕES (Armazena Tokens)
-- ==========================================
create table if not exists ad_integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('google', 'meta')),
  ad_account_id text,
  ad_account_name text,
  access_token text,  -- Token de curta duração
  refresh_token text, -- Token CRÍTICO para acesso offline (Google Ads exige isso)
  status text default 'active',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Garante que um usuário só tenha uma integração por provedor (ex: 1 Google Ads)
  unique(user_id, provider)
);

-- Segurança (RLS) - Garante que o usuário só veja sua própria integração
alter table ad_integrations enable row level security;

create policy "Users can view their own integrations"
  on ad_integrations for select using (auth.uid() = user_id);

create policy "Users can insert their own integrations"
  on ad_integrations for insert with check (auth.uid() = user_id);

create policy "Users can update their own integrations"
  on ad_integrations for update using (auth.uid() = user_id);

create policy "Users can delete their own integrations"
  on ad_integrations for delete using (auth.uid() = user_id);


-- ==========================================
-- 2. TABELA DE CAMPANHAS (Espelho do Google)
-- ==========================================
create table if not exists ad_campaigns (
  id uuid primary key default uuid_generate_v4(),
  integration_id uuid references ad_integrations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  external_id text not null, -- ID original da campanha no Google/Meta
  name text,
  platform text check (platform in ('google', 'meta')),
  status text, -- ENABLED, PAUSED, REMOVED
  budget numeric default 0,
  created_at timestamp with time zone default now(),
  
  -- Evita duplicar a mesma campanha
  unique(integration_id, external_id)
);

-- Segurança (RLS)
alter table ad_campaigns enable row level security;

create policy "Users can view their own campaigns"
  on ad_campaigns for select using (auth.uid() = user_id);

create policy "Users can insert their own campaigns"
  on ad_campaigns for insert with check (auth.uid() = user_id);

create policy "Users can update their own campaigns"
  on ad_campaigns for update using (auth.uid() = user_id);


-- ==========================================
-- 3. TABELA DE MÉTRICAS (Dados Diários)
-- ==========================================
create table if not exists ad_metrics (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references ad_campaigns(id) on delete cascade not null,
  date date not null,
  impressions int default 0,
  clicks int default 0,
  spend numeric default 0, -- Valor gasto no dia
  conversions numeric default 0,
  ctr numeric, -- Click Through Rate
  cpc numeric, -- Cost Per Click
  cpl numeric, -- Cost Per Lead
  created_at timestamp with time zone default now()
);

-- Segurança (RLS)
alter table ad_metrics enable row level security;

-- O usuário só pode ver métricas se a campanha pertencer a ele
create policy "Users can view metrics for their campaigns"
  on ad_metrics for select using (
    exists (
      select 1 from ad_campaigns
      where ad_campaigns.id = ad_metrics.campaign_id
      and ad_campaigns.user_id = auth.uid()
    )
  );

create policy "Users can insert metrics for their campaigns"
  on ad_metrics for insert with check (
    exists (
      select 1 from ad_campaigns
      where ad_campaigns.id = campaign_id
      and ad_campaigns.user_id = auth.uid()
    )
  );

-- Índices para melhorar a performance dos gráficos
create index if not exists idx_ad_metrics_date on ad_metrics(date);
create index if not exists idx_ad_campaigns_user on ad_campaigns(user_id);
