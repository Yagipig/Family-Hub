"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Danh sách cuộc trò chuyện KHÔNG mở kênh Realtime (tiết kiệm giới hạn kết nối miễn phí):
 * tự tải lại dữ liệu khi quay lại tab và mỗi 60 giây khi tab đang hiện.
 */
export function ChatAutoRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, everyMs);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [router, everyMs]);
  return null;
}
