-- Ten goi khac cho TAI KHOAN nguoi dung (muc 2C): user_profiles.alias_name.
-- Neu co, ten nay duoc uu tien hien thi thay display_name trong tro chuyen, bang tin va tro choi.
-- Chay trong Supabase SQL Editor cua project Family Hub.

alter table public.user_profiles
  add column if not exists alias_name text check (char_length(alias_name) <= 80);

create or replace function public._chat_display_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(nullif(up.alias_name, ''), up.display_name) from public.user_profiles up where up.id = p_user), 'Một thành viên');
$$;
create or replace view public.chat_conversations_v as
select
  c.id, c.family_id, c.kind,
  case c.kind
    when 'direct' then coalesce(nullif(op.alias_name, ''), op.display_name, 'Thành viên')
    when 'family' then 'Cả gia đình'
    when 'branch' then 'Nhánh ' || coalesce(b.name, '')
    else c.title end as title,
  c.branch_id,
  other.user_id as direct_user_id,
  c.created_by, c.created_at,
  me.role as my_role, me.joined_at, me.last_read_at, me.muted,
  coalesce(lm.created_at, c.created_at) as last_activity_at,
  lm.preview as last_preview,
  lm.sender_name as last_sender_name,
  coalesce(un.n, 0) as unread_count,                       -- toi da 100
  (select count(*) from public.conversation_members x where x.conversation_id = c.id and x.left_at is null) as member_count,
  public.chat_can_moderate(c.id) as can_moderate,
  (c.kind = 'direct' and other.user_id is not null and exists (
     select 1 from public.chat_blocks bl where bl.blocker_id = auth.uid() and bl.blocked_id = other.user_id)) as i_blocked
from public.conversations c
join public.conversation_members me on me.conversation_id = c.id and me.user_id = auth.uid() and me.left_at is null
left join public.branches b on b.id = c.branch_id
left join lateral (
  select x.user_id from public.conversation_members x
  where c.kind = 'direct' and x.conversation_id = c.id and x.user_id <> auth.uid() limit 1) other on true
left join public.user_profiles op on op.id = other.user_id
left join lateral (
  select m.created_at,
         case when m.deleted_at is not null then 'Tin nhắn đã bị xoá' else left(m.body, 80) end as preview,
         case when m.kind = 'text' then (select coalesce(nullif(up.alias_name, ''), up.display_name) from public.user_profiles up where up.id = m.sender_id) end as sender_name
  from public.messages m
  where m.conversation_id = c.id and m.created_at >= me.joined_at
  order by m.created_at desc, m.id desc limit 1) lm on true
left join lateral (
  select count(*) as n from (
    select 1 from public.messages m
    where m.conversation_id = c.id and m.created_at > me.last_read_at and m.created_at >= me.joined_at
      and m.kind = 'text' and m.deleted_at is null and m.sender_id is distinct from auth.uid()
    limit 100) q) un on true
where public.chat_my_role_allows(c.family_id, 'view');
create or replace view public.chat_members_v as
select cm.conversation_id, cm.user_id,
       coalesce(nullif(up.alias_name, ''), up.display_name, 'Thành viên') as display_name,
       cm.role, cm.joined_at, (cm.user_id = auth.uid()) as is_me
from public.conversation_members cm
join public.conversation_members me
  on me.conversation_id = cm.conversation_id and me.user_id = auth.uid() and me.left_at is null
left join public.user_profiles up on up.id = cm.user_id
where cm.left_at is null and public.chat_my_role_allows(cm.family_id, 'view');
create or replace view public.chat_messages_v as
select
  m.id, m.conversation_id, m.sender_id,
  case when m.kind = 'system' then null else coalesce(nullif(up.alias_name, ''), up.display_name, 'Thành viên') end as sender_name,
  m.kind,
  case when m.deleted_at is not null then '' else m.body end as body,
  m.reply_to, m.client_id, m.created_at, m.edited_at,
  (m.deleted_at is not null) as deleted,
  case when rm.id is not null and public.chat_can_read(rm.conversation_id, rm.created_at) then
         coalesce(nullif(ru.alias_name, ''), ru.display_name, 'Thành viên') end as reply_sender_name,
  case when rm.id is not null and rm.deleted_at is null and public.chat_can_read(rm.conversation_id, rm.created_at)
       then left(rm.body, 140) end as reply_body,
  coalesce(rm.deleted_at is not null, false) as reply_deleted
from public.messages m
-- Dieu kien doc (khop voi chinh sach RLS cua bang messages): dong thanh vien con hieu luc + tin khong truoc luc tham gia + con quyen chat
join public.conversation_members me
  on me.conversation_id = m.conversation_id and me.user_id = auth.uid() and me.left_at is null and m.created_at >= me.joined_at
left join public.user_profiles up on up.id = m.sender_id
left join public.messages rm on rm.id = m.reply_to
left join public.user_profiles ru on ru.id = rm.sender_id
where public.chat_my_role_allows(me.family_id, 'view');
create or replace view public.chat_people_v as
select fm.family_id, fm.user_id, coalesce(nullif(up.alias_name, ''), up.display_name, 'Thành viên') as display_name, b.name as branch_name
from public.family_memberships fm
left join public.user_profiles up on up.id = fm.user_id
left join public.branches b on b.id = fm.branch_id and b.deleted_at is null
where fm.status = 'active' and fm.user_id <> auth.uid()
  and public.chat_my_role_allows(fm.family_id, 'create')
  and public.chat_user_can(fm.user_id, fm.family_id, 'create');
create or replace view public.chat_reports_v as
select
  r.id, r.family_id, r.conversation_id, c.kind as conversation_kind,
  case c.kind when 'direct' then 'Tin nhắn riêng' when 'family' then 'Cả gia đình'
              when 'branch' then 'Nhánh ' || coalesce(b.name, '') else c.title end as conversation_title,
  r.message_id, r.reporter_id, coalesce(nullif(rp.alias_name, ''), rp.display_name, 'Thành viên') as reporter_name,
  r.reported_user_id, coalesce(nullif(ru.alias_name, ''), ru.display_name, 'Thành viên') as reported_name,
  r.reason_kind, r.note, r.message_snapshot, r.status, r.action_taken,
  coalesce(nullif(rs.alias_name, ''), rs.display_name, null) as resolved_by_name, r.resolved_at, r.resolution_note, r.created_at,
  coalesce(m.deleted_at is not null, true) as message_deleted,
  (r.reporter_id = auth.uid()) as is_mine,
  coalesce(public.has_permission(r.family_id, 'chat', 'approve', c.branch_id), false) as can_resolve
from public.message_reports r
join public.conversations c on c.id = r.conversation_id
left join public.branches b on b.id = c.branch_id
left join public.messages m on m.id = r.message_id
left join public.user_profiles rp on rp.id = r.reporter_id
left join public.user_profiles ru on ru.id = r.reported_user_id
left join public.user_profiles rs on rs.id = r.resolved_by
where (r.reporter_id = auth.uid() and public.is_family_member(r.family_id))
   or public.has_permission(r.family_id, 'chat', 'approve', c.branch_id);

create or replace function public.games_leaderboard(p_family uuid)
returns table (user_id uuid, display_name text, balance int, rnk int)
language plpgsql security definer set search_path = public as $$
begin
  perform public._games_require_play(p_family);
  if not coalesce((select s.leaderboard_enabled from public.game_settings s where s.family_id = p_family), false) then
    return;
  end if;
  return query
    select b.user_id, coalesce(nullif(p.alias_name, ''), p.display_name), b.balance_after, (rank() over (order by b.balance_after desc))::int
    from (select distinct on (l.user_id) l.user_id, l.balance_after
          from public.points_ledger l where l.family_id = p_family order by l.user_id, l.id desc) b
    join public.user_profiles p on p.id = b.user_id
    join public.family_memberships m on m.user_id = b.user_id and m.family_id = p_family and m.status = 'active'
    where public.has_permission(p_family, 'games', 'view')
    order by b.balance_after desc, p.display_name
    limit 20;
end $$;
create or replace function public._games_top(p_family uuid, p_n int) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when coalesce((select s.leaderboard_enabled from public.game_settings s where s.family_id = p_family), false)
    then coalesce((
      select jsonb_agg(jsonb_build_object('name', x.display_name, 'balance', x.balance_after, 'rank', x.rnk) order by x.rnk, x.display_name)
      from (select coalesce(nullif(p.alias_name, ''), p.display_name) as display_name, b.balance_after, rank() over (order by b.balance_after desc) as rnk
            from (select distinct on (l.user_id) l.user_id, l.balance_after
                  from public.points_ledger l where l.family_id = p_family order by l.user_id, l.id desc) b
            join public.user_profiles p on p.id = b.user_id
            join public.family_memberships m on m.user_id = b.user_id and m.family_id = p_family and m.status = 'active'
            order by b.balance_after desc, p.display_name limit p_n) x), '[]'::jsonb)
    else null end;
$$;
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
         coalesce(up.alias_name, fm.full_name, up.display_name, 'Thành viên')::text,
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
         coalesce(up.alias_name, fm.full_name, up.display_name, 'Thành viên')::text, fm.id, mv.avatar_path::text,
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
                    where ms.user_id = r.reporter and ms.family_id = r.family_id), up.alias_name, up.display_name, 'Thành viên')::text,
         p.body,
         coalesce((select f.full_name from public.family_memberships ms join public.family_members f on f.id = ms.member_id
                    where ms.user_id = p.author_id and ms.family_id = p.family_id), pa.alias_name, pa.display_name, 'Thành viên')::text,
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
                    where ms.user_id = p.author_id and ms.family_id = p.family_id), up.alias_name, up.display_name, 'Thành viên')::text,
         p.hide_reason, p.hidden_at
  from public.posts p left join public.user_profiles up on up.id = p.author_id
  where p.family_id = p_family and p.deleted_at is null and p.hidden_at is not null
    and coalesce(public.has_permission(p_family, 'posts', 'approve', p.branch_id), false)
  order by p.hidden_at desc;
end $$;

