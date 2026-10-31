-- Admin phu (nguoi dung yeu cau 31/10/2026): Quan tri gia dinh (family_admin) duoc chi dinh
-- Quan tri nhanh (branch_admin) lam admin phu de cung duyet yeu cau cap nhat thong tin trong nhanh
-- (review_change_request von da kiem tra quyen members/approve theo nhanh).
-- Truoc day set_member_role chi cho super_admin dung.
-- Gioi han cua family_admin:
--   - chi duoc dat vai tro branch_admin / member / guest;
--   - chi tren tai khoan dang la branch_admin / member / guest (khong cham family_admin/super_admin);
--   - khong tu doi vai tro cua chinh minh; khong tao them family_admin (chi super_admin moi duoc).
-- Super admin giu nguyen toan quyen nhu truoc. branch_admin van bat buoc gan voi mot nhanh hop le.
create or replace function public.set_member_role(p_membership uuid, p_role text, p_branch uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v public.family_memberships; v_actor text;
begin
  select * into v from public.family_memberships where id = p_membership for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  v_actor := public.my_role(v.family_id);
  if v_actor = 'super_admin' then
    null; -- toan quyen nhu truoc
  elsif v_actor = 'family_admin' then
    if v.user_id = auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
    if v.role_key not in ('branch_admin', 'member', 'guest') then raise exception 'forbidden' using errcode = '42501'; end if;
    if p_role not in ('branch_admin', 'member', 'guest') then raise exception 'forbidden' using errcode = '42501'; end if;
  else
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
