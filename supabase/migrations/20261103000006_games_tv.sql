-- Module G / migration 6: trang thai cho che do trinh chieu TV (/tro-choi/tv/[roomId]) va lam moi nhe (polling)
-- Mot ham duy nhat tra ve jsonb da che thong tin nhay cam (khong lo seed truoc khi quay, khong lo to cua nguoi khac).

create or replace function public._games_top(p_family uuid, p_n int) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when coalesce((select s.leaderboard_enabled from public.game_settings s where s.family_id = p_family), false)
    then coalesce((
      select jsonb_agg(jsonb_build_object('name', x.display_name, 'balance', x.balance_after, 'rank', x.rnk) order by x.rnk, x.display_name)
      from (select p.display_name, b.balance_after, rank() over (order by b.balance_after desc) as rnk
            from (select distinct on (l.user_id) l.user_id, l.balance_after
                  from public.points_ledger l where l.family_id = p_family order by l.user_id, l.id desc) b
            join public.user_profiles p on p.id = b.user_id
            join public.family_memberships m on m.user_id = b.user_id and m.family_id = p_family and m.status = 'active'
            order by b.balance_after desc, p.display_name limit p_n) x), '[]'::jsonb)
    else null end;
$$;

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
      'players', (select count(distinct k.user_id) from public.loto_cards k where k.room_id = lr.id),
      'winner', case when lr.winner_user is null then null else jsonb_build_object(
          'name', (select p.display_name from public.user_profiles p where p.id = lr.winner_user),
          'grid', (select k.grid from public.loto_cards k where k.id = lr.winner_card)) end,
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

grant execute on function public.games_tv_state(uuid) to authenticated;
