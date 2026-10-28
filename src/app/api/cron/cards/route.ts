import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cards-cron";

export const dynamic = "force-dynamic";

/**
 * Cron hằng ngày (Vercel Hobby): tạo thông báo cho thiệp hẹn giờ đã tới giờ (deliver_due_cards).
 * Nhờ giao "lười", người nhận vẫn thấy thiệp đúng giờ dù cron chạy trễ (RLS theo scheduled_at); cron chỉ bổ sung thông báo.
 * Bắt buộc Authorization: Bearer CRON_SECRET. Lưu ý: /api/cron/ phải nằm trong danh sách công khai của src/proxy.ts.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) console.error("[cron/cards] Thiếu CRON_SECRET: từ chối mọi lời gọi.");
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("deliver_due_cards", { p_now: new Date().toISOString() });
    if (error) {
      console.error("[cron/cards] deliver_due_cards lỗi:", error.code);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
    return NextResponse.json({ delivered: data ?? 0 });
  } catch (e) {
    console.error("[cron/cards] lỗi:", e instanceof Error ? e.name : "unknown");
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
