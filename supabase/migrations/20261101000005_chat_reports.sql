-- Module D (Tin nhan) / migration 5: bao cao tin nhan va xu ly cua quan tri
-- Quan tri KHONG doc duoc cuoc tro chuyen ho khong tham gia: ho chi thay ban chup noi dung do nguoi bao cao chu dong gui.

create or replace function public.report_message(p_message uuid, p_reason_kind text, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); m public.messages; c public.conversations; v_id uuid; v_note text; a record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_reason_kind not in ('abuse','spam','inappropriate','privacy','other') then
    raise exception 'invalid reason' using errcode = '22023';
  end if;
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 500 then raise exception 'note too long' using errcode = '22023'; end if;

  select * into m from public.messages where id = p_message;
  if not found or not public.chat_can_read(m.conversation_id, m.created_at) then
    raise exception 'forbidden' using errcode = '42501';   -- khong tiet lo tin co ton tai hay khong
  end if;
  if m.kind <> 'text' or m.deleted_at is not null or m.sender_id is null or m.sender_id = v_uid then
    raise exception 'message cannot be reported' using errcode = '22023';
  end if;
  select * into c from public.conversations where id = m.conversation_id;

  select r.id into v_id from public.message_reports r where r.message_id = p_message and r.reporter_id = v_uid;
  if v_id is not null then return v_id; end if;   -- da bao cao roi: tra ve bao cao cu

  if (select count(*) from public.message_reports r
      where r.reporter_id = v_uid and r.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'chat: rate limited' using errcode = 'P0001';
  end if;

  insert into public.message_reports (family_id, conversation_id, message_id, reporter_id, reported_user_id,
                                      reason_kind, note, message_snapshot)
  values (c.family_id, c.id, m.id, v_uid, m.sender_id, p_reason_kind, v_note, m.body)
  returning id into v_id;

  perform public.write_audit(c.family_id, 'chat.report', 'message_report', v_id::text, null,
    jsonb_build_object('conversation_id', c.id, 'message_id', m.id, 'reason', p_reason_kind));

  -- Bao cho nhung quan tri co quyen xu ly (loai chinh nguoi bao cao va nguoi bi bao cao). Dung loai 'system' de
  -- viec tat thong bao tin nhan khong che mat canh bao kiem duyet.
  for a in select fm.user_id from public.family_memberships fm
           where fm.family_id = c.family_id and fm.status = 'active'
             and fm.user_id not in (v_uid, m.sender_id)
             and public._user_has_permission(fm.user_id, c.family_id, 'chat', 'approve', c.branch_id) loop
    perform public._notify(c.family_id, a.user_id, 'system', 'Có tin nhắn bị báo cáo', null,
      '/admin/bao-cao', 'chatreport:' || v_id::text);
  end loop;
  return v_id;
end $$;

-- Xu ly bao cao: dismiss | hide_message | remove_member | hide_and_remove.
-- Ap dung cho MOI bao cao dang mo cua cung mot tin.
create or replace function public.resolve_report(p_report uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); r public.message_reports; c public.conversations;
  v_note text; v_hide boolean; v_remove boolean; v_taken text; v_actor_rank int; v_target_rank int; v_removed boolean := false; a record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_action not in ('dismiss','hide_message','remove_member','hide_and_remove') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  select * into r from public.message_reports where id = p_report for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  select * into c from public.conversations where id = r.conversation_id;
  -- Nhom nhanh: admin co pham vi chua nhanh do; cac loai khac: admin cap gia dinh
  if not coalesce(public.has_permission(r.family_id, 'chat', 'approve', c.branch_id), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if r.status <> 'open' then raise exception 'chat: already resolved' using errcode = 'P0001'; end if;
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 500 then raise exception 'note too long' using errcode = '22023'; end if;

  v_hide := p_action in ('hide_message','hide_and_remove');
  v_remove := p_action in ('remove_member','hide_and_remove');
  if v_remove and c.kind = 'direct' then
    raise exception 'cannot remove a member from a direct conversation' using errcode = '22023';
  end if;

  if v_remove and r.reported_user_id is not null then
    select rk.rank into v_actor_rank from public.family_memberships m join public.roles rk on rk.key = m.role_key
      where m.user_id = v_uid and m.family_id = r.family_id and m.status = 'active';
    select rk.rank into v_target_rank from public.family_memberships m join public.roles rk on rk.key = m.role_key
      where m.user_id = r.reported_user_id and m.family_id = r.family_id;
    if coalesce(v_target_rank, 99) < coalesce(v_actor_rank, 99) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  if v_hide then
    update public.messages set deleted_at = now(), deleted_by = v_uid, body = '', attachment_path = null
      where id = r.message_id and deleted_at is null;
  end if;
  if v_remove and r.reported_user_id is not null then
    v_removed := public._chat_leave(r.conversation_id, r.reported_user_id, 'removed', v_uid);
    if v_removed and c.kind = 'group' then
      perform public._chat_system_message(r.conversation_id,
        public._chat_display_name(r.reported_user_id) || ' đã bị gỡ khỏi nhóm');
    end if;
  end if;

  -- Bao cho nhung nguoi da bao cao tin nay (khong ke noi dung xu ly)
  for a in select rr.id, rr.reporter_id from public.message_reports rr
           where rr.message_id = r.message_id and rr.status = 'open' loop
    perform public._notify(r.family_id, a.reporter_id, 'system', 'Báo cáo tin nhắn của bạn đã được xử lý', null, '/tin-nhan',
      'chatreport-done:' || a.id::text);
  end loop;

  v_taken := case p_action when 'dismiss' then 'dismissed' when 'hide_message' then 'message_hidden'
                           when 'remove_member' then 'member_removed' else 'message_hidden_member_removed' end;
  update public.message_reports
    set status = 'resolved', action_taken = v_taken, resolved_by = v_uid, resolved_at = now(), resolution_note = v_note
    where message_id = r.message_id and status = 'open';

  perform public.write_audit(r.family_id, 'chat.report_resolve', 'message_report', p_report::text,
    jsonb_build_object('status', 'open'),
    jsonb_build_object('status', 'resolved', 'action', v_taken, 'conversation_id', r.conversation_id,
                       'message_id', r.message_id, 'reported_user_id', r.reported_user_id));
  if v_hide and r.reported_user_id is not null then
    perform public.write_audit(r.family_id, 'chat.message_hide', 'message', r.message_id::text,
      jsonb_build_object('conversation_id', r.conversation_id, 'sender_id', r.reported_user_id),
      jsonb_build_object('hidden_by', v_uid, 'via_report', p_report));
  end if;
  if v_remove and v_removed then
    perform public.write_audit(r.family_id, 'chat.member_remove', 'conversation', r.conversation_id::text, null,
      jsonb_build_object('user_id', r.reported_user_id, 'via_report', p_report));
  end if;

end $$;
