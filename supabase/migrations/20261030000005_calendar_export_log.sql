-- Su kien / Lich / migration 5: ghi nhat ky khi nguoi dung tai tep lich (.ics) -- "xuat du lieu" la thao tac nhay cam.
-- Chi ghi nhat ky; viec tao noi dung .ics do may chu web lam bang quyen cua chinh nguoi dung (RLS).
create or replace function public.log_calendar_export(p_family uuid, p_scope text default 'all', p_count int default 0)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_family_member(p_family) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not coalesce(public.has_permission(p_family, 'events', 'view'), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_scope is null or p_scope not in ('all', 'events', 'birthdays') then
    raise exception 'invalid scope' using errcode = '22023';
  end if;
  perform public.write_audit(p_family, 'calendar.export', 'calendar', p_family::text, null,
    jsonb_build_object('scope', p_scope, 'count', greatest(0, least(coalesce(p_count, 0), 100000))));
end $$;

grant execute on function public.log_calendar_export(uuid, text, int) to authenticated;
