import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import {
  addDays, canChiDay, canChiYear, compareSolar, dayOfWeek, daysInLunarMonth, daysInSolarMonth, diffDays,
  jdToSolar, leapMonthOfLunarYear, lunarOccurrenceInYear, lunarOccurrencesInRange, lunarToSolar,
  nextSolarAnniversary, nextSolarOccurrenceOfLunarDate, solarKey, solarToJd, solarToLunar,
  type LunarDate, type SolarDate,
} from "./lunar";

const require = createRequire(import.meta.url);
// lunar-javascript tính theo lịch Trung Quốc (UTC+8) — chỉ dùng làm "trọng tài" độc lập.
const { Solar, Lunar } = require("lunar-javascript") as {
  Solar: { fromYmd(y: number, m: number, d: number): { getLunar(): { getYear(): number; getMonth(): number; getDay(): number } } };
  Lunar: { fromYmd(y: number, m: number, d: number): { getSolar(): { toYmd(): string } } };
};

function cn(y: number, m: number, d: number): LunarDate {
  const l = Solar.fromYmd(y, m, d).getLunar();
  const mo = l.getMonth();
  return { year: l.getYear(), month: Math.abs(mo), day: l.getDay(), leap: mo < 0 };
}
const same = (a: LunarDate, b: LunarDate) => a.year === b.year && a.month === b.month && a.day === b.day && a.leap === b.leap;

const FIRST = solarToJd(1900, 1, 1);
const LAST = solarToJd(2100, 12, 31);

/** Bộ sinh số giả ngẫu nhiên cố định hạt giống (kiểm thử lặp lại được). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Các tháng mà thuật toán (Meeus rút gọn, giống bản gốc của Hồ Ngọc Đức) lệch lịch Trung Quốc chính xác
 * dù CÙNG múi giờ UTC+8: ngày Sóc rơi cách nửa đêm vài phút nên sai số thiên văn đẩy sang ngày kề bên.
 * Đây là giới hạn đã biết của thuật toán, không phải lỗi chuyển đổi. Mỗi mục: [ngày dương đầu, cuối] của tháng lệch.
 */
const KNOWN_APPROX_MONTHS_UTC8: Array<[string, string]> = [
  ["1914-11-17", "1914-12-16"],
  ["1916-02-03", "1916-03-03"],
  ["1920-11-10", "1920-12-09"],
  ["2057-09-28", "2057-10-27"],
  ["2097-08-07", "2097-09-05"],
];
const inApprox = (s: SolarDate) =>
  KNOWN_APPROX_MONTHS_UTC8.some(([a, b]) => solarKey(s) >= a && solarKey(s) <= b);

describe("tiện ích ngày dương", () => {
  it("solarToJd/jdToSolar khứ hồi và khớp Date.UTC cho mọi ngày 1900–2100", () => {
    for (let jd = FIRST; jd <= LAST; jd++) {
      const s = jdToSolar(jd);
      expect(solarToJd(s.year, s.month, s.day)).toBe(jd);
      const date = new Date(Date.UTC(s.year, s.month - 1, s.day));
      expect([date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]).toEqual([s.year, s.month, s.day]);
      expect(dayOfWeek(s)).toBe(date.getUTCDay());
    }
  });
  it("addDays, diffDays, daysInSolarMonth", () => {
    expect(addDays({ year: 2024, month: 2, day: 28 }, 1)).toEqual({ year: 2024, month: 2, day: 29 });
    expect(addDays({ year: 2023, month: 12, day: 31 }, 1)).toEqual({ year: 2024, month: 1, day: 1 });
    expect(diffDays({ year: 2026, month: 1, day: 1 }, { year: 2027, month: 1, day: 1 })).toBe(365);
    expect(daysInSolarMonth(1900, 2)).toBe(28);
    expect(daysInSolarMonth(2000, 2)).toBe(29);
  });
  it("29/2 năm không nhuận dùng 28/2", () => {
    expect(nextSolarAnniversary(2, 29, { year: 2025, month: 1, day: 1 })).toEqual({ year: 2025, month: 2, day: 28 });
    expect(nextSolarAnniversary(2, 29, { year: 2027, month: 3, day: 1 })).toEqual({ year: 2028, month: 2, day: 29 });
    expect(nextSolarAnniversary(5, 10, { year: 2026, month: 5, day: 10 }, true)).toEqual({ year: 2026, month: 5, day: 10 });
    expect(nextSolarAnniversary(5, 10, { year: 2026, month: 5, day: 10 }, false)).toEqual({ year: 2027, month: 5, day: 10 });
  });
});

describe("mốc Tết/tháng nhuận đã xác minh bằng nguồn ngoài", () => {
  // Tết 2020–2027: Việt Nam và Trung Quốc trùng nhau, các mốc phổ biến.
  const TET_SHARED: Array<[number, string]> = [
    [2020, "2020-01-25"], [2021, "2021-02-12"], [2022, "2022-02-01"], [2023, "2023-01-22"],
    [2024, "2024-02-10"], [2025, "2025-01-29"], [2026, "2026-02-17"], [2027, "2027-02-06"],
  ];
  it.each(TET_SHARED)("Tết %i = mùng 1 tháng 1 ngày %s", (year, key) => {
    const [y, m, d] = key.split("-").map(Number);
    expect(solarToLunar(y, m, d)).toEqual({ year, month: 1, day: 1, leap: false });
    expect(lunarToSolar(year, 1, 1)).toEqual({ year: y, month: m, day: d });
    // Cùng ngày với lịch Trung Quốc
    expect(same(cn(y, m, d), { year, month: 1, day: 1, leap: false })).toBe(true);
  });

  // Nguồn: Hồ Ngọc Đức (informatik.uni-leipzig.de/~duc/amlich/calrules_en.html): 2007, 2030, 2053, 1985;
  // Báo Nhân Dân 2006: 1968 và 1969 Việt Nam sớm hơn Trung Quốc một ngày.
  const TET_VN_EARLIER: Array<[number, string, string]> = [
    [1968, "1968-01-29", "1968-01-30"],
    [1969, "1969-02-16", "1969-02-17"],
    [1985, "1985-01-21", "1985-02-20"], // Việt Nam sớm hơn một THÁNG (Trung Quốc có tháng nhuận 10 năm 1984)
    [2007, "2007-02-17", "2007-02-18"],
    [2030, "2030-02-02", "2030-02-03"],
    [2053, "2053-02-18", "2053-02-19"],
  ];
  it.each(TET_VN_EARLIER)("Tết Việt Nam %i = %s (Trung Quốc %s)", (year, vn, china) => {
    const [y, m, d] = vn.split("-").map(Number);
    const [cy, cm, cd] = china.split("-").map(Number);
    expect(solarToLunar(y, m, d)).toEqual({ year, month: 1, day: 1, leap: false });
    expect(lunarToSolar(year, 1, 1)).toEqual({ year: y, month: m, day: d });
    // và lịch Trung Quốc (thư viện kia) thật sự khác ở các ngày này
    expect(same(cn(y, m, d), { year, month: 1, day: 1, leap: false })).toBe(false);
    expect(same(cn(cy, cm, cd), { year, month: 1, day: 1, leap: false })).toBe(true);
  });

  it("1985: tháng nhuận Việt Nam 21/3–19/4/1985 (Hồ Ngọc Đức); Trung Quốc nhuận 23/11–21/12/1984", () => {
    expect(solarToLunar(1985, 3, 20)).toMatchObject({ year: 1985, month: 2, leap: false });
    expect(solarToLunar(1985, 3, 21)).toEqual({ year: 1985, month: 2, day: 1, leap: true });
    expect(solarToLunar(1985, 4, 19)).toEqual({ year: 1985, month: 2, day: 30, leap: true });
    expect(solarToLunar(1985, 4, 20)).toMatchObject({ year: 1985, month: 3, day: 1, leap: false });
    expect(leapMonthOfLunarYear(1985)).toBe(2);
    expect(leapMonthOfLunarYear(1984)).toBe(0);
    // Trung Quốc: nhuận tháng 10 năm 1984, từ 23/11 đến 21/12/1984
    expect(cn(1984, 11, 23)).toEqual({ year: 1984, month: 10, day: 1, leap: true });
    expect(cn(1984, 12, 21)).toMatchObject({ year: 1984, month: 10, leap: true });
    expect(cn(1984, 12, 22)).toMatchObject({ year: 1984, month: 11, day: 1, leap: false });
    expect(solarToLunar(1984, 11, 23, 8)).toEqual({ year: 1984, month: 10, day: 1, leap: true });
    expect(leapMonthOfLunarYear(1984, 8)).toBe(10);
  });

  it("Bài báo RFA/Nhân Dân: 1998–2005 hai lịch giống hệt nhau (từ Tết 1998 đến giữa 2006)", () => {
    for (let jd = solarToJd(1998, 1, 28); jd <= solarToJd(2006, 6, 24); jd++) {
      const s = jdToSolar(jd);
      expect(same(solarToLunar(s.year, s.month, s.day), cn(s.year, s.month, s.day))).toBe(true);
    }
  });

  it("tháng nhuận các năm gần đây", () => {
    // Việt Nam trùng Trung Quốc: 2020 nhuận 4, 2023 nhuận 2, 2025 nhuận 6, 2028 nhuận 5
    expect([2020, 2023, 2025, 2028].map((y) => leapMonthOfLunarYear(y))).toEqual([4, 2, 6, 5]);
    expect(solarToLunar(2023, 3, 22)).toEqual({ year: 2023, month: 2, day: 1, leap: true });
    expect(solarToLunar(2023, 3, 21)).toMatchObject({ year: 2023, month: 2, leap: false });
    expect(leapMonthOfLunarYear(2024)).toBe(0);
  });
});

describe("đối chiếu với lunar-javascript (lịch Trung Quốc)", () => {
  it("UTC+8 cố định: khớp MỌI ngày 1900–2100 (73.414 ngày), trừ 5 tháng sai số thiên văn đã liệt kê", () => {
    const bad: string[] = [];
    for (let jd = FIRST; jd <= LAST; jd++) {
      const s = jdToSolar(jd);
      if (!same(solarToLunar(s.year, s.month, s.day, 8), cn(s.year, s.month, s.day))) bad.push(solarKey(s));
    }
    const expected: string[] = [];
    for (const [a, b] of KNOWN_APPROX_MONTHS_UTC8) {
      const [y1, m1, d1] = a.split("-").map(Number);
      const [y2, m2, d2] = b.split("-").map(Number);
      for (let jd = solarToJd(y1, m1, d1); jd <= solarToJd(y2, m2, d2); jd++) expected.push(solarKey(jdToSolar(jd)));
    }
    // Danh sách ngày lệch thực tế phải đúng bằng các tháng đã biết: không thêm, không bớt.
    expect(bad).toEqual(expected);
  }, 60_000);

  it("mặc định (UTC+7 từ 8/8/1967): ≥ 500 ngày ngẫu nhiên 1900–2100 — chỉ được khác Trung Quốc khi UTC+7 ≠ UTC+8", () => {
    const rand = rng(20261030);
    let compared = 0;
    let identical = 0;
    for (let i = 0; i < 600; i++) {
      const jd = FIRST + Math.floor(rand() * (LAST - FIRST + 1));
      const s = jdToSolar(jd);
      const vn = solarToLunar(s.year, s.month, s.day);
      const china = cn(s.year, s.month, s.day);
      const vn8 = solarToLunar(s.year, s.month, s.day, 8);
      compared++;
      if (same(vn, china)) {
        identical++;
        continue;
      }
      // Lệch thì phải GIẢI THÍCH được: do múi giờ (khác kết quả UTC+8) hoặc nằm trong giới hạn sai số đã biết.
      const explained = !same(vn, vn8) || inApprox(s);
      expect(explained, `${solarKey(s)}: VN ${JSON.stringify(vn)} khác TQ ${JSON.stringify(china)} không do múi giờ`).toBe(true);
    }
    expect(compared).toBe(600);
    expect(identical).toBeGreaterThan(500); // đa số ngày trùng nhau (lệch múi giờ chỉ ~3% số ngày)
  });

  it("toàn bộ 1900–2100: mọi ngày lệch Trung Quốc đều do múi giờ hoặc giới hạn sai số; tỉ lệ lệch dưới 4%", () => {
    let diff = 0;
    for (let jd = FIRST; jd <= LAST; jd++) {
      const s = jdToSolar(jd);
      const vn = solarToLunar(s.year, s.month, s.day);
      if (same(vn, cn(s.year, s.month, s.day))) continue;
      diff++;
      expect(!same(vn, solarToLunar(s.year, s.month, s.day, 8)) || inApprox(s), solarKey(s)).toBe(true);
    }
    expect(diff / (LAST - FIRST + 1)).toBeLessThan(0.04);
  }, 60_000);

  it("lunarToSolar khớp lunar-javascript (UTC+8) cho 600 ngày âm ngẫu nhiên, kể cả tháng nhuận", () => {
    const rand = rng(7);
    let checked = 0;
    for (let i = 0; i < 600; i++) {
      const jd = FIRST + Math.floor(rand() * (LAST - FIRST + 1));
      const s = jdToSolar(jd);
      const l = cn(s.year, s.month, s.day);
      if (l.year < 1900 || inApprox(s)) continue;
      const mine = lunarToSolar(l.year, l.month, l.day, l.leap, 8);
      const ref = Lunar.fromYmd(l.year, l.leap ? -l.month : l.month, l.day).getSolar().toYmd();
      expect(mine && solarKey(mine)).toBe(ref);
      checked++;
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("tháng nhuận: UTC+8 khớp lunar-javascript cho mọi năm 1900–2100 (trừ tháng sai số)", () => {
    for (let y = 1901; y <= 2099; y++) {
      if ([1914, 1915, 1916, 1920, 2057, 2097].includes(y)) continue;
      let refLeap = 0;
      for (let m = 1; m <= 12; m++) {
        const s = lunarToSolar(y, m, 1, true, 8);
        if (s) refLeap = m;
      }
      // lấy tháng nhuận từ thư viện kia: duyệt ngày trong năm âm
      let theirs = 0;
      const first = Lunar.fromYmd(y, 1, 1).getSolar().toYmd().split("-").map(Number);
      for (let k = 0; k < 385 && !theirs; k++) {
        const s = addDays({ year: first[0], month: first[1], day: first[2] }, k);
        const l = cn(s.year, s.month, s.day);
        if (l.year === y && l.leap) theirs = l.month;
      }
      expect(refLeap, `năm âm ${y}`).toBe(theirs);
    }
  });
});

describe("khứ hồi và biên", () => {
  it("solar → lunar → solar cho MỌI ngày 1900–2100 (mặc định múi giờ)", () => {
    for (let jd = FIRST; jd <= LAST; jd++) {
      const s = jdToSolar(jd);
      const l = solarToLunar(s.year, s.month, s.day);
      if (l.year < 1900) continue; // 1/1–30/1/1900 thuộc năm âm 1899 (ngoài phạm vi lunarToSolar)
      const back = lunarToSolar(l.year, l.month, l.day, l.leap);
      expect(back, `${solarKey(s)} -> ${JSON.stringify(l)}`).toEqual(s);
    }
  }, 120_000);

  it("ngày âm tăng dần đúng: mùng 1 nối tiếp ngày 29/30 của tháng trước, không nhảy/lặp, độ dài tháng 29 hoặc 30", () => {
    let prev = solarToLunar(1900, 1, 1);
    let len = prev.day;
    const lengths = new Map<string, number>();
    for (let jd = FIRST + 1; jd <= LAST; jd++) {
      const s = jdToSolar(jd);
      const l = solarToLunar(s.year, s.month, s.day);
      if (l.day === prev.day + 1) {
        expect([l.year, l.month, l.leap]).toEqual([prev.year, prev.month, prev.leap]);
        len = l.day;
      } else {
        expect(l.day).toBe(1);
        expect([29, 30]).toContain(prev.day);
        lengths.set(`${prev.year}/${prev.month}/${prev.leap}`, prev.day);
        // tháng kế tiếp: cùng số (nhuận) hoặc số+1, hoặc 12 → 1 khi sang năm
        const nextMonth = prev.month === 12 ? 1 : prev.month + 1;
        if (l.leap) expect(l.month).toBe(prev.month);
        else expect(l.month).toBe(nextMonth);
        expect(l.year).toBe(prev.month === 12 && !l.leap ? prev.year + 1 : prev.year);
      }
      prev = l;
    }
    expect(len).toBeGreaterThan(0);
    // daysInLunarMonth khớp độ dài đếm thực tế
    let checked = 0;
    for (const [k, v] of lengths) {
      const [y, m, leap] = k.split("/");
      if (+y < 1901 || +y > 2099) continue;
      expect(daysInLunarMonth(+y, +m, leap === "true"), k).toBe(v);
      checked++;
    }
    expect(checked).toBeGreaterThan(2000);
  }, 120_000);

  it("năm có 12 hoặc 13 tháng; tháng nhuận chỉ một lần mỗi năm; 7 năm nhuận trong chu kỳ 19 năm", () => {
    let leapYears = 0;
    for (let y = 1901; y <= 2099; y++) {
      let leaps = 0;
      for (let m = 1; m <= 12; m++) if (daysInLunarMonth(y, m, true) !== null) leaps++;
      expect(leaps).toBeLessThanOrEqual(1);
      if (leaps === 1) leapYears++;
    }
    // ~ 7/19 năm nhuận: 199 năm * 7/19 ≈ 73
    expect(leapYears).toBeGreaterThan(68);
    expect(leapYears).toBeLessThan(78);
  });

  it("ngày không tồn tại trả null: tháng nhuận vắng, ngày 30 của tháng thiếu, tháng/ngày ngoài khoảng", () => {
    expect(lunarToSolar(2024, 4, 1, true)).toBeNull(); // 2024 không nhuận
    expect(lunarToSolar(2023, 3, 1, true)).toBeNull(); // 2023 nhuận 2, không phải 3
    expect(lunarToSolar(2023, 2, 1, true)).toEqual({ year: 2023, month: 3, day: 22 });
    // tìm một tháng thiếu (29 ngày) rồi thử ngày 30
    let found = false;
    for (let m = 1; m <= 12 && !found; m++) {
      if (daysInLunarMonth(2024, m) === 29) {
        expect(lunarToSolar(2024, m, 30)).toBeNull();
        expect(lunarToSolar(2024, m, 29)).not.toBeNull();
        found = true;
      }
    }
    expect(found).toBe(true);
    expect(lunarToSolar(2024, 13, 1)).toBeNull();
    expect(lunarToSolar(2024, 0, 1)).toBeNull();
    expect(lunarToSolar(2024, 5, 31)).toBeNull();
    expect(lunarToSolar(2024, 5, 0)).toBeNull();
    expect(lunarToSolar(1800, 1, 1)).toBeNull();
    expect(daysInLunarMonth(2024, 4, true)).toBeNull();
  });

  it("có cả tháng đủ (30) lẫn tháng thiếu (29) trong năm", () => {
    const lens = Array.from({ length: 12 }, (_, i) => daysInLunarMonth(2026, i + 1) as number);
    expect(lens.every((n) => n === 29 || n === 30)).toBe(true);
    expect(lens).toContain(29);
    expect(lens).toContain(30);
  });

  it("từ chối ngày dương không hợp lệ hoặc ngoài phạm vi", () => {
    expect(() => solarToLunar(2023, 2, 29)).toThrow(RangeError);
    expect(() => solarToLunar(2023, 13, 1)).toThrow(RangeError);
    expect(() => solarToLunar(1500, 1, 1)).toThrow(RangeError);
    expect(() => solarToLunar(2300, 1, 1)).toThrow(RangeError);
  });

  it("Tết giữa múi giờ: ghép UTC+8 trước 8/8/1967 và UTC+7 sau đó vẫn liên tục (không nhảy/lặp ngày)", () => {
    // Đã bao quát bởi kiểm tra tăng dần ở trên; thêm kiểm tra điểm chuyển
    let prev = solarToLunar(1967, 7, 25);
    for (let d = 1; d <= 40; d++) {
      const s = addDays({ year: 1967, month: 7, day: 25 }, d);
      const l = solarToLunar(s.year, s.month, s.day);
      expect(l.day === prev.day + 1 || l.day === 1).toBe(true);
      prev = l;
    }
  });
});

describe("lặp lại hằng năm theo âm lịch (giỗ, sinh nhật âm)", () => {
  it("giỗ 10/3 âm lịch: lần tới khớp lunar-javascript", () => {
    const occ = nextSolarOccurrenceOfLunarDate(3, 10, false, { year: 2026, month: 1, day: 1 });
    expect(occ).not.toBeNull();
    const ref = Lunar.fromYmd(2026, 3, 10).getSolar().toYmd();
    expect(solarKey(occ!.solar)).toBe(ref);
    expect(occ!.leapFellBackToNormal).toBe(false);
    expect(occ!.dayClamped).toBe(false);
  });

  it("inclusive: đúng ngày giỗ thì tính hôm nay; không inclusive thì sang năm sau", () => {
    const today = { year: 2026, month: 2, day: 17 }; // mùng 1 Tết 2026
    expect(nextSolarOccurrenceOfLunarDate(1, 1, false, today, true)!.solar).toEqual(today);
    expect(nextSolarOccurrenceOfLunarDate(1, 1, false, today, false)!.solar).toEqual({ year: 2027, month: 2, day: 6 });
  });

  it("từ ngày cuối năm âm (tháng chạp) sang Tết: lần tới thuộc năm âm sau", () => {
    const occ = nextSolarOccurrenceOfLunarDate(1, 5, false, { year: 2026, month: 2, day: 16 })!;
    expect(occ.solar).toEqual({ year: 2026, month: 2, day: 21 });
    expect(occ.lunar.year).toBe(2026);
  });

  it("tháng nhuận gốc: năm có đúng tháng nhuận thì dùng tháng nhuận; năm khác dùng tháng thường cùng số", () => {
    // 2020 nhuận tháng 4 (bắt đầu 23/5/2020). Ngày gốc: 15 nhuận tháng 4.
    const in2020 = lunarOccurrenceInYear(2020, 4, 15, true)!;
    expect(in2020.leapFellBackToNormal).toBe(false);
    expect(in2020.lunar.leap).toBe(true);
    expect(solarKey(in2020.solar)).toBe(solarKey(addDays({ year: 2020, month: 5, day: 23 }, 14)));
    const in2021 = lunarOccurrenceInYear(2021, 4, 15, true)!;
    expect(in2021.leapFellBackToNormal).toBe(true);
    expect(in2021.lunar).toEqual({ year: 2021, month: 4, day: 15, leap: false });
    expect(in2021.solar).toEqual(lunarToSolar(2021, 4, 15));
    // Ngày gốc ở tháng thường: năm có nhuận cùng số vẫn dùng tháng thường
    const normal2020 = lunarOccurrenceInYear(2020, 4, 15, false)!;
    expect(normal2020.lunar.leap).toBe(false);
    expect(normal2020.solar).toEqual(lunarToSolar(2020, 4, 15, false));
    expect(compareSolar(normal2020.solar, in2020.solar)).toBeLessThan(0);
  });

  it("ngày 30 ở tháng thiếu dùng ngày cuối tháng (29)", () => {
    let tested = 0;
    for (let y = 2020; y <= 2030; y++) {
      for (let m = 1; m <= 12; m++) {
        const len = daysInLunarMonth(y, m);
        if (len === 29) {
          const occ = lunarOccurrenceInYear(y, m, 30)!;
          expect(occ.dayClamped).toBe(true);
          expect(occ.lunar.day).toBe(29);
          expect(occ.solar).toEqual(lunarToSolar(y, m, 29));
          tested++;
        } else if (len === 30) {
          const occ = lunarOccurrenceInYear(y, m, 30)!;
          expect(occ.dayClamped).toBe(false);
          expect(occ.solar).toEqual(lunarToSolar(y, m, 30));
        }
      }
    }
    expect(tested).toBeGreaterThan(20);
  });

  it("lunarOccurrencesInRange: đúng một dịp mỗi năm âm, thứ tự tăng, nằm trong khoảng", () => {
    const list = lunarOccurrencesInRange(8, 15, false, { year: 2024, month: 1, day: 1 }, { year: 2030, month: 12, day: 31 });
    expect(list.length).toBe(7);
    for (let i = 1; i < list.length; i++) expect(compareSolar(list[i - 1].solar, list[i].solar)).toBeLessThan(0);
    for (const o of list) {
      expect(solarToLunar(o.solar.year, o.solar.month, o.solar.day)).toMatchObject({ month: 8, day: 15, leap: false });
    }
    // Tết nằm đầu tháng 1: khoảng ngắn quanh ranh giới năm dương
    const tet = lunarOccurrencesInRange(1, 1, false, { year: 2026, month: 2, day: 17 }, { year: 2026, month: 2, day: 17 });
    expect(tet).toHaveLength(1);
    expect(lunarOccurrencesInRange(1, 1, false, { year: 2026, month: 2, day: 18 }, { year: 2026, month: 12, day: 31 })).toHaveLength(0);
  });

  it("mọi tổ hợp tháng/ngày gốc đều cho đúng một ngày dương mỗi năm âm 2000–2100 (không mất dịp nào)", () => {
    for (let y = 2000; y <= 2100; y += 7) {
      for (let m = 1; m <= 12; m++) {
        for (const d of [1, 15, 29, 30]) {
          for (const leap of [false, true]) {
            const occ = lunarOccurrenceInYear(y, m, d, leap);
            expect(occ, `${y}/${m}/${d}/${leap}`).not.toBeNull();
            expect(solarToLunar(occ!.solar.year, occ!.solar.month, occ!.solar.day)).toEqual(occ!.lunar);
          }
        }
      }
    }
  });
});

describe("Can Chi", () => {
  it.each([
    [1900, "Canh Tý"], [1945, "Ất Dậu"], [1975, "Ất Mão"], [1984, "Giáp Tý"], [2000, "Canh Thìn"],
    [2020, "Canh Tý"], [2024, "Giáp Thìn"], [2025, "Ất Tỵ"], [2026, "Bính Ngọ"], [2044, "Giáp Tý"],
  ])("năm %i là %s", (y, expected) => {
    expect(canChiYear(y)).toBe(expected);
  });
  it("chu kỳ 60 năm", () => {
    expect(canChiYear(1984)).toBe(canChiYear(2044));
    expect(canChiYear(2024)).not.toBe(canChiYear(2025));
  });
  it("Can Chi ngày: 2000-01-07 là ngày Giáp Tý (mốc thiên văn quen thuộc), chu kỳ 60 ngày", () => {
    expect(canChiDay({ year: 2000, month: 1, day: 7 })).toBe("Giáp Tý");
    expect(canChiDay({ year: 2000, month: 3, day: 7 })).toBe("Giáp Tý"); // +60 ngày (2000 nhuận)
    expect(canChiDay({ year: 2000, month: 1, day: 8 })).toBe("Ất Sửu");
  });
});
