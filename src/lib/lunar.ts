/**
 * Âm lịch Việt Nam (múi giờ UTC+7) và các hàm ngày dương dùng chung của module Lịch.
 *
 * Thuật toán: Hồ Ngọc Đức ("Tính âm lịch Việt Nam", https://www.xemlicham.com/ - nguồn mở), dựa trên
 *   - ngày Sóc (trăng mới) tính theo Jean Meeus, lấy theo giờ địa phương UTC+7;
 *   - kinh độ Mặt Trời tại 0h địa phương để xác định Trung khí và tháng nhuận.
 * Thuần TypeScript, không phụ thuộc runtime hay thư viện ngoài (chạy được ở Node, trình duyệt, Edge).
 *
 * Phạm vi hỗ trợ: năm dương 1900–2199 (đã đối chiếu kiểm thử trong 1900–2100, xem lunar.test.ts).
 * MÚI GIỜ: âm lịch Việt Nam tính theo UTC+7, Trung Quốc theo UTC+8. Vì vậy ngày Sóc rơi vào khoảng
 * 23h–24h giờ Việt Nam thì Việt Nam sớm hơn Trung Quốc một ngày (có thể lệch cả một tháng nhuận).
 * Nguồn: Hồ Ngọc Đức (informatik.uni-leipzig.de/~duc/amlich/calrules_en.html): Tết Việt Nam 2007 = 17/2 (TQ 18/2),
 * 2030 = 2/2 (TQ 3/2), 2053 = 18/2 (TQ 19/2), 1985 = 21/1 (TQ 20/2, tháng nhuận Việt Nam 21/3–19/4/1985);
 * Nhân Dân 2006: Tết 1968 và 1969 Việt Nam sớm hơn TQ một ngày.
 * LỊCH SỬ: trước sắc lệnh ngày 8/8/1967 miền Bắc dùng UTC+8 (giống Trung Quốc), từ đó UTC+7 (miền Nam từ 1975).
 * Khi KHÔNG truyền `tz`, thư viện tự chọn UTC+8 cho ngày dương < 8/8/1967 và UTC+7 từ đó về sau.
 * Truyền `tz` rõ ràng (7 hoặc 8) để ép một múi giờ cố định (dùng trong kiểm thử).
 *
 * QUY TẮC LẶP LẠI THEO ÂM LỊCH (giỗ, sinh nhật âm lịch, sự kiện lặp theo âm) — hiển thị cả trên giao diện:
 *   1. Ngày mùng 1–29 luôn tồn tại. Nếu ngày gốc là 30 mà năm đó tháng chỉ có 29 ngày
 *      thì dùng NGÀY CUỐI THÁNG (29) của năm đó.
 *   2. Nếu ngày gốc nằm trong THÁNG NHUẬN (ví dụ nhuận tháng 4) mà năm đó KHÔNG có tháng nhuận đó
 *      thì dùng THÁNG THƯỜNG CÙNG SỐ (tháng 4). Năm nào có đúng tháng nhuận đó thì dùng tháng nhuận.
 *   3. Ngược lại, ngày gốc ở tháng thường thì luôn dùng tháng thường (kể cả năm có tháng nhuận cùng số).
 *   4. Ngày dương 29/2: năm không nhuận dùng 28/2.
 */

export type SolarDate = { year: number; month: number; day: number };
export type LunarDate = { year: number; month: number; day: number; leap: boolean };

/** Múi giờ chuẩn của âm lịch Việt Nam hiện nay (UTC+7). */
export const VN_TZ = 7;


export const MIN_YEAR = 1900;
export const MAX_YEAR = 2199;

const PI = Math.PI;
const INT = Math.floor;

// ---------------------------------------------------------------------------
// Ngày Julian & tiện ích ngày dương (lịch Gregory, không dùng Date nên không phụ thuộc múi giờ máy)
// ---------------------------------------------------------------------------

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInSolarMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

export function isValidSolar(y: number, m: number, d: number): boolean {
  return (
    Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) &&
    y >= 1 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= daysInSolarMonth(y, m)
  );
}

/** Số ngày Julian (JDN) của ngày dương Gregory. */
function solarToJdRaw(y: number, m: number, d: number): number {
  const a = INT((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + INT((153 * mm + 2) / 5) + 365 * yy + INT(yy / 4) - INT(yy / 100) + INT(yy / 400) - 32045;
}

export function solarToJd(y: number, m: number, d: number): number {
  return solarToJdRaw(y, m, d);
}

export function jdToSolar(jd: number): SolarDate {
  const a = jd + 32044;
  const b = INT((4 * a + 3) / 146097);
  const c = a - INT((b * 146097) / 4);
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  return {
    day: e - INT((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * INT(m / 10),
    year: b * 100 + d - 4800 + INT(m / 10),
  };
}

/** Từ ngày này (sắc lệnh 8/8/1967) Việt Nam dùng UTC+7; trước đó UTC+8. */
const UTC7_FROM_JD = solarToJdRaw(1967, 8, 8);

function tzForJd(jd: number): number {
  return jd < UTC7_FROM_JD ? 8 : VN_TZ;
}

export function addDays(s: SolarDate, n: number): SolarDate {
  return jdToSolar(solarToJd(s.year, s.month, s.day) + n);
}

/** Số ngày từ a đến b (b - a). */
export function diffDays(a: SolarDate, b: SolarDate): number {
  return solarToJd(b.year, b.month, b.day) - solarToJd(a.year, a.month, a.day);
}

/** Thứ trong tuần: 0 = Chủ nhật … 6 = Thứ bảy. */
export function dayOfWeek(s: SolarDate): number {
  return (solarToJd(s.year, s.month, s.day) + 1) % 7;
}

export function compareSolar(a: SolarDate, b: SolarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function solarKey(s: SolarDate): string {
  return `${String(s.year).padStart(4, "0")}-${String(s.month).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`;
}

export function parseSolarKey(k: string): SolarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  if (!m) return null;
  const s = { year: +m[1], month: +m[2], day: +m[3] };
  return isValidSolar(s.year, s.month, s.day) ? s : null;
}

// ---------------------------------------------------------------------------
// Thiên văn (Hồ Ngọc Đức)
// ---------------------------------------------------------------------------

/** Ngày Julian (số nguyên) của ngày Sóc thứ k tính từ 1900-01-01, theo giờ địa phương `tz`. */
function newMoonDay(k: number, tz: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  c1 -= 0.4068 * Math.sin(Mpr * dr) - 0.0161 * Math.sin(dr * 2 * Mpr);
  c1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
  c1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  c1 -= 0.0074 * Math.sin(dr * (M - Mpr)) - 0.0004 * Math.sin(dr * (2 * F + M));
  c1 -= 0.0004 * Math.sin(dr * (2 * F - M)) + 0.0006 * Math.sin(dr * (2 * F + Mpr));
  c1 += 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return INT(jd1 + c1 - deltat + 0.5 + tz / 24);
}

/** Cung (0..11) của kinh độ Mặt Trời tại 0h địa phương của ngày Julian `jdn`. */
function sunLongitudeArc(jdn: number, tz: number): number {
  const T = (jdn - 2451545.5 - tz / 24) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= PI * 2 * INT(L / (PI * 2));
  return INT((L / PI) * 6);
}

const memo11 = new Map<string, number>();
/** Ngày Julian bắt đầu tháng 11 âm lịch (tháng chứa Đông chí) của năm dương `yy`. */
function lunarMonth11(yy: number, tz: number): number {
  const key = `${tz}:${yy}`;
  const hit = memo11.get(key);
  if (hit !== undefined) return hit;
  const off = solarToJd(yy, 12, 31) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = newMoonDay(k, tz);
  if (sunLongitudeArc(nm, tz) >= 9) nm = newMoonDay(k - 1, tz);
  memo11.set(key, nm);
  return nm;
}

const memoLeap = new Map<string, number>();
/** Vị trí (số tháng kể từ tháng 11) của tháng nhuận trong năm có 13 tháng bắt đầu từ `a11`. */
function leapMonthOffset(a11: number, tz: number): number {
  const key = `${tz}:${a11}`;
  const hit = memoLeap.get(key);
  if (hit !== undefined) return hit;
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let i = 1;
  let arc = sunLongitudeArc(newMoonDay(k + i, tz), tz);
  let last: number;
  do {
    last = arc;
    i++;
    arc = sunLongitudeArc(newMoonDay(k + i, tz), tz);
  } while (arc !== last && i < 14);
  memoLeap.set(key, i - 1);
  return i - 1;
}

function checkRange(y: number) {
  if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) {
    throw new RangeError(`Năm ${y} nằm ngoài phạm vi hỗ trợ ${MIN_YEAR}–${MAX_YEAR}`);
  }
}

// ---------------------------------------------------------------------------
// Chuyển đổi
// ---------------------------------------------------------------------------

function jdToLunar(dayNumber: number, yy: number, tzIn?: number): LunarDate {
  const tz = tzIn ?? tzForJd(dayNumber);
  // k ước lượng theo chu kỳ trung bình có thể lệch ±1 so với ngày Sóc thật: hiệu chỉnh bằng vòng lặp
  // (bản gốc chỉ thử k+1 và k nên thỉnh thoảng cho "ngày 0" ở ngày cuối tháng).
  let k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  while (newMoonDay(k + 1, tz) <= dayNumber) k++;
  let monthStart = newMoonDay(k, tz);
  while (monthStart > dayNumber) {
    k--;
    monthStart = newMoonDay(k, tz);
  }
  let a11 = lunarMonth11(yy, tz);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = lunarMonth11(yy - 1, tz);
  } else {
    lunarYear = yy + 1;
    b11 = lunarMonth11(yy + 1, tz);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11, tz);
    if (diff >= leapDiff) {
      lunarMonth = diff + 10;
      if (diff === leapDiff) leap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { year: lunarYear, month: lunarMonth, day: lunarDay, leap };
}

function lunarOfJd(jd: number, tz?: number): LunarDate {
  return jdToLunar(jd, jdToSolar(jd).year, tz);
}

/** Ngày dương → ngày âm lịch Việt Nam. Ném RangeError nếu ngày không hợp lệ hoặc ngoài phạm vi. */
export function solarToLunar(y: number, m: number, d: number, tz?: number): LunarDate {
  checkRange(y);
  if (!isValidSolar(y, m, d)) throw new RangeError(`Ngày dương không hợp lệ: ${y}-${m}-${d}`);
  return jdToLunar(solarToJd(y, m, d), y, tz);
}

function lunarToSolarRaw(ly: number, lm: number, ld: number, leap: boolean, tz: number): SolarDate | null {
  let a11: number;
  let b11: number;
  if (lm < 11) {
    a11 = lunarMonth11(ly - 1, tz);
    b11 = lunarMonth11(ly, tz);
  } else {
    a11 = lunarMonth11(ly, tz);
    b11 = lunarMonth11(ly + 1, tz);
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lm - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11, tz);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && lm !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) {
    return null;
  }
  const monthStart = newMoonDay(k + off, tz);
  return jdToSolar(monthStart + ld - 1);
}

/**
 * Ngày âm → ngày dương. Trả về null nếu ngày âm KHÔNG tồn tại
 * (tháng nhuận không có trong năm đó, ngày 30 của tháng thiếu, tháng/ngày ngoài khoảng…).
 */
export function lunarToSolar(
  ly: number, lm: number, ld: number, leap = false, tz?: number,
): SolarDate | null {
  if (!Number.isInteger(ly) || ly < MIN_YEAR || ly > MAX_YEAR) return null;
  if (!Number.isInteger(lm) || lm < 1 || lm > 12 || !Number.isInteger(ld) || ld < 1 || ld > 30) return null;
  // Tự chọn múi giờ: năm ≤ 1967 thử UTC+8 trước (rồi UTC+7 cho nửa cuối 1967); sau đó UTC+7.
  const candidates = tz !== undefined ? [tz] : ly <= 1967 ? [8, 7] : [7];
  for (const z of candidates) {
    const s = lunarToSolarRaw(ly, lm, ld, leap, z);
    if (!s || s.year < MIN_YEAR || s.year > MAX_YEAR) continue;
    // Xác nhận bằng chuyển ngược: loại ngày 30 của tháng 29 ngày, tháng nhuận sai…
    const back = lunarOfJd(solarToJd(s.year, s.month, s.day), tz);
    if (back.year === ly && back.month === lm && back.day === ld && back.leap === leap) return s;
  }
  return null;
}

/** Số ngày (29 hoặc 30) của một tháng âm; null nếu tháng đó không tồn tại. */
export function daysInLunarMonth(ly: number, lm: number, leap = false, tz?: number): number | null {
  const first = lunarToSolar(ly, lm, 1, leap, tz);
  if (!first) return null;
  const next = lunarOfJd(solarToJd(first.year, first.month, first.day) + 29, tz);
  // Sau 29 ngày: nếu đã sang mùng 1 thì tháng thiếu (29), ngược lại tháng đủ (30).
  return next.day === 1 ? 29 : 30;
}

/** Tháng nhuận của năm âm lịch `ly` (1–12), 0 nếu năm đó không nhuận. */
export function leapMonthOfLunarYear(ly: number, tz?: number): number {
  checkRange(ly);
  for (let m = 1; m <= 12; m++) if (lunarToSolar(ly, m, 1, true, tz)) return m;
  return 0;
}

// ---------------------------------------------------------------------------
// Lặp lại hằng năm (giỗ, sinh nhật âm, sự kiện)
// ---------------------------------------------------------------------------

export type LunarOccurrence = {
  solar: SolarDate;
  /** Ngày âm thực tế được dùng (có thể khác ngày gốc do quy tắc 1–2 ở đầu file). */
  lunar: LunarDate;
  /** Tháng nhuận gốc không tồn tại trong năm này → dùng tháng thường cùng số. */
  leapFellBackToNormal: boolean;
  /** Ngày gốc là 30 nhưng tháng chỉ có 29 ngày → dùng ngày 29. */
  dayClamped: boolean;
};

/** Ngày dương của dịp lặp trong năm âm lịch `ly`, áp dụng quy tắc ở đầu file. null nếu ngoài phạm vi. */
export function lunarOccurrenceInYear(
  ly: number, lm: number, ld: number, leap = false, tz?: number,
): LunarOccurrence | null {
  if (!Number.isInteger(lm) || lm < 1 || lm > 12 || !Number.isInteger(ld) || ld < 1 || ld > 30) return null;
  if (ly < MIN_YEAR || ly > MAX_YEAR) return null;
  let useLeap = leap;
  let leapFellBackToNormal = false;
  if (leap && !lunarToSolar(ly, lm, 1, true, tz)) {
    useLeap = false;
    leapFellBackToNormal = true;
  }
  const len = daysInLunarMonth(ly, lm, useLeap, tz);
  if (len === null) return null;
  const day = Math.min(ld, len);
  const solar = lunarToSolar(ly, lm, day, useLeap, tz);
  if (!solar) return null;
  return {
    solar,
    lunar: { year: ly, month: lm, day, leap: useLeap },
    leapFellBackToNormal,
    dayClamped: day !== ld,
  };
}

/**
 * Lần tới (kể từ `from`, tính cả chính ngày `from` nếu `inclusive`) mà ngày âm (lm, ld, leap) rơi vào,
 * theo quy tắc lặp ở đầu file. null chỉ khi vượt phạm vi hỗ trợ.
 */
export function nextSolarOccurrenceOfLunarDate(
  lm: number, ld: number, leap: boolean, from: SolarDate, inclusive = true, tz?: number,
): LunarOccurrence | null {
  const here = solarToLunar(from.year, from.month, from.day, tz);
  for (let ly = here.year; ly <= here.year + 2; ly++) {
    const occ = lunarOccurrenceInYear(ly, lm, ld, leap, tz);
    if (!occ) continue;
    const c = compareSolar(occ.solar, from);
    if (c > 0 || (c === 0 && inclusive)) return occ;
  }
  return null;
}

/** Mọi dịp lặp âm lịch rơi trong [from, to] (gồm cả hai đầu), theo thứ tự thời gian. */
export function lunarOccurrencesInRange(
  lm: number, ld: number, leap: boolean, from: SolarDate, to: SolarDate, tz?: number,
): LunarOccurrence[] {
  const out: LunarOccurrence[] = [];
  const y1 = solarToLunar(from.year, from.month, from.day, tz).year;
  const y2 = solarToLunar(to.year, to.month, to.day, tz).year;
  for (let ly = y1; ly <= y2; ly++) {
    const occ = lunarOccurrenceInYear(ly, lm, ld, leap, tz);
    if (occ && compareSolar(occ.solar, from) >= 0 && compareSolar(occ.solar, to) <= 0) out.push(occ);
  }
  return out;
}

/** Ngày kỷ niệm dương lịch trong năm `y`: 29/2 năm không nhuận dùng 28/2. */
export function solarAnniversaryInYear(month: number, day: number, y: number): SolarDate {
  const d = month === 2 && day === 29 && !isLeapYear(y) ? 28 : day;
  return { year: y, month, day: Math.min(d, daysInSolarMonth(y, month)) };
}

export function nextSolarAnniversary(month: number, day: number, from: SolarDate, inclusive = true): SolarDate {
  for (let y = from.year; y <= from.year + 1; y++) {
    const s = solarAnniversaryInYear(month, day, y);
    const c = compareSolar(s, from);
    if (c > 0 || (c === 0 && inclusive)) return s;
  }
  return solarAnniversaryInYear(month, day, from.year + 2);
}

// ---------------------------------------------------------------------------
// Can Chi
// ---------------------------------------------------------------------------

const CAN = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"];
const CHI = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"];

/** Can Chi của năm (âm lịch), ví dụ canChiYear(2024) = "Giáp Thìn", canChiYear(1984) = "Giáp Tý". */
export function canChiYear(lunarYear: number): string {
  const can = (((lunarYear + 6) % 10) + 10) % 10;
  const chi = (((lunarYear + 8) % 12) + 12) % 12;
  return `${CAN[can]} ${CHI[chi]}`;
}

/** Can Chi của ngày dương (theo ngày Julian). */
export function canChiDay(s: SolarDate): string {
  const jd = solarToJd(s.year, s.month, s.day);
  return `${CAN[(jd + 9) % 10]} ${CHI[(jd + 1) % 12]}`;
}

/** "15/8" hoặc "15/8 (nhuận)" — dùng cho hiển thị ngắn. */
export function formatLunarShort(l: { day: number; month: number; leap?: boolean }): string {
  return `${l.day}/${l.month}${l.leap ? " nhuận" : ""}`;
}

/** Tên mô tả dài: "15 tháng 8 âm lịch (Giáp Thìn)". */
export function formatLunarLong(l: LunarDate): string {
  return `${l.day} tháng ${l.month}${l.leap ? " nhuận" : ""} âm lịch (${canChiYear(l.year)})`;
}
