-- Dot 6: yeu cau ve du lieu ca nhan (xuat / sua / han che / xoa) + nhat ky xuat du lieu cua chinh minh

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('export','correct','restrict','delete')),
  note text check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending','in_progress','done','rejected','cancelled')),
  handled_by uuid references auth.users(id),
  handled_at timestamptz,
  handler_note text check (char_length(handler_note) <= 1000),
  created_at timestamptz not null default now(),
  check ((status in ('pending','cancelled')) or handled_by is not null)
);
create index data_requests_family_idx on public.data_requests(family_id, status, created_at desc);
create index data_requests_user_idx on public.data_requests(user_id, created_at desc);

alter table public.data_requests enable row level security;
create policy data_requests_select on public.data_requests for select to authenticated
  using ((user_id = auth.uid() and public.is_family_member(family_id))
         or public.has_permission(family_id, 'data_requests', 'view'));
revoke all on public.data_requests from anon, authenticated;
grant select on public.data_requests to authenticated;

create or replace function public.submit_data_request(p_family uuid, p_kind text, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; a record;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_family_member(p_family) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_kind not in ('export','correct','restrict','delete') then raise exception 'bad kind' using errcode = '22023'; end if;
  if (select count(*) from public.data_requests r
        where r.user_id = auth.uid() and r.family_id = p_family and r.status in ('pending','in_progress')) >= 5 then
    raise exception 'too many open requests' using errcode = 'P0001';
  end if;
  insert into public.data_requests (family_id, user_id, kind, note) values (p_family, auth.uid(), p_kind, left(p_note, 1000))
    returning id into v_id;
  perform public.write_audit(p_family, 'data_request.submit', 'data_request', v_id::text, null, jsonb_build_object('kind', p_kind));
  for a in select m.user_id from public.family_memberships m
           where m.family_id = p_family and m.status = 'active'
             and public._user_has_permission(m.user_id, p_family, 'data_requests', 'update', null)
  loop
    perform public._notify(p_family, a.user_id, 'system', 'Có yêu cầu về dữ liệu cá nhân', null,
      '/admin/yeu-cau-du-lieu', 'dr:' || v_id::text || ':' || a.user_id::text);
  end loop;
  return v_id;
end $$;

create or replace function public.cancel_data_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.data_requests set status = 'cancelled'
    where id = p_id and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
end $$;

create or replace function public.handle_data_request(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.data_requests;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_status not in ('in_progress','done','rejected') then raise exception 'bad status' using errcode = '22023'; end if;
  select * into r from public.data_requests where id = p_id for update;
  if not found or r.status in ('done','rejected','cancelled') then raise exception 'not found' using errcode = 'P0002'; end if;
  if not public.has_permission(r.family_id, 'data_requests', 'update') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.data_requests set status = p_status, handled_by = auth.uid(), handled_at = now(), handler_note = left(p_note, 1000)
    where id = p_id;
  perform public.write_audit(r.family_id, 'data_request.' || p_status, 'data_request', p_id::text,
    jsonb_build_object('status', r.status), jsonb_build_object('status', p_status, 'kind', r.kind));
  perform public._notify(r.family_id, r.user_id, 'system',
    case p_status when 'in_progress' then 'Yêu cầu dữ liệu cá nhân đang được xử lý'
                  when 'done' then 'Yêu cầu dữ liệu cá nhân đã xử lý xong'
                  else 'Yêu cầu dữ liệu cá nhân bị từ chối' end,
    left(p_note, 300), '/cai-dat/du-lieu-ca-nhan', 'drs:' || p_id::text || ':' || p_status);
end $$;

-- Ghi nhat ky khi nguoi dung tu tai ve du lieu cua minh (viec tai xuong do route may chu thuc hien bang quyen nguoi dung)
create or replace function public.log_my_data_export(p_family uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_family_member(p_family) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform public.write_audit(p_family, 'personal_data.export', 'user', auth.uid()::text, null, null);
end $$;

grant execute on function public.submit_data_request(uuid, text, text), public.cancel_data_request(uuid),
  public.handle_data_request(uuid, text, text), public.log_my_data_export(uuid) to authenticated;
