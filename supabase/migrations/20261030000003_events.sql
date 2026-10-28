-- Su kien / Lich / migration 3: su kien, RSVP, quyen xem/tao/sua, ham nghiep vu, nhat ky, RLS
-- Quyen: module 'events'. Xem: moi vai tro co 'view' (khach chi xem). Tao/sua: quan tri (theo nhanh) qua has_permission;
-- thanh vien thuong tao duoc khi che do chinh sua MO (is_editing_open) trong pham vi nhanh cua minh.
-- Khong ghi truc tiep vao bang: chi qua ham security definer.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,        -- null = toan gia dinh
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 4000),
  location text check (char_length(location) <= 300),
  kind text not null default 'gathering' check (kind in ('gathering','anniversary','memorial','reminder','other')),
  starts_at timestamptz not null check (starts_at >= '1900-02-01' and starts_at < '2101-01-01'),
  ends_at timestamptz,
  all_day boolean not null default false,
  -- Mui gio goc cua su kien (noi to chuc). Ngay lap lai (hang nam) tinh theo mui gio nay.
  timezone text not null default 'Asia/Ho_Chi_Minh' check (char_length(timezone) between 1 and 64),
  visibility text not null default 'family' check (visibility in ('family','branch')),
  recurrence text not null default 'none' check (recurrence in ('none','yearly_solar','yearly_lunar')),
  lunar_month smallint check (lunar_month between 1 and 12),
  lunar_day smallint check (lunar_day between 1 and 30),
  lunar_leap boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancel_reason text check (char_length(cancel_reason) <= 500),
  deleted_at timestamptz,
  check (ends_at is null or ends_at >= starts_at),
  check ((recurrence = 'yearly_lunar') = (lunar_month is not null and lunar_day is not null)),
  check (recurrence = 'yearly_lunar' or lunar_leap = false)
);
create index events_family_start_idx on public.events(family_id, starts_at) where deleted_at is null;
create index events_family_recur_idx on public.events(family_id) where deleted_at is null and recurrence <> 'none';
create trigger events_updated before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  occurrence date not null,                      -- ngay (theo mui gio goc cua su kien) cua lan dien ra
  response text not null check (response in ('yes','no','maybe')),
  guests smallint not null default 0 check (guests between 0 and 20),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id, occurrence)
);
create index event_rsvps_event_idx on public.event_rsvps(event_id, occurrence);
create trigger event_rsvps_updated before update on public.event_rsvps
  for each row execute function public.set_updated_at();

-- ---------- Quyen xem / tao / quan ly ----------
-- Phien ban cho mot user bat ky (noi bo; dung cho job thong bao). KHONG cap cho nguoi dung.
create or replace function public._can_view_event_for(p_user uuid, p_family uuid, p_branch uuid, p_vis text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_role text; v_scope uuid;
begin
  if p_user is null then return false; end if;
  select m.role_key, m.branch_id into v_role, v_scope
    from public.family_memberships m
    where m.user_id = p_user and m.family_id = p_family and m.status = 'active';
  if v_role is null then return false; end if;
  if not coalesce(public._user_has_permission(p_user, p_family, 'events', 'view'), false) then return false; end if;
  if v_role in ('super_admin', 'family_admin') then return true; end if;
  if p_vis = 'family' then return true; end if;
  -- 'branch': can nhanh. Su kien bi mat nhanh (branch_id null) ma van 'branch' => chi quan tri gia dinh thay (an toan).
  if p_branch is null or v_scope is null then return false; end if;
  return public.branch_in_scope(v_scope, p_branch);
end $$;

create or replace function public.can_view_event(p_family uuid, p_branch uuid, p_vis text) returns boolean
language sql stable security definer set search_path = public as $$
  select public._can_view_event_for(auth.uid(), p_family, p_branch, p_vis);
$$;

-- Tao su kien: quan tri (has_permission create, theo nhanh) HOAC thanh vien thuong khi che do chinh sua MO
-- (su kien toan gia dinh: can che do mo cap gia dinh; su kien nhanh: chi nhanh cua minh hoac nhanh con).
create or replace function public.can_create_event(p_family uuid, p_branch uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_scope uuid;
begin
  if auth.uid() is null then return false; end if;
  if coalesce(public.has_permission(p_family, 'events', 'create', p_branch), false) then return true; end if;
  if coalesce(public.my_role(p_family), '') <> 'member' then return false; end if;
  if not coalesce(public.has_permission(p_family, 'events', 'view'), false) then return false; end if;
  if not coalesce(public.is_editing_open(p_family, p_branch), false) then return false; end if;
  if p_branch is null then return true; end if;
  select m.branch_id into v_scope from public.family_memberships m
    where m.user_id = auth.uid() and m.family_id = p_family and m.status = 'active';
  return v_scope is not null and coalesce(public.branch_in_scope(v_scope, p_branch), false);
end $$;

-- Sua/huy: quan tri co quyen 'update' (theo nhanh) hoac nguoi tao khi van con quyen tao (che do mo).
create or replace function public.can_manage_event(p_event uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare e public.events;
begin
  if auth.uid() is null then return false; end if;
  select * into e from public.events where id = p_event and deleted_at is null;
  if not found then return false; end if;
  if coalesce(public.has_permission(e.family_id, 'events', 'update', e.branch_id), false) then return true; end if;
  return e.created_by is not null and e.created_by = auth.uid()
         and coalesce(public.can_create_event(e.family_id, e.branch_id), false);
end $$;

-- ---------- Tinh ngay dien ra (dung chung cho RSVP va nhac nho) ----------
create or replace function public._event_starts_on(e public.events, p_date date) returns boolean
language plpgsql stable set search_path = public as $$
declare v_start date := (e.starts_at at time zone e.timezone)::date;
begin
  if p_date < v_start then return false; end if;
  if e.recurrence = 'none' then return p_date = v_start; end if;
  if e.recurrence = 'yearly_solar' then
    return public._solar_md_occurs_on(p_date, extract(month from v_start)::int, extract(day from v_start)::int);
  end if;
  return public._lunar_occurs_on(p_date, e.lunar_month, e.lunar_day, e.lunar_leap);
end $$;

-- Thoi diem bat dau cua lan dien ra vao ngay p_date (theo mui gio goc, giu nguyen gio trong ngay)
create or replace function public._event_instant(e public.events, p_date date) returns timestamptz
language sql stable set search_path = public as $$
  select (p_date + (e.starts_at at time zone e.timezone)::time) at time zone e.timezone;
$$;

-- ---------- Kiem tra va chuan hoa du lieu su kien ----------
create or replace function public._event_clean(p_family uuid, d jsonb) returns public.events
language plpgsql stable security definer set search_path = public as $$
declare r public.events;
begin
  r.family_id := p_family;
  r.title := nullif(btrim(d->>'title'), '');
  if r.title is null or char_length(r.title) > 200 then raise exception 'bad title' using errcode = '22023'; end if;
  r.description := nullif(btrim(d->>'description'), '');
  if char_length(r.description) > 4000 then raise exception 'description too long' using errcode = '22023'; end if;
  r.location := nullif(btrim(d->>'location'), '');
  if char_length(r.location) > 300 then raise exception 'location too long' using errcode = '22023'; end if;
  r.kind := coalesce(nullif(d->>'kind', ''), 'gathering');
  if r.kind not in ('gathering','anniversary','memorial','reminder','other') then
    raise exception 'bad kind' using errcode = '22023';
  end if;
  r.timezone := coalesce(nullif(d->>'timezone', ''),
                         (select f.timezone from public.families f where f.id = p_family), 'Asia/Ho_Chi_Minh');
  if not exists (select 1 from pg_catalog.pg_timezone_names n where n.name = r.timezone) then
    raise exception 'unknown time zone' using errcode = '22023';
  end if;
  if nullif(d->>'starts_at', '') is null then raise exception 'starts_at is required' using errcode = '22023'; end if;
  r.starts_at := (d->>'starts_at')::timestamptz;
  r.ends_at := nullif(d->>'ends_at', '')::timestamptz;
  if r.starts_at < '1900-02-01' or r.starts_at >= '2101-01-01' then
    raise exception 'starts_at out of range' using errcode = '22023';
  end if;
  if r.ends_at is not null and (r.ends_at < r.starts_at or r.ends_at > r.starts_at + interval '31 days') then
    raise exception 'bad ends_at' using errcode = '22023';
  end if;
  r.all_day := coalesce((d->>'all_day')::boolean, false);
  r.branch_id := nullif(d->>'branch_id', '')::uuid;
  perform public._check_branch(p_family, r.branch_id);
  r.visibility := coalesce(nullif(d->>'visibility', ''), 'family');
  if r.visibility not in ('family','branch') or (r.visibility = 'branch' and r.branch_id is null) then
    raise exception 'bad visibility' using errcode = '22023';
  end if;
  r.recurrence := coalesce(nullif(d->>'recurrence', ''), 'none');
  if r.recurrence not in ('none','yearly_solar','yearly_lunar') then
    raise exception 'bad recurrence' using errcode = '22023';
  end if;
  if r.recurrence = 'yearly_lunar' then
    r.lunar_month := nullif(d->>'lunar_month', '')::smallint;
    r.lunar_day := nullif(d->>'lunar_day', '')::smallint;
    r.lunar_leap := coalesce((d->>'lunar_leap')::boolean, false);
    if r.lunar_month is null or r.lunar_day is null or r.lunar_month not between 1 and 12
       or r.lunar_day not between 1 and 30 then
      raise exception 'lunar month/day required' using errcode = '22023';
    end if;
  else
    r.lunar_month := null; r.lunar_day := null; r.lunar_leap := false;
  end if;
  return r;
exception
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
       or numeric_value_out_of_range or invalid_parameter_value then
    raise exception 'invalid event data' using errcode = '22023';
end $$;

-- ---------- Thong bao su kien (noi bo) ----------
create or replace function public._event_notify_audience(p_event public.events, p_kind text, p_title text,
                                                         p_body text, p_dedupe_prefix text, p_only_rsvp boolean)
returns int
language plpgsql security definer set search_path = public as $$
declare u record; n int := 0; v_id uuid;
begin
  for u in
    select m.user_id from public.family_memberships m
    where m.family_id = p_event.family_id and m.status = 'active'
      and m.user_id is distinct from auth.uid()
      and public._can_view_event_for(m.user_id, p_event.family_id, p_event.branch_id, p_event.visibility)
      and (not p_only_rsvp or exists (
             select 1 from public.event_rsvps r
             where r.event_id = p_event.id and r.user_id = m.user_id and r.response in ('yes','maybe')))
  loop
    v_id := public._notify(p_event.family_id, u.user_id, p_kind, p_title, p_body,
                           '/lich/su-kien/' || p_event.id::text, p_dedupe_prefix || ':' || u.user_id::text);
    if v_id is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ---------- Ham nghiep vu ----------
create or replace function public.create_event(p_family uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.events; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_family_member(p_family) then raise exception 'forbidden' using errcode = '42501'; end if;
  r := public._event_clean(p_family, coalesce(p_data, '{}'::jsonb));
  if not public.can_create_event(p_family, r.branch_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  -- Chong spam khi che do chinh sua dang mo: toi da 30 su kien/24 gio cho moi nguoi (quan tri khong bi gioi han)
  if public.my_role(p_family) not in ('super_admin','family_admin','branch_admin')
     and (select count(*) from public.events e where e.created_by = auth.uid() and e.created_at > now() - interval '24 hours') >= 30 then
    raise exception 'too many events created' using errcode = 'P0001';
  end if;
  insert into public.events (family_id, branch_id, title, description, location, kind, starts_at, ends_at, all_day,
                             timezone, visibility, recurrence, lunar_month, lunar_day, lunar_leap, created_by)
  values (p_family, r.branch_id, r.title, r.description, r.location, r.kind, r.starts_at, r.ends_at, r.all_day,
          r.timezone, r.visibility, r.recurrence, r.lunar_month, r.lunar_day, r.lunar_leap, auth.uid())
  returning id into v_id;
  select * into r from public.events where id = v_id;
  perform public.write_audit(p_family, 'event.create', 'event', v_id::text, null, to_jsonb(r));
  -- Bao cho nguoi xem duoc. Su kien mot lan da qua thi khong bao.
  if r.recurrence <> 'none' or r.starts_at >= now() then
    perform public._event_notify_audience(r, 'event', 'Sự kiện mới: ' || left(r.title, 150),
      nullif(coalesce(r.location, ''), ''), 'event:' || v_id::text || ':new', false);
  end if;
  return v_id;
end $$;

create or replace function public.update_event(p_event uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare o public.events; n public.events; v_merged jsonb; v_patch jsonb; v_changed boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into o from public.events where id = p_event and deleted_at is null for update;
  if not found then raise exception 'event not found' using errcode = 'P0002'; end if;
  if not public.can_manage_event(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  if o.cancelled_at is not null then raise exception 'event is cancelled' using errcode = 'P0001'; end if;
  v_patch := coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(p_data, '{}'::jsonb)) as t(k, v)
                       where k in ('title','description','location','kind','starts_at','ends_at','all_day','timezone',
                                   'branch_id','visibility','recurrence','lunar_month','lunar_day','lunar_leap')), '{}'::jsonb);
  v_merged := jsonb_build_object(
      'title', o.title, 'description', o.description, 'location', o.location, 'kind', o.kind,
      'starts_at', o.starts_at, 'ends_at', o.ends_at, 'all_day', o.all_day, 'timezone', o.timezone,
      'branch_id', o.branch_id, 'visibility', o.visibility, 'recurrence', o.recurrence,
      'lunar_month', o.lunar_month, 'lunar_day', o.lunar_day, 'lunar_leap', o.lunar_leap) || v_patch;
  n := public._event_clean(o.family_id, v_merged);
  if n.branch_id is distinct from o.branch_id
     and not (coalesce(public.has_permission(o.family_id, 'events', 'update', n.branch_id), false)
              or coalesce(public.can_create_event(o.family_id, n.branch_id), false)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.events set
    branch_id = n.branch_id, title = n.title, description = n.description, location = n.location, kind = n.kind,
    starts_at = n.starts_at, ends_at = n.ends_at, all_day = n.all_day, timezone = n.timezone,
    visibility = n.visibility, recurrence = n.recurrence, lunar_month = n.lunar_month, lunar_day = n.lunar_day,
    lunar_leap = n.lunar_leap
  where id = p_event;
  select * into n from public.events where id = p_event;
  perform public.write_audit(o.family_id, 'event.update', 'event', p_event::text, to_jsonb(o), to_jsonb(n));
  v_changed := o.starts_at is distinct from n.starts_at or o.ends_at is distinct from n.ends_at
               or o.location is distinct from n.location or o.timezone is distinct from n.timezone
               or o.title is distinct from n.title or o.recurrence is distinct from n.recurrence
               or o.lunar_month is distinct from n.lunar_month or o.lunar_day is distinct from n.lunar_day;
  if v_changed then
    perform public._event_notify_audience(n, 'event', 'Sự kiện đã thay đổi: ' || left(n.title, 150),
      'Vui lòng xem lại thời gian và địa điểm.',
      'event:' || p_event::text || ':upd:' || floor(extract(epoch from now()))::text, true);
  end if;
end $$;

create or replace function public.cancel_event(p_event uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o public.events; n public.events;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into o from public.events where id = p_event and deleted_at is null for update;
  if not found then raise exception 'event not found' using errcode = 'P0002'; end if;
  if not public.can_manage_event(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  if o.cancelled_at is not null then return; end if;
  if char_length(p_reason) > 500 then raise exception 'reason too long' using errcode = '22023'; end if;
  update public.events set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = nullif(btrim(p_reason), '')
    where id = p_event;
  select * into n from public.events where id = p_event;
  perform public.write_audit(o.family_id, 'event.cancel', 'event', p_event::text, to_jsonb(o), to_jsonb(n));
  perform public._event_notify_audience(n, 'event', 'Sự kiện đã huỷ: ' || left(n.title, 150),
    nullif(btrim(p_reason), ''), 'event:' || p_event::text || ':cancel', true);
end $$;

-- Xoa han (xoa mem): chi quan tri co quyen 'delete' (super_admin, family_admin)
create or replace function public.delete_event(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.events;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into o from public.events where id = p_event and deleted_at is null for update;
  if not found then raise exception 'event not found' using errcode = 'P0002'; end if;
  if not coalesce(public.has_permission(o.family_id, 'events', 'delete', o.branch_id), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.events set deleted_at = now() where id = p_event;
  perform public.write_audit(o.family_id, 'event.delete', 'event', p_event::text, to_jsonb(o), null);
end $$;

-- Tra loi tham du. Khach khong duoc RSVP (chi xem). p_occurrence = ngay dien ra theo mui gio goc cua su kien.
create or replace function public.set_rsvp(p_event uuid, p_occurrence date, p_response text,
                                           p_guests int default 0, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into e from public.events where id = p_event and deleted_at is null;
  if not found then raise exception 'event not found' using errcode = 'P0002'; end if;
  if not coalesce(public.is_family_member(e.family_id), false)
     or not public.can_view_event(e.family_id, e.branch_id, e.visibility)
     or coalesce(public.my_role(e.family_id), 'guest') = 'guest' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if e.cancelled_at is not null then raise exception 'event is cancelled' using errcode = 'P0001'; end if;
  if p_response not in ('yes','no','maybe') or p_guests is null or p_guests not between 0 and 20
     or char_length(p_note) > 300 or p_occurrence is null then
    raise exception 'bad rsvp' using errcode = '22023';
  end if;
  -- Chi nhan ngay co dien ra that va chua qua han qua 1 ngay (theo mui gio goc)
  if not public._event_starts_on(e, p_occurrence)
     or p_occurrence < (now() at time zone e.timezone)::date - 1 then
    raise exception 'bad occurrence' using errcode = '22023';
  end if;
  insert into public.event_rsvps (event_id, user_id, family_id, occurrence, response, guests, note)
  values (p_event, auth.uid(), e.family_id, p_occurrence, p_response,
          case when p_response = 'no' then 0 else p_guests end, nullif(btrim(p_note), ''))
  on conflict (event_id, user_id, occurrence) do update
    set response = excluded.response, guests = excluded.guests, note = excluded.note;
end $$;

-- Tong hop tham du (khong lo ten) cho moi nguoi xem duoc su kien
create or replace function public.event_rsvp_counts(p_event uuid, p_occurrence date)
returns table (yes_count int, maybe_count int, no_count int, guests int)
language plpgsql stable security definer set search_path = public as $$
declare e public.events;
begin
  select * into e from public.events where id = p_event and deleted_at is null;
  if not found or not public.can_view_event(e.family_id, e.branch_id, e.visibility) then return; end if;
  return query
    select count(*) filter (where r.response = 'yes')::int,
           count(*) filter (where r.response = 'maybe')::int,
           count(*) filter (where r.response = 'no')::int,
           coalesce(sum(r.guests) filter (where r.response in ('yes','maybe')), 0)::int
    from public.event_rsvps r
    where r.event_id = p_event and r.occurrence = p_occurrence;
end $$;

-- ---------- RLS ----------
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;

create policy events_select on public.events for select to authenticated
  using (deleted_at is null and public.can_view_event(family_id, branch_id, visibility));

-- Nguoi tra loi thay cua chinh minh; nguoi quan ly su kien thay danh sach tham du
create policy event_rsvps_select on public.event_rsvps for select to authenticated
  using ((user_id = auth.uid() and public.is_family_member(family_id)) or public.can_manage_event(event_id));

revoke all on public.events, public.event_rsvps from anon, authenticated;
grant select on public.events, public.event_rsvps to authenticated;

grant execute on function
  public.can_view_event(uuid, uuid, text), public.can_create_event(uuid, uuid), public.can_manage_event(uuid),
  public.create_event(uuid, jsonb), public.update_event(uuid, jsonb), public.cancel_event(uuid, text),
  public.delete_event(uuid), public.set_rsvp(uuid, date, text, int, text), public.event_rsvp_counts(uuid, date)
  to authenticated;
