-- Module Thanh vien & Gia pha (giao dien) / migration 3: hai ham mong phuc vu giao dien
--  1) member_field_access: cho biet nguoi dung hien tai co duoc XEM tung nhom truong (ngay sinh, ngay mat, lien he, anh)
--     cua mot ho so hay khong. members_view tra NULL ca khi "bi che" lan "chua nhap" -> giao dien khong phan biet duoc;
--     neu khong biet, form sua se ghi de NULL len du lieu dang bi che. Ham nay chi tra 4 gia tri dung/sai (khong lo du lieu).
--  2) log_members_export: ghi nhat ky khi xuat CSV danh sach thanh vien (xuat JSON da duoc export_family_tree ghi san).
-- Khong dong cham toi migration cu.

create or replace function public.member_field_access(p_member uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m public.family_members; v_minor boolean;
begin
  if auth.uid() is null then return null; end if;
  select * into m from public.family_members where id = p_member and deleted_at is null;
  if not found then return null; end if;
  -- Cung dieu kien nhu members_view: phai co quyen xem module thanh vien trong gia dinh cua ho so
  if not coalesce(public.has_permission(m.family_id, 'members', 'view'), false) then return null; end if;
  v_minor := public.member_is_minor(m.birth_solar_year, m.birth_solar_month, m.birth_solar_day);
  return jsonb_build_object(
    'birth',   coalesce(public.can_see_field(m.family_id, m.branch_id, m.id, m.birth_visibility, v_minor), false),
    'death',   coalesce(public.can_see_field(m.family_id, m.branch_id, m.id, m.death_visibility, false), false),
    'contact', coalesce(public.can_see_field(m.family_id, m.branch_id, m.id, m.contact_visibility, v_minor), false),
    'photo',   coalesce(public.can_see_field(m.family_id, m.branch_id, m.id, m.photo_visibility, v_minor), false));
end $$;

create or replace function public.log_members_export(p_family uuid, p_rows int default 0) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not coalesce(public.has_permission(p_family, 'members', 'export'), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.write_audit(p_family, 'members.export_csv', 'family', p_family::text, null,
    jsonb_build_object('rows', greatest(coalesce(p_rows, 0), 0)));
end $$;

-- Cap quyen toi thieu: chi nguoi dung da dang nhap (ham tu kiem tra quyen ben trong)
grant execute on function public.member_field_access(uuid), public.log_members_export(uuid, int) to authenticated;
