-- Migration 12: Phong lo to khong co nguoi choi tu dong huy sau 5 phut.
-- loto_cleanup_empty_rooms(): huy (status='cancelled') moi phong dang 'waiting'
-- da tao qua 5 phut ma khong co bat ky the bai nao cua NGUOI THAT (user_id not null).
-- Phong chi co bot cung bi huy (bot khong phai nguoi choi). Phong khong co nguoi
-- thi khong co tien cuoc cua ai -> khong can hoan tien.
-- Goi "co hoi" tu trang sanh lo to moi lan tai trang (kem GamesAutoRefresh lam moi
-- dinh ky) + co gang len lich pg_cron moi 2 phut neu extension da duoc bat san.

create or replace function public.loto_cleanup_empty_rooms() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.loto_rooms r
     set status = 'cancelled', finished_at = now()
   where r.status = 'waiting'
     and r.created_at < now() - interval '5 minutes'
     and not exists (
       select 1 from public.loto_cards c
        where c.room_id = r.id and c.user_id is not null
     );
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.loto_cleanup_empty_rooms() from public, anon;
grant execute on function public.loto_cleanup_empty_rooms() to authenticated;

-- Len lich nen bang pg_cron neu extension da bat (bo qua neu chua co; trang sanh
-- van tu don dep moi lan co nguoi mo).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('loto-cleanup-empty-rooms', '*/2 * * * *',
      'select public.loto_cleanup_empty_rooms()');
  end if;
exception when others then null;
end $$;
