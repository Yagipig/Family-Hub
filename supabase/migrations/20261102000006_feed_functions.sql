-- Module Media / migration 6: ham doc bang tin theo trang (cursor), binh luan, hang cho kiem duyet.
-- Moi ham tu kiem tra quyen xem (can_view_post) cho tung dong; khong dua noi dung bai khong duoc xem.

create or replace function public.feed_page(
  p_family uuid, p_before timestamptz default null, p_before_id uuid default null,
  p_limit int default 20, p_pinned boolean default false
) returns table (
  id uuid, branch_id uuid, author_id uuid, author_name text, author_member_id uuid, author_avatar text,
  body text, visibility text, pinned boolean, hidden boolean, hide_reason text,
  created_at timestamptz, edited_at timestamptz, comment_count int, reactions jsonb, my_reaction text,
  media jsonb, can_moderate boolean, is_mine boolean
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not coalesce(public.has_permission(p_family, 'posts', 'view'), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select p.id, p.branch_id, p.author_id,
         coalesce(fm.full_name, up.display_name, 'Thành viên')::text,
         fm.id,
         mv.avatar_path::text,
         p.body, p.visibility, p.pinned, (p.hidden_at is not null),
         case when p.author_id = auth.uid() or public.can_moderate_post(p.id) then p.hide_reason end,
         p.created_at, p.edited_at,
         (select count(*)::int from public.comments c where c.post_id = p.id and c.deleted_at is null),
         coalesce((select jsonb_object_agg(r.kind, r.n) from
                    (select x.kind, count(*) as n from public.reactions x where x.post_id = p.id and x.comment_id is null group by x.kind) r),
                  '{}'::jsonb),
         (select x.kind from public.reactions x where x.post_id = p.id and x.comment_id is null and x.user_id = auth.uid()),
         coalesce((select jsonb_agg(jsonb_build_object('id', mi.id, 'bucket', mi.bucket, 'path', mi.path,
                      'thumb_path', mi.thumb_path, 'width', mi.width, 'height', mi.height) order by pm.sort)
                   from public.post_media pm join public.media_items mi on mi.id = pm.media_id
                   where pm.post_id = p.id and mi.status = 'ready' and mi.deleted_at is null), '[]'::jsonb),
         public.can_moderate_post(p.id),
         (p.author_id = auth.uid())
  from public.posts p
  left join public.family_memberships ms on ms.user_id = p.author_id and ms.family_id = p.family_id
  left join public.family_members fm on fm.id = ms.member_id and fm.deleted_at is null
  left join public.user_profiles up on up.id = p.author_id
  left join public.members_view mv on mv.id = fm.id
  where p.family_id = p_family and p.deleted_at is null and p.pinned = coalesce(p_pinned, false)
    and public.can_view_post(p.id)
    and (coalesce(p_pinned, false) or p_before is null
         or (p.created_at, p.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by case when coalesce(p_pinned, false) then p.pinned_at end desc nulls last, p.created_at desc, p.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
end $$;

create or replace function public.post_comments(p_post uuid, p_after timestamptz default null, p_limit int default 100)
returns table (
  id uuid, post_id uuid, author_id uuid, author_name text, author_member_id uuid, author_avatar text,
  body text, created_at timestamptz, edited_at timestamptz, reactions jsonb, my_reaction text,
  can_delete boolean, is_mine boolean
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_family uuid; v_branch uuid; v_post_author uuid; v_mod boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.can_view_post(p_post) then raise exception 'post not found' using errcode = 'P0002'; end if;
  select family_id, branch_id, author_id into v_family, v_branch, v_post_author from public.posts where id = p_post;
  v_mod := coalesce(public.has_permission(v_family, 'posts', 'delete', v_branch), false);
  return query
  select c.id, c.post_id, c.author_id,
         coalesce(fm.full_name, up.display_name, 'Thành viên')::text, fm.id, mv.avatar_path::text,
         c.body, c.created_at, c.edited_at,
         coalesce((select jsonb_object_agg(r.kind, r.n) from
                    (select x.kind, count(*) as n from public.reactions x where x.comment_id = c.id group by x.kind) r), '{}'::jsonb),
         (select x.kind from public.reactions x where x.comment_id = c.id and x.user_id = auth.uid()),
         (c.author_id = auth.uid() or v_post_author = auth.uid() or v_mod),
         (c.author_id = auth.uid())
  from public.comments c
  left join public.family_memberships ms on ms.user_id = c.author_id and ms.family_id = c.family_id
  left join public.family_members fm on fm.id = ms.member_id and fm.deleted_at is null
  left join public.user_profiles up on up.id = c.author_id
  left join public.members_view mv on mv.id = fm.id
  where c.post_id = p_post and c.deleted_at is null and (p_after is null or c.created_at > p_after)
  order by c.created_at, c.id
  limit greatest(1, least(coalesce(p_limit, 100), 200));
end $$;

-- ---------- Hang cho kiem duyet (bao cao dang mo + bai dang bi an) ----------
create or replace function public.moderation_queue(p_family uuid)
returns table (
  report_id uuid, post_id uuid, comment_id uuid, reason text, reported_at timestamptz, reporter_name text,
  post_body text, post_author_name text, comment_body text, post_hidden boolean
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  return query
  select r.id, r.post_id, r.comment_id, r.reason, r.created_at,
         coalesce((select f.full_name from public.family_memberships ms join public.family_members f on f.id = ms.member_id
                    where ms.user_id = r.reporter and ms.family_id = r.family_id), up.display_name, 'Thành viên')::text,
         p.body,
         coalesce((select f.full_name from public.family_memberships ms join public.family_members f on f.id = ms.member_id
                    where ms.user_id = p.author_id and ms.family_id = p.family_id), pa.display_name, 'Thành viên')::text,
         c.body, (p.hidden_at is not null)
  from public.post_reports r
  join public.posts p on p.id = r.post_id
  left join public.comments c on c.id = r.comment_id
  left join public.user_profiles up on up.id = r.reporter
  left join public.user_profiles pa on pa.id = p.author_id
  where r.family_id = p_family and r.status = 'open'
    and coalesce(public.has_permission(p_family, 'posts', 'approve', p.branch_id), false)
  order by r.created_at;
end $$;

create or replace function public.hidden_posts(p_family uuid)
returns table (id uuid, body text, author_name text, hide_reason text, hidden_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  return query
  select p.id, p.body,
         coalesce((select f.full_name from public.family_memberships ms join public.family_members f on f.id = ms.member_id
                    where ms.user_id = p.author_id and ms.family_id = p.family_id), up.display_name, 'Thành viên')::text,
         p.hide_reason, p.hidden_at
  from public.posts p left join public.user_profiles up on up.id = p.author_id
  where p.family_id = p_family and p.deleted_at is null and p.hidden_at is not null
    and coalesce(public.has_permission(p_family, 'posts', 'approve', p.branch_id), false)
  order by p.hidden_at desc;
end $$;

grant execute on function
  public.feed_page(uuid, timestamptz, uuid, int, boolean), public.post_comments(uuid, timestamptz, int),
  public.moderation_queue(uuid), public.hidden_posts(uuid)
  to authenticated;
