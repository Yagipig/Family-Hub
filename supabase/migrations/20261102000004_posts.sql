-- Module Media / migration 4: bang tin (bai viet). Binh luan / cam xuc / bao cao o file 05.
-- Quyen module 'posts': member xem + dang; guest chi xem; branch_admin kiem duyet theo nhanh (approve/delete);
-- family_admin tat ca. Xoa mem. Nguoi dung sua/xoa bai cua minh; quan tri an/xoa bai vi pham (co nhat ky).

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,   -- nhanh cua bai (pham vi kiem duyet); null = toan gia dinh
  author_id uuid not null references auth.users(id),
  body text not null default '' check (char_length(body) <= 5000),
  visibility text not null default 'family' check (visibility in ('family','branch')),
  pinned boolean not null default false,
  pinned_at timestamptz,
  hidden_at timestamptz,            -- quan tri an (tac gia va quan tri van thay)
  hidden_by uuid,
  hide_reason text check (char_length(hide_reason) <= 500),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  check (visibility <> 'branch' or branch_id is not null),
  check (pinned = (pinned_at is not null))
);
create index posts_feed_idx on public.posts(family_id, created_at desc, id desc) where deleted_at is null;
create index posts_pinned_idx on public.posts(family_id) where pinned and deleted_at is null;
create index posts_author_idx on public.posts(author_id, created_at desc);
create trigger posts_updated before update on public.posts
  for each row execute function public.set_updated_at();

create table public.post_media (
  post_id uuid not null references public.posts(id) on delete cascade,
  media_id uuid not null references public.media_items(id),
  sort int not null default 0,
  primary key (post_id, media_id)
);
create unique index post_media_media_unique on public.post_media(media_id);

alter table public.posts enable row level security;
alter table public.post_media enable row level security;

-- ---------- Ham kiem tra ----------
create or replace function public.can_view_post(p_post uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare p public.posts;
begin
  if auth.uid() is null then return false; end if;
  select * into p from public.posts where id = p_post;
  if not found or p.deleted_at is not null then return false; end if;
  if not coalesce(public.has_permission(p.family_id, 'posts', 'view'), false) then return false; end if;
  if p.hidden_at is not null then
    return p.author_id = auth.uid() or coalesce(public.has_permission(p.family_id, 'posts', 'approve', p.branch_id), false);
  end if;
  if p.visibility = 'branch' then
    return p.author_id = auth.uid() or public._branch_visible(p.family_id, p.branch_id);
  end if;
  return true;
end $$;

create or replace function public.can_moderate_post(p_post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  -- Khong loc deleted_at: quan tri van xem duoc lich su bao cao cua bai da xoa
  select coalesce((select public.has_permission(p.family_id, 'posts', 'approve', p.branch_id)
                   from public.posts p where p.id = p_post), false);
$$;

-- ---------- Dang / sua / xoa bai ----------
create or replace function public.create_post(
  p_family uuid, p_body text, p_visibility text default 'family', p_branch uuid default null,
  p_media uuid[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_role text; v_own_branch uuid; v_branch uuid; v_body text := btrim(coalesce(p_body, ''));
  v_id uuid; v_mid uuid; v_i int := 0; mi public.media_items;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select m.role_key, m.branch_id into v_role, v_own_branch from public.family_memberships m
    where m.user_id = auth.uid() and m.family_id = p_family and m.status = 'active';
  if v_role is null or v_role = 'guest' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_visibility not in ('family','branch') then raise exception 'bad visibility' using errcode = '22023'; end if;
  if char_length(v_body) > 5000 then raise exception 'body too long' using errcode = '22023'; end if;
  p_media := coalesce(p_media, '{}');
  if cardinality(p_media) > 10 then raise exception 'too many images (max 10)' using errcode = '22023'; end if;
  if v_body = '' and cardinality(p_media) = 0 then raise exception 'empty post' using errcode = '22023'; end if;

  v_branch := coalesce(p_branch, v_own_branch);
  if p_branch is not null then
    perform public._check_branch(p_family, p_branch);
    -- Thanh vien thuong chi dang vao nhanh cua minh; admin theo pham vi quyen cua ho
    if v_role = 'member' and p_branch is distinct from v_own_branch then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  if not coalesce(public.has_permission(p_family, 'posts', 'create', v_branch), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_visibility = 'branch' and v_branch is null then
    raise exception 'branch visibility needs a branch' using errcode = '22023';
  end if;
  if (select count(*) from public.posts where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too many posts, try later' using errcode = 'P0001';
  end if;

  insert into public.posts (family_id, branch_id, author_id, body, visibility)
  values (p_family, v_branch, auth.uid(), v_body, p_visibility) returning id into v_id;

  foreach v_mid in array p_media loop
    select * into mi from public.media_items where id = v_mid for update;
    if not found or mi.family_id <> p_family or mi.kind <> 'post' or mi.uploader <> auth.uid()
       or mi.status <> 'ready' or mi.deleted_at is not null
       or exists (select 1 from public.post_media pm where pm.media_id = v_mid) then
      raise exception 'invalid media' using errcode = '22023';
    end if;
    insert into public.post_media (post_id, media_id, sort) values (v_id, v_mid, v_i);
    v_i := v_i + 1;
  end loop;
  return v_id;
end $$;

create or replace function public.update_post(p_post uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.posts; v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into p from public.posts where id = p_post and deleted_at is null for update;
  if not found or p.author_id <> auth.uid() or p.hidden_at is not null
     or not coalesce(public.has_permission(p.family_id, 'posts', 'create', p.branch_id), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(v_body) > 5000 then raise exception 'body too long' using errcode = '22023'; end if;
  if v_body = '' and not exists (select 1 from public.post_media where post_id = p_post) then
    raise exception 'empty post' using errcode = '22023';
  end if;
  update public.posts set body = v_body, edited_at = now() where id = p_post;
end $$;

create or replace function public.delete_post(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.posts; v_author boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into p from public.posts where id = p_post and deleted_at is null for update;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;
  v_author := p.author_id = auth.uid() and public.is_family_member(p.family_id);
  if not (v_author or coalesce(public.has_permission(p.family_id, 'posts', 'delete', p.branch_id), false)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.posts set deleted_at = now(), deleted_by = auth.uid(), pinned = false, pinned_at = null where id = p_post;
  perform public._media_soft_delete(pm.media_id) from public.post_media pm where pm.post_id = p_post;
  update public.post_reports set status = 'resolved', handled_by = auth.uid(), handled_at = now(),
    action_taken = 'post_deleted' where post_id = p_post and status = 'open';
  if not v_author then
    perform public.write_audit(p.family_id, 'post.delete_moderation', 'post', p_post::text,
      jsonb_build_object('author_id', p.author_id, 'branch_id', p.branch_id), null);
  end if;
end $$;

create or replace function public.hide_post(p_post uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare p public.posts;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into p from public.posts where id = p_post and deleted_at is null for update;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;
  if not coalesce(public.has_permission(p.family_id, 'posts', 'approve', p.branch_id), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.posts set hidden_at = now(), hidden_by = auth.uid(), hide_reason = left(btrim(p_reason), 500),
    pinned = false, pinned_at = null where id = p_post;
  perform public.write_audit(p.family_id, 'post.hide', 'post', p_post::text,
    jsonb_build_object('author_id', p.author_id), jsonb_build_object('reason', left(btrim(p_reason), 500)));
end $$;

create or replace function public.unhide_post(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.posts;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into p from public.posts where id = p_post and deleted_at is null for update;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;
  if not coalesce(public.has_permission(p.family_id, 'posts', 'approve', p.branch_id), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.posts set hidden_at = null, hidden_by = null, hide_reason = null where id = p_post;
  perform public.write_audit(p.family_id, 'post.unhide', 'post', p_post::text, null, null);
end $$;

-- Ghim: admin toan gia dinh ghim moi bai; admin nhanh chi ghim bai co pham vi 'branch' trong nhanh cua minh
create or replace function public.pin_post(p_post uuid, p_pinned boolean) returns void
language plpgsql security definer set search_path = public as $$
declare p public.posts; v_ok boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into p from public.posts where id = p_post and deleted_at is null for update;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;
  v_ok := coalesce(public.has_permission(p.family_id, 'posts', 'approve', null), false)
          or (p.visibility = 'branch' and coalesce(public.has_permission(p.family_id, 'posts', 'approve', p.branch_id), false));
  if not v_ok then raise exception 'forbidden' using errcode = '42501'; end if;
  if p.hidden_at is not null and p_pinned then raise exception 'cannot pin a hidden post' using errcode = '22023'; end if;
  update public.posts set pinned = coalesce(p_pinned, false),
    pinned_at = case when coalesce(p_pinned, false) then now() end where id = p_post;
  perform public.write_audit(p.family_id, case when p_pinned then 'post.pin' else 'post.unpin' end, 'post', p_post::text, null, null);
end $$;

-- ---------- RLS ----------
create policy posts_select on public.posts for select to authenticated
  using (deleted_at is null and public.can_view_post(id));
create policy post_media_select on public.post_media for select to authenticated
  using (public.can_view_post(post_id));

revoke all on public.posts, public.post_media from anon, authenticated;
grant select on public.posts, public.post_media to authenticated;

grant execute on function
  public.can_view_post(uuid), public.can_moderate_post(uuid),
  public.create_post(uuid, text, text, uuid, uuid[]), public.update_post(uuid, text),
  public.delete_post(uuid), public.hide_post(uuid, text), public.unhide_post(uuid),
  public.pin_post(uuid, boolean)
  to authenticated;
