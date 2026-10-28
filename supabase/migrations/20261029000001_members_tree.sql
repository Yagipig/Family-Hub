-- Dot 2 / migration 1: ho so thanh vien, quan he gia pha, yeu cau sua, hien thi theo quyen
-- File nay duoc sinh tu script; sua truc tiep neu can nhung giu cac quy uoc: RLS bat, khong cap quyen truc tiep tren bang.

-- Mac dinh an toan cho moi doi tuong tao sau nay trong schema public
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 160),
  nickname text check (char_length(nickname) <= 80),
  gender text check (gender in ('male','female','other')),
  avatar_path text check (char_length(avatar_path) <= 400),
  birth_solar_year smallint check (birth_solar_year between 1000 and 2200),
  birth_solar_month smallint check (birth_solar_month between 1 and 12),
  birth_solar_day smallint check (birth_solar_day between 1 and 31),
  birth_lunar_year smallint check (birth_lunar_year between 1000 and 2200),
  birth_lunar_month smallint check (birth_lunar_month between 1 and 12),
  birth_lunar_day smallint check (birth_lunar_day between 1 and 30),
  birth_lunar_leap boolean not null default false,
  birthday_mode text not null default 'solar' check (birthday_mode in ('solar','lunar','both')),
  is_deceased boolean not null default false,
  death_solar_year smallint check (death_solar_year between 1000 and 2200),
  death_solar_month smallint check (death_solar_month between 1 and 12),
  death_solar_day smallint check (death_solar_day between 1 and 31),
  death_lunar_month smallint check (death_lunar_month between 1 and 12),
  death_lunar_day smallint check (death_lunar_day between 1 and 30),
  death_lunar_leap boolean not null default false,
  hometown text check (char_length(hometown) <= 200),
  generation_title text check (char_length(generation_title) <= 80),
  generation_no smallint check (generation_no between 1 and 60),
  bio text check (char_length(bio) <= 5000),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 254),
  birth_visibility text not null default 'family' check (birth_visibility in ('family','branch','admins')),
  death_visibility text not null default 'family' check (death_visibility in ('family','branch','admins')),
  contact_visibility text not null default 'branch' check (contact_visibility in ('family','branch','admins')),
  photo_visibility text not null default 'family' check (photo_visibility in ('family','branch','admins')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (birth_solar_day is null or birth_solar_month is not null),
  check (birth_lunar_day is null or birth_lunar_month is not null),
  check (death_solar_day is null or death_solar_month is not null),
  check (is_deceased or (death_solar_year is null and death_solar_month is null and death_solar_day is null
                         and death_lunar_month is null and death_lunar_day is null))
);
create index family_members_family_idx on public.family_members(family_id) where deleted_at is null;
create index family_members_branch_idx on public.family_members(branch_id) where deleted_at is null;
create index family_members_name_idx on public.family_members(family_id, lower(full_name));
create trigger family_members_updated before update on public.family_members
  for each row execute function public.set_updated_at();

-- Moi tai khoan dang hoat dong gan toi toi da mot ho so, moi ho so toi da mot tai khoan
alter table public.family_memberships
  add constraint family_memberships_member_fk foreign key (member_id) references public.family_members(id) on delete set null;
create unique index family_memberships_member_unique on public.family_memberships(member_id)
  where member_id is not null and status = 'active';

create table public.member_parent_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.family_members(id) on delete cascade,
  parent_id uuid not null references public.family_members(id) on delete cascade,
  kind text not null default 'biological' check (kind in ('biological','adoptive','step')),
  created_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (child_id <> parent_id)
);
create unique index member_parent_links_unique on public.member_parent_links(child_id, parent_id) where deleted_at is null;
create index member_parent_links_parent_idx on public.member_parent_links(parent_id) where deleted_at is null;
create index member_parent_links_family_idx on public.member_parent_links(family_id) where deleted_at is null;

create table public.member_partnerships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_a uuid not null references public.family_members(id) on delete cascade,
  member_b uuid not null references public.family_members(id) on delete cascade,
  status text not null default 'married' check (status in ('married','divorced','widowed','partner')),
  start_year smallint check (start_year between 1000 and 2200),
  end_year smallint check (end_year between 1000 and 2200),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (member_a < member_b)   -- luon luu theo thu tu de khong trung cap dao (a,b) / (b,a)
);
create unique index member_partnerships_unique on public.member_partnerships(member_a, member_b) where deleted_at is null;
create index member_partnerships_b_idx on public.member_partnerships(member_b) where deleted_at is null;
create index member_partnerships_family_idx on public.member_partnerships(family_id) where deleted_at is null;
create trigger member_partnerships_updated before update on public.member_partnerships
  for each row execute function public.set_updated_at();

create table public.member_change_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  kind text not null check (kind in ('update_member','create_member','delete_member','add_parent','add_partner','remove_link')),
  target_member_id uuid references public.family_members(id) on delete set null,
  branch_id uuid,
  payload jsonb not null default '{}'::jsonb check (pg_column_size(payload) < 20000),
  note text check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text check (char_length(review_note) <= 1000),
  created_at timestamptz not null default now()
);
create index member_change_requests_family_idx on public.member_change_requests(family_id, status, created_at desc);

-- Kiem tra rang buoc cung gia dinh va chong vong lap
create or replace function public.would_create_cycle(p_child uuid, p_parent uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive d(id) as (
    select l.child_id from public.member_parent_links l where l.parent_id = p_child and l.deleted_at is null
    union
    select l.child_id from public.member_parent_links l join d on l.parent_id = d.id where l.deleted_at is null
  )
  select p_parent = p_child or exists (select 1 from d where id = p_parent);
$$;

create or replace function public.guard_parent_link() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is null then
    if (select count(*) from public.family_members m
          where m.id in (new.child_id, new.parent_id) and m.family_id = new.family_id) <> 2 then
      raise exception 'members must belong to the family of the link' using errcode = '22023';
    end if;
    if public.would_create_cycle(new.child_id, new.parent_id) then
      raise exception 'parent link would create a cycle' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger member_parent_links_guard before insert or update on public.member_parent_links
  for each row execute function public.guard_parent_link();

create or replace function public.guard_partnership() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is null then
    if (select count(*) from public.family_members m
          where m.id in (new.member_a, new.member_b) and m.family_id = new.family_id) <> 2 then
      raise exception 'members must belong to the family of the partnership' using errcode = '22023';
    end if;
    if exists (select 1 from public.member_parent_links l where l.deleted_at is null
               and ((l.child_id = new.member_a and l.parent_id = new.member_b)
                 or (l.child_id = new.member_b and l.parent_id = new.member_a))) then
      raise exception 'a parent and child cannot be partners' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger member_partnerships_guard before insert or update on public.member_partnerships
  for each row execute function public.guard_partnership();

-- Nhat ky tu dong cho thay doi gia pha
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit(coalesce(new.family_id, old.family_id), tg_argv[0] || '.' || lower(tg_op), tg_argv[0],
    coalesce(new.id, old.id)::text,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger family_members_audit after insert or update or delete on public.family_members
  for each row execute function public.audit_row_change('member');
create trigger member_parent_links_audit after insert or update or delete on public.member_parent_links
  for each row execute function public.audit_row_change('parent_link');
create trigger member_partnerships_audit after insert or update or delete on public.member_partnerships
  for each row execute function public.audit_row_change('partnership');

-- ---------- Quyen chinh sua ho so ----------
create or replace function public.my_member_id(p_family uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m.member_id from public.family_memberships m
  where m.user_id = auth.uid() and m.family_id = p_family and m.status = 'active';
$$;

-- Admin (theo pham vi) luon duoc sua; thanh vien thuong chi sua khi che do chinh sua dang MO. Khach khong bao gio sua.
create or replace function public.can_edit_members(p_family uuid, p_branch uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if public.has_permission(p_family, 'members', 'update', p_branch) then return true; end if;
  if public.my_role(p_family) = 'member' and public.is_editing_open(p_family, p_branch) then return true; end if;
  return false;
end $$;

create or replace function public.can_edit_member(p_family uuid, p_branch uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_member is not null and public.my_member_id(p_family) = p_member and public.my_role(p_family) <> 'guest', false)
      or public.can_edit_members(p_family, p_branch);
$$;

-- ---------- Hien thi theo quyen (an truong nhay cam) ----------
create or replace function public.member_is_minor(p_year int, p_month int, p_day int) returns boolean
language sql stable set search_path = public as $$
  select case
    when p_year is null then false
    when p_month is null then (extract(year from now())::int - p_year) < 19   -- chua ro thang: tinh thao cho tre em
    else (extract(year from now())::int - p_year
          - case when p_month > extract(month from now())::int
                   or (p_month = extract(month from now())::int and coalesce(p_day, 1) > extract(day from now())::int)
                 then 1 else 0 end) < 18
  end;
$$;

create or replace function public.can_see_field(p_family uuid, p_branch uuid, p_member uuid, p_vis text, p_minor boolean)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_role text; v_scope uuid; v_self uuid; v_eff text;
begin
  if auth.uid() is null then return false; end if;
  select m.role_key, m.branch_id, m.member_id into v_role, v_scope, v_self
    from public.family_memberships m
    where m.user_id = auth.uid() and m.family_id = p_family and m.status = 'active';
  if v_role is null then return false; end if;
  if v_self is not null and v_self = p_member then return true; end if;
  if v_role in ('super_admin','family_admin') then return true; end if;
  if v_role = 'branch_admin' and p_branch is not null and v_scope is not null
     and public.branch_in_scope(v_scope, p_branch) then return true; end if;
  -- Tre em: toi da 'nhanh', ke ca khi dat 'ca gia dinh'
  v_eff := case when p_minor and p_vis = 'family' then 'branch' else p_vis end;
  if v_eff = 'family' then return true; end if;
  if v_eff = 'branch' then
    return p_branch is not null and v_scope is not null and public.branch_in_scope(v_scope, p_branch);
  end if;
  return false;
end $$;

create or replace view public.members_view as
select
  m.id, m.family_id, m.branch_id, m.full_name, m.nickname, m.gender,
  case when v.photo_ok then m.avatar_path end as avatar_path,
  m.birth_solar_year,
  case when v.birth_ok then m.birth_solar_month end as birth_solar_month,
  case when v.birth_ok then m.birth_solar_day end as birth_solar_day,
  case when v.birth_ok then m.birth_lunar_year end as birth_lunar_year,
  case when v.birth_ok then m.birth_lunar_month end as birth_lunar_month,
  case when v.birth_ok then m.birth_lunar_day end as birth_lunar_day,
  case when v.birth_ok then m.birth_lunar_leap else false end as birth_lunar_leap,
  m.birthday_mode,
  m.is_deceased,
  case when v.death_ok then m.death_solar_year end as death_solar_year,
  case when v.death_ok then m.death_solar_month end as death_solar_month,
  case when v.death_ok then m.death_solar_day end as death_solar_day,
  case when v.death_ok then m.death_lunar_month end as death_lunar_month,
  case when v.death_ok then m.death_lunar_day end as death_lunar_day,
  case when v.death_ok then m.death_lunar_leap else false end as death_lunar_leap,
  m.hometown, m.generation_title, m.generation_no, m.bio,
  case when v.contact_ok then m.phone end as phone,
  case when v.contact_ok then m.email end as email,
  case when v.edit_ok then m.birth_visibility end as birth_visibility,
  case when v.edit_ok then m.death_visibility end as death_visibility,
  case when v.edit_ok then m.contact_visibility end as contact_visibility,
  case when v.edit_ok then m.photo_visibility end as photo_visibility,
  mi.minor as is_minor,
  (public.my_member_id(m.family_id) = m.id) as is_self,
  v.edit_ok as can_edit,
  m.created_at, m.updated_at
from public.family_members m
cross join lateral (select public.member_is_minor(m.birth_solar_year, m.birth_solar_month, m.birth_solar_day) as minor) mi
cross join lateral (select
    public.can_see_field(m.family_id, m.branch_id, m.id, m.birth_visibility, mi.minor) as birth_ok,
    public.can_see_field(m.family_id, m.branch_id, m.id, m.death_visibility, false) as death_ok,
    public.can_see_field(m.family_id, m.branch_id, m.id, m.contact_visibility, mi.minor) as contact_ok,
    public.can_see_field(m.family_id, m.branch_id, m.id, m.photo_visibility, mi.minor) as photo_ok,
    public.can_edit_member(m.family_id, m.branch_id, m.id) as edit_ok
  ) v
where m.deleted_at is null and public.has_permission(m.family_id, 'members', 'view');

create or replace view public.member_parent_links_v as
select l.id, l.family_id, l.child_id, l.parent_id, l.kind
from public.member_parent_links l
where l.deleted_at is null and public.has_permission(l.family_id, 'tree', 'view')
  and exists (select 1 from public.family_members c where c.id = l.child_id and c.deleted_at is null)
  and exists (select 1 from public.family_members p where p.id = l.parent_id and p.deleted_at is null);

create or replace view public.member_partnerships_v as
select p.id, p.family_id, p.member_a, p.member_b, p.status, p.start_year, p.end_year
from public.member_partnerships p
where p.deleted_at is null and public.has_permission(p.family_id, 'tree', 'view')
  and exists (select 1 from public.family_members c where c.id = p.member_a and c.deleted_at is null)
  and exists (select 1 from public.family_members c where c.id = p.member_b and c.deleted_at is null);

create or replace view public.members_trash_v as
select m.id, m.family_id, m.full_name, m.deleted_at
from public.family_members m
where m.deleted_at is not null and public.has_permission(m.family_id, 'members', 'delete');

-- ---------- Ham noi bo (khong kiem tra quyen; chi goi tu ham cong khai) ----------
create or replace function public._check_branch(p_family uuid, p_branch uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_branch is not null and not exists (
    select 1 from public.branches b where b.id = p_branch and b.family_id = p_family and b.deleted_at is null) then
    raise exception 'branch does not belong to family' using errcode = '22023';
  end if;
end $$;

create or replace function public._member_insert(p_family uuid, p_data jsonb, p_actor uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if nullif(btrim(p_data->>'full_name'), '') is null then
    raise exception 'full_name is required' using errcode = '22023';
  end if;
  perform public._check_branch(p_family, nullif(p_data->>'branch_id','')::uuid);
  insert into public.family_members (family_id, created_by, branch_id, full_name, nickname, gender, avatar_path, birth_solar_year, birth_solar_month, birth_solar_day, birth_lunar_year, birth_lunar_month, birth_lunar_day, birth_lunar_leap, birthday_mode, is_deceased, death_solar_year, death_solar_month, death_solar_day, death_lunar_month, death_lunar_day, death_lunar_leap, hometown, generation_title, generation_no, bio, phone, email, birth_visibility, death_visibility, contact_visibility, photo_visibility)
  values (p_family, p_actor,
    nullif(p_data->>'branch_id','')::uuid,
    nullif(btrim(p_data->>'full_name'),''),
    nullif(btrim(p_data->>'nickname'),''),
    nullif(btrim(p_data->>'gender'),''),
    nullif(btrim(p_data->>'avatar_path'),''),
    nullif(p_data->>'birth_solar_year','')::smallint,
    nullif(p_data->>'birth_solar_month','')::smallint,
    nullif(p_data->>'birth_solar_day','')::smallint,
    nullif(p_data->>'birth_lunar_year','')::smallint,
    nullif(p_data->>'birth_lunar_month','')::smallint,
    nullif(p_data->>'birth_lunar_day','')::smallint,
    coalesce((p_data->>'birth_lunar_leap')::boolean, false),
    coalesce(nullif(p_data->>'birthday_mode',''), 'solar'),
    coalesce((p_data->>'is_deceased')::boolean, false),
    nullif(p_data->>'death_solar_year','')::smallint,
    nullif(p_data->>'death_solar_month','')::smallint,
    nullif(p_data->>'death_solar_day','')::smallint,
    nullif(p_data->>'death_lunar_month','')::smallint,
    nullif(p_data->>'death_lunar_day','')::smallint,
    coalesce((p_data->>'death_lunar_leap')::boolean, false),
    nullif(btrim(p_data->>'hometown'),''),
    nullif(btrim(p_data->>'generation_title'),''),
    nullif(p_data->>'generation_no','')::smallint,
    nullif(btrim(p_data->>'bio'),''),
    nullif(btrim(p_data->>'phone'),''),
    nullif(btrim(p_data->>'email'),''),
    coalesce(nullif(p_data->>'birth_visibility',''), 'family'),
    coalesce(nullif(p_data->>'death_visibility',''), 'family'),
    coalesce(nullif(p_data->>'contact_visibility',''), 'branch'),
    coalesce(nullif(p_data->>'photo_visibility',''), 'family'))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public._member_update(p_member uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_family uuid;
begin
  select family_id into v_family from public.family_members where id = p_member and deleted_at is null;
  if v_family is null then raise exception 'member not found' using errcode = 'P0002'; end if;
  if p_data ? 'branch_id' then
    perform public._check_branch(v_family, nullif(p_data->>'branch_id','')::uuid);
  end if;
  update public.family_members set
      branch_id = case when p_data ? 'branch_id' then nullif(p_data->>'branch_id','')::uuid else branch_id end,
      full_name = case when p_data ? 'full_name' then nullif(btrim(p_data->>'full_name'),'') else full_name end,
      nickname = case when p_data ? 'nickname' then nullif(btrim(p_data->>'nickname'),'') else nickname end,
      gender = case when p_data ? 'gender' then nullif(btrim(p_data->>'gender'),'') else gender end,
      avatar_path = case when p_data ? 'avatar_path' then nullif(btrim(p_data->>'avatar_path'),'') else avatar_path end,
      birth_solar_year = case when p_data ? 'birth_solar_year' then nullif(p_data->>'birth_solar_year','')::smallint else birth_solar_year end,
      birth_solar_month = case when p_data ? 'birth_solar_month' then nullif(p_data->>'birth_solar_month','')::smallint else birth_solar_month end,
      birth_solar_day = case when p_data ? 'birth_solar_day' then nullif(p_data->>'birth_solar_day','')::smallint else birth_solar_day end,
      birth_lunar_year = case when p_data ? 'birth_lunar_year' then nullif(p_data->>'birth_lunar_year','')::smallint else birth_lunar_year end,
      birth_lunar_month = case when p_data ? 'birth_lunar_month' then nullif(p_data->>'birth_lunar_month','')::smallint else birth_lunar_month end,
      birth_lunar_day = case when p_data ? 'birth_lunar_day' then nullif(p_data->>'birth_lunar_day','')::smallint else birth_lunar_day end,
      birth_lunar_leap = case when p_data ? 'birth_lunar_leap' then coalesce((p_data->>'birth_lunar_leap')::boolean, false) else birth_lunar_leap end,
      birthday_mode = case when p_data ? 'birthday_mode' then coalesce(nullif(p_data->>'birthday_mode',''), 'solar') else birthday_mode end,
      is_deceased = case when p_data ? 'is_deceased' then coalesce((p_data->>'is_deceased')::boolean, false) else is_deceased end,
      death_solar_year = case when p_data ? 'death_solar_year' then nullif(p_data->>'death_solar_year','')::smallint else death_solar_year end,
      death_solar_month = case when p_data ? 'death_solar_month' then nullif(p_data->>'death_solar_month','')::smallint else death_solar_month end,
      death_solar_day = case when p_data ? 'death_solar_day' then nullif(p_data->>'death_solar_day','')::smallint else death_solar_day end,
      death_lunar_month = case when p_data ? 'death_lunar_month' then nullif(p_data->>'death_lunar_month','')::smallint else death_lunar_month end,
      death_lunar_day = case when p_data ? 'death_lunar_day' then nullif(p_data->>'death_lunar_day','')::smallint else death_lunar_day end,
      death_lunar_leap = case when p_data ? 'death_lunar_leap' then coalesce((p_data->>'death_lunar_leap')::boolean, false) else death_lunar_leap end,
      hometown = case when p_data ? 'hometown' then nullif(btrim(p_data->>'hometown'),'') else hometown end,
      generation_title = case when p_data ? 'generation_title' then nullif(btrim(p_data->>'generation_title'),'') else generation_title end,
      generation_no = case when p_data ? 'generation_no' then nullif(p_data->>'generation_no','')::smallint else generation_no end,
      bio = case when p_data ? 'bio' then nullif(btrim(p_data->>'bio'),'') else bio end,
      phone = case when p_data ? 'phone' then nullif(btrim(p_data->>'phone'),'') else phone end,
      email = case when p_data ? 'email' then nullif(btrim(p_data->>'email'),'') else email end,
      birth_visibility = case when p_data ? 'birth_visibility' then coalesce(nullif(p_data->>'birth_visibility',''), 'family') else birth_visibility end,
      death_visibility = case when p_data ? 'death_visibility' then coalesce(nullif(p_data->>'death_visibility',''), 'family') else death_visibility end,
      contact_visibility = case when p_data ? 'contact_visibility' then coalesce(nullif(p_data->>'contact_visibility',''), 'branch') else contact_visibility end,
      photo_visibility = case when p_data ? 'photo_visibility' then coalesce(nullif(p_data->>'photo_visibility',''), 'family') else photo_visibility end
  where id = p_member;
end $$;

create or replace function public._add_parent_link(p_child uuid, p_parent uuid, p_kind text, p_actor uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_family uuid; v_id uuid;
begin
  select family_id into v_family from public.family_members where id = p_child and deleted_at is null;
  if v_family is null then raise exception 'member not found' using errcode = 'P0002'; end if;
  if p_kind not in ('biological','adoptive','step') then raise exception 'bad kind' using errcode = '22023'; end if;
  if exists (select 1 from public.member_parent_links l where l.child_id = p_child and l.parent_id = p_parent and l.deleted_at is null) then
    raise exception 'relationship already exists' using errcode = 'P0001';
  end if;
  if p_kind = 'biological' and (select count(*) from public.member_parent_links l
       where l.child_id = p_child and l.kind = 'biological' and l.deleted_at is null) >= 2 then
    raise exception 'a member can have at most two biological parents' using errcode = 'P0001';
  end if;
  insert into public.member_parent_links (family_id, child_id, parent_id, kind, created_by)
  values (v_family, p_child, p_parent, p_kind, p_actor) returning id into v_id;
  return v_id;
end $$;

create or replace function public._add_partnership(p_x uuid, p_y uuid, p_status text, p_start smallint, p_end smallint, p_actor uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_family uuid; v_a uuid; v_b uuid; v_id uuid;
begin
  if p_x = p_y then raise exception 'cannot partner with oneself' using errcode = '22023'; end if;
  v_a := least(p_x, p_y); v_b := greatest(p_x, p_y);
  select family_id into v_family from public.family_members where id = v_a and deleted_at is null;
  if v_family is null then raise exception 'member not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.member_partnerships p where p.member_a = v_a and p.member_b = v_b and p.deleted_at is null) then
    raise exception 'relationship already exists' using errcode = 'P0001';
  end if;
  insert into public.member_partnerships (family_id, member_a, member_b, status, start_year, end_year, created_by)
  values (v_family, v_a, v_b, coalesce(p_status, 'married'), p_start, p_end, p_actor) returning id into v_id;
  return v_id;
end $$;

-- ---------- Ham cong khai ----------
create or replace function public.create_member(p_family uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_branch uuid := nullif(p_data->>'branch_id','')::uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.can_edit_members(p_family, v_branch) then raise exception 'forbidden' using errcode = '42501'; end if;
  v_id := public._member_insert(p_family, p_data, auth.uid());
  return v_id;
end $$;

create or replace function public.update_member(p_member uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare m public.family_members; v_self boolean; v_admin boolean; v_new_branch uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into m from public.family_members where id = p_member and deleted_at is null;
  if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
  v_self := coalesce(public.my_member_id(m.family_id) = m.id and public.my_role(m.family_id) <> 'guest', false);
  if not (v_self or public.can_edit_members(m.family_id, m.branch_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_data ? 'branch_id' and nullif(p_data->>'branch_id','')::uuid is distinct from m.branch_id then
    -- Doi nhanh chi danh cho admin co quyen o ca nhanh cu va nhanh moi
    v_new_branch := nullif(p_data->>'branch_id','')::uuid;
    v_admin := public.has_permission(m.family_id, 'members', 'update', m.branch_id)
               and (v_new_branch is null and public.has_permission(m.family_id, 'members', 'update', null)
                    or v_new_branch is not null and public.has_permission(m.family_id, 'members', 'update', v_new_branch));
    if not v_admin then raise exception 'forbidden' using errcode = '42501'; end if;
  end if;
  perform public._member_update(p_member, p_data);
end $$;

create or replace function public.delete_member(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.family_members;
begin
  select * into m from public.family_members where id = p_member and deleted_at is null;
  if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
  if not public.has_permission(m.family_id, 'members', 'delete', m.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.family_memberships fm where fm.member_id = p_member and fm.status = 'active') then
    raise exception 'member is linked to an active account; unlink first' using errcode = 'P0001';
  end if;
  update public.family_members set deleted_at = now() where id = p_member;
end $$;

create or replace function public.restore_member(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.family_members;
begin
  select * into m from public.family_members where id = p_member and deleted_at is not null;
  if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
  if not public.has_permission(m.family_id, 'members', 'delete', m.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.family_members set deleted_at = null where id = p_member;
end $$;

create or replace function public.add_parent_link(p_child uuid, p_parent uuid, p_kind text default 'biological') returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.family_members;
begin
  select * into c from public.family_members where id = p_child and deleted_at is null;
  if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
  if not public.can_edit_members(c.family_id, c.branch_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  return public._add_parent_link(p_child, p_parent, p_kind, auth.uid());
end $$;

create or replace function public.remove_parent_link(p_link uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l public.member_parent_links; c public.family_members;
begin
  select * into l from public.member_parent_links where id = p_link and deleted_at is null;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  select * into c from public.family_members where id = l.child_id;
  if not public.can_edit_members(l.family_id, c.branch_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.member_parent_links set deleted_at = now() where id = p_link;
end $$;

create or replace function public.add_partnership(p_x uuid, p_y uuid, p_status text default 'married',
  p_start smallint default null, p_end smallint default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare x public.family_members; y public.family_members;
begin
  select * into x from public.family_members where id = p_x and deleted_at is null;
  select * into y from public.family_members where id = p_y and deleted_at is null;
  if x.id is null or y.id is null or x.family_id <> y.family_id then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  if not (public.can_edit_members(x.family_id, x.branch_id) or public.can_edit_members(y.family_id, y.branch_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public._add_partnership(p_x, p_y, p_status, p_start, p_end, auth.uid());
end $$;

create or replace function public.update_partnership(p_id uuid, p_status text, p_start smallint default null, p_end smallint default null)
returns void
language plpgsql security definer set search_path = public as $$
declare p public.member_partnerships; x public.family_members;
begin
  select * into p from public.member_partnerships where id = p_id and deleted_at is null;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  select * into x from public.family_members where id = p.member_a;
  if not public.can_edit_members(p.family_id, x.branch_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.member_partnerships set status = coalesce(p_status, status), start_year = p_start, end_year = p_end where id = p_id;
end $$;

create or replace function public.remove_partnership(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.member_partnerships; x public.family_members;
begin
  select * into p from public.member_partnerships where id = p_id and deleted_at is null;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  select * into x from public.family_members where id = p.member_a;
  if not public.can_edit_members(p.family_id, x.branch_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.member_partnerships set deleted_at = now() where id = p_id;
end $$;

create or replace function public.link_membership_member(p_membership uuid, p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare fm public.family_memberships;
begin
  select * into fm from public.family_memberships where id = p_membership for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if not public.has_permission(fm.family_id, 'roles', 'update') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_member is not null and not exists (
       select 1 from public.family_members m where m.id = p_member and m.family_id = fm.family_id and m.deleted_at is null) then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  update public.family_memberships set member_id = p_member where id = p_membership;
  perform public.write_audit(fm.family_id, 'membership.link_member', 'membership', p_membership::text,
    jsonb_build_object('member_id', fm.member_id), jsonb_build_object('member_id', p_member));
end $$;

-- ---------- Yeu cau sua / duyet ----------
create or replace function public.submit_change_request(p_family uuid, p_kind text, p_target uuid, p_payload jsonb, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_branch uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if public.my_role(p_family) is null or public.my_role(p_family) = 'guest' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind not in ('update_member','create_member','delete_member','add_parent','add_partner','remove_link') then
    raise exception 'bad kind' using errcode = '22023';
  end if;
  if p_kind in ('update_member','delete_member') then
    select m.branch_id into v_branch from public.family_members m
      where m.id = p_target and m.family_id = p_family and m.deleted_at is null;
    if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
  elsif p_kind = 'create_member' then
    v_branch := nullif(p_payload->>'branch_id','')::uuid;
  elsif p_kind = 'add_parent' then
    select m.branch_id into v_branch from public.family_members m
      where m.id = nullif(p_payload->>'child_id','')::uuid and m.family_id = p_family and m.deleted_at is null;
    if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
  elsif p_kind = 'add_partner' then
    select m.branch_id into v_branch from public.family_members m
      where m.id = nullif(p_payload->>'a_id','')::uuid and m.family_id = p_family and m.deleted_at is null;
    if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
  elsif p_kind = 'remove_link' then
    select m.branch_id into v_branch from public.member_parent_links l
      join public.family_members m on m.id = l.child_id
      where l.id = nullif(p_payload->>'link_id','')::uuid and l.family_id = p_family and l.deleted_at is null;
    if not found then
      select m.branch_id into v_branch from public.member_partnerships pt
        join public.family_members m on m.id = pt.member_a
        where pt.id = nullif(p_payload->>'partnership_id','')::uuid and pt.family_id = p_family and pt.deleted_at is null;
      if not found then raise exception 'link not found' using errcode = 'P0002'; end if;
    end if;
  end if;
  insert into public.member_change_requests (family_id, requested_by, kind, target_member_id, branch_id, payload, note)
  values (p_family, auth.uid(), p_kind, p_target, v_branch, coalesce(p_payload, '{}'::jsonb), left(p_note, 1000))
  returning id into v_id;
  perform public.write_audit(p_family, 'change_request.submit', 'change_request', v_id::text, null,
    jsonb_build_object('kind', p_kind, 'target', p_target));
  return v_id;
end $$;

create or replace function public.cancel_change_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.member_change_requests set status = 'cancelled'
    where id = p_id and requested_by = auth.uid() and status = 'pending';
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
end $$;

create or replace function public.review_change_request(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.member_change_requests;
begin
  select * into r from public.member_change_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'not found' using errcode = 'P0002'; end if;
  if not public.has_permission(r.family_id, 'members', 'approve', r.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_approve then
    case r.kind
      when 'update_member' then
        if r.payload ? 'branch_id' and not public.has_permission(r.family_id, 'members', 'approve', nullif(r.payload->>'branch_id','')::uuid) then
          raise exception 'forbidden' using errcode = '42501';
        end if;
        perform public._member_update(r.target_member_id, r.payload);
      when 'create_member' then perform public._member_insert(r.family_id, r.payload, r.requested_by);
      when 'delete_member' then
        if exists (select 1 from public.family_memberships fm where fm.member_id = r.target_member_id and fm.status = 'active') then
          raise exception 'member is linked to an active account; unlink first' using errcode = 'P0001';
        end if;
        update public.family_members set deleted_at = now() where id = r.target_member_id and deleted_at is null;
      when 'add_parent' then
        perform public._add_parent_link((r.payload->>'child_id')::uuid, (r.payload->>'parent_id')::uuid,
                                        coalesce(r.payload->>'kind', 'biological'), r.requested_by);
      when 'add_partner' then
        perform public._add_partnership((r.payload->>'a_id')::uuid, (r.payload->>'b_id')::uuid,
                                        r.payload->>'status', nullif(r.payload->>'start_year','')::smallint,
                                        nullif(r.payload->>'end_year','')::smallint, r.requested_by);
      when 'remove_link' then
        update public.member_parent_links set deleted_at = now()
          where id = nullif(r.payload->>'link_id','')::uuid and deleted_at is null;
        update public.member_partnerships set deleted_at = now()
          where id = nullif(r.payload->>'partnership_id','')::uuid and deleted_at is null;
    end case;
  end if;
  update public.member_change_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(p_note, 1000)
    where id = p_id;
  perform public.write_audit(r.family_id, 'change_request.' || case when p_approve then 'approve' else 'reject' end,
    'change_request', p_id::text, null, jsonb_build_object('kind', r.kind));
end $$;

-- ---------- Nhap / xuat gia pha (JSON) ----------
create or replace function public.export_family_tree(p_family uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission(p_family, 'tree', 'export') then raise exception 'forbidden' using errcode = '42501'; end if;
  perform public.write_audit(p_family, 'tree.export', 'family', p_family::text, null, null);
  return jsonb_build_object(
    'version', 1,
    'exported_at', now(),
    'members', coalesce((select jsonb_agg(((to_jsonb(m) - 'family_id' - 'created_by' - 'deleted_at' - 'created_at' - 'updated_at' - 'branch_id')
                                          || jsonb_build_object('branch', (select b.name from public.branches b where b.id = m.branch_id)))
                                          order by m.created_at)
                         from public.family_members m where m.family_id = p_family and m.deleted_at is null), '[]'::jsonb),
    'parents', coalesce((select jsonb_agg(jsonb_build_object('child', l.child_id, 'parent', l.parent_id, 'kind', l.kind))
                         from public.member_parent_links l where l.family_id = p_family and l.deleted_at is null), '[]'::jsonb),
    'partners', coalesce((select jsonb_agg(jsonb_build_object('a', p.member_a, 'b', p.member_b, 'status', p.status,
                            'start_year', p.start_year, 'end_year', p.end_year))
                         from public.member_partnerships p where p.family_id = p_family and p.deleted_at is null), '[]'::jsonb));
end $$;

create or replace function public.import_family_tree(p_family uuid, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_map jsonb := '{}'::jsonb; mem jsonb; v_id uuid; v_branch uuid; v_data jsonb;
  v_members int := 0; v_parents int := 0; v_partners int := 0; e jsonb;
begin
  -- Nhap du lieu: chi quan tri toan gia dinh (khong gioi han theo nhanh)
  if not public.has_permission(p_family, 'tree', 'update') then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_data->'members') is distinct from 'array' then raise exception 'members must be an array' using errcode = '22023'; end if;
  if jsonb_array_length(p_data->'members') > 2000 then raise exception 'too many members (max 2000)' using errcode = '22023'; end if;

  for mem in select * from jsonb_array_elements(p_data->'members') loop
    if mem->>'id' is null then raise exception 'every member needs an id' using errcode = '22023'; end if;
    v_branch := null;
    if nullif(mem->>'branch','') is not null then
      select b.id into v_branch from public.branches b
        where b.family_id = p_family and b.deleted_at is null and lower(b.name) = lower(mem->>'branch') limit 1;
    end if;
    v_data := (mem - 'id' - 'branch') || jsonb_build_object('branch_id', v_branch);
    v_id := public._member_insert(p_family, v_data, auth.uid());
    v_map := v_map || jsonb_build_object(mem->>'id', v_id);
    v_members := v_members + 1;
  end loop;

  for e in select * from jsonb_array_elements(coalesce(p_data->'parents', '[]'::jsonb)) loop
    if not (v_map ? (e->>'child') and v_map ? (e->>'parent')) then
      raise exception 'parent link refers to an unknown member' using errcode = '22023';
    end if;
    perform public._add_parent_link((v_map->>(e->>'child'))::uuid, (v_map->>(e->>'parent'))::uuid,
                                    coalesce(e->>'kind', 'biological'), auth.uid());
    v_parents := v_parents + 1;
  end loop;

  for e in select * from jsonb_array_elements(coalesce(p_data->'partners', '[]'::jsonb)) loop
    if not (v_map ? (e->>'a') and v_map ? (e->>'b')) then
      raise exception 'partnership refers to an unknown member' using errcode = '22023';
    end if;
    perform public._add_partnership((v_map->>(e->>'a'))::uuid, (v_map->>(e->>'b'))::uuid, e->>'status',
                                    nullif(e->>'start_year','')::smallint, nullif(e->>'end_year','')::smallint, auth.uid());
    v_partners := v_partners + 1;
  end loop;

  perform public.write_audit(p_family, 'tree.import', 'family', p_family::text, null,
    jsonb_build_object('members', v_members, 'parents', v_parents, 'partners', v_partners));
  return jsonb_build_object('members', v_members, 'parents', v_parents, 'partners', v_partners);
end $$;

-- ---------- RLS + cap quyen ----------
alter table public.family_members enable row level security;
alter table public.member_parent_links enable row level security;
alter table public.member_partnerships enable row level security;
alter table public.member_change_requests enable row level security;

-- Bang goc khong co chinh sach nao cho vai tro nguoi dung: truy cap chi qua view/ham o tren.
create policy change_requests_select on public.member_change_requests for select to authenticated
  using ((requested_by = auth.uid() and public.is_family_member(family_id))
         or public.has_permission(family_id, 'members', 'approve', branch_id));

revoke all on public.family_members, public.member_parent_links, public.member_partnerships,
  public.member_change_requests from anon, authenticated;
grant select on public.member_change_requests to authenticated;

revoke all on public.members_view, public.member_parent_links_v, public.member_partnerships_v, public.members_trash_v from anon, authenticated;
grant select on public.members_view, public.member_parent_links_v, public.member_partnerships_v, public.members_trash_v to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
-- cap lai toan bo ham da duoc cap truoc do (migration 3) + ham moi
grant execute on function
  public.is_family_member(uuid), public.shares_family(uuid), public.branch_in_scope(uuid, uuid),
  public.has_permission(uuid, text, text, uuid), public.my_role(uuid),
  public.create_invitation(uuid, text, text, uuid, uuid, int), public.revoke_invitation(uuid),
  public.set_member_role(uuid, text, uuid), public.revoke_membership(uuid),
  public.is_editing_open(uuid, uuid), public.set_editing_mode(uuid, uuid, text, timestamptz),
  public.my_member_id(uuid), public.can_edit_members(uuid, uuid), public.can_edit_member(uuid, uuid, uuid),
  public.member_is_minor(int, int, int), public.can_see_field(uuid, uuid, uuid, text, boolean),
  public.create_member(uuid, jsonb), public.update_member(uuid, jsonb), public.delete_member(uuid), public.restore_member(uuid),
  public.add_parent_link(uuid, uuid, text), public.remove_parent_link(uuid),
  public.add_partnership(uuid, uuid, text, smallint, smallint), public.update_partnership(uuid, text, smallint, smallint),
  public.remove_partnership(uuid), public.link_membership_member(uuid, uuid),
  public.submit_change_request(uuid, text, uuid, jsonb, text), public.cancel_change_request(uuid),
  public.review_change_request(uuid, boolean, text), public.export_family_tree(uuid), public.import_family_tree(uuid, jsonb)
  to authenticated;
grant execute on function public.peek_invitation(text), public.redeem_invitation(text, uuid, text),
  public.bootstrap_family(text, uuid, text) to service_role;

-- Quyen moi cho cac module nay (family_admin da co moi quyen tren module 'tree', 'members')
-- Thanh vien thuong: duoc gui yeu cau sua (khong can quyen rieng; kiem tra trong ham)
