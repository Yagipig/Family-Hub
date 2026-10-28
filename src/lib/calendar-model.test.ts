import { describe, expect, it } from "vitest";
import {
  type EventRow, buildCalendarItems, expandEvent, monthGrid, monthRange, nextInstance, parseMonthParam, shiftMonth,
} from "./calendar-model";
import { type MemberLike } from "./birthdays";
import { type SolarDate, solarKey } from "./lunar";

const D = (y: number, m: number, d: number): SolarDate => ({ year: y, month: m, day: d });
const ev = (o: Partial<EventRow>): EventRow => ({
  id: "e", family_id: "f", branch_id: null, title: "Sự kiện", description: null, location: null, kind: "gathering",
  starts_at: "2026-11-11T16:00:00Z", ends_at: null, all_day: false, timezone: "Asia/Ho_Chi_Minh", visibility: "family",
  recurrence: "none", lunar_month: null, lunar_day: null, lunar_leap: false, created_by: null, cancelled_at: null, ...o,
});
const days = (i: ReturnType<typeof expandEvent>) => i.map((x) => x.days.map(solarKey));

describe("lưới tháng", () => {
  it("6 tuần × 7 ngày, bắt đầu thứ Hai, liên tục", () => {
    const g = monthGrid(2026, 11);   // 1/11/2026 là Chủ nhật
    expect(g).toHaveLength(6);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g[0][0].key).toBe("2026-10-26");   // thứ Hai trước đó
    expect(g[0][6].key).toBe("2026-11-01");
    expect(g[0][6].inMonth).toBe(true);
    expect(g[0][0].inMonth).toBe(false);
    expect(g.flat().filter((d) => d.inMonth)).toHaveLength(30);
    expect(g[5][6].key).toBe("2026-12-06");
    const m2 = monthGrid(2026, 2);   // 1/2/2026 là Chủ nhật -> bắt đầu 26/1
    expect(m2[0][0].key).toBe("2026-01-26");
    expect(m2.flat().filter((d) => d.inMonth)).toHaveLength(28);
  });
  it("ngày âm lịch kèm theo từng ô", () => {
    const g = monthGrid(2026, 11).flat();
    const d = g.find((x) => x.key === "2026-11-11")!;
    expect(d.lunar).toMatchObject({ month: 10, day: 3 });
  });
  it("chuyển tháng và đọc tham số", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 3, -15)).toEqual({ year: 2024, month: 12 });
    expect(parseMonthParam("2026-07", D(2026, 1, 1))).toEqual({ year: 2026, month: 7 });
    expect(parseMonthParam("2026-13", D(2026, 1, 15))).toEqual({ year: 2026, month: 1 });
    expect(parseMonthParam("abc", D(2026, 5, 15))).toEqual({ year: 2026, month: 5 });
    expect(parseMonthParam("1500-01", D(2026, 5, 15))).toEqual({ year: 2026, month: 5 });
    expect(monthRange(2026, 11)).toEqual({ from: D(2026, 10, 26), to: D(2026, 12, 6) });
  });
});

describe("trải sự kiện", () => {
  it("sự kiện có giờ: ngày hiển thị theo múi giờ người xem (23h VN = 8h sáng cùng ngày ở LA)", () => {
    const r = expandEvent(ev({}), D(2026, 11, 1), D(2026, 11, 30), "America/Los_Angeles");
    expect(days(r)).toEqual([["2026-11-11"]]);
    const r2 = expandEvent(ev({ starts_at: "2026-11-11T01:00:00Z" }), D(2026, 11, 1), D(2026, 11, 30), "America/Los_Angeles");
    expect(days(r2)).toEqual([["2026-11-10"]]);       // 8h sáng VN 11/11 = 17h ngày 10/11 ở LA
    expect(solarKey(r2[0].occurrence)).toBe("2026-11-11");   // ngày gốc (khóa RSVP) vẫn là 11/11
  });
  it("sự kiện cả ngày không đổi ngày theo múi giờ người xem", () => {
    const e = ev({ all_day: true, starts_at: "2026-11-11T17:00:00Z" });   // 0h ngày 12/11 giờ VN
    expect(days(expandEvent(e, D(2026, 11, 1), D(2026, 11, 30), "America/Los_Angeles"))).toEqual([["2026-11-12"]]);
    expect(days(expandEvent(e, D(2026, 11, 1), D(2026, 11, 30), "Asia/Tokyo"))).toEqual([["2026-11-12"]]);
  });
  it("nhiều ngày: phủ từng ngày; cả ngày kết thúc exclusive", () => {
    const e = ev({ all_day: true, starts_at: "2026-11-11T17:00:00Z", ends_at: "2026-11-14T17:00:00Z" });  // 12,13,14/11
    expect(days(expandEvent(e, D(2026, 11, 1), D(2026, 11, 30), "Asia/Ho_Chi_Minh"))).toEqual([["2026-11-12", "2026-11-13", "2026-11-14"]]);
    const t = ev({ starts_at: "2026-11-11T16:00:00Z", ends_at: "2026-11-13T02:00:00Z" });   // 23h 11/11 -> 9h 13/11 VN
    expect(days(expandEvent(t, D(2026, 11, 1), D(2026, 11, 30), "Asia/Ho_Chi_Minh"))).toEqual([["2026-11-11", "2026-11-12", "2026-11-13"]]);
  });
  it("sự kiện bắt đầu trước khoảng nhưng kéo dài vào khoảng vẫn hiện", () => {
    const e = ev({ starts_at: "2026-10-30T16:00:00Z", ends_at: "2026-11-02T16:00:00Z" });
    const r = expandEvent(e, D(2026, 11, 1), D(2026, 11, 30), "Asia/Ho_Chi_Minh");
    expect(r).toHaveLength(1);
    expect(days(r)[0]).toContain("2026-11-01");
  });
  it("ngoài khoảng thì không hiện", () => {
    expect(expandEvent(ev({}), D(2026, 12, 1), D(2026, 12, 31), "Asia/Ho_Chi_Minh")).toHaveLength(0);
  });
  it("lặp dương lịch hằng năm, không có lần nào trước ngày gốc", () => {
    const e = ev({ recurrence: "yearly_solar", starts_at: "2029-03-05T02:00:00Z" });
    expect(expandEvent(e, D(2028, 1, 1), D(2028, 12, 31), "Asia/Ho_Chi_Minh")).toHaveLength(0);
    const r = expandEvent(e, D(2029, 1, 1), D(2031, 12, 31), "Asia/Ho_Chi_Minh");
    expect(r.map((x) => solarKey(x.occurrence))).toEqual(["2029-03-05", "2030-03-05", "2031-03-05"]);
  });
  it("lặp dương 29/2: năm không nhuận dùng 28/2", () => {
    const e = ev({ recurrence: "yearly_solar", starts_at: "2028-02-29T02:00:00Z" });
    const r = expandEvent(e, D(2028, 1, 1), D(2030, 12, 31), "Asia/Ho_Chi_Minh");
    expect(r.map((x) => solarKey(x.occurrence))).toEqual(["2028-02-29", "2029-02-28", "2030-02-28"]);
  });
  it("lặp âm lịch: 3/10 âm — 11/11/2026 và 31/10/2027; giữ giờ tại múi giờ gốc", () => {
    const e = ev({ recurrence: "yearly_lunar", lunar_month: 10, lunar_day: 3, starts_at: "2020-11-17T02:00:00Z" });   // 9h VN
    const r = expandEvent(e, D(2026, 1, 1), D(2027, 12, 31), "Asia/Ho_Chi_Minh");
    expect(r.map((x) => solarKey(x.occurrence))).toEqual(["2026-11-11", "2027-10-31"]);
    expect(r[0].startUtc.toISOString()).toBe("2026-11-11T02:00:00.000Z");
    // Ở LA, 9h sáng VN ngày 11/11 là 18h ngày 10/11
    const la = expandEvent(e, D(2026, 11, 1), D(2026, 11, 30), "America/Los_Angeles");
    expect(days(la)).toEqual([["2026-11-10"]]);
  });
  it("lặp âm lịch không có lần nào trước ngày gốc", () => {
    const e = ev({ recurrence: "yearly_lunar", lunar_month: 10, lunar_day: 3, starts_at: "2020-11-17T02:00:00Z" });
    expect(expandEvent(e, D(2019, 1, 1), D(2020, 11, 16), "Asia/Ho_Chi_Minh")).toHaveLength(0);
    expect(expandEvent(e, D(2020, 11, 17), D(2020, 11, 17), "Asia/Ho_Chi_Minh")).toHaveLength(1);
  });
  it("lặp âm lịch tháng nhuận gốc (nhuận 6): 2025 dùng tháng nhuận, 2026 dùng tháng thường", () => {
    const e = ev({ recurrence: "yearly_lunar", lunar_month: 6, lunar_day: 15, lunar_leap: true, starts_at: "2024-07-20T02:00:00Z" });
    const r = expandEvent(e, D(2025, 1, 1), D(2026, 12, 31), "Asia/Ho_Chi_Minh");
    expect(r.map((x) => solarKey(x.occurrence))).toEqual(["2025-08-08", "2026-07-28"]);
  });
  it("nextInstance chọn lần kế tiếp", () => {
    const e = ev({ recurrence: "yearly_lunar", lunar_month: 10, lunar_day: 3, starts_at: "2020-11-17T02:00:00Z" });
    expect(solarKey(nextInstance(e, new Date("2026-11-12T00:00:00Z"), "Asia/Ho_Chi_Minh")!.occurrence)).toBe("2027-10-31");
    expect(solarKey(nextInstance(e, new Date("2026-11-11T00:00:00Z"), "Asia/Ho_Chi_Minh")!.occurrence)).toBe("2026-11-11");
    expect(nextInstance(ev({}), new Date("2030-01-01T00:00:00Z"), "Asia/Ho_Chi_Minh")).toBeNull();
  });
});

describe("gộp mục lịch", () => {
  const member = (o: Partial<MemberLike>): MemberLike => ({
    id: "m1", full_name: "Alice", birthday_mode: "solar", is_deceased: false,
    birth_solar_year: 1980, birth_solar_month: 11, birth_solar_day: 11, birth_lunar_year: null, birth_lunar_month: null,
    birth_lunar_day: null, birth_lunar_leap: false, death_solar_year: null, death_solar_month: null, death_solar_day: null,
    death_lunar_month: null, death_lunar_day: null, death_lunar_leap: false, ...o,
  });
  it("sinh nhật, giỗ và sự kiện cùng ngày được sắp xếp: cả ngày, sinh nhật, giỗ, rồi sự kiện có giờ theo giờ", () => {
    const items = buildCalendarItems({
      events: [ev({ id: "a", title: "Tiệc", starts_at: "2026-11-11T16:00:00Z" })],
      members: [member({}), member({ id: "m2", full_name: "Ông", is_deceased: true, death_lunar_month: 10, death_lunar_day: 3, death_solar_year: 2020 })],
      viewerTz: "Asia/Ho_Chi_Minh", from: D(2026, 11, 1), to: D(2026, 11, 30),
    });
    const day = items.filter((i) => i.date === "2026-11-11");
    expect(day.map((i) => i.type)).toEqual(["birthday", "death_anniversary", "event"]);
    expect(day[2].time).toBe("23:00");
    expect(day[0]).toMatchObject({ title: "Sinh nhật Alice", subtitle: "Tròn 46 tuổi", lunarText: "3/10" });
    expect(day[1]).toMatchObject({ title: "Giỗ Ông", subtitle: "Giỗ lần thứ 6" });
  });
  it("sự kiện đã huỷ vẫn hiện, đánh dấu cancelled", () => {
    const items = buildCalendarItems({
      events: [ev({ cancelled_at: "2026-11-01T00:00:00Z" })], members: [], viewerTz: "Asia/Ho_Chi_Minh", from: D(2026, 11, 1), to: D(2026, 11, 30),
    });
    expect(items[0].cancelled).toBe(true);
  });
  it("dữ liệu ẩn (không có ngày) không tạo mục", () => {
    const items = buildCalendarItems({
      events: [], members: [member({ birth_solar_month: null, birth_solar_day: null })], viewerTz: "Asia/Ho_Chi_Minh", from: D(2026, 1, 1), to: D(2026, 12, 31),
    });
    expect(items).toEqual([]);
  });
});
