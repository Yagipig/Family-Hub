-- Module G / migration 4: Lo to (bingo kieu Viet Nam) - diem ao
-- Quan tri la nguoi ho so. Phong co ma 6 ky tu. Moi nguoi nhan 1-3 to (9 cot x 3 hang, 5 so/hang), sinh o MAY CHU.
-- Thu tu ho so = hoan vi 1..90 xac dinh tu seed commit-reveal (cam ket cong bo khi tao phong, seed tiet lo khi ket thuc).
-- "Kinh" do MAY CHU xac nhan bang cac so da ho trong CSDL; dau danh dau o client chi la tien ich hien thi.

-- Luat to lo to (khop src/lib/games/loto.ts): grid = 27 so theo hang (hang*9 + cot + 1), 0 = o trong.
-- Moi hang dung 5 so; so thuoc dai cua cot (cot1 1-9, cot2 10-19, ..., cot9 80-90); moi cot toi da 3 so, tang nghiem ngat tu tren xuong.
create or replace function public.loto_card_is_valid(g smallint[]) returns boolean
language plpgsql immutable set search_path = public as $$
declare r int; c int; v int; cnt int; lo int; hi int; prev int;
begin
  if g is null or array_ndims(g) is distinct from 1 or array_length(g, 1) <> 27 then return false; end if;
  for r in 0..2 loop
    cnt := 0;
    for c in 0..8 loop
      v := g[r * 9 + c + 1];
      if v is null then return false; end if;
      if v <> 0 then
        lo := case c when 0 then 1 when 8 then 80 else c * 10 end;
        hi := case c when 0 then 9 when 8 then 90 else c * 10 + 9 end;
        if v < lo or v > hi then return false; end if;
        cnt := cnt + 1;
      end if;
    end loop;
    if cnt <> 5 then return false; end if;
  end loop;
  for c in 0..8 loop
    prev := 0;
    for r in 0..2 loop
      v := g[r * 9 + c + 1];
      if v <> 0 then
        if v <= prev then return false; end if;
        prev := v;
      end if;
    end loop;
  end loop;
  return true;
end $$;

-- Sinh to hop le bang nguon ngau nhien an toan; moi cot co it nhat 1 so
create or replace function public._loto_generate_card() returns smallint[]
language plpgsql volatile set search_path = public as $$
declare
  has boolean[]; colcnt int[]; cols int[]; row_has boolean[]; r int; c int; k int; j int; t int;
  lo int; hi int; pool int[]; picked int[]; p int; card smallint[]; ok boolean;
begin
  loop
    has := array_fill(false, array[27]);
    colcnt := array_fill(0, array[9]);
    for r in 0..2 loop
      cols := array[0,1,2,3,4,5,6,7,8];
      for k in 0..4 loop
        j := k + public._rand_below(9 - k);
        t := cols[k + 1]; cols[k + 1] := cols[j + 1]; cols[j + 1] := t;
      end loop;
      for k in 0..4 loop
        has[r * 9 + cols[k + 1] + 1] := true;
        colcnt[cols[k + 1] + 1] := colcnt[cols[k + 1] + 1] + 1;
      end loop;
    end loop;
    ok := true;
    for c in 0..8 loop if colcnt[c + 1] = 0 then ok := false; end if; end loop;
    continue when not ok;
    card := array_fill(0::smallint, array[27]);
    for c in 0..8 loop
      lo := case c when 0 then 1 when 8 then 80 else c * 10 end;
      hi := case c when 0 then 9 when 8 then 90 else c * 10 + 9 end;
      pool := array(select x from generate_series(lo, hi) x order by x);
      picked := '{}';
      for k in 0..colcnt[c + 1] - 1 loop
        j := k + public._rand_below(array_length(pool, 1) - k);
        t := pool[k + 1]; pool[k + 1] := pool[j + 1]; pool[j + 1] := t;
        picked := picked || pool[k + 1];
      end loop;
      picked := array(select x from unnest(picked) x order by x);
      p := 1;
      for r in 0..2 loop
        if has[r * 9 + c + 1] then card[r * 9 + c + 1] := picked[p]; p := p + 1; end if;
      end loop;
    end loop;
    return card;
  end loop;
end $$;

create table public.loto_rooms (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished', 'cancelled')),
  prize_points int not null default 50 check (prize_points between 0 and 500),
  commit_hash text not null check (commit_hash ~ '^[0-9a-f]{64}$'),
  called_count smallint not null default 0 check (called_count between 0 and 90),
  winner_user uuid references auth.users(id) on delete set null,
  winner_card uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (family_id, code)
);
create index loto_rooms_family_idx on public.loto_rooms (family_id, created_at desc);

create table public.loto_calls (
  room_id uuid not null references public.loto_rooms(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  seq smallint not null check (seq between 1 and 90),
  number smallint not null check (number between 1 and 90),
  created_at timestamptz not null default now(),
  primary key (room_id, seq),
  unique (room_id, number)
);

create table public.loto_cards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.loto_rooms(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_no smallint not null check (card_no between 1 and 3),
  grid smallint[] not null check (public.loto_card_is_valid(grid)),
  created_at timestamptz not null default now(),
  unique (room_id, user_id, card_no)
);
create index loto_cards_room_idx on public.loto_cards (room_id);
alter table public.loto_rooms add constraint loto_rooms_winner_card_fk
  foreign key (winner_card) references public.loto_cards(id) on delete set null;

create table public.loto_claims (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.loto_rooms(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.loto_cards(id) on delete cascade,
  valid boolean not null,
  called_count smallint not null,
  created_at timestamptz not null default now()
);
create index loto_claims_room_idx on public.loto_claims (room_id, user_id);

create or replace function public.loto_create_room(p_family uuid, p_title text, p_prize int default 50) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := gen_random_uuid(); v_code text; v_commit text; i int; u record;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  perform public._games_require_admin(p_family);
  if p_prize is null or p_prize < 0 or p_prize > 500 then raise exception 'prize out of range' using errcode = '22023'; end if;
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(alphabet, public._rand_below(32) + 1, 1); end loop;
    exit when not exists (select 1 from public.loto_rooms r where r.family_id = p_family and r.code = v_code);
  end loop;
  v_commit := public._seed_new('loto', v_id, p_family);
  insert into public.loto_rooms (id, family_id, code, title, prize_points, commit_hash, created_by)
  values (v_id, p_family, v_code, btrim(p_title), p_prize, v_commit, auth.uid());
  perform public.write_audit(p_family, 'loto.create_room', 'loto_room', v_id::text, null,
    jsonb_build_object('title', btrim(p_title), 'code', v_code, 'prize', p_prize, 'commit', v_commit));
  if public._games_enabled(p_family) then
    for u in select m.user_id from public.family_memberships m
             where m.family_id = p_family and m.status = 'active'
               and public._user_has_permission(m.user_id, p_family, 'games', 'view')
    loop
      perform public._notify(p_family, u.user_id, 'system', 'Phòng lô tô mới: ' || btrim(p_title),
        'Mã phòng ' || v_code, '/tro-choi/lo-to/' || v_id::text, 'loto-room:' || v_id::text || ':' || u.user_id::text);
    end loop;
  end if;
  return v_id;
end $$;

-- Vao phong (khi phong con "cho"): nhan p_cards to (1-3). Moi nguoi chi vao mot lan.
create or replace function public.loto_join(p_room uuid, p_cards int) returns int
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; i int;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(r.family_id);
  if p_cards is null or p_cards < 1 or p_cards > 3 then raise exception 'cards must be 1..3' using errcode = '22023'; end if;
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  if exists (select 1 from public.loto_cards c where c.room_id = p_room and c.user_id = auth.uid()) then
    raise exception 'already_joined' using errcode = 'P0001';
  end if;
  for i in 1..p_cards loop
    insert into public.loto_cards (room_id, family_id, user_id, card_no, grid)
    values (p_room, r.family_id, auth.uid(), i, public._loto_generate_card());
  end loop;
  return p_cards;
end $$;

-- Tim phong theo ma (trong gia dinh cua nguoi goi); tra ve id phong
create or replace function public.loto_find_room(p_family uuid, p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform public._games_require_play(p_family);
  select r.id into v from public.loto_rooms r
    where r.family_id = p_family and r.code = upper(btrim(p_code)) and r.status in ('waiting', 'playing');
  return v;
end $$;

create or replace function public.loto_start(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_admin(r.family_id);
  if not public._games_enabled(r.family_id) then raise exception 'games_disabled' using errcode = 'P0001'; end if;
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.loto_cards c where c.room_id = p_room) then
    raise exception 'no_players' using errcode = 'P0001';
  end if;
  update public.loto_rooms set status = 'playing', started_at = now() where id = p_room;
  perform public.write_audit(r.family_id, 'loto.start', 'loto_room', p_room::text,
    jsonb_build_object('status', r.status), jsonb_build_object('status', 'playing'));
end $$;

-- Ho so tiep theo: lay so thu (called_count + 1) cua hoan vi tu seed. Quan tri moi goi duoc.
create or replace function public.loto_call_next(p_room uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; v_seed text; v_num int;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_admin(r.family_id);
  if not public._games_enabled(r.family_id) then raise exception 'games_disabled' using errcode = 'P0001'; end if;
  if r.status <> 'playing' then raise exception 'not_playing' using errcode = 'P0001'; end if;
  if r.called_count >= 90 then raise exception 'all_called' using errcode = 'P0001'; end if;
  v_seed := public._seed_get('loto', p_room);
  v_num := (public.fair_shuffle(v_seed, 90))[r.called_count + 1];
  insert into public.loto_calls (room_id, family_id, seq, number) values (p_room, r.family_id, r.called_count + 1, v_num);
  update public.loto_rooms set called_count = called_count + 1 where id = p_room;
  return v_num;
end $$;

-- Ket thuc ma khong co nguoi kinh (hoac huy phong chua bat dau): tiet lo seed
create or replace function public.loto_end(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_admin(r.family_id);
  if r.status not in ('waiting', 'playing') then raise exception 'already_finished' using errcode = 'P0001'; end if;
  update public.loto_rooms set status = case when r.status = 'waiting' then 'cancelled' else 'finished' end,
    finished_at = now() where id = p_room;
  perform public._seed_reveal('loto', p_room);
  perform public.write_audit(r.family_id, 'loto.end', 'loto_room', p_room::text,
    jsonb_build_object('status', r.status), jsonb_build_object('status', case when r.status = 'waiting' then 'cancelled' else 'finished' end));
end $$;

-- "Kinh!": MAY CHU kiem tra mot hang cua to da du 5 so da ho chua. Kinh gia khong thang (ghi lai, toi da 3 lan/phong).
create or replace function public.loto_claim_kinh(p_room uuid, p_card uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; c public.loto_cards; v_row int; v_ok boolean := false; v_bad int; k int; v_win boolean;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(r.family_id);
  if r.status <> 'playing' then raise exception 'not_playing' using errcode = 'P0001'; end if;
  select * into c from public.loto_cards where id = p_card and room_id = p_room and user_id = auth.uid();
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  select count(*) into v_bad from public.loto_claims x where x.room_id = p_room and x.user_id = auth.uid() and not x.valid;
  if v_bad >= 3 then raise exception 'too_many_false_claims' using errcode = 'P0001'; end if;
  for v_row in 0..2 loop
    v_win := true;
    for k in 1..9 loop
      if c.grid[v_row * 9 + k] <> 0
         and not exists (select 1 from public.loto_calls l where l.room_id = p_room and l.number = c.grid[v_row * 9 + k]) then
        v_win := false;
      end if;
    end loop;
    if v_win then v_ok := true; end if;
  end loop;
  insert into public.loto_claims (room_id, family_id, user_id, card_id, valid, called_count)
  values (p_room, r.family_id, auth.uid(), p_card, v_ok, r.called_count);
  if not v_ok then
    return jsonb_build_object('ok', false, 'reason', 'not_complete', 'false_claims', v_bad + 1);
  end if;
  update public.loto_rooms set status = 'finished', finished_at = now(), winner_user = auth.uid(), winner_card = p_card
    where id = p_room;
  if r.prize_points > 0 then
    perform public._points_add(r.family_id, auth.uid(), r.prize_points, 'loto_prize', p_room::text);
  end if;
  perform public._seed_reveal('loto', p_room);
  perform public.write_audit(r.family_id, 'loto.kinh', 'loto_room', p_room::text, null,
    jsonb_build_object('winner', auth.uid(), 'card', p_card, 'called', r.called_count, 'prize', r.prize_points));
  return jsonb_build_object('ok', true, 'points', r.prize_points);
end $$;

alter table public.loto_rooms enable row level security;
alter table public.loto_calls enable row level security;
alter table public.loto_cards enable row level security;
alter table public.loto_claims enable row level security;
create policy loto_rooms_select on public.loto_rooms for select to authenticated
  using (public.games_can_read(family_id));
create policy loto_calls_select on public.loto_calls for select to authenticated
  using (public.games_can_read(family_id));
-- To cua minh; to thang cuoc thi ca nha cung xem
create policy loto_cards_select on public.loto_cards for select to authenticated
  using (public.games_can_read(family_id)
         and (user_id = auth.uid()
              or exists (select 1 from public.loto_rooms r where r.id = loto_cards.room_id and r.winner_card = loto_cards.id)));
create policy loto_claims_select_own on public.loto_claims for select to authenticated
  using (user_id = auth.uid() and public.games_can_read(family_id));

revoke all on public.loto_rooms, public.loto_calls, public.loto_cards, public.loto_claims from anon, authenticated;
grant select on public.loto_rooms, public.loto_calls, public.loto_cards, public.loto_claims to authenticated;

grant execute on function
  public.loto_card_is_valid(smallint[]),
  public.loto_create_room(uuid, text, int), public.loto_join(uuid, int), public.loto_find_room(uuid, text),
  public.loto_start(uuid), public.loto_call_next(uuid), public.loto_end(uuid), public.loto_claim_kinh(uuid, uuid)
  to authenticated;
