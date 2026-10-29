-- Module G / Tien cuoc lo to + cap la qua admin (nguoi dung chot 29/10/2026):
-- - Vao phong (chon bang tinh / nhan to co dien) nguoi choi CHON MUC CUOC theo menh gia 1.000..50.000 la,
--   tru thang vao vi (points_ledger 'loto_stake'). Bot cuoc ao 1.000.
-- - Tong cuoc cua ca phong (+ giai chu phong dat) thanh GIAI, chia deu cho cac to thang nhu truoc.
-- - Huy phong / ket thuc khong nguoi thang / doi bang -> HOAN cuoc ('loto_refund').
-- - Het vi -> ngay tai phong co form XIN CAP: chon menh gia gui yeu cau, ADMIN DUYET thi tien vao vi ('grant').
-- Dong thoi SUA LOI TIEM AN tu dot 1: ly do 'loto_false_claim' (phat kinh sai) chua tung duoc them vao
-- check cua points_ledger.reason -> bat cu lan phat nao > 0 cung se lam hong giao dich; nay bo sung day du.

-- ---------- 1. Mo rong danh sach ly do cua so diem ----------
do $$
declare v_con text;
begin
  select conname into v_con from pg_constraint
   where conrelid = 'public.points_ledger'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%reason%';
  if v_con is not null then execute format('alter table public.points_ledger drop constraint %I', v_con); end if;
end $$;
alter table public.points_ledger add constraint points_ledger_reason_check
  check (reason in ('start', 'daily_gift', 'lixi', 'lottery_ticket', 'lottery_refund',
    'lottery_prize', 'loto_prize', 'baucua_bet', 'baucua_payout', 'baucua_refund',
    'loto_false_claim', 'grant', 'loto_stake', 'loto_refund'));

-- ---------- 2. Cot tien cuoc tren to + view cong khai muc cuoc ----------
alter table public.loto_cards add column if not exists stake_points int not null default 0
  check (stake_points >= 0);

create or replace view public.loto_room_cards_v as
select c.room_id, c.family_id, c.board_code, c.user_id, c.card_no, c.bot_name, c.id as card_id, c.stake_points
from public.loto_cards c
where public.games_can_read(c.family_id);
grant select on public.loto_room_cards_v to authenticated;

create or replace function public._loto_pot(p_room uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(c.stake_points), 0)::int from public.loto_cards c
   where c.room_id = p_room and c.card_no = 1;
$$;

-- ---------- 3. Yeu cau cap la + admin duyet ----------
create table public.point_grant_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null check (amount in (1000, 2000, 5000, 10000, 20000, 50000)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz
);
create unique index point_grant_requests_one_pending
  on public.point_grant_requests (family_id, user_id) where status = 'pending';
create index point_grant_requests_family_idx on public.point_grant_requests (family_id, status, created_at);
alter table public.point_grant_requests enable row level security;
create policy point_grant_requests_select on public.point_grant_requests for select to authenticated
  using (user_id = auth.uid() or coalesce(public.has_permission(family_id, 'games', 'update'), false));
revoke all on public.point_grant_requests from anon, authenticated;
grant select on public.point_grant_requests to authenticated;

create or replace function public.points_request_grant(p_family uuid, p_amount int) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid(); u record; v_name text;
begin
  perform public._games_require_play(p_family);
  if p_amount is null or p_amount not in (1000, 2000, 5000, 10000, 20000, 50000) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if exists (select 1 from public.point_grant_requests g
              where g.family_id = p_family and g.user_id = auth.uid() and g.status = 'pending') then
    raise exception 'request_pending' using errcode = 'P0001';
  end if;
  insert into public.point_grant_requests (id, family_id, user_id, amount)
  values (v_id, p_family, auth.uid(), p_amount);
  select display_name into v_name from public.user_profiles where id = auth.uid();
  for u in select m.user_id from public.family_memberships m
           where m.family_id = p_family and m.status = 'active' and m.user_id <> auth.uid()
             and public._user_has_permission(m.user_id, p_family, 'games', 'update')
  loop
    perform public._notify(p_family, u.user_id, 'system',
      'Yêu cầu cấp lá chơi trò chơi',
      coalesce(v_name, 'Một thành viên') || ' xin cấp ' || p_amount || ' lá. Vào Quản trị → Trò chơi để duyệt.',
      '/admin/tro-choi', 'grant-req:' || v_id::text || ':' || u.user_id::text);
  end loop;
  return v_id;
end $$;

create or replace function public.points_cancel_grant(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.point_grant_requests;
begin
  select * into g from public.point_grant_requests where id = p_request for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if g.user_id <> auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
  if g.status <> 'pending' then raise exception 'not_pending' using errcode = 'P0001'; end if;
  update public.point_grant_requests set status = 'cancelled' where id = p_request;
end $$;

create or replace function public.points_decide_grant(p_request uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare g public.point_grant_requests;
begin
  select * into g from public.point_grant_requests where id = p_request for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_admin(g.family_id);
  if g.status <> 'pending' then raise exception 'not_pending' using errcode = 'P0001'; end if;
  if coalesce(p_approve, false) then
    update public.point_grant_requests
       set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = p_request;
    perform public._points_add(g.family_id, g.user_id, g.amount, 'grant', 'grant:' || p_request::text);
    perform public._notify(g.family_id, g.user_id, 'system',
      'Đã cấp ' || g.amount || ' lá vào ví của bạn',
      'Tiền đã vào ví — bạn vào phòng chọn mức cược và chơi nhé!',
      '/tro-choi', 'grant-done:' || p_request::text);
  else
    update public.point_grant_requests
       set status = 'rejected', decided_by = auth.uid(), decided_at = now() where id = p_request;
    perform public._notify(g.family_id, g.user_id, 'system',
      'Yêu cầu cấp lá chưa được duyệt',
      'Yêu cầu cấp ' || g.amount || ' lá lần này chưa được duyệt. Bạn thử xin mệnh giá khác nhé.',
      '/tro-choi', 'grant-done:' || p_request::text);
  end if;
  perform public.write_audit(g.family_id, 'points.grant_decide', 'point_grant_request', p_request::text, null,
    jsonb_build_object('approve', coalesce(p_approve, false), 'amount', g.amount, 'user', g.user_id));
end $$;

grant execute on function
  public.points_request_grant(uuid, int),
  public.points_cancel_grant(uuid),
  public.points_decide_grant(uuid, boolean)
  to authenticated;

-- ---------- 4. Vao phong phai dat cuoc ----------
drop function if exists public.loto_claim_board(uuid, text, text);
create or replace function public.loto_claim_board(p_room uuid, p_code text, p_room_code text default null, p_stake int default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; b public.loto_boards;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(r.family_id);
  if r.mode <> 'province' then raise exception 'wrong_mode' using errcode = 'P0001'; end if;
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  perform public._loto_require_join(r, p_room_code);
  select * into b from public.loto_boards where code = p_code;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.loto_cards c where c.room_id = p_room and c.user_id = auth.uid()) then
    raise exception 'already_joined' using errcode = 'P0001';
  end if;
  if p_stake is null or p_stake not in (1000, 2000, 5000, 10000, 20000, 50000) then
    raise exception 'bad_stake' using errcode = '22023';
  end if;
  if public._points_balance(r.family_id, auth.uid()) < p_stake then
    raise exception 'insufficient_points' using errcode = 'P0001';
  end if;
  begin
    insert into public.loto_cards (room_id, family_id, user_id, card_no, grid, board_code, stake_points)
    values (p_room, r.family_id, auth.uid(), 1, b.grid, b.code, p_stake);
  exception when unique_violation then
    raise exception 'board_taken' using errcode = 'P0001';
  end;
  perform public._points_add(r.family_id, auth.uid(), -p_stake, 'loto_stake', p_room::text);
end $$;

drop function if exists public.loto_join(uuid, int, text);
create or replace function public.loto_join(p_room uuid, p_cards int, p_room_code text default null, p_stake int default null) returns int
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; i int;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(r.family_id);
  if p_cards is null or p_cards < 1 or p_cards > 3 then raise exception 'cards must be 1..3' using errcode = '22023'; end if;
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  perform public._loto_require_join(r, p_room_code);
  if exists (select 1 from public.loto_cards c where c.room_id = p_room and c.user_id = auth.uid()) then
    raise exception 'already_joined' using errcode = 'P0001';
  end if;
  if p_stake is null or p_stake not in (1000, 2000, 5000, 10000, 20000, 50000) then
    raise exception 'bad_stake' using errcode = '22023';
  end if;
  if public._points_balance(r.family_id, auth.uid()) < p_stake then
    raise exception 'insufficient_points' using errcode = 'P0001';
  end if;
  for i in 1..p_cards loop
    insert into public.loto_cards (room_id, family_id, user_id, card_no, grid, stake_points)
    values (p_room, r.family_id, auth.uid(), i, public._loto_generate_card(), case when i = 1 then p_stake else 0 end);
  end loop;
  perform public._points_add(r.family_id, auth.uid(), -p_stake, 'loto_stake', p_room::text);
  return p_cards;
end $$;

-- Doi bang (bo bang cu) -> hoan lai cuoc cua bang do
create or replace function public.loto_release_board(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; v_stake int;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(r.family_id);
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  if not r.allow_board_change then raise exception 'change_not_allowed' using errcode = 'P0001'; end if;
  select stake_points into v_stake from public.loto_cards
   where room_id = p_room and user_id = auth.uid() and board_code is not null;
  delete from public.loto_cards where room_id = p_room and user_id = auth.uid() and board_code is not null;
  if coalesce(v_stake, 0) > 0 then
    perform public._points_add(r.family_id, auth.uid(), v_stake, 'loto_refund', p_room::text);
  end if;
end $$;

-- Bot cuoc ao 1.000 (khong qua vi)
create or replace function public.loto_add_bots(p_room uuid, p_count int) returns int
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; v_added int := 0; i int; b record; v_existing int; v_want int;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  if p_count is null or p_count < 1 or p_count > 10 then raise exception 'bad_bot_count' using errcode = '22023'; end if;
  select count(*) into v_existing from public.loto_cards c where c.room_id = p_room and c.bot_name is not null;
  if v_existing >= 20 then raise exception 'too_many_bots' using errcode = 'P0001'; end if;
  v_want := least(p_count, 20 - v_existing);
  if r.mode = 'province' then
    for b in select bd.code, bd.grid from public.loto_boards bd
              where not exists (select 1 from public.loto_cards c where c.room_id = p_room and c.board_code = bd.code)
              order by random() limit v_want
    loop
      insert into public.loto_cards (room_id, family_id, user_id, card_no, grid, board_code, bot_name, stake_points)
      values (p_room, r.family_id, null, 1, b.grid, b.code, public._loto_bot_name(p_room), 1000);
      v_added := v_added + 1;
    end loop;
  else
    for i in 1..v_want loop
      insert into public.loto_cards (room_id, family_id, user_id, card_no, grid, bot_name, stake_points)
      values (p_room, r.family_id, null, 1, public._loto_generate_card(), public._loto_bot_name(p_room), 1000);
      v_added := v_added + 1;
    end loop;
  end if;
  if v_added > 0 then
    perform public.write_audit(r.family_id, 'loto.add_bots', 'loto_room', p_room::text, null,
      jsonb_build_object('added', v_added));
  end if;
  return v_added;
end $$;

-- ---------- 5. Giai = giai chu phong + tong cuoc; ket thuc khong nguoi thang -> hoan cuoc ----------
create or replace function public._loto_finish(p_room uuid, p_first_user uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.loto_rooms; v_count int; v_share int; v_rem int; v_idx int := 0; v_get int; w record;
  v_pot int; v_total int;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found or r.status not in ('playing', 'paused') then return 0; end if;
  select count(*) into v_count from public.loto_cards c
   where c.room_id = p_room and public._loto_complete_rows(p_room, c.grid) >= r.win_rows;
  if v_count = 0 then return 0; end if;
  v_pot := public._loto_pot(p_room);
  v_total := r.prize_points + v_pot;
  v_share := case when v_total > 0 then v_total / v_count else 0 end;
  v_rem := case when v_total > 0 then v_total % v_count else 0 end;
  for w in
    select c.id as card_id, c.user_id, c.bot_name, c.board_code from public.loto_cards c
     where c.room_id = p_room and public._loto_complete_rows(p_room, c.grid) >= r.win_rows
     order by (c.user_id is not null and c.user_id = p_first_user) desc, c.created_at asc
  loop
    v_idx := v_idx + 1;
    v_get := v_share + case when v_idx <= v_rem then 1 else 0 end;
    insert into public.loto_winners (room_id, family_id, user_id, bot_name, card_id, board_code, seq, share_points)
    values (p_room, r.family_id, w.user_id, w.bot_name, w.card_id, w.board_code, r.called_count, v_get);
    if v_get > 0 and w.user_id is not null then
      perform public._points_add(r.family_id, w.user_id, v_get, 'loto_prize', p_room::text);
    end if;
    if v_idx = 1 then
      update public.loto_rooms set winner_user = w.user_id, winner_card = w.card_id where id = p_room;
    end if;
  end loop;
  update public.loto_rooms set status = 'finished', finished_at = now() where id = p_room;
  perform public._seed_reveal('loto', p_room);
  perform public.write_audit(r.family_id, 'loto.finish_winners', 'loto_room', p_room::text, null,
    jsonb_build_object('winners', v_count, 'prize', r.prize_points, 'pot', v_pot, 'called', r.called_count, 'win_rows', r.win_rows));
  return v_count;
end $$;

create or replace function public.loto_end(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; c record;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status not in ('waiting', 'playing', 'paused') then raise exception 'already_finished' using errcode = 'P0001'; end if;
  -- Ket thuc giua chung = huy van: hoan cuoc cho moi nguoi choi that
  for c in select user_id, stake_points from public.loto_cards
            where room_id = p_room and card_no = 1 and stake_points > 0 and user_id is not null
  loop
    perform public._points_add(r.family_id, c.user_id, c.stake_points, 'loto_refund', p_room::text);
  end loop;
  update public.loto_rooms set status = case when r.status = 'waiting' then 'cancelled' else 'finished' end,
    finished_at = now() where id = p_room;
  perform public._seed_reveal('loto', p_room);
  perform public.write_audit(r.family_id, 'loto.end', 'loto_room', p_room::text,
    jsonb_build_object('status', r.status), jsonb_build_object('status', case when r.status = 'waiting' then 'cancelled' else 'finished' end));
end $$;

grant execute on function
  public.loto_claim_board(uuid, text, text, int),
  public.loto_join(uuid, int, text, int)
  to authenticated;

-- ---------- 6. TV: them tong cuoc (pot) vao trang thai phong lo to ----------
create or replace function public.games_tv_state(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  lr public.loto_rooms; ld public.lottery_draws; br public.bc_rooms; rd public.bc_rounds; last_rd public.bc_rounds;
  v_fam uuid; v jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  select * into lr from public.loto_rooms where id = p_id;
  if found then
    if not public.games_can_read(lr.family_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    return jsonb_build_object(
      'kind', 'loto', 'id', lr.id, 'title', lr.title, 'code', lr.code, 'status', lr.status, 'prize_points', lr.prize_points,
      'pot', public._loto_pot(lr.id),
      'commit', lr.commit_hash, 'called_count', lr.called_count,
      'called', coalesce((select jsonb_agg(c.number order by c.seq) from public.loto_calls c where c.room_id = lr.id), '[]'::jsonb),
      'last', (select c.number from public.loto_calls c where c.room_id = lr.id order by c.seq desc limit 1),
      'players', (select count(*) from public.loto_cards k where k.room_id = lr.id),
      'winner', case when lr.winner_card is null then null else jsonb_build_object(
          'name', coalesce((select k.bot_name from public.loto_cards k where k.id = lr.winner_card),
                           (select coalesce(nullif(p.alias_name, ''), p.display_name) from public.user_profiles p where p.id = lr.winner_user)),
          'grid', (select k.grid from public.loto_cards k where k.id = lr.winner_card)) end,
      'winners', coalesce((select jsonb_agg(jsonb_build_object(
          'name', coalesce(w.bot_name, coalesce(nullif(p.alias_name, ''), p.display_name)),
          'province', b.province_name, 'share', w.share_points) order by w.share_points desc, w.created_at)
        from public.loto_winners w
        left join public.user_profiles p on p.id = w.user_id
        left join public.loto_boards b on b.code = w.board_code
        where w.room_id = lr.id), '[]'::jsonb),
      'seed', case when lr.status in ('finished', 'cancelled') then public._seed_get('loto', lr.id) end,
      'top', public._games_top(lr.family_id, 8));
  end if;

  select * into ld from public.lottery_draws where id = p_id;
  if found then
    if not public.games_can_read(ld.family_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    return jsonb_build_object(
      'kind', 'lottery', 'id', ld.id, 'title', ld.title, 'status', ld.status, 'draw_at', ld.draw_at,
      'ticket_price', ld.ticket_price, 'free_tickets', ld.free_tickets, 'max_tickets', ld.max_tickets,
      'ticket_count', ld.ticket_count, 'commit', ld.commit_hash,
      'prizes', coalesce((select jsonb_agg(jsonb_build_object('rank', z.rank, 'kind', z.kind, 'label', z.label, 'points', z.points) order by z.rank)
                          from public.lottery_prizes z where z.draw_id = ld.id), '[]'::jsonb),
      'results', coalesce((select jsonb_agg(jsonb_build_object('rank', x.rank, 'label', x.label, 'ticket_no', x.ticket_no,
                                'name', (select p.display_name from public.user_profiles p where p.id = x.user_id), 'points', x.points_awarded) order by x.rank)
                           from public.lottery_results x where x.draw_id = ld.id), '[]'::jsonb),
      'seed', case when ld.status in ('drawn', 'cancelled') then public._seed_get('lottery', ld.id) end,
      'tickets', case when ld.status = 'drawn' then coalesce((
          select jsonb_agg(jsonb_build_object('no', t.ticket_no, 'owner', t.user_id::text,
                  'name', (select p.display_name from public.user_profiles p where p.id = t.user_id)) order by t.ticket_no)
          from public.lottery_tickets t where t.draw_id = ld.id), '[]'::jsonb) else null end,
      'top', public._games_top(ld.family_id, 8));
  end if;

  select * into br from public.bc_rooms where id = p_id;
  if found then
    if not public.games_can_read(br.family_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    select * into rd from public.bc_rounds where room_id = br.id order by round_no desc limit 1;
    select * into last_rd from public.bc_rounds where room_id = br.id and status = 'rolled' order by round_no desc limit 1;
    return jsonb_build_object(
      'kind', 'baucua', 'id', br.id, 'title', br.title, 'status', br.status,
      'round', case when rd.id is null then null else jsonb_build_object(
          'id', rd.id, 'no', rd.round_no, 'status', rd.status, 'closes_at', rd.betting_closes_at, 'dice', rd.dice) end,
      'totals', case when rd.id is null then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object('symbol', s.symbol, 'amount', s.amt) order by s.symbol)
          from (select b.symbol, sum(b.amount)::int as amt from public.bc_bets b where b.round_id = rd.id group by b.symbol) s), '[]'::jsonb) end,
      'players', case when rd.id is null then 0 else (select count(distinct b.user_id) from public.bc_bets b where b.round_id = rd.id) end,
      'last', case when last_rd.id is null then null else jsonb_build_object(
          'no', last_rd.round_no, 'dice', last_rd.dice,
          'results', coalesce((
            select jsonb_agg(jsonb_build_object('name', (select p.display_name from public.user_profiles p where p.id = u.user_id),
                                                'net', u.pay - u.bet) order by u.pay - u.bet desc)
            from (select b.user_id, sum(b.amount) as bet, sum(coalesce(b.payout, 0)) as pay
                  from public.bc_bets b where b.round_id = last_rd.id group by b.user_id) u), '[]'::jsonb)) end,
      'top', public._games_top(br.family_id, 8));
  end if;

  raise exception 'not_found' using errcode = 'P0002';
end $$;
