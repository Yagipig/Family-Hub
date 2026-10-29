-- Module G / Bo sung cach vao phong lo to (nguoi dung chot CACH 2 ngay 29/10/2026):
-- Ma phong thanh CONG THAT o may chu: chu phong + quan tri tro choi + nguoi DUOC MOI vao thang;
-- nguoi khac muon THAM GIA (chon bang tinh / nhan to co dien) phai nhap dung ma phong.
-- Chu phong co the TAT ma (code_required = false) -> ai trong gia dinh cung tham gia duoc.
-- Xem phong (danh sach, bang so, TV) khong doi: van chi thanh vien gia dinh co quyen games view moi xem duoc.

-- ---------- 1. Cot code_required + bang loi moi ----------
alter table public.loto_rooms add column if not exists code_required boolean not null default true;

create table public.loto_invites (
  room_id uuid not null references public.loto_rooms(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.loto_invites enable row level security;
create policy loto_invites_select on public.loto_invites for select to authenticated
  using (public.games_can_read(family_id));
revoke all on public.loto_invites from anon, authenticated;
grant select on public.loto_invites to authenticated;

-- ---------- 2. Ham cong: duoc tham gia khong (kem ma nguoi choi nhap, neu co) ----------
create or replace function public._loto_can_join(r public.loto_rooms, p_room_code text) returns boolean
language sql stable set search_path = public as $$
  select not r.code_required
      or public._loto_is_host(r)
      or exists (select 1 from public.loto_invites i where i.room_id = r.id and i.user_id = auth.uid())
      or (p_room_code is not null and upper(btrim(p_room_code)) = r.code);
$$;

create or replace function public._loto_require_join(r public.loto_rooms, p_room_code text) returns void
language plpgsql stable set search_path = public as $$
begin
  if public._loto_can_join(r, p_room_code) then return; end if;
  if p_room_code is null or btrim(p_room_code) = '' then
    raise exception 'room_code_required' using errcode = 'P0001';
  end if;
  raise exception 'room_code_wrong' using errcode = 'P0001';
end $$;

-- Kiem tra ma phong (trang phong dung de mo khoa form chon bang sau khi nhap ma dung)
create or replace function public.loto_check_code(p_room uuid, p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(r.family_id);
  return public._loto_can_join(r, p_code);
end $$;

-- ---------- 3. Moi / bo moi (chi chu phong, khi phong dang cho) ----------
create or replace function public.loto_invite(p_room uuid, p_users uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; v_user uuid; v_count int := 0;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  if p_users is null or array_length(p_users, 1) is null or array_length(p_users, 1) > 50 then
    raise exception 'bad_invite_list' using errcode = '22023';
  end if;
  foreach v_user in array p_users loop
    if v_user = coalesce(r.host_user, r.created_by) then continue; end if;
    if not exists (select 1 from public.family_memberships m
                    where m.family_id = r.family_id and m.user_id = v_user and m.status = 'active') then
      raise exception 'not_member' using errcode = '22023';
    end if;
    insert into public.loto_invites (room_id, family_id, user_id, invited_by)
    values (p_room, r.family_id, v_user, auth.uid())
    on conflict (room_id, user_id) do nothing;
    if found then
      v_count := v_count + 1;
      perform public._notify(r.family_id, v_user, 'system',
        'Bạn được mời chơi lô tô: ' || r.title,
        'Bấm để vào phòng chọn bảng ngay — bạn không cần nhập mã phòng.',
        '/tro-choi/lo-to/' || p_room::text, 'loto-invite:' || p_room::text || ':' || v_user::text);
    end if;
  end loop;
  if v_count > 0 then
    perform public.write_audit(r.family_id, 'loto.invite', 'loto_room', p_room::text, null,
      jsonb_build_object('invited', v_count));
  end if;
  return v_count;
end $$;

create or replace function public.loto_uninvite(p_room uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  delete from public.loto_invites where room_id = p_room and user_id = p_user;
end $$;

-- ---------- 4. Chu phong bat/tat yeu cau ma (khi phong dang cho) ----------
create or replace function public.loto_set_code_required(p_room uuid, p_required boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  update public.loto_rooms set code_required = coalesce(p_required, true) where id = p_room;
  perform public.write_audit(r.family_id, 'loto.set_code_required', 'loto_room', p_room::text,
    jsonb_build_object('code_required', r.code_required), jsonb_build_object('code_required', coalesce(p_required, true)));
end $$;

-- ---------- 5. Cong vao cac ham tham gia ----------
-- 5a. Chon bang tinh: them tham so ma phong (bo chu ky cu de tranh trung lap overload)
drop function if exists public.loto_claim_board(uuid, text);
create or replace function public.loto_claim_board(p_room uuid, p_code text, p_room_code text default null) returns void
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
  begin
    insert into public.loto_cards (room_id, family_id, user_id, card_no, grid, board_code)
    values (p_room, r.family_id, auth.uid(), 1, b.grid, b.code);
  exception when unique_violation then
    raise exception 'board_taken' using errcode = 'P0001';
  end;
end $$;

-- 5b. Tham gia phong co dien: them tham so ma phong
drop function if exists public.loto_join(uuid, int);
create or replace function public.loto_join(p_room uuid, p_cards int, p_room_code text default null) returns int
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
  for i in 1..p_cards loop
    insert into public.loto_cards (room_id, family_id, user_id, card_no, grid)
    values (p_room, r.family_id, auth.uid(), i, public._loto_generate_card());
  end loop;
  return p_cards;
end $$;

-- 5c. Tao phong truyen thong: them tuy chon yeu cau ma phong (mac dinh co)
drop function if exists public.loto_create_province_room(uuid, text, int, int, boolean, boolean);
create or replace function public.loto_create_province_room(
  p_family uuid, p_title text, p_prize int default 50,
  p_win_rows int default 1, p_auto_win boolean default true, p_allow_change boolean default false,
  p_code_required boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := gen_random_uuid(); v_code text; v_commit text; i int; u record;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  perform public._games_require_play(p_family);
  if not public._games_enabled(p_family) then raise exception 'games_disabled' using errcode = 'P0001'; end if;
  if p_prize is null or p_prize < 0 or p_prize > 500 then raise exception 'prize out of range' using errcode = '22023'; end if;
  if p_win_rows is null or p_win_rows < 1 or p_win_rows > 3 then raise exception 'win_rows out of range' using errcode = '22023'; end if;
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(alphabet, public._rand_below(32) + 1, 1); end loop;
    exit when not exists (select 1 from public.loto_rooms r where r.family_id = p_family and r.code = v_code);
  end loop;
  v_commit := public._seed_new('loto', v_id, p_family);
  insert into public.loto_rooms (id, family_id, code, title, prize_points, commit_hash, created_by, host_user, mode, win_rows, auto_win, allow_board_change, code_required)
  values (v_id, p_family, v_code, btrim(p_title), p_prize, v_commit, auth.uid(), auth.uid(), 'province',
          p_win_rows, coalesce(p_auto_win, true), coalesce(p_allow_change, false), coalesce(p_code_required, true));
  perform public.write_audit(p_family, 'loto.create_room', 'loto_room', v_id::text, null,
    jsonb_build_object('title', btrim(p_title), 'code', v_code, 'prize', p_prize, 'mode', 'province', 'win_rows', p_win_rows, 'code_required', coalesce(p_code_required, true)));
  for u in select m.user_id from public.family_memberships m
           where m.family_id = p_family and m.status = 'active' and m.user_id <> auth.uid()
             and public._user_has_permission(m.user_id, p_family, 'games', 'view')
  loop
    perform public._notify(p_family, u.user_id, 'system', 'Phòng lô tô truyền thống mới: ' || btrim(p_title),
      case when coalesce(p_code_required, true) then 'Phòng có mã: hỏi chủ phòng mã phòng, hoặc chờ chủ phòng mời bạn nhé!' else 'Vào chọn bảng tỉnh của bạn nhé!' end,
      '/tro-choi/lo-to/' || v_id::text, 'loto-room:' || v_id::text || ':' || u.user_id::text);
  end loop;
  return v_id;
end $$;

-- ---------- 6. Realtime + cap quyen ----------
do $$ begin alter publication supabase_realtime add table public.loto_invites; exception when duplicate_object then null; when undefined_object then null; end $$;

grant execute on function
  public.loto_check_code(uuid, text),
  public.loto_invite(uuid, uuid[]),
  public.loto_uninvite(uuid, uuid),
  public.loto_set_code_required(uuid, boolean),
  public.loto_claim_board(uuid, text, text),
  public.loto_join(uuid, int, text),
  public.loto_create_province_room(uuid, text, int, int, boolean, boolean, boolean)
  to authenticated;
