"use client";
import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";

/**
 * Chia se phong lo to: ma QR tro thang vao phong + nut sao chep lien ket.
 * Nguoi nha quet QR bang dien thoai (da dang nhap) la vao phong, khoi go ma phong.
 */
export function RoomShare({ roomId, code }: { roomId: string; code: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setUrl(`${window.location.origin}/tro-choi/lo-to/${roomId}`); }, [roomId]);

  const qr = useMemo(() => {
    if (!url) return null;
    try {
      const q = qrcode(0, "M");
      q.addData(url);
      q.make();
      const count = q.getModuleCount();
      const cells: Array<{ r: number; c: number }> = [];
      for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (q.isDark(r, c)) cells.push({ r, c });
      return { count, cells };
    } catch { return null; }
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch { setCopied(false); }
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      {qr && (
        <div className="rounded-xl bg-white p-2">
          <svg width={168} height={168} viewBox={`0 0 ${qr.count} ${qr.count}`} role="img" aria-label={`Mã QR vào phòng, mã phòng ${code}`} className="block">
            <rect width={qr.count} height={qr.count} fill="#ffffff" />
            {qr.cells.map(({ r, c }) => <rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} fill="#1a1a1a" />)}
          </svg>
        </div>
      )}
      <div className="min-w-52 flex-1 space-y-2">
        <p className="text-base">
          Người nhà quét mã QR bằng điện thoại (đã đăng nhập) là vào thẳng phòng này — hoặc gửi liên kết:
        </p>
        <p className="break-all rounded-xl bg-champagne-soft px-3 py-2 text-sm">{url || "…"}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button" onClick={() => void copy()}
            className="inline-flex min-h-12 items-center rounded-xl bg-wine px-4 py-2 text-base font-semibold text-white hover:bg-wine-dark"
          >
            {copied ? "Đã sao chép liên kết ✓" : "Sao chép liên kết phòng"}
          </button>
          <span className="text-base text-ink-soft">Mã phòng: <strong className="tracking-widest text-ink">{code}</strong></span>
        </div>
      </div>
    </div>
  );
}
