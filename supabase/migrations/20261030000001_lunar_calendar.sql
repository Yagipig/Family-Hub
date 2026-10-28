-- Su kien / Lich / migration 1: bang tham chieu am lich + ham chuyen doi (dung cho job thong bao hang ngay)
-- Du lieu nam o migration 2 (sinh tu src/lib/lunar.ts). Ngoai pham vi 1900..2100 cac ham tra ve NULL (khong loi).
--
-- QUY TAC LAP LAI THEO AM LICH (giong het src/lib/lunar.ts, co test doi chieu):
--  1. Ngay goc 30 ma thang do chi co 29 ngay -> dung ngay cuoi thang (29).
--  2. Thang nhuan goc (vi du nhuan thang 4) ma nam do khong co thang nhuan do -> dung thang thuong cung so.
--  3. Ngay goc o thang thuong -> luon dung thang thuong.
--  4. Ngay duong 29/2: nam khong nhuan dung 28/2.

create table public.lunar_months (
  start_date date primary key,                         -- ngay duong cua mung 1
  lunar_year smallint not null,
  lunar_month smallint not null check (lunar_month between 1 and 12),
  is_leap boolean not null default false,
  days smallint not null check (days in (29, 30)),
  unique (lunar_year, lunar_month, is_leap)
);
alter table public.lunar_months enable row level security;
create policy lunar_months_select on public.lunar_months for select to authenticated using (true);
revoke all on public.lunar_months from anon, authenticated;
grant select on public.lunar_months to authenticated;

-- ---------- Ham noi bo (khong cap cho nguoi dung) ----------
-- Ngay duong -> ngay am. Khong co dong -> khong tra ve gi.
create or replace function public._lunar_of(p_date date)
returns table (lunar_year int, lunar_month int, lunar_day int, is_leap boolean)
language sql stable set search_path = public as $$
  select m.lunar_year::int, m.lunar_month::int, (p_date - m.start_date + 1)::int, m.is_leap
  from public.lunar_months m
  where m.start_date <= p_date and p_date < m.start_date + m.days
  order by m.start_date desc limit 1;
$$;

-- Ngay am -> ngay duong; NULL neu khong ton tai (thang nhuan vang mat, ngay 30 cua thang thieu...).
create or replace function public._lunar_to_solar(p_year int, p_month int, p_day int, p_leap boolean)
returns date
language sql stable set search_path = public as $$
  select m.start_date + (p_day - 1)
  from public.lunar_months m
  where m.lunar_year = p_year and m.lunar_month = p_month and m.is_leap = coalesce(p_leap, false)
    and p_day between 1 and m.days;
$$;

-- Ngay duong cua dip lap trong nam am p_year, ap dung quy tac 1-3 o dau file. NULL neu ngoai du lieu.
create or replace function public._lunar_recur_date(p_year int, p_month int, p_day int, p_leap boolean)
returns date
language plpgsql stable set search_path = public as $$
declare v_leap boolean := coalesce(p_leap, false); v_days int; v_start date;
begin
  if p_month is null or p_day is null or p_month not between 1 and 12 or p_day not between 1 and 30 then
    return null;
  end if;
  select m.start_date, m.days into v_start, v_days from public.lunar_months m
    where m.lunar_year = p_year and m.lunar_month = p_month and m.is_leap = v_leap;
  if not found and v_leap then
    v_leap := false;   -- quy tac 2: khong co thang nhuan nay -> thang thuong cung so
    select m.start_date, m.days into v_start, v_days from public.lunar_months m
      where m.lunar_year = p_year and m.lunar_month = p_month and m.is_leap = false;
  end if;
  if v_start is null then return null; end if;
  return v_start + (least(p_day, v_days) - 1);
end $$;

-- Ngay p_date co phai la dip lap am lich (thang, ngay, nhuan) cua nam am chua p_date khong?
create or replace function public._lunar_occurs_on(p_date date, p_month int, p_day int, p_leap boolean)
returns boolean
language plpgsql stable set search_path = public as $$
declare l record;
begin
  select * into l from public._lunar_of(p_date);
  if not found then return false; end if;
  return coalesce(public._lunar_recur_date(l.lunar_year, p_month, p_day, p_leap) = p_date, false);
end $$;

-- Ngay duong lap hang nam (thang, ngay); 29/2 nam khong nhuan roi vao 28/2.
create or replace function public._solar_md_occurs_on(p_date date, p_month int, p_day int)
returns boolean
language sql immutable set search_path = public as $$
  select case
    when p_month is null or p_day is null then false
    when extract(month from p_date)::int = p_month and extract(day from p_date)::int = p_day then true
    when p_month = 2 and p_day = 29 and extract(month from p_date)::int = 2 and extract(day from p_date)::int = 28
         and not (extract(year from p_date)::int % 4 = 0
                  and (extract(year from p_date)::int % 100 <> 0 or extract(year from p_date)::int % 400 = 0)) then true
    else false
  end;
$$;

-- make_date khong gay loi: ngay khong hop le -> NULL (du lieu nguoi dung nhap co the la 31/2)
create or replace function public._safe_make_date(p_year int, p_month int, p_day int)
returns date
language plpgsql immutable set search_path = public as $$
begin
  if p_year is null or p_month is null or p_day is null then return null; end if;
  return make_date(p_year, p_month, p_day);
exception when others then
  return null;
end $$;

-- Khong cap quyen cho authenticated/anon: chi goi duoc tu ham security definer cua module.
