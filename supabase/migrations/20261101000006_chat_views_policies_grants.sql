-- Module D (Tin nhan) / migration 6: view doc du lieu, RLS cho bang messages (de Realtime ap dung), cap quyen, Realtime
-- Chi bang messages duoc cap SELECT truc tiep (can cho Realtime postgres_changes; RLS van loc theo nguoi dang ky).
-- Cac bang con lai chi doc qua view/ham ben duoi.

-- Luu y: quyen EXECUTE cua ham trong view duoc kiem tra theo NGUOI GOI (khong phai chu so huu view), nen cac view
-- chi duoc goi ham da cap cho authenticated (ham cong khai tu kiem tra auth.uid()), khong goi ham noi bo.

-- Vai tro cua toi co quyen chat <action> trong gia dinh nay khong (khong xet pham vi nhanh)
create or replace function public.chat_my_role_allows(p_family uuid, p_action text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.uid() is not null and public._chat_role_allows(auth.uid(), p_family, p_action), false);
$$;

-- Mot nguoi khac co quyen chat <action> khong - chi tra loi khi nguoi hoi la thanh vien dang hoat dong cua gia dinh do
create or replace function public.chat_user_can(p_user uuid, p_family uuid, p_action text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_family_member(p_family) and public._chat_role_allows(p_user, p_family, p_action), false);
$$;

-- ---------- Danh sach cuoc tro chuyen CUA TOI (kem so tin chua doc, tin cuoi) ----------
create or replace view public.chat_conversations_v as
select
  c.id, c.family_id, c.kind,
  case c.kind
    when 'direct' then coalesce(op.display_name, 'Thành viên')
    when 'family' then 'Cả gia đình'
    when 'branch' then 'Nhánh ' || coalesce(b.name, '')
    else c.title end as title,
  c.branch_id,
  other.user_id as direct_user_id,
  c.created_by, c.created_at,
  me.role as my_role, me.joined_at, me.last_read_at, me.muted,
  coalesce(lm.created_at, c.created_at) as last_activity_at,
  lm.preview as last_preview,
  lm.sender_name as last_sender_name,
  coalesce(un.n, 0) as unread_count,                       -- toi da 100
  (select count(*) from public.conversation_members x where x.conversation_id = c.id and x.left_at is null) as member_count,
  public.chat_can_moderate(c.id) as can_moderate,
  (c.kind = 'direct' and other.user_id is not null and exists (
     select 1 from public.chat_blocks bl where bl.blocker_id = auth.uid() and bl.blocked_id = other.user_id)) as i_blocked
from public.conversations c
join public.conversation_members me on me.conversation_id = c.id and me.user_id = auth.uid() and me.left_at is null
left join public.branches b on b.id = c.branch_id
left join lateral (
  select x.user_id from public.conversation_members x
  where c.kind = 'direct' and x.conversation_id = c.id and x.user_id <> auth.uid() limit 1) other on true
left join public.user_profiles op on op.id = other.user_id
left join lateral (
  select m.created_at,
         case when m.deleted_at is not null then 'Tin nhắn đã bị xoá' else left(m.body, 80) end as preview,
         case when m.kind = 'text' then (select up.display_name from public.user_profiles up where up.id = m.sender_id) end as sender_name
  from public.messages m
  where m.conversation_id = c.id and m.created_at >= me.joined_at
  order by m.created_at desc, m.id desc limit 1) lm on true
left join lateral (
  select count(*) as n from (
    select 1 from public.messages m
    where m.conversation_id = c.id and m.created_at > me.last_read_at and m.created_at >= me.joined_at
      and m.kind = 'text' and m.deleted_at is null and m.sender_id is distinct from auth.uid()
    limit 100) q) un on true
where public.chat_my_role_allows(c.family_id, 'view');
-- (Giao dien danh sach tu an tin nhan rieng chua co tin nao: last_preview is null. Van tra ve o day de mo duoc phong vua tao.)

-- ---------- Thanh vien cua cac cuoc tro chuyen toi dang tham gia ----------
create or replace view public.chat_members_v as
select cm.conversation_id, cm.user_id,
       coalesce(up.display_name, 'Thành viên') as display_name,
       cm.role, cm.joined_at, (cm.user_id = auth.uid()) as is_me
from public.conversation_members cm
join public.conversation_members me
  on me.conversation_id = cm.conversation_id and me.user_id = auth.uid() and me.left_at is null
left join public.user_profiles up on up.id = cm.user_id
where cm.left_at is null and public.chat_my_role_allows(cm.family_id, 'view');

-- ---------- Tin nhan (kem ten nguoi gui, tin dang tra loi). Cung dieu kien doc voi RLS cua bang messages ----------
create or replace view public.chat_messages_v as
select
  m.id, m.conversation_id, m.sender_id,
  case when m.kind = 'system' then null else coalesce(up.display_name, 'Thành viên') end as sender_name,
  m.kind,
  case when m.deleted_at is not null then '' else m.body end as body,
  m.reply_to, m.client_id, m.created_at, m.edited_at,
  (m.deleted_at is not null) as deleted,
  case when rm.id is not null and public.chat_can_read(rm.conversation_id, rm.created_at) then
         coalesce(ru.display_name, 'Thành viên') end as reply_sender_name,
  case when rm.id is not null and rm.deleted_at is null and public.chat_can_read(rm.conversation_id, rm.created_at)
       then left(rm.body, 140) end as reply_body,
  coalesce(rm.deleted_at is not null, false) as reply_deleted
from public.messages m
-- Dieu kien doc (khop voi chinh sach RLS cua bang messages): dong thanh vien con hieu luc + tin khong truoc luc tham gia + con quyen chat
join public.conversation_members me
  on me.conversation_id = m.conversation_id and me.user_id = auth.uid() and me.left_at is null and m.created_at >= me.joined_at
left join public.user_profiles up on up.id = m.sender_id
left join public.messages rm on rm.id = m.reply_to
left join public.user_profiles ru on ru.id = rm.sender_id
where public.chat_my_role_allows(me.family_id, 'view');

-- ---------- Nguoi co the nhan tin (cung gia dinh, con hoat dong, co quyen chat) ----------
create or replace view public.chat_people_v as
select fm.family_id, fm.user_id, coalesce(up.display_name, 'Thành viên') as display_name, b.name as branch_name
from public.family_memberships fm
left join public.user_profiles up on up.id = fm.user_id
left join public.branches b on b.id = fm.branch_id and b.deleted_at is null
where fm.status = 'active' and fm.user_id <> auth.uid()
  and public.chat_my_role_allows(fm.family_id, 'create')
  and public.chat_user_can(fm.user_id, fm.family_id, 'create');

-- ---------- Bao cao: nguoi bao cao xem bao cao cua minh; quan tri co quyen xu ly xem bao cao thuoc pham vi ----------
create or replace view public.chat_reports_v as
select
  r.id, r.family_id, r.conversation_id, c.kind as conversation_kind,
  case c.kind when 'direct' then 'Tin nhắn riêng' when 'family' then 'Cả gia đình'
              when 'branch' then 'Nhánh ' || coalesce(b.name, '') else c.title end as conversation_title,
  r.message_id, r.reporter_id, coalesce(rp.display_name, 'Thành viên') as reporter_name,
  r.reported_user_id, coalesce(ru.display_name, 'Thành viên') as reported_name,
  r.reason_kind, r.note, r.message_snapshot, r.status, r.action_taken,
  coalesce(rs.display_name, null) as resolved_by_name, r.resolved_at, r.resolution_note, r.created_at,
  coalesce(m.deleted_at is not null, true) as message_deleted,
  (r.reporter_id = auth.uid()) as is_mine,
  coalesce(public.has_permission(r.family_id, 'chat', 'approve', c.branch_id), false) as can_resolve
from public.message_reports r
join public.conversations c on c.id = r.conversation_id
left join public.branches b on b.id = c.branch_id
left join public.messages m on m.id = r.message_id
left join public.user_profiles rp on rp.id = r.reporter_id
left join public.user_profiles ru on ru.id = r.reported_user_id
left join public.user_profiles rs on rs.id = r.resolved_by
where (r.reporter_id = auth.uid() and public.is_family_member(r.family_id))
   or public.has_permission(r.family_id, 'chat', 'approve', c.branch_id);

-- ---------- RLS cho bang messages (Realtime dung chinh chinh sach nay cho tung nguoi dang ky) ----------
-- Loc re truoc (conversation_id nam trong tap cuoc tro chuyen toi dang tham gia - tinh mot lan), roi kiem tra day du
-- (cua so lich su + gia dinh dang hoat dong + quyen chat) bang chat_can_read (chi phi cao nen duoc danh gia sau).
create policy messages_select on public.messages for select to authenticated
  using (conversation_id in (select public.chat_my_conversation_ids())
         and public.chat_can_read(conversation_id, created_at));

-- ---------- Cap quyen ----------
revoke all on public.chat_conversations_v, public.chat_members_v, public.chat_messages_v,
  public.chat_people_v, public.chat_reports_v from anon, authenticated;
grant select on public.messages, public.chat_conversations_v, public.chat_members_v, public.chat_messages_v,
  public.chat_people_v, public.chat_reports_v to authenticated;

-- Ham cong khai (security definer, tu kiem tra quyen ben trong)
grant execute on function
  public.chat_can_read(uuid, timestamptz), public.chat_is_member(uuid), public.chat_can_moderate(uuid),
  public.chat_my_role_allows(uuid, text), public.chat_user_can(uuid, uuid, text), public.chat_my_conversation_ids(),
  public.send_message(uuid, text, uuid, uuid), public.edit_message(uuid, text), public.delete_message(uuid),
  public.mark_read(uuid, timestamptz), public.set_conversation_muted(uuid, boolean),
  public.ensure_chat_groups(uuid), public.create_direct(uuid, uuid), public.create_group(uuid, text, uuid[]),
  public.rename_conversation(uuid, text), public.add_conversation_member(uuid, uuid),
  public.remove_conversation_member(uuid, uuid), public.leave_conversation(uuid),
  public.block_chat_user(uuid, uuid), public.unblock_chat_user(uuid),
  public.report_message(uuid, text, text), public.resolve_report(uuid, text, text)
  to authenticated;

-- Ham NOI BO: khong cap cho anon/authenticated (cac view chay voi quyen chu so huu nen van goi duoc)
revoke execute on function
  public._chat_role_allows(uuid, uuid, text), public._chat_member_ok(uuid, uuid),
  public._chat_join(uuid, uuid, text, boolean), public._chat_leave(uuid, uuid, text, uuid),
  public._chat_system_message(uuid, text), public._chat_display_name(uuid), public._chat_conv_title(uuid),
  public._chat_ensure_family_conv(uuid), public._chat_ensure_branch_conv(uuid, uuid),
  public._chat_sync_user(uuid, uuid), public._chat_membership_trg(), public._chat_notify_new(uuid, uuid)
  from public, anon, authenticated;

-- ---------- Realtime: chi bang messages (khong phat conversation_members/last_read de tiet kiem luot) ----------
-- Giao dien dang ky MOT kenh postgres_changes cho cuoc tro chuyen dang mo (filter conversation_id=eq.<id>) va huy khi roi trang,
-- nen moi tab chi chiem 1 ket noi. Realtime ap dung chinh sach messages_select cho tung nguoi dang ky.
-- Chi co hai loai cap nhat hang messages: sua (body doi) va xoa mem (body = ''), nen cot body luon co trong ban ghi UPDATE
-- (khong gap tinh trang cot TOAST khong doi bi bo khoi payload); vi vay khong can REPLICA IDENTITY FULL.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
