-- Module G / migration 2: Boc tham li xi ao (li xi may man) - DIEM AO, khong co gia tri tien
-- Quan tri tao "bao li xi" gom N phan thuong (diem ao). Thanh vien boc, moi nguoi MOT lan moi bao.
-- Phan thuong duoc chon ngau nhien o CSDL (gen_random_bytes) trong cac phan chua boc; client khong the anh huong.

create table public.lixi_packets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  status text not null default 'open' check (status in ('open', 'closed')),
  prize_count int not null check (prize_count between 1 and 50),
  closes_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index lixi_packets_family_idx on public.lixi_packets (family_id, created_at desc);

-- Danh sach phan thuong: CHI quan tri doc duoc (de thanh vien khong biet truoc con bao nhieu diem)
create table public.lixi_prizes (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.lixi_packets(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  points int not null check (points between 1 and 500),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  check ((claimed_by is null) = (claimed_at is null))
);
create index lixi_prizes_packet_idx on public.lixi_prizes (packet_id);
create unique index lixi_prizes_one_per_user on public.lixi_prizes (packet_id, claimed_by) where claimed_by is not null;

-- Ket qua boc (ai boc duoc bao nhieu): ca nha cung xem
create table public.lixi_draws (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.lixi_packets(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points int not null check (points between 1 and 500),
  created_at timestamptz not null default now(),
  unique (packet_id, user_id)       -- chong boc doi
);

create or replace function public.lixi_create(p_family uuid, p_title text, p_points int[], p_closes_at timestamptz default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int; v_p int; u record;
begin
  perform public._games_require_admin(p_family);
  v_n := coalesce(array_length(p_points, 1), 0);
  if v_n < 1 or v_n > 50 then raise exception 'prize count must be 1..50' using errcode = '22023'; end if;
  foreach v_p in array p_points loop
    if v_p is null or v_p < 1 or v_p > 500 then raise exception 'prize must be 1..500 points' using errcode = '22023'; end if;
  end loop;
  if p_closes_at is not null and (p_closes_at <= now() or p_closes_at > now() + interval '60 days') then
    raise exception 'closes_at out of range' using errcode = '22023';
  end if;
  insert into public.lixi_packets (family_id, title, prize_count, closes_at, created_by)
  values (p_family, btrim(p_title), v_n, p_closes_at, auth.uid()) returning id into v_id;
  insert into public.lixi_prizes (packet_id, family_id, points)
  select v_id, p_family, x from unnest(p_points) as x;
  perform public.write_audit(p_family, 'lixi.create', 'lixi_packet', v_id::text, null,
    jsonb_build_object('title', btrim(p_title), 'prize_count', v_n, 'total_points', (select sum(x) from unnest(p_points) x)));
  if public._games_enabled(p_family) then
    for u in select m.user_id from public.family_memberships m
             where m.family_id = p_family and m.status = 'active'
               and public._user_has_permission(m.user_id, p_family, 'games', 'view')
    loop
      perform public._notify(p_family, u.user_id, 'system', 'Có bao lì xì may mắn mới', btrim(p_title),
        '/tro-choi/li-xi-may-man', 'lixi:' || v_id::text || ':' || u.user_id::text);
    end loop;
  end if;
  return v_id;
end $$;

create or replace function public.lixi_close(p_packet uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.lixi_packets;
begin
  select * into v from public.lixi_packets where id = p_packet for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_admin(v.family_id);
  update public.lixi_packets set status = 'closed', closed_at = coalesce(closed_at, now()) where id = p_packet;
  perform public.write_audit(v.family_id, 'lixi.close', 'lixi_packet', p_packet::text,
    jsonb_build_object('status', v.status), jsonb_build_object('status', 'closed'));
end $$;

-- Boc tham: tra ve so diem ao nhan duoc
create or replace function public.lixi_draw(p_packet uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v public.lixi_packets; v_left int; pr record;
begin
  select * into v from public.lixi_packets where id = p_packet for update;   -- khoa: tuan tu hoa cac lan boc
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._games_require_play(v.family_id);
  if v.status <> 'open' or (v.closes_at is not null and v.closes_at <= now()) then
    raise exception 'closed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.lixi_draws d where d.packet_id = p_packet and d.user_id = auth.uid()) then
    raise exception 'already_drawn' using errcode = 'P0001';
  end if;
  select count(*) into v_left from public.lixi_prizes where packet_id = p_packet and claimed_by is null;
  if v_left = 0 then raise exception 'empty' using errcode = 'P0001'; end if;
  select * into pr from public.lixi_prizes
    where packet_id = p_packet and claimed_by is null
    order by id offset public._rand_below(v_left) limit 1 for update;
  update public.lixi_prizes set claimed_by = auth.uid(), claimed_at = now() where id = pr.id;
  insert into public.lixi_draws (packet_id, family_id, user_id, points) values (p_packet, v.family_id, auth.uid(), pr.points);
  perform public._points_add(v.family_id, auth.uid(), pr.points, 'lixi', p_packet::text);
  if v_left = 1 then
    update public.lixi_packets set status = 'closed', closed_at = now() where id = p_packet;
  end if;
  return pr.points;
end $$;

alter table public.lixi_packets enable row level security;
alter table public.lixi_prizes enable row level security;
alter table public.lixi_draws enable row level security;
create policy lixi_packets_select on public.lixi_packets for select to authenticated
  using (public.games_can_read(family_id));
create policy lixi_prizes_select_admin on public.lixi_prizes for select to authenticated
  using (public.has_permission(family_id, 'games', 'update'));
create policy lixi_draws_select on public.lixi_draws for select to authenticated
  using (public.games_can_read(family_id));

revoke all on public.lixi_packets, public.lixi_prizes, public.lixi_draws from anon, authenticated;
grant select on public.lixi_packets, public.lixi_prizes, public.lixi_draws to authenticated;

grant execute on function public.lixi_create(uuid, text, int[], timestamptz), public.lixi_close(uuid), public.lixi_draw(uuid)
  to authenticated;
