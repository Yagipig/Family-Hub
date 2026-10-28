-- Module Media / migration 5: binh luan, cam xuc, bao cao bai viet, tuy chon thong bao binh luan

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid
);
create index comments_post_idx on public.comments(post_id, created_at) where deleted_at is null;
create index comments_author_idx on public.comments(author_id, created_at desc);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,      -- bai viet (hoac bai chua binh luan)
  comment_id uuid references public.comments(id) on delete cascade,         -- null = cam xuc cho bai viet
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('heart','like','haha','wow','sad','pray')),
  created_at timestamptz not null default now()
);
-- Moi nguoi toi da mot cam xuc cho moi bai / moi binh luan
create unique index reactions_post_unique on public.reactions(user_id, post_id) where comment_id is null;
create unique index reactions_comment_unique on public.reactions(user_id, comment_id) where comment_id is not null;
create index reactions_post_idx on public.reactions(post_id);

create table public.post_reports (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reporter uuid not null references auth.users(id),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  action_taken text check (char_length(action_taken) <= 60),
  note text check (char_length(note) <= 500),
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'open') = (handled_at is null))
);
create unique index post_reports_open_unique on public.post_reports(reporter, post_id, coalesce(comment_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'open';
create index post_reports_family_idx on public.post_reports(family_id, status, created_at desc);

-- Tuy chon thong bao binh luan (bang tuy chon thong bao chung khong co cot rieng cho bang tin)
create table public.post_notification_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  comments boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, family_id)
);

alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.post_reports enable row level security;
alter table public.post_notification_prefs enable row level security;

-- Vai tro co quyen 'posts.create' (khong tinh pham vi nhanh: admin nhanh van binh luan duoc moi bai nhin thay)
create or replace function public._can_interact(p_family uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_role text;
begin
  v_role := public.my_role(p_family);
  if v_role is null then return false; end if;
  if v_role = 'super_admin' then return true; end if;
  return exists (select 1 from public.role_permissions rp where rp.role_key = v_role and rp.module = 'posts' and rp.action = 'create');
end $$;

-- ---------- Binh luan ----------
create or replace function public.add_comment(p_post uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.posts; v_body text := btrim(coalesce(p_body, '')); v_id uuid; v_name text; v_pref boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into p from public.posts where id = p_post and deleted_at is null;
  if not found or not public.can_view_post(p_post) or p.hidden_at is not null then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  if not public._can_interact(p.family_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_body) not between 1 and 2000 then raise exception 'bad comment length' using errcode = '22023'; end if;
  if (select count(*) from public.comments where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too many comments, try later' using errcode = 'P0001';
  end if;
  insert into public.comments (family_id, post_id, author_id, body) values (p.family_id, p_post, auth.uid(), v_body)
    returning id into v_id;

  -- Thong bao cho tac gia bai (khong tu thong bao cho minh); ton trong tuy chon
  if p.author_id <> auth.uid() then
    select coalesce((select n.comments from public.post_notification_prefs n
                     where n.user_id = p.author_id and n.family_id = p.family_id), true) into v_pref;
    if v_pref then
      select coalesce(
        (select fm.full_name from public.family_memberships ms join public.family_members fm on fm.id = ms.member_id
          where ms.user_id = auth.uid() and ms.family_id = p.family_id and ms.status = 'active'),
        (select up.display_name from public.user_profiles up where up.id = auth.uid()), 'Một thành viên') into v_name;
      perform public._notify(p.family_id, p.author_id, 'system', left(v_name, 100) || ' đã bình luận bài viết của bạn',
        left(v_body, 200), '/bang-tin#bai-' || p_post::text, 'post-comment:' || v_id::text);
    end if;
  end if;
  return v_id;
end $$;

create or replace function public.update_comment(p_comment uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.comments; v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into c from public.comments where id = p_comment and deleted_at is null for update;
  if not found or c.author_id <> auth.uid() or not public.can_view_post(c.post_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(v_body) not between 1 and 2000 then raise exception 'bad comment length' using errcode = '22023'; end if;
  update public.comments set body = v_body, edited_at = now() where id = p_comment;
end $$;

create or replace function public.delete_comment(p_comment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.comments; p public.posts; v_author boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into c from public.comments where id = p_comment and deleted_at is null for update;
  if not found then raise exception 'comment not found' using errcode = 'P0002'; end if;
  select * into p from public.posts where id = c.post_id;
  v_author := c.author_id = auth.uid() and public.is_family_member(c.family_id);
  -- Chu bai viet cung duoc xoa binh luan duoi bai cua minh
  if not (v_author or (p.author_id = auth.uid() and public.is_family_member(c.family_id))
          or coalesce(public.has_permission(c.family_id, 'posts', 'delete', p.branch_id), false)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.comments set deleted_at = now(), deleted_by = auth.uid() where id = p_comment;
  update public.post_reports set status = 'resolved', handled_by = auth.uid(), handled_at = now(), action_taken = 'comment_deleted'
    where comment_id = p_comment and status = 'open';
  if not v_author then
    perform public.write_audit(c.family_id, 'comment.delete_moderation', 'comment', p_comment::text,
      jsonb_build_object('author_id', c.author_id, 'post_id', c.post_id), null);
  end if;
end $$;

-- ---------- Cam xuc (p_kind null = bo cam xuc) ----------
create or replace function public.set_reaction(p_target_type text, p_target uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare v_post uuid; v_comment uuid; v_family uuid; p public.posts; c public.comments;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_target_type not in ('post','comment') then raise exception 'bad target' using errcode = '22023'; end if;
  if p_kind is not null and p_kind not in ('heart','like','haha','wow','sad','pray') then
    raise exception 'bad reaction' using errcode = '22023';
  end if;
  if p_target_type = 'post' then
    select * into p from public.posts where id = p_target and deleted_at is null;
    if not found then raise exception 'not found' using errcode = 'P0002'; end if;
    v_post := p.id; v_family := p.family_id;
  else
    select * into c from public.comments where id = p_target and deleted_at is null;
    if not found then raise exception 'not found' using errcode = 'P0002'; end if;
    v_post := c.post_id; v_comment := c.id; v_family := c.family_id;
  end if;
  if not public.can_view_post(v_post) then raise exception 'not found' using errcode = 'P0002'; end if;
  if not public._can_interact(v_family) then raise exception 'forbidden' using errcode = '42501'; end if;

  if p_kind is null then
    delete from public.reactions where user_id = auth.uid() and post_id = v_post
      and comment_id is not distinct from v_comment;
  elsif v_comment is null then
    insert into public.reactions (family_id, post_id, user_id, kind) values (v_family, v_post, auth.uid(), p_kind)
      on conflict (user_id, post_id) where comment_id is null do update set kind = excluded.kind;
  else
    insert into public.reactions (family_id, post_id, comment_id, user_id, kind)
      values (v_family, v_post, v_comment, auth.uid(), p_kind)
      on conflict (user_id, comment_id) where comment_id is not null do update set kind = excluded.kind;
  end if;
end $$;

-- ---------- Bao cao + xu ly ----------
create or replace function public.report_content(p_post uuid, p_comment uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.posts; v_id uuid; a record; v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into p from public.posts where id = p_post and deleted_at is null;
  if not found or not public.can_view_post(p_post) then raise exception 'post not found' using errcode = 'P0002'; end if;
  if p_comment is not null and not exists (
       select 1 from public.comments c where c.id = p_comment and c.post_id = p_post and c.deleted_at is null) then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
  if char_length(v_reason) not between 1 and 500 then raise exception 'bad reason' using errcode = '22023'; end if;
  if exists (select 1 from public.post_reports r where r.reporter = auth.uid() and r.post_id = p_post
             and r.comment_id is not distinct from p_comment and r.status = 'open') then
    raise exception 'already reported' using errcode = 'P0001';
  end if;
  if (select count(*) from public.post_reports where reporter = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many reports, try later' using errcode = 'P0001';
  end if;
  insert into public.post_reports (family_id, post_id, comment_id, reporter, reason)
  values (p.family_id, p_post, p_comment, auth.uid(), v_reason) returning id into v_id;

  for a in select m.user_id from public.family_memberships m
           where m.family_id = p.family_id and m.status = 'active' and m.user_id <> auth.uid()
             and public._user_has_permission(m.user_id, p.family_id, 'posts', 'approve', p.branch_id)
  loop
    perform public._notify(p.family_id, a.user_id, 'system', 'Có nội dung bị báo cáo cần xem xét', null,
      '/admin/kiem-duyet', 'post-report:' || v_id::text || ':' || a.user_id::text);
  end loop;
  return v_id;
end $$;

-- p_action: 'hide' (an bai / xoa binh luan), 'delete' (xoa), 'dismiss' (bo qua, khong vi pham)
create or replace function public.resolve_post_report(p_report uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.post_reports; p public.posts; v_action text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_action not in ('hide','delete','dismiss') then raise exception 'bad action' using errcode = '22023'; end if;
  select * into r from public.post_reports where id = p_report and status = 'open' for update;
  if not found then raise exception 'report not found' using errcode = 'P0002'; end if;
  select * into p from public.posts where id = r.post_id;
  if not coalesce(public.has_permission(r.family_id, 'posts', 'approve', p.branch_id), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_action = 'dismiss' then
    v_action := 'dismissed';
  elsif r.comment_id is not null then
    perform public.delete_comment(r.comment_id);   -- ham nay da kiem tra quyen + ghi nhat ky
    v_action := 'comment_deleted';
  elsif p_action = 'hide' then
    if p.deleted_at is null and p.hidden_at is null then perform public.hide_post(r.post_id, left(p_note, 500)); end if;
    v_action := 'post_hidden';
  else
    if p.deleted_at is null then perform public.delete_post(r.post_id); end if;
    v_action := 'post_deleted';
  end if;
  update public.post_reports set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end,
    action_taken = v_action, note = left(btrim(p_note), 500), handled_by = auth.uid(), handled_at = now()
    where id = p_report;
  perform public.write_audit(r.family_id, 'report.' || p_action, 'post_report', p_report::text,
    jsonb_build_object('post_id', r.post_id, 'comment_id', r.comment_id), jsonb_build_object('action', v_action));
end $$;

create or replace function public.set_post_notifications(p_family uuid, p_comments boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_family_member(p_family) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.post_notification_prefs (user_id, family_id, comments) values (auth.uid(), p_family, coalesce(p_comments, true))
    on conflict (user_id, family_id) do update set comments = excluded.comments, updated_at = now();
end $$;

-- ---------- RLS ----------
create policy comments_select on public.comments for select to authenticated
  using (deleted_at is null and public.can_view_post(post_id));
create policy reactions_select on public.reactions for select to authenticated
  using (public.can_view_post(post_id));
create policy post_reports_select on public.post_reports for select to authenticated
  using (reporter = auth.uid() or public.can_moderate_post(post_id));
create policy post_notification_prefs_select on public.post_notification_prefs for select to authenticated
  using (user_id = auth.uid());

revoke all on public.comments, public.reactions, public.post_reports, public.post_notification_prefs from anon, authenticated;
grant select on public.comments, public.reactions, public.post_reports, public.post_notification_prefs to authenticated;

grant execute on function
  public.add_comment(uuid, text), public.update_comment(uuid, text), public.delete_comment(uuid),
  public.set_reaction(text, uuid, text), public.report_content(uuid, uuid, text),
  public.resolve_post_report(uuid, text, text), public.set_post_notifications(uuid, boolean)
  to authenticated;
