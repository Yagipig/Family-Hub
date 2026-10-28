import { describe, expect, it } from "vitest";
import { eventToFormDefaults, parseEventForm, rsvpSchema } from "./events";
import type { EventRow } from "./calendar-model";

const base = { title: "Họp mặt", kind: "gathering", date: "2026-11-11", startTime: "19:00", timezone: "Asia/Ho_Chi_Minh", visibility: "family", recurrence: "none", location: "", description: "" };
const ok = (o: Record<string, string | null> = {}) => {
  const r = parseEventForm({ ...base, ...o });
  if (!r.ok) throw new Error(r.error);
  return r.payload;
};
const err = (o: Record<string, string | null> = {}) => {
  const r = parseEventForm({ ...base, ...o });
  return r.ok ? null : r.error;
};

describe("biểu mẫu sự kiện", () => {
  it("giờ theo múi giờ đã chọn được đổi sang UTC", () => {
    expect(ok().starts_at).toBe("2026-11-11T12:00:00.000Z");                                    // 19:00 VN
    expect(ok({ timezone: "Asia/Tokyo" }).starts_at).toBe("2026-11-11T10:00:00.000Z");           // 19:00 JST
    expect(ok({ timezone: "America/Los_Angeles" }).starts_at).toBe("2026-11-12T03:00:00.000Z");  // 19:00 PST
  });
  it("giờ kết thúc: cùng ngày hoặc ngày khác; phải sau bắt đầu", () => {
    expect(ok({ endTime: "21:30" }).ends_at).toBe("2026-11-11T14:30:00.000Z");
    expect(ok({ endDate: "2026-11-12", endTime: "09:00" }).ends_at).toBe("2026-11-12T02:00:00.000Z");
    expect(err({ endTime: "18:00" })).toMatch(/kết thúc/);
    expect(err({ endDate: "2026-12-30", endTime: "10:00" })).toMatch(/31 ngày/);
    expect(ok().ends_at).toBeNull();
  });
  it("cả ngày: bắt đầu 0h theo múi giờ; kết thúc là 0h ngày sau ngày cuối", () => {
    const p = ok({ allDay: "on", startTime: "" });
    expect(p.all_day).toBe(true);
    expect(p.starts_at).toBe("2026-11-10T17:00:00.000Z");
    expect(p.ends_at).toBeNull();
    const q = ok({ allDay: "on", startTime: "", endDate: "2026-11-13" });
    expect(q.ends_at).toBe("2026-11-13T17:00:00.000Z");
    expect(err({ allDay: "on", startTime: "", endDate: "2026-11-10" })).toMatch(/Ngày kết thúc/);
  });
  it("thiếu giờ khi không phải cả ngày", () => {
    expect(err({ startTime: "" })).toMatch(/giờ bắt đầu/);
    expect(err({ startTime: "25:00" })).toMatch(/Giờ chưa đúng/);
  });
  it("lặp âm lịch: mặc định lấy ngày âm của ngày chọn (11/11/2026 = 3/10)", () => {
    const p = ok({ recurrence: "yearly_lunar" });
    expect([p.lunar_month, p.lunar_day, p.lunar_leap]).toEqual([10, 3, false]);
    const q = ok({ recurrence: "yearly_lunar", lunarMonth: "7", lunarDay: "15", lunarLeap: "on" });
    expect([q.lunar_month, q.lunar_day, q.lunar_leap]).toEqual([7, 15, true]);
    expect(err({ recurrence: "yearly_lunar", lunarMonth: "7" })).toMatch(/đủ cả tháng và ngày/);
    expect(err({ recurrence: "yearly_lunar", lunarMonth: "13", lunarDay: "1" })).toMatch(/Tháng âm lịch/);
    expect(err({ recurrence: "yearly_lunar", lunarMonth: "1", lunarDay: "31" })).toMatch(/Ngày âm lịch/);
    const none = ok({ recurrence: "yearly_solar", lunarMonth: "7", lunarDay: "15" });
    expect([none.lunar_month, none.lunar_day]).toEqual([null, null]);          // chỉ lưu trường âm khi lặp âm
  });
  it("kiểm tra đầu vào: tên, ngày, múi giờ, nhánh, phạm vi, kiểu", () => {
    expect(err({ title: "   " })).toMatch(/tên sự kiện/);
    expect(err({ title: "a".repeat(201) })).toMatch(/200/);
    expect(err({ date: "2026-02-30" })).toMatch(/không hợp lệ/);
    expect(err({ date: "11/11/2026" })).toMatch(/định dạng/);
    expect(err({ date: "1800-01-01" })).toMatch(/1901/);
    expect(err({ timezone: "Mars/Olympus" })).toMatch(/Múi giờ/);
    expect(err({ branchId: "khong-phai-uuid" })).toMatch(/Nhánh/);
    expect(err({ visibility: "branch", branchId: "" })).toMatch(/Chọn nhánh/);
    expect(ok({ visibility: "branch", branchId: "b0000000-0000-4000-8000-00000000000a" }).visibility).toBe("branch");
    expect(err({ kind: "bay" })).toMatch(/Loại/);
    expect(err({ recurrence: "weekly" })).toMatch(/Kiểu lặp/);
    expect(err({ description: "x".repeat(4001) })).toMatch(/4000/);
    expect(err({ location: "x".repeat(301) })).toMatch(/300/);
  });
  it("khứ hồi qua form sửa (giờ theo múi giờ gốc)", () => {
    const p = ok({ timezone: "Asia/Tokyo", endTime: "21:00", location: "Tokyo", description: "mô tả" });
    const row: EventRow = { id: "e", family_id: "f", branch_id: null, title: p.title, description: p.description, location: p.location, kind: p.kind,
      starts_at: p.starts_at, ends_at: p.ends_at, all_day: p.all_day, timezone: p.timezone, visibility: p.visibility, recurrence: p.recurrence,
      lunar_month: null, lunar_day: null, lunar_leap: false, created_by: null, cancelled_at: null };
    const d = eventToFormDefaults(row);
    expect(d).toMatchObject({ date: "2026-11-11", startTime: "19:00", endTime: "21:00", endDate: "2026-11-11", timezone: "Asia/Tokyo", allDay: false });
    const again = parseEventForm({ ...d, allDay: d.allDay ? "on" : "", lunarLeap: d.lunarLeap ? "on" : "" });
    expect(again.ok && again.payload.starts_at).toBe(p.starts_at);
    // cả ngày nhiều ngày
    const a = ok({ allDay: "on", startTime: "", endDate: "2026-11-13" });
    const rowAll: EventRow = { ...row, all_day: true, starts_at: a.starts_at, ends_at: a.ends_at, timezone: "Asia/Ho_Chi_Minh" };
    const da = eventToFormDefaults(rowAll);
    expect(da).toMatchObject({ date: "2026-11-11", endDate: "2026-11-13", allDay: true, startTime: "", endTime: "" });
  });
  it("RSVP schema", () => {
    const good = { eventId: "11111111-1111-4111-8111-111111111111", occurrence: "2026-11-11", response: "yes", guests: "2", note: " ok " };
    expect(rsvpSchema.parse(good)).toMatchObject({ guests: 2, note: "ok" });
    expect(rsvpSchema.parse({ ...good, guests: "" }).guests).toBe(0);
    expect(rsvpSchema.safeParse({ ...good, guests: "21" }).success).toBe(false);
    expect(rsvpSchema.safeParse({ ...good, guests: "-1" }).success).toBe(false);
    expect(rsvpSchema.safeParse({ ...good, response: "co" }).success).toBe(false);
    expect(rsvpSchema.safeParse({ ...good, eventId: "x" }).success).toBe(false);
    expect(rsvpSchema.safeParse({ ...good, note: "x".repeat(301) }).success).toBe(false);
  });
});
