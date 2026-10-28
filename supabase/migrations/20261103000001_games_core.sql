-- Module G (Tro choi giai tri gia dinh) / migration 1: nen tang
--   * quyen module 'games', cai dat bat/tat theo gia dinh (MAC DINH TAT)
--   * so diem ao (points_ledger: chi them, khong sua/xoa), so du, qua hang ngay, bang xep hang
--   * nguon ngau nhien an toan (gen_random_bytes) va thuat toan quay minh bach commit-reveal
-- QUY TAC CUNG: chi la DIEM AO ("Diem vui - khong co gia tri tien"). Khong tien that, khong nap/rut, khong thanh toan.
-- Moi thay doi diem di qua ham security definer; khong co quyen ghi truc tiep tren bang nao.

-- ---------- Quyen ----------
-- games.view = duoc choi (member, branch_admin, family_admin, super_admin; KHACH khong co quyen => khong choi)
-- games.update = quan tri tro choi (family_admin, super_admin): bat/tat, tao bao li xi, ky quay so, phong lo to/bau cua
insert into public.permissions (module, action)
select 'games', a from unnest(array['view','create','update','delete','approve','export']) as a;
insert into public.role_permissions (role_key, module, action)
select 'family_admin', 'games', a from unnest(array['view','create','update','delete','approve','export']) as a;
insert into public.role_permissions (role_key, module, action) values
  ('branch_admin', 'games', 'view'),
  ('member', 'games', 'view');

-- ---------- Cai dat (mac dinh TAT cho toi khi quan tri bat) ----------
create table public.game_settings (
  family_id uuid primary key references public.families(id) on delete cascade,
  enabled boolean not null default false,
  leaderboard_enabled boolean not null default true,
  starting_points int not null default 100 check (starting_points between 0 and 1000),
  daily_gift int not null default 10 check (daily_gift between 0 and 100),
  bc_min_bet int not null default 1 check (bc_min_bet between 1 and 100),
  bc_max_bet int not null default 20 check (bc_max_bet between 1 and 200),
  bc_max_round_total int not null default 50 check (bc_max_round_total between 1 and 500),
  bc_daily_loss_cap int not null default 100 check (bc_daily_loss_cap between 1 and 1000),
  bc_daily_win_cap int not null default 300 check (bc_daily_win_cap between 1 and 5000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (bc_min_bet <= bc_max_bet and bc_max_bet <= bc_max_round_total)
);
create trigger game_settings_updated before update on public.game_settings
  for each row execute function public.set_updated_at();

-- Moi gia dinh co mot dong cai dat (tat) ngay khi duoc tao; gia dinh da co tu truoc cung duoc bo sung
create or replace function public._games_seed_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.game_settings (family_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger families_games_settings after insert on public.families
  for each row execute function public._games_seed_settings();
insert into public.game_settings (family_id) select id from public.families on conflict do nothing;

create or replace function public._games_enabled(p_family uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.enabled from public.game_settings s where s.family_id = p_family), false);
$$;

-- Doc duoc du lieu tro choi: (module bat VA co quyen choi) HOAC la quan tri tro choi
create or replace function public.games_can_read(p_family uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (public._games_enabled(p_family) and public.has_permission(p_family, 'games', 'view'))
    or public.has_permission(p_family, 'games', 'update'), false);
$$;

-- Dieu kien de CHOI: da dang nhap, la thanh vien dang hoat dong, co quyen games.view, module dang bat
create or replace function public._games_require_play(p_family uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not coalesce(public.is_family_member(p_family), false)
     or not coalesce(public.has_permission(p_family, 'games', 'view'), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public._games_enabled(p_family) then
    raise exception 'games_disabled' using errcode = 'P0001';
  end if;
end $$;

create or replace function public._games_require_admin(p_family uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not coalesce(public.has_permission(p_family, 'games', 'update'), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function public.games_save_settings(
  p_family uuid, p_enabled boolean, p_leaderboard boolean, p_start int, p_gift int,
  p_bc_min int, p_bc_max int, p_bc_round int, p_loss int, p_win int
) returns void
language plpgsql security definer set search_path = public as $$
declare v_before jsonb;
begin
  perform public._games_require_admin(p_family);
  select to_jsonb(s) - 'updated_by' - 'updated_at' into v_before from public.game_settings s where s.family_id = p_family;
  if v_before is null then
    insert into public.game_settings (family_id) values (p_family);
    select to_jsonb(s) - 'updated_by' - 'updated_at' into v_before from public.game_settings s where s.family_id = p_family;
  end if;
  update public.game_settings set
    enabled = coalesce(p_enabled, false), leaderboard_enabled = coalesce(p_leaderboard, true),
    starting_points = p_start, daily_gift = p_gift,
    bc_min_bet = p_bc_min, bc_max_bet = p_bc_max, bc_max_round_total = p_bc_round,
    bc_daily_loss_cap = p_loss, bc_daily_win_cap = p_win, updated_by = auth.uid()
    where family_id = p_family;
  perform public.write_audit(p_family, 'games.settings', 'game_settings', p_family::text, v_before,
    (select to_jsonb(s) - 'updated_by' - 'updated_at' from public.game_settings s where s.family_id = p_family));
end $$;

-- ---------- Nguon ngau nhien an toan ----------
-- So nguyen deu trong [0, k) tu gen_random_bytes, loai bo mau lech (rejection sampling)
create or replace function public._rand_below(p_k int) returns int
language plpgsql volatile set search_path = public, extensions as $$
declare b bytea; w bigint; lim bigint;
begin
  if p_k is null or p_k < 1 then raise exception 'bad k' using errcode = '22023'; end if;
  lim := (4294967296::bigint / p_k) * p_k;
  loop
    b := extensions.gen_random_bytes(4);
    w := (get_byte(b, 0)::bigint << 24) | (get_byte(b, 1)::bigint << 16) | (get_byte(b, 2)::bigint << 8) | get_byte(b, 3)::bigint;
    exit when w < lim;
  end loop;
  return (w % p_k)::int;
end $$;

-- ---------- Quay so minh bach (commit-reveal): thuat toan CONG KHAI ----------
-- Cam ket = sha256 cua chuoi hex cua seed (UTF-8). Tu thu i cua dong tu = 4 byte (big-endian) tai (i mod 8)*4
-- cua sha256(seed || ':' || floor(i/8)). Hoan vi 1..n: Fisher-Yates i = n..2, j = rand_below(i), doi a[i], a[j+1].
create or replace function public.fair_commit(p_seed text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(p_seed, 'sha256'), 'hex');
$$;

create or replace function public._fair_word(p_seed text, p_idx int) returns bigint
language sql immutable set search_path = public, extensions as $$
  select (get_byte(d, o)::bigint << 24) | (get_byte(d, o + 1)::bigint << 16)
       | (get_byte(d, o + 2)::bigint << 8) | get_byte(d, o + 3)::bigint
  from (select extensions.digest(p_seed || ':' || (p_idx / 8)::text, 'sha256') as d, (p_idx % 8) * 4 as o) s;
$$;

create or replace function public.fair_shuffle(p_seed text, p_n int) returns int[]
language plpgsql immutable set search_path = public, extensions as $$
declare a int[]; i int; j int; pos int := 0; w bigint; lim bigint; t int;
begin
  if p_n is null or p_n < 0 or p_n > 100000 then raise exception 'bad n' using errcode = '22023'; end if;
  select coalesce(array_agg(x order by x), '{}') into a from generate_series(1, p_n) x;
  i := p_n;
  while i >= 2 loop
    lim := (4294967296::bigint / i) * i;
    loop
      w := public._fair_word(p_seed, pos);
      pos := pos + 1;
      exit when w < lim;
    end loop;
    j := (w % i)::int;
    t := a[i]; a[i] := a[j + 1]; a[j + 1] := t;
    i := i - 1;
  end loop;
  return a;
end $$;

-- Seed bi mat: chi hien (cho thanh vien) SAU khi quay (revealed_at). Cam ket cong khai nam o bang cua tro choi.
create table public.game_seeds (
  kind text not null check (kind in ('lottery', 'loto')),
  ref_id uuid not null,
  family_id uuid not null references public.families(id) on delete cascade,
  seed text not null check (seed ~ '^[0-9a-f]{64}$'),
  revealed_at timestamptz,
  primary key (kind, ref_id)
);

-- Tao seed moi, luu kin, tra ve ma cam ket de cong bo
create or replace function public._seed_new(p_kind text, p_ref uuid, p_family uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_seed text;
begin
  v_seed := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.game_seeds (kind, ref_id, family_id, seed) values (p_kind, p_ref, p_family, v_seed);
  return public.fair_commit(v_seed);
end $$;

create or replace function public._seed_get(p_kind text, p_ref uuid) returns text
language sql stable security definer set search_path = public as $$
  select seed from public.game_seeds where kind = p_kind and ref_id = p_ref;
$$;

create or replace function public._seed_reveal(p_kind text, p_ref uuid) returns void
language sql security definer set search_path = public as $$
  update public.game_seeds set revealed_at = coalesce(revealed_at, now()) where kind = p_kind and ref_id = p_ref;
$$;

-- ---------- So diem ao (chi them) ----------
create table public.points_ledger (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null check (delta <> 0),
  reason text not null check (reason in ('start', 'daily_gift', 'lixi', 'lottery_ticket', 'lottery_refund',
    'lottery_prize', 'loto_prize', 'baucua_bet', 'baucua_payout', 'baucua_refund')),
  ref text check (char_length(ref) <= 100),
  local_day date not null,
  balance_after int not null check (balance_after >= 0),   -- khong bao gio am
  created_at timestamptz not null default now()
);
create index points_ledger_user_idx on public.points_ledger (family_id, user_id, id desc);
create unique index points_ledger_one_start on public.points_ledger (family_id, user_id) where reason = 'start';
create unique index points_ledger_one_gift_per_day on public.points_ledger (family_id, user_id, local_day) where reason = 'daily_gift';

-- Ngay dia phuong cua nguoi choi theo mui gio trong ho so
create or replace function public._user_local_day(p_user uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select p.timezone from public.user_profiles p where p.id = p_user), 'Asia/Ho_Chi_Minh'))::date;
$$;

-- Khoa theo (gia dinh, nguoi choi) de hai giao dich dong thoi khong the cung tieu mot so du;
-- so du sau giao dich luon do CSDL tinh va khong cho am (ke ca khi ai do chen truc tiep bang quyen cao).
create or replace function public._points_ledger_before_insert() returns trigger
language plpgsql set search_path = public as $$
declare v_prior int;
begin
  perform pg_advisory_xact_lock(hashtextextended('points:' || new.family_id::text || ':' || new.user_id::text, 0));
  select l.balance_after into v_prior from public.points_ledger l
    where l.family_id = new.family_id and l.user_id = new.user_id order by l.id desc limit 1;
  new.balance_after := coalesce(v_prior, 0) + new.delta;
  if new.balance_after < 0 then
    raise exception 'insufficient_points' using errcode = 'P0001';
  end if;
  if new.local_day is null then new.local_day := public._user_local_day(new.user_id); end if;
  return new;
end $$;
create trigger points_ledger_bi before insert on public.points_ledger
  for each row execute function public._points_ledger_before_insert();

create or replace function public._points_ledger_immutable() returns trigger
language plpgsql as $$
begin
  -- Chi duong "xoa du lieu mot nguoi" (games_purge_user, service_role) moi duoc bat co nay
  if tg_op = 'DELETE' and current_setting('games.purge', true) = 'on' then return old; end if;
  raise exception 'points_ledger is append-only' using errcode = 'P0001';
end $$;
create trigger points_ledger_no_change before update or delete on public.points_ledger
  for each row execute function public._points_ledger_immutable();
create trigger points_ledger_no_truncate before truncate on public.points_ledger
  for each statement execute function public._points_ledger_immutable();

create or replace function public._points_balance(p_family uuid, p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select l.balance_after from public.points_ledger l
                   where l.family_id = p_family and l.user_id = p_user order by l.id desc limit 1), 0);
$$;

-- Lan dau tham gia: tang diem khoi dau (mot lan duy nhat)
create or replace function public._points_ensure(p_family uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_start int;
begin
  perform pg_advisory_xact_lock(hashtextextended('points:' || p_family::text || ':' || p_user::text, 0));
  if exists (select 1 from public.points_ledger l where l.family_id = p_family and l.user_id = p_user) then return; end if;
  select s.starting_points into v_start from public.game_settings s where s.family_id = p_family;
  if coalesce(v_start, 0) > 0 then
    insert into public.points_ledger (family_id, user_id, delta, reason) values (p_family, p_user, v_start, 'start');
  end if;
end $$;

-- Ham duy nhat doi diem. Tra ve so du moi. Nem 'insufficient_points' neu se am.
create or replace function public._points_add(
  p_family uuid, p_user uuid, p_delta int, p_reason text, p_ref text, p_day date default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_bal int;
begin
  perform public._points_ensure(p_family, p_user);
  if p_delta is null or p_delta = 0 then return public._points_balance(p_family, p_user); end if;
  insert into public.points_ledger (family_id, user_id, delta, reason, ref, local_day)
  values (p_family, p_user, p_delta, p_reason, p_ref, p_day)
  returning balance_after into v_bal;
  return v_bal;
end $$;

-- So du theo nguoi (view chay voi quyen nguoi goi => chiu RLS cua points_ledger)
create view public.points_balance_v with (security_invoker = true) as
  select l.family_id, l.user_id, sum(l.delta)::int as balance, max(l.created_at) as last_at
  from public.points_ledger l group by l.family_id, l.user_id;

-- So du cua toi (tao diem khoi dau neu la lan dau)
create or replace function public.points_my_balance(p_family uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  perform public._games_require_play(p_family);
  perform public._points_ensure(p_family, auth.uid());
  return public._points_balance(p_family, auth.uid());
end $$;

-- Qua hang ngay: toi da mot lan moi ngay DIA PHUONG cua nguoi choi (mui gio trong ho so);
-- ngay nhan phai TANG DAN (doi mui gio de nhan lai trong cung ngay that se bi chan).
create or replace function public.claim_daily_gift(p_family uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_gift int; v_day date;
begin
  perform public._games_require_play(p_family);
  select s.daily_gift into v_gift from public.game_settings s where s.family_id = p_family;
  if coalesce(v_gift, 0) <= 0 then raise exception 'no_gift' using errcode = 'P0001'; end if;
  perform public._points_ensure(p_family, auth.uid());
  perform pg_advisory_xact_lock(hashtextextended('points:' || p_family::text || ':' || auth.uid()::text, 0));
  v_day := public._user_local_day(auth.uid());
  if exists (select 1 from public.points_ledger l
             where l.family_id = p_family and l.user_id = auth.uid() and l.reason = 'daily_gift' and l.local_day >= v_day) then
    raise exception 'already_claimed' using errcode = 'P0001';
  end if;
  perform public._points_add(p_family, auth.uid(), v_gift, 'daily_gift', v_day::text, v_day);
  return v_gift;
end $$;

-- Bang xep hang gia dinh (quan tri co the tat); toi da 20 nguoi
create or replace function public.games_leaderboard(p_family uuid)
returns table (user_id uuid, display_name text, balance int, rnk int)
language plpgsql security definer set search_path = public as $$
begin
  perform public._games_require_play(p_family);
  if not coalesce((select s.leaderboard_enabled from public.game_settings s where s.family_id = p_family), false) then
    return;
  end if;
  return query
    select b.user_id, p.display_name, b.balance_after, (rank() over (order by b.balance_after desc))::int
    from (select distinct on (l.user_id) l.user_id, l.balance_after
          from public.points_ledger l where l.family_id = p_family order by l.user_id, l.id desc) b
    join public.user_profiles p on p.id = b.user_id
    join public.family_memberships m on m.user_id = b.user_id and m.family_id = p_family and m.status = 'active'
    where public.has_permission(p_family, 'games', 'view')
    order by b.balance_after desc, p.display_name
    limit 20;
end $$;

-- Xoa du lieu diem cua mot nguoi (vi du khi xoa tai khoan): chi service_role; ghi nhat ky
create or replace function public.games_purge_user(p_family uuid, p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform set_config('games.purge', 'on', true);
  delete from public.points_ledger where family_id = p_family and user_id = p_user;
  get diagnostics n = row_count;
  perform set_config('games.purge', 'off', true);
  insert into public.audit_logs (family_id, actor_id, action, entity_type, entity_id, after_data)
  values (p_family, null, 'games.purge_user', 'user', p_user::text, jsonb_build_object('ledger_rows', n));
  return n;
end $$;

-- ---------- RLS + cap quyen ----------
alter table public.game_settings enable row level security;
alter table public.game_seeds enable row level security;
alter table public.points_ledger enable row level security;

create policy game_settings_select on public.game_settings for select to authenticated
  using (public.is_family_member(family_id));
create policy game_seeds_select_revealed on public.game_seeds for select to authenticated
  using (revealed_at is not null and public.games_can_read(family_id));
create policy points_ledger_select on public.points_ledger for select to authenticated
  using ((user_id = auth.uid() and public.games_can_read(family_id))
         or public.has_permission(family_id, 'games', 'update'));

revoke all on public.game_settings, public.game_seeds, public.points_ledger, public.points_balance_v from anon, authenticated;
grant select on public.game_settings, public.game_seeds, public.points_ledger, public.points_balance_v to authenticated;

-- Ham cua module nay: mac dinh khong ai goi duoc, mo tung ham (khong dung revoke hang loat tren ca schema)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname ~ '^_?(games|points|fair|seed|rand|user_local|lixi|lottery|loto|bc|claim_daily)'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function
  public.games_can_read(uuid), public.games_save_settings(uuid, boolean, boolean, int, int, int, int, int, int, int),
  public.points_my_balance(uuid), public.claim_daily_gift(uuid), public.games_leaderboard(uuid),
  public.fair_commit(text), public.fair_shuffle(text, int), public._fair_word(text, int)   -- ham thuan, cong khai (fair_shuffle goi _fair_word)
  to authenticated;
grant execute on function public.games_purge_user(uuid, uuid) to service_role;
