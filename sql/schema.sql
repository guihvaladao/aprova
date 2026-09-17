-- =====================================================================
-- APROVA — schema completo
-- Cole este arquivo inteiro no SQL Editor do Supabase e rode uma vez.
-- =====================================================================

-- ---------------------------------------------------------------- perfis
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'client' check (role in ('agency','client')),
  created_at timestamptz not null default now()
);

-- cria o perfil automaticamente quando alguem se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    'client'
  )
  on conflict (id) do nothing;
  return new;
end $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------- projetos
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  client_id   uuid references public.profiles(id) on delete set null,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists projects_client_idx on public.projects(client_id);

-- --------------------------------------------------------------- pecas
create table if not exists public.assets (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  title           text not null,
  kind            text not null default 'image' check (kind in ('image','video')),
  status          text not null default 'pending'
                  check (status in ('pending','approved','changes_requested')),
  current_version int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists assets_project_idx on public.assets(project_id);

-- ------------------------------------------------------------- versoes
create table if not exists public.asset_versions (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid not null references public.assets(id) on delete cascade,
  version      int  not null,
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint,
  note         text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (asset_id, version)
);
create index if not exists versions_asset_idx on public.asset_versions(asset_id);

-- ----------------------------------------------------------- comentarios
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references public.assets(id) on delete cascade,
  version_id uuid references public.asset_versions(id) on delete set null,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text,
  kind       text not null default 'comment'
             check (kind in ('comment','approval','change_request')),
  created_at timestamptz not null default now()
);
create index if not exists comments_asset_idx on public.comments(asset_id);

-- --------------------------------------------------------- notificacoes
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  asset_id   uuid references public.assets(id) on delete cascade,
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notif_user_idx on public.notifications(user_id, read);

-- =====================================================================
-- Funcoes de permissao (security definer para nao cair em recursao RLS)
-- =====================================================================
create or replace function public.is_agency()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'agency');
$fn$;

create or replace function public.can_access_project(p uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.is_agency()
      or exists (select 1 from public.projects
                 where id = p and client_id = auth.uid());
$fn$;

create or replace function public.can_access_asset(a uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.can_access_project((select project_id from public.assets where id = a));
$fn$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.projects       enable row level security;
alter table public.assets         enable row level security;
alter table public.asset_versions enable row level security;
alter table public.comments       enable row level security;
alter table public.notifications  enable row level security;

-- perfis: cada um le o seu; a agencia le todos (precisa para escolher o cliente)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_agency());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = 'client');

-- projetos
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (public.is_agency() or client_id = auth.uid());

drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects for all to authenticated
  using (public.is_agency()) with check (public.is_agency());

-- pecas
drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets for select to authenticated
  using (public.can_access_project(project_id));

drop policy if exists assets_write on public.assets;
create policy assets_write on public.assets for all to authenticated
  using (public.is_agency()) with check (public.is_agency());

-- versoes
drop policy if exists versions_select on public.asset_versions;
create policy versions_select on public.asset_versions for select to authenticated
  using (public.can_access_asset(asset_id));

drop policy if exists versions_write on public.asset_versions;
create policy versions_write on public.asset_versions for all to authenticated
  using (public.is_agency()) with check (public.is_agency());

-- comentarios: quem tem acesso a peca le e escreve (cliente e agencia)
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (public.can_access_asset(asset_id));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_access_asset(asset_id));

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid());

-- notificacoes: so as suas
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- Automacoes: status, numero da versao e notificacoes
-- =====================================================================

-- ao subir uma versao: atualiza a peca e avisa o cliente
create or replace function public.on_new_version()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare a record; p record; who text;
begin
  update public.assets
     set current_version = new.version,
         status = 'pending'
   where id = new.asset_id;

  select * into a from public.assets   where id = new.asset_id;
  select * into p from public.projects where id = a.project_id;
  select coalesce(full_name, email) into who from public.profiles where id = new.uploaded_by;

  if p.client_id is not null and p.client_id is distinct from new.uploaded_by then
    insert into public.notifications (user_id, project_id, asset_id, title, body)
    values (p.client_id, p.id, a.id,
            'Nova versao para aprovar',
            coalesce(who,'A agencia') || ' enviou a v' || new.version ||
            ' de "' || a.title || '" no projeto ' || p.name);
  end if;
  return new;
end $fn$;

drop trigger if exists trg_new_version on public.asset_versions;
create trigger trg_new_version
  after insert on public.asset_versions
  for each row execute function public.on_new_version();

-- ao comentar/aprovar/pedir ajuste: muda o status e avisa a outra parte
create or replace function public.on_new_comment()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare a record; p record; who text; target uuid; titulo text;
begin
  select * into a from public.assets   where id = new.asset_id;
  select * into p from public.projects where id = a.project_id;
  select coalesce(full_name, email) into who from public.profiles where id = new.author_id;

  if new.kind = 'approval' then
    update public.assets set status = 'approved' where id = new.asset_id;
    titulo := 'Peca aprovada';
  elsif new.kind = 'change_request' then
    update public.assets set status = 'changes_requested' where id = new.asset_id;
    titulo := 'Ajuste solicitado';
  else
    titulo := 'Novo comentario';
  end if;

  -- destinatario: quem NAO escreveu
  if new.author_id = p.client_id then
    target := p.owner_id;
  else
    target := p.client_id;
  end if;

  if target is not null and target is distinct from new.author_id then
    insert into public.notifications (user_id, project_id, asset_id, title, body)
    values (target, p.id, a.id, titulo,
            coalesce(who,'Alguem') || ' em "' || a.title || '": ' ||
            coalesce(nullif(new.body,''), '(sem texto)'));
  end if;
  return new;
end $fn$;

drop trigger if exists trg_new_comment on public.comments;
create trigger trg_new_comment
  after insert on public.comments
  for each row execute function public.on_new_comment();

-- =====================================================================
-- Storage: bucket privado "media"
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('media','media', false)
on conflict (id) do nothing;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and public.can_access_project( ((storage.foldername(name))[1])::uuid )
  );

drop policy if exists media_write on storage.objects;
create policy media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_agency());

drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_agency());

-- =====================================================================
-- DEPOIS de criar a sua conta no app, rode esta linha trocando o email
-- para virar "agencia" (quem sobe arquivos). Todo mundo nasce "client".
-- =====================================================================
-- update public.profiles set role = 'agency' where email = 'voce@exemplo.com';
