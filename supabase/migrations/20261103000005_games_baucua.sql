-- Module G / migration 5: Bau cua tom ca (diem ao) - phong do quan tri mo
-- Luat co dien: dat n diem vao o (1 bau, 2 cua, 3 tom, 4 ca, 5 ga, 6 nai); 3 xuc xac duoc lac o MAY CHU (gen_random_bytes);
-- o ra k lan => nhan lai n + k*n (k = 0 thi mat n). Ti le hoan tra ky vong = 199/216 ~ 92,13%.
-- An toan: cuoc toi thieu/toi da/tong moi van thap; gioi han THUA toi da moi ngay dia phuong (cham la tu khoa toi ngay mai),
-- cung gioi han THANG toi da moi ngay; khong co "dat lai gap doi". Moi van deu ghi vao so diem.

create table public.bc_rooms (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index bc_one_open_room on public.bc_rooms (family_id) where status = 'open';

create table public.bc_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.bc_rooms(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  round_no int not null check (round_no >= 1),
  status text not null default 'betting' check (status in ('betting', 'rolled', 'cancelled')),
  betting_closes_at timestamptz not null,
  dice smallint[],
  created_at timestamptz not null default now(),
  rolled_at timestamptz,
  unique (room_id, round_no),
  check ((status = 'rolled') = (dice is not null)),
  check (dice is null or (array_length(dice, 1) = 3 and dice <@ array[1,2,3,4,5,6]::smallint[]))
);
create unique index bc_one_betting_round on public.bc_rounds (family_id) where status = 'betting';

create table public.bc_bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.bc_rounds(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol smallint not null check (symbol between 1 and 6),
  amount int not null check (amount between 1 and 200),
  local_day date not null,
  payout int check (payout is null or payout >= 0),
  rolled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (round_id, user_id, symbol)
);
create index bc_bets_user_idx on public.bc_bets (round_id, user_id);

-- Tien tra ve (da gom tien goc) theo luat co dien
create or replace function public._bc_payout(p_amount int, p_symbol smallint, p_dice smallint[]) returns int
language sql immutable set search_path = public as $$
  select case when k = 0 then 0 else p_amount * (1 + k) end
  from (select count(*)::int as k from unnest(p_dice) d where d = p_symbol) s;
$$;

-- Lac 3 xuc xac deu 1..6 bang gen_random_bytes (loai bo mau lech: byte >= 252 bi bo)
create or replace function public._bc_roll_dice() returns smallint[]
language plpgsql volatile set search_path = public, extensions as $$
declare res smallint[] := '{}'; b int; i int;
begin
  for i in 1..3 loop
    loop
      b := get_byte(extensions.gen_random_bytes(1), 0);
      exit when b < 252;
    end loop;
    res := res || ((b % 6) + 1)::smallint;
  end loop;
  return res;
end $$;

-- Thang/thua rong hom nay (ngay dia phuong) cua tat ca van DA CHOT, khong tinh cuoc dang cho (da tru vao so du)
create or replace function public._bc_net_settled(p_family uuid, p_user uuid, p_day date) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(l.delta) from public.points_ledger l
                   where l.family_id = p_family and l.user_id = p_user and l.local_day = p_day
                     and l.reason in ('baucua_bet', 'baucua_payout', 'baucua_refund')), 0)
       + coalesce((select sum(b.amount) from public.bc_bets b
                   join public.bc_rounds r on r.id = b.round_id
                   where b.family_id = p_family and b.user_id = p_user and b.local_day = p_day and r.status = 'betting'), 0);
$$;

create or replace function public.bc_open_room(p_family uuid, p_title text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public._games_require_admin(p_family);
  insert into public.bc_rooms (family_id, title, created_by) values (p_family, btrim(p_title), auth.uid())
    returning id into v_id;     -- chi mot phong mo moi gia dinh (chi muc duy nhat)
  perform public.write_audit(p_family, 'baucua.open_room', 'bc_room', v_id::text, null,
    jsonb_build_object('title', btrim(p_title)));
  return v_id;
end $$;

-- Chot van: lac xuc xac, tra thuong, ghi so diem. Noi bo (da khoa van).
create or replace function public._bc_settle(p_round public.bc_rounds) returns smallint[]
language plpgsql security definer set search_path = public as $$
declare v_dice smallint[]; b record; v_pay int;
begin
  v_dice := public._bc_roll_dice();
  update public.bc_rounds set status = 'rolled', dice = v_dice, rolled_at = now() where id = p_round.id;
  for b in select * from public.bc_bets where round_id = p_round.id order by id loop
    v_pay := public._bc_payout(b.amount, b.symbol, v_dice);
    if v_pay > 0 then
      perform public._points_add(b.family_id, b.user_id, v_pay, 'baucua_payout', p_round.id::text, b.local_day);
    end if;
    update public.bc_bets set payout = v_pay, rolled = true where id = b.id;
  end loop;
  return v_dice;
end $$;

-- Huy van dang dat: hoan lai diem
create or replace function public._bc_cancel_round(p_round public.bc_rounds) returns void
language plpgsql security definer set search_path = public as $$
declare b record;
begin
  for b in select * from public.bc_bets where round_id = p_round.id order by id loop
    perform public._points_add(b.family_id, b.user_id, b.amount, 'baucua_refund', p_round.id::text, b.local_day);
    update public.bc_bets set payout = b.amount, rolled = true where id = b.id;
  end loop;
  update public.bc_rounds set status = 'cancelled' where id = p_round.id;
end $$;

create or replace function public.bc_close_room(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.bc_rooms; rd public.bc_rounds;
begin
  select * into r from public.bc_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_admin(r.family_id);
  if r.status <> 'open' then raise exception 'already_closed' using errcode = 'P0001'; end if;
  for rd in select * from public.bc_rounds where room_id = p_room and status = 'betting' for update loop
    perform public._bc_cancel_round(rd);
  end loop;
  update public.bc_rooms set status = 'closed', closed_at = now() where id = p_room;
  perform public.write_audit(r.family_id, 'baucua.close_room', 'bc_room', p_room::text,
    jsonb_build_object('status', r.status), jsonb_build_object('status', 'closed'));
end $$;

-- Mo van moi (thoi gian dat cuoc 10..600 giay). Van truoc chua chot: neu da het gio thi chot luon, chua het gio thi tu choi.
create or replace function public.bc_new_round(p_room uuid, p_seconds int default 60) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.bc_rooms; rd public.bc_rounds; v_id uuid; v_no int;
begin
  select * into r from public.bc_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_admin(r.family_id);
  if not public._games_enabled(r.family_id) then raise exception 'games_disabled' using errcode = 'P0001'; end if;
  if r.status <> 'open' then raise exception 'room_closed' using errcode = 'P0001'; end if;
  if p_seconds is null or p_seconds < 10 or p_seconds > 600 then raise exception 'seconds must be 10..600' using errcode = '22023'; end if;
  select * into rd from public.bc_rounds where room_id = p_room and status = 'betting' for update;
  if found then
    if rd.betting_closes_at > now() then raise exception 'round_open' using errcode = 'P0001'; end if;
    perform public._bc_settle(rd);
  end if;
  select coalesce(max(round_no), 0) + 1 into v_no from public.bc_rounds where room_id = p_room;
  insert into public.bc_rounds (room_id, family_id, round_no, betting_closes_at)
  values (p_room, r.family_id, v_no, now() + make_interval(secs => p_seconds)) returning id into v_id;
  return v_id;
end $$;

-- Dat cuoc. Moi lan goi chi cong them mot khoan vao mot o; khong co "gap doi" hay "dat lai".
create or replace function public.bc_place_bet(p_round uuid, p_symbol int, p_amount int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  rd public.bc_rounds; s public.game_settings; v_day date; v_net int; v_round_total int; v_symbol_total int; v_pending int;
begin
  select * into rd from public.bc_rounds where id = p_round for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(rd.family_id);
  select * into s from public.game_settings where family_id = rd.family_id;
  if rd.status <> 'betting' or rd.betting_closes_at <= now() then raise exception 'betting_closed' using errcode = 'P0001'; end if;
  if p_symbol is null or p_symbol < 1 or p_symbol > 6 then raise exception 'bad symbol' using errcode = '22023'; end if;
  if p_amount is null or p_amount < s.bc_min_bet or p_amount > s.bc_max_bet then
    raise exception 'bet_out_of_range' using errcode = 'P0001';
  end if;
  perform public._points_ensure(rd.family_id, auth.uid());
  v_day := public._user_local_day(auth.uid());
  v_net := public._bc_net_settled(rd.family_id, auth.uid(), v_day);
  if v_net <= -s.bc_daily_loss_cap then raise exception 'daily_limit_loss' using errcode = 'P0001'; end if;
  if v_net >= s.bc_daily_win_cap then raise exception 'daily_limit_win' using errcode = 'P0001'; end if;
  select coalesce(sum(amount), 0), coalesce(sum(amount) filter (where symbol = p_symbol), 0)
    into v_round_total, v_symbol_total from public.bc_bets where round_id = p_round and user_id = auth.uid();
  if v_symbol_total + p_amount > s.bc_max_bet then raise exception 'over_max_bet' using errcode = 'P0001'; end if;
  if v_round_total + p_amount > s.bc_max_round_total then raise exception 'over_round_total' using errcode = 'P0001'; end if;
  -- khong de van nay co the lam tong thua trong ngay vuot gioi han
  if v_round_total + p_amount > s.bc_daily_loss_cap + v_net then raise exception 'over_daily_budget' using errcode = 'P0001'; end if;
  perform public._points_add(rd.family_id, auth.uid(), -p_amount, 'baucua_bet', p_round::text, v_day);
  insert into public.bc_bets (round_id, family_id, user_id, symbol, amount, local_day)
  values (p_round, rd.family_id, auth.uid(), p_symbol, p_amount, v_day)
  on conflict (round_id, user_id, symbol) do update set amount = public.bc_bets.amount + excluded.amount;
  return jsonb_build_object('round_total', v_round_total + p_amount, 'balance', public._points_balance(rd.family_id, auth.uid()));
end $$;

-- Lac xuc xac va chot van: quan tri bat ky luc nao; thanh vien khi da het gio dat cuoc
create or replace function public.bc_roll(p_round uuid) returns smallint[]
language plpgsql security definer set search_path = public as $$
declare rd public.bc_rounds; v_admin boolean;
begin
  select * into rd from public.bc_rounds where id = p_round for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_admin := coalesce(public.has_permission(rd.family_id, 'games', 'update'), false);
  if not v_admin then perform public._games_require_play(rd.family_id); end if;
  if not public._games_enabled(rd.family_id) then raise exception 'games_disabled' using errcode = 'P0001'; end if;   -- ke ca quan tri
  if rd.status <> 'betting' then raise exception 'not_betting' using errcode = 'P0001'; end if;
  if not v_admin and rd.betting_closes_at > now() then raise exception 'too_early' using errcode = 'P0001'; end if;
  return public._bc_settle(rd);
end $$;

-- Trang thai cua toi trong phong dang mo: van hien tai, cuoc cua toi, thang/thua hom nay, gioi han, co bi khoa khong
create or replace function public.bc_my_state(p_family uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.game_settings; r public.bc_rooms; rd public.bc_rounds; v_day date; v_net int; v_lock text; v_bets jsonb; v_last public.bc_rounds;
begin
  perform public._games_require_play(p_family);
  perform public._points_ensure(p_family, auth.uid());
  select * into s from public.game_settings where family_id = p_family;
  v_day := public._user_local_day(auth.uid());
  v_net := public._bc_net_settled(p_family, auth.uid(), v_day);
  v_lock := case when v_net <= -s.bc_daily_loss_cap then 'loss' when v_net >= s.bc_daily_win_cap then 'win' else null end;
  select * into r from public.bc_rooms where family_id = p_family and status = 'open';
  if found then
    select * into rd from public.bc_rounds where room_id = r.id order by round_no desc limit 1;
    if found then
      select coalesce(jsonb_agg(jsonb_build_object('symbol', b.symbol, 'amount', b.amount, 'payout', b.payout) order by b.symbol), '[]'::jsonb)
        into v_bets from public.bc_bets b where b.round_id = rd.id and b.user_id = auth.uid();
    end if;
  end if;
  return jsonb_build_object(
    'balance', public._points_balance(p_family, auth.uid()),
    'net_today', v_net, 'locked', v_lock,
    'limits', jsonb_build_object('min_bet', s.bc_min_bet, 'max_bet', s.bc_max_bet, 'round_total', s.bc_max_round_total,
                                 'loss_cap', s.bc_daily_loss_cap, 'win_cap', s.bc_daily_win_cap),
    'room', case when r.id is null then null else jsonb_build_object('id', r.id, 'title', r.title) end,
    'round', case when rd.id is null then null else jsonb_build_object(
        'id', rd.id, 'no', rd.round_no, 'status', rd.status, 'closes_at', rd.betting_closes_at, 'dice', rd.dice) end,
    'bets', coalesce(v_bets, '[]'::jsonb));
end $$;

alter table public.bc_rooms enable row level security;
alter table public.bc_rounds enable row level security;
alter table public.bc_bets enable row level security;
create policy bc_rooms_select on public.bc_rooms for select to authenticated using (public.games_can_read(family_id));
create policy bc_rounds_select on public.bc_rounds for select to authenticated using (public.games_can_read(family_id));
-- Cuoc cua minh; cuoc cua nguoi khac chi hien sau khi van da chot
create policy bc_bets_select on public.bc_bets for select to authenticated
  using (public.games_can_read(family_id) and (user_id = auth.uid() or rolled));

revoke all on public.bc_rooms, public.bc_rounds, public.bc_bets from anon, authenticated;
grant select on public.bc_rooms, public.bc_rounds, public.bc_bets to authenticated;

grant execute on function
  public.bc_open_room(uuid, text), public.bc_close_room(uuid), public.bc_new_round(uuid, int),
  public.bc_place_bet(uuid, int, int), public.bc_roll(uuid), public.bc_my_state(uuid)
  to authenticated;
