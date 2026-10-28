-- Module Media / migration 7: quyen DOC/GHI tep. Storage chi cho (a) doc khi nguoi xem duoc phep xem noi dung gan voi tep,
-- (b) ghi khi CSDL da cap duong dan do cho dung nguoi (dong media_items 'pending'). Khong co chinh sach UPDATE/DELETE
-- cho nguoi dung: tep chi bi xoa boi job don dep (service_role).

-- Nguoi xem co duoc doc media nay khong? (dung chung cho RLS bang va RLS Storage)
create or replace function public.can_read_media(p_media uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare mi public.media_items;
begin
  if auth.uid() is null then return false; end if;
  select * into mi from public.media_items where id = p_media;
  if not found or mi.purged_at is not null or mi.deleted_at is not null then return false; end if;
  if not public.is_family_member(mi.family_id) then return false; end if;
  if mi.uploader = auth.uid() then return true; end if;    -- nguoi tai len xem duoc ban cua minh (ke ca khi chua gan)
  if mi.status <> 'ready' then return false; end if;
  if mi.kind = 'cover' then
    return exists (select 1 from public.families f where f.id = mi.family_id and f.cover_path = mi.path and f.deleted_at is null);
  elsif mi.kind = 'avatar' then
    -- members_view da che avatar_path theo photo_visibility (tre em: toi da 'nhanh')
    return exists (select 1 from public.members_view mv where mv.id = mi.member_id and mv.avatar_path = mi.path);
  elsif mi.kind = 'album' then
    return exists (select 1 from public.album_items ai where ai.media_id = mi.id and ai.deleted_at is null
                     and public.can_view_album(ai.album_id));
  elsif mi.kind = 'post' then
    return exists (select 1 from public.post_media pm where pm.media_id = mi.id and public.can_view_post(pm.post_id));
  end if;
  return false;
end $$;

create or replace function public.can_read_media_object(p_bucket text, p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or p_bucket is null or p_name is null then return false; end if;
  select m.id into v_id from public.media_items m
    where m.bucket = p_bucket and (m.path = p_name or m.thumb_path = p_name);
  return v_id is not null and public.can_read_media(v_id);
end $$;

-- Duoc phep ghi dung duong dan nay khong? Chi khi co dong 'pending' cua chinh minh, chua huy, gia dinh con hoat dong.
create or replace function public.can_upload_media_object(p_bucket text, p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare mi public.media_items;
begin
  if auth.uid() is null or p_bucket is null or p_name is null then return false; end if;
  select * into mi from public.media_items m
    where m.bucket = p_bucket and (m.path = p_name or m.thumb_path = p_name);
  if not found then return false; end if;
  return mi.uploader = auth.uid() and mi.status = 'pending' and mi.deleted_at is null and mi.purged_at is null
     and split_part(p_name, '/', 1) = mi.family_id::text
     and public.is_family_member(mi.family_id);
end $$;

grant execute on function
  public.can_read_media(uuid), public.can_read_media_object(text, text), public.can_upload_media_object(text, text)
  to authenticated;

-- ---------- RLS bang ----------
create policy media_items_select on public.media_items for select to authenticated
  using (public.can_read_media(id));
create policy media_people_select on public.media_people for select to authenticated
  using (public.can_read_media(media_id));
revoke all on public.media_items from anon, authenticated;
grant select on public.media_items to authenticated;

-- ---------- RLS Storage (bucket private) ----------
-- Don dep chinh sach cu cung ten de chay lai duoc
drop policy if exists family_media_select on storage.objects;
drop policy if exists family_media_insert on storage.objects;

create policy family_media_select on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'family-media') and public.can_read_media_object(bucket_id, name));
create policy family_media_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'family-media') and public.can_upload_media_object(bucket_id, name));
-- Khong co chinh sach UPDATE / DELETE: nguoi dung khong ghi de, khong xoa tep truc tiep; khong co quyen cho anon.
