-- Migration 13: Thanh vien sua thong tin LUU NGAY, khong cho duyet (chu truong nguoi dung chot 30/10/2026).
-- 1) Mo vinh vien "che do chinh sua" cho ca gia dinh: families.editing_mode='open' khong han;
--    cac nhanh de NULL = ke thua gia dinh (bo moi khoa rieng o nhanh).
--    Khi do can_edit_members() = true cho moi thanh vien (role member) -> cac nut
--    "De nghi chinh sua" tu bien thanh sua truc tiep o moi RPC viet (create/update/delete/link).
-- 2) Bao admin qua chuong thong bao: trigger tren family_members / member_parent_links /
--    member_partnerships goi _notify_member_editors moi khi NGUOI KHONG CO quyen
--    members/update thay doi du lieu (admin tu sua thi khong bao, tranh spam).
--    Noi dung: ai vua lam gi, ho so nao; bam thong bao mo thang ho so.

update public.families set editing_mode = 'open', editing_open_until = null;
update public.branches set editing_mode = null, editing_open_until = null;

create or replace function public._notify_member_editors(
  p_family uuid, p_branch uuid, p_title text, p_body text, p_link text, p_ref uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare v_admin uuid;
begin
  if p_family is null or auth.uid() is null then return; end if;
  -- Nguoi thay doi la admin (co quyen sua thanh vien o nhanh nay) thi khong can bao
  if public._user_has_permission(auth.uid(), p_family, 'members', 'update', p_branch) then return; end if;
  for v_admin in
    select m.user_id from public.family_memberships m
     where m.family_id = p_family and m.status = 'active'
       and m.user_id <> auth.uid()
       and public._user_has_permission(m.user_id, p_family, 'members', 'update', p_branch)
  loop
    perform public._notify(p_family, v_admin, 'system', p_title, p_body, p_link,
      'member_change:' || coalesce(p_ref::text, '') || ':' || extract(epoch from now())::bigint::text);
  end loop;
end $$;

revoke all on function public._notify_member_editors(uuid, uuid, text, text, text, uuid) from public, anon;

create or replace function public._trg_notify_member_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_title text; v_body text; v_link text;
  v_family uuid; v_branch uuid; v_ref uuid;
  v_a text; v_b text;
begin
  select coalesce(nullif(btrim(up.alias_name), ''), up.display_name, 'Một thành viên') into v_actor
  from public.user_profiles up where up.id = auth.uid();
  v_actor := coalesce(v_actor, 'Một thành viên');

  if tg_table_name = 'family_members' then
    if tg_op = 'INSERT' then
      v_family := new.family_id; v_branch := new.branch_id; v_ref := new.id;
      v_title := 'Thêm hồ sơ thành viên';
      v_body := v_actor || ' vừa thêm hồ sơ "' || new.full_name || '". Thay đổi đã lưu ngay.';
      v_link := '/thanh-vien/' || new.id::text;
    elsif old.deleted_at is null and new.deleted_at is not null then
      v_family := new.family_id; v_branch := new.branch_id; v_ref := new.id;
      v_title := 'Xóa hồ sơ thành viên';
      v_body := v_actor || ' vừa chuyển hồ sơ "' || new.full_name || '" vào thùng rác. Thay đổi đã lưu ngay.';
      v_link := '/thanh-vien/' || new.id::text;
    elsif old.deleted_at is not null and new.deleted_at is null then
      v_family := new.family_id; v_branch := new.branch_id; v_ref := new.id;
      v_title := 'Khôi phục hồ sơ thành viên';
      v_body := v_actor || ' vừa khôi phục hồ sơ "' || new.full_name || '". Thay đổi đã lưu ngay.';
      v_link := '/thanh-vien/' || new.id::text;
    else
      -- Bo qua neu chi doi display_order (admin sap xep cay) hoac updated_at
      if (to_jsonb(old) - 'display_order' - 'updated_at') is not distinct from (to_jsonb(new) - 'display_order' - 'updated_at') then
        return new;
      end if;
      v_family := new.family_id; v_branch := new.branch_id; v_ref := new.id;
      v_title := 'Cập nhật hồ sơ thành viên';
      v_body := v_actor || ' vừa cập nhật hồ sơ "' || new.full_name || '". Thay đổi đã lưu ngay.';
      v_link := '/thanh-vien/' || new.id::text;
    end if;

  elsif tg_table_name = 'member_parent_links' then
    if tg_op = 'INSERT' then
      select full_name into v_a from public.family_members where id = new.child_id;
      select full_name into v_b from public.family_members where id = new.parent_id;
      v_family := new.family_id; v_ref := new.child_id;
      select branch_id into v_branch from public.family_members where id = new.child_id;
      v_title := 'Thêm quan hệ cha/mẹ – con';
      v_body := v_actor || ' vừa thêm quan hệ: "' || coalesce(v_b, '?') || '" là cha/mẹ của "' || coalesce(v_a, '?') || '". Thay đổi đã lưu ngay.';
      v_link := '/thanh-vien/' || new.child_id::text;
    elsif old.deleted_at is null and new.deleted_at is not null then
      select full_name into v_a from public.family_members where id = old.child_id;
      select full_name into v_b from public.family_members where id = old.parent_id;
      v_family := old.family_id; v_ref := old.child_id;
      select branch_id into v_branch from public.family_members where id = old.child_id;
      v_title := 'Gỡ quan hệ cha/mẹ – con';
      v_body := v_actor || ' vừa gỡ quan hệ: "' || coalesce(v_b, '?') || '" – "' || coalesce(v_a, '?') || '". Thay đổi đã lưu ngay.';
      v_link := '/thanh-vien/' || old.child_id::text;
    else
      return coalesce(new, old);
    end if;

  elsif tg_table_name = 'member_partnerships' then
    if tg_op = 'INSERT' then
      select full_name into v_a from public.family_members where id = new.member_a;
      select full_name into v_b from public.family_members where id = new.member_b;
      v_family := new.family_id; v_ref := new.member_a;
      select branch_id into v_branch from public.family_members where id = new.member_a;
      v_title := 'Thêm quan hệ vợ/chồng';
      v_body := v_actor || ' vừa thêm quan hệ vợ/chồng: "' || coalesce(v_a, '?') || '" – "' || coalesce(v_b, '?') || '". Thay đổi đã lưu ngay.';
      v_link := '/thanh-vien/' || new.member_a::text;
    elsif old.deleted_at is null and new.deleted_at is not null then
      select full_name into v_a from public.family_members where id = old.member_a;
      select full_name into v_b from public.family_members where id = old.member_b;
      v_family := old.family_id; v_ref := old.member_a;
      select branch_id into v_branch from public.family_members where id = old.member_a;
      v_title := 'Gỡ quan hệ vợ/chồng';
      v_body := v_actor || ' vừa gỡ quan hệ vợ/chồng: "' || coalesce(v_a, '?') || '" – "' || coalesce(v_b, '?') || '". Thay đổi đã lưu ngay.';
      v_link := '/thanh-vien/' || old.member_a::text;
    elsif old.status is distinct from new.status or old.start_year is distinct from new.start_year or old.end_year is distinct from new.end_year then
      select full_name into v_a from public.family_members where id = new.member_a;
      select full_name into v_b from public.family_members where id = new.member_b;
      v_family := new.family_id; v_ref := new.member_a;
      select branch_id into v_branch from public.family_members where id = new.member_a;
      v_title := 'Cập nhật quan hệ vợ/chồng';
      v_body := v_actor || ' vừa cập nhật quan hệ vợ/chồng: "' || coalesce(v_a, '?') || '" – "' || coalesce(v_b, '?') || '". Thay đổi đã lưu ngay.';
      v_link := '/thanh-vien/' || new.member_a::text;
    else
      return coalesce(new, old);
    end if;
  end if;

  perform public._notify_member_editors(v_family, v_branch, v_title, v_body, v_link, v_ref);
  return coalesce(new, old);
end $$;

revoke all on function public._trg_notify_member_change() from public, anon;

drop trigger if exists trg_notify_member_change on public.family_members;
create trigger trg_notify_member_change
  after insert or update on public.family_members
  for each row execute function public._trg_notify_member_change();

drop trigger if exists trg_notify_parent_link_change on public.member_parent_links;
create trigger trg_notify_parent_link_change
  after insert or update on public.member_parent_links
  for each row execute function public._trg_notify_member_change();

drop trigger if exists trg_notify_partnership_change on public.member_partnerships;
create trigger trg_notify_partnership_change
  after insert or update on public.member_partnerships
  for each row execute function public._trg_notify_member_change();
