"use client";
import { useState, useTransition } from "react";
import { tvControl } from "@/app/(app)/tro-choi/tv/actions";
import { lotoBallStyle } from "@/components/LotoBall";

/**
 * Qua bong "so vua ho" tren man hinh TV nhung BAM DUOC (nguoi dung yeu cau 30/10/2026):
 * chu phong/admin cham vao bong de ho so tiep (hoac bat dau van khi dang cho).
 * Dung chung server action tvControl nhu TvController; nguoi khong co quyen khong thay nut nay.
 * Kich thuoc bong tinh theo chieu cao man hinh (dvh) de ca trang TV vua mot man hinh.
 */
export function TvBallButton({ roomId, action, last }: { roomId: string; action: "loto_next" | "loto_start"; last: number | null }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const label = action === "loto_start" ? "Chạm vào bóng để bắt đầu ván" : "Chạm vào bóng để hô số tiếp";
  const size = { width: "min(30dvh, 56vw, 24rem)", fontSize: "min(15dvh, 28vw, 11rem)" } as const;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        aria-label={label}
        onClick={() => start(async () => {
          const r = await tvControl({ roomId, action });
          setErr(r.ok ? null : r.message);
        })}
        style={last != null ? { ...lotoBallStyle(last), ...size } : size}
        className={`animate-loto-pop flex aspect-square items-center justify-center rounded-full font-black leading-none ring-4 ring-yellow-300/80 disabled:opacity-70 sm:ring-8 ${
          last != null ? "text-white" : "bg-champagne text-wine-dark"
        }`}
      >
        {pending ? "…" : last ?? "–"}
      </button>
      <p className="text-xs text-white/70 sm:text-sm">{label}</p>
      {err && <p role="alert" className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-danger">{err}</p>}
    </div>
  );
}
