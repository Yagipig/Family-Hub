/**
 * Xử lý văn bản tin nhắn (thuần, chạy được ở cả máy chủ lẫn trình duyệt).
 * Tin nhắn luôn là văn bản thuần: không có HTML/Markdown. Chỉ tự nhận dạng liên kết http/https an toàn.
 */

export type TextSegment = { type: "text"; text: string } | { type: "link"; text: string; href: string };

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING = new Set([".", ",", ";", ":", "!", "?", "'", '"', ")", "]", "}", "»", "…", "”", "’"]);
const MAX_URL = 2000;

/** Bỏ dấu câu dính ở cuối liên kết; giữ ")" nếu liên kết có "(" tương ứng. */
function trimUrl(raw: string): string {
  let url = raw;
  while (url.length > 0 && TRAILING.has(url[url.length - 1])) {
    const last = url[url.length - 1];
    if (last === ")") {
      const opens = (url.match(/\(/g) ?? []).length;
      const closes = (url.match(/\)/g) ?? []).length;
      if (closes <= opens) break;
    }
    url = url.slice(0, -1);
  }
  return url;
}

/**
 * Trả về href an toàn hoặc null. Từ chối: giao thức khác http/https, có tên đăng nhập/mật khẩu trong liên kết
 * (thủ thuật lừa đảo kiểu https://ngan-hang.vn@trang-gia.com), tên miền quốc tế hoá (xn--, dễ giả mạo), quá dài.
 */
export function safeHref(candidate: string): string | null {
  if (candidate.length > MAX_URL) return null;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (!u.hostname || !u.hostname.includes(".")) return null;
  if (u.hostname.split(".").some((label) => label.startsWith("xn--"))) return null;
  return u.href;
}

export function splitLinks(body: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  const push = (text: string) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (prev && prev.type === "text") prev.text += text;
    else out.push({ type: "text", text });
  };
  for (const m of body.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const text = trimUrl(m[0]);
    const href = safeHref(text);
    push(body.slice(last, start));
    if (href) out.push({ type: "link", text, href });
    else push(text);
    last = start + text.length;
  }
  push(body.slice(last));
  return out;
}

/** Chuẩn hoá để tìm kiếm tiếng Việt không cần gõ dấu: "Nhánh Tư" khớp "nhanh tu". */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

/** Số tin chưa đọc hiển thị gọn (view chỉ đếm tối đa 100). */
export function unreadLabel(n: number): string {
  return n >= 100 ? "99+" : String(n);
}
