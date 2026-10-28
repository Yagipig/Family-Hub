"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Lam moi nhe bang polling (khong dung Realtime de tiet kiem ket noi): goi router.refresh() moi `seconds` giay,
 * chi khi tab dang hien va co mang. Tam dung khi `active` = false.
 */
export function GamesAutoRefresh({ seconds = 4, active = true }: { seconds?: number; active?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    };
    const id = window.setInterval(tick, Math.max(2, seconds) * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds, active]);
  return null;
}
