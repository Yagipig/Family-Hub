/**
 * Tiện ích múi giờ IANA thuần TypeScript (dùng Intl, chạy ở máy chủ lẫn trình duyệt).
 * Nguyên tắc của module Lịch: ngày sinh/ngày giỗ là NGÀY LỊCH (không đổi theo múi giờ);
 * giờ của sự kiện là một thời điểm tuyệt đối (UTC) và được hiển thị theo múi giờ của người xem
 * kèm giờ tại múi giờ gốc của sự kiện.
 */
import { type SolarDate, solarKey } from "./lunar";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Các thành phần giờ-lịch của một thời điểm tại múi giờ `tz`. weekday: 0 = Chủ nhật. */
export function zonedParts(date: Date, tz: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) out[p.type] = p.value;
  return {
    year: +out.year, month: +out.month, day: +out.day,
    hour: +out.hour === 24 ? 0 : +out.hour, minute: +out.minute, second: +out.second,
    weekday: WEEKDAYS.indexOf(out.weekday),
  };
}

/** Ngày lịch (theo múi giờ tz) của một thời điểm. */
export function localDate(date: Date, tz: string): SolarDate {
  const p = zonedParts(date, tz);
  return { year: p.year, month: p.month, day: p.day };
}

export function localDateKey(date: Date, tz: string): string {
  return solarKey(localDate(date, tz));
}

/** Độ lệch UTC của múi giờ tại thời điểm `date`, tính bằng phút (UTC+7 = 420). */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * Giờ tường (năm, tháng, ngày, giờ, phút theo múi giờ tz) → thời điểm UTC.
 * Giờ không tồn tại (nhảy giờ mùa hè) được dời tới sau; giờ lặp (lùi giờ) lấy lần đầu.
 */
export function wallTimeToUtc(y: number, m: number, d: number, hh: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mi);
  const oBefore = tzOffsetMinutes(new Date(guess - 86400000), tz);
  const oAfter = tzOffsetMinutes(new Date(guess + 86400000), tz);
  const valid = [oBefore, oAfter]
    .map((o) => ({ o, utc: guess - o * 60000 }))
    .filter((c) => tzOffsetMinutes(new Date(c.utc), tz) === c.o)
    .sort((a, b) => a.utc - b.utc);
  if (valid.length > 0) return new Date(valid[0].utc); // lặp giờ: lấy lần đầu
  return new Date(guess - oBefore * 60000); // giờ không tồn tại: dời tới sau
}

/** "UTC+7", "UTC+5:30", "UTC-7" */
export function formatOffset(date: Date, tz: string): string {
  const off = tzOffsetMinutes(date, tz);
  const sign = off < 0 ? "-" : "+";
  const a = Math.abs(off);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `UTC${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

const WD_VI = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
export const weekdayVi = (w: number) => WD_VI[((w % 7) + 7) % 7];
export const weekdayShortVi = (w: number) => ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][((w % 7) + 7) % 7];

const pad = (n: number) => String(n).padStart(2, "0");

/** "19:30 · Thứ tư 11/11/2026" theo múi giờ tz. */
export function formatDateTimeVi(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)} · ${weekdayVi(p.weekday)} ${pad(p.day)}/${pad(p.month)}/${p.year}`;
}

export function formatDateVi(s: SolarDate): string {
  return `${pad(s.day)}/${pad(s.month)}/${s.year}`;
}

export function formatTimeVi(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}
