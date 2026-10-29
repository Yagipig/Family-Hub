-- Migration 11: Thu tu hien thi tren cay gia pha do ADMIN sap xep.
-- - family_members.display_order: so thu tu admin dat cho tung nguoi trong nhom anh chi em
--   (NULL = chua sap xep tay -> giao dien xep theo nam sinh roi ten nhu truoc).
-- - members_view: them cot display_order o CUOI danh sach cot (create or replace view
--   chi cho phep them cot moi o cuoi, giu nguyen thu tu cac cot cu).
-- - sibling_move(p_member, p_dir): admin doi cho mot nguoi voi anh/chi/em lien ke
--   trong CUNG nhom (cung bo cha me; nguoi khong co cha me thuoc nhom goc cua gia dinh),
--   sau do chuan hoa lai display_order = 10, 20, 30... cho ca nhom.

alter table public.family_members add column if not exists display_order int;

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
  m.created_at, m.updated_at, m.alt_names,
  m.display_order
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

create or replace function public.sibling_move(p_member uuid, p_dir int) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.family_members;
  v_parents uuid[];
  v_ids uuid[];
  v_pos int;
  v_swap uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_dir is null or p_dir not in (-1, 1) then raise exception 'bad direction' using errcode = '22023'; end if;
  select * into m from public.family_members where id = p_member and deleted_at is null;
  if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
  if not public.has_permission(m.family_id, 'members', 'update', m.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select array_agg(l.parent_id order by l.parent_id) into v_parents
  from public.member_parent_links l
  where l.child_id = p_member and l.deleted_at is null;

  -- Nhom anh chi em: cung tap cha me (hoac cung khong co cha me = nhom goc).
  -- Thu tu hien tai: display_order (da xep tay len truoc) -> nam sinh -> ten.
  select array_agg(x.id order by x.ord_null, x.ord, x.by_null, x.by, x.nm, x.id) into v_ids
  from (
    select fm.id,
      (fm.display_order is null) as ord_null, fm.display_order as ord,
      (fm.birth_solar_year is null) as by_null, fm.birth_solar_year as by,
      fm.full_name as nm
    from public.family_members fm
    where fm.family_id = m.family_id and fm.deleted_at is null
      and (
        (v_parents is null and not exists (
          select 1 from public.member_parent_links l2
          where l2.child_id = fm.id and l2.deleted_at is null))
        or (v_parents is not null and (
          select array_agg(l3.parent_id order by l3.parent_id)
          from public.member_parent_links l3
          where l3.child_id = fm.id and l3.deleted_at is null) = v_parents)
      )
  ) x;

  v_pos := array_position(v_ids, p_member);
  if v_pos is null then raise exception 'member not found' using errcode = 'P0002'; end if;
  if (p_dir = -1 and v_pos <= 1) or (p_dir = 1 and v_pos >= array_length(v_ids, 1)) then
    raise exception 'already at edge' using errcode = 'P0001';
  end if;
  v_swap := v_ids[v_pos + p_dir];
  v_ids[v_pos] := v_swap;
  v_ids[v_pos + p_dir] := p_member;

  update public.family_members fm
  set display_order = t.idx * 10
  from unnest(v_ids) with ordinality as t(id, idx)
  where fm.id = t.id;

  perform public.write_audit(m.family_id, 'member.sibling_move', 'member', p_member::text, null,
    jsonb_build_object('with', v_swap, 'dir', p_dir));
end $$;

revoke all on function public.sibling_move(uuid, int) from public, anon;
grant execute on function public.sibling_move(uuid, int) to authenticated;
