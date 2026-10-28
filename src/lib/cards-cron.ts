import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Xác thực lời gọi cron (Vercel Cron gửi "Authorization: Bearer <CRON_SECRET>").
 * So sánh hằng-thời-gian trên băm SHA-256 (cùng độ dài nên timingSafeEqual không ném lỗi, không lộ độ dài bí mật).
 * Thiếu/ngắn bí mật cấu hình => luôn từ chối (đóng an toàn).
 */
export function isCronAuthorized(authorizationHeader: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false;
  const header = authorizationHeader ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const given = createHash("sha256").update(header.slice(7)).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, expected);
}
