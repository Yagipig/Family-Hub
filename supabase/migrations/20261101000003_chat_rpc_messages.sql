-- Module D (Tin nhan) / migration 3: gui / sua / xoa / danh dau da doc / tat thong bao
-- Moi ham: security definer, search_path = public, kiem tra auth.uid(), thanh vien dang hoat dong, quyen 'chat'.
-- Loi nghiep vu dung errcode 'P0001' voi message bat dau bang 'chat: ' de giao dien dich sang tieng Viet.

create or replace function public.send_message(
  p_conversation uuid, p_body text, p_reply_to uuid default null, p_client_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.conversations;
  v_body text;
  v_other uuid;
  v_exist public.messages;
  v_id uuid;
  v_ts timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into c from public.conversations where id = p_conversation;
  if not found or not public._chat_member_ok(v_uid, p_conversation)
     or not public._chat_role_allows(v_uid, c.family_id, 'create') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_body := btrim(coalesce(p_body, ''), E' \t\r\n');
  if char_length(v_body) = 0 or char_length(v_body) > 4000 then
    raise exception 'invalid message body' using errcode = '22023';
  end if;

  -- Tuan tu hoa theo nguoi gui: chong vuot gioi han khi gui dong thoi, chong chen tin trung client_id
  perform pg_advisory_xact_lock(hashtextextended('chat_send:' || v_uid::text, 0));

  -- Gui lai cung client_id (mang chap chon) => tra ve tin da co, khong tao tin thu hai, khong tinh vao gioi han
  if p_client_id is not null then
    select * into v_exist from public.messages m where m.sender_id = v_uid and m.client_id = p_client_id;
    if found then
      if v_exist.conversation_id <> p_conversation then
        raise exception 'client id already used' using errcode = '22023';
      end if;
      return jsonb_build_object('id', v_exist.id, 'created_at', v_exist.created_at, 'duplicate', true);
    end if;
  end if;

  if c.kind = 'direct' then
    select cm.user_id into v_other from public.conversation_members cm
      where cm.conversation_id = c.id and cm.user_id <> v_uid;
    -- Nguoi kia khong con dung duoc chat, hoac mot trong hai da chan nhau: cung mot thong bao chung
    -- (nguoi bi chan khong biet minh bi chan).
    if v_other is null
       or not public._chat_member_ok(v_other, c.id)
       or not public._chat_role_allows(v_other, c.family_id, 'create')
       or exists (select 1 from public.chat_blocks b
                  where (b.blocker_id = v_uid and b.blocked_id = v_other)
                     or (b.blocker_id = v_other and b.blocked_id = v_uid)) then
      raise exception 'chat: unavailable' using errcode = 'P0001';
    end if;
  end if;

  if p_reply_to is not null then
    if not exists (select 1 from public.messages r
                   where r.id = p_reply_to and r.conversation_id = p_conversation
                     and public.chat_can_read(r.conversation_id, r.created_at)) then
      raise exception 'invalid reply target' using errcode = '22023';
    end if;
  end if;

  -- Gioi han tan suat: toi da 30 tin / phut / nguoi (tinh tren moi cuoc tro chuyen)
  if (select count(*) from public.messages m
      where m.sender_id = v_uid and m.kind = 'text' and m.created_at > clock_timestamp() - interval '1 minute') >= 30 then
    raise exception 'chat: rate limited' using errcode = 'P0001';
  end if;

  v_ts := clock_timestamp();
  insert into public.messages (conversation_id, sender_id, kind, body, reply_to, client_id, created_at)
  values (p_conversation, v_uid, 'text', v_body, p_reply_to, p_client_id, v_ts)
  returning messages.id into v_id;

  perform public._chat_notify_new(p_conversation, v_uid);
  return jsonb_build_object('id', v_id, 'created_at', v_ts, 'duplicate', false);
end $$;

-- Sua tin: chi chu tin, trong 15 phut ke tu luc gui, tin chua xoa
create or replace function public.edit_message(p_message uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.messages; c public.conversations; v_body text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into m from public.messages where id = p_message for update;
  if not found or m.sender_id is distinct from v_uid or not public.chat_can_read(m.conversation_id, m.created_at) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into c from public.conversations where id = m.conversation_id;
  if not public._chat_role_allows(v_uid, c.family_id, 'create') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if m.deleted_at is not null or m.kind <> 'text' then
    raise exception 'chat: cannot edit' using errcode = 'P0001';
  end if;
  if clock_timestamp() - m.created_at > interval '15 minutes' then
    raise exception 'chat: edit window closed' using errcode = 'P0001';
  end if;
  v_body := btrim(coalesce(p_body, ''), E' \t\r\n');
  if char_length(v_body) = 0 or char_length(v_body) > 4000 then
    raise exception 'invalid message body' using errcode = '22023';
  end if;
  if v_body = m.body then return; end if;
  update public.messages set body = v_body, edited_at = clock_timestamp() where id = p_message;
end $$;

-- Xoa mem: nguoi gui xoa tin cua minh (bat ky luc nao); quan tri nhom (chu nhom / admin gia dinh / admin nhanh trong pham vi)
-- xoa tin cua nguoi khac TRONG cuoc tro chuyen ho dang tham gia. Noi dung bi xoa sach ngay (body = '').
create or replace function public.delete_message(p_message uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.messages; c public.conversations; v_own boolean;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into m from public.messages where id = p_message for update;
  if not found or not public.chat_can_read(m.conversation_id, m.created_at) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if m.kind <> 'text' then raise exception 'chat: cannot delete' using errcode = 'P0001'; end if;
  select * into c from public.conversations where id = m.conversation_id;
  v_own := m.sender_id is not distinct from v_uid;
  if not v_own and not public.chat_can_moderate(m.conversation_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if m.deleted_at is not null then return; end if;  -- da xoa: khong lam gi (idempotent)
  update public.messages
    set deleted_at = now(), deleted_by = v_uid, body = '', attachment_path = null
    where id = p_message;
  if not v_own then
    perform public.write_audit(c.family_id, 'chat.message_hide', 'message', p_message::text,
      jsonb_build_object('conversation_id', m.conversation_id, 'sender_id', m.sender_id),
      jsonb_build_object('hidden_by', v_uid));
  end if;
end $$;

-- Danh dau da doc den thoi diem p_upto (mac dinh: bay gio). Khong bao gio lui lai. Dong thoi don thong bao 'chat' cua cuoc nay.
create or replace function public.mark_read(p_conversation uuid, p_upto timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_to timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public._chat_member_ok(v_uid, p_conversation) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_to := least(coalesce(p_upto, clock_timestamp()), clock_timestamp());
  update public.conversation_members
    set last_read_at = greatest(last_read_at, v_to)
    where conversation_id = p_conversation and user_id = v_uid and last_read_at < v_to;
  update public.notifications set read_at = now()
    where user_id = v_uid and dedupe_key = 'chat:' || p_conversation::text and read_at is null;
end $$;

create or replace function public.set_conversation_muted(p_conversation uuid, p_muted boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public._chat_member_ok(v_uid, p_conversation) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.conversation_members set muted = coalesce(p_muted, false)
    where conversation_id = p_conversation and user_id = v_uid;
end $$;
