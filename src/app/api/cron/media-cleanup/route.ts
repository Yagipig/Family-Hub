import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized, runMediaCleanup, type CleanupAdmin } from "@/lib/media-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dọn media mồ côi / đã xóa quá hạn. Gọi bằng cron của Vercel (GET, Authorization: Bearer CRON_SECRET), mỗi ngày.
 * Dùng service_role: CHỈ ở route này, sau khi xác thực bí mật. Thiếu CRON_SECRET => từ chối.
 * Lưu ý: proxy.ts phải cho phép đường dẫn /api/cron/ đi qua không cần đăng nhập (xem báo cáo tích hợp).
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET chưa được cấu hình" }, { status: 503 });
  if (!isCronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runMediaCleanup(createAdminClient() as unknown as CleanupAdmin);
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
