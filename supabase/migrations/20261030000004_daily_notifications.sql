-- Su kien / Lich / migration 4: thong bao tu dong hang ngay (sinh nhat, ngay gio, nhac su kien) cho job service_role
--
-- Nguyen tac:
--  * "Hom nay" tinh theo MUI GIO TUNG NGUOI NHAN (user_profiles.timezone; thieu thi mui gio gia dinh). Ngay sinh/ngay gio
--    la ngay lich (khong doi theo mui gio); chi viec "hom nay/ngay mai" moi phu thuoc mui gio nguoi nhan.
--  * Chi gui cho thanh vien dang hoat dong, chi ve ho so ma nguoi nhan THAY DUOC ngay sinh/ngay mat
--    (_can_see_field_for = ban sao cua can_see_field nhan user_id; co test chung minh nhat quan).
--  * Chay lai khong trung: dedupe_key  bday:<member>:<yyyy>:<lead>:<user>, dday:..., evrem:<event>:<ngay>:<lead>:<user>.
--  * Ngay sinh am lich/giong ngay gio: xem quy tac o migration 1 (thang nhuan khong ton tai -> thang thuong; ngay 30 -> 29).
--  * Ngay gio (death_anniversary): neu biet ngay mat AM lich thi theo am lich; neu chi co ngay mat duong day du thi suy ra am;
--    con lai (chi co thang/ngay duong) thi theo duong lich. Dung chung so ngay bao truoc (birthday_lead_days) voi sinh nhat.

-- Ban sao can_see_field cho mot user bat ky (noi bo; KHONG cap cho nguoi dung)
create or replace function public._can_see_field_for(p_user uuid, p_family uuid, p_branch uuid, p_member uuid,
                                                     p_vis text, p_minor boolean)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_role text; v_scope uuid; v_self uuid; v_eff text;
begin
  if p_user is null then return false; end if;
  select m.role_key, m.branch_id, m.member_id into v_role, v_scope, v_self
    from public.family_memberships m
    where m.user_id = p_user and m.family_id = p_family and m.status = 'active';
  if v_role is null then return false; end if;
  if v_self is not null and v_self = p_member then return true; end if;
  if v_role in ('super_admin','family_admin') then return true; end if;
  if v_role = 'branch_admin' and p_branch is not null and v_scope is not null
     and public.branch_in_scope(v_scope, p_branch) then return true; end if;
  v_eff := case when p_minor and p_vis = 'family' then 'branch' else p_vis end;
  if v_eff = 'family' then return true; end if;
  if v_eff = 'branch' then
    return p_branch is not null and v_scope is not null and public.branch_in_scope(v_scope, p_branch);
  end if;
  return false;
end $$;

create or replace function public._lead_phrase(p_lead int) returns text
language sql immutable as $$
  select case when p_lead = 0 then 'Hôm nay là'
              when p_lead = 1 then 'Ngày mai là'
              else 'Còn ' || p_lead::text || ' ngày nữa là' end;
$$;

-- Cac ho so co sinh nhat / ngay gio roi vao ngay p_date (khong xet quyen xem; nguoi goi loc theo nguoi nhan).
create or replace function public._member_hits_on(p_family uuid, p_date date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m record; v_hits jsonb := '[]'::jsonb; v_cur record; v_tmp record;
  s_m int; s_d int; l_m int; l_d int; l_leap boolean; v_date date; v_hit boolean; v_years int; v_ly_death int;
  v_lunar_txt text;
begin
  select * into v_cur from public._lunar_of(p_date);
  v_lunar_txt := case when v_cur.lunar_month is not null
                      then v_cur.lunar_day::text || '/' || v_cur.lunar_month::text
                           || case when v_cur.is_leap then ' nhuận' else '' end end;
  for m in select * from public.family_members where family_id = p_family and deleted_at is null loop
    v_hit := false; v_years := null;
    if not m.is_deceased then
      s_m := m.birth_solar_month; s_d := m.birth_solar_day;
      l_m := m.birth_lunar_month; l_d := m.birth_lunar_day; l_leap := coalesce(m.birth_lunar_leap, false);
      if l_m is null or l_d is null then            -- suy ra am tu duong day du
        v_date := public._safe_make_date(m.birth_solar_year, s_m, s_d);
        if v_date is not null then
          select x.lunar_month, x.lunar_day, x.is_leap into l_m, l_d, l_leap from public._lunar_of(v_date) x;
          l_leap := coalesce(l_leap, false);
        end if;
      end if;
      if (s_m is null or s_d is null) and m.birth_lunar_year is not null and l_m is not null and l_d is not null then
        v_date := public._lunar_to_solar(m.birth_lunar_year, l_m, l_d, l_leap);   -- suy ra duong tu am day du
        if v_date is not null then s_m := extract(month from v_date)::int; s_d := extract(day from v_date)::int; end if;
      end if;
      if m.birthday_mode in ('solar','both') then
        v_hit := v_hit or public._solar_md_occurs_on(p_date, s_m, s_d);
      end if;
      if m.birthday_mode in ('lunar','both') then
        v_hit := v_hit or public._lunar_occurs_on(p_date, l_m, l_d, l_leap);
      end if;
      -- Thieu du lieu cho che do da chon thi dung che do con lai
      if not v_hit and m.birthday_mode = 'lunar' and (l_m is null or l_d is null) then
        v_hit := public._solar_md_occurs_on(p_date, s_m, s_d);
      end if;
      if not v_hit and m.birthday_mode = 'solar' and (s_m is null or s_d is null) then
        v_hit := public._lunar_occurs_on(p_date, l_m, l_d, l_leap);
      end if;
      if v_hit then
        if m.birthday_mode = 'lunar' and m.birth_lunar_year is not null and v_cur.lunar_year is not null then
          v_years := v_cur.lunar_year - m.birth_lunar_year;
        elsif m.birth_solar_year is not null then
          v_years := extract(year from p_date)::int - m.birth_solar_year;
        end if;
        if v_years is not null and v_years <= 0 then v_hit := false; end if;   -- chua toi lan sinh nhat dau tien
      end if;
      if v_hit then
        v_hits := v_hits || jsonb_build_array(jsonb_build_object(
          'member_id', m.id, 'branch_id', m.branch_id, 'name', m.full_name, 'kind', 'birthday',
          'years', v_years, 'vis', m.birth_visibility,
          'minor', public.member_is_minor(m.birth_solar_year, m.birth_solar_month, m.birth_solar_day),
          'solar_md', to_char(p_date, 'DD/MM'), 'lunar', v_lunar_txt));
      end if;
    else
      l_m := m.death_lunar_month; l_d := m.death_lunar_day; l_leap := coalesce(m.death_lunar_leap, false);
      s_m := m.death_solar_month; s_d := m.death_solar_day;
      v_date := public._safe_make_date(m.death_solar_year, s_m, s_d);
      v_ly_death := null;
      if v_date is not null then
        select x.lunar_year into v_ly_death from public._lunar_of(v_date) x;
        if l_m is null or l_d is null then
          select x.lunar_month, x.lunar_day, x.is_leap into l_m, l_d, l_leap from public._lunar_of(v_date) x;
          l_leap := coalesce(l_leap, false);
        end if;
      end if;
      if l_m is not null and l_d is not null then
        v_hit := public._lunar_occurs_on(p_date, l_m, l_d, l_leap);
        if v_hit and v_ly_death is not null and v_cur.lunar_year is not null then
          v_years := v_cur.lunar_year - v_ly_death;
        elsif v_hit and m.death_solar_year is not null then
          v_years := extract(year from p_date)::int - m.death_solar_year;
        end if;
      elsif s_m is not null and s_d is not null then
        v_hit := public._solar_md_occurs_on(p_date, s_m, s_d);
        if v_hit and m.death_solar_year is not null then
          v_years := extract(year from p_date)::int - m.death_solar_year;
        end if;
      end if;
      if v_hit and v_years is not null and v_years <= 0 then v_hit := false; end if;
      if v_hit then
        v_hits := v_hits || jsonb_build_array(jsonb_build_object(
          'member_id', m.id, 'branch_id', m.branch_id, 'name', m.full_name, 'kind', 'death_anniversary',
          'years', v_years, 'vis', m.death_visibility, 'minor', false,
          'solar_md', to_char(p_date, 'DD/MM'), 'lunar', v_lunar_txt));
      end if;
    end if;
  end loop;
  return v_hits;
end $$;

-- ---------- Job hang ngay ----------
create or replace function public.generate_daily_notifications(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  fam record; usr record; v_ev public.events; v_h jsonb;
  v_cache jsonb; v_key text; v_tz text; v_local date; v_target date; v_lead smallint; v_lead_i int;
  v_occ date; v_instant timestamptz; v_user_date date; v_id uuid; v_title text; v_body text;
  v_kind text; v_self boolean; v_name text; v_years int;
  n_fam int := 0; n_users int := 0; n_new int := 0;
begin
  for fam in select f.id, f.timezone from public.families f where f.deleted_at is null loop
    n_fam := n_fam + 1;
    v_cache := '{}'::jsonb;
    for usr in
      select m.user_id, m.member_id,
             coalesce(up.timezone, fam.timezone) as tz,
             coalesce(np.birthdays, true) as p_birthdays,
             coalesce(np.death_anniversaries, true) as p_death,
             coalesce(np.events, true) as p_events,
             coalesce(np.birthday_lead_days, '{0,1,7}'::smallint[]) as leads
      from public.family_memberships m
      left join public.user_profiles up on up.id = m.user_id
      left join public.notification_preferences np on np.user_id = m.user_id and np.family_id = m.family_id
      where m.family_id = fam.id and m.status = 'active'
    loop
      n_users := n_users + 1;
      v_tz := usr.tz;
      if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_tz) then
        v_tz := 'Asia/Ho_Chi_Minh';
      end if;
      v_local := (p_now at time zone v_tz)::date;

      -- Sinh nhat va ngay gio
      if usr.p_birthdays or usr.p_death then
        foreach v_lead in array usr.leads loop
          v_lead_i := v_lead;
          v_target := v_local + v_lead_i;
          v_key := v_target::text;
          if not (v_cache ? v_key) then
            v_cache := v_cache || jsonb_build_object(v_key, public._member_hits_on(fam.id, v_target));
          end if;
          for v_h in select value from jsonb_array_elements(v_cache -> v_key) loop
            v_kind := v_h->>'kind';
            if (v_kind = 'birthday' and not usr.p_birthdays) or (v_kind = 'death_anniversary' and not usr.p_death) then
              continue;
            end if;
            if not public._can_see_field_for(usr.user_id, fam.id, nullif(v_h->>'branch_id','')::uuid,
                 (v_h->>'member_id')::uuid, v_h->>'vis', coalesce((v_h->>'minor')::boolean, false)) then
              continue;
            end if;
            v_self := usr.member_id is not null and usr.member_id = (v_h->>'member_id')::uuid;
            v_name := v_h->>'name';
            v_years := nullif(v_h->>'years','')::int;
            if v_kind = 'birthday' then
              if v_self then
                if v_lead_i <> 0 then continue; end if;
                v_title := 'Chúc mừng sinh nhật, ' || v_name || '!';
              else
                v_title := public._lead_phrase(v_lead_i) || ' sinh nhật ' || v_name;
              end if;
              v_body := coalesce('Tròn ' || v_years::text || ' tuổi. ', '') || 'Dương lịch ' || (v_h->>'solar_md')
                        || coalesce(' · âm lịch ' || (v_h->>'lunar'), '');
              v_id := public._notify(fam.id, usr.user_id, 'birthday', left(v_title, 200), v_body,
                '/lich?ngay=' || v_key,
                'bday:' || (v_h->>'member_id') || ':' || extract(year from v_target)::int::text || ':' || v_lead_i::text
                || ':' || usr.user_id::text);
            else
              if v_self then continue; end if;
              v_title := public._lead_phrase(v_lead_i) || ' ngày giỗ của ' || v_name;
              v_body := coalesce('Giỗ lần thứ ' || v_years::text || '. ', '') || 'Dương lịch ' || (v_h->>'solar_md')
                        || coalesce(' · âm lịch ' || (v_h->>'lunar'), '');
              v_id := public._notify(fam.id, usr.user_id, 'death_anniversary', left(v_title, 200), v_body,
                '/lich?ngay=' || v_key,
                'dday:' || (v_h->>'member_id') || ':' || extract(year from v_target)::int::text || ':' || v_lead_i::text
                || ':' || usr.user_id::text);
            end if;
            if v_id is not null then n_new := n_new + 1; end if;
          end loop;
        end loop;
      end if;

      -- Nhac su kien: hom nay va ngay mai (theo ngay cua nguoi nhan)
      if usr.p_events then
        foreach v_lead in array array[0, 1]::smallint[] loop
          v_lead_i := v_lead;
          v_target := v_local + v_lead_i;
          for v_ev in
            select * from public.events e
            where e.family_id = fam.id and e.deleted_at is null and e.cancelled_at is null
              and (e.recurrence <> 'none'
                   or (e.starts_at >= (v_target - 2)::timestamptz and e.starts_at < (v_target + 3)::timestamptz))
          loop
            if not public._can_view_event_for(usr.user_id, v_ev.family_id, v_ev.branch_id, v_ev.visibility) then
              continue;
            end if;
            for g in -1..1 loop
              v_occ := v_target + g;
              if not public._event_starts_on(v_ev, v_occ) then continue; end if;
              v_instant := public._event_instant(v_ev, v_occ);
              v_user_date := case when v_ev.all_day then v_occ else (v_instant at time zone v_tz)::date end;
              if v_user_date <> v_target then continue; end if;
              if exists (select 1 from public.event_rsvps r
                         where r.event_id = v_ev.id and r.user_id = usr.user_id and r.occurrence = v_occ
                           and r.response = 'no') then
                continue;
              end if;
              v_title := case when v_lead_i = 0 then 'Hôm nay: ' else 'Ngày mai: ' end || left(v_ev.title, 170);
              v_body := case when v_ev.all_day then 'Cả ngày ' || to_char(v_occ, 'DD/MM')
                             else 'Lúc ' || to_char(v_instant at time zone v_tz, 'HH24:MI "ngày" DD/MM') || ' (giờ của bạn)' end
                        || coalesce(' · ' || v_ev.location, '');
              v_id := public._notify(fam.id, usr.user_id, 'event_reminder', left(v_title, 200), left(v_body, 1000),
                '/lich/su-kien/' || v_ev.id::text || '?ngay=' || v_occ::text,
                'evrem:' || v_ev.id::text || ':' || v_occ::text || ':' || v_lead_i::text || ':' || usr.user_id::text);
              if v_id is not null then n_new := n_new + 1; end if;
            end loop;
          end loop;
        end loop;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('families', n_fam, 'users', n_users, 'created', n_new, 'as_of', p_now);
end $$;

-- Chi service_role (route handler cron). Khong cap cho authenticated/anon.
grant execute on function public.generate_daily_notifications(timestamptz) to service_role;
