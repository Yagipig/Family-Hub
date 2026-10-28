/**
 * Mô hình lịch (thuần TypeScript, kiểm thử được): lưới tháng, trải sự kiện lặp thành các lần diễn ra,
 * gộp sinh nhật/ngày giỗ + sự kiện thành các mục hiển thị theo NGÀY LỊCH của người xem.
 *
 * Quy ước múi giờ:
 *  - Sự kiện có giờ là một thời điểm UTC; ngày hiển thị trên lịch của người xem = ngày địa phương của người xem.
 *  - Sự kiện cả ngày và sinh nhật/ngày giỗ là NGÀY LỊCH, không đổi theo múi giờ.
 *  - Sự kiện lặp: ngày lặp tính theo múi giờ GỐC của sự kiện, giữ nguyên giờ trong ngày ở múi giờ gốc.
 */
import {
  type LunarDate, type SolarDate, addDays, compareSolar, dayOfWeek, daysInSolarMonth, diffDays, lunarOccurrencesInRange,
  parseSolarKey, solarAnniversaryInYear, solarKey, solarToLunar,
} from "./lunar";
import { localDate, wallTimeToUtc, zonedParts } from "./tz";
import { type MemberLike, memberOccurrences } from "./birthdays";

export type EventKind = "gathering" | "anniversary" | "memorial" | "reminder" | "other";
export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  gathering: "Họp mặt",
  anniversary: "Kỷ niệm",
  memorial: "Giỗ / tưởng niệm",
  reminder: "Nhắc việc",
  other: "Khác",
};

export type EventRow = {
  id: string;
  family_id: string;
  branch_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  kind: EventKind | string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  timezone: string;
  visibility: "family" | "branch" | string;
  recurrence: "none" | "yearly_solar" | "yearly_lunar" | string;
  lunar_month: number | null;
  lunar_day: number | null;
  lunar_leap: boolean;
  created_by: string | null;
  cancelled_at: string | null;
  cancel_reason?: string | null;
};

export type EventInstance = {
  eventId: string;
  /** Ngày diễn ra theo múi giờ gốc (dùng làm khóa RSVP). */
  occurrence: SolarDate;
  startUtc: Date;
  endUtc: Date | null;
  allDay: boolean;
  /** Các ngày lịch (của người xem) mà lần diễn ra này phủ lên, theo thứ tự. */
  days: SolarDate[];
};

const MAX_SPAN_DAYS = 31;

/** Trải một sự kiện thành các lần diễn ra có ít nhất một ngày nằm trong [from, to] (ngày lịch của người xem). */
export function expandEvent(ev: EventRow, from: SolarDate, to: SolarDate, viewerTz: string): EventInstance[] {
  const start = new Date(ev.starts_at);
  const end = ev.ends_at ? new Date(ev.ends_at) : null;
  const tz = ev.timezone;
  const wall = zonedParts(start, tz);
  const startDate: SolarDate = { year: wall.year, month: wall.month, day: wall.day };
  const durationMs = end ? Math.max(0, end.getTime() - start.getTime()) : 0;
  // Biên rộng ±2 ngày vì ngày của người xem có thể lệch ngày gốc
  const lo = addDays(from, -2 - MAX_SPAN_DAYS);
  const hi = addDays(to, 2);

  const occurrences: SolarDate[] = [];
  if (ev.recurrence === "yearly_solar") {
    for (let y = lo.year; y <= hi.year; y++) {
      const s = solarAnniversaryInYear(startDate.month, startDate.day, y);
      if (compareSolar(s, startDate) >= 0 && compareSolar(s, lo) >= 0 && compareSolar(s, hi) <= 0) occurrences.push(s);
    }
  } else if (ev.recurrence === "yearly_lunar" && ev.lunar_month !== null && ev.lunar_day !== null) {
    const from2 = compareSolar(lo, startDate) < 0 ? startDate : lo;
    if (compareSolar(from2, hi) <= 0) {
      for (const o of lunarOccurrencesInRange(ev.lunar_month, ev.lunar_day, ev.lunar_leap, from2, hi)) occurrences.push(o.solar);
    }
  } else if (compareSolar(startDate, lo) >= 0 && compareSolar(startDate, hi) <= 0) {
    occurrences.push(startDate);
  }

  const out: EventInstance[] = [];
  for (const occ of occurrences) {
    let startUtc: Date;
    let endUtc: Date | null;
    let days: SolarDate[];
    if (ev.all_day) {
      startUtc = wallTimeToUtc(occ.year, occ.month, occ.day, 0, 0, tz);
      endUtc = end ? new Date(startUtc.getTime() + durationMs) : null;
      let span = 0;
      if (end) {
        const last = localDate(new Date(end.getTime() - 1), tz);
        span = Math.min(MAX_SPAN_DAYS, Math.max(0, diffDays(startDate, last)));
      }
      days = Array.from({ length: span + 1 }, (_, i) => addDays(occ, i));       // ngày lịch, không đổi theo múi giờ
    } else {
      startUtc = wallTimeToUtc(occ.year, occ.month, occ.day, wall.hour, wall.minute, tz);
      endUtc = end ? new Date(startUtc.getTime() + durationMs) : null;
      const d1 = localDate(startUtc, viewerTz);
      const d2 = endUtc ? localDate(endUtc, viewerTz) : d1;
      const span = Math.min(MAX_SPAN_DAYS, Math.max(0, diffDays(d1, d2)));
      days = Array.from({ length: span + 1 }, (_, i) => addDays(d1, i));
    }
    if (days.some((d) => compareSolar(d, from) >= 0 && compareSolar(d, to) <= 0)) {
      out.push({ eventId: ev.id, occurrence: occ, startUtc, endUtc, allDay: ev.all_day, days });
    }
  }
  return out;
}

/** Lần diễn ra kế tiếp (hoặc đang diễn ra) của một sự kiện kể từ `now`, trong tối đa `horizonDays` ngày. */
export function nextInstance(ev: EventRow, now: Date, viewerTz: string, horizonDays = 800): EventInstance | null {
  const today = localDate(now, viewerTz);
  const list = expandEvent(ev, addDays(today, -1), addDays(today, horizonDays), viewerTz)
    .filter((i) => (i.endUtc ?? i.startUtc).getTime() >= now.getTime() - 3600_000 || i.allDay && i.days.some((d) => compareSolar(d, today) >= 0));
  list.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
  return list[0] ?? null;
}

export type CalendarItemType = "birthday" | "death_anniversary" | "event";
export type CalendarItem = {
  key: string;
  type: CalendarItemType;
  /** Ngày lịch của người xem mà mục này xuất hiện. */
  date: string;
  title: string;
  subtitle?: string;
  /** Giờ theo múi giờ người xem ("19:30"), chỉ với sự kiện có giờ và là ngày đầu. */
  time?: string;
  href: string;
  eventKind?: string;
  cancelled?: boolean;
  /** Ngày âm lịch tương ứng (chuỗi "3/10"). */
  lunarText?: string;
  /** Thứ tự trong ngày: cả ngày (0), sinh nhật (1), giỗ (2), rồi sự kiện có giờ theo giờ. */
  sort: number;
};

export function lunarShort(l: LunarDate | null): string | undefined {
  return l ? `${l.day}/${l.month}${l.leap ? " nhuận" : ""}` : undefined;
}

function lunarOf(s: SolarDate): LunarDate | null {
  try {
    return solarToLunar(s.year, s.month, s.day);
  } catch {
    return null;
  }
}

export function buildCalendarItems(input: {
  events: EventRow[];
  members: MemberLike[];
  viewerTz: string;
  from: SolarDate;
  to: SolarDate;
}): CalendarItem[] {
  const { events, members, viewerTz, from, to } = input;
  const items: CalendarItem[] = [];
  for (const ev of events) {
    for (const inst of expandEvent(ev, from, to, viewerTz)) {
      inst.days.forEach((d, idx) => {
        if (compareSolar(d, from) < 0 || compareSolar(d, to) > 0) return;
        const first = idx === 0;
        items.push({
          key: `ev:${ev.id}:${solarKey(inst.occurrence)}:${solarKey(d)}`,
          type: "event",
          date: solarKey(d),
          title: ev.title,
          subtitle: first ? undefined : "(tiếp tục)",
          time: first && !inst.allDay ? pad2(zonedParts(inst.startUtc, viewerTz).hour) + ":" + pad2(zonedParts(inst.startUtc, viewerTz).minute) : undefined,
          href: `/lich/su-kien/${ev.id}?ngay=${solarKey(inst.occurrence)}`,
          eventKind: ev.kind,
          cancelled: ev.cancelled_at !== null,
          lunarText: lunarShort(lunarOf(d)),
          sort: inst.allDay ? 0 : zonedParts(inst.startUtc, viewerTz).hour * 60 + zonedParts(inst.startUtc, viewerTz).minute + 10,
        });
      });
    }
  }
  for (const m of members) {
    for (const o of memberOccurrences(m, from, to)) {
      const isBirthday = o.kind === "birthday";
      items.push({
        key: `${o.kind}:${m.id}:${solarKey(o.date)}`,
        type: o.kind,
        date: solarKey(o.date),
        title: isBirthday ? `Sinh nhật ${o.name}` : `Giỗ ${o.name}`,
        subtitle: o.years !== null ? (isBirthday ? `Tròn ${o.years} tuổi` : `Giỗ lần thứ ${o.years}`) : undefined,
        href: `/lich?ngay=${solarKey(o.date)}`,
        lunarText: lunarShort(o.lunar),
        sort: isBirthday ? 1 : 2,
      });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.sort - b.sort || a.title.localeCompare(b.title, "vi"));
  return items;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// ---------------------------------------------------------------------------
// Lưới tháng
// ---------------------------------------------------------------------------

export type GridDay = { date: SolarDate; key: string; inMonth: boolean; lunar: LunarDate | null };

/** Lưới 6 tuần × 7 ngày, tuần bắt đầu từ thứ Hai (thói quen lịch Việt Nam). */
export function monthGrid(year: number, month: number): GridDay[][] {
  const first: SolarDate = { year, month, day: 1 };
  const offset = (dayOfWeek(first) + 6) % 7;     // số ngày từ thứ Hai
  const gridStart = addDays(first, -offset);
  const weeks: GridDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(gridStart, w * 7 + d);
      row.push({ date, key: solarKey(date), inMonth: date.month === month && date.year === year, lunar: lunarOf(date) });
    }
    weeks.push(row);
  }
  return weeks;
}

export function parseMonthParam(v: string | undefined, today: SolarDate): { year: number; month: number } {
  const m = v ? /^(\d{4})-(\d{2})$/.exec(v) : null;
  if (m) {
    const y = +m[1], mo = +m[2];
    if (mo >= 1 && mo <= 12 && y >= 1901 && y <= 2099) return { year: y, month: mo };
  }
  return { year: today.year, month: today.month };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12 + 12) % 12 + 1 };
}

export const monthKey = (y: number, m: number) => `${y}-${pad2(m)}`;

export function monthRange(year: number, month: number): { from: SolarDate; to: SolarDate } {
  const grid = monthGrid(year, month);
  return { from: grid[0][0].date, to: grid[5][6].date };
}

export { daysInSolarMonth, parseSolarKey };
