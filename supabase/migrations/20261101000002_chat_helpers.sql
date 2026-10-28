-- Module D (Tin nhan) / migration 2: ham kiem tra quyen, tu dong them vao nhom gia dinh/nhanh, thong bao gop
-- Ham co tien to "_chat_" la NOI BO: khong cap cho authenticated; chi ham security definer khac goi.

-- ---------- Quyen cua mot vai tro voi module 'chat' (KHONG xet pham vi nhanh) ----------
-- (has_permission voi branch_admin + p_branch null se tu choi moi hanh dong khac 'view'; chat khong gan voi nhanh,
--  nen o day chi doc ma tran role_permissions + trang thai thanh vien.)
create or replace function public._chat_role_allows(p_user uuid, p_family uuid, p_action text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select m.role_key = 'super_admin'
        or exists (select 1 from public.role_permissions rp
                   where rp.role_key = m.role_key and rp.module = 'chat' and rp.action = p_action)
    from public.family_memberships m
    where m.user_id = p_user and m.family_id = p_family and m.status = 'active'
  ), false);
$$;

-- Nguoi dung la thanh vien dang hoat dong cua cuoc tro chuyen (chua roi/bi go) VA con quyen chat 'view'
create or replace function public._chat_member_ok(p_user uuid, p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = p_conv and cm.user_id = p_user and cm.left_at is null
      and public._chat_role_allows(p_user, c.family_id, 'view'));
$$;

-- Dung cho RLS/view/Realtime: nguoi dang dang nhap co doc duoc tin (conversation, created_at) khong?
create or replace function public.chat_can_read(p_conv uuid, p_created timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select true
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    join public.family_memberships fm on fm.user_id = cm.user_id and fm.family_id = c.family_id and fm.status = 'active'
    where cm.conversation_id = p_conv and cm.user_id = auth.uid() and cm.left_at is null
      and p_created >= cm.joined_at
      and (fm.role_key = 'super_admin'
           or exists (select 1 from public.role_permissions rp
                      where rp.role_key = fm.role_key and rp.module = 'chat' and rp.action = 'view'))
    limit 1), false);
$$;
-- Chi phi cao de bo lap ke hoach dat dieu kien nay SAU cac dieu kien re hon trong chinh sach RLS
alter function public.chat_can_read(uuid, timestamptz) cost 1000;

-- Danh sach cuoc tro chuyen toi dang tham gia (dung trong RLS: boc trong (select ...) de chi tinh MOT lan moi cau truy van)
create or replace function public.chat_my_conversation_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cm.conversation_id from public.conversation_members cm
  where cm.user_id = auth.uid() and cm.left_at is null;
$$;

create or replace function public.chat_is_member(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.uid() is not null and public._chat_member_ok(auth.uid(), p_conv), false);
$$;

-- Nguoi dang dang nhap co quyen kiem duyet (xoa tin nguoi khac, go thanh vien, them thanh vien) cuoc tro chuyen nay khong?
--   direct: khong ai (chi xu ly qua bao cao);  group: chu nhom hoac admin gia dinh;
--   family: admin gia dinh/super admin;  branch: admin co pham vi bao gom nhanh do.
create or replace function public.chat_can_moderate(p_conv uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare c public.conversations;
begin
  if auth.uid() is null then return false; end if;
  select * into c from public.conversations where id = p_conv;
  if not found or c.kind = 'direct' then return false; end if;
  if c.kind = 'group' and exists (
       select 1 from public.conversation_members cm
       where cm.conversation_id = p_conv and cm.user_id = auth.uid() and cm.left_at is null and cm.role = 'owner')
     and public._chat_role_allows(auth.uid(), c.family_id, 'view') then
    return true;
  end if;
  -- c.branch_id chi khac null voi nhom nhanh (rang buoc bang); cac loai khac can quyen cap gia dinh
  return coalesce(public.has_permission(c.family_id, 'chat', 'approve', c.branch_id), false);
end $$;

-- ---------- Tham gia / roi cuoc tro chuyen ----------
-- Tra ve true neu dong tro nen hoat dong (moi them hoac khoi phuc).
-- p_force = true: ke ca khi truoc do 'removed'/'left' (dung khi quan tri/chu nhom chu dong them lai).
create or replace function public._chat_join(p_conv uuid, p_user uuid, p_role text default 'member', p_force boolean default false)
returns boolean
language plpgsql security definer set search_path = public as $$
declare c public.conversations; cm public.conversation_members;
begin
  select * into c from public.conversations where id = p_conv;
  if not found then return false; end if;
  insert into public.conversation_members (conversation_id, user_id, family_id, role)
  values (p_conv, p_user, c.family_id, p_role)
  on conflict (conversation_id, user_id) do nothing;
  if found then return true; end if;
  select * into cm from public.conversation_members
    where conversation_id = p_conv and user_id = p_user for update;
  if cm.left_at is null then return false; end if;
  if cm.left_reason in ('removed','left') and not p_force then return false; end if;
  update public.conversation_members
    set left_at = null, left_reason = null, removed_by = null, role = p_role, muted = false,
        joined_at = case when c.kind = 'direct' then cm.joined_at else now() end,
        last_read_at = case when c.kind = 'direct' then cm.last_read_at else now() end
    where conversation_id = p_conv and user_id = p_user;
  return true;
end $$;

-- Cho mot nguoi roi cuoc tro chuyen; neu la chu nhom thi chuyen quyen cho nguoi vao som nhat con lai.
create or replace function public._chat_leave(p_conv uuid, p_user uuid, p_reason text, p_by uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_role text; v_next uuid;
begin
  select cm.role into v_role from public.conversation_members cm
    where cm.conversation_id = p_conv and cm.user_id = p_user and cm.left_at is null for update;
  if not found then return false; end if;
  update public.conversation_members
    set left_at = now(), left_reason = p_reason, removed_by = p_by, role = 'member'
    where conversation_id = p_conv and user_id = p_user;
  if v_role = 'owner' then
    select cm.user_id into v_next from public.conversation_members cm
      where cm.conversation_id = p_conv and cm.left_at is null
      order by cm.joined_at, cm.user_id limit 1;
    if v_next is not null then
      update public.conversation_members set role = 'owner'
        where conversation_id = p_conv and user_id = v_next;
    end if;
  end if;
  return true;
end $$;

create or replace function public._chat_system_message(p_conv uuid, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into public.messages (conversation_id, sender_id, kind, body, created_at)
  values (p_conv, null, 'system', left(p_body, 4000), clock_timestamp());
$$;

create or replace function public._chat_display_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select up.display_name from public.user_profiles up where up.id = p_user), 'Một thành viên');
$$;

-- Ten hien thi cua cuoc tro chuyen khong phai 1-1
create or replace function public._chat_conv_title(p_conv uuid) returns text
language sql stable security definer set search_path = public as $$
  select case c.kind
           when 'family' then 'Cả gia đình'
           when 'branch' then 'Nhánh ' || coalesce((select b.name from public.branches b where b.id = c.branch_id), '')
           else coalesce(c.title, 'Cuộc trò chuyện') end
  from public.conversations c where c.id = p_conv;
$$;

-- ---------- Nhom gia dinh / nhom nhanh (tu tao, idempotent) ----------
create or replace function public._chat_ensure_family_conv(p_family uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from public.conversations where family_id = p_family and kind = 'family';
  if v is not null then return v; end if;
  insert into public.conversations (family_id, kind) values (p_family, 'family')
    on conflict (family_id) where kind = 'family' do nothing returning id into v;
  if v is null then select id into v from public.conversations where family_id = p_family and kind = 'family'; end if;
  return v;
end $$;

create or replace function public._chat_ensure_branch_conv(p_family uuid, p_branch uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not exists (select 1 from public.branches b where b.id = p_branch and b.family_id = p_family and b.deleted_at is null) then
    return null;
  end if;
  select id into v from public.conversations where kind = 'branch' and branch_id = p_branch;
  if v is not null then return v; end if;
  insert into public.conversations (family_id, kind, branch_id) values (p_family, 'branch', p_branch)
    on conflict (branch_id) where kind = 'branch' do nothing returning id into v;
  if v is null then select id into v from public.conversations where kind = 'branch' and branch_id = p_branch; end if;
  return v;
end $$;

-- Dong bo tu cach thanh vien cua mot tai khoan voi cac nhom tu dong. Chay lai bao nhieu lan cung an toan.
--  * mat quyen chat / bi thu hoi  => roi MOI cuoc tro chuyen cua gia dinh (ly do 'auto')
--  * con quyen => vao nhom gia dinh; vao nhom cua nhanh hien tai; roi nhom cua nhanh cu ('auto')
--  * nguoi da bi 'removed' khoi mot nhom tu dong thi KHONG bi tu dong keo lai
create or replace function public._chat_sync_user(p_user uuid, p_family uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.family_memberships; r record; v_conv uuid;
begin
  select * into m from public.family_memberships where user_id = p_user and family_id = p_family;
  if not found then return; end if;
  if m.status <> 'active' or not public._chat_role_allows(p_user, p_family, 'view') then
    for r in select cm.conversation_id from public.conversation_members cm
             join public.conversations c on c.id = cm.conversation_id
             where cm.user_id = p_user and c.family_id = p_family and cm.left_at is null loop
      perform public._chat_leave(r.conversation_id, p_user, 'auto', null);
    end loop;
    return;
  end if;
  perform public._chat_join(public._chat_ensure_family_conv(p_family), p_user);
  for r in select cm.conversation_id from public.conversation_members cm
           join public.conversations c on c.id = cm.conversation_id
           where cm.user_id = p_user and c.family_id = p_family and c.kind = 'branch' and cm.left_at is null
             and c.branch_id is distinct from m.branch_id loop
    perform public._chat_leave(r.conversation_id, p_user, 'auto', null);
  end loop;
  if m.branch_id is not null then
    v_conv := public._chat_ensure_branch_conv(p_family, m.branch_id);
    if v_conv is not null then perform public._chat_join(v_conv, p_user); end if;
  end if;
end $$;

-- Trigger tren family_memberships: moi lan them / doi trang thai / doi vai tro / doi nhanh thi dong bo.
-- Loi o day KHONG duoc chan thao tac cot loi (vi du thu hoi tai khoan) - quyen doc van bi chan boi RLS
-- (chat_can_read kiem tra thanh vien dang hoat dong) du viec dong bo that bai.
create or replace function public._chat_membership_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public._chat_sync_user(new.user_id, new.family_id);
  exception when others then
    raise warning 'chat sync failed for user %: %', new.user_id, sqlerrm;
  end;
  return null;
end $$;
create trigger family_memberships_chat_sync
  after insert or update of status, role_key, branch_id on public.family_memberships
  for each row execute function public._chat_membership_trg();

-- Doi ten nhanh khong can lam gi (ten hien thi tinh tu bang branches). Nhanh bi xoa mem: nhom giu nguyen.

-- ---------- Thong bao gop khi co tin moi ----------
-- Moi (cuoc tro chuyen, nguoi nhan) toi da MOT thong bao chua doc (dedupe_key = 'chat:<conv>').
-- Khi nguoi nhan da doc (thong bao co read_at) thi tin tiep theo se tao thong bao moi.
-- Ton trong muted va notification_preferences.chat (trong _notify).
create or replace function public._chat_notify_new(p_conv uuid, p_sender uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.conversations; v_title text; v_key text; r record;
begin
  select * into c from public.conversations where id = p_conv;
  if not found then return; end if;
  if c.kind = 'direct' then
    v_title := 'Tin nhắn mới từ ' || public._chat_display_name(p_sender);
  else
    v_title := 'Tin nhắn mới trong "' || public._chat_conv_title(p_conv) || '"';
  end if;
  v_title := left(v_title, 190);
  v_key := 'chat:' || p_conv::text;
  for r in select cm.user_id from public.conversation_members cm
           where cm.conversation_id = p_conv and cm.left_at is null and not cm.muted and cm.user_id <> p_sender loop
    delete from public.notifications n
      where n.user_id = r.user_id and n.dedupe_key = v_key and n.read_at is not null;
    perform public._notify(c.family_id, r.user_id, 'chat', v_title, null, '/tin-nhan/' || p_conv::text, v_key);
  end loop;
end $$;

-- ---------- Lay tai khoan hien co vao nhom (chay mot lan khi nang cap) ----------
do $$
declare r record;
begin
  for r in select m.user_id, m.family_id from public.family_memberships m where m.status = 'active' loop
    perform public._chat_sync_user(r.user_id, r.family_id);
  end loop;
end $$;
