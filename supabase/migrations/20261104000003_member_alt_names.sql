-- Ten goi khac cho ho so thanh vien (ten huy, ten khai sinh...) - muc 2B.
-- Them cot alt_names vao family_members, dua qua members_view va 2 ham ghi _member_insert/_member_update.
-- Chay trong Supabase SQL Editor cua project Family Hub.

alter table public.family_members
  add column if not exists alt_names text check (char_length(alt_names) <= 160);

create or replace view public.members_view as
select
  m.id, m.family_id, m.branch_id, m.full_name, m.nickname, m.gender,
  case when v.photo_ok then m.avatar_path end as avatar_path,
  m.birth_solar_year,
  case when v.birth_ok then m.birth_solar_month end as birth_solar_month,
  case when v.birth_ok then m.birth_solar_day end as birth_solar_day,
  case when v.birth_ok then m.birth_lunar_year end as birth_lunar_year,
  case when v.birth_ok then m.birth_lunar_month end as birth_lunar_month,
  case when v.birth_ok then m.birth_lunar_day end as birth_lunar_day,
  case when v.birth_ok then m.birth_lunar_leap else false end as birth_lunar_leap,
  m.birthday_mode,
  m.is_deceased,
  case when v.death_ok then m.death_solar_year end as death_solar_year,
  case when v.death_ok then m.death_solar_month end as death_solar_month,
  case when v.death_ok then m.death_solar_day end as death_solar_day,
  case when v.death_ok then m.death_lunar_month end as death_lunar_month,
  case when v.death_ok then m.death_lunar_day end as death_lunar_day,
  case when v.death_ok then m.death_lunar_leap else false end as death_lunar_leap,
  m.hometown, m.generation_title, m.generation_no, m.bio,
  case when v.contact_ok then m.phone end as phone,
  case when v.contact_ok then m.email end as email,
  case when v.edit_ok then m.birth_visibility end as birth_visibility,
  case when v.edit_ok then m.death_visibility end as death_visibility,
  case when v.edit_ok then m.contact_visibility end as contact_visibility,
  case when v.edit_ok then m.photo_visibility end as photo_visibility,
  mi.minor as is_minor,
  (public.my_member_id(m.family_id) = m.id) as is_self,
  v.edit_ok as can_edit,
  m.created_at, m.updated_at, m.alt_names
from public.family_members m
cross join lateral (select public.member_is_minor(m.birth_solar_year, m.birth_solar_month, m.birth_solar_day) as minor) mi
cross join lateral (select
    public.can_see_field(m.family_id, m.branch_id, m.id, m.birth_visibility, mi.minor) as birth_ok,
    public.can_see_field(m.family_id, m.branch_id, m.id, m.death_visibility, false) as death_ok,
    public.can_see_field(m.family_id, m.branch_id, m.id, m.contact_visibility, mi.minor) as contact_ok,
    public.can_see_field(m.family_id, m.branch_id, m.id, m.photo_visibility, mi.minor) as photo_ok,
    public.can_edit_member(m.family_id, m.branch_id, m.id) as edit_ok
  ) v
where m.deleted_at is null and public.has_permission(m.family_id, 'members', 'view');

create or replace function public._member_insert(p_family uuid, p_data jsonb, p_actor uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if nullif(btrim(p_data->>'full_name'), '') is null then
    raise exception 'full_name is required' using errcode = '22023';
  end if;
  perform public._check_branch(p_family, nullif(p_data->>'branch_id','')::uuid);
  insert into public.family_members (family_id, created_by, branch_id, full_name, nickname, alt_names, gender, avatar_path, birth_solar_year, birth_solar_month, birth_solar_day, birth_lunar_year, birth_lunar_month, birth_lunar_day, birth_lunar_leap, birthday_mode, is_deceased, death_solar_year, death_solar_month, death_solar_day, death_lunar_month, death_lunar_day, death_lunar_leap, hometown, generation_title, generation_no, bio, phone, email, birth_visibility, death_visibility, contact_visibility, photo_visibility)
  values (p_family, p_actor,
    nullif(p_data->>'branch_id','')::uuid,
    nullif(btrim(p_data->>'full_name'),''),
    nullif(btrim(p_data->>'nickname'),''),
    nullif(btrim(p_data->>'alt_names'),''),
    nullif(btrim(p_data->>'gender'),''),
    nullif(btrim(p_data->>'avatar_path'),''),
    nullif(p_data->>'birth_solar_year','')::smallint,
    nullif(p_data->>'birth_solar_month','')::smallint,
    nullif(p_data->>'birth_solar_day','')::smallint,
    nullif(p_data->>'birth_lunar_year','')::smallint,
    nullif(p_data->>'birth_lunar_month','')::smallint,
    nullif(p_data->>'birth_lunar_day','')::smallint,
    coalesce((p_data->>'birth_lunar_leap')::boolean, false),
    coalesce(nullif(p_data->>'birthday_mode',''), 'solar'),
    coalesce((p_data->>'is_deceased')::boolean, false),
    nullif(p_data->>'death_solar_year','')::smallint,
    nullif(p_data->>'death_solar_month','')::smallint,
    nullif(p_data->>'death_solar_day','')::smallint,
    nullif(p_data->>'death_lunar_month','')::smallint,
    nullif(p_data->>'death_lunar_day','')::smallint,
    coalesce((p_data->>'death_lunar_leap')::boolean, false),
    nullif(btrim(p_data->>'hometown'),''),
    nullif(btrim(p_data->>'generation_title'),''),
    nullif(p_data->>'generation_no','')::smallint,
    nullif(btrim(p_data->>'bio'),''),
    nullif(btrim(p_data->>'phone'),''),
    nullif(btrim(p_data->>'email'),''),
    coalesce(nullif(p_data->>'birth_visibility',''), 'family'),
    coalesce(nullif(p_data->>'death_visibility',''), 'family'),
    coalesce(nullif(p_data->>'contact_visibility',''), 'branch'),
    coalesce(nullif(p_data->>'photo_visibility',''), 'family'))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public._member_update(p_member uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_family uuid;
begin
  select family_id into v_family from public.family_members where id = p_member and deleted_at is null;
  if v_family is null then raise exception 'member not found' using errcode = 'P0002'; end if;
  if p_data ? 'branch_id' then
    perform public._check_branch(v_family, nullif(p_data->>'branch_id','')::uuid);
  end if;
  update public.family_members set
      branch_id = case when p_data ? 'branch_id' then nullif(p_data->>'branch_id','')::uuid else branch_id end,
      full_name = case when p_data ? 'full_name' then nullif(btrim(p_data->>'full_name'),'') else full_name end,
      nickname = case when p_data ? 'nickname' then nullif(btrim(p_data->>'nickname'),'') else nickname end,
      alt_names = case when p_data ? 'alt_names' then nullif(btrim(p_data->>'alt_names'),'') else alt_names end,
      gender = case when p_data ? 'gender' then nullif(btrim(p_data->>'gender'),'') else gender end,
      avatar_path = case when p_data ? 'avatar_path' then nullif(btrim(p_data->>'avatar_path'),'') else avatar_path end,
      birth_solar_year = case when p_data ? 'birth_solar_year' then nullif(p_data->>'birth_solar_year','')::smallint else birth_solar_year end,
      birth_solar_month = case when p_data ? 'birth_solar_month' then nullif(p_data->>'birth_solar_month','')::smallint else birth_solar_month end,
      birth_solar_day = case when p_data ? 'birth_solar_day' then nullif(p_data->>'birth_solar_day','')::smallint else birth_solar_day end,
      birth_lunar_year = case when p_data ? 'birth_lunar_year' then nullif(p_data->>'birth_lunar_year','')::smallint else birth_lunar_year end,
      birth_lunar_month = case when p_data ? 'birth_lunar_month' then nullif(p_data->>'birth_lunar_month','')::smallint else birth_lunar_month end,
      birth_lunar_day = case when p_data ? 'birth_lunar_day' then nullif(p_data->>'birth_lunar_day','')::smallint else birth_lunar_day end,
      birth_lunar_leap = case when p_data ? 'birth_lunar_leap' then coalesce((p_data->>'birth_lunar_leap')::boolean, false) else birth_lunar_leap end,
      birthday_mode = case when p_data ? 'birthday_mode' then coalesce(nullif(p_data->>'birthday_mode',''), 'solar') else birthday_mode end,
      is_deceased = case when p_data ? 'is_deceased' then coalesce((p_data->>'is_deceased')::boolean, false) else is_deceased end,
      death_solar_year = case when p_data ? 'death_solar_year' then nullif(p_data->>'death_solar_year','')::smallint else death_solar_year end,
      death_solar_month = case when p_data ? 'death_solar_month' then nullif(p_data->>'death_solar_month','')::smallint else death_solar_month end,
      death_solar_day = case when p_data ? 'death_solar_day' then nullif(p_data->>'death_solar_day','')::smallint else death_solar_day end,
      death_lunar_month = case when p_data ? 'death_lunar_month' then nullif(p_data->>'death_lunar_month','')::smallint else death_lunar_month end,
      death_lunar_day = case when p_data ? 'death_lunar_day' then nullif(p_data->>'death_lunar_day','')::smallint else death_lunar_day end,
      death_lunar_leap = case when p_data ? 'death_lunar_leap' then coalesce((p_data->>'death_lunar_leap')::boolean, false) else death_lunar_leap end,
      hometown = case when p_data ? 'hometown' then nullif(btrim(p_data->>'hometown'),'') else hometown end,
      generation_title = case when p_data ? 'generation_title' then nullif(btrim(p_data->>'generation_title'),'') else generation_title end,
      generation_no = case when p_data ? 'generation_no' then nullif(p_data->>'generation_no','')::smallint else generation_no end,
      bio = case when p_data ? 'bio' then nullif(btrim(p_data->>'bio'),'') else bio end,
      phone = case when p_data ? 'phone' then nullif(btrim(p_data->>'phone'),'') else phone end,
      email = case when p_data ? 'email' then nullif(btrim(p_data->>'email'),'') else email end,
      birth_visibility = case when p_data ? 'birth_visibility' then coalesce(nullif(p_data->>'birth_visibility',''), 'family') else birth_visibility end,
      death_visibility = case when p_data ? 'death_visibility' then coalesce(nullif(p_data->>'death_visibility',''), 'family') else death_visibility end,
      contact_visibility = case when p_data ? 'contact_visibility' then coalesce(nullif(p_data->>'contact_visibility',''), 'branch') else contact_visibility end,
      photo_visibility = case when p_data ? 'photo_visibility' then coalesce(nullif(p_data->>'photo_visibility',''), 'family') else photo_visibility end
  where id = p_member;
end $$;
