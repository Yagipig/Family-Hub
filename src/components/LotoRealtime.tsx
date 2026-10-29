"use client";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Dong bo thoi gian thuc cho phong lo to: lang nghe thay doi o bang phong / luot ho / nguoi thang
 * (RLS van loc theo tung nguoi) roi lam moi trang. GamesAutoRefresh (polling) van la lop du phong.
 */
export function LotoRealtime({ roomId }: { roomId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let disposed = false;
    const refresh = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { if (!disposed) router.refresh(); }, 250);
    };
    channel = supabase
      .channel(`loto:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loto_rooms", filter: `id=eq.${roomId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "loto_calls", filter: `room_id=eq.${roomId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "loto_winners", filter: `room_id=eq.${roomId}` }, refresh)
      .subscribe();
    return () => {
      disposed = true;
      if (timer.current) window.clearTimeout(timer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [roomId, router, supabase]);

  return null;
}
