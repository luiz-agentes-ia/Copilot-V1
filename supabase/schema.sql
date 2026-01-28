
-- ==============================================================================
-- 1. EXTENSÕES
-- ==============================================================================
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- 2. CRIAÇÃO DE TABELAS (Se não existirem)
-- ==============================================================================

-- 2.1 PERFIS
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  clinic_name text,
  ticket_value numeric default 450,
  created_at timestamp with time zone default now()
);

-- 2.2 LEADS (CRM)
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  phone text not null,
  status text default 'Novo',
  temperature text default 'Cold',
  source text default 'Manual',
  potential_value numeric default 0,
  last_message text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Adiciona colunas novas com segurança
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='email') then
    alter table leads add column email text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='procedure') then
    alter table leads add column procedure text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='notes') then
    alter table leads add column notes text;
  end if;
end $$;

-- Adiciona restrição única de telefone por usuário
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_user_phone_unique') then
    alter table leads add constraint leads_user_phone_unique unique(user_id, phone);
  end if;
exception when others then
  null;
end $$;

-- 2.3 INSTÂNCIAS WHATSAPP (A tabela essencial para sua persistência)
create table if not exists whatsapp_instances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  instance_name text not null,
  status text default 'disconnected',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2.4 MENSAGENS (Histórico)
create table if not exists whatsapp_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lead_id uuid references leads(id) on delete set null,
  contact_phone text not null,
  sender text not null, -- 'me' ou 'contact'
  type text default 'text',
  body text,
  wa_message_id text,
  status text default 'sent',
  created_at timestamp with time zone default now()
);

-- 2.5 TRANSAÇÕES (Financeiro)
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null, -- 'payable' ou 'receivable'
  category text,
  name text,
  unit_value numeric default 0,
  total numeric default 0,
  status text default 'efetuada',
  date date default CURRENT_DATE,
  created_at timestamp with time zone default now()
);

-- 2.6 AGENDAMENTOS
create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  patient_name text not null,
  date date not null,
  time time not null,
  type text default 'Consulta',
  status text default 'Confirmado',
  created_at timestamp with time zone default now()
);

-- ==============================================================================
-- 3. TRIGGERS
-- ==============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, clinic_name)
  values (new.id, new.raw_user_meta_data->>'name', 'Minha Clínica')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- 4. SEGURANÇA (RLS)
-- ==============================================================================

alter table profiles enable row level security;
alter table leads enable row level security;
alter table whatsapp_instances enable row level security;
alter table whatsapp_messages enable row level security;
alter table transactions enable row level security;
alter table appointments enable row level security;

-- Limpeza de políticas antigas
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can crud own leads" on leads;
drop policy if exists "Users can crud own instances" on whatsapp_instances;
drop policy if exists "Users can crud own messages" on whatsapp_messages;
drop policy if exists "Users can crud own transactions" on transactions;
drop policy if exists "Users can crud own appointments" on appointments;

-- Novas políticas
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can crud own leads" on leads for all using (auth.uid() = user_id);
create policy "Users can crud own instances" on whatsapp_instances for all using (auth.uid() = user_id);
create policy "Users can crud own messages" on whatsapp_messages for all using (auth.uid() = user_id);
create policy "Users can crud own transactions" on transactions for all using (auth.uid() = user_id);
create policy "Users can crud own appointments" on appointments for all using (auth.uid() = user_id);

-- ==============================================================================
-- 5. REALTIME (CORREÇÃO DO ERRO 42710)
-- ==============================================================================

-- Garante que a publicação existe
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

-- Adiciona tabelas ao Realtime uma por uma, com tratamento de erro se já existir
do $$
begin
  begin
    alter publication supabase_realtime add table whatsapp_messages;
  exception when duplicate_object then null; end;

  begin
    alter publication supabase_realtime add table whatsapp_instances;
  exception when duplicate_object then null; end;

  begin
    alter publication supabase_realtime add table leads;
  exception when duplicate_object then null; end;

  begin
    alter publication supabase_realtime add table appointments;
  exception when duplicate_object then null; end;

  begin
    alter publication supabase_realtime add table transactions;
  exception when duplicate_object then null; end;
end;
$$;
