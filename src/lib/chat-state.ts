/**
 * Trạng thái danh sách tin của một phòng chat — hàm thuần (dễ kiểm thử), không phụ thuộc React.
 * Nguyên tắc:
 *  - Khoá chính là id máy chủ. Tin đang gửi dùng id = client_id; khi máy chủ xác nhận (qua RPC hoặc Realtime,
 *    cái nào đến trước) tin tạm được thay bằng tin thật theo client_id => không bao giờ hiện hai lần.
 *  - Tin đã xác nhận xếp theo created_at (máy chủ); tin đang gửi/lỗi luôn nằm cuối, theo thứ tự gửi.
 */
import type { ChatMessage, LocalMessage, RawMessageRow } from "@/lib/chat";

const isPending = (m: LocalMessage) => m.status === "sending" || m.status === "failed";

/**
 * Khoá so sánh thời gian bền với mọi dạng chuỗi (".12345+00:00", ".123456+00:00", "Z", không có phần lẻ...):
 * mili giây (Date.parse) + chữ số micro giây còn lại. Không so sánh chuỗi trực tiếp.
 */
export function tsKey(iso: string): string {
  const ms = Date.parse(iso);
  const frac = /\.(\d+)/.exec(iso)?.[1] ?? "";
  return String(Number.isFinite(ms) ? ms : 0).padStart(16, "0") + frac.slice(3, 6).padEnd(3, "0");
}

function cmp(a: LocalMessage, b: LocalMessage): number {
  const pa = isPending(a), pb = isPending(b);
  if (pa !== pb) return pa ? 1 : -1;
  if (pa && pb) return 0; // giữ nguyên thứ tự gửi (sắp ổn định)
  const ka = tsKey(a.created_at), kb = tsKey(b.created_at);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sorted(list: LocalMessage[]): LocalMessage[] {
  // Array.prototype.sort ổn định (ES2019+)
  return [...list].sort(cmp);
}

/** Thêm/cập nhật một tin từ máy chủ (view hoặc Realtime đã chuyển đổi). */
export function upsertServerMessage(list: LocalMessage[], incoming: ChatMessage): LocalMessage[] {
  const i = list.findIndex((m) => !isPending(m) && m.id === incoming.id);
  if (i >= 0) {
    const cur = list[i];
    const merged: LocalMessage = {
      ...cur,
      ...incoming,
      // Realtime không biết tên/ xem trước tin trả lời: giữ giá trị đã có nếu bản mới trống
      sender_name: incoming.sender_name ?? cur.sender_name,
      reply_sender_name: incoming.reply_sender_name ?? cur.reply_sender_name,
      reply_body: incoming.reply_body ?? cur.reply_body,
      // Đã xoá thì không bao giờ "sống lại"
      deleted: incoming.deleted || cur.deleted,
      body: incoming.deleted || cur.deleted ? "" : incoming.body,
      status: undefined,
      failReason: undefined,
      failText: undefined,
    };
    const next = list.slice();
    next[i] = merged;
    return sorted(next);
  }
  // Có tin tạm cùng client_id (tin của chính mình) => thay thế
  if (incoming.client_id) {
    const p = list.findIndex((m) => isPending(m) && m.client_id === incoming.client_id);
    if (p >= 0) {
      const next = list.slice();
      next[p] = { ...incoming, status: undefined };
      return sorted(next);
    }
  }
  return sorted([...list, { ...incoming, status: undefined }]);
}

export function upsertMany(list: LocalMessage[], incoming: ChatMessage[]): LocalMessage[] {
  return incoming.reduce((acc, m) => upsertServerMessage(acc, m), list);
}

export function addPending(list: LocalMessage[], pending: LocalMessage): LocalMessage[] {
  if (list.some((m) => m.client_id && m.client_id === pending.client_id)) return list; // đã có (bấm đúp)
  return sorted([...list, { ...pending, status: "sending" }]);
}

export function markFailed(list: LocalMessage[], clientId: string, reason: "network" | "rejected", text: string): LocalMessage[] {
  return list.map((m) => (isPending(m) && m.client_id === clientId ? { ...m, status: "failed", failReason: reason, failText: text } : m));
}

export function markSending(list: LocalMessage[], clientId: string): LocalMessage[] {
  return list.map((m) => (isPending(m) && m.client_id === clientId ? { ...m, status: "sending", failReason: undefined, failText: undefined } : m));
}

export function removePending(list: LocalMessage[], clientId: string): LocalMessage[] {
  return list.filter((m) => !(isPending(m) && m.client_id === clientId));
}

/**
 * RPC send_message trả về thành công: nếu Realtime đã mang tin thật về (cùng id) thì chỉ cần bỏ tin tạm;
 * nếu chưa thì chuyển tin tạm thành tin thật tại chỗ.
 */
export function confirmSent(list: LocalMessage[], clientId: string, sent: { id: string; created_at: string }): LocalMessage[] {
  const pendingIdx = list.findIndex((m) => isPending(m) && m.client_id === clientId);
  if (pendingIdx < 0) return list; // Realtime đã thay thế rồi
  if (list.some((m) => !isPending(m) && m.id === sent.id)) return removePending(list, clientId);
  const next = list.slice();
  next[pendingIdx] = { ...next[pendingIdx], id: sent.id, created_at: sent.created_at, status: undefined, failReason: undefined, failText: undefined };
  return sorted(next);
}

/** Mốc created_at mới nhất của tin đã xác nhận (dùng để bổ sung tin bị lỡ). */
export function latestConfirmedAt(list: LocalMessage[]): string | null {
  let best: string | null = null;
  for (const m of list) if (!isPending(m) && (best === null || tsKey(m.created_at) > tsKey(best))) best = m.created_at;
  return best;
}

export function oldestConfirmedAt(list: LocalMessage[]): string | null {
  let best: string | null = null;
  for (const m of list) if (!isPending(m) && (best === null || tsKey(m.created_at) < tsKey(best))) best = m.created_at;
  return best;
}

/** Chuyển dòng thô từ Realtime thành ChatMessage, bổ sung tên người gửi và tin được trả lời từ dữ liệu đã có. */
export function fromRaw(raw: RawMessageRow, names: ReadonlyMap<string, string>, list: LocalMessage[]): ChatMessage {
  const deleted = raw.deleted_at != null;
  const target = raw.reply_to ? list.find((m) => m.id === raw.reply_to) : undefined;
  return {
    id: raw.id,
    conversation_id: raw.conversation_id,
    sender_id: raw.sender_id,
    sender_name: raw.kind === "system" ? null : raw.sender_id ? (names.get(raw.sender_id) ?? null) : null,
    kind: raw.kind,
    body: deleted ? "" : raw.body,
    reply_to: raw.reply_to,
    client_id: raw.client_id,
    created_at: raw.created_at,
    edited_at: raw.edited_at,
    deleted,
    reply_sender_name: target ? target.sender_name : null,
    reply_body: target && !target.deleted ? target.body.slice(0, 140) : null,
    reply_deleted: target ? target.deleted : false,
  };
}

/** Khi một tin bị xoá, các tin trả lời nó trong danh sách cũng phải ngừng hiện nội dung tin gốc. */
export function propagateDelete(list: LocalMessage[], id: string): LocalMessage[] {
  return list.map((m) => (m.reply_to === id ? { ...m, reply_deleted: true, reply_body: null } : m));
}

export function applyDelete(list: LocalMessage[], id: string): LocalMessage[] {
  return propagateDelete(list.map((m) => (m.id === id && !isPending(m) ? { ...m, deleted: true, body: "" } : m)), id);
}

export function applyEdit(list: LocalMessage[], id: string, body: string, editedAt: string): LocalMessage[] {
  return list.map((m) => (m.id === id && !isPending(m) && !m.deleted ? { ...m, body, edited_at: editedAt } : m));
}

/** Nhóm theo ngày để chèn vạch ngăn "Thứ Ba, 28/10/2026". */
export function startsNewDay(prev: LocalMessage | undefined, cur: LocalMessage, dayOf: (iso: string) => string): boolean {
  return !prev || dayOf(prev.created_at) !== dayOf(cur.created_at);
}

/**
 * Cụm tin liên tiếp (kiểu Messenger): hai tin chữ kề nhau thuộc cùng một cụm khi cùng người gửi,
 * cùng ngày theo múi giờ người xem. Tin hệ thống, khác người gửi, khác ngày, hoặc người gửi
 * không xác định (đã rời gia đình) đều cắt cụm. Chỉ tin đầu cụm hiện tên + ảnh người gửi,
 * chỉ tin cuối cụm hiện giờ gửi; các tin giữa cụm đứng sát nhau.
 */
export function sameGroup(a: LocalMessage | undefined, b: LocalMessage | undefined, dayOf: (iso: string) => string): boolean {
  if (!a || !b) return false;
  return (
    a.kind === "text" && b.kind === "text" &&
    a.sender_id != null && a.sender_id === b.sender_id &&
    dayOf(a.created_at) === dayOf(b.created_at)
  );
}

/** Tin này có mở đầu một cụm không (hiện tên + ảnh người gửi nếu là tin của người khác). */
export function isGroupStart(prev: LocalMessage | undefined, cur: LocalMessage, dayOf: (iso: string) => string): boolean {
  return cur.kind === "text" && !sameGroup(prev, cur, dayOf);
}

/** Tin này có kết thúc một cụm không (hiện giờ gửi ở dưới cụm). */
export function isGroupEnd(cur: LocalMessage, next: LocalMessage | undefined, dayOf: (iso: string) => string): boolean {
  return cur.kind === "text" && !sameGroup(cur, next, dayOf);
}
