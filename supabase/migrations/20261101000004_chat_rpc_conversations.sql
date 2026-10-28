-- Module D (Tin nhan) / migration 4: tao tin nhan rieng / nhom, them-go thanh vien, roi nhom, doi ten, chan

-- Dong bo nhom gia dinh/nhom nhanh cho tai khoan dang dang nhap va tra ve id nhom gia dinh (idempotent, an toan goi lai).
-- Trigger tren family_memberships da lam viec nay khi quyen thay doi; ham nay la luoi an toan khi mo trang Tin nhan.
create or replace function public.ensure_chat_groups(p_family uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_conv uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public._chat_role_allows(v_uid, p_family, 'view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public._chat_sync_user(v_uid, p_family);
  select c.id into v_conv from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id and cm.user_id = v_uid and cm.left_at is null
    where c.family_id = p_family and c.kind = 'family';
  return v_conv;
end $$;

-- Tin nhan rieng 1-1: moi cap mot cuoc duy nhat. Chi giua hai thanh vien cung gia dinh, deu co quyen gui tin.
create or replace function public.create_direct(p_family uuid, p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_key text; v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_other is null or p_other = v_uid then raise exception 'invalid recipient' using errcode = '22023'; end if;
  if not public._chat_role_allows(v_uid, p_family, 'create') or not public._chat_role_allows(p_other, p_family, 'create') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.chat_blocks b
             where (b.blocker_id = v_uid and b.blocked_id = p_other) or (b.blocker_id = p_other and b.blocked_id = v_uid)) then
    raise exception 'chat: unavailable' using errcode = 'P0001';
  end if;
  v_key := least(v_uid::text, p_other::text) || ':' || greatest(v_uid::text, p_other::text);
  select c.id into v_id from public.conversations c
    where c.family_id = p_family and c.kind = 'direct' and c.direct_key = v_key;
  if v_id is null then
    insert into public.conversations (family_id, kind, direct_key, created_by)
    values (p_family, 'direct', v_key, v_uid)
    on conflict (family_id, direct_key) where kind = 'direct' do nothing
    returning id into v_id;
    if v_id is null then
      select c.id into v_id from public.conversations c
        where c.family_id = p_family and c.kind = 'direct' and c.direct_key = v_key;
    end if;
  end if;
  perform public._chat_join(v_id, v_uid, 'member', true);
  perform public._chat_join(v_id, p_other, 'member', true);
  return v_id;
end $$;

-- Nhom tuy chon: nguoi tao la chu nhom. Toi da 100 thanh vien; moi nguoi toi da 5 nhom moi / gio.
create or replace function public.create_group(p_family uuid, p_title text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_title text; v_id uuid; v_user uuid; v_n int := 0; v_ids uuid[];
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public._chat_role_allows(v_uid, p_family, 'create') then raise exception 'forbidden' using errcode = '42501'; end if;
  v_title := btrim(coalesce(p_title, ''));
  if char_length(v_title) not between 1 and 100 then raise exception 'invalid title' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct u), '{}') into v_ids from unnest(coalesce(p_members, '{}')) u where u is not null and u <> v_uid;
  if cardinality(v_ids) < 1 or cardinality(v_ids) > 99 then
    raise exception 'group needs 1..99 other members' using errcode = '22023';
  end if;
  foreach v_user in array v_ids loop
    if not public._chat_role_allows(v_user, p_family, 'create') then
      raise exception 'invalid member' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from public.conversations c
      where c.created_by = v_uid and c.kind = 'group' and c.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'chat: rate limited' using errcode = 'P0001';
  end if;

  insert into public.conversations (family_id, kind, title, created_by)
  values (p_family, 'group', v_title, v_uid) returning id into v_id;
  perform public._chat_join(v_id, v_uid, 'owner', true);
  foreach v_user in array v_ids loop
    perform public._chat_join(v_id, v_user, 'member', true);
    v_n := v_n + 1;
    perform public._notify(p_family, v_user, 'chat', left('Bạn được thêm vào nhóm "' || v_title || '"', 190), null,
      '/tin-nhan/' || v_id::text, 'chatadd:' || v_id::text);
  end loop;
  perform public._chat_system_message(v_id, public._chat_display_name(v_uid) || ' đã tạo nhóm');
  perform public.write_audit(p_family, 'chat.group_create', 'conversation', v_id::text, null,
    jsonb_build_object('members', v_n + 1));
  return v_id;
end $$;

create or replace function public.rename_conversation(p_conversation uuid, p_title text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); c public.conversations; v_title text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into c from public.conversations where id = p_conversation;
  if not found or c.kind <> 'group' or not public.chat_can_moderate(p_conversation) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_title := btrim(coalesce(p_title, ''));
  if char_length(v_title) not between 1 and 100 then raise exception 'invalid title' using errcode = '22023'; end if;
  update public.conversations set title = v_title where id = p_conversation;
  perform public._chat_system_message(p_conversation, public._chat_display_name(v_uid) || ' đã đổi tên nhóm');
  perform public.write_audit(c.family_id, 'chat.group_rename', 'conversation', p_conversation::text, null, null);
end $$;

-- Them (hoac khoi phuc) thanh vien: chu nhom / admin gia dinh (nhom nhanh: admin trong pham vi, nguoi them phai thuoc nhanh do)
create or replace function public.add_conversation_member(p_conversation uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); c public.conversations; v_joined boolean;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into c from public.conversations where id = p_conversation;
  if not found or not public.chat_can_moderate(p_conversation) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user is null or not public._chat_role_allows(p_user, c.family_id, 'create') then
    raise exception 'invalid member' using errcode = '22023';
  end if;
  if c.kind = 'branch' and not exists (
       select 1 from public.family_memberships m
       where m.user_id = p_user and m.family_id = c.family_id and m.status = 'active' and m.branch_id = c.branch_id) then
    raise exception 'member does not belong to this branch' using errcode = '22023';
  end if;
  if (select count(*) from public.conversation_members cm where cm.conversation_id = p_conversation and cm.left_at is null) >= 100
     and not exists (select 1 from public.conversation_members cm where cm.conversation_id = p_conversation and cm.user_id = p_user and cm.left_at is null) then
    raise exception 'group is full' using errcode = '22023';
  end if;
  v_joined := public._chat_join(p_conversation, p_user, 'member', true);
  if v_joined then
    if c.kind = 'group' then
      perform public._chat_system_message(p_conversation, public._chat_display_name(p_user) || ' đã được thêm vào nhóm');
    end if;
    perform public._notify(c.family_id, p_user, 'chat',
      left('Bạn được thêm vào "' || public._chat_conv_title(p_conversation) || '"', 190), null,
      '/tin-nhan/' || p_conversation::text, 'chatadd:' || p_conversation::text);
    perform public.write_audit(c.family_id, 'chat.member_add', 'conversation', p_conversation::text, null,
      jsonb_build_object('user_id', p_user));
  end if;
end $$;

-- Go thanh vien (chu nhom / admin). Khong go duoc nguoi co quyen cao hon minh; khong tu go chinh minh (dung roi nhom).
create or replace function public.remove_conversation_member(p_conversation uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); c public.conversations; v_actor_rank int; v_target_rank int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into c from public.conversations where id = p_conversation;
  if not found or not public.chat_can_moderate(p_conversation) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = v_uid then raise exception 'use leave instead' using errcode = '22023'; end if;
  if not exists (select 1 from public.conversation_members cm
                 where cm.conversation_id = p_conversation and cm.user_id = p_user and cm.left_at is null) then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  select r.rank into v_actor_rank from public.family_memberships m join public.roles r on r.key = m.role_key
    where m.user_id = v_uid and m.family_id = c.family_id and m.status = 'active';
  select r.rank into v_target_rank from public.family_memberships m join public.roles r on r.key = m.role_key
    where m.user_id = p_user and m.family_id = c.family_id;
  if coalesce(v_target_rank, 99) < coalesce(v_actor_rank, 99) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public._chat_leave(p_conversation, p_user, 'removed', v_uid);
  if c.kind = 'group' then
    perform public._chat_system_message(p_conversation, public._chat_display_name(p_user) || ' đã bị gỡ khỏi nhóm');
  end if;
  perform public.write_audit(c.family_id, 'chat.member_remove', 'conversation', p_conversation::text, null,
    jsonb_build_object('user_id', p_user));
end $$;

-- Tu roi nhom (chi nhom tuy chon). Nhom gia dinh, nhom nhanh, tin nhan rieng khong roi duoc.
create or replace function public.leave_conversation(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); c public.conversations;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into c from public.conversations where id = p_conversation;
  if not found or not public._chat_member_ok(v_uid, p_conversation) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if c.kind <> 'group' then raise exception 'chat: cannot leave' using errcode = 'P0001'; end if;
  perform public._chat_system_message(p_conversation, public._chat_display_name(v_uid) || ' đã rời nhóm');
  perform public._chat_leave(p_conversation, v_uid, 'left', v_uid);
end $$;

-- Chan / bo chan nguoi khac nhan tin rieng (1-1) voi minh. Khong anh huong nhom.
create or replace function public.block_chat_user(p_family uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_user is null or p_user = v_uid then raise exception 'invalid user' using errcode = '22023'; end if;
  if not public._chat_role_allows(v_uid, p_family, 'create') or not exists (
       select 1 from public.family_memberships m where m.user_id = p_user and m.family_id = p_family and m.status = 'active') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.chat_blocks (blocker_id, blocked_id, family_id) values (v_uid, p_user, p_family)
    on conflict (blocker_id, blocked_id) do nothing;
end $$;

create or replace function public.unblock_chat_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  delete from public.chat_blocks where blocker_id = v_uid and blocked_id = p_user;
end $$;
