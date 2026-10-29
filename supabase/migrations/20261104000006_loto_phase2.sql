-- Module G / Dot 2 lo to truyen thong: cau hinh am thanh (nhac nen + tan suat cau ho vui + cau ho rieng),
-- va trinh sua 63 bang tinh o khu vuc quan tri (luu lich su, khoi phuc duoc).
-- Sua bang chi anh huong cac van SAU: bang nguoi choi da chon duoc chup (snapshot) vao loto_cards tu dot 1.

-- ---------- 1. Cau hinh am thanh lo to trong game_settings ----------
alter table public.game_settings add column if not exists loto_music_url text
  check (loto_music_url is null or (char_length(loto_music_url) <= 500 and loto_music_url ~ '^https?://'));
alter table public.game_settings add column if not exists loto_chatter int not null default 60
  check (loto_chatter between 0 and 100);
alter table public.game_settings add column if not exists loto_extra_lines jsonb not null default '[]'::jsonb;

create or replace function public.games_set_loto_audio(
  p_family uuid, p_music_url text, p_chatter int, p_extra_lines jsonb default '[]'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare v_before jsonb; v_url text;
begin
  perform public._games_require_admin(p_family);
  if p_chatter is null or p_chatter < 0 or p_chatter > 100 then
    raise exception 'bad_chatter' using errcode = '22023';
  end if;
  v_url := nullif(btrim(coalesce(p_music_url, '')), '');
  if v_url is not null and (char_length(v_url) > 500 or v_url !~ '^https?://') then
    raise exception 'bad_music_url' using errcode = '22023';
  end if;
  if p_extra_lines is null or jsonb_typeof(p_extra_lines) <> 'array' or jsonb_array_length(p_extra_lines) > 30 then
    raise exception 'bad_extra_lines' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_extra_lines) e
              where jsonb_typeof(e) <> 'string' or char_length(e #>> '{}') > 200) then
    raise exception 'bad_extra_lines' using errcode = '22023';
  end if;
  select to_jsonb(s) - 'updated_by' - 'updated_at' into v_before from public.game_settings s where s.family_id = p_family;
  if v_before is null then
    insert into public.game_settings (family_id) values (p_family);
    select to_jsonb(s) - 'updated_by' - 'updated_at' into v_before from public.game_settings s where s.family_id = p_family;
  end if;
  update public.game_settings
     set loto_music_url = v_url, loto_chatter = p_chatter, loto_extra_lines = p_extra_lines, updated_by = auth.uid()
   where family_id = p_family;
  perform public.write_audit(p_family, 'games.loto_audio', 'game_settings', p_family::text, v_before,
    (select to_jsonb(s) - 'updated_by' - 'updated_at' from public.game_settings s where s.family_id = p_family));
end $$;

-- ---------- 2. Sua bang tinh (admin): luu kem lich su, khoi phuc qua lai ----------
create or replace function public.loto_board_update(p_family uuid, p_code text, p_grid smallint[]) returns void
language plpgsql security definer set search_path = public as $$
declare b public.loto_boards;
begin
  perform public._games_require_admin(p_family);
  select * into b from public.loto_boards where code = p_code;
  if not found then raise exception 'board_not_found' using errcode = 'P0002'; end if;
  if p_grid is null or not public.loto_card_is_valid(p_grid) then
    raise exception 'invalid_grid' using errcode = '22023';
  end if;
  insert into public.loto_board_history (code, grid, replaced_by) values (p_code, b.grid, auth.uid());
  update public.loto_boards set grid = p_grid, updated_by = auth.uid(), updated_at = now() where code = p_code;
  perform public.write_audit(p_family, 'loto.board_update', 'loto_board', p_code, null,
    jsonb_build_object('code', p_code));
end $$;

create or replace function public.loto_board_restore(p_family uuid, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare b public.loto_boards; h public.loto_board_history;
begin
  perform public._games_require_admin(p_family);
  select * into b from public.loto_boards where code = p_code;
  if not found then raise exception 'board_not_found' using errcode = 'P0002'; end if;
  select * into h from public.loto_board_history where code = p_code order by replaced_at desc, id desc limit 1;
  if not found then raise exception 'no_history' using errcode = 'P0001'; end if;
  -- Doi cho: bang hien tai vao lich su, ban lich su moi nhat len bang (khoi phuc lai duoc)
  insert into public.loto_board_history (code, grid, replaced_by) values (p_code, b.grid, auth.uid());
  delete from public.loto_board_history where id = h.id;
  update public.loto_boards set grid = h.grid, updated_by = auth.uid(), updated_at = now() where code = p_code;
  perform public.write_audit(p_family, 'loto.board_restore', 'loto_board', p_code, null,
    jsonb_build_object('code', p_code));
end $$;

-- Sinh mot bo so moi hop le cho trinh sua (nut "Dao bo so moi")
create or replace function public.loto_board_random(p_family uuid) returns smallint[]
language plpgsql security definer set search_path = public as $$
begin
  perform public._games_require_admin(p_family);
  return public._loto_generate_card();
end $$;

grant execute on function
  public.games_set_loto_audio(uuid, text, int, jsonb),
  public.loto_board_update(uuid, text, smallint[]),
  public.loto_board_restore(uuid, text),
  public.loto_board_random(uuid)
  to authenticated;

-- Trang quan tri can dem so ban lich su cua moi bang (luoi bang khong phai bi mat:
-- bang tinh von cong khai voi thanh vien). Cho thanh vien dang hoat dong doc lich su.
create policy loto_board_history_select on public.loto_board_history for select to authenticated
  using (exists (select 1 from public.family_memberships m where m.user_id = auth.uid() and m.status = 'active'));
grant select on public.loto_board_history to authenticated;
