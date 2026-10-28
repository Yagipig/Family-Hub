import { describe, expect, it } from "vitest";
import { parsePrefs } from "./notification-prefs";

const fd = (entries: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

describe("parsePrefs", () => {
  it("đọc công tắc và sắp xếp mốc nhắc, bỏ trùng", () => {
    const r = parsePrefs(fd([["birthdays", "on"], ["lead", "7"], ["lead", "0"], ["lead", "7"], ["events", "on"]]));
    expect(r).toEqual({ ok: true, value: { birthdays: true, leads: [0, 7], death: false, events: true, cards: false, gifts: false, chat: false } });
  });
  it("từ chối số ngày ngoài danh sách cho phép", () => {
    expect(parsePrefs(fd([["lead", "4"]])).ok).toBe(false);
    expect(parsePrefs(fd([["lead", "abc"]])).ok).toBe(false);
  });
  it("từ chối quá 6 mốc", () => {
    const r = parsePrefs(fd([0, 1, 2, 3, 5, 7, 14].map((n) => ["lead", String(n)] as [string, string])));
    expect(r.ok).toBe(false);
  });
  it("không chọn mốc nào là hợp lệ (mảng rỗng)", () => {
    expect(parsePrefs(fd([]))).toMatchObject({ ok: true, value: { leads: [] } });
  });
});
