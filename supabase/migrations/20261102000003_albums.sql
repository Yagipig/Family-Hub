-- Module Media / migration 3: album anh theo tung thanh vien
-- Quyet dinh da chot:
--  * Chu ho so (tai khoan gan member_id) tao/them/xoa anh trong album cua minh MOI LUC, khong bi khoa chinh sua
--    (noi dung ca nhan).
--  * Ho so chua co tai khoan / da mat: admin, hoac thanh vien khi che do chinh sua MO (giong members).
--  * Ho so da co tai khoan: nguoi khac chi la admin (quyen members.update theo nhanh) moi them duoc.
--  * Admin theo nhanh (posts.delete trong pham vi nhanh cua ho so) duoc go anh vi pham.
--  * Moi thanh vien doc album 'family' cua moi nguoi; 'branch' chi trong pham vi nhanh; 'owner' chi chu ho so + nguoi tao.

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (char_length(description) <= 1000),
  cover_media uuid references public.media_items(id) on delete set null,
  visibility text not null default 'family' check (visibility in ('family','branch','owner')),
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index albums_default_unique on public.albums(member_id) where is_default and deleted_at is null;
create index albums_member_idx on public.albums(member_id) where deleted_at is null;
create index albums_family_idx on public.albums(family_id) where deleted_at is null;
create trigger albums_updated before update on public.albums
  for each row execute function public.set_updated_at();

create table public.album_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  media_id uuid not null references public.media_items(id),
  caption text check (char_length(caption) <= 300),
  taken_on date,
  sort int not null default 0,
  added_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);
create unique index album_items_unique on public.album_items(album_id, media_id) where deleted_at is null;
create index album_items_album_idx on public.album_items(album_id, sort, created_at desc) where deleted_at is null;
create index album_items_media_idx on public.album_items(media_id);

-- Gan the nguoi trong anh (tuy chon)
create table public.media_people (
  media_id uuid not null references public.media_items(id) on delete cascade,
  member_id uuid not null references public.family_members(id),
  family_id uuid not null references public.families(id) on delete cascade,
  tagged_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (media_id, member_id)
);
create index media_people_member_idx on public.media_people(member_id);

alter table public.albums enable row level security;
alter table public.album_items enable row level security;
alter table public.media_people enable row level security;

-- ---------- Ham kiem tra ----------
-- Noi dung nam trong pham vi nhanh cua nguoi xem? (admin gia dinh luon dung; nhanh cha thay nhanh con)
create or replace function public._branch_visible(p_family uuid, p_branch uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_role text; v_scope uuid;
begin
  if auth.uid() is null then return false; end if;
  select m.role_key, m.branch_id into v_role, v_scope from public.family_memberships m
    where m.user_id = auth.uid() and m.family_id = p_family and m.status = 'active';
  if v_role is null then return false; end if;
  if v_role in ('super_admin','family_admin') then return true; end if;
  return coalesce(p_branch is not null and v_scope is not null and public.branch_in_scope(v_scope, p_branch), false);
end $$;

create or replace function public.can_view_album(p_album uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare a public.albums; m public.family_members;
begin
  if auth.uid() is null then return false; end if;
  select * into a from public.albums where id = p_album;
  if not found or a.deleted_at is not null then return false; end if;
  select * into m from public.family_members where id = a.member_id;
  if not found or m.deleted_at is not null then return false; end if;
  if not coalesce(public.has_permission(a.family_id, 'posts', 'view'), false) then return false; end if;
  if coalesce(public.my_member_id(a.family_id) = a.member_id, false) or a.created_by = auth.uid() then return true; end if;
  if a.visibility = 'family' then return true; end if;
  if a.visibility = 'branch' then return public._branch_visible(a.family_id, m.branch_id); end if;
  return false;   -- 'owner'
end $$;

-- Chu album (tai khoan gan voi ho so) hoac nguoi tao
create or replace function public._is_album_owner(p_album uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(public.my_member_id(a.family_id) = a.member_id, false) or a.created_by = auth.uid()
                   from public.albums a where a.id = p_album), false);
$$;

-- Quan tri duoc go noi dung vi pham trong album (theo nhanh cua chu ho so)
create or replace function public._can_moderate_album(p_album uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.has_permission(a.family_id, 'posts', 'delete', m.branch_id)
                   from public.albums a join public.family_members m on m.id = a.member_id
                   where a.id = p_album), false);
$$;

-- ---------- Album ----------
create or replace function public.create_album(p_member uuid, p_title text, p_description text default null,
  p_visibility text default 'family') returns uuid
language plpgsql security definer set search_path = public as $$
declare m public.family_members; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into m from public.family_members where id = p_member and deleted_at is null;
  if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
  if not public.can_add_to_album(p_member) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_visibility not in ('family','branch','owner') then raise exception 'bad visibility' using errcode = '22023'; end if;
  if nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 120 then
    raise exception 'bad title' using errcode = '22023';
  end if;
  if (select count(*) from public.albums where member_id = p_member and deleted_at is null) >= 50 then
    raise exception 'too many albums' using errcode = 'P0001';
  end if;
  insert into public.albums (family_id, member_id, title, description, visibility, created_by)
  values (m.family_id, p_member, btrim(p_title), nullif(btrim(p_description), ''), p_visibility, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Album mac dinh "Anh chung" cua ho so (tao khi can, de tai anh len mot buoc)
create or replace function public.ensure_default_album(p_member uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare m public.family_members; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into m from public.family_members where id = p_member and deleted_at is null;
  if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
  select id into v_id from public.albums where member_id = p_member and is_default and deleted_at is null;
  if v_id is not null then
    if not public.can_view_album(v_id) and not public.can_add_to_album(p_member) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    return v_id;
  end if;
  if not public.can_add_to_album(p_member) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.albums (family_id, member_id, title, is_default, created_by)
  values (m.family_id, p_member, 'Ảnh chung', true, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.update_album(p_album uuid, p_title text, p_description text, p_visibility text,
  p_cover_media uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.albums; m public.family_members;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into a from public.albums where id = p_album and deleted_at is null for update;
  if not found then raise exception 'album not found' using errcode = 'P0002'; end if;
  select * into m from public.family_members where id = a.member_id;
  if not (public._is_album_owner(p_album) or coalesce(public.has_permission(a.family_id, 'members', 'update', m.branch_id), false)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_visibility not in ('family','branch','owner') then raise exception 'bad visibility' using errcode = '22023'; end if;
  if nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 120 then
    raise exception 'bad title' using errcode = '22023';
  end if;
  if p_cover_media is not null and not exists (
       select 1 from public.album_items ai where ai.album_id = p_album and ai.media_id = p_cover_media and ai.deleted_at is null) then
    raise exception 'cover must be an item of the album' using errcode = '22023';
  end if;
  update public.albums set title = btrim(p_title), description = nullif(btrim(p_description), ''),
    visibility = p_visibility, cover_media = p_cover_media where id = p_album;
end $$;

create or replace function public.delete_album(p_album uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.albums; v_actor_owner boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into a from public.albums where id = p_album and deleted_at is null for update;
  if not found then raise exception 'album not found' using errcode = 'P0002'; end if;
  v_actor_owner := public._is_album_owner(p_album);
  if not (v_actor_owner or public._can_moderate_album(p_album)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.albums set deleted_at = now() where id = p_album;
  update public.album_items set deleted_at = now(), deleted_by = auth.uid() where album_id = p_album and deleted_at is null;
  perform public._media_soft_delete(ai.media_id) from public.album_items ai where ai.album_id = p_album
    and not exists (select 1 from public.album_items o where o.media_id = ai.media_id and o.deleted_at is null);
  if not v_actor_owner then
    perform public.write_audit(a.family_id, 'album.delete_moderation', 'album', p_album::text,
      jsonb_build_object('member_id', a.member_id, 'title', a.title), null);
  end if;
end $$;

-- ---------- Anh trong album ----------
create or replace function public.add_album_item(p_album uuid, p_media uuid, p_caption text default null,
  p_taken_on date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.albums; mi public.media_items; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into a from public.albums where id = p_album and deleted_at is null;
  if not found then raise exception 'album not found' using errcode = 'P0002'; end if;
  if not public.can_add_to_album(a.member_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into mi from public.media_items where id = p_media for update;
  if not found or mi.family_id <> a.family_id or mi.kind <> 'album' or mi.member_id <> a.member_id
     or mi.status <> 'ready' or mi.deleted_at is not null or mi.uploader <> auth.uid() then
    raise exception 'invalid media' using errcode = '22023';
  end if;
  if (select count(*) from public.album_items where album_id = p_album and deleted_at is null) >= 2000 then
    raise exception 'album is full' using errcode = 'P0001';
  end if;
  insert into public.album_items (family_id, album_id, media_id, caption, taken_on, added_by)
  values (a.family_id, p_album, p_media, nullif(left(btrim(p_caption), 300), ''), p_taken_on, auth.uid())
  returning id into v_id;
  if a.cover_media is null then update public.albums set cover_media = p_media where id = p_album; end if;
  return v_id;
end $$;

create or replace function public.update_album_item(p_item uuid, p_caption text, p_taken_on date default null,
  p_sort int default null) returns void
language plpgsql security definer set search_path = public as $$
declare ai public.album_items;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into ai from public.album_items where id = p_item and deleted_at is null for update;
  if not found then raise exception 'item not found' using errcode = 'P0002'; end if;
  if not (ai.added_by = auth.uid() or public._is_album_owner(ai.album_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.album_items set caption = nullif(left(btrim(p_caption), 300), ''), taken_on = p_taken_on,
    sort = coalesce(p_sort, sort) where id = p_item;
end $$;

create or replace function public.remove_album_item(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ai public.album_items; a public.albums; v_own boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into ai from public.album_items where id = p_item and deleted_at is null for update;
  if not found then raise exception 'item not found' using errcode = 'P0002'; end if;
  select * into a from public.albums where id = ai.album_id;
  v_own := ai.added_by = auth.uid() or public._is_album_owner(ai.album_id);
  if not (v_own or public._can_moderate_album(ai.album_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.album_items set deleted_at = now(), deleted_by = auth.uid() where id = p_item;
  if not exists (select 1 from public.album_items o where o.media_id = ai.media_id and o.deleted_at is null) then
    perform public._media_soft_delete(ai.media_id);
    update public.albums set cover_media = null where id = ai.album_id and cover_media = ai.media_id;
  end if;
  if not v_own then
    perform public.write_audit(a.family_id, 'album.remove_item_moderation', 'album_item', p_item::text,
      jsonb_build_object('album_id', ai.album_id, 'media_id', ai.media_id, 'member_id', a.member_id), null);
  end if;
end $$;

-- ---------- The nguoi trong anh ----------
create or replace function public._can_manage_media(p_media uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select mi.uploader = auth.uid()
      or exists (select 1 from public.album_items ai where ai.media_id = mi.id and ai.deleted_at is null
                   and public._is_album_owner(ai.album_id))
      or exists (select 1 from public.album_items ai where ai.media_id = mi.id and ai.deleted_at is null
                   and public._can_moderate_album(ai.album_id))
    from public.media_items mi where mi.id = p_media and mi.deleted_at is null), false);
$$;

create or replace function public.tag_media_person(p_media uuid, p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare mi public.media_items;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into mi from public.media_items where id = p_media and status = 'ready' and deleted_at is null;
  if not found or not public.can_read_media(p_media) or not public._can_manage_media(p_media) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.family_members m where m.id = p_member and m.family_id = mi.family_id and m.deleted_at is null) then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.media_people where media_id = p_media) >= 30 then
    raise exception 'too many tags' using errcode = 'P0001';
  end if;
  insert into public.media_people (media_id, member_id, family_id, tagged_by)
  values (p_media, p_member, mi.family_id, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.untag_media_person(p_media uuid, p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public._can_manage_media(p_media) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.media_people where media_id = p_media and member_id = p_member;
end $$;

-- ---------- RLS + view (view chay bang quyen nguoi goi: security_invoker) ----------
create policy albums_select on public.albums for select to authenticated
  using (deleted_at is null and public.can_view_album(id));
create policy album_items_select on public.album_items for select to authenticated
  using (deleted_at is null and public.can_view_album(album_id));
-- (chinh sach doc media_people + media_items nam o file 07, sau khi co can_read_media)

create view public.album_items_v with (security_invoker = true) as
select ai.id, ai.family_id, ai.album_id, ai.media_id, ai.caption, ai.taken_on, ai.sort, ai.added_by, ai.created_at,
       mi.bucket, mi.path, mi.thumb_path, mi.mime, mi.width, mi.height, a.member_id,
       coalesce((select jsonb_agg(mp.member_id) from public.media_people mp where mp.media_id = ai.media_id), '[]'::jsonb) as people
from public.album_items ai
join public.albums a on a.id = ai.album_id
join public.media_items mi on mi.id = ai.media_id
where ai.deleted_at is null and mi.status = 'ready' and mi.deleted_at is null;

create view public.albums_v with (security_invoker = true) as
select a.id, a.family_id, a.member_id, a.title, a.description, a.visibility, a.is_default, a.created_by, a.updated_at,
       a.cover_media,
       (select count(*) from public.album_items ai join public.media_items mi on mi.id = ai.media_id
          where ai.album_id = a.id and ai.deleted_at is null and mi.status = 'ready' and mi.deleted_at is null) as item_count,
       (select coalesce(mi.thumb_path, mi.path) from public.media_items mi where mi.id = a.cover_media
          and mi.deleted_at is null) as cover_path
from public.albums a
where a.deleted_at is null;

-- So anh theo tung thanh vien (chi tinh anh nguoi xem duoc thay)
create view public.album_member_counts_v with (security_invoker = true) as
select a.family_id, a.member_id, count(ai.id) as photo_count, max(ai.created_at) as last_added
from public.albums a
join public.album_items ai on ai.album_id = a.id and ai.deleted_at is null
join public.media_items mi on mi.id = ai.media_id and mi.status = 'ready' and mi.deleted_at is null
where a.deleted_at is null
group by a.family_id, a.member_id;

revoke all on public.albums, public.album_items, public.media_people,
  public.album_items_v, public.albums_v, public.album_member_counts_v from anon, authenticated;
grant select on public.albums, public.album_items, public.media_people,
  public.album_items_v, public.albums_v, public.album_member_counts_v to authenticated;

grant execute on function
  public.can_view_album(uuid),
  public.create_album(uuid, text, text, text), public.ensure_default_album(uuid),
  public.update_album(uuid, text, text, text, uuid), public.delete_album(uuid),
  public.add_album_item(uuid, uuid, text, date), public.update_album_item(uuid, text, date, int),
  public.remove_album_item(uuid), public.tag_media_person(uuid, uuid), public.untag_media_person(uuid, uuid)
  to authenticated;
