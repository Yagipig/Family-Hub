-- Loai xu hien thi thay cho "diem" trong tro choi (quan tri chon cho ca gia dinh).
-- Diem trong CSDL giu nguyen gia tri; day chi la ten goi + bieu tuong hien thi.
-- Chay file nay trong Supabase SQL Editor cua project Family Hub.

alter table public.game_settings
  add column if not exists coin_unit text not null default 'diem',
  add column if not exists coin_custom_name text,
  add column if not exists coin_custom_icon text;

alter table public.game_settings
  drop constraint if exists game_settings_coin_unit_check,
  drop constraint if exists game_settings_coin_custom_name_check,
  drop constraint if exists game_settings_coin_custom_icon_check;

alter table public.game_settings
  add constraint game_settings_coin_unit_check check (
    coin_unit in ('diem', 'heo-vang', 'la', 'cu', 'sao', 'hoa-dao', 'hat-de', 'keo', 'xu-bac', 'ca-chep', 'trang', 'custom')
  ),
  add constraint game_settings_coin_custom_name_check check (
    coin_custom_name is null or char_length(coin_custom_name) between 1 and 30
  ),
  add constraint game_settings_coin_custom_icon_check check (
    coin_custom_icon is null or char_length(coin_custom_icon) between 1 and 8
  );

create or replace function public.games_set_coin(
  p_family uuid, p_unit text, p_name text, p_icon text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_before jsonb;
begin
  perform public._games_require_admin(p_family);
  if p_unit not in ('diem', 'heo-vang', 'la', 'cu', 'sao', 'hoa-dao', 'hat-de', 'keo', 'xu-bac', 'ca-chep', 'trang', 'custom') then
    raise exception 'bad_coin_unit' using errcode = '22023';
  end if;
  if p_unit = 'custom' and coalesce(char_length(btrim(coalesce(p_name, ''))), 0) not between 1 and 30 then
    raise exception 'bad_coin_name' using errcode = '22023';
  end if;
  select to_jsonb(s) - 'updated_by' - 'updated_at' into v_before from public.game_settings s where s.family_id = p_family;
  if v_before is null then
    insert into public.game_settings (family_id) values (p_family);
    select to_jsonb(s) - 'updated_by' - 'updated_at' into v_before from public.game_settings s where s.family_id = p_family;
  end if;
  update public.game_settings set
    coin_unit = p_unit,
    coin_custom_name = case when p_unit = 'custom' then btrim(p_name) else null end,
    coin_custom_icon = case when p_unit = 'custom' then nullif(btrim(coalesce(p_icon, '')), '') else null end,
    updated_by = auth.uid()
    where family_id = p_family;
  perform public.write_audit(p_family, 'games.coin', 'game_settings', p_family::text, v_before,
    (select to_jsonb(s) - 'updated_by' - 'updated_at' from public.game_settings s where s.family_id = p_family));
end $$;
