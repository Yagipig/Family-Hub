-- Module C / migration 2: thiep (cards) + nguoi nhan (card_recipients) + ham kiem tra + RLS.
-- Rieng tu: khong co chinh sach doc cho quan tri vien. Chi nguoi gui va (khi toi gio) nguoi nhan doc duoc.

-- Quyen theo module KHONG phu thuoc pham vi nhanh: thiep/li xi la noi dung ca nhan, khong phai du lieu cua nhanh.
-- (has_permission voi branch_admin + hanh dong 'create' ma khong co nhanh luon tra false, nen khong dung o day.)
create or replace function public._role_can(p_role text, p_module text, p_action text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_role = 'super_admin' or exists (
    select 1 from public.role_permissions rp
    where rp.role_key = p_role and rp.module = p_module and rp.action = p_action);
$$;

create or replace function public._cards_can(p_family uuid, p_module text, p_action text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select public._role_can(m.role_key, p_module, p_action)
    from public.family_memberships m
    where m.user_id = auth.uid() and m.family_id = p_family and m.status = 'active'
  ), false);
$$;

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null references public.card_templates(key),
  title text check (title is null or char_length(title) <= 120),
  message text not null check (char_length(btrim(message)) >= 1 and char_length(message) <= 2000),
  audience_kind text not null check (audience_kind in ('users','branch','family')),
  audience_branch_id uuid references public.branches(id) on delete set null,   -- xoa nhanh khong lam hong thiep cu
  scheduled_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index cards_sender_idx on public.cards(sender_id, created_at desc) where deleted_at is null;
create index cards_due_idx on public.cards(scheduled_at) where deleted_at is null and delivered_at is null;
create trigger cards_updated before update on public.cards
  for each row execute function public.set_updated_at();

create table public.card_recipients (
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'unseen' check (status in ('unseen','opened')),
  opened_at timestamptz,
  notified_at timestamptz,
  primary key (card_id, user_id),
  check ((status = 'opened') = (opened_at is not null))
);
create index card_recipients_user_idx on public.card_recipients(user_id, card_id);

-- Ham ho tro cho RLS (security definer de tranh de quy giua hai bang)
create or replace function public.card_is_mine(p_card uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cards c
    where c.id = p_card and c.sender_id = auth.uid() and c.deleted_at is null
      and public.is_family_member(c.family_id));
$$;

-- Nguoi nhan chi thay thiep khi da toi gio (scheduled_at <= now()), chua bi huy, con la thanh vien hoat dong
create or replace function public.card_is_visible_to_me(p_card uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1
    from public.cards c join public.card_recipients r on r.card_id = c.id
    where c.id = p_card and r.user_id = auth.uid()
      and c.deleted_at is null and c.scheduled_at <= now()
      and public.is_family_member(c.family_id));
$$;

alter table public.cards enable row level security;
alter table public.card_recipients enable row level security;

create policy cards_select on public.cards for select to authenticated
  using (public.card_is_mine(id) or public.card_is_visible_to_me(id));
-- Nguoi gui thay trang thai cua moi nguoi nhan (giao dien ghi ro dieu nay); nguoi nhan chi thay dong cua minh
create policy card_recipients_select on public.card_recipients for select to authenticated
  using (public.card_is_mine(card_id) or (user_id = auth.uid() and public.card_is_visible_to_me(card_id)));

revoke all on public.cards, public.card_recipients from anon, authenticated;
grant select on public.cards, public.card_recipients to authenticated;
grant execute on function public.card_is_mine(uuid), public.card_is_visible_to_me(uuid) to authenticated;
