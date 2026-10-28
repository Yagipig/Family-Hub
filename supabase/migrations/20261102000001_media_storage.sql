-- Module Media / migration 1: quyen 'posts', bucket rieng tu, bang media_items, han muc dung luong,
-- ham dang ky upload (begin -> finalize), don dep "mo coi".
-- Nguyen tac: moi tep deu co mot dong media_items; chi tai len duoc vao duong dan ma CSDL da cap (xem file 07).

-- ---------- Quyen module 'posts' (bang tin + album anh) ----------
insert into public.permissions (module, action)
select 'posts', a from unnest(array['view','create','update','delete','approve','export']) a
on conflict do nothing;

-- family_admin: tat ca; branch_admin: kiem duyet theo nhanh (view/create/delete/approve);
-- member: xem + dang; guest: chi xem
insert into public.role_permissions (role_key, module, action)
select 'family_admin', 'posts', action from public.permissions where module = 'posts'
on conflict do nothing;
insert into public.role_permissions (role_key, module, action) values
  ('branch_admin','posts','view'), ('branch_admin','posts','create'),
  ('branch_admin','posts','delete'), ('branch_admin','posts','approve'),
  ('member','posts','view'), ('member','posts','create'),
  ('guest','posts','view')
on conflict do nothing;

-- ---------- Bucket PRIVATE: khong bao gio public ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',      'avatars',      false, 8388608, array['image/jpeg','image/png','image/webp']),
  ('family-media', 'family-media', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ---------- Han muc dung luong theo gia dinh (goi mien phi Supabase: 1 GB) ----------
create table public.family_media_settings (
  family_id uuid primary key references public.families(id) on delete cascade,
  quota_bytes bigint not null default 838860800            -- 800 MB
    check (quota_bytes between 52428800 and 107374182400),
  updated_at timestamptz not null default now()
);
create trigger family_media_settings_updated before update on public.family_media_settings
  for each row execute function public.set_updated_at();
alter table public.family_media_settings enable row level security;
-- Khong cap quyen truc tiep: doc/ghi qua family_media_usage / set_media_quota

create or replace function public._media_quota(p_family uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select s.quota_bytes from public.family_media_settings s where s.family_id = p_family), 838860800::bigint);
$$;

-- ---------- Bang media_items ----------
create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  uploader uuid not null references auth.users(id),
  kind text not null check (kind in ('avatar','cover','album','post')),
  member_id uuid references public.family_members(id),      -- ho so dich (avatar / album)
  bucket text not null check (bucket in ('avatars','family-media')),
  path text not null unique check (char_length(path) <= 300),
  thumb_path text unique check (thumb_path is null or char_length(thumb_path) <= 300),
  mime text not null check (mime in ('image/jpeg','image/png','image/webp')),   -- KHONG svg
  bytes bigint not null check (bytes > 0 and bytes <= 8388608),                 -- toi da 8 MB
  thumb_bytes int not null default 0 check (thumb_bytes between 0 and 1048576),
  width int check (width between 1 and 20000),
  height int check (height between 1 and 20000),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending','ready')),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  purged_at timestamptz,                                     -- da xoa that tep khoi Storage
  -- bucket phai khop loai; duong dan phai bat dau bang <family_id>/<loai>/
  check (bucket = case when kind = 'avatar' then 'avatars' else 'family-media' end),
  check (path like family_id::text || '/' || kind || '/%'),
  check (thumb_path is null or thumb_path like family_id::text || '/' || kind || '/%'),
  check ((kind in ('avatar','album')) = (member_id is not null)),
  check ((status = 'ready') = (ready_at is not null))
);
create index media_items_family_idx on public.media_items(family_id, created_at desc);
create index media_items_pending_idx on public.media_items(created_at) where status = 'pending' and purged_at is null;
create index media_items_deleted_idx on public.media_items(deleted_at) where deleted_at is not null and purged_at is null;
create index media_items_uploader_idx on public.media_items(uploader, created_at desc);
alter table public.media_items enable row level security;

-- ---------- Ham kiem tra quyen tai len theo loai ----------
-- Chu ho so (tai khoan gan member_id) luon duoc them anh vao album cua minh, KHONG bi khoa chinh sua
-- (day la noi dung ca nhan). Nguoi khac: neu ho so co tai khoan -> chi admin; neu chua co tai khoan / da mat ->
-- admin, hoac thanh vien khi che do chinh sua dang MO (giong quy tac sua ho so).
create or replace function public.can_add_to_album(p_member uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare m public.family_members; v_role text;
begin
  if auth.uid() is null then return false; end if;
  select * into m from public.family_members where id = p_member and deleted_at is null;
  if not found then return false; end if;
  v_role := public.my_role(m.family_id);
  if v_role is null or v_role = 'guest' then return false; end if;
  if coalesce(public.my_member_id(m.family_id) = m.id, false) then return true; end if;
  if not coalesce(public.has_permission(m.family_id, 'posts', 'create', m.branch_id), false) then return false; end if;
  if exists (select 1 from public.family_memberships fm where fm.member_id = m.id and fm.status = 'active') then
    return coalesce(public.has_permission(m.family_id, 'members', 'update', m.branch_id), false);
  end if;
  return coalesce(public.can_edit_members(m.family_id, m.branch_id), false);
end $$;

create or replace function public._can_upload_kind(p_family uuid, p_kind text, p_member uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare m public.family_members;
begin
  if auth.uid() is null or not public.is_family_member(p_family) then return false; end if;
  if public.my_role(p_family) = 'guest' then return false; end if;
  if p_kind = 'post' then
    return p_member is null and coalesce(public.has_permission(p_family, 'posts', 'create'), false);
  elsif p_kind = 'cover' then
    return p_member is null and coalesce(public.has_permission(p_family, 'family', 'update'), false);
  elsif p_kind in ('avatar','album') then
    select * into m from public.family_members where id = p_member and family_id = p_family and deleted_at is null;
    if not found then return false; end if;
    if p_kind = 'avatar' then
      return coalesce(public.can_edit_member(m.family_id, m.branch_id, m.id), false);
    end if;
    return public.can_add_to_album(m.id);
  end if;
  return false;
end $$;

-- ---------- Dang ky upload: cap duong dan + giu cho dung luong ----------
create or replace function public.begin_media_upload(
  p_family uuid, p_kind text, p_member uuid, p_mime text, p_bytes bigint, p_thumb_bytes int,
  p_width int, p_height int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := gen_random_uuid(); v_ext text; v_dir text; v_bucket text; v_path text; v_thumb text;
  v_used bigint; v_recent int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_kind not in ('avatar','cover','album','post') then raise exception 'bad kind' using errcode = '22023'; end if;
  if p_mime not in ('image/jpeg','image/png','image/webp') then
    raise exception 'unsupported mime type' using errcode = '22023';
  end if;
  if p_bytes is null or p_bytes <= 0 or p_bytes > 8388608 then
    raise exception 'file too large (max 8 MB)' using errcode = '22023';
  end if;
  if p_thumb_bytes is null or p_thumb_bytes < 0 or p_thumb_bytes > 1048576 then
    raise exception 'thumbnail too large' using errcode = '22023';
  end if;
  if p_width is null or p_height is null or p_width < 1 or p_height < 1 or p_width > 20000 or p_height > 20000 then
    raise exception 'bad dimensions' using errcode = '22023';
  end if;
  if not public._can_upload_kind(p_family, p_kind, p_member) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Chong ngap: toi da 300 tep / gio / nguoi
  select count(*) into v_recent from public.media_items
    where uploader = auth.uid() and created_at > now() - interval '1 hour';
  if v_recent >= 300 then raise exception 'too many uploads, try later' using errcode = 'P0001'; end if;

  -- Han muc: khoa theo gia dinh de hai upload dong thoi khong cung vuot
  perform pg_advisory_xact_lock(hashtext('media-quota:' || p_family::text));
  select coalesce(sum(bytes + thumb_bytes), 0) into v_used from public.media_items
    where family_id = p_family and purged_at is null;
  if v_used + p_bytes + p_thumb_bytes > public._media_quota(p_family) then
    raise exception 'media quota exceeded' using errcode = 'P0001';
  end if;

  v_ext := case p_mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'webp' end;
  v_bucket := case when p_kind = 'avatar' then 'avatars' else 'family-media' end;
  v_dir := p_family::text || '/' || p_kind || '/' || case when p_member is not null then p_member::text || '/' else '' end;
  v_path := v_dir || v_id::text || '.' || v_ext;
  v_thumb := case when p_thumb_bytes > 0 then v_dir || v_id::text || '_t.' || v_ext end;

  insert into public.media_items (id, family_id, uploader, kind, member_id, bucket, path, thumb_path, mime, bytes,
                                  thumb_bytes, width, height)
  values (v_id, p_family, auth.uid(), p_kind, p_member, v_bucket, v_path, v_thumb, p_mime, p_bytes,
          p_thumb_bytes, p_width, p_height);
  return jsonb_build_object('id', v_id, 'bucket', v_bucket, 'path', v_path, 'thumb_path', v_thumb);
end $$;

-- Sau khi tai len: kiem tra tep that su ton tai va dung kich thuoc da khai bao, roi danh dau 'ready'
create or replace function public.finalize_media(p_media uuid, p_sha256 text default null) returns void
language plpgsql security definer set search_path = public as $$
declare mi public.media_items; v_size text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into mi from public.media_items where id = p_media for update;
  if not found or mi.uploader <> auth.uid() or mi.status <> 'pending' or mi.deleted_at is not null then
    raise exception 'media not found' using errcode = 'P0002';
  end if;
  if not public.is_family_member(mi.family_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_sha256 is not null and p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'bad checksum' using errcode = '22023';
  end if;

  select to_jsonb(o) -> 'metadata' ->> 'size' into v_size from storage.objects o
    where o.bucket_id = mi.bucket and o.name = mi.path;
  if not found then raise exception 'uploaded file not found' using errcode = 'P0002'; end if;
  -- Dung luong dung de tinh han muc: khong tin so khai bao, doi chieu voi so do Storage ghi nhan
  if v_size is null or v_size::bigint <> mi.bytes then
    raise exception 'uploaded file size mismatch' using errcode = '22023';
  end if;
  if mi.thumb_path is not null then
    select to_jsonb(o) -> 'metadata' ->> 'size' into v_size from storage.objects o
      where o.bucket_id = mi.bucket and o.name = mi.thumb_path;
    if not found then raise exception 'uploaded thumbnail not found' using errcode = 'P0002'; end if;
    if v_size is null or v_size::bigint <> mi.thumb_bytes then
      raise exception 'uploaded thumbnail size mismatch' using errcode = '22023';
    end if;
  end if;

  update public.media_items set status = 'ready', ready_at = now(), sha256 = p_sha256 where id = p_media;
end $$;

-- Huy mot lan tai len dang cho (loi giua chung): tep se duoc don sau
create or replace function public.cancel_media_upload(p_media uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.media_items set deleted_at = now(), deleted_by = auth.uid()
    where id = p_media and uploader = auth.uid() and status = 'pending' and deleted_at is null;
end $$;

-- ---------- Muc dung luong (cho quan tri) ----------
create or replace function public.family_media_usage(p_family uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.has_permission(p_family, 'family', 'update'), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (select jsonb_build_object(
      'used_bytes', coalesce(sum(bytes + thumb_bytes), 0),
      'quota_bytes', public._media_quota(p_family),
      'items', count(*) filter (where status = 'ready' and deleted_at is null),
      'pending', count(*) filter (where status = 'pending' and deleted_at is null),
      'deleted_unpurged', count(*) filter (where deleted_at is not null))
    from public.media_items where family_id = p_family and purged_at is null);
end $$;

create or replace function public.set_media_quota(p_family uuid, p_bytes bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_old bigint := public._media_quota(p_family);
begin
  if public.my_role(p_family) is distinct from 'super_admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_bytes is null or p_bytes < 52428800 or p_bytes > 107374182400 then
    raise exception 'quota out of range' using errcode = '22023';
  end if;
  insert into public.family_media_settings (family_id, quota_bytes) values (p_family, p_bytes)
    on conflict (family_id) do update set quota_bytes = excluded.quota_bytes;
  perform public.write_audit(p_family, 'media.set_quota', 'family', p_family::text,
    jsonb_build_object('quota_bytes', v_old), jsonb_build_object('quota_bytes', p_bytes));
end $$;

-- ---------- Don dep (chi service_role: route /api/cron/media-cleanup) ----------
-- Danh sach can don: media_cleanup_list (dinh nghia o file 08, vi can bang album/bai viet de biet anh nao chua duoc gan).
-- Danh dau da xoa tep (sau khi route da xoa that khoi Storage). Chi tac dong len dong thuc su du dieu kien.
create or replace function public.media_cleanup_finish(
  p_ids uuid[], p_pending_hours int default 24, p_deleted_days int default 3
) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.media_items m set purged_at = now(), deleted_at = coalesce(m.deleted_at, now())
  where m.id = any(p_ids) and m.id in (select c.id from public.media_cleanup_list(p_pending_hours, p_deleted_days, 1000) c);
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.audit_logs (family_id, actor_id, action, entity_type, entity_id, after_data)
    values (null, null, 'media.cleanup', 'media', null, jsonb_build_object('purged', n));
  end if;
  return n;
end $$;

-- ---------- Cap quyen ----------
grant execute on function
  public.can_add_to_album(uuid),
  public.begin_media_upload(uuid, text, uuid, text, bigint, int, int, int),
  public.finalize_media(uuid, text), public.cancel_media_upload(uuid),
  public.family_media_usage(uuid), public.set_media_quota(uuid, bigint)
  to authenticated;
-- (cap quyen service_role cho media_cleanup_list / media_cleanup_finish o file 08)
