import { describe, expect, it } from "vitest";
import { verifyCronAuth } from "./cron-auth";

const S = "s3cret-s3cret-s3cret-123";
describe("verifyCronAuth", () => {
  it("chấp nhận đúng Bearer", () => {
    expect(verifyCronAuth(`Bearer ${S}`, S)).toBe(true);
  });
  it("từ chối sai, thiếu, khác độ dài, sai kiểu", () => {
    expect(verifyCronAuth(`Bearer ${S}x`, S)).toBe(false);
    expect(verifyCronAuth(`Bearer ${S.slice(0, -1)}`, S)).toBe(false);
    expect(verifyCronAuth(S, S)).toBe(false);
    expect(verifyCronAuth(`bearer ${S}`, S)).toBe(false);
    expect(verifyCronAuth("", S)).toBe(false);
    expect(verifyCronAuth(null, S)).toBe(false);
    expect(verifyCronAuth(undefined, S)).toBe(false);
    expect(verifyCronAuth(`Bearer ${S} `, S)).toBe(false);
  });
  it("cấu hình thiếu/yếu thì luôn từ chối (kể cả header 'Bearer undefined' / 'Bearer ')", () => {
    expect(verifyCronAuth("Bearer undefined", undefined)).toBe(false);
    expect(verifyCronAuth("Bearer ", "")).toBe(false);
    expect(verifyCronAuth("Bearer short", "short")).toBe(false);
    expect(verifyCronAuth(`Bearer ${S}`, undefined)).toBe(false);
  });
});
