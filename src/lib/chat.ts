/**
 * Tin nhắn (Module D): kiểu dữ liệu, kiểm tra nội dung tin, thông báo lỗi tiếng Việt, định dạng thời gian.
 * File này dùng được ở cả máy chủ lẫn trình duyệt (không import "server-only").
 */
import { friendlyError } from "./format";

export const MAX_BODY = 4000;
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const PAGE_SIZE = 30;

export type ConversationKind = "family" | "branch" | "group" | "direct";

/** Một dòng của view chat_conversations_v (cuộc trò chuyện CỦA TÔI). */
export type ConversationRow = {
  id: string;
  family_id: string;
  kind: ConversationKind;
  title: string;
  branch_id: string | null;
  direct_user_id: string | null;
  created_by: string | null;
  created_at: string;
  my_role: "owner" | "member";
  joined_at: string;
  last_read_at: string;
  muted: boolean;
  last_activity_at: string;
  last_preview: string | null;
  last_sender_name: string | null;
  unread_count: number;
  member_count: number;
  can_moderate: boolean;
  i_blocked: boolean;
};

export type MemberRow = { conversation_id: string; user_id: string; display_name: string; role: "owner" | "member"; joined_at: string; is_me: boolean };
export type PersonRow = { family_id: string; user_id: string; display_name: string; branch_name: string | null };

/** Một dòng của view chat_messages_v. */
export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_name: string | null;
  kind: "text" | "system";
  body: string;
  reply_to: string | null;
  client_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted: boolean;
  reply_sender_name: string | null;
  reply_body: string | null;
  reply_deleted: boolean;
};

/** Dòng thô của bảng messages do Realtime gửi về (không có tên người gửi/xem trước tin trả lời). */
export type RawMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  kind: "text" | "system";
  body: string;
  reply_to: string | null;
  client_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

/** Tin ở phía trình duyệt: tin đang gửi / gửi lỗi mang thêm trạng thái. */
export type LocalMessage = ChatMessage & {
  status?: "sending" | "failed";
  failReason?: "network" | "rejected";
  failText?: string;
};

export type ReportReport = {
  id: string;
  family_id: string;
  conversation_id: string;
  conversation_kind: ConversationKind;
  conversation_title: string;
  message_id: string;
  reporter_id: string;
  reporter_name: string;
  reported_user_id: string | null;
  reported_name: string;
  reason_kind: ReasonKind;
  note: string | null;
  message_snapshot: string;
  status: "open" | "resolved";
  action_taken: "dismissed" | "message_hidden" | "member_removed" | "message_hidden_member_removed" | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  message_deleted: boolean;
  is_mine: boolean;
  can_resolve: boolean;
};

export const REASONS = {
  abuse: "Lời lẽ xúc phạm, quấy rối",
  spam: "Tin rác, quảng cáo",
  inappropriate: "Nội dung không phù hợp",
  privacy: "Lộ thông tin riêng tư",
  other: "Lý do khác",
} as const;
export type ReasonKind = keyof typeof REASONS;
export const REASON_KEYS = Object.keys(REASONS) as ReasonKind[];

export const ACTION_LABELS: Record<NonNullable<ReportReport["action_taken"]>, string> = {
  dismissed: "Đã bỏ qua báo cáo",
  message_hidden: "Đã ẩn tin nhắn",
  member_removed: "Đã gỡ thành viên khỏi nhóm",
  message_hidden_member_removed: "Đã ẩn tin nhắn và gỡ thành viên khỏi nhóm",
};

// ---------- Kiểm tra nội dung tin (nhẹ, dùng được ở trình duyệt; schema zod nằm ở chat-schemas.ts cho máy chủ) ----------
export type BodyCheck = { ok: true; body: string } | { ok: false; error: string };
export function normalizeBody(text: string): BodyCheck {
  const body = text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
  if (body.length === 0) return { ok: false, error: "Tin nhắn không được để trống." };
  if (body.length > MAX_BODY) return { ok: false, error: `Tin nhắn tối đa ${MAX_BODY} ký tự.` };
  return { ok: true, body };
}

// ---------- Lỗi ----------
type ErrLike = { code?: string; message?: string } | null | undefined;

/** Lỗi do mất mạng (không tới được máy chủ) hay lỗi do máy chủ từ chối? */
export function isNetworkError(error: ErrLike): boolean {
  if (!error) return false;
  return !error.code && /failed to fetch|network|load failed|fetch/i.test(error.message ?? "");
}

export function chatError(error: ErrLike): string {
  if (!error) return "";
  const m = error.message ?? "";
  if (isNetworkError(error)) return "Chưa gửi được vì mất kết nối mạng. Khi có mạng, bấm “Gửi lại”.";
  if (/chat: rate limited/.test(m)) return "Bạn thao tác hơi nhanh. Hãy đợi khoảng một phút rồi thử lại.";
  if (/chat: unavailable/.test(m)) return "Hiện chưa nhắn tin được cho người này.";
  if (/chat: edit window closed/.test(m)) return "Đã quá 15 phút nên không sửa được tin nhắn này.";
  if (/chat: cannot edit/.test(m)) return "Tin nhắn này không sửa được.";
  if (/chat: cannot delete/.test(m)) return "Tin nhắn này không xoá được.";
  if (/chat: cannot leave/.test(m)) return "Cuộc trò chuyện này không rời đi được.";
  if (/chat: already resolved/.test(m)) return "Báo cáo này đã được xử lý trước đó.";
  if (/member does not belong to this branch/.test(m)) return "Người này không thuộc nhánh của nhóm.";
  if (/group is full/.test(m)) return "Nhóm đã đủ 100 người.";
  if (/invalid message body/.test(m)) return `Tin nhắn không được để trống và tối đa ${MAX_BODY} ký tự.`;
  if (/invalid member|group needs/.test(m)) return "Danh sách thành viên chưa hợp lệ (chỉ chọn người trong gia đình có dùng tin nhắn).";
  if (/cannot remove a member from a direct/.test(m)) return "Không gỡ thành viên khỏi tin nhắn riêng được; chỉ có thể ẩn tin.";
  if (/message cannot be reported/.test(m)) return "Tin nhắn này không báo cáo được.";
  if (/use leave instead/.test(m)) return "Muốn tự ra khỏi nhóm, hãy dùng nút “Rời nhóm”.";
  return friendlyError(error);
}

/** Trình duyệt cũ/ngữ cảnh không an toàn có thể thiếu crypto.randomUUID. */
export function newClientId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- Hiển thị thời gian theo múi giờ của từng người ----------
function safeZone(tz: string | undefined): string | undefined {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("vi-VN", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}
export function formatClock(iso: string, tz?: string): string {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: safeZone(tz) }).format(new Date(iso));
}
export function formatDay(iso: string, tz?: string): string {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: safeZone(tz) }).format(new Date(iso));
}
/** Khóa ngày (yyyy-mm-dd theo múi giờ người xem) để nhóm tin theo ngày. */
export function dayKey(iso: string, tz?: string): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: safeZone(tz) }).format(new Date(iso));
}
/** Giờ nếu là hôm nay, ngược lại ngày/tháng — dùng cho danh sách cuộc trò chuyện. */
export function formatListTime(iso: string, tz?: string, now: Date = new Date()): string {
  return dayKey(iso, tz) === dayKey(now.toISOString(), tz)
    ? formatClock(iso, tz)
    : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: safeZone(tz) }).format(new Date(iso));
}
