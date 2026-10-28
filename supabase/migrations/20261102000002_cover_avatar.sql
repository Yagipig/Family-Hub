-- Module Media / migration 2: anh bia gia dinh va anh dai dien thanh vien (chi ghi qua ham security definer)

-- families.cover_path chi doi qua set_family_cover (khong cho sua truc tiep chuoi duong dan tuy y)
revoke update (cover_path) on public.families from authenticated;

-- Ham noi bo: danh dau mot media la da xoa mem (khong dung lai khi con tham chieu khac)
create or replace function public._media_soft_delete(p_media uuid) returns void
language sql security definer set search_path = public as $$
  update public.media_items set deleted_at = coalesce(deleted_at, now()), deleted_by = coalesce(deleted_by, auth.uid())
  where id = p_media and deleted_at is null;
$$;

-- ---------- Anh bia / anh nen gia dinh (hien cho MOI thanh vien) ----------
create or replace function public.set_family_cover(p_family uuid, p_media uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f public.families; mi public.media_items; v_old_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not coalesce(public.has_permission(p_family, 'family', 'update'), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into f from public.families where id = p_family and deleted_at is null for update;
  if not found then raise exception 'family not found' using errcode = 'P0002'; end if;

  if p_media is not null then
    select * into mi from public.media_items where id = p_media;
    if not found or mi.family_id <> p_family or mi.kind <> 'cover' or mi.status <> 'ready'
       or mi.deleted_at is not null then
      raise exception 'invalid cover media' using errcode = '22023';
    end if;
  end if;

  select id into v_old_id from public.media_items
    where family_id = p_family and kind = 'cover' and path = f.cover_path and deleted_at is null;
  update public.families set cover_path = case when p_media is null then null else mi.path end where id = p_family;
  if v_old_id is not null and v_old_id is distinct from p_media then
    perform public._media_soft_delete(v_old_id);
  end if;
  perform public.write_audit(p_family, case when p_media is null then 'family.cover_clear' else 'family.cover_set' end,
    'family', p_family::text, jsonb_build_object('cover_path', f.cover_path),
    jsonb_build_object('cover_path', case when p_media is null then null else mi.path end));
end $$;

-- ---------- Anh dai dien thanh vien ----------
-- Chu ho so hoac nguoi duoc sua ho so (can_edit_member). Khach khong bao gio sua.
-- Che do hien thi (photo_visibility) do members_view/chinh sach doc lo lien quan; ham nay chi ghi.
create or replace function public.set_member_avatar(p_member uuid, p_media uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.family_members; mi public.media_items; v_old_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into m from public.family_members where id = p_member and deleted_at is null;
  if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
  if not coalesce(public.can_edit_member(m.family_id, m.branch_id, m.id), false)
     or public.my_role(m.family_id) is null or public.my_role(m.family_id) = 'guest' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_media is not null then
    select * into mi from public.media_items where id = p_media;
    if not found or mi.family_id <> m.family_id or mi.kind <> 'avatar' or mi.member_id <> m.id
       or mi.status <> 'ready' or mi.deleted_at is not null then
      raise exception 'invalid avatar media' using errcode = '22023';
    end if;
  end if;
  select id into v_old_id from public.media_items
    where family_id = m.family_id and kind = 'avatar' and member_id = m.id and path = m.avatar_path and deleted_at is null;
  -- Cap nhat qua UPDATE: trigger audit_row_change cua family_members tu ghi nhat ky
  update public.family_members set avatar_path = case when p_media is null then null else mi.path end where id = m.id;
  if v_old_id is not null and v_old_id is distinct from p_media then
    perform public._media_soft_delete(v_old_id);
  end if;
end $$;

grant execute on function public.set_family_cover(uuid, uuid), public.set_member_avatar(uuid, uuid) to authenticated;
