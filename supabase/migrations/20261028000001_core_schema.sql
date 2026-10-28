-- Dot 1 / migration 1: bang nen tang (to chuc, danh tinh, phan quyen, nhat ky)
-- Quy uoc: khoa chinh uuid, created_at/updated_at timestamptz (UTC), xoa mem bang deleted_at khi can.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Gia dinh va nhanh ho ----------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  logo_path text,
  cover_path text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  default_locale text not null default 'vi' check (default_locale in ('vi','ja')),
  editing_mode text not null default 'locked' check (editing_mode in ('locked','open')),
  editing_open_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger families_updated before update on public.families
  for each row execute function public.set_updated_at();

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  parent_branch_id uuid references public.branches(id) on delete set null,
  editing_mode text check (editing_mode in ('locked','open')), -- null = ke thua tu gia dinh
  editing_open_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (parent_branch_id is distinct from id)
);
create index branches_family_idx on public.branches(family_id);
create trigger branches_updated before update on public.branches
  for each row execute function public.set_updated_at();

-- ---------- Danh tinh ----------
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  avatar_path text,
  locale text not null default 'vi' check (locale in ('vi','ja')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_profiles_updated before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- ---------- Vai tro va quyen ----------
create table public.roles (
  key text primary key,
  name_vi text not null,
  rank int not null unique,           -- nho hon = quyen cao hon
  scope_limited boolean not null default false -- true: chi co hieu luc trong nhanh duoc giao
);

create table public.permissions (
  module text not null,
  action text not null check (action in ('view','create','update','delete','approve','export')),
  primary key (module, action)
);

create table public.role_permissions (
  role_key text not null references public.roles(key) on delete cascade,
  module text not null,
  action text not null,
  primary key (role_key, module, action),
  foreign key (module, action) references public.permissions(module, action) on delete cascade
);

-- ---------- Tai khoan trong gia dinh ----------
create table public.family_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  role_key text not null references public.roles(key),
  branch_id uuid references public.branches(id),
  member_id uuid,  -- se tro toi family_members (Dot 2)
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, family_id),
  check (role_key <> 'branch_admin' or branch_id is not null),
  check ((status = 'revoked') = (revoked_at is not null))
);
create index memberships_family_idx on public.family_memberships(family_id);

-- ---------- Loi moi ----------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  email text check (email is null or email = lower(btrim(email))),
  token_hash text not null unique,        -- sha256 hex cua token; token goc chi hien mot lan
  role_key text not null references public.roles(key),
  branch_id uuid references public.branches(id),
  member_id uuid,
  expires_at timestamptz not null,
  max_uses int not null default 1 check (max_uses between 1 and 50),
  used_count int not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  check (role_key <> 'branch_admin' or branch_id is not null)
);
create index invitations_family_idx on public.invitations(family_id);

-- ---------- Nhat ky (chi them, khong sua/xoa) ----------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  family_id uuid references public.families(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_family_idx on public.audit_logs(family_id, created_at desc);

create or replace function public.audit_logs_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();
