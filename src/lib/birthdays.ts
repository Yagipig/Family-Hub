/**
 * Sinh nhật & ngày giỗ tính từ hồ sơ thành viên (KHÔNG có bảng sao chép).
 * Logic này PHẢN CHIẾU hàm SQL `_member_hits_on` (migration 20261030000004) — hai nơi phải cho cùng kết quả;
 * các ca kiểm thử dùng chung dữ liệu với supabase/tests/rls_events.sql.
 *
 * Dữ liệu đầu vào là hàng của view `members_view` (đã che trường theo quyền người xem): trường bị che là null nên
 * không tạo ra mục nào (người xem không biết ngày sinh thì không thấy sinh nhật).
 *
 * Quy tắc:
 *  - Sinh nhật: người còn sống. Chế độ solar/lunar/both; thiếu dữ liệu của chế độ đã chọn thì dùng chế độ còn lại.
 *    Suy ra âm lịch từ ngày dương đầy đủ (và ngược lại từ âm lịch đầy đủ + năm âm) khi chỉ có một loại.
 *  - Ngày giỗ: người đã mất. Biết ngày mất ÂM → theo âm lịch; chỉ biết ngày mất dương đầy đủ → suy ra âm; còn lại
 *    (chỉ tháng/ngày dương) → theo dương lịch.
 *  - Tuổi/lần giỗ: bỏ qua nếu ≤ 0 (chưa tới sinh nhật/giỗ đầu).
 *  - Quy tắc lặp âm lịch (tháng nhuận, ngày 30), 29/2: xem lunar.ts.
 */
import {
  type LunarDate, type SolarDate, addDays, compareSolar, dayOfWeek, diffDays, lunarOccurrencesInRange, lunarToSolar, solarAnniversaryInYear,
  solarToLunar,
} from "./lunar";

export type MemberLike = {
  id: string;
  full_name: string;
  branch_id?: string | null;
  birthday_mode: "solar" | "lunar" | "both" | string;
  is_deceased: boolean;
  birth_solar_year: number | null;
  birth_solar_month: number | null;
  birth_solar_day: number | null;
  birth_lunar_year: number | null;
  birth_lunar_month: number | null;
  birth_lunar_day: number | null;
  birth_lunar_leap: boolean | null;
  death_solar_year: number | null;
  death_solar_month: number | null;
  death_solar_day: number | null;
  death_lunar_month: number | null;
  death_lunar_day: number | null;
  death_lunar_leap: boolean | null;
};

export type OccurrenceKind = "birthday" | "death_anniversary";

export type MemberOccurrence = {
  memberId: string;
  name: string;
  kind: OccurrenceKind;
  /** Ngày dương của dịp này (ngày lịch, không phụ thuộc múi giờ). */
  date: SolarDate;
  /** Ngày âm lịch tương ứng của `date` (null nếu ngoài phạm vi hỗ trợ). */
  lunar: LunarDate | null;
  /** Tuổi sắp tới (sinh nhật) hoặc lần giỗ thứ mấy; null nếu thiếu năm. */
  years: number | null;
  /** Dịp này được tính theo lịch nào. */
  rule: "solar" | "lunar";
  /** Chỉ có ý nghĩa với lịch âm: tháng nhuận gốc không tồn tại năm này → tháng thường; ngày 30 → 29. */
  leapFellBackToNormal: boolean;
  dayClamped: boolean;
};

function validSolar(y: number | null, m: number | null, d: number | null): SolarDate | null {
  if (y === null || m === null || d === null) return null;
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1) return null;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > dim || y < 1900 || y > 2199) return null;
  return { year: y, month: m, day: d };
}

function safeLunar(s: SolarDate): LunarDate | null {
  try {
    return solarToLunar(s.year, s.month, s.day);
  } catch {
    return null;
  }
}

type Rule =
  | { kind: "solar"; month: number; day: number }
  | { kind: "lunar"; month: number; day: number; leap: boolean };

function inRangeSolar(rule: { month: number; day: number }, from: SolarDate, to: SolarDate): SolarDate[] {
  const out: SolarDate[] = [];
  // Ngày không tồn tại ở bất kỳ năm nào (31/2, 31/4...) không bao giờ tới (SQL _solar_md_occurs_on cũng vậy)
  const maxDay = rule.month === 2 ? 29 : [4, 6, 9, 11].includes(rule.month) ? 30 : 31;
  if (rule.month < 1 || rule.month > 12 || rule.day < 1 || rule.day > maxDay) return out;
  for (let y = from.year; y <= to.year; y++) {
    const s = solarAnniversaryInYear(rule.month, rule.day, y);
    if (compareSolar(s, from) >= 0 && compareSolar(s, to) <= 0) out.push(s);
  }
  return out;
}

function expandRule(rule: Rule, from: SolarDate, to: SolarDate) {
  if (rule.kind === "solar") {
    return inRangeSolar(rule, from, to).map((date) => ({ date, leapFell: false, clamped: false, rule: "solar" as const }));
  }
  return lunarOccurrencesInRange(rule.month, rule.day, rule.leap, from, to).map((o) => ({
    date: o.solar, leapFell: o.leapFellBackToNormal, clamped: o.dayClamped, rule: "lunar" as const,
  }));
}

/** Các dịp (sinh nhật hoặc ngày giỗ) của một thành viên trong khoảng [from, to] (gồm hai đầu). */
export function memberOccurrences(m: MemberLike, from: SolarDate, to: SolarDate): MemberOccurrence[] {
  const rules: Rule[] = [];
  let yearsOf: (date: SolarDate, lunar: LunarDate | null) => number | null;
  let kind: OccurrenceKind;

  if (!m.is_deceased) {
    kind = "birthday";
    let sm = m.birth_solar_month, sd = m.birth_solar_day;
    let lm = m.birth_lunar_month, ld = m.birth_lunar_day;
    let lleap = m.birth_lunar_leap ?? false;
    if (lm === null || ld === null) {                       // suy ra âm từ dương đầy đủ
      const full = validSolar(m.birth_solar_year, sm, sd);
      const l = full ? safeLunar(full) : null;
      if (l) { lm = l.month; ld = l.day; lleap = l.leap; }
    }
    if ((sm === null || sd === null) && m.birth_lunar_year !== null && lm !== null && ld !== null) {
      const s = lunarToSolar(m.birth_lunar_year, lm, ld, lleap);   // suy ra dương từ âm đầy đủ
      if (s) { sm = s.month; sd = s.day; }
    }
    const haveSolar = sm !== null && sd !== null;
    const haveLunar = lm !== null && ld !== null;
    const solarRule: Rule | null = haveSolar ? { kind: "solar", month: sm!, day: sd! } : null;
    const lunarRule: Rule | null = haveLunar ? { kind: "lunar", month: lm!, day: ld!, leap: lleap } : null;
    const mode = m.birthday_mode;
    if (mode === "solar" || mode === "both") if (solarRule) rules.push(solarRule);
    if (mode === "lunar" || mode === "both") if (lunarRule) rules.push(lunarRule);
    if (rules.length === 0) {                               // thiếu dữ liệu cho chế độ đã chọn → chế độ còn lại
      if (mode === "lunar" && solarRule) rules.push(solarRule);
      else if (mode === "solar" && lunarRule) rules.push(lunarRule);
    }
    yearsOf = (date, lunar) => {
      if (m.birthday_mode === "lunar" && m.birth_lunar_year !== null && lunar) return lunar.year - m.birth_lunar_year;
      if (m.birth_solar_year !== null) return date.year - m.birth_solar_year;
      return null;
    };
  } else {
    kind = "death_anniversary";
    let lm = m.death_lunar_month, ld = m.death_lunar_day;
    let lleap = m.death_lunar_leap ?? false;
    const full = validSolar(m.death_solar_year, m.death_solar_month, m.death_solar_day);
    const fullLunar = full ? safeLunar(full) : null;
    if ((lm === null || ld === null) && fullLunar) { lm = fullLunar.month; ld = fullLunar.day; lleap = fullLunar.leap; }
    let viaLunar = false;
    if (lm !== null && ld !== null) { rules.push({ kind: "lunar", month: lm, day: ld, leap: lleap }); viaLunar = true; }
    else if (m.death_solar_month !== null && m.death_solar_day !== null) {
      rules.push({ kind: "solar", month: m.death_solar_month, day: m.death_solar_day });
    }
    yearsOf = (date, lunar) => {
      if (viaLunar && fullLunar && lunar) return lunar.year - fullLunar.year;
      if (m.death_solar_year !== null) return date.year - m.death_solar_year;
      return null;
    };
  }

  const out = new Map<string, MemberOccurrence>();
  for (const r of rules) {
    for (const o of expandRule(r, from, to)) {
      const key = `${o.date.year}-${o.date.month}-${o.date.day}`;
      if (out.has(key)) continue;                           // chế độ "both" trùng ngày → một mục
      const lunar = safeLunar(o.date);
      const years = yearsOf(o.date, lunar);
      if (years !== null && years <= 0) continue;
      out.set(key, {
        memberId: m.id, name: m.full_name, kind, date: o.date, lunar, years, rule: o.rule,
        leapFellBackToNormal: o.leapFell, dayClamped: o.clamped,
      });
    }
  }
  return [...out.values()].sort((a, b) => compareSolar(a.date, b.date));
}

export type UpcomingOccurrence = MemberOccurrence & {
  /** Số ngày từ "hôm nay" của người xem tới dịp này (0 = hôm nay). */
  daysUntil: number;
  /** Thứ trong tuần (0 = Chủ nhật) của ngày dương. */
  weekday: number;
};

/**
 * Các dịp sắp tới trong `rangeDays` ngày kể từ `today` (ngày lịch theo MÚI GIỜ NGƯỜI XEM, gồm cả hôm nay).
 * Thuần: nhận danh sách hồ sơ đã che theo quyền (members_view) nên không lộ ngày người xem không được thấy.
 */
export function upcomingFromMembers(members: MemberLike[], today: SolarDate, rangeDays: number): UpcomingOccurrence[] {
  const days = Math.max(0, Math.min(Math.floor(rangeDays), 400));
  const to = addDays(today, days);
  const out: UpcomingOccurrence[] = [];
  for (const m of members) {
    for (const o of memberOccurrences(m, today, to)) {
      out.push({ ...o, daysUntil: diffDays(today, o.date), weekday: dayOfWeek(o.date) });
    }
  }
  out.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name, "vi"));
  return out;
}
