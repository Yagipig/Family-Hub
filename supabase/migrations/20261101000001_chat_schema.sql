-- Module D (Tin nhan) / migration 1: bang du lieu
-- Mo hinh: conversations (family/branch/group/direct) - conversation_members - messages (+ bao cao, chan).
--
-- QUY UOC QUYEN DOC (ap dung dong nhat cho RLS, view va Realtime):
--   Mot nguoi chi doc duoc tin cua cuoc tro chuyen khi DONG THOI:
--     (1) la thanh vien DANG HOAT DONG cua gia dinh va vai tro co quyen 'chat' 'view';
--     (2) co dong conversation_members chua roi / chua bi go (left_at is null);
--     (3) tin co created_at >= joined_at cua ho (khong doc duoc tin truoc luc tham gia).
--   Roi nhom / bi go / tai khoan bi thu hoi  => mat quyen doc TOAN BO cuoc tro chuyen, ke ca tin cu
--   (dong conversation_members van con de ghi nho ly do roi; khong con quyen doc).
--   Duoc them lai => joined_at dat lai = luc them lai: tin trong thoi gian vang mat khong bao gio lo ra.
--   (Rieng tin nhan rieng 1-1 (direct): khi khoi phuc, joined_at giu nguyen vi chi hai nguoi do tung co tin.)
--   Tin xoa mem: giu dong (de giu thu tu/tra loi/bao cao) nhung XOA SACH noi dung (body = '') ngay luc xoa,
--   nen khong ai (ke ca quan tri) doc lai duoc. Ban chup noi dung chi ton tai trong bao cao do nguoi dung chu dong gui.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('family','branch','group','direct')),
  title text check (title is null or char_length(btrim(title)) between 1 and 100),
  branch_id uuid references public.branches(id) on delete cascade,   -- chi cho kind = 'branch'
  direct_key text check (direct_key is null or char_length(direct_key) <= 80), -- chi cho 'direct': "uuid_nho:uuid_lon"
  created_by uuid references auth.users(id) on delete set null,      -- null = he thong tu tao
  created_at timestamptz not null default now(),
  check ((kind = 'branch') = (branch_id is not null)),
  check ((kind = 'direct') = (direct_key is not null)),
  check ((kind = 'group') = (title is not null))                     -- family/branch/direct: ten tinh tu dong
);
create unique index conversations_family_uq on public.conversations(family_id) where kind = 'family';
create unique index conversations_branch_uq on public.conversations(branch_id) where kind = 'branch';
create unique index conversations_direct_uq on public.conversations(family_id, direct_key) where kind = 'direct';
create index conversations_family_idx on public.conversations(family_id, kind);
create index conversations_creator_idx on public.conversations(created_by, created_at desc) where kind = 'group';

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,  -- ban sao cua conversations.family_id (bat bien) de loc nhanh
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  -- 'left' = tu roi (chi nhom tuy chon); 'removed' = bi quan tri/chu nhom go (khong tu dong vao lai);
  -- 'auto' = he thong cho roi (doi nhanh, mat quyen chat, thu hoi tai khoan) - co the tu vao lai khi du dieu kien
  left_reason text check (left_reason in ('left','removed','auto')),
  removed_by uuid references auth.users(id) on delete set null,
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  primary key (conversation_id, user_id),
  check ((left_at is null) = (left_reason is null))
);
create index conversation_members_user_idx on public.conversation_members(user_id) where left_at is null;
create index conversation_members_active_idx on public.conversation_members(conversation_id, joined_at) where left_at is null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,       -- null: tin he thong (hoac tai khoan da xoa)
  kind text not null default 'text' check (kind in ('text','system')),
  body text not null check (char_length(body) <= 4000),
  reply_to uuid references public.messages(id) on delete set null,
  client_id uuid,                                                     -- id do trinh duyet sinh: chong gui trung khi thu lai
  attachment_path text check (attachment_path is null or char_length(attachment_path) <= 400), -- DE DANH cho module media; chua co tai tep
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  check ((deleted_at is null and char_length(btrim(body, E' \t\r\n')) >= 1) or (deleted_at is not null and body = '')),
  check (kind <> 'system' or sender_id is null)
);
-- phan trang cursor theo (conversation, created_at desc)
create index messages_conv_created_idx on public.messages(conversation_id, created_at desc, id desc);
create index messages_sender_idx on public.messages(sender_id, created_at desc);
create unique index messages_client_uq on public.messages(sender_id, client_id) where client_id is not null;

-- Nguoi dung chan nhan tin rieng (1-1) tu mot nguoi khac
create table public.chat_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index chat_blocks_blocked_idx on public.chat_blocks(blocked_id);

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  reason_kind text not null check (reason_kind in ('abuse','spam','inappropriate','privacy','other')),
  note text check (char_length(note) <= 500),
  -- Ban chup noi dung luc bao cao (de quan tri xem du khi nguoi gui xoa sau do). Chi quan tri co quyen xu ly + nguoi bao cao thay.
  message_snapshot text not null check (char_length(message_snapshot) <= 4000),
  status text not null default 'open' check (status in ('open','resolved')),
  action_taken text check (action_taken in ('dismissed','message_hidden','member_removed','message_hidden_member_removed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 500),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id),
  check ((status = 'open') = (resolved_at is null))
);
create index message_reports_family_idx on public.message_reports(family_id, status, created_at desc);
create index message_reports_reporter_idx on public.message_reports(reporter_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.chat_blocks enable row level security;
alter table public.message_reports enable row level security;

-- Khong cap quyen truc tiep: (mac dinh bang moi khong cap gi). Chinh sach/grant them o migration 6.
revoke all on public.conversations, public.conversation_members, public.messages,
  public.chat_blocks, public.message_reports from anon, authenticated;
