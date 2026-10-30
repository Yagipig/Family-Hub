"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { tvControl, type TvResult } from "@/app/(app)/tro-choi/tv/actions";

export type TvAction = { action: "loto_next" | "loto_start" | "lottery_run" | "bc_roll" | "bc_new_round"; label: string; key: string; targetId?: string };

/**
 * Nut va phim to cho nguoi dan chuong trinh (chi hien voi quan tri). Phim Space/Enter = hanh dong chinh,
 * phim N = hanh dong phu (neu co), phim F = toan man hinh. Chong bam lien tuc: khoa nut trong luc dang xu ly.
 */
export function TvController({ roomId, primary, secondary, compact = false }: { roomId: string; primary: TvAction | null; secondary?: TvAction | null; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<TvResult | null>(null);

  const run = useCallback((a: TvAction | null | undefined) => {
    if (!a || pending) return;
    start(async () => setMsg(await tvControl({ roomId, action: a.action, targetId: a.targetId })));
  }, [pending, roomId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); run(primary); }
      else if (e.key.toLowerCase() === "n") run(secondary);
      else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, primary, secondary]);

  return (
    <div className={`flex flex-wrap items-center ${compact ? "gap-2" : "gap-4"}`}>
      {primary && (
        <button type="button" disabled={pending} onClick={() => run(primary)}
          className={compact
            ? "min-h-11 rounded-xl bg-champagne px-5 py-2 text-lg font-bold text-wine-dark hover:bg-champagne-soft disabled:opacity-60"
            : "min-h-20 rounded-2xl bg-champagne px-10 py-4 text-3xl font-bold text-wine-dark hover:bg-champagne-soft disabled:opacity-60"}>
          {pending ? "Đang xử lý…" : primary.label} <span className={`${compact ? "text-sm" : "text-xl"} font-semibold opacity-70`}>(phím {primary.key})</span>
        </button>
      )}
      {secondary && (
        <button type="button" disabled={pending} onClick={() => run(secondary)}
          className={compact
            ? "min-h-11 rounded-xl border-2 border-champagne px-4 py-2 text-base font-bold text-champagne hover:bg-wine-dark disabled:opacity-60"
            : "min-h-20 rounded-2xl border-2 border-champagne px-8 py-4 text-2xl font-bold text-champagne hover:bg-wine-dark disabled:opacity-60"}>
          {secondary.label} <span className={`${compact ? "text-xs" : "text-lg"} font-semibold opacity-70`}>(phím {secondary.key})</span>
        </button>
      )}
      <button type="button" onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.())}
        className={compact
          ? "min-h-11 rounded-lg border border-champagne/60 px-3 py-1.5 text-sm font-semibold text-champagne hover:bg-wine-dark"
          : "min-h-14 rounded-xl border border-champagne/60 px-5 py-2 text-lg font-semibold text-champagne hover:bg-wine-dark"}>
        Toàn màn hình (phím F)
      </button>
      {msg && !msg.ok && <p role="alert" className={`rounded-xl bg-white font-semibold text-danger ${compact ? "px-3 py-2 text-sm" : "px-4 py-3 text-xl"}`}>{msg.message}</p>}
    </div>
  );
}
