-- Module G / Bot choi lo to nhu nguoi that:
-- Chu phong them bot vao phong dang cho (moi bot chon 1 bang tinh con trong, hoac 1 to ngau nhien o phong co dien).
-- Bot khong co tai khoan/vi tien: to cua bot la dong loto_cards co user_id NULL + bot_name; may chu do so tu dong nhu nguoi,
-- va _loto_finish tinh bot vao danh sach nguoi thang (phan giai cua bot khong cong vao vi cua ai).

-- ---------- 1. Cho phep to/nguoi thang la BOT ----------
alter table public.loto_cards alter column user_id drop not null;
alter table public.loto_cards add column if not exists bot_name text
  check (bot_name is null or char_length(bot_name) between 1 and 40);
alter table public.loto_cards add constraint loto_cards_owner_check
  check ((user_id is not null) <> (bot_name is not null));

alter table public.loto_winners alter column user_id drop not null;
alter table public.loto_winners add column if not exists bot_name text
  check (bot_name is null or char_length(bot_name) between 1 and 40);
alter table public.loto_winners add constraint loto_winners_owner_check
  check ((user_id is not null) <> (bot_name is not null));

-- Danh sach bang trong phong: them ten bot + id to (cot moi phai o cuoi khi replace view)
create or replace view public.loto_room_cards_v as
select c.room_id, c.family_id, c.board_code, c.user_id, c.card_no, c.bot_name, c.id as card_id
from public.loto_cards c
where public.games_can_read(c.family_id);
grant select on public.loto_room_cards_v to authenticated;

-- ---------- 2. Ket thuc van: tinh ca bot thang (bo qua cong tien cho bot) ----------
create or replace function public._loto_finish(p_room uuid, p_first_user uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.loto_rooms; v_count int; v_share int; v_rem int; v_idx int := 0; v_get int; w record;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found or r.status not in ('playing', 'paused') then return 0; end if;
  select count(*) into v_count from public.loto_cards c
   where c.room_id = p_room and public._loto_complete_rows(p_room, c.grid) >= r.win_rows;
  if v_count = 0 then return 0; end if;
  v_share := case when r.prize_points > 0 then r.prize_points / v_count else 0 end;
  v_rem := case when r.prize_points > 0 then r.prize_points % v_count else 0 end;
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
    jsonb_build_object('winners', v_count, 'prize', r.prize_points, 'called', r.called_count, 'win_rows', r.win_rows));
  return v_count;
end $$;

-- ---------- 3. TV: dem ca bot la nguoi choi, nguoi thang co the la bot ----------
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

-- ---------- 4. Them / xoa bot ----------
create or replace function public._loto_bot_name(p_room uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  pool text[] := array['Bé Na','Cụ Bảy','Chị Tư','Anh Sáu','Bé Bột','Cô Tám','Chú Chín','Bé Mít','Cậu Út','Bà Năm',
                       'Anh Hai','Chị Bảy','Bé Xoài','Ông Sáu','Cô Ba','Bé Cam','Chú Tư','Bà Tám','Anh Út','Bé Dừa'];
  v_name text; v_try int := 0; v_suffix int;
begin
  loop
    v_try := v_try + 1;
    v_name := pool[public._rand_below(array_length(pool, 1)) + 1];
    if not exists (select 1 from public.loto_cards c where c.room_id = p_room and c.bot_name = v_name) then
      return v_name;
    end if;
    exit when v_try > 12;
  end loop;
  v_suffix := 2;
  loop
    v_name := pool[public._rand_below(array_length(pool, 1)) + 1] || ' ' || v_suffix;
    exit when not exists (select 1 from public.loto_cards c where c.room_id = p_room and c.bot_name = v_name);
    v_suffix := v_suffix + 1;
  end loop;
  return v_name;
end $$;

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
      insert into public.loto_cards (room_id, family_id, user_id, card_no, grid, board_code, bot_name)
      values (p_room, r.family_id, null, 1, b.grid, b.code, public._loto_bot_name(p_room));
      v_added := v_added + 1;
    end loop;
  else
    for i in 1..v_want loop
      insert into public.loto_cards (room_id, family_id, user_id, card_no, grid, bot_name)
      values (p_room, r.family_id, null, 1, public._loto_generate_card(), public._loto_bot_name(p_room));
      v_added := v_added + 1;
    end loop;
  end if;
  if v_added > 0 then
    perform public.write_audit(r.family_id, 'loto.add_bots', 'loto_room', p_room::text, null,
      jsonb_build_object('added', v_added));
  end if;
  return v_added;
end $$;

create or replace function public.loto_remove_bot(p_room uuid, p_card uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  delete from public.loto_cards where id = p_card and room_id = p_room and bot_name is not null;
  if not found then raise exception 'not_a_bot' using errcode = 'P0001'; end if;
end $$;

grant execute on function public.loto_add_bots(uuid, int), public.loto_remove_bot(uuid, uuid) to authenticated;
