-- Module G / bo sung: Lo to TRUYEN THONG - 63 bang co dinh theo 63 tinh/thanh cu (truoc 2025),
-- chu phong = nguoi tao phong, tam dung/hoan tac/chuyen chu phong, luat thang 1-3 hang,
-- nhieu nguoi thang cung luot + chia deu giai, phat kinh gia (admin cau hinh), realtime cho phong.
-- Bang cua tinh duoc CHUP (snapshot) vao loto_cards khi nguoi choi chon -> admin sua bang chi anh huong van sau.

-- ---------- 1. Bang cau hinh 63 bang tinh + lich su ----------
create table public.loto_boards (
  code text primary key check (code ~ '^VN63-[0-9]{3}$'),
  province_name text not null check (char_length(province_name) between 1 and 80),
  region text not null check (region in ('bac', 'trung', 'nam')),
  grid smallint[] not null check (public.loto_card_is_valid(grid)),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.loto_board_history (
  id bigint generated always as identity primary key,
  code text not null references public.loto_boards(code) on delete cascade,
  grid smallint[] not null,
  replaced_by uuid references auth.users(id) on delete set null,
  replaced_at timestamptz not null default now()
);
alter table public.loto_boards enable row level security;
alter table public.loto_board_history enable row level security;
create policy loto_boards_select on public.loto_boards for select to authenticated
  using (exists (select 1 from public.family_memberships m where m.user_id = auth.uid() and m.status = 'active'));
revoke all on public.loto_boards, public.loto_board_history from anon, authenticated;
grant select on public.loto_boards to authenticated;

insert into public.loto_boards (code, province_name, region, grid) values
  ('VN63-001', 'Hà Nội', 'bac', array[7,14,27,0,0,0,60,0,81,9,16,0,0,40,56,64,0,0,0,0,28,35,48,58,0,77,0]::smallint[]),
  ('VN63-002', 'Hà Giang', 'bac', array[3,0,20,0,0,0,66,70,85,0,10,0,0,47,52,67,0,88,5,13,0,37,0,0,69,72,0]::smallint[]),
  ('VN63-003', 'Cao Bằng', 'bac', array[0,0,20,30,0,0,62,75,84,0,19,21,0,42,52,65,0,0,5,0,0,39,0,57,0,78,90]::smallint[]),
  ('VN63-004', 'Bắc Kạn', 'bac', array[2,14,0,0,41,52,0,71,0,0,0,23,31,0,54,66,0,84,8,0,0,38,43,58,0,0,85]::smallint[]),
  ('VN63-005', 'Tuyên Quang', 'bac', array[5,0,0,37,0,0,61,76,83,0,13,22,0,43,55,65,0,0,8,18,0,0,46,0,0,78,87]::smallint[]),
  ('VN63-006', 'Lào Cai', 'bac', array[0,0,23,0,46,50,0,73,83,9,0,24,0,0,55,65,0,89,0,13,0,37,0,57,67,76,0]::smallint[]),
  ('VN63-007', 'Điện Biên', 'bac', array[0,10,0,30,0,56,61,0,81,0,11,20,0,0,0,67,75,83,9,12,0,35,41,0,0,0,89]::smallint[]),
  ('VN63-008', 'Lai Châu', 'bac', array[0,12,0,36,41,0,61,0,83,9,14,24,0,42,0,63,0,0,0,0,27,0,49,55,0,78,89]::smallint[]),
  ('VN63-009', 'Sơn La', 'bac', array[0,0,23,32,40,52,0,76,0,1,0,0,33,0,0,61,79,82,4,19,26,34,0,0,69,0,0]::smallint[]),
  ('VN63-010', 'Yên Bái', 'bac', array[3,0,21,31,0,50,0,0,80,4,16,0,0,0,57,0,71,87,6,0,0,0,41,0,68,79,88]::smallint[]),
  ('VN63-011', 'Hoà Bình', 'bac', array[0,0,23,38,44,0,0,74,85,4,15,0,0,0,53,0,78,86,5,0,24,0,49,55,61,0,0]::smallint[]),
  ('VN63-012', 'Thái Nguyên', 'bac', array[3,14,23,0,0,0,66,73,0,6,17,29,0,44,0,0,77,0,0,0,0,33,0,53,67,79,90]::smallint[]),
  ('VN63-013', 'Lạng Sơn', 'bac', array[0,0,23,31,41,54,0,71,0,2,14,28,0,0,0,0,79,86,3,0,0,0,44,59,61,0,87]::smallint[]),
  ('VN63-014', 'Quảng Ninh', 'bac', array[1,16,0,33,0,54,0,73,0,9,18,20,0,44,0,66,0,0,0,0,0,0,46,59,69,76,82]::smallint[]),
  ('VN63-015', 'Bắc Giang', 'bac', array[0,17,0,0,40,51,63,0,80,6,18,0,0,44,59,65,0,0,0,0,28,30,49,0,66,73,0]::smallint[]),
  ('VN63-016', 'Phú Thọ', 'bac', array[1,0,0,32,0,51,63,71,0,4,0,0,0,47,52,66,0,84,5,16,26,0,0,57,69,0,0]::smallint[]),
  ('VN63-017', 'Vĩnh Phúc', 'bac', array[0,18,0,38,0,56,60,74,0,2,0,22,0,0,0,64,76,81,3,0,24,0,48,0,0,79,83]::smallint[]),
  ('VN63-018', 'Bắc Ninh', 'bac', array[3,14,27,30,43,0,0,0,0,0,19,0,31,44,0,61,76,0,0,0,0,35,49,51,68,0,89]::smallint[]),
  ('VN63-019', 'Hải Dương', 'bac', array[0,0,24,31,40,50,0,0,85,0,16,29,0,43,0,60,74,0,2,0,0,33,47,53,0,0,89]::smallint[]),
  ('VN63-020', 'Hải Phòng', 'bac', array[5,16,0,31,0,0,0,73,85,0,19,0,34,0,52,65,77,0,0,0,22,35,44,0,69,78,0]::smallint[]),
  ('VN63-021', 'Hưng Yên', 'bac', array[2,15,0,0,0,50,61,70,0,3,0,0,31,48,51,68,0,0,0,0,21,0,0,54,69,72,86]::smallint[]),
  ('VN63-022', 'Thái Bình', 'bac', array[2,18,0,0,44,0,62,0,83,3,0,0,0,0,53,66,76,88,9,0,29,37,0,56,0,0,89]::smallint[]),
  ('VN63-023', 'Hà Nam', 'bac', array[2,15,22,33,0,0,0,79,0,3,0,27,0,41,53,61,0,0,0,16,0,35,0,59,69,0,85]::smallint[]),
  ('VN63-024', 'Nam Định', 'bac', array[0,15,21,0,41,52,0,73,0,6,0,0,37,0,56,60,74,0,8,0,25,0,43,0,0,75,88]::smallint[]),
  ('VN63-025', 'Ninh Bình', 'bac', array[0,0,21,0,43,0,62,70,82,3,19,0,30,46,0,0,78,0,0,0,26,32,47,50,66,0,0]::smallint[]),
  ('VN63-026', 'Thanh Hóa', 'trung', array[9,10,0,38,41,52,0,0,0,0,11,20,0,0,53,0,77,81,0,17,21,0,43,54,69,0,0]::smallint[]),
  ('VN63-027', 'Nghệ An', 'trung', array[4,0,25,0,47,55,67,0,0,5,11,26,31,0,0,68,0,0,7,14,0,35,0,0,0,77,89]::smallint[]),
  ('VN63-028', 'Hà Tĩnh', 'trung', array[0,0,20,0,49,53,69,74,0,0,16,0,31,0,58,0,78,81,3,19,29,0,0,0,0,79,82]::smallint[]),
  ('VN63-029', 'Quảng Bình', 'trung', array[4,17,0,0,40,52,60,0,0,5,0,0,38,0,57,62,77,0,0,18,22,0,43,0,69,0,82]::smallint[]),
  ('VN63-030', 'Quảng Trị', 'trung', array[0,16,0,0,42,51,0,70,86,4,0,20,30,48,0,62,0,0,0,0,29,34,49,56,0,0,88]::smallint[]),
  ('VN63-031', 'Thừa Thiên Huế', 'trung', array[0,0,21,33,41,55,65,0,0,2,0,0,0,46,0,69,76,83,7,11,0,0,47,0,0,79,86]::smallint[]),
  ('VN63-032', 'Đà Nẵng', 'trung', array[0,15,22,0,0,0,64,73,85,0,17,0,33,0,54,65,76,0,8,19,27,0,46,55,0,0,0]::smallint[]),
  ('VN63-033', 'Quảng Nam', 'trung', array[3,18,0,30,49,0,0,72,0,8,0,22,31,0,0,60,0,85,9,0,24,39,0,57,0,79,0]::smallint[]),
  ('VN63-034', 'Quảng Ngãi', 'trung', array[0,16,21,36,0,50,0,0,82,2,0,0,37,41,0,68,0,88,0,0,26,0,49,0,69,78,89]::smallint[]),
  ('VN63-035', 'Bình Định', 'trung', array[3,0,21,32,0,0,0,77,80,0,0,22,34,43,53,0,0,86,0,16,29,39,0,0,68,0,87]::smallint[]),
  ('VN63-036', 'Phú Yên', 'trung', array[1,12,0,36,0,53,60,0,0,0,0,24,0,0,56,63,71,90,0,0,26,39,45,0,67,76,0]::smallint[]),
  ('VN63-037', 'Khánh Hòa', 'trung', array[1,0,0,33,0,54,0,77,85,0,16,27,35,41,56,0,0,0,7,17,0,36,44,0,64,0,0]::smallint[]),
  ('VN63-038', 'Ninh Thuận', 'trung', array[0,11,24,33,0,0,0,73,82,4,15,28,0,0,0,64,75,0,0,0,0,34,43,51,0,76,83]::smallint[]),
  ('VN63-039', 'Bình Thuận', 'trung', array[4,10,24,0,41,0,60,0,0,0,13,0,32,0,0,69,79,88,8,0,28,38,49,58,0,0,0]::smallint[]),
  ('VN63-040', 'Kon Tum', 'trung', array[0,12,0,30,0,0,64,74,80,0,19,20,0,45,58,0,0,81,2,0,27,0,0,0,65,79,88]::smallint[]),
  ('VN63-041', 'Gia Lai', 'trung', array[8,10,0,34,47,0,60,0,0,0,11,22,0,0,0,67,72,86,0,0,26,0,0,57,69,79,89]::smallint[]),
  ('VN63-042', 'Đắk Lắk', 'trung', array[1,0,0,31,46,0,66,0,87,3,16,21,34,0,50,0,0,0,8,0,27,0,47,53,0,78,0]::smallint[]),
  ('VN63-043', 'Đắk Nông', 'trung', array[3,17,26,0,0,59,0,0,82,6,0,0,0,44,0,60,71,87,0,0,0,37,45,0,61,79,88]::smallint[]),
  ('VN63-044', 'Lâm Đồng', 'trung', array[7,0,22,0,40,0,62,73,0,9,0,0,32,0,50,64,0,90,0,19,0,35,44,0,68,79,0]::smallint[]),
  ('VN63-045', 'Bình Phước', 'nam', array[1,11,20,34,44,0,0,0,0,4,16,25,39,0,0,0,0,90,0,0,27,0,48,59,63,75,0]::smallint[]),
  ('VN63-046', 'Tây Ninh', 'nam', array[0,0,21,0,45,50,64,72,0,0,11,27,39,47,55,0,0,0,5,16,0,0,0,57,68,0,86]::smallint[]),
  ('VN63-047', 'Bình Dương', 'nam', array[0,11,0,35,40,0,60,0,84,0,13,21,36,42,50,0,0,0,8,15,22,0,0,52,0,74,0]::smallint[]),
  ('VN63-048', 'Đồng Nai', 'nam', array[0,0,24,0,40,51,65,0,85,5,10,26,34,45,0,0,0,0,0,0,27,35,0,55,68,77,0]::smallint[]),
  ('VN63-049', 'Bà Rịa - Vũng Tàu', 'nam', array[0,0,23,31,40,0,0,73,82,6,10,0,34,0,0,61,74,0,0,0,0,37,46,52,63,0,85]::smallint[]),
  ('VN63-050', 'Hồ Chí Minh', 'nam', array[0,14,0,0,0,51,63,71,88,1,17,23,30,0,0,66,0,0,2,0,0,35,48,55,67,0,0]::smallint[]),
  ('VN63-051', 'Long An', 'nam', array[2,14,23,0,44,0,60,0,0,3,0,0,37,45,0,0,72,82,9,18,0,0,0,57,62,0,89]::smallint[]),
  ('VN63-052', 'Tiền Giang', 'nam', array[0,13,22,0,40,56,0,0,89,0,16,0,31,46,59,0,70,0,6,18,28,34,0,0,63,0,0]::smallint[]),
  ('VN63-053', 'Bến Tre', 'nam', array[0,12,22,36,0,53,0,72,0,7,0,0,0,44,0,62,77,83,9,14,25,39,0,0,66,0,0]::smallint[]),
  ('VN63-054', 'Trà Vinh', 'nam', array[0,14,0,34,0,50,64,0,83,0,0,25,0,41,51,0,73,86,7,0,0,0,0,57,68,77,89]::smallint[]),
  ('VN63-055', 'Vĩnh Long', 'nam', array[6,10,0,0,43,51,0,0,88,0,0,24,32,0,56,61,75,0,9,0,26,0,44,0,66,79,0]::smallint[]),
  ('VN63-056', 'Đồng Tháp', 'nam', array[1,18,20,34,0,0,0,76,0,6,0,25,36,46,0,68,0,0,7,19,27,0,0,53,0,0,87]::smallint[]),
  ('VN63-057', 'An Giang', 'nam', array[1,16,20,33,0,0,0,0,84,6,0,23,0,0,54,62,0,87,0,0,27,0,40,59,63,78,0]::smallint[]),
  ('VN63-058', 'Kiên Giang', 'nam', array[3,0,25,0,0,52,65,0,82,8,0,26,39,0,0,67,75,0,0,17,0,0,45,58,0,78,88]::smallint[]),
  ('VN63-059', 'Cần Thơ', 'nam', array[0,0,21,32,0,50,63,0,80,0,12,24,34,0,55,0,71,0,2,19,0,37,41,0,0,78,0]::smallint[]),
  ('VN63-060', 'Hậu Giang', 'nam', array[8,0,25,35,41,0,0,70,0,9,10,0,0,0,52,0,75,88,0,14,29,0,46,56,69,0,0]::smallint[]),
  ('VN63-061', 'Sóc Trăng', 'nam', array[0,0,29,0,44,0,64,70,88,3,10,0,38,45,0,67,0,0,5,19,0,0,48,54,69,0,0]::smallint[]),
  ('VN63-062', 'Bạc Liêu', 'nam', array[0,12,22,38,0,59,61,0,0,0,14,27,0,43,0,62,73,0,3,0,0,0,49,0,63,74,84]::smallint[]),
  ('VN63-063', 'Cà Mau', 'nam', array[0,11,0,34,45,58,0,0,84,1,0,24,36,0,0,60,70,0,2,19,26,38,0,59,0,0,0]::smallint[])
on conflict (code) do nothing;

-- ---------- 2. Phong: che do tinh, chu phong, luat thang ----------
alter table public.loto_rooms add column if not exists mode text not null default 'classic' check (mode in ('classic', 'province'));
alter table public.loto_rooms add column if not exists host_user uuid references auth.users(id) on delete set null;
alter table public.loto_rooms add column if not exists win_rows smallint not null default 1 check (win_rows between 1 and 3);
alter table public.loto_rooms add column if not exists auto_win boolean not null default true;
alter table public.loto_rooms add column if not exists allow_board_change boolean not null default false;
update public.loto_rooms set host_user = created_by where host_user is null;
do $$
declare v_con text;
begin
  select conname into v_con from pg_constraint
   where conrelid = 'public.loto_rooms'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%status%';
  if v_con is not null then execute format('alter table public.loto_rooms drop constraint %I', v_con); end if;
end $$;
alter table public.loto_rooms add constraint loto_rooms_status_check
  check (status in ('waiting', 'playing', 'paused', 'finished', 'cancelled'));

alter table public.loto_cards add column if not exists board_code text references public.loto_boards(code);
create unique index loto_cards_room_board_unique on public.loto_cards (room_id, board_code) where board_code is not null;

-- Nguoi thang (nhieu nguoi cung luot) + phan giai duoc chia
create table public.loto_winners (
  room_id uuid not null references public.loto_rooms(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.loto_cards(id) on delete cascade,
  board_code text references public.loto_boards(code),
  seq smallint not null,
  share_points int not null default 0,
  created_at timestamptz not null default now(),
  primary key (room_id, card_id)
);
alter table public.loto_winners enable row level security;
create policy loto_winners_select on public.loto_winners for select to authenticated
  using (public.games_can_read(family_id));
revoke all on public.loto_winners from anon, authenticated;
grant select on public.loto_winners to authenticated;

-- Danh sach bang da co nguoi chon trong phong (chi lo ma bang + nguoi chon, khong lo luoi so cua phong co dien)
create or replace view public.loto_room_cards_v as
select c.room_id, c.family_id, c.board_code, c.user_id, c.card_no
from public.loto_cards c
where public.games_can_read(c.family_id);
grant select on public.loto_room_cards_v to authenticated;

-- Phat kinh gia (so xu tru khi kinh sai), admin cau hinh
alter table public.game_settings add column if not exists loto_false_penalty int not null default 0
  check (loto_false_penalty between 0 and 100);

-- ---------- 3. Ham phu ----------
create or replace function public._loto_is_host(r public.loto_rooms) returns boolean
language sql stable set search_path = public as $$
  select auth.uid() is not null
     and (auth.uid() = coalesce(r.host_user, r.created_by)
          or coalesce(public.has_permission(r.family_id, 'games', 'update'), false));
$$;

create or replace function public._loto_complete_rows(p_room uuid, p_grid smallint[]) returns int
language plpgsql stable set search_path = public as $$
declare v_rows int := 0; rr int; k int; v_ok boolean;
begin
  for rr in 0..2 loop
    v_ok := true;
    for k in 1..9 loop
      if p_grid[rr * 9 + k] <> 0
         and not exists (select 1 from public.loto_calls l where l.room_id = p_room and l.number = p_grid[rr * 9 + k]) then
        v_ok := false;
      end if;
    end loop;
    if v_ok then v_rows := v_rows + 1; end if;
  end loop;
  return v_rows;
end $$;

-- Ket thuc van voi MOI nguoi du dieu kien thang o luot hien tai; chia deu giai (phan du +1 cho nguoi som nhat).
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
    select c.id as card_id, c.user_id, c.board_code from public.loto_cards c
     where c.room_id = p_room and public._loto_complete_rows(p_room, c.grid) >= r.win_rows
     order by (c.user_id = p_first_user) desc nulls last, c.created_at asc
  loop
    v_idx := v_idx + 1;
    v_get := v_share + case when v_idx <= v_rem then 1 else 0 end;
    insert into public.loto_winners (room_id, family_id, user_id, card_id, board_code, seq, share_points)
    values (p_room, r.family_id, w.user_id, w.card_id, w.board_code, r.called_count, v_get);
    if v_get > 0 then perform public._points_add(r.family_id, w.user_id, v_get, 'loto_prize', p_room::text); end if;
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

-- ---------- 4. Tao phong truyen thong: bat ky thanh vien, nguoi tao = chu phong ----------
create or replace function public.loto_create_province_room(
  p_family uuid, p_title text, p_prize int default 50,
  p_win_rows int default 1, p_auto_win boolean default true, p_allow_change boolean default false
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
  insert into public.loto_rooms (id, family_id, code, title, prize_points, commit_hash, created_by, host_user, mode, win_rows, auto_win, allow_board_change)
  values (v_id, p_family, v_code, btrim(p_title), p_prize, v_commit, auth.uid(), auth.uid(), 'province',
          p_win_rows, coalesce(p_auto_win, true), coalesce(p_allow_change, false));
  perform public.write_audit(p_family, 'loto.create_room', 'loto_room', v_id::text, null,
    jsonb_build_object('title', btrim(p_title), 'code', v_code, 'prize', p_prize, 'mode', 'province', 'win_rows', p_win_rows));
  for u in select m.user_id from public.family_memberships m
           where m.family_id = p_family and m.status = 'active' and m.user_id <> auth.uid()
             and public._user_has_permission(m.user_id, p_family, 'games', 'view')
  loop
    perform public._notify(p_family, u.user_id, 'system', 'Phòng lô tô truyền thống mới: ' || btrim(p_title),
      'Vào chọn bảng tỉnh của bạn nhé!', '/tro-choi/lo-to/' || v_id::text, 'loto-room:' || v_id::text || ':' || u.user_id::text);
  end loop;
  return v_id;
end $$;

-- ---------- 5. Chon / nha bang tinh (khoa o may chu bang khoa duy nhat) ----------
create or replace function public.loto_claim_board(p_room uuid, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; b public.loto_boards;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(r.family_id);
  if r.mode <> 'province' then raise exception 'wrong_mode' using errcode = 'P0001'; end if;
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
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

create or replace function public.loto_release_board(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(r.family_id);
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  if not r.allow_board_change then raise exception 'change_not_allowed' using errcode = 'P0001'; end if;
  delete from public.loto_cards where room_id = p_room and user_id = auth.uid() and board_code is not null;
end $$;

-- ---------- 6. Dieu khien cua chu phong ----------
create or replace function public.loto_pause(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status <> 'playing' then raise exception 'not_playing' using errcode = 'P0001'; end if;
  update public.loto_rooms set status = 'paused' where id = p_room;
end $$;

create or replace function public.loto_resume(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status <> 'paused' then raise exception 'not_paused' using errcode = 'P0001'; end if;
  update public.loto_rooms set status = 'playing' where id = p_room;
end $$;

create or replace function public.loto_undo_call(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status not in ('playing', 'paused') then raise exception 'not_playing' using errcode = 'P0001'; end if;
  if r.called_count <= 0 then raise exception 'nothing_to_undo' using errcode = 'P0001'; end if;
  delete from public.loto_calls where room_id = p_room and seq = r.called_count;
  update public.loto_rooms set called_count = called_count - 1 where id = p_room;
  perform public.write_audit(r.family_id, 'loto.undo_call', 'loto_room', p_room::text,
    jsonb_build_object('called', r.called_count), jsonb_build_object('called', r.called_count - 1));
end $$;

create or replace function public.loto_transfer_host(p_room uuid, p_new_user uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; v_new uuid := p_new_user;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status not in ('waiting', 'playing', 'paused') then raise exception 'already_finished' using errcode = 'P0001'; end if;
  if v_new is null then
    select c.user_id into v_new from public.loto_cards c
     where c.room_id = p_room and c.user_id <> coalesce(r.host_user, r.created_by)
     order by random() limit 1;
    if v_new is null then raise exception 'no_other_player' using errcode = 'P0001'; end if;
  end if;
  if v_new = coalesce(r.host_user, r.created_by) then raise exception 'already_host' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.family_memberships m
                  where m.family_id = r.family_id and m.user_id = v_new and m.status = 'active') then
    raise exception 'not_member' using errcode = '22023';
  end if;
  update public.loto_rooms set host_user = v_new where id = p_room;
  perform public.write_audit(r.family_id, 'loto.transfer_host', 'loto_room', p_room::text,
    jsonb_build_object('host', coalesce(r.host_user, r.created_by)), jsonb_build_object('host', v_new));
  return v_new;
end $$;

-- ---------- 7. Tu dong phat hien nguoi thang (chu phong goi sau moi luot ho) ----------
create or replace function public.loto_check_winners(p_room uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(r.family_id);
  if r.status <> 'playing' then return 0; end if;
  return public._loto_finish(p_room, null);
end $$;

-- ---------- 8. Kinh! viet lai: theo luat hang cua phong + phat kinh gia + nhieu nguoi thang ----------
create or replace function public.loto_claim_kinh(p_room uuid, p_card uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.loto_rooms; c public.loto_cards; v_rows int; v_ok boolean; v_bad int;
  v_penalty int; v_bal int; v_deduct int := 0; v_winners int; v_share int;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(r.family_id);
  if r.status <> 'playing' then raise exception 'not_playing' using errcode = 'P0001'; end if;
  select * into c from public.loto_cards where id = p_card and room_id = p_room and user_id = auth.uid();
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  select count(*) into v_bad from public.loto_claims x where x.room_id = p_room and x.user_id = auth.uid() and not x.valid;
  if v_bad >= 3 then raise exception 'too_many_false_claims' using errcode = 'P0001'; end if;
  v_rows := public._loto_complete_rows(p_room, c.grid);
  v_ok := v_rows >= r.win_rows;
  insert into public.loto_claims (room_id, family_id, user_id, card_id, valid, called_count)
  values (p_room, r.family_id, auth.uid(), p_card, v_ok, r.called_count);
  if not v_ok then
    select s.loto_false_penalty into v_penalty from public.game_settings s where s.family_id = r.family_id;
    if coalesce(v_penalty, 0) > 0 then
      v_bal := public._points_balance(r.family_id, auth.uid());
      v_deduct := least(v_penalty, greatest(coalesce(v_bal, 0), 0));
      if v_deduct > 0 then
        perform public._points_add(r.family_id, auth.uid(), -v_deduct, 'loto_false_claim', p_room::text);
      end if;
    end if;
    return jsonb_build_object('ok', false, 'rows', v_rows, 'need', r.win_rows,
      'false_claims', v_bad + 1, 'penalty', v_deduct);
  end if;
  v_winners := public._loto_finish(p_room, auth.uid());
  select share_points into v_share from public.loto_winners where room_id = p_room and card_id = p_card;
  return jsonb_build_object('ok', true, 'winners', v_winners, 'points', coalesce(v_share, 0));
end $$;

-- ---------- 9. Admin: muc phat kinh gia ----------
create or replace function public.games_set_loto_penalty(p_family uuid, p_penalty int) returns void
language plpgsql security definer set search_path = public as $$
declare v_before jsonb;
begin
  perform public._games_require_admin(p_family);
  if p_penalty is null or p_penalty < 0 or p_penalty > 100 then
    raise exception 'bad_loto_penalty' using errcode = '22023';
  end if;
  select to_jsonb(s) - 'updated_by' - 'updated_at' into v_before from public.game_settings s where s.family_id = p_family;
  if v_before is null then
    insert into public.game_settings (family_id) values (p_family);
    select to_jsonb(s) - 'updated_by' - 'updated_at' into v_before from public.game_settings s where s.family_id = p_family;
  end if;
  update public.game_settings set loto_false_penalty = p_penalty, updated_by = auth.uid() where family_id = p_family;
  perform public.write_audit(p_family, 'games.loto_penalty', 'game_settings', p_family::text, v_before,
    (select to_jsonb(s) - 'updated_by' - 'updated_at' from public.game_settings s where s.family_id = p_family));
end $$;


-- ---------- 9b. Start / ho so / ket thuc: chu phong (hoac admin tro choi) thay vi chi admin ----------
create or replace function public.loto_start(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public._games_enabled(r.family_id) then raise exception 'games_disabled' using errcode = 'P0001'; end if;
  if r.status <> 'waiting' then raise exception 'not_waiting' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.loto_cards c where c.room_id = p_room) then
    raise exception 'no_players' using errcode = 'P0001';
  end if;
  update public.loto_rooms set status = 'playing', started_at = now() where id = p_room;
  perform public.write_audit(r.family_id, 'loto.start', 'loto_room', p_room::text,
    jsonb_build_object('status', r.status), jsonb_build_object('status', 'playing'));
end $$;

create or replace function public.loto_call_next(p_room uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms; v_seed text; v_num int;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public._games_enabled(r.family_id) then raise exception 'games_disabled' using errcode = 'P0001'; end if;
  if r.status <> 'playing' then raise exception 'not_playing' using errcode = 'P0001'; end if;
  if r.called_count >= 90 then raise exception 'all_called' using errcode = 'P0001'; end if;
  v_seed := public._seed_get('loto', p_room);
  v_num := (public.fair_shuffle(v_seed, 90))[r.called_count + 1];
  insert into public.loto_calls (room_id, family_id, seq, number) values (p_room, r.family_id, r.called_count + 1, v_num);
  update public.loto_rooms set called_count = called_count + 1 where id = p_room;
  return v_num;
end $$;

create or replace function public.loto_end(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loto_rooms;
begin
  select * into r from public.loto_rooms where id = p_room for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public._loto_is_host(r) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status not in ('waiting', 'playing', 'paused') then raise exception 'already_finished' using errcode = 'P0001'; end if;
  update public.loto_rooms set status = case when r.status = 'waiting' then 'cancelled' else 'finished' end,
    finished_at = now() where id = p_room;
  perform public._seed_reveal('loto', p_room);
  perform public.write_audit(r.family_id, 'loto.end', 'loto_room', p_room::text,
    jsonb_build_object('status', r.status), jsonb_build_object('status', case when r.status = 'waiting' then 'cancelled' else 'finished' end));
end $$;

-- ---------- 9c. TV: ten nguoi thang uu tien ten goi khac + danh sach nguoi thang ----------
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
          'name', (select coalesce(nullif(p.alias_name, ''), p.display_name) from public.user_profiles p where p.id = lr.winner_user),
          'grid', (select k.grid from public.loto_cards k where k.id = lr.winner_card)) end,
      'winners', coalesce((select jsonb_agg(jsonb_build_object(
          'name', coalesce(nullif(p.alias_name, ''), p.display_name),
          'province', b.province_name, 'share', w.share_points) order by w.share_points desc, w.created_at)
        from public.loto_winners w
        join public.user_profiles p on p.id = w.user_id
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

-- ---------- 10. Realtime cho phong lo to (RLS van ap dung cho tung nguoi) ----------
do $$ begin alter publication supabase_realtime add table public.loto_rooms; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.loto_calls; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.loto_winners; exception when duplicate_object then null; when undefined_object then null; end $$;

grant execute on function
  public.loto_create_province_room(uuid, text, int, int, boolean, boolean),
  public.loto_claim_board(uuid, text), public.loto_release_board(uuid),
  public.loto_pause(uuid), public.loto_resume(uuid), public.loto_undo_call(uuid),
  public.loto_transfer_host(uuid, uuid), public.loto_check_winners(uuid),
  public.games_set_loto_penalty(uuid, int)
  to authenticated;
