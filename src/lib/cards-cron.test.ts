import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cards-cron";

const secret = "s3cr3t-cron-value-0123456789abcdef";

describe("isCronAuthorized", () => {
  it("chấp nhận đúng bí mật", () => {
    expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
  });
  it("từ chối sai/thiếu/định dạng lạ", () => {
    expect(isCronAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isCronAuthorized(`Bearer ${secret.slice(0, -1)}`, secret)).toBe(false);
    expect(isCronAuthorized(secret, secret)).toBe(false); // thiếu "Bearer "
    expect(isCronAuthorized(`bearer ${secret}`, secret)).toBe(false);
    expect(isCronAuthorized("Bearer ", secret)).toBe(false);
    expect(isCronAuthorized("", secret)).toBe(false);
    expect(isCronAuthorized(null, secret)).toBe(false);
    expect(isCronAuthorized(undefined, secret)).toBe(false);
  });
  it("đóng an toàn khi chưa cấu hình hoặc bí mật quá ngắn (kể cả khi header trùng)", () => {
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer short", "short")).toBe(false);
  });
});
