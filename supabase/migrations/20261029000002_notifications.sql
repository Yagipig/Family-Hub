-- Dot 2 / migration 2: mui gio + quoc gia cua tai khoan, thong bao trong ung dung, tuy chon thong bao

-- ---------- Quoc gia / mui gio cua tung nguoi ----------
alter table public.user_profiles
  add column country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add column timezone text not null default 'Asia/Ho_Chi_Minh';

create or replace function public.guard_profile_timezone() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names n where n.name = new.timezone) then
    raise exception 'unknown time zone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end $$;
create trigger user_profiles_tz_guard before insert or update of timezone on public.user_profiles
  for each row execute function public.guard_profile_timezone();

grant update (country_code, timezone) on public.user_profiles to authenticated;

-- ---------- Thong bao ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('birthday','death_anniversary','event','event_reminder','card','gift',
                                     'chat','change_request','system')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 1000),
  link text check (link is null or (link ~ '^/($|[^/\\])' and char_length(link) <= 300)),   -- chi lien ket noi bo
  dedupe_key text check (char_length(dedupe_key) <= 200),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index notifications_dedupe on public.notifications(user_id, dedupe_key) where dedupe_key is not null;
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_unread_idx on public.notifications(user_id) where read_at is null;

create table public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  birthdays boolean not null default true,
  birthday_lead_days smallint[] not null default '{0,1,7}'
    check (cardinality(birthday_lead_days) <= 6 and birthday_lead_days <@ array[0,1,2,3,5,7,14,30]::smallint[]),
  death_anniversaries boolean not null default true,
  events boolean not null default true,
  cards boolean not null default true,
  gifts boolean not null default true,
  chat boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, family_id)
);
create trigger notification_preferences_updated before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- Tao thong bao (noi bo): ton trong tuy chon; trung dedupe_key thi bo qua. Tra ve id hoac null.
create or replace function public._notify(p_family uuid, p_user uuid, p_kind text, p_title text, p_body text,
                                          p_link text, p_dedupe text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_pref public.notification_preferences;
begin
  if not exists (select 1 from public.family_memberships m
                 where m.user_id = p_user and m.family_id = p_family and m.status = 'active') then
    return null;
  end if;
  select * into v_pref from public.notification_preferences where user_id = p_user and family_id = p_family;
  if found then
    if (p_kind in ('birthday') and not v_pref.birthdays)
       or (p_kind = 'death_anniversary' and not v_pref.death_anniversaries)
       or (p_kind in ('event','event_reminder') and not v_pref.events)
       or (p_kind = 'card' and not v_pref.cards)
       or (p_kind = 'gift' and not v_pref.gifts)
       or (p_kind = 'chat' and not v_pref.chat) then
      return null;
    end if;
  end if;
  insert into public.notifications (family_id, user_id, kind, title, body, link, dedupe_key)
  values (p_family, p_user, p_kind, p_title, p_body, p_link, p_dedupe)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  update public.notifications set read_at = now()
    where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.save_notification_preferences(
  p_family uuid, p_birthdays boolean, p_lead smallint[], p_death boolean, p_events boolean,
  p_cards boolean, p_gifts boolean, p_chat boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_family_member(p_family) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.notification_preferences (user_id, family_id, birthdays, birthday_lead_days, death_anniversaries,
                                               events, cards, gifts, chat)
  values (auth.uid(), p_family, p_birthdays, coalesce(p_lead, '{0,1,7}'), p_death, p_events, p_cards, p_gifts, p_chat)
  on conflict (user_id, family_id) do update set
    birthdays = excluded.birthdays, birthday_lead_days = excluded.birthday_lead_days,
    death_anniversaries = excluded.death_anniversaries, events = excluded.events,
    cards = excluded.cards, gifts = excluded.gifts, chat = excluded.chat;
end $$;

-- Phien ban has_permission cho mot user bat ky (noi bo; dung cho job/trigger, KHONG cap cho nguoi dung)
create or replace function public._user_has_permission(p_user uuid, p_family uuid, p_module text, p_action text, p_branch uuid default null)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_role text; v_scope uuid; v_limited boolean;
begin
  select m.role_key, m.branch_id into v_role, v_scope
    from public.family_memberships m
    where m.user_id = p_user and m.family_id = p_family and m.status = 'active';
  if v_role is null then return false; end if;
  if v_role = 'super_admin' then return true; end if;
  if not exists (select 1 from public.role_permissions rp
                 where rp.role_key = v_role and rp.module = p_module and rp.action = p_action) then
    return false;
  end if;
  select r.scope_limited into v_limited from public.roles r where r.key = v_role;
  if v_limited then
    if p_action = 'view' and p_branch is null then return true; end if;
    if p_branch is null or v_scope is null then return false; end if;
    return public.branch_in_scope(v_scope, p_branch);
  end if;
  return true;
end $$;

-- Thong bao cho quan tri khi co yeu cau sua moi
create or replace function public.notify_change_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  for a in select m.user_id from public.family_memberships m
           where m.family_id = new.family_id and m.status = 'active'
             and public._user_has_permission(m.user_id, new.family_id, 'members', 'approve', new.branch_id)
  loop
    perform public._notify(new.family_id, a.user_id, 'change_request', 'Có yêu cầu chỉnh sửa gia phả mới',
      null, '/admin/yeu-cau', 'cr:' || new.id::text || ':' || a.user_id::text);
  end loop;
  return new;
end $$;

create trigger member_change_requests_notify after insert on public.member_change_requests
  for each row execute function public.notify_change_request();

-- ---------- RLS ----------
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = auth.uid() and public.is_family_member(family_id));
create policy notification_prefs_select_own on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());

revoke all on public.notifications, public.notification_preferences from anon, authenticated;
grant select on public.notifications, public.notification_preferences to authenticated;

grant execute on function public.mark_notifications_read(uuid[]),
  public.save_notification_preferences(uuid, boolean, smallint[], boolean, boolean, boolean, boolean, boolean)
  to authenticated;

-- Bat realtime cho thong bao (RLS van ap dung)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
