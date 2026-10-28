-- Module Media / migration 8: danh sach don dep media (chi service_role; goi tu /api/cron/media-cleanup).
-- Hang cho don:
--  (a) pending qua p_pending_hours gio (tai len do dang, khong bao gio finalize);
--  (b) pending da huy qua 1 gio;
--  (c) da xoa mem qua p_deleted_days ngay (giu vai ngay phong khoi phuc/khieu nai);
--  (d) READY nhung CHUA duoc gan vao dau (album / bai viet / bia / avatar) qua p_pending_hours gio:
--      nguoi dung chon anh roi bo do khong dang bai -> khong de an dung luong mien phi.
create or replace function public.media_cleanup_list(
  p_pending_hours int default 24, p_deleted_days int default 3, p_limit int default 200
) returns table (id uuid, bucket text, path text, thumb_path text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  select m.id, m.bucket, m.path, m.thumb_path from public.media_items m
  where m.purged_at is null and (
       (m.status = 'pending' and m.deleted_at is null and m.created_at < now() - make_interval(hours => p_pending_hours))
    or (m.status = 'pending' and m.deleted_at is not null and m.deleted_at < now() - interval '1 hour')
    or (m.status = 'ready' and m.deleted_at is not null and m.deleted_at < now() - make_interval(days => p_deleted_days))
    or (m.status = 'ready' and m.deleted_at is null and m.created_at < now() - make_interval(hours => p_pending_hours)
        and not (case m.kind
          when 'album'  then exists (select 1 from public.album_items ai where ai.media_id = m.id and ai.deleted_at is null)
          when 'post'   then exists (select 1 from public.post_media pm where pm.media_id = m.id)
          when 'cover'  then exists (select 1 from public.families f where f.cover_path = m.path)
          when 'avatar' then exists (select 1 from public.family_members fm where fm.avatar_path = m.path)
          else true end)))
  order by m.created_at
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
end $$;

grant execute on function
  public.media_cleanup_list(int, int, int), public.media_cleanup_finish(uuid[], int, int)
  to service_role;
