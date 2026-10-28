import { describe, expect, it } from "vitest";
import {
  MAX_BODY, chatError, dayKey, formatClock, formatListTime, isNetworkError, newClientId, normalizeBody,
} from "./chat";
import { groupSchema, idSchema, renameSchema, reportSchema, resolveSchema } from "./chat-schemas";

describe("normalizeBody", () => {
  it("cắt khoảng trắng đầu/cuối, giữ xuống dòng giữa", () => {
    expect(normalizeBody("  \n Xin chào\ncả nhà \t\n")).toEqual({ ok: true, body: "Xin chào\ncả nhà" });
  });
  it("từ chối rỗng / chỉ khoảng trắng", () => {
    expect(normalizeBody("").ok).toBe(false);
    expect(normalizeBody(" \n\t ").ok).toBe(false);
  });
  it("đúng 4000 ký tự được, 4001 thì không", () => {
    expect(normalizeBody("x".repeat(MAX_BODY)).ok).toBe(true);
    expect(normalizeBody("x".repeat(MAX_BODY + 1)).ok).toBe(false);
  });
});

describe("chatError", () => {
  it("dịch lỗi nghiệp vụ sang tiếng Việt, không lộ chi tiết nội bộ", () => {
    expect(chatError({ code: "P0001", message: "chat: rate limited" })).toMatch(/hơi nhanh/);
    expect(chatError({ code: "P0001", message: "chat: unavailable" })).toMatch(/chưa nhắn tin được/);
    expect(chatError({ code: "P0001", message: "chat: edit window closed" })).toMatch(/15 phút/);
    expect(chatError({ code: "42501", message: "forbidden" })).toMatch(/không có quyền/);
    expect(chatError({ code: "XX000", message: "relation \"messages\" does not exist" })).not.toMatch(/relation/);
  });
  it("nhận ra lỗi mất mạng", () => {
    expect(isNetworkError({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(isNetworkError({ code: "42501", message: "forbidden" })).toBe(false);
    expect(chatError({ message: "TypeError: Failed to fetch" })).toMatch(/mất kết nối/);
  });
  it("không có lỗi thì chuỗi rỗng", () => {
    expect(chatError(null)).toBe("");
  });
});

describe("newClientId", () => {
  it("sinh uuid v4 hợp lệ, không trùng", () => {
    const a = newClientId(), b = newClientId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
    expect(idSchema.safeParse(a).success).toBe(true);
  });
});

describe("thời gian theo múi giờ của từng người", () => {
  it("cùng một khoảnh khắc rơi vào hai ngày khác nhau ở hai múi giờ", () => {
    const iso = "2026-10-28T20:00:00.000000+00:00";
    expect(dayKey(iso, "Asia/Ho_Chi_Minh")).toBe("2026-10-29");
    expect(dayKey(iso, "America/Los_Angeles")).toBe("2026-10-28");
    expect(formatClock(iso, "Asia/Tokyo")).toMatch(/05[:.]00/);
  });
  it("múi giờ sai không làm hỏng giao diện", () => {
    expect(() => formatClock("2026-10-28T20:00:00+00:00", "Mars/Olympus")).not.toThrow();
  });
  it("danh sách: hôm nay hiện giờ, hôm khác hiện ngày/tháng", () => {
    const now = new Date("2026-10-28T12:00:00Z");
    expect(formatListTime("2026-10-28T03:30:00Z", "Asia/Ho_Chi_Minh", now)).toMatch(/10[:.]30/);
    expect(formatListTime("2026-10-20T03:30:00Z", "Asia/Ho_Chi_Minh", now)).toMatch(/20.10/);
  });
});

describe("schema máy chủ", () => {
  const u = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  it("groupSchema: tên và số thành viên", () => {
    expect(groupSchema.safeParse({ title: "Cả nhà", members: [u(1)] }).success).toBe(true);
    expect(groupSchema.safeParse({ title: " ", members: [u(1)] }).success).toBe(false);
    expect(groupSchema.safeParse({ title: "x".repeat(101), members: [u(1)] }).success).toBe(false);
    expect(groupSchema.safeParse({ title: "A", members: [] }).success).toBe(false);
    expect(groupSchema.safeParse({ title: "A", members: ["khong-phai-uuid"] }).success).toBe(false);
    expect(groupSchema.safeParse({ title: "A", members: Array.from({ length: 100 }, (_, i) => u(i + 1)) }).success).toBe(false);
  });
  it("renameSchema, reportSchema, resolveSchema", () => {
    expect(renameSchema.safeParse({ title: "Đà Lạt" }).success).toBe(true);
    expect(renameSchema.safeParse({ title: "" }).success).toBe(false);
    expect(reportSchema.safeParse({ reason: "abuse", note: "x" }).success).toBe(true);
    expect(reportSchema.safeParse({ reason: "khac-nua" }).success).toBe(false);
    expect(reportSchema.safeParse({ reason: "spam", note: "x".repeat(501) }).success).toBe(false);
    expect(resolveSchema.safeParse({ report: u(1), action: "hide_and_remove" }).success).toBe(true);
    expect(resolveSchema.safeParse({ report: u(1), action: "drop_table" }).success).toBe(false);
    expect(resolveSchema.safeParse({ report: "x", action: "dismiss" }).success).toBe(false);
  });
});
