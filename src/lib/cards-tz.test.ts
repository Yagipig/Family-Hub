import { describe, expect, it } from "vitest";
import { formatInZone, isValidTimeZone, nowLocalInput, tzOffsetMinutes, utcOffsetLabel, utcToLocalInput, zonedLocalToUtc } from "./cards-tz";

describe("zonedLocalToUtc", () => {
  it("đổi đúng cho Việt Nam (UTC+7), Nhật (UTC+9)", () => {
    expect(zonedLocalToUtc("2026-12-31T08:00", "Asia/Ho_Chi_Minh")?.toISOString()).toBe("2026-12-31T01:00:00.000Z");
    expect(zonedLocalToUtc("2026-12-31T08:00", "Asia/Tokyo")?.toISOString()).toBe("2026-12-30T23:00:00.000Z");
  });
  it("tôn trọng giờ mùa hè/đông (Los Angeles, Berlin)", () => {
    expect(zonedLocalToUtc("2026-01-15T09:00", "America/Los_Angeles")?.toISOString()).toBe("2026-01-15T17:00:00.000Z");
    expect(zonedLocalToUtc("2026-07-01T09:00", "America/Los_Angeles")?.toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(zonedLocalToUtc("2026-07-01T09:00", "Europe/Berlin")?.toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(zonedLocalToUtc("2026-12-01T09:00", "Europe/Berlin")?.toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });
  it("giờ không tồn tại (nhảy giờ) được đẩy về sau; giờ lặp lấy lần đầu", () => {
    // New York 2026-03-08 02:30 không tồn tại (02:00 -> 03:00)
    const gap = zonedLocalToUtc("2026-03-08T02:30", "America/New_York")!;
    expect(gap.toISOString()).toBe("2026-03-08T07:30:00.000Z"); // = 03:30 EDT
    // New York 2026-11-01 01:30 xuất hiện hai lần (EDT rồi EST): lấy lần đầu 05:30Z
    expect(zonedLocalToUtc("2026-11-01T01:30", "America/New_York")?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });
  it("vòng đi-về: đổi sang đồng hồ múi giờ rồi đổi ngược lại ra đúng thời điểm (ngoài giờ lặp/nhảy)", { timeout: 30000 }, () => {
    const zones = ["Asia/Ho_Chi_Minh", "Asia/Tokyo", "America/Los_Angeles", "Europe/Paris", "Australia/Sydney", "Asia/Kolkata", "Pacific/Auckland"];
    let n = 0;
    for (const tz of zones) {
      for (let i = 0; i < 400; i++) {
        const d = new Date(Date.UTC(2026, 0, 1) + i * 22 * 3600_000 + 13 * 60_000);
        const local = utcToLocalInput(d, tz);
        const back = zonedLocalToUtc(local, tz)!;
        // chỉ so sánh khi không rơi vào giờ lặp (hai thời điểm cho cùng đồng hồ)
        const twin = utcToLocalInput(new Date(d.getTime() + 3600_000), tz) === local || utcToLocalInput(new Date(d.getTime() - 3600_000), tz) === local;
        if (!twin) { expect(back.toISOString().slice(0, 16)).toBe(d.toISOString().slice(0, 16)); n++; }
      }
    }
    expect(n).toBeGreaterThan(2000);
  });
  it("từ chối định dạng/ngày/múi giờ sai", () => {
    expect(zonedLocalToUtc("2026-02-30T10:00", "Asia/Tokyo")).toBeNull();
    expect(zonedLocalToUtc("2026-13-01T10:00", "Asia/Tokyo")).toBeNull();
    expect(zonedLocalToUtc("2026-01-01T25:00", "Asia/Tokyo")).toBeNull();
    expect(zonedLocalToUtc("2026-01-01 10:00", "Asia/Tokyo")).toBeNull();
    expect(zonedLocalToUtc("", "Asia/Tokyo")).toBeNull();
    expect(zonedLocalToUtc("2026-01-01T10:00", "Khong/Co")).toBeNull();
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
    expect(isValidTimeZone("Khong/Co")).toBe(false);
  });
});

describe("hiển thị múi giờ", () => {
  it("nhãn UTC và định dạng", () => {
    const d = new Date("2026-12-30T23:00:00Z");
    expect(utcOffsetLabel(d, "Asia/Tokyo")).toBe("UTC+9");
    expect(utcOffsetLabel(d, "Asia/Kolkata")).toBe("UTC+5:30");
    expect(utcOffsetLabel(d, "America/Los_Angeles")).toBe("UTC−8");
    expect(tzOffsetMinutes(d, "Asia/Ho_Chi_Minh")).toBe(420);
    expect(formatInZone(d, "Asia/Tokyo")).toContain("08:00");
    expect(formatInZone(d, "Asia/Tokyo")).toContain("UTC+9");
  });
  it("nowLocalInput trả đúng giá trị cho ô datetime-local", () => {
    const now = new Date("2026-12-30T23:00:00Z");
    expect(nowLocalInput("Asia/Tokyo", 0, now)).toBe("2026-12-31T08:00");
    expect(nowLocalInput("Asia/Tokyo", 90, now)).toBe("2026-12-31T09:30");
    expect(nowLocalInput("Asia/Ho_Chi_Minh", 0, now)).toBe("2026-12-31T06:00");
  });
});
