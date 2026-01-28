
-- ==============================================================================
-- SCHEMA COMPLETO DO COPILOT AI (Supabase)
-- ==============================================================================
-- Este script é idempotente: você pode rodá-lo várias vezes sem causar erros.
-- Ele verifica se as tabelas já existem antes de criar.
-- ==============================================================================

-- 1. Habilita extensão para gerar UUIDs (Identificadores únicos)
create extension if not exists "uuid-ossp";

-- ==========================================
-- 2. PERFIL DO USUÁRIO (Dados da Clínica)
-- ==========================================
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  name text,
  clinic_name text,
  ticket_value numeric default 450,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Habilita segurança (RLS)
alter table profiles enable row level security;

-- Políticas de Segurança (Removemos antigas para recriar e evitar conflito)
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Trigger: Cria perfil automaticamente quando um usuário se cadastra no Auth do Supabase
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, clinic_name)
  values (new.id, new.email, new.raw_user_meta_data->>'name', 'Minha Clínica');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ==========================================
-- 3. FINANCEIRO (TRANSACTIONS)
-- ==========================================
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text check (type in ('payable', 'receivable')),
  category text,
  name text,
  unit_value numeric default 0,
  total numeric default 0,
  status text check (status in ('efetuada', 'atrasada', 'cancelada')),
  date date not null,
  created_at timestamp with time zone default now()
);

alter table transactions enable row level security;

drop policy if exists "Users can crud own transactions" on transactions;
create policy "Users can crud own transactions" on transactions for all using (auth.uid() = user_id);


-- ==========================================
-- 4. CRM (LEADS)
-- ==========================================
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text,
  phone text,
  email text, -- Novo
  procedure text, -- Novo (Interesse)
  notes text, -- Novo (Observações)
  status text default 'Novo',
  temperature text default 'Cold',
  last_message text,
  potential_value numeric default 0,
  source text default 'Manual',
  created_at timestamp with time zone default now()
);

alter table leads enable row level security;

drop policy if exists "Users can crud own leads" on leads;
create policy "Users can crud own leads" on leads for all using (auth.uid() = user_id);


-- ==========================================
-- 5. AGENDA (APPOINTMENTS)
-- ==========================================
create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  time time not null,
  patient_name text,
  status text default 'Confirmado',
  type text default 'Consulta',
  created_at timestamp with time zone default now()
);

alter table appointments enable row level security;

drop policy if exists "Users can crud own appointments" on appointments;
create policy "Users can crud own appointments" on appointments for all using (auth.uid() = user_id);


-- ==========================================
-- 6. INTEGRAÇÕES DE ANÚNCIOS (Google/Meta)
-- ==========================================
create table if not exists ad_integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('google', 'meta')),
  ad_account_id text,
  access_token text,
  refresh_token text,
  status text default 'active',
  created_at timestamp with time zone default now(),
  unique(user_id, provider)
);

alter table ad_integrations enable row level security;

drop policy if exists "Users can crud own integrations" on ad_integrations;
create policy "Users can crud own integrations" on ad_integrations for all using (auth.uid() = user_id);


create table if not exists ad_campaigns (
  id uuid primary key default uuid_generate_v4(),
  integration_id uuid references ad_integrations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  external_id text not null,
  name text,
  platform text,
  status text,
  budget numeric default 0,
  unique(integration_id, external_id)
);

alter table ad_campaigns enable row level security;

drop policy if exists "Users can crud own campaigns" on ad_campaigns;
create policy "Users can crud own campaigns" on ad_campaigns for all using (auth.uid() = user_id);


create table if not exists ad_metrics (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references ad_campaigns(id) on delete cascade not null,
  date date not null,
  impressions int default 0,
  clicks int default 0,
  spend numeric default 0,
  conversions numeric default 0,
  ctr numeric,
  cpc numeric,
  created_at timestamp with time zone default now()
);

alter table ad_metrics enable row level security;

drop policy if exists "Users can view metrics" on ad_metrics;
create policy "Users can view metrics" on ad_metrics for select using (
    exists (select 1 from ad_campaigns where ad_campaigns.id = ad_metrics.campaign_id and ad_campaigns.user_id = auth.uid())
);

-- ==========================================
-- 7. WHATSAPP INSTANCES
-- ==========================================
create table if not exists whatsapp_instances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  instance_name text not null,
  status text default 'disconnected',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table whatsapp_instances enable row level security;

drop policy if exists "Users can view own instance" on whatsapp_instances;
create policy "Users can view own instance" on whatsapp_instances for select using (auth.uid() = user_id);

drop policy if exists "Users can update own instance" on whatsapp_instances;
create policy "Users can update own instance" on whatsapp_instances for update using (auth.uid() = user_id);
-- Nota: O backend deve usar a SERVICE_ROLE_KEY para ignorar essas políticas ao atualizar via Webhook.

-- ==========================================
-- 8. ATIVAR REALTIME
-- ==========================================
drop publication if exists supabase_realtime;
create publication supabase_realtime for table transactions, leads, appointments, whatsapp_instances;
