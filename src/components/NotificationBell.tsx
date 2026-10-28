import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Chuông thông báo (server component): đếm thông báo chưa đọc của CHÍNH người dùng (RLS) và dẫn tới /thong-bao.
 * Người tích hợp gắn vào header của layout (đã đăng nhập). Lỗi đếm => hiện chuông không số, không làm hỏng trang.
 */
export async function NotificationBell({ className = "" }: { className?: string }) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  const n = count ?? 0;
  const label = n > 0 ? `Thông báo: ${n} chưa đọc` : "Thông báo: không có thông báo mới";
  return (
    <Link
      href="/thong-bao"
      aria-label={label}
      className={`relative inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg px-3 text-base font-medium hover:bg-wine-dark ${className}`}
    >
      <span aria-hidden className="text-xl">🔔</span>
      {n > 0 && (
        <span aria-hidden className="absolute right-0 top-1 min-w-6 rounded-full bg-champagne px-1.5 text-center text-sm font-bold text-ink">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}
