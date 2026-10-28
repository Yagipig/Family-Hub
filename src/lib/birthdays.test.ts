import { describe, expect, it } from "vitest";
import { type MemberLike, memberOccurrences } from "./birthdays";
import { solarKey, type SolarDate } from "./lunar";

const base: MemberLike = {
  id: "m", full_name: "Thành viên", birthday_mode: "solar", is_deceased: false,
  birth_solar_year: null, birth_solar_month: null, birth_solar_day: null,
  birth_lunar_year: null, birth_lunar_month: null, birth_lunar_day: null, birth_lunar_leap: false,
  death_solar_year: null, death_solar_month: null, death_solar_day: null,
  death_lunar_month: null, death_lunar_day: null, death_lunar_leap: false,
};
const mk = (o: Partial<MemberLike>): MemberLike => ({ ...base, ...o });
const D = (y: number, m: number, d: number): SolarDate => ({ year: y, month: m, day: d });
const keys = (m: MemberLike, a: SolarDate, b: SolarDate) => memberOccurrences(m, a, b).map((o) => solarKey(o.date));

// Các ca dưới đây dùng đúng dữ liệu và kết quả mong đợi của supabase/tests/rls_events.sql (nhất quán TS ↔ SQL).
describe("memberOccurrences (phản chiếu SQL _member_hits_on)", () => {
  const T = D(2026, 11, 11);   // 3/10 âm lịch

  it("sinh nhật dương lịch + tuổi", () => {
    const alice = mk({ id: "alice", full_name: "Alice", birth_solar_year: 1980, birth_solar_month: 11, birth_solar_day: 11 });
    const o = memberOccurrences(alice, T, T);
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ kind: "birthday", years: 46, rule: "solar" });
    expect(o[0].lunar).toMatchObject({ month: 10, day: 3, leap: false });   // "Dương lịch 11/11 · âm lịch 3/10"
  });
  it("sinh nhật âm lịch (3/10) và tuổi theo năm âm", () => {
    const bao = mk({ id: "bao", full_name: "Bao", birthday_mode: "lunar", birth_solar_year: 1970, birth_solar_month: 5, birth_solar_day: 5,
      birth_lunar_year: 1970, birth_lunar_month: 10, birth_lunar_day: 3 });
    const o = memberOccurrences(bao, D(2026, 1, 1), D(2026, 12, 31));
    expect(o.map((x) => solarKey(x.date))).toEqual(["2026-11-11"]);       // KHÔNG theo ngày dương 5/5
    expect(o[0]).toMatchObject({ years: 56, rule: "lunar" });
  });
  it("chế độ both: trùng ngày chỉ một mục; khác ngày thì hai mục", () => {
    const chi = mk({ birthday_mode: "both", birth_solar_year: 1990, birth_solar_month: 11, birth_solar_day: 11,
      birth_lunar_year: 1990, birth_lunar_month: 10, birth_lunar_day: 3 });
    expect(keys(chi, D(2026, 1, 1), D(2026, 12, 31))).toEqual(["2026-11-11"]);
    const two = mk({ birthday_mode: "both", birth_solar_year: 1990, birth_solar_month: 5, birth_solar_day: 5,
      birth_lunar_year: 1990, birth_lunar_month: 10, birth_lunar_day: 3 });
    expect(keys(two, D(2026, 1, 1), D(2026, 12, 31))).toEqual(["2026-05-05", "2026-11-11"]);
  });
  it("dữ liệu bị che (null) hoặc thiếu: không có mục, không gây lỗi", () => {
    expect(keys(mk({ birth_solar_year: 1980 }), D(2026, 1, 1), D(2026, 12, 31))).toEqual([]);                // "Thieu"
    expect(keys(mk({ birthday_mode: "lunar", birth_solar_year: 1990, birth_solar_month: 2, birth_solar_day: 31 }), D(2026, 1, 1), D(2026, 12, 31))).toEqual([]);   // "Loi": 31/2
    expect(keys(mk({}), D(2026, 1, 1), D(2026, 12, 31))).toEqual([]);
  });
  it("chưa tới sinh nhật đầu tiên (sinh năm nay) thì bỏ qua", () => {
    expect(keys(mk({ birth_solar_year: 2026, birth_solar_month: 11, birth_solar_day: 11 }), T, T)).toEqual([]);
    expect(keys(mk({ birth_solar_year: 2026, birth_solar_month: 11, birth_solar_day: 11 }), D(2027, 11, 11), D(2027, 11, 11))).toEqual(["2027-11-11"]);
  });
  it("người đã mất không có sinh nhật; có ngày giỗ", () => {
    const quado = mk({ is_deceased: true, birth_solar_year: 1930, birth_solar_month: 11, birth_solar_day: 11 });
    expect(keys(quado, T, T)).toEqual([]);
  });
  it("ngày giỗ theo âm lịch, lần thứ 6 (2026 - 2020)", () => {
    const ong = mk({ is_deceased: true, death_lunar_month: 10, death_lunar_day: 3, death_solar_year: 2020 });
    const o = memberOccurrences(ong, T, T);
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ kind: "death_anniversary", years: 6, rule: "lunar" });
  });
  it("ngày giỗ suy từ ngày mất dương đầy đủ (17/11/2020 = 3/10 âm), lần thứ 6", () => {
    const cu = mk({ is_deceased: true, death_solar_year: 2020, death_solar_month: 11, death_solar_day: 17 });
    const o = memberOccurrences(cu, T, T);
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ years: 6, rule: "lunar" });
    expect(o[0].lunar).toMatchObject({ month: 10, day: 3 });
  });
  it("giỗ nhuận tháng 6: 2026 dùng tháng 6 thường (28/7), 2025 dùng tháng nhuận (8/8)", () => {
    const cuoi = mk({ is_deceased: true, death_lunar_month: 6, death_lunar_day: 15, death_lunar_leap: true, death_solar_year: 2024 });
    const o26 = memberOccurrences(cuoi, D(2026, 1, 1), D(2026, 12, 31));
    expect(o26.map((x) => solarKey(x.date))).toEqual(["2026-07-28"]);
    expect(o26[0]).toMatchObject({ years: 2, leapFellBackToNormal: true });
    const o25 = memberOccurrences(cuoi, D(2025, 1, 1), D(2025, 12, 31));
    expect(o25.map((x) => solarKey(x.date))).toEqual(["2025-08-08"]);
    expect(o25[0]).toMatchObject({ years: 1, leapFellBackToNormal: false });
  });
  it("giỗ ngày 30 của tháng thiếu → ngày 29 (16/4/2026)", () => {
    const hai = mk({ is_deceased: true, death_lunar_month: 2, death_lunar_day: 30, death_solar_year: 2019 });
    const o = memberOccurrences(hai, D(2026, 1, 1), D(2026, 12, 31));
    expect(o.map((x) => solarKey(x.date))).toEqual(["2026-04-16"]);
    expect(o[0].dayClamped).toBe(true);
  });
  it("sinh 29/2: năm không nhuận → 28/2; năm nhuận → 29/2", () => {
    const m = mk({ birth_solar_year: 2000, birth_solar_month: 2, birth_solar_day: 29 });
    expect(keys(m, D(2027, 1, 1), D(2027, 12, 31))).toEqual(["2027-02-28"]);
    expect(keys(m, D(2028, 1, 1), D(2028, 12, 31))).toEqual(["2028-02-29"]);
    expect(memberOccurrences(m, D(2028, 1, 1), D(2028, 12, 31))[0].years).toBe(28);
  });
  it("chỉ có ngày dương đầy đủ nhưng chọn chế độ âm: suy ra âm lịch", () => {
    // 11/11/1950 = 2/10 âm lịch (tra bằng lunar.ts); sinh nhật âm rơi vào 10/11/2026 (2/10)
    const m = mk({ birthday_mode: "lunar", birth_solar_year: 1950, birth_solar_month: 11, birth_solar_day: 11 });
    expect(keys(m, D(2026, 1, 1), D(2026, 12, 31))).toEqual(["2026-11-10"]);
  });
  it("chỉ có âm lịch đầy đủ nhưng chế độ dương: suy ra ngày dương gốc", () => {
    // 3/10/2020 âm = 17/11/2020 dương → sinh nhật dương 17/11
    const m = mk({ birthday_mode: "solar", birth_lunar_year: 2020, birth_lunar_month: 10, birth_lunar_day: 3 });
    expect(keys(m, D(2026, 1, 1), D(2026, 12, 31))).toEqual(["2026-11-17"]);
  });
  it("khoảng thời gian dài qua nhiều năm: mỗi năm một dịp, thứ tự tăng", () => {
    const m = mk({ birth_solar_year: 1980, birth_solar_month: 11, birth_solar_day: 11 });
    expect(keys(m, D(2026, 1, 1), D(2029, 12, 31))).toEqual(["2026-11-11", "2027-11-11", "2028-11-11", "2029-11-11"]);
  });
});

import { upcomingFromMembers } from "./birthdays";
describe("upcomingFromMembers", () => {
  const alice = mk({ id: "alice", full_name: "Alice", birth_solar_year: 1980, birth_solar_month: 11, birth_solar_day: 11 });
  const bob = mk({ id: "bob", full_name: "Bob", birth_solar_year: 1990, birth_solar_month: 11, birth_solar_day: 14 });
  const ghost = mk({ id: "ghost", full_name: "Ẩn", birth_solar_year: 1990 });   // ngày bị che -> không có mục
  const dead = mk({ id: "d", full_name: "Cụ", is_deceased: true, death_solar_month: 11, death_solar_day: 12 });   // chỉ biết tháng/ngày dương -> giỗ theo dương
  it("sắp xếp theo số ngày còn lại, tính cả hôm nay, bỏ hồ sơ bị che", () => {
    const r = upcomingFromMembers([bob, ghost, alice, dead], D(2026, 11, 11), 7);
    expect(r.map((x) => [x.name, x.daysUntil])).toEqual([["Alice", 0], ["Cụ", 1], ["Bob", 3]]);
    expect(r[0].weekday).toBe(3);   // 11/11/2026 là thứ Tư
  });
  it("ngoài phạm vi thì không có; rangeDays âm/quá lớn được kẹp", () => {
    expect(upcomingFromMembers([bob], D(2026, 11, 11), 2)).toHaveLength(0);
    expect(upcomingFromMembers([alice], D(2026, 11, 11), -5).map((x) => x.daysUntil)).toEqual([0]);
    expect(upcomingFromMembers([alice], D(2026, 1, 1), 100000).length).toBeLessThanOrEqual(2);
  });
});
