-- Dot 1 / migration 3: ham kiem tra quyen, ham nghiep vu, RLS va cap quyen
-- Nguyen tac: moi quyen duoc quyet dinh o day (CSDL). Giao dien chi an nut cho dep.

-- ---------- Ham tien ich (security definer de tranh de quy RLS) ----------
create or replace function public.is_family_member(p_family uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_memberships m
    where m.user_id = auth.uid() and m.family_id = p_family and m.status = 'active');
$$;

create or replace function public.shares_family(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.family_memberships a
    join public.family_memberships b on b.family_id = a.family_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = p_user and b.status = 'active');
$$;

-- p_branch nam trong nhanh p_scope (hoac chinh no hoac nhanh con)?
create or replace function public.branch_in_scope(p_scope uuid, p_branch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive up(id, parent_branch_id) as (
    select b.id, b.parent_branch_id from public.branches b
      where b.id = p_branch and b.deleted_at is null
    union
    select b.id, b.parent_branch_id from public.branches b
      join up on b.id = up.parent_branch_id where b.deleted_at is null
  )
  select exists (select 1 from up where id = p_scope);
$$;

-- ---------- Ham kiem tra quyen duy nhat ----------
create or replace function public.has_permission(
  p_family uuid, p_module text, p_action text, p_branch uuid default null
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text; v_scope uuid; v_limited boolean;
begin
  if auth.uid() is null then return false; end if;
  select m.role_key, m.branch_id into v_role, v_scope
    from public.family_memberships m
    where m.user_id = auth.uid() and m.family_id = p_family and m.status = 'active';
  if v_role is null then return false; end if;
  if v_role = 'super_admin' then return true; end if;
  if not exists (select 1 from public.role_permissions rp
                 where rp.role_key = v_role and rp.module = p_module and rp.action = p_action) then
    return false;
  end if;
  select r.scope_limited into v_limited from public.roles r where r.key = v_role;
  if v_limited then
    if p_action = 'view' and p_branch is null then return true; end if;
    if p_branch is null or v_scope is null then return false; end if;
    return public.branch_in_scope(v_scope, p_branch);
  end if;
  return true;
end $$;

create or replace function public.my_role(p_family uuid) returns text
language sql stable security definer set search_path = public as $$
  select m.role_key from public.family_memberships m
  where m.user_id = auth.uid() and m.family_id = p_family and m.status = 'active';
$$;

-- ---------- Nhat ky ----------
create or replace function public.write_audit(
  p_family uuid, p_action text, p_entity_type text, p_entity_id text,
  p_before jsonb, p_after jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_logs (family_id, actor_id, action, entity_type, entity_id, before_data, after_data)
  values (p_family, auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after);
$$;

-- ---------- Khong cho mat Super Admin cuoi cung ----------
create or replace function public.guard_last_super_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role_key = 'super_admin' and old.status = 'active'
     and (tg_op = 'DELETE' or new.status <> 'active' or new.role_key <> 'super_admin') then
    if not exists (
      select 1 from public.family_memberships m
      where m.family_id = old.family_id and m.id <> old.id
        and m.role_key = 'super_admin' and m.status = 'active') then
      raise exception 'cannot remove the last active super_admin of a family' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger memberships_guard_last_super_admin
  before update or delete on public.family_memberships
  for each row execute function public.guard_last_super_admin();

-- ---------- Loi moi ----------
create or replace function public.create_invitation(
  p_family uuid, p_email text, p_role text,
  p_branch uuid default null, p_member_id uuid default null, p_ttl_hours int default 168
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text; v_email text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.roles where key = p_role) then
    raise exception 'unknown role' using errcode = '22023';
  end if;
  if p_ttl_hours is null or p_ttl_hours < 1 or p_ttl_hours > 720 then
    raise exception 'ttl must be between 1 and 720 hours' using errcode = '22023';
  end if;
  if p_branch is not null and not exists (
       select 1 from public.branches b
       where b.id = p_branch and b.family_id = p_family and b.deleted_at is null) then
    raise exception 'branch does not belong to family' using errcode = '22023';
  end if;
  if p_role = 'branch_admin' and p_branch is null then
    raise exception 'branch_admin needs a branch' using errcode = '22023';
  end if;

  if p_role in ('super_admin','family_admin','branch_admin') then
    -- Chi Super Admin duoc moi admin
    if public.my_role(p_family) is distinct from 'super_admin' then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else
    if not public.has_permission(p_family, 'invitations', 'create', p_branch) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  v_email := nullif(lower(btrim(p_email)), '');
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (family_id, email, token_hash, role_key, branch_id, member_id,
                                  expires_at, created_by)
  values (p_family, v_email, encode(extensions.digest(v_token, 'sha256'), 'hex'), p_role, p_branch,
          p_member_id, now() + make_interval(hours => p_ttl_hours), auth.uid())
  returning id into v_id;

  perform public.write_audit(p_family, 'invitation.create', 'invitation', v_id::text, null,
    jsonb_build_object('email', v_email, 'role', p_role, 'branch_id', p_branch));
  return v_token;
end $$;

create or replace function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.invitations;
begin
  select * into v from public.invitations where id = p_invitation for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if v.role_key in ('super_admin','family_admin','branch_admin') then
    if public.my_role(v.family_id) is distinct from 'super_admin' then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif not public.has_permission(v.family_id, 'invitations', 'delete', v.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.invitations set status = 'revoked' where id = p_invitation and status = 'pending';
  perform public.write_audit(v.family_id, 'invitation.revoke', 'invitation', p_invitation::text,
    jsonb_build_object('status', v.status), jsonb_build_object('status', 'revoked'));
end $$;

-- Chi service_role (route handler phia may chu) goi duoc hai ham duoi day
create or replace function public.peek_invitation(p_token text)
returns table (family_name text, role_key text, email text, expires_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select f.name, i.role_key, i.email, i.expires_at
  from public.invitations i join public.families f on f.id = i.family_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.status = 'pending' and i.expires_at > now() and i.used_count < i.max_uses;
$$;

create or replace function public.redeem_invitation(p_token text, p_user_id uuid, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v public.invitations; v_email text; v_membership uuid;
begin
  select * into v from public.invitations
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found or v.status <> 'pending' or v.expires_at <= now() or v.used_count >= v.max_uses then
    raise exception 'invalid or expired invitation' using errcode = 'P0001';
  end if;
  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then raise exception 'user not found' using errcode = 'P0002'; end if;
  if v.email is not null and lower(v_email) <> v.email then
    raise exception 'invitation is for a different email' using errcode = '42501';
  end if;

  insert into public.user_profiles (id, display_name)
  values (p_user_id, left(btrim(p_display_name), 120))
  on conflict (id) do nothing;

  select m.id into v_membership from public.family_memberships m
    where m.user_id = p_user_id and m.family_id = v.family_id;
  if v_membership is not null then
    if exists (select 1 from public.family_memberships where id = v_membership and status = 'active') then
      raise exception 'already a member' using errcode = 'P0001';
    end if;
    update public.family_memberships
      set status = 'active', revoked_at = null, role_key = v.role_key,
          branch_id = v.branch_id, member_id = v.member_id
      where id = v_membership;
  else
    insert into public.family_memberships (user_id, family_id, role_key, branch_id, member_id)
    values (p_user_id, v.family_id, v.role_key, v.branch_id, v.member_id)
    returning id into v_membership;
  end if;

  update public.invitations
    set used_count = used_count + 1,
        status = case when used_count + 1 >= max_uses then 'accepted' else 'pending' end,
        accepted_by = p_user_id, accepted_at = now()
    where id = v.id;

  insert into public.audit_logs (family_id, actor_id, action, entity_type, entity_id, after_data)
  values (v.family_id, p_user_id, 'invitation.redeem', 'membership', v_membership::text,
          jsonb_build_object('role', v.role_key, 'invitation_id', v.id));
  return v_membership;
end $$;

-- Tao gia dinh va Super Admin dau tien (chay mot lan, bang service_role / SQL editor)
create or replace function public.bootstrap_family(p_name text, p_user_id uuid, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_family uuid;
begin
  if exists (select 1 from public.families) then
    raise exception 'already bootstrapped' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  insert into public.families (name) values (p_name) returning id into v_family;
  insert into public.user_profiles (id, display_name) values (p_user_id, p_display_name)
    on conflict (id) do nothing;
  insert into public.family_memberships (user_id, family_id, role_key)
    values (p_user_id, v_family, 'super_admin');
  insert into public.audit_logs (family_id, actor_id, action, entity_type, entity_id)
    values (v_family, p_user_id, 'family.bootstrap', 'family', v_family::text);
  return v_family;
end $$;

-- ---------- Quan ly vai tro (chi Super Admin voi vai tro admin) ----------
create or replace function public.set_member_role(p_membership uuid, p_role text, p_branch uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v public.family_memberships;
begin
  select * into v from public.family_memberships where id = p_membership for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if public.my_role(v.family_id) is distinct from 'super_admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.roles where key = p_role) then
    raise exception 'unknown role' using errcode = '22023';
  end if;
  if p_role = 'branch_admin' and (p_branch is null or not exists (
       select 1 from public.branches b where b.id = p_branch and b.family_id = v.family_id and b.deleted_at is null)) then
    raise exception 'branch_admin needs a valid branch' using errcode = '22023';
  end if;
  update public.family_memberships
    set role_key = p_role,
        branch_id = case when p_role = 'branch_admin' then p_branch else branch_id end
    where id = p_membership;
  perform public.write_audit(v.family_id, 'membership.set_role', 'membership', p_membership::text,
    jsonb_build_object('role', v.role_key, 'branch_id', v.branch_id),
    jsonb_build_object('role', p_role, 'branch_id', p_branch));
end $$;

create or replace function public.revoke_membership(p_membership uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.family_memberships;
begin
  select * into v from public.family_memberships where id = p_membership for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if v.user_id = auth.uid() then
    raise exception 'cannot revoke yourself' using errcode = '42501';
  end if;
  if v.role_key in ('super_admin','family_admin','branch_admin') then
    if public.my_role(v.family_id) is distinct from 'super_admin' then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif not public.has_permission(v.family_id, 'roles', 'update', v.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.family_memberships set status = 'revoked', revoked_at = now()
    where id = p_membership and status = 'active';
  perform public.write_audit(v.family_id, 'membership.revoke', 'membership', p_membership::text,
    jsonb_build_object('status', v.status, 'role', v.role_key), jsonb_build_object('status', 'revoked'));
end $$;

-- ---------- Khoa / mo khoa chinh sua ----------
create or replace function public.is_editing_open(p_family uuid, p_branch uuid default null) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare f public.families; b public.branches;
begin
  select * into f from public.families where id = p_family and deleted_at is null;
  if not found then return false; end if;
  if p_branch is not null then
    select * into b from public.branches where id = p_branch and family_id = p_family and deleted_at is null;
    if found and b.editing_mode is not null then
      return b.editing_mode = 'open' and (b.editing_open_until is null or b.editing_open_until > now());
    end if;
  end if;
  return f.editing_mode = 'open' and (f.editing_open_until is null or f.editing_open_until > now());
end $$;

create or replace function public.set_editing_mode(
  p_family uuid, p_branch uuid, p_mode text, p_until timestamptz default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_mode not in ('locked','open') then raise exception 'bad mode' using errcode = '22023'; end if;
  if p_until is not null and p_until <= now() then raise exception 'until must be in the future' using errcode = '22023'; end if;
  if not public.has_permission(p_family, 'editing', 'update', p_branch) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_branch is null then
    update public.families set editing_mode = p_mode, editing_open_until = p_until where id = p_family;
  else
    update public.branches set editing_mode = p_mode, editing_open_until = p_until
      where id = p_branch and family_id = p_family;
    if not found then raise exception 'branch not found' using errcode = 'P0002'; end if;
  end if;
  perform public.write_audit(p_family, 'editing.set_mode', case when p_branch is null then 'family' else 'branch' end,
    coalesce(p_branch, p_family)::text, null, jsonb_build_object('mode', p_mode, 'until', p_until));
end $$;

-- ---------- RLS ----------
alter table public.families enable row level security;
alter table public.branches enable row level security;
alter table public.user_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.family_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_logs enable row level security;

create policy families_select on public.families for select to authenticated
  using (deleted_at is null and public.is_family_member(id));
create policy families_update on public.families for update to authenticated
  using (public.has_permission(id, 'family', 'update'))
  with check (public.has_permission(id, 'family', 'update'));

create policy branches_select on public.branches for select to authenticated
  using (deleted_at is null and public.is_family_member(family_id));
create policy branches_write on public.branches for all to authenticated
  using (public.has_permission(family_id, 'family', 'update'))
  with check (public.has_permission(family_id, 'family', 'update'));

create policy profiles_select on public.user_profiles for select to authenticated
  using (id = auth.uid() or public.shares_family(id));
create policy profiles_update_own on public.user_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy roles_select on public.roles for select to authenticated using (true);
create policy permissions_select on public.permissions for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);

create policy memberships_select on public.family_memberships for select to authenticated
  using (user_id = auth.uid() or public.has_permission(family_id, 'roles', 'view'));

create policy invitations_select on public.invitations for select to authenticated
  using (public.has_permission(family_id, 'invitations', 'view', branch_id));

create policy audit_select on public.audit_logs for select to authenticated
  using (family_id is not null and public.has_permission(family_id, 'audit', 'view'));

-- ---------- Cap quyen: mac dinh tu choi, mo tung muc ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.families, public.branches, public.user_profiles, public.roles,
  public.permissions, public.role_permissions, public.family_memberships,
  public.invitations, public.audit_logs to authenticated;
grant update (name, logo_path, cover_path, primary_color, timezone, default_locale)
  on public.families to authenticated;
grant insert, update, delete on public.branches to authenticated;
grant update (display_name, avatar_path, locale) on public.user_profiles to authenticated;

grant execute on function
  public.is_family_member(uuid), public.shares_family(uuid), public.branch_in_scope(uuid, uuid),
  public.has_permission(uuid, text, text, uuid), public.my_role(uuid),
  public.create_invitation(uuid, text, text, uuid, uuid, int), public.revoke_invitation(uuid),
  public.set_member_role(uuid, text, uuid), public.revoke_membership(uuid),
  public.is_editing_open(uuid, uuid), public.set_editing_mode(uuid, uuid, text, timestamptz)
  to authenticated;

-- Ham chi danh cho may chu (service_role)
grant execute on function
  public.peek_invitation(text), public.redeem_invitation(text, uuid, text),
  public.bootstrap_family(text, uuid, text)
  to service_role;
