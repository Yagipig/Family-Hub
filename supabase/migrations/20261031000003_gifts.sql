-- Module C / migration 3: li xi / qua (gifts). CHI GHI NHAN. Khong co bang so du, khong co buoc nao cham tien that.
-- Trang thai do chinh nguoi dung tu xac nhan: pledged -> sender_marked_sent -> recipient_confirmed
-- (hoac cancelled / disputed). Chuyen trang thai chi bang gift_transition().

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  amount_minor bigint check (amount_minor is null or (amount_minor > 0 and amount_minor <= 100000000000000)),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pledged'
    check (status in ('pledged','sender_marked_sent','recipient_confirmed','cancelled','disputed')),
  sender_marked_at timestamptz,
  recipient_confirmed_at timestamptz,
  cancelled_at timestamptz,
  disputed_at timestamptz,
  dispute_note text check (dispute_note is null or char_length(dispute_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  check ((amount_minor is null) = (currency is null)),
  check ((status = 'recipient_confirmed') = (recipient_confirmed_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null))
);
create index gifts_sender_idx on public.gifts(sender_id, created_at desc);
create index gifts_recipient_idx on public.gifts(recipient_id, created_at desc);
create index gifts_card_idx on public.gifts(card_id) where card_id is not null;
create trigger gifts_updated before update on public.gifts
  for each row execute function public.set_updated_at();

-- Li xi dinh kem thiep chi hien voi nguoi nhan khi thiep da toi gio
create or replace function public._gift_visible_to_recipient(p_card uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_card is null or exists (select 1 from public.cards c where c.id = p_card and c.scheduled_at <= now());
$$;

alter table public.gifts enable row level security;
create policy gifts_select on public.gifts for select to authenticated
  using (public.is_family_member(family_id)
         and (sender_id = auth.uid()
              or (recipient_id = auth.uid() and public._gift_visible_to_recipient(card_id))));
revoke all on public.gifts from anon, authenticated;
grant select on public.gifts to authenticated;
grant execute on function public._gift_visible_to_recipient(uuid) to authenticated;

-- Tao li xi (noi bo). Khong kiem tra quyen o day: ham goi (create_gift / send_card) da kiem tra.
create or replace function public._create_gift(
  p_family uuid, p_sender uuid, p_recipient uuid, p_amount bigint, p_currency text, p_note text, p_card uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_cur text; v_note text;
begin
  v_cur := nullif(upper(btrim(p_currency)), '');
  v_note := nullif(btrim(p_note), '');
  if (p_amount is null) <> (v_cur is null) then
    raise exception 'amount and currency go together' using errcode = '22023';
  end if;
  if p_amount is not null and (p_amount <= 0 or p_amount > 100000000000000) then
    raise exception 'bad amount' using errcode = '22023';
  end if;
  if v_cur is not null and v_cur !~ '^[A-Z]{3}$' then
    raise exception 'bad currency' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'note too long' using errcode = '22023';
  end if;
  if p_sender = p_recipient then raise exception 'cannot gift yourself' using errcode = '22023'; end if;
  if not exists (select 1 from public.family_memberships m
                 where m.user_id = p_recipient and m.family_id = p_family and m.status = 'active'
                   and public._role_can(m.role_key, 'gifts', 'view')) then
    raise exception 'recipient is not an active family member' using errcode = '22023';
  end if;

  insert into public.gifts (family_id, card_id, sender_id, recipient_id, amount_minor, currency, note)
  values (p_family, p_card, p_sender, p_recipient, p_amount, v_cur, v_note)
  returning id into v_id;
  -- Nhat ky khong ghi so tien (quan tri vien doc duoc nhat ky)
  perform public.write_audit(p_family, 'gift.create', 'gift', v_id::text, null,
    jsonb_build_object('sender', p_sender, 'recipient', p_recipient, 'card_id', p_card));
  return v_id;
end $$;

-- Hen li xi doc lap (khong kem thiep). Nguoi nhan thay ngay va duoc thong bao.
create or replace function public.create_gift(
  p_family uuid, p_recipient uuid, p_amount_minor bigint, p_currency text, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public._cards_can(p_family, 'gifts', 'create') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select count(*) from public.gifts g where g.sender_id = auth.uid() and g.created_at > now() - interval '24 hours') >= 100 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  v_id := public._create_gift(p_family, auth.uid(), p_recipient, p_amount_minor, p_currency, p_note, null);
  select display_name into v_name from public.user_profiles where id = auth.uid();
  perform public._notify(p_family, p_recipient, 'gift',
    left('Bạn có một lì xì (ghi nhận) từ ' || coalesce(v_name, 'người thân'), 200), null, '/li-xi', 'gift:' || v_id::text || ':new');
  return v_id;
end $$;

-- Chuyen trang thai. Ai duoc lam gi:
--   mark_sent (nguoi gui):  pledged | disputed             -> sender_marked_sent   ("toi da chuyen")
--   cancel    (nguoi gui):  pledged | disputed             -> cancelled
--   confirm   (nguoi nhan): sender_marked_sent | disputed  -> recipient_confirmed  ("da nhan")
--   dispute   (nguoi nhan): sender_marked_sent             -> disputed             ("chua nhan duoc")
create or replace function public.gift_transition(p_gift uuid, p_action text, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  g public.gifts; v_me uuid := auth.uid(); v_new text; v_name text; v_note text;
  v_notify_user uuid; v_title text; v_visible boolean;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into g from public.gifts where id = p_gift for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if not public.is_family_member(g.family_id) or (g.sender_id <> v_me and g.recipient_id <> v_me) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_visible := public._gift_visible_to_recipient(g.card_id);
  if g.recipient_id = v_me and not coalesce(v_visible, false) then
    raise exception 'forbidden' using errcode = '42501';   -- thiep chua toi gio: nguoi nhan chua thay li xi
  end if;
  v_note := nullif(btrim(p_note), '');
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'note too long' using errcode = '22023';
  end if;
  select display_name into v_name from public.user_profiles where id = v_me;
  v_name := coalesce(v_name, 'Một người thân');

  if p_action = 'mark_sent' then
    if g.sender_id <> v_me then raise exception 'forbidden' using errcode = '42501'; end if;
    if g.status not in ('pledged','disputed') then raise exception 'invalid transition' using errcode = 'P0001'; end if;
    v_new := 'sender_marked_sent';
    update public.gifts set status = v_new, sender_marked_at = now() where id = g.id;
    v_notify_user := g.recipient_id;
    v_title := v_name || ' đã đánh dấu đã chuyển lì xì cho bạn. Hãy tự kiểm tra rồi xác nhận khi nhận được.';
  elsif p_action = 'cancel' then
    if g.sender_id <> v_me then raise exception 'forbidden' using errcode = '42501'; end if;
    if g.status not in ('pledged','disputed') then raise exception 'invalid transition' using errcode = 'P0001'; end if;
    v_new := 'cancelled';
    update public.gifts set status = v_new, cancelled_at = now() where id = g.id;
    v_notify_user := g.recipient_id;
    v_title := v_name || ' đã huỷ một lì xì dành cho bạn.';
  elsif p_action = 'confirm' then
    if g.recipient_id <> v_me then raise exception 'forbidden' using errcode = '42501'; end if;
    if g.status not in ('sender_marked_sent','disputed') then raise exception 'invalid transition' using errcode = 'P0001'; end if;
    v_new := 'recipient_confirmed';
    update public.gifts set status = v_new, recipient_confirmed_at = now() where id = g.id;
    v_notify_user := g.sender_id;
    v_title := v_name || ' xác nhận đã nhận lì xì của bạn.';
  elsif p_action = 'dispute' then
    if g.recipient_id <> v_me then raise exception 'forbidden' using errcode = '42501'; end if;
    if g.status <> 'sender_marked_sent' then raise exception 'invalid transition' using errcode = 'P0001'; end if;
    v_new := 'disputed';
    update public.gifts set status = v_new, disputed_at = now(), dispute_note = v_note where id = g.id;
    v_notify_user := g.sender_id;
    v_title := v_name || ' báo là chưa nhận được lì xì. Hai bên hãy trao đổi với nhau.';
  else
    raise exception 'unknown action' using errcode = '22023';
  end if;

  perform public.write_audit(g.family_id, 'gift.' || p_action, 'gift', g.id::text,
    jsonb_build_object('status', g.status), jsonb_build_object('status', v_new));
  -- Nguoi nhan chi duoc bao khi li xi da hien voi ho; moi lan chuyen trang thai co khoa chong trung rieng
  if v_notify_user = g.sender_id or coalesce(v_visible, false) then
    perform public._notify(g.family_id, v_notify_user, 'gift', left(v_title, 200), null, '/li-xi',
      'gift:' || g.id::text || ':' || p_action || ':' || extract(epoch from clock_timestamp())::bigint::text);
  end if;
  return v_new;
end $$;

grant execute on function public.create_gift(uuid, uuid, bigint, text, text),
  public.gift_transition(uuid, text, text) to authenticated;
