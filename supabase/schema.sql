
-- ==============================================================================
-- CORREÇÃO DE ERROS - RODE ISSO NO SUPABASE SQL EDITOR
-- ==============================================================================

-- 1. Garante que a extensão de UUID existe
create extension if not exists "uuid-ossp";

-- 2. Tabela de Instâncias do WhatsApp (Causa do erro 404)
create table if not exists whatsapp_instances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  instance_name text not null,
  status text default 'disconnected',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. Habilita segurança (RLS)
alter table whatsapp_instances enable row level security;

-- 4. Políticas de acesso (Permite que o usuário veja e edite sua própria instância)
drop policy if exists "Users can view own instance" on whatsapp_instances;
create policy "Users can view own instance" on whatsapp_instances for select using (auth.uid() = user_id);

drop policy if exists "Users can update own instance" on whatsapp_instances;
create policy "Users can update own instance" on whatsapp_instances for update using (auth.uid() = user_id);

drop policy if exists "Users can insert own instance" on whatsapp_instances;
create policy "Users can insert own instance" on whatsapp_instances for insert with check (auth.uid() = user_id);

-- 5. Atualiza a publicação do Realtime para incluir esta tabela
alter publication supabase_realtime add table whatsapp_instances;
