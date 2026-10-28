import { describe, expect, it } from "vitest";
import {
  formatDateTimeVi, formatOffset, isValidTimeZone, localDateKey, tzOffsetMinutes, wallTimeToUtc, zonedParts,
} from "./tz";

describe("múi giờ", () => {
  it("isValidTimeZone", () => {
    expect(isValidTimeZone("Asia/Ho_Chi_Minh")).toBe(true);
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
    expect(isValidTimeZone("x".repeat(100))).toBe(false);
  });
  it("độ lệch cố định và theo mùa", () => {
    expect(tzOffsetMinutes(new Date("2026-11-11T00:00:00Z"), "Asia/Ho_Chi_Minh")).toBe(420);
    expect(tzOffsetMinutes(new Date("2026-11-11T00:00:00Z"), "Asia/Tokyo")).toBe(540);
    expect(tzOffsetMinutes(new Date("2026-01-15T00:00:00Z"), "America/Los_Angeles")).toBe(-480);
    expect(tzOffsetMinutes(new Date("2026-07-15T00:00:00Z"), "America/Los_Angeles")).toBe(-420);
    expect(tzOffsetMinutes(new Date("2026-07-15T00:00:00Z"), "Asia/Kolkata")).toBe(330);
    expect(formatOffset(new Date("2026-07-15T00:00:00Z"), "Asia/Kolkata")).toBe("UTC+5:30");
    expect(formatOffset(new Date("2026-07-15T00:00:00Z"), "Asia/Ho_Chi_Minh")).toBe("UTC+7");
    expect(formatOffset(new Date("2026-01-15T00:00:00Z"), "America/Los_Angeles")).toBe("UTC-8");
  });
  it("ngày lịch của cùng một thời điểm khác nhau theo múi giờ (giống kịch bản trong test SQL)", () => {
    const p = new Date("2026-11-10T17:00:00Z");
    expect(localDateKey(p, "Asia/Ho_Chi_Minh")).toBe("2026-11-11");
    expect(localDateKey(p, "America/Los_Angeles")).toBe("2026-11-10");
    expect(zonedParts(p, "Asia/Ho_Chi_Minh").hour).toBe(0);
  });
  it("giờ tường → UTC, khứ hồi", () => {
    const d = wallTimeToUtc(2026, 11, 11, 23, 0, "Asia/Ho_Chi_Minh");
    expect(d.toISOString()).toBe("2026-11-11T16:00:00.000Z");
    expect(formatDateTimeVi(d, "America/Los_Angeles")).toBe("08:00 · Thứ tư 11/11/2026");
    expect(formatDateTimeVi(d, "Asia/Ho_Chi_Minh")).toBe("23:00 · Thứ tư 11/11/2026");
  });
  it("mùa hè: nhảy giờ và lùi giờ", () => {
    // LA 2026-03-08 02:30 không tồn tại (2:00 -> 3:00): được dời sang sau
    const gap = wallTimeToUtc(2026, 3, 8, 2, 30, "America/Los_Angeles");
    expect(zonedParts(gap, "America/Los_Angeles").hour).toBe(3);
    // 2026-11-01 01:30 lặp hai lần; lấy lần đầu (PDT, UTC-7)
    const fall = wallTimeToUtc(2026, 11, 1, 1, 30, "America/Los_Angeles");
    expect(fall.toISOString()).toBe("2026-11-01T08:30:00.000Z");
    // Thời điểm thường: khứ hồi cho nhiều múi giờ
    for (const tz of ["Asia/Tokyo", "Europe/Paris", "Australia/Sydney", "America/New_York", "Asia/Kolkata", "Pacific/Auckland"]) {
      const u = wallTimeToUtc(2026, 6, 15, 9, 45, tz);
      const p = zonedParts(u, tz);
      expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 6, 15, 9, 45]);
    }
  });
});
