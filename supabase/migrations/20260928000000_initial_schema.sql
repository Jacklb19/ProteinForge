-- =============================================================================
-- Migración inicial: profiles, projects, analyses, alignments, external_cache
-- Incluye función UUIDv7 en PL/pgSQL pura, RLS estricta y trigger de registro
-- =============================================================================

-- 1. Función para generación de UUIDv7 (RFC 9562) sin dependencias externas
-- NOTA: Documentada en docs/propuestas.md como alternativa provisional ante la
-- falta de soporte nativo de uuidv7() en core pg_catalog de PostgreSQL 15/16.
create or replace function public.uuid_generate_v7()
returns uuid
as $$
declare
  unix_time_ms bytea;
  uuid_bytes bytea;
begin
  unix_time_ms := substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3 for 6);
  uuid_bytes := unix_time_ms || gen_random_bytes(10);
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);
  return encode(uuid_bytes, 'hex')::uuid;
end;
$$ language plpgsql volatile;

-- 2. Tabla profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferences jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 3. Tabla projects
create table if not exists public.projects (
  id uuid primary key default public.uuid_generate_v7(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  active_sequence text default '' not null,
  status text default 'draft' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 4. Tabla analyses
create table if not exists public.analyses (
  id uuid primary key default public.uuid_generate_v7(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  parameters jsonb default '{}'::jsonb not null,
  results jsonb default '{}'::jsonb not null,
  duration_ms integer,
  created_at timestamptz default now() not null
);

-- 5. Tabla alignments
create table if not exists public.alignments (
  id uuid primary key default public.uuid_generate_v7(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reference text not null,
  matrix text not null,
  gap_penalties jsonb not null,
  score numeric,
  identity numeric,
  created_at timestamptz default now() not null
);

-- 6. Tabla external_cache
create table if not exists public.external_cache (
  source text not null,
  identifier text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null,
  primary key (source, identifier)
);

-- 7. Índices en claves foráneas para optimizar comprobaciones de RLS y relaciones
create index if not exists idx_projects_owner_id on public.projects(owner_id);
create index if not exists idx_analyses_project_id on public.analyses(project_id);
create index if not exists idx_alignments_project_id on public.alignments(project_id);

-- 8. Activación de Seguridad a Nivel de Fila (RLS) en todas las tablas
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.analyses enable row level security;
alter table public.alignments enable row level security;
alter table public.external_cache enable row level security;

-- 9. Políticas de seguridad para profiles
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- 10. Políticas de seguridad para projects
create policy "Users can view own projects"
  on public.projects for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can insert own projects"
  on public.projects for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Users can update own projects"
  on public.projects for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Users can delete own projects"
  on public.projects for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- 11. Políticas de seguridad para analyses (a través de projects)
create policy "Users can view analyses of own projects"
  on public.analyses for select
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = analyses.project_id
        and projects.owner_id = (select auth.uid())
    )
  );

create policy "Users can insert analyses to own projects"
  on public.analyses for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects
      where projects.id = analyses.project_id
        and projects.owner_id = (select auth.uid())
    )
  );

create policy "Users can update analyses of own projects"
  on public.analyses for update
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = analyses.project_id
        and projects.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = analyses.project_id
        and projects.owner_id = (select auth.uid())
    )
  );

create policy "Users can delete analyses of own projects"
  on public.analyses for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = analyses.project_id
        and projects.owner_id = (select auth.uid())
    )
  );

-- 12. Políticas de seguridad para alignments (a través de projects)
create policy "Users can view alignments of own projects"
  on public.alignments for select
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = alignments.project_id
        and projects.owner_id = (select auth.uid())
    )
  );

create policy "Users can insert alignments to own projects"
  on public.alignments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects
      where projects.id = alignments.project_id
        and projects.owner_id = (select auth.uid())
    )
  );

create policy "Users can update alignments of own projects"
  on public.alignments for update
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = alignments.project_id
        and projects.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = alignments.project_id
        and projects.owner_id = (select auth.uid())
    )
  );

create policy "Users can delete alignments of own projects"
  on public.alignments for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = alignments.project_id
        and projects.owner_id = (select auth.uid())
    )
  );

-- 13. Restricción estricta en external_cache (solo accesible por rol de servicio)
revoke all on table public.external_cache from anon, authenticated;

-- 14. Trigger para auto-crear perfil al registrar un usuario en auth.users
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, display_name, preferences)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    '{}'::jsonb
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
