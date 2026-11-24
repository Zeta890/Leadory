-- Leadory — schema inicial multi-tenant (workspaces) com RLS em todas as tabelas expostas.
-- Substitui legacy/schema.sql (isolamento por owner_id) por isolamento por workspace + membership.
begin;

create extension if not exists pgcrypto;

-- ───────────────────────── Workspaces & membership ─────────────────────────
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  sender_name text not null default '' check (char_length(sender_name) <= 80),
  sender_role text not null default 'desenvolvedor de sites' check (char_length(sender_role) <= 80),
  -- Envio pelo WhatsApp desabilitado por padrão (CLAUDE.md).
  sending_enabled boolean not null default false,
  whatsapp_template_name text,
  monthly_request_budget int not null default 600 check (monthly_request_budget between 0 and 100000),
  created_at timestamptz not null default now()
);

create type public.member_role as enum ('owner', 'admin', 'member');

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members(user_id);

create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = (select auth.uid()));
$$;

create or replace function public.has_role(ws uuid, roles public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = any(roles));
$$;

-- Novo usuário recebe um workspace pessoal.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  insert into public.workspaces(name, sender_name)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'Meu workspace'), coalesce(new.raw_user_meta_data->>'name', ''))
  returning id into ws;
  insert into public.workspace_members(workspace_id, user_id, role) values (ws, new.id, 'owner');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ───────────────────────── Campanhas ─────────────────────────
create type public.campaign_status as enum ('draft', 'running', 'paused', 'completed', 'failed');

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  niche text not null check (char_length(niche) between 1 and 120),
  city text not null check (char_length(city) between 1 and 120),
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  radius_km int not null check (radius_km between 1 and 50),
  max_companies int not null check (max_companies between 1 and 100),
  prioritize_no_website boolean not null default true,
  require_instagram boolean not null default false,
  require_business_phone boolean not null default true,
  priority_keywords text[] not null default '{}',
  query_variants text[] not null default '{}' check (cardinality(query_variants) <= 30),
  timezone text not null default 'America/Sao_Paulo',
  status public.campaign_status not null default 'draft',
  max_requests int not null default 60 check (max_requests between 1 and 500),
  requests_used int not null default 0,
  found_count int not null default 0,
  rejected jsonb not null default '{}'::jsonb,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaigns(workspace_id, created_at desc);

-- ───────────────────────── Leads ─────────────────────────
create type public.lead_stage as enum ('qualified', 'authorized', 'interested', 'meeting', 'proposal', 'won', 'lost');
create type public.website_status as enum ('unknown', 'inconclusive', 'identified', 'not_identified');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  address text,
  lat double precision,
  lng double precision,
  distance_km numeric(6,1),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified boolean not null default false,
  website text,
  website_status public.website_status not null default 'unknown',
  instagram text check (instagram is null or instagram ~ '^[a-z0-9._]{1,30}$'),
  instagram_verified boolean not null default false,
  rating numeric(2,1),
  review_count int,
  types text[] not null default '{}',
  source text not null default 'manual',
  source_id text,
  source_url text,
  source_retrieved_at timestamptz,
  -- Conteúdo derivado do Google Places tem validade limitada; place_id pode ser mantido.
  source_expires_at timestamptz,
  score int not null default 0 check (score between 0 and 100),
  score_breakdown jsonb not null default '[]'::jsonb,
  stage public.lead_stage not null default 'qualified',
  stage_changed_at timestamptz not null default now(),
  notes text not null default '' check (char_length(notes) <= 10000),
  confirmed_services text[] not null default '{}',
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index leads_source_unique on public.leads(workspace_id, source, source_id) where source_id is not null;
create unique index leads_phone_unique on public.leads(workspace_id, phone_e164) where phone_e164 is not null;
create index on public.leads(workspace_id, stage);
create index on public.leads(workspace_id, created_at desc);
create index on public.leads(campaign_id);

create table public.lead_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.lead_events(lead_id, created_at desc);

create table public.lead_audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  website_status public.website_status not null,
  checked_url text,
  final_url text,
  http_status int,
  signals jsonb not null default '{}'::jsonb,
  web_search jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.lead_audits(lead_id, created_at desc);

-- ───────────────────────── Consentimento & supressão ─────────────────────────
create type public.consent_status as enum ('granted', 'revoked');

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  status public.consent_status not null default 'granted',
  -- Evidência verificável obrigatória (ex.: mensagem recebida do contato, formulário com data/IP).
  evidence text not null check (char_length(trim(evidence)) >= 10),
  source text not null check (source in ('inbound_message', 'web_form', 'signed_document', 'verbal_recorded', 'other')),
  recorded_by uuid default auth.uid(),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.consents(workspace_id, phone_e164);

create table public.suppression_list (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  phone_e164 text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, phone_e164)
);

-- ───────────────────────── Prévias ─────────────────────────
create table public.previews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  slug text not null unique default encode(gen_random_bytes(12), 'hex'),
  content jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.previews(lead_id);

-- ───────────────────────── Mensagens & fila ─────────────────────────
create type public.message_status as enum ('draft', 'approved', 'scheduled', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'received');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  body text not null check (char_length(body) <= 4096),
  template_name text,
  status public.message_status not null default 'draft',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  scheduled_for timestamptz,
  attempts int not null default 0 check (attempts between 0 and 3),
  idempotency_key text unique,
  wa_message_id text unique,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (direction = 'inbound' or char_length(body) <= 350 or template_name is not null)
);
create index on public.messages(workspace_id, status, scheduled_for);
create index on public.messages(lead_id, created_at desc);

-- Defesa em profundidade: não agenda sem opt-in válido, sem aprovação humana, ou se suprimido.
create or replace function public.guard_message_schedule() returns trigger
language plpgsql security definer set search_path = '' as $$
declare phone text;
begin
  if new.direction = 'outbound' and new.status in ('scheduled', 'sending') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if new.approved_at is null or new.approved_by is null then
      raise exception 'Mensagem sem aprovação humana' using errcode = 'P0001';
    end if;
    select l.phone_e164 into phone from public.leads l where l.id = new.lead_id and l.workspace_id = new.workspace_id;
    if phone is null then raise exception 'Lead sem telefone' using errcode = 'P0001'; end if;
    if exists (select 1 from public.suppression_list s where s.workspace_id = new.workspace_id and s.phone_e164 = phone) then
      raise exception 'Número suprimido' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.consents c where c.workspace_id = new.workspace_id and c.lead_id = new.lead_id and c.phone_e164 = phone and c.status = 'granted') then
      raise exception 'Sem opt-in verificável' using errcode = 'P0001';
    end if;
    if not (select w.sending_enabled from public.workspaces w where w.id = new.workspace_id) then
      raise exception 'Envio desabilitado no workspace' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger messages_guard before insert or update on public.messages
for each row execute function public.guard_message_schedule();

create table public.webhook_events (
  id text primary key, -- wamid + tipo: idempotência no processamento
  workspace_id uuid references public.workspaces(id) on delete cascade,
  received_at timestamptz not null default now()
);

-- ───────────────────────── Negócios & custos ─────────────────────────
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  title text not null default 'Site profissional',
  value_cents bigint not null check (value_cents >= 0),
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.deals(workspace_id, status);

create table public.api_usage (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  provider text not null,
  units int not null default 1,
  cost_cents int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.api_usage(workspace_id, created_at desc);

-- ───────────────────────── Integridade de tenant ─────────────────────────
-- Garante que FKs apontem para o mesmo workspace (evita vincular dados de outro tenant).
create or replace function public.assert_same_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'leads' then
    if new.campaign_id is not null then
      if not exists (select 1 from public.campaigns c where c.id = new.campaign_id and c.workspace_id = new.workspace_id) then
        raise exception 'campaign de outro workspace';
      end if;
    end if;
  else
    if not exists (select 1 from public.leads l where l.id = new.lead_id and l.workspace_id = new.workspace_id) then
      raise exception 'lead de outro workspace';
    end if;
  end if;
  return new;
end $$;

do $$ declare t text;
begin
  foreach t in array array['leads','lead_events','lead_audits','consents','previews','messages','deals'] loop
    execute format('create trigger %I_same_ws before insert or update on public.%I for each row execute function public.assert_same_workspace()', t, t);
  end loop;
end $$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_table_name = 'leads' then
    if new.stage is distinct from old.stage then new.stage_changed_at := now(); end if;
  end if;
  return new;
end $$;
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();
create trigger campaigns_touch before update on public.campaigns for each row execute function public.touch_updated_at();

-- ───────────────────────── RLS ─────────────────────────
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.webhook_events enable row level security; -- sem políticas: somente service role

create policy ws_select on public.workspaces for select to authenticated using (public.is_member(id));
create policy ws_update on public.workspaces for update to authenticated using (public.has_role(id, array['owner','admin']::public.member_role[])) with check (public.has_role(id, array['owner','admin']::public.member_role[]));

create policy wm_select on public.workspace_members for select to authenticated using (public.is_member(workspace_id));
create policy wm_manage on public.workspace_members for all to authenticated using (public.has_role(workspace_id, array['owner']::public.member_role[])) with check (public.has_role(workspace_id, array['owner']::public.member_role[]));

do $$ declare t text;
begin
  foreach t in array array['campaigns','leads','lead_events','lead_audits','consents','suppression_list','previews','messages','deals','api_usage'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_select on public.%I for select to authenticated using (public.is_member(workspace_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.is_member(workspace_id))', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id))', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.has_role(workspace_id, array[''owner'',''admin'']::public.member_role[]))', t, t);
  end loop;
end $$;

-- Histórico e auditorias são append-only para membros.
drop policy lead_events_update on public.lead_events;
drop policy lead_audits_update on public.lead_audits;
drop policy api_usage_update on public.api_usage;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.webhook_events from authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ───────────────────────── Retenção (LGPD / termos de dados) ─────────────────────────
create or replace function public.purge_expired_source_data() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.leads set rating = null, review_count = null, address = case when stage in ('qualified') then null else address end,
    lat = null, lng = null, source_expires_at = null
  where source = 'google_places' and source_expires_at is not null and source_expires_at < now();
  get diagnostics n = row_count;
  delete from public.webhook_events where received_at < now() - interval '30 days';
  return n;
end $$;
revoke execute on function public.purge_expired_source_data() from public, anon, authenticated;

commit;
