/**
 * Múi giờ cho hẹn giờ gửi thiệp. Người gửi chọn "ngày giờ trên đồng hồ của mình" (datetime-local, không có múi giờ);
 * máy chủ đổi sang UTC theo múi giờ của NGƯỜI GỬI (lấy từ hồ sơ, không tin dữ liệu từ trình duyệt).
 */

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
function offsetFormatter(tz: string): Intl.DateTimeFormat {
  let f = offsetFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    offsetFormatters.set(tz, f);
  }
  return f;
}

/** Độ lệch (phút) của múi giờ tz so với UTC tại thời điểm date (dương = đi trước UTC). */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const parts = offsetFormatter(tz).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * Đổi "YYYY-MM-DDTHH:mm" trên đồng hồ của múi giờ tz thành thời điểm UTC.
 * Giờ không tồn tại (nhảy giờ mùa hè) được đẩy tới giờ hợp lệ gần nhất phía sau; giờ lặp (lùi giờ) lấy lần xuất hiện đầu tiên.
 * Trả về null nếu định dạng/ngày không hợp lệ.
 */
export function zonedLocalToUtc(local: string, tz: string): Date | null {
  const m = LOCAL_RE.exec(local);
  if (!m || !isValidTimeZone(tz)) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(naive);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  const DAY = 24 * 3600_000;
  const offBefore = tzOffsetMinutes(new Date(naive - DAY), tz);
  const offAfter = tzOffsetMinutes(new Date(naive + DAY), tz);
  const candidates = [...new Set([offBefore, offAfter])]
    .map((off) => ({ off, t: naive - off * 60000 }))
    .filter((c) => tzOffsetMinutes(new Date(c.t), tz) === c.off)
    .map((c) => c.t);
  if (candidates.length > 0) return new Date(Math.min(...candidates)); // giờ lặp: lấy lần đầu
  return new Date(naive - offBefore * 60000); // giờ không tồn tại: đẩy tới sau thời điểm nhảy giờ
}

export function utcOffsetLabel(date: Date, tz: string): string {
  const off = tzOffsetMinutes(date, tz);
  const sign = off >= 0 ? "+" : "−";
  const abs = Math.abs(off);
  const h = Math.floor(abs / 60);
  const mm = abs % 60;
  return `UTC${sign}${h}${mm ? ":" + String(mm).padStart(2, "0") : ""}`;
}

/** "28/11/2026 08:00 (UTC+9)" theo đồng hồ của múi giờ tz. */
export function formatInZone(date: Date, tz: string): string {
  const text = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: tz, hourCycle: "h23" }).format(date);
  return `${text} (${utcOffsetLabel(date, tz)})`;
}

/** Giá trị ban đầu cho ô datetime-local: "bây giờ + addMinutes" trên đồng hồ của múi giờ tz. */
export function nowLocalInput(tz: string, addMinutes = 60, now: Date = new Date()): string {
  const t = new Date(now.getTime() + addMinutes * 60000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(t);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Chuyển một thời điểm UTC thành giá trị cho ô datetime-local theo đồng hồ của múi giờ tz. */
export function utcToLocalInput(date: Date, tz: string): string {
  return nowLocalInput(tz, 0, date);
}
