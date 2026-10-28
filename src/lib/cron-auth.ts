import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Kiểm tra `Authorization: Bearer ${CRON_SECRET}` của route cron, so sánh thời gian hằng.
 * Băm SHA-256 cả hai vế trước khi so sánh để độ dài không bị lộ và timingSafeEqual luôn nhận hai buffer bằng nhau.
 * Thiếu bí mật hoặc bí mật quá ngắn (< 16 ký tự) => luôn từ chối (không bao giờ "mở" khi cấu hình thiếu).
 */
export function verifyCronAuth(authorizationHeader: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false;
  if (!authorizationHeader) return false;
  const a = createHash("sha256").update(authorizationHeader).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}
