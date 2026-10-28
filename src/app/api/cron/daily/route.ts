import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runMediaCleanup, type CleanupAdmin } from "@/lib/media-cleanup";

/**
 * Job hằng ngày (MỘT cron duy nhất): (1) sinh thông báo sinh nhật / ngày giỗ / nhắc sự kiện, (2) thông báo thiệp hẹn giờ đã tới giờ, (3) dọn media mồ côi.
 *  - Bảo vệ bằng `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron tự gửi header này khi biến CRON_SECRET được đặt).
 *  - Đây là NƠI DUY NHẤT dùng createAdminClient() của module Lịch. Hàm SQL generate_daily_notifications chỉ cấp cho service_role.
 *  - Chạy lại bao nhiêu lần cũng không trùng thông báo (dedupe_key trong SQL).
 *  - Phản hồi chỉ chứa số liệu tổng hợp, không lộ tên hay nội dung.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  // Vercel Hobby chỉ cho tối đa 2 cron/dự án và mỗi cron chạy 1 lần/ngày => MỘT cron gọi tất cả job hằng ngày.
  // Mỗi job độc lập: một job lỗi không chặn các job còn lại; phản hồi chỉ có số liệu tổng hợp.
  const headers = { "Cache-Control": "no-store" };
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    console.error("cron/daily: thiếu cấu hình service_role");
    return NextResponse.json({ ok: false }, { status: 500, headers });
  }
  const now = new Date().toISOString();
  const out: Record<string, unknown> = {};
  let ok = true;

  try {
    const { data, error } = await admin.rpc("generate_daily_notifications", { p_now: now });
    if (error) { ok = false; out.notifications = { ok: false }; console.error("cron/daily: generate_daily_notifications lỗi", error.code); }
    else out.notifications = { ok: true, result: data };
  } catch { ok = false; out.notifications = { ok: false }; }

  try {
    const { data, error } = await admin.rpc("deliver_due_cards", { p_now: now });
    if (error) { ok = false; out.cards = { ok: false }; console.error("cron/daily: deliver_due_cards lỗi", error.code); }
    else out.cards = { ok: true, delivered: data ?? 0 };
  } catch { ok = false; out.cards = { ok: false }; }

  try {
    const r = await runMediaCleanup(admin as unknown as CleanupAdmin);
    if (!r.ok) ok = false;
    out.media = r;
  } catch { ok = false; out.media = { ok: false }; }

  return NextResponse.json({ ok, ...out }, { status: ok ? 200 : 500, headers });
}

export const GET = handle;
export const POST = handle;
