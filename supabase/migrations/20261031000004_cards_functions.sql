-- Module C / migration 4: ham nghiep vu cua thiep (gui, sua, huy, mo, giao hen gio).

-- Cho giao dien biet minh co duoc gui thiep/li xi khong (chi tra loi ve QUYEN CUA CHINH NGUOI GOI).
-- Khong dung has_permission vi branch_admin + 'create' + khong nhanh luon false (xem _cards_can).
create or replace function public.cards_can(p_family uuid, p_module text, p_action text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_module in ('cards', 'gifts') and public._cards_can(p_family, p_module, p_action);
$$;

-- Danh sach nguoi co the chon lam nguoi nhan (thanh vien dang hoat dong, tru chinh minh)
create or replace function public.list_card_audience(p_family uuid)
returns table (user_id uuid, display_name text, branch_id uuid, branch_name text, timezone text, country_code text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not (public._cards_can(p_family, 'cards', 'create') or public._cards_can(p_family, 'gifts', 'create')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.user_id, p.display_name, m.branch_id, b.name, p.timezone, p.country_code
    from public.family_memberships m
    join public.user_profiles p on p.id = m.user_id
    left join public.branches b on b.id = m.branch_id and b.deleted_at is null
    where m.family_id = p_family and m.status = 'active' and m.user_id <> auth.uid()
      and public._role_can(m.role_key, 'cards', 'view')      -- khach (guest) khong xem the thiep nen khong la nguoi nhan
    order by lower(p.display_name);
end $$;

-- Mo rong nhom nhan thanh danh sach tai khoan (noi bo). Toi da 200 nguoi, khong gom chinh nguoi gui.
create or replace function public._resolve_card_audience(
  p_family uuid, p_sender uuid, p_kind text, p_users uuid[], p_branch uuid
) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare v_ids uuid[]; v_want uuid[];
begin
  if p_kind = 'users' then
    select coalesce(array_agg(distinct u), '{}') into v_want
      from unnest(coalesce(p_users, '{}')) u where u is not null and u <> p_sender;
    if cardinality(v_want) > 200 then raise exception 'recipient_limit' using errcode = '22023'; end if;
    select coalesce(array_agg(m.user_id), '{}') into v_ids
      from public.family_memberships m
      where m.family_id = p_family and m.status = 'active' and m.user_id = any(v_want)
        and public._role_can(m.role_key, 'cards', 'view');
    if cardinality(v_ids) <> cardinality(v_want) then
      raise exception 'recipient is not an active family member' using errcode = '22023';
    end if;
  elsif p_kind = 'branch' then
    if p_branch is null or not exists (select 1 from public.branches b
         where b.id = p_branch and b.family_id = p_family and b.deleted_at is null) then
      raise exception 'branch does not belong to family' using errcode = '22023';
    end if;
    select coalesce(array_agg(m.user_id), '{}') into v_ids
      from public.family_memberships m
      where m.family_id = p_family and m.status = 'active' and m.user_id <> p_sender
        and public._role_can(m.role_key, 'cards', 'view')
        and public.branch_in_scope(p_branch, m.branch_id);
  elsif p_kind = 'family' then
    select coalesce(array_agg(m.user_id), '{}') into v_ids
      from public.family_memberships m
      where m.family_id = p_family and m.status = 'active' and m.user_id <> p_sender
        and public._role_can(m.role_key, 'cards', 'view');
  else
    raise exception 'bad audience' using errcode = '22023';
  end if;
  if cardinality(v_ids) = 0 then raise exception 'no_recipients' using errcode = '22023'; end if;
  if cardinality(v_ids) > 200 then raise exception 'recipient_limit' using errcode = '22023'; end if;
  return v_ids;
end $$;

-- Gio hen: rong hoac da qua => gui ngay; qua 366 ngay => tu choi
create or replace function public._card_schedule(p_scheduled timestamptz) returns timestamptz
language plpgsql stable set search_path = public as $$
begin
  if p_scheduled is null or p_scheduled <= now() then return now(); end if;
  if p_scheduled > now() + interval '366 days' then raise exception 'schedule_too_far' using errcode = '22023'; end if;
  return p_scheduled;
end $$;

-- Tao thong bao cho mot nguoi nhan (the + li xi dinh kem). Idempotent nho dedupe_key. Noi bo.
create or replace function public._notify_card_recipient(p_card uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.cards; v_name text; g record;
begin
  select * into c from public.cards where id = p_card;
  if not found then return; end if;
  select display_name into v_name from public.user_profiles where id = c.sender_id;
  v_name := coalesce(v_name, 'người thân');
  -- Khong dua noi dung loi chuc vao thong bao
  perform public._notify(c.family_id, p_user, 'card', left('Bạn nhận được một tấm thiệp từ ' || v_name, 200),
    null, '/thiep/' || c.id::text, 'card:' || c.id::text);
  for g in select id from public.gifts
           where card_id = c.id and recipient_id = p_user and status <> 'cancelled' loop
    perform public._notify(c.family_id, p_user, 'gift', left('Bạn có một lì xì (ghi nhận) từ ' || v_name, 200),
      null, '/li-xi', 'gift:' || g.id::text || ':new');
  end loop;
  update public.card_recipients set notified_at = now()
    where card_id = c.id and user_id = p_user and notified_at is null;
end $$;

-- Giao ca the (noi bo): thong bao cho moi nguoi nhan chua duoc bao, danh dau da giao
create or replace function public._deliver_card(p_card uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select user_id from public.card_recipients where card_id = p_card and notified_at is null loop
    perform public._notify_card_recipient(p_card, r.user_id);
    n := n + 1;
  end loop;
  update public.cards set delivered_at = now() where id = p_card and delivered_at is null;
  return n;
end $$;

create or replace function public.send_card(
  p_family uuid, p_template text, p_title text, p_message text,
  p_audience_kind text, p_user_ids uuid[], p_branch uuid, p_scheduled timestamptz,
  p_with_gift boolean default false, p_gift_amount bigint default null, p_gift_currency text default null,
  p_gift_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid(); v_ids uuid[]; v_sched timestamptz; v_id uuid; v_title text; v_msg text; u uuid;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public._cards_can(p_family, 'cards', 'create') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.card_templates t where t.key = p_template and t.active) then
    raise exception 'unknown template' using errcode = '22023';
  end if;
  v_title := nullif(btrim(p_title), '');
  v_msg := btrim(p_message);
  if v_title is not null and char_length(v_title) > 120 then raise exception 'title too long' using errcode = '22023'; end if;
  if v_msg is null or char_length(v_msg) < 1 or char_length(v_msg) > 2000 then
    raise exception 'message length' using errcode = '22023';
  end if;
  if (select count(*) from public.cards c where c.sender_id = v_me and c.created_at > now() - interval '24 hours') >= 50 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  v_ids := public._resolve_card_audience(p_family, v_me, p_audience_kind, p_user_ids, p_branch);
  if coalesce(p_with_gift, false) then
    if not public._cards_can(p_family, 'gifts', 'create') then raise exception 'forbidden' using errcode = '42501'; end if;
    if cardinality(v_ids) > 20 then raise exception 'gift_recipient_limit' using errcode = '22023'; end if;
  end if;
  v_sched := public._card_schedule(p_scheduled);

  insert into public.cards (family_id, sender_id, template_key, title, message, audience_kind, audience_branch_id, scheduled_at)
  values (p_family, v_me, p_template, v_title, v_msg, p_audience_kind,
          case when p_audience_kind = 'branch' then p_branch end, v_sched)
  returning id into v_id;
  insert into public.card_recipients (card_id, user_id) select v_id, x from unnest(v_ids) x;
  if coalesce(p_with_gift, false) then
    foreach u in array v_ids loop
      perform public._create_gift(p_family, v_me, u, p_gift_amount, p_gift_currency, p_gift_note, v_id);
    end loop;
  end if;
  if v_sched <= now() then perform public._deliver_card(v_id); end if;
  return v_id;
end $$;

-- Sua thiep: chi nguoi gui, chi khi CHUA toi gio. Doi nguoi nhan khong duoc khi da dinh kem li xi.
create or replace function public.update_card(
  p_card uuid, p_template text, p_title text, p_message text,
  p_audience_kind text, p_user_ids uuid[], p_branch uuid, p_scheduled timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
declare c public.cards; v_ids uuid[]; v_sched timestamptz; v_title text; v_msg text; v_has_gifts boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into c from public.cards where id = p_card for update;
  if not found or c.deleted_at is not null or c.sender_id <> auth.uid() or not public.is_family_member(c.family_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if c.delivered_at is not null or c.scheduled_at <= now() then
    raise exception 'card_already_delivered' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.card_templates t where t.key = p_template and t.active) then
    raise exception 'unknown template' using errcode = '22023';
  end if;
  v_title := nullif(btrim(p_title), '');
  v_msg := btrim(p_message);
  if v_title is not null and char_length(v_title) > 120 then raise exception 'title too long' using errcode = '22023'; end if;
  if v_msg is null or char_length(v_msg) < 1 or char_length(v_msg) > 2000 then
    raise exception 'message length' using errcode = '22023';
  end if;
  v_sched := public._card_schedule(p_scheduled);

  v_has_gifts := exists (select 1 from public.gifts g where g.card_id = c.id and g.status <> 'cancelled');
  if v_has_gifts then
    -- giu nguyen nguoi nhan: chi cho phep khi nhom nhan khong doi
    if p_audience_kind is distinct from c.audience_kind
       or (p_audience_kind = 'branch' and p_branch is distinct from c.audience_branch_id)
       or (p_audience_kind = 'users' and (
             select coalesce(array_agg(distinct x order by x), '{}') from unnest(coalesce(p_user_ids, '{}')) x where x <> c.sender_id)
           is distinct from (select coalesce(array_agg(r.user_id order by r.user_id), '{}')
                             from public.card_recipients r where r.card_id = c.id)) then
      raise exception 'card_has_gifts' using errcode = 'P0001';
    end if;
  else
    v_ids := public._resolve_card_audience(c.family_id, c.sender_id, p_audience_kind, p_user_ids, p_branch);
    delete from public.card_recipients where card_id = c.id and not (user_id = any(v_ids));
    insert into public.card_recipients (card_id, user_id) select c.id, x from unnest(v_ids) x
      on conflict (card_id, user_id) do nothing;
  end if;

  update public.cards set template_key = p_template, title = v_title, message = v_msg,
    audience_kind = p_audience_kind,
    audience_branch_id = case when p_audience_kind = 'branch' then p_branch end,
    scheduled_at = v_sched
    where id = c.id;
  if v_sched <= now() then perform public._deliver_card(c.id); end if;
end $$;

-- Huy thiep (xoa mem). Li xi dinh kem dang o trang thai "da hen" cung bi huy.
create or replace function public.cancel_card(p_card uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.cards; g record;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into c from public.cards where id = p_card for update;
  if not found or c.deleted_at is not null or c.sender_id <> auth.uid() or not public.is_family_member(c.family_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.cards set deleted_at = now() where id = c.id;
  for g in select id from public.gifts where card_id = c.id and status = 'pledged' for update loop
    update public.gifts set status = 'cancelled', cancelled_at = now() where id = g.id;
    perform public.write_audit(c.family_id, 'gift.cancel', 'gift', g.id::text,
      jsonb_build_object('status', 'pledged'), jsonb_build_object('status', 'cancelled', 'reason', 'card_cancelled'));
  end loop;
end $$;

-- Nguoi nhan mo thiep: danh dau da mo (mot lan), doc thong bao tuong ung
create or replace function public.mark_card_opened(p_card uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.card_is_visible_to_me(p_card) then return false; end if;
  update public.card_recipients set status = 'opened', opened_at = now()
    where card_id = p_card and user_id = auth.uid() and status = 'unseen';
  get diagnostics n = row_count;
  update public.notifications set read_at = now()
    where user_id = auth.uid() and read_at is null and dedupe_key = 'card:' || p_card::text;
  return n > 0;
end $$;

-- Trang thiep khi mo goi ham nay: tao thong bao con thieu cho CHINH nguoi dung (idempotent)
create or replace function public.deliver_my_due_cards() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  for r in select cr.card_id from public.card_recipients cr
           join public.cards c on c.id = cr.card_id
           where cr.user_id = auth.uid() and cr.notified_at is null
             and c.deleted_at is null and c.scheduled_at <= now()
             and public.is_family_member(c.family_id)
           limit 200 loop
    perform public._notify_card_recipient(r.card_id, auth.uid());
    n := n + 1;
  end loop;
  return n;
end $$;

-- Job (service_role): giao cac thiep da toi gio. p_now bi chan tren boi now() de khong bao thiep chua hien.
create or replace function public.deliver_due_cards(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_now timestamptz := least(coalesce(p_now, now()), now()); n int := 0;
begin
  for r in select id from public.cards
           where deleted_at is null and delivered_at is null and scheduled_at <= v_now
           order by scheduled_at limit 500
           for update skip locked loop
    perform public._deliver_card(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

grant execute on function
  public.cards_can(uuid, text, text), public.list_card_audience(uuid),
  public.send_card(uuid, text, text, text, text, uuid[], uuid, timestamptz, boolean, bigint, text, text),
  public.update_card(uuid, text, text, text, text, uuid[], uuid, timestamptz),
  public.cancel_card(uuid), public.mark_card_opened(uuid), public.deliver_my_due_cards()
  to authenticated;
grant execute on function public.deliver_due_cards(timestamptz) to service_role;
