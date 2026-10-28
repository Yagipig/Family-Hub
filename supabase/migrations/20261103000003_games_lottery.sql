-- Module G / migration 3: Xo so gia dinh (quay so vui) - giai thuong la diem ao / loi chuc / vat pham vui, KHONG phai tien
-- Minh bach commit-reveal: khi mo ky quay he thong sinh seed ngau nhien, GIU KIN seed va cong bo ma cam ket
-- (sha256 cua seed). Sau khi quay, seed duoc tiet lo; ai cung tinh lai duoc ket qua bang thuat toan cong khai
-- (public.lottery_compute_winners, ban TS tuong duong: src/lib/games/fair.ts).

create table public.lottery_draws (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  status text not null default 'open' check (status in ('open', 'drawn', 'cancelled')),
  ticket_price int not null default 5 check (ticket_price between 0 and 50),
  free_tickets smallint not null default 1 check (free_tickets between 0 and 3),
  max_tickets smallint not null default 3 check (max_tickets between 1 and 5),
  draw_at timestamptz not null,
  commit_hash text not null check (commit_hash ~ '^[0-9a-f]{64}$'),
  ticket_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  drawn_at timestamptz,
  drawn_by uuid references auth.users(id) on delete set null,
  check (free_tickets <= max_tickets)
);
create index lottery_draws_family_idx on public.lottery_draws (family_id, created_at desc);

create table public.lottery_prizes (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.lottery_draws(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  rank smallint not null check (rank between 1 and 20),
  kind text not null check (kind in ('points', 'wish', 'item')),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  points int,
  unique (draw_id, rank),
  check ((kind = 'points') = (points is not null)),
  check (points is null or points between 1 and 500)
);

create table public.lottery_tickets (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.lottery_draws(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_no int not null check (ticket_no >= 1),
  paid int not null default 0 check (paid >= 0),
  created_at timestamptz not null default now(),
  unique (draw_id, ticket_no)
);
create index lottery_tickets_user_idx on public.lottery_tickets (draw_id, user_id);

create table public.lottery_results (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.lottery_draws(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  rank smallint not null,
  prize_id uuid not null references public.lottery_prizes(id) on delete cascade,
  ticket_no int not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  points_awarded int not null default 0 check (points_awarded >= 0),
  created_at timestamptz not null default now(),
  unique (draw_id, rank)
);

-- Thuat toan chon ve trung giai (CONG KHAI). p_tickets: mang jsonb [{"no":1,"owner":"..."}]. Tra ve so ve theo hang 1,2,...
-- Xao tron cac ve (sap tang theo so ve) bang seed; duyet theo thu tu xao; moi nguoi chi trung toi da mot giai.
create or replace function public.lottery_compute_winners(p_seed text, p_tickets jsonb, p_prize_count int) returns int[]
language plpgsql immutable set search_path = public, extensions as $$
declare t_no int[]; t_owner text[]; n int; ord int[]; k int; idx int; o text; won text[] := '{}'; res int[] := '{}';
begin
  select coalesce(array_agg((e->>'no')::int order by (e->>'no')::int), '{}'),
         coalesce(array_agg(e->>'owner' order by (e->>'no')::int), '{}')
    into t_no, t_owner from jsonb_array_elements(coalesce(p_tickets, '[]'::jsonb)) e;
  n := coalesce(array_length(t_no, 1), 0);
  ord := public.fair_shuffle(p_seed, n);
  for k in 1..n loop
    exit when coalesce(array_length(res, 1), 0) >= p_prize_count;
    idx := ord[k];
    o := t_owner[idx];
    if o = any(won) then continue; end if;
    won := won || o;
    res := res || t_no[idx];
  end loop;
  return res;
end $$;

-- Mo ky quay. p_prizes: mang jsonb [{"kind":"points","label":"Giai nhat","points":50}, {"kind":"wish","label":"..."}] theo thu tu hang.
create or replace function public.lottery_open(
  p_family uuid, p_title text, p_draw_at timestamptz, p_price int, p_free int, p_max int, p_prizes jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid(); v_commit text; v_n int; e jsonb; r int := 0; u record;
begin
  perform public._games_require_admin(p_family);
  if p_draw_at is null or p_draw_at <= now() or p_draw_at > now() + interval '90 days' then
    raise exception 'draw_at out of range' using errcode = '22023';
  end if;
  if jsonb_typeof(p_prizes) is distinct from 'array' then raise exception 'prizes must be an array' using errcode = '22023'; end if;
  v_n := jsonb_array_length(p_prizes);
  if v_n < 1 or v_n > 20 then raise exception 'prize count must be 1..20' using errcode = '22023'; end if;
  v_commit := public._seed_new('lottery', v_id, p_family);
  insert into public.lottery_draws (id, family_id, title, ticket_price, free_tickets, max_tickets, draw_at, commit_hash, created_by)
  values (v_id, p_family, btrim(p_title), p_price, p_free, p_max, p_draw_at, v_commit, auth.uid());
  for e in select * from jsonb_array_elements(p_prizes) loop
    r := r + 1;
    insert into public.lottery_prizes (draw_id, family_id, rank, kind, label, points)
    values (v_id, p_family, r, e->>'kind', btrim(e->>'label'),
            case when e->>'kind' = 'points' then (e->>'points')::int else null end);
  end loop;
  perform public.write_audit(p_family, 'lottery.open', 'lottery_draw', v_id::text, null,
    jsonb_build_object('title', btrim(p_title), 'draw_at', p_draw_at, 'commit', v_commit, 'prizes', v_n));
  if public._games_enabled(p_family) then
    for u in select m.user_id from public.family_memberships m
             where m.family_id = p_family and m.status = 'active'
               and public._user_has_permission(m.user_id, p_family, 'games', 'view')
    loop
      perform public._notify(p_family, u.user_id, 'system', 'Có kỳ quay số vui mới', btrim(p_title),
        '/tro-choi/xo-so', 'lottery-open:' || v_id::text || ':' || u.user_id::text);
    end loop;
  end if;
  return v_id;
end $$;

-- Nhan ve: ve dau (mien phi) theo free_tickets, cac ve sau doi bang diem ao theo gia co dinh; toi da max_tickets/nguoi.
create or replace function public.lottery_get_ticket(p_draw uuid) returns int
language plpgsql security definer set search_path = public as $$
declare d public.lottery_draws; v_mine int; v_paid int; v_no int;
begin
  select * into d from public.lottery_draws where id = p_draw for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(d.family_id);
  if d.status <> 'open' or d.draw_at <= now() then raise exception 'closed' using errcode = 'P0001'; end if;
  select count(*) into v_mine from public.lottery_tickets where draw_id = p_draw and user_id = auth.uid();
  if v_mine >= d.max_tickets then raise exception 'max_tickets' using errcode = 'P0001'; end if;
  v_paid := case when v_mine >= d.free_tickets then d.ticket_price else 0 end;
  v_no := d.ticket_count + 1;
  if v_paid > 0 then
    perform public._points_add(d.family_id, auth.uid(), -v_paid, 'lottery_ticket', p_draw::text);
  end if;
  insert into public.lottery_tickets (draw_id, family_id, user_id, ticket_no, paid)
  values (p_draw, d.family_id, auth.uid(), v_no, v_paid);
  update public.lottery_draws set ticket_count = v_no where id = p_draw;
  return v_no;
end $$;

-- Quay so: quan tri bam quay bat ky luc nao, hoac bat ky thanh vien nao khi da toi gio quay. Chi quay duoc mot lan.
create or replace function public.lottery_run(p_draw uuid) returns int
language plpgsql security definer set search_path = public as $$
declare d public.lottery_draws; v_admin boolean; v_seed text; v_tickets jsonb; v_prizes int; v_win int[]; k int;
        pz public.lottery_prizes; tk public.lottery_tickets; v_count int := 0;
begin
  select * into d from public.lottery_draws where id = p_draw for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_admin := coalesce(public.has_permission(d.family_id, 'games', 'update'), false);
  if not v_admin then
    perform public._games_require_play(d.family_id);
    if d.draw_at > now() then raise exception 'too_early' using errcode = 'P0001'; end if;
  end if;
  if not public._games_enabled(d.family_id) then raise exception 'games_disabled' using errcode = 'P0001'; end if;   -- ke ca quan tri
  if d.status <> 'open' then raise exception 'not_open' using errcode = 'P0001'; end if;
  v_seed := public._seed_get('lottery', p_draw);
  if v_seed is null or public.fair_commit(v_seed) <> d.commit_hash then
    raise exception 'commit mismatch' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('no', t.ticket_no, 'owner', t.user_id::text) order by t.ticket_no), '[]'::jsonb)
    into v_tickets from public.lottery_tickets t where t.draw_id = p_draw;
  select count(*) into v_prizes from public.lottery_prizes where draw_id = p_draw;
  v_win := public.lottery_compute_winners(v_seed, v_tickets, v_prizes);
  for k in 1..coalesce(array_length(v_win, 1), 0) loop
    select * into pz from public.lottery_prizes where draw_id = p_draw and rank = k;
    select * into tk from public.lottery_tickets where draw_id = p_draw and ticket_no = v_win[k];
    insert into public.lottery_results (draw_id, family_id, rank, prize_id, ticket_no, user_id, label, points_awarded)
    values (p_draw, d.family_id, k, pz.id, tk.ticket_no, tk.user_id, pz.label, coalesce(pz.points, 0));
    if pz.kind = 'points' then
      perform public._points_add(d.family_id, tk.user_id, pz.points, 'lottery_prize', p_draw::text);
    end if;
    perform public._notify(d.family_id, tk.user_id, 'system', 'Chúc mừng! Bạn trúng giải ' || pz.label,
      d.title, '/tro-choi/xo-so', 'lottery-win:' || p_draw::text || ':' || tk.user_id::text);
    v_count := v_count + 1;
  end loop;
  update public.lottery_draws set status = 'drawn', drawn_at = now(), drawn_by = auth.uid() where id = p_draw;
  perform public._seed_reveal('lottery', p_draw);
  perform public.write_audit(d.family_id, 'lottery.draw', 'lottery_draw', p_draw::text, null,
    jsonb_build_object('winners', v_count, 'tickets', d.ticket_count, 'by_admin', v_admin));
  return v_count;
end $$;

-- Huy ky quay: hoan lai diem ve da mua, tiet lo seed
create or replace function public.lottery_cancel(p_draw uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d public.lottery_draws; t record;
begin
  select * into d from public.lottery_draws where id = p_draw for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_admin(d.family_id);
  if d.status <> 'open' then raise exception 'not_open' using errcode = 'P0001'; end if;
  for t in select user_id, paid from public.lottery_tickets where draw_id = p_draw and paid > 0 loop
    perform public._points_add(d.family_id, t.user_id, t.paid, 'lottery_refund', p_draw::text);
  end loop;
  update public.lottery_draws set status = 'cancelled' where id = p_draw;
  perform public._seed_reveal('lottery', p_draw);
  perform public.write_audit(d.family_id, 'lottery.cancel', 'lottery_draw', p_draw::text,
    jsonb_build_object('status', d.status), jsonb_build_object('status', 'cancelled'));
end $$;

alter table public.lottery_draws enable row level security;
alter table public.lottery_prizes enable row level security;
alter table public.lottery_tickets enable row level security;
alter table public.lottery_results enable row level security;
create policy lottery_draws_select on public.lottery_draws for select to authenticated
  using (public.games_can_read(family_id));
create policy lottery_prizes_select on public.lottery_prizes for select to authenticated
  using (public.games_can_read(family_id));
-- Ve cua minh luon xem duoc; ve cua nguoi khac chi hien sau khi da quay (de ai cung kiem chung duoc)
create policy lottery_tickets_select on public.lottery_tickets for select to authenticated
  using (public.games_can_read(family_id)
         and (user_id = auth.uid()
              or exists (select 1 from public.lottery_draws d where d.id = lottery_tickets.draw_id and d.status = 'drawn')));
create policy lottery_results_select on public.lottery_results for select to authenticated
  using (public.games_can_read(family_id));

revoke all on public.lottery_draws, public.lottery_prizes, public.lottery_tickets, public.lottery_results from anon, authenticated;
grant select on public.lottery_draws, public.lottery_prizes, public.lottery_tickets, public.lottery_results to authenticated;

grant execute on function
  public.lottery_compute_winners(text, jsonb, int),
  public.lottery_open(uuid, text, timestamptz, int, int, int, jsonb),
  public.lottery_get_ticket(uuid), public.lottery_run(uuid), public.lottery_cancel(uuid)
  to authenticated;
